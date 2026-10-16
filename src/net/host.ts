import { RECONNECT_GRACE_SEC, SNAPSHOT_EVERY_TICKS } from '../data/config';
import { applyCommand } from '../sim/commands';
import { createGame } from '../sim/state';
import type { Roster } from '../data/ages';
import { drainEvents, forfeit, step } from '../sim/step';
import type { CmdResult, Command, GameState, SimEvent } from '../sim/types';
import { BUILD_VERSION, type Msg, type Transport } from './protocol';

const HEARTBEAT_TIMEOUT_MS = 6000;

export interface HostOptions {
  now?: () => number;
  graceMs?: number;
  onJoin?: () => void; // first valid guest arrived: start the match
  onReject?: (reason: string) => void;
  roster?: Roster;
}

/**
 * Host side of a match. Owns the authoritative GameState; the host player is side 0, the guest side 1.
 * Everything the guest sends is validated by `applyCommand` — the guest is never trusted.
 */
export class HostSession {
  readonly state: GameState;
  running = false;
  guestConnected = false;
  rtt = 0;
  graceUntil: number | null = null;
  lastSeq = 0;
  readonly localEvents: SimEvent[] = [];
  private outEvents: SimEvent[] = [];
  private t: Transport | null = null;
  private token: string | null = null;
  private ticksSinceSnap = 0;
  private lastPing = 0;
  private lastHeard = 0;
  private now: () => number;
  private graceMs: number;

  constructor(readonly seed: number, private opts: HostOptions = {}) {
    this.state = createGame({ seed, roster: opts.roster });
    this.now = opts.now ?? (() => performance.now());
    this.graceMs = opts.graceMs ?? RECONNECT_GRACE_SEC * 1000;
  }

  /** Hand a freshly opened connection to the session; it must say hello first. */
  attach(t: Transport): void {
    t.onMessage = (m) => this.onMsg(t, m);
    t.onClose = () => this.onClose(t);
  }

  private onMsg(t: Transport, m: Msg): void {
    if (!m || typeof m !== 'object') return;
    if (t === this.t) this.lastHeard = this.now();
    switch (m.t) {
      case 'hello':
        return this.hello(t, m.v, m.token);
      case 'cmd':
        if (t === this.t) this.guestCommand(m.seq, m.cmd);
        return;
      case 'ping':
        return t.send({ t: 'pong', ts: m.ts });
      case 'pong':
        if (t === this.t) this.rtt = this.now() - m.ts;
        return;
      case 'bye':
        if (t === this.t && this.state.winner === null) {
          forfeit(this.state, 0, 'Your opponent left the game.');
          this.collect();
        }
    }
  }

  private hello(t: Transport, v: string, token: string): void {
    const reject = (reason: string) => {
      t.send({ t: 'reject', reason });
      t.onClose = () => {};
      t.close();
      this.opts.onReject?.(reason);
    };
    if (v !== BUILD_VERSION) return reject(`Version mismatch: host is ${BUILD_VERSION}, you are ${v}. Both players need the same build.`);
    if (typeof token !== 'string' || !token) return reject('Bad handshake.');
    if (this.token === null) this.token = token;
    else if (this.token !== token) return reject('This room is full.');
    if (this.t && this.t !== t) {
      const old = this.t;
      this.t = null;
      old.onClose = () => {};
      old.close();
    }
    this.t = t;
    this.lastHeard = this.now();
    this.guestConnected = true;
    this.graceUntil = null;
    t.send({ t: 'welcome', v: BUILD_VERSION, token: this.token, seed: this.seed });
    if (!this.running) {
      this.running = true;
      this.opts.onJoin?.();
    }
    this.sendSnapshot();
  }

  private onClose(t: Transport): void {
    if (t !== this.t) return;
    this.t = null;
    this.guestConnected = false;
    if (this.running && this.state.winner === null) this.graceUntil = this.now() + this.graceMs;
  }

  /** True while the sim should NOT advance (waiting for a guest to (re)connect). */
  get paused(): boolean {
    return !this.running || !this.guestConnected;
  }
  get graceSecondsLeft(): number | undefined {
    return this.graceUntil === null ? undefined : Math.max(0, (this.graceUntil - this.now()) / 1000);
  }

  /** Advance one tick (no-op while paused). */
  step(): void {
    if (this.paused || this.state.winner !== null) return;
    step(this.state);
    this.collect();
    if (++this.ticksSinceSnap >= SNAPSHOT_EVERY_TICKS) this.sendSnapshot();
  }

  /** Housekeeping: reconnect grace expiry + pings. Call every frame. */
  maintain(): void {
    const now = this.now();
    if (this.graceUntil !== null && now > this.graceUntil && this.state.winner === null) {
      this.graceUntil = null;
      forfeit(this.state, 0, 'Your opponent disconnected and did not return.');
      this.collect();
    }
    if (this.t && now - this.lastHeard > HEARTBEAT_TIMEOUT_MS) {
      // Silent peer (closed tab, dead network): treat as a disconnect so the grace timer starts.
      const t = this.t;
      t.close();
      this.onClose(t);
    }
    if (this.t && now - this.lastPing > 2000) {
      this.lastPing = now;
      this.t.send({ t: 'ping', ts: now });
    }
  }

  localCommand(cmd: Command): CmdResult {
    if (this.paused) return { ok: false, reason: 'paused' };
    const r = applyCommand(this.state, 0, cmd);
    this.collect();
    return r;
  }

  private guestCommand(seq: number, cmd: Command): void {
    if (!Number.isInteger(seq) || seq <= this.lastSeq) return;
    this.lastSeq = seq;
    try {
      applyCommand(this.state, 1, cmd);
    } catch {
      /* malformed command: ignore */
    }
    this.collect();
  }

  private collect(): void {
    const ev = drainEvents(this.state);
    this.localEvents.push(...ev);
    if (this.t) this.outEvents.push(...ev);
    if (this.state.winner !== null) {
      this.sendSnapshot();
      this.t?.send({ t: 'end', winner: this.state.winner, reason: this.state.winReason ?? '' });
    }
  }

  private sendSnapshot(): void {
    this.ticksSinceSnap = 0;
    if (!this.t) return;
    this.t.send({ t: 'snap', ack: this.lastSeq, state: this.state, events: this.outEvents });
    this.outEvents = [];
  }

  /** Leaving on purpose: tell the guest so it does not wait for the reconnect grace period. */
  leave(): void {
    if (this.state.winner === null) this.t?.send({ t: 'bye' });
    const t = this.t;
    this.t = null;
    t?.close();
  }
}
