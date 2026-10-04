# Ages of War II

A browser lane-battle game: two bases at opposite ends of one lane, train units, build turrets, earn XP, evolve through five ages
(Stone → Medieval → Renaissance → Modern → Future) and destroy the enemy base. Single player vs AI (Easy / Normal / Hard) and
peer-to-peer online 1v1.

All names, sprites and sounds are original: sprites are drawn programmatically at boot (pixel art on offscreen canvases, scaled with
nearest-neighbour) and every sound is synthesised with the Web Audio API. There are no asset files.

**Stack:** TypeScript · Vite · Phaser 3 · PeerJS (WebRTC) · Vitest. No backend; it deploys as a static site.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (sim, AI, network protocol)
npm run typecheck
```

## Build & deploy

```bash
npm run build      # type-checks, then writes the static site to dist/
npm run preview    # serve dist/ locally
```

`dist/` uses relative asset paths (`base: './'`), so upload it anywhere: GitHub Pages (any sub-path), Netlify, Cloudflare Pages, S3…
Multiplayer needs a **secure context** for WebRTC in most browsers when not on `localhost`, so serve the deployed site over HTTPS
(all of the above do).

## Test multiplayer on one machine

1. `npm run dev`, open <http://localhost:5173> in a browser window.
2. **Multiplayer → Create game** – a 6-character code appears.
3. Open a **second window** (ideally not a tab hidden behind the first; background tabs are throttled by browsers) on the same URL.
4. **Multiplayer → Join game**, type the code, **Connect**.

The host plays on the left, the guest sees the same battle mirrored so their base is on the left too. Top-right shows the ping.
A hosted match keeps simulating when its tab is in the background (the host timer runs in a Web Worker).

**Offline / no internet?** Run your own signaling server and point both clients at it:

```bash
npx peerjs --port 9000                # `peer` is already a devDependency
```

then in the game: **Settings → Multiplayer signaling server** → host `localhost`, port `9000`, path `/`, Secure off.
The same fields can be set at build time with `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE`
(see `src/game/settings.ts`). Leaving the host empty uses PeerJS's free public server.

## Controls

| Key | Action | Key | Action |
|---|---|---|---|
| `1`–`4` | Train unit | `Q` `W` `E` | Build turret (first free slot) |
| `R` | Buy turret slot | `Shift`+`1`–`4` | Sell turret in that slot |
| `S` | Special ability | `V` | Evolve |
| `←` `→` / mouse at screen edge / drag / minimap | Scroll the lane | `P` / `Esc` | Pause (SP) / menu |
| `M` | Mute | `F3` | Debug overlay |

Hover any button for a tooltip with stats and its shortcut.

## Phones & tablets

Play in **landscape**. The canvas fills the whole screen (Phaser `EXPAND`), and the HUD switches to a compact, touch-sized layout on short
screens. In portrait a "rotate your phone" screen appears (single-player auto-pauses until you rotate back).

* **Tap** a unit/turret/slot/special/evolve button to use it. **Long-press** a button to read its stats (keyboard hints are hidden on touch).
* **Drag** the battlefield or the minimap to scroll. The ⛶ button enters fullscreen and locks landscape where the browser allows it.
* The screen is kept awake during a match (Wake Lock API, where supported).
* To test on a phone, run `npm run dev -- --host` and open the printed network URL (use the same Wi-Fi). WebRTC multiplayer from a
  phone needs HTTPS in production (deploy it, or use a tunnel).
* A hosted match needs the host's browser kept in the foreground on mobile; mobile OSes pause background tabs.

## Where to tweak balance

**Start with [`src/data/tuning.ts`](src/data/tuning.ts)** – the single file of dials:

* `LANE_LENGTH` – map width (default 1700; shorter = faster games).
* `AGE_GAP` – how different the ages are: `1` = raw tables (big jumps), `0` = every age has Stone Age stats. Default `0.62`.
* Global multipliers: unit HP / damage / speed / range / train time, prices, kill bounties, turret & special damage, special cooldown,
  base HP, evolve XP.
* Economy (start gold, queue size, turret slots and prices, sell refund, passive income), XP rules, and the AI difficulty table.

Per-item raw stats live next to it in [`src/data/`](src/data) (`tuning.ts` is applied on top of them):

| File | Contents |
|---|---|
| `units.ts` | Per-unit cost, HP, damage, attack interval, range, speed, train time, gold/XP bounty, width |
| `turrets.ts` | Per-turret cost, damage, fire interval, range, projectile (speed, splash) |
| `specials.ts` | Cooldown, number of impacts, duration, damage, radius |
| `ages.ts` | XP needed to evolve, base HP, which units/turrets/special each age has |
| `config.ts` | Technical constants (tick rate, snapshot rate, reconnect grace) and re-exports `tuning.ts` |

Times are in seconds and speeds in pixels/second. Editing the data changes a build hash, so players on different balance builds
cannot join each other's games.

## Architecture

```
src/
  data/   balance data (above)
  sim/    pure deterministic simulation – no Phaser, no DOM
          types · rng (seeded mulberry32) · state · commands (validation) · step (one tick) · ai
  net/    protocol · host (HostSession) · guest (GuestSession) · lobby (PeerJS) · controllers · session glue
  game/   Phaser scenes, procedural art (art/), audio, settings, controllers
  ui/     DOM menus, HUD, tooltips, debug overlay
tests/    vitest suites
```

* **Simulation** – `step(state)` advances exactly one tick (30/s). State is plain JSON. Randomness only comes from the seeded RNG
  stored *inside* the state, so identical seed + commands ⇒ identical game (tested).
* **Commands** – `TRAIN_UNIT`, `BUY_TURRET`, `SELL_TURRET`, `BUY_TURRET_SLOT`, `USE_SPECIAL`, `EVOLVE`. Keyboard/mouse, the AI and the
  network all call `applyCommand(state, side, cmd)`, which validates everything (gold, slots, ages, cooldowns, queue, XP).
* **Rendering** – `GameScene` only reads the controller's state and the events the sim emits (hits, deaths, shots, strikes…) to draw
  sprites, projectiles, floating numbers, shakes and sounds. Sprite positions are smoothed per frame, so 15 Hz snapshots look fluid.
* **Controllers** – `LocalController` (sim + AI), `HostController` (authoritative sim + network), `GuestController` (renders snapshots).
  The HUD and scene don't care which one they have.

### Network protocol (host-authoritative, JSON over a PeerJS data channel)

```
guest → host   hello {v, token}      version + build hash check, session token (for reconnects)
host  → guest  welcome {seed} | reject {reason}
guest → host   cmd {seq, cmd}        validated by the host with the same applyCommand; never trusted
host  → guest  snap {ack, state, events}   every 2 ticks (15 Hz): full state, events since the last snapshot, last applied seq
both           ping/pong {ts}        round-trip time (shown in the HUD)
host  → guest  end {winner, reason}; either side: bye (left on purpose)
```

* **Responsive guest UI:** the guest applies its own unacknowledged commands on top of the newest snapshot (client-side prediction using
  the same `applyCommand`), so queued units and spent gold show instantly; the host's `ack` drops them once confirmed.
* **Disconnects:** a closed connection or 6 s of silence pauses the host sim and starts a 30 s grace timer. The guest keeps trying to
  reconnect with its token; on success the match resumes with a fresh snapshot. If the grace period expires, the remaining player wins.
  Leaving on purpose (menu / closing the tab) sends `bye` and ends the match immediately.
* **Version check:** `hello` carries a protocol number plus a hash of the balance data; mismatched builds are rejected with a message.

## Design decisions

* **Menus and HUD are DOM, the match is Phaser.** Text, forms, tooltips and responsive layout are far simpler in HTML/CSS; Phaser
  handles the world, input scrolling, effects and the scene lifecycle. The HUD is a fixed 1280×720 layer scaled to match the canvas.
* **XP to the "defender".** The brief says kills give more XP to the defender than the attacker. Implemented as: a kill made on the
  killer's own half of the lane earns ×1.5 XP (`DEFENDER_XP_MULT`). Damage also earns a little XP (`XP_PER_DAMAGE`).
* **Evolving consumes XP** ("evolving costs XP"). Base max HP rises and the HP already lost stays lost. Turrets you own stay.
* **Passive gold trickle** (`PASSIVE_GOLD`) so nobody can soft-lock at 0 gold with no army.
* **Keys:** the brief lists `E` for both turret and evolve, so evolve is `V`. Turret slot buying is `R`.
* **One Colossus Titan at a time** per player (queued or alive) – it is an elite unit.
* **Specials** pick random enemy units as targets (seeded RNG), hit with a short delay so the falling projectile can be drawn, and
  never damage the base.
* **Turrets** target the enemy unit nearest to your base and are indestructible; ranges are measured from the base's front edge.
* **Ranged units** stop and shoot at their range, can fire over allies, and queue behind allies like everyone else.
* **Guest view is mirrored** purely in rendering (`x → laneLength − x`); the simulation stays side 0 vs side 1.
* **Debug cheats** (F3 buttons) are disabled in online matches.
* **Less deterministic combat.** Every hit rolls ±20% damage with an 8% crit chance (×1.8). Specials only partly land: each impact
  is aimed at an enemy unit with 60% probability (otherwise a random spot on the lane), drifts up to 120 px, and damage falls off
  toward the edge of the blast. All dials are in `tuning.ts`; the rolls use the seeded sim RNG so matches stay reproducible.
* **Dynamics:** melee units get a charge bonus on their first blow after walking into combat; a base's special is instantly
  refreshed once when it drops below 25% HP (*Last Stand*); and **overtime** (after 5 min, ramping over 2.5 min) makes units hit
  harder, turrets weaker and bases more fragile so symmetrical standoffs resolve.
* **AI** difficulty also adjusts income, train speed and unit power (HP/damage): Easy 0.8×/0.8×/0.85×, Hard 1.8×/1.6×/1.3×
  (see `DIFFICULTY` in `tuning.ts`). Late game, production is capped by queue + train time, which is why train speed and unit power
  are the levers that matter. The Hard AI also counters the enemy mix (melee/tanks vs ranged armies, ranged vs melee), uses its special
  against pushes and in emergencies, and evolves immediately. In simulations Hard beats Normal consistently.
* Identical late-game AI mirrors can stalemate behind strong turrets; humans can break that with specials and the Titan.
* Sprite interpolation uses per-frame exponential smoothing rather than keeping two snapshots, which also hides snapshot jitter.

## Debug overlay

`F3` shows tick, unit/projectile/special counts, FPS, latency and side, with buttons to grant gold/XP (single player only).
In dev builds `window.__aow` exposes `{ game, controller }` for poking at the state from the console.
