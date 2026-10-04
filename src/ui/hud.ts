import { AGES, LAST_AGE } from '../data/ages';
import { LANE_LENGTH, MAX_TURRET_SLOTS, QUEUE_MAX, TICK_RATE } from '../data/config';
import { SPECIALS } from '../data/specials';
import { TURRETS } from '../data/turrets';
import { UNITS } from '../data/units';
import { artUrl, turretIcon, unitIcon } from '../game/art';
import { sfx } from '../game/audio';
import type { GameController } from '../game/controller';
import { saveSettings, settings } from '../game/settings';
import { nextSlotCost } from '../sim/commands';
import type { Command } from '../sim/types';

export interface HudHost {
  getView(): { scroll: number; width: number; min: number; max: number };
  setScroll(x: number): void;
  fps(): number;
}
export interface HudActions {
  onQuit(): void;
  onRematch?: () => void;
}

const KEY_LABEL = { units: ['1', '2', '3', '4'], turrets: ['Q', 'W', 'E'] };

const $ = <T extends HTMLElement>(root: ParentNode, sel: string): T => root.querySelector(sel) as T;
const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(Math.floor(n)));

export class Hud {
  private layer: HTMLElement;
  private tip: HTMLElement;
  private cache = new Map<string, string>();
  private age = -1;
  private ageShown = -1;
  private slotsShown = -1;
  private onKey: (e: KeyboardEvent) => void;
  private onResize: () => void;
  private toastT = 0;
  private debugOn = false;
  private resultShown = false;
  private mmDrag = false;
  private frames = 0;

  constructor(private root: HTMLElement, private ctl: GameController, private host: HudHost, private actions: HudActions) {
    root.innerHTML = `
    <div class="hud-layer">
      <div class="top">
        <div class="res">
          <div class="gold" data-tip="Gold: earned from kills. Spend it on units, turrets and slots."><span class="coin"></span><b data-r="gold">0</b></div>
          <div class="xpwrap" data-tip="Experience: earned from kills and damage. Spent when you evolve."><div class="xpbar"><i data-r="xpfill"></i><span data-r="xptext"></span></div></div>
        </div>
        <div class="hps">
          <div class="hpbar me"><i data-r="hpme"></i><span data-r="hpmetext"></span></div>
          <div class="vs"><b data-r="agename"></b><small data-r="modename"></small></div>
          <div class="hpbar them"><i data-r="hpthem"></i><span data-r="hpthemtext"></span></div>
        </div>
        <div class="tools">
          <span class="ping" data-r="ping"></span>
          <button data-r="btn-pause" data-tip="Pause (P / Esc)">II</button>
          <button data-r="btn-mute" data-tip="Mute / unmute (M)">♪</button>
          <button data-r="btn-quit" data-tip="Leave game">✕</button>
        </div>
      </div>
      <canvas class="minimap" width="700" height="26" data-tip="Minimap: click or drag to move the camera"></canvas>
      <div class="toast" data-r="toast"></div>
      <div class="banner" data-r="banner"></div>
      <div class="bottom">
        <div class="panel units"><h4>Train</h4><div class="ubtns" data-r="ubtns"></div><div class="queue" data-r="queue"></div></div>
        <div class="panel turrets"><h4>Turrets</h4><div class="tbtns" data-r="tbtns"></div><div class="slots" data-r="slots"></div></div>
        <div class="panel actions">
          <button class="special" data-r="special"><i class="ring"></i><img data-r="specialicon" alt=""><span class="key">S</span><em data-r="specialcd"></em></button>
          <button class="evolve" data-r="evolve"><b>Evolve</b><small data-r="evolvesub"></small><span class="key">V</span></button>
        </div>
      </div>
      <div class="fps" data-r="fps"></div>
      <div class="debug hidden" data-r="debug">
        <b>DEBUG (F3)</b>
        <pre data-r="debugtext"></pre>
        <button data-r="dbg-gold">+1000 gold</button><button data-r="dbg-xp">+1000 XP</button><button data-r="dbg-big">+50k gold &amp; XP</button>
      </div>
      <div class="overlay hidden" data-r="pause"><div class="card"><h2 data-r="pausetitle">Paused</h2><p data-r="pausetext"></p><div class="row"><button data-r="resume" class="primary">Resume</button><button data-r="quit" class="danger">Leave game</button></div></div></div>
      <div class="overlay hidden" data-r="result"><div class="card result"><h1 data-r="restitle"></h1><p data-r="resreason"></p><div data-r="resstats"></div><div class="row"><button data-r="rematch" class="primary">Play again</button><button data-r="menu">Main menu</button></div></div></div>
    </div>
    <div class="tooltip hidden"></div>`;
    this.layer = $(root, '.hud-layer');
    this.tip = $(root, '.tooltip');
    root.classList.remove('hidden');

    this.buildAge();
    this.bindStatic();
    this.onKey = (e) => this.keydown(e);
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);
    this.fit();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.root.innerHTML = '';
    this.root.classList.add('hidden');
  }

  private r<T extends HTMLElement>(name: string): T {
    return $(this.layer, `[data-r="${name}"]`);
  }
  private set(name: string, value: string): void {
    if (this.cache.get(name) === value) return;
    this.cache.set(name, value);
    this.r(name).textContent = value;
  }
  private css(name: string, prop: string, value: string): void {
    const k = `${name}.${prop}`;
    if (this.cache.get(k) === value) return;
    this.cache.set(k, value);
    this.r(name).style.setProperty(prop, value);
  }
  private cls(name: string, c: string, on: boolean): void {
    const k = `${name}#${c}`;
    const v = on ? '1' : '0';
    if (this.cache.get(k) === v) return;
    this.cache.set(k, v);
    this.r(name).classList.toggle(c, on);
  }

  private fit(): void {
    const k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    this.layer.style.transform = `translate(-50%, -50%) scale(${k})`;
  }

  // ------------------------------------------------------------------ building blocks
  private tipFor(el: HTMLElement, html: () => string): void {
    el.addEventListener('mouseenter', () => this.showTip(el, html()));
    el.addEventListener('mousemove', () => this.showTip(el, html()));
    el.addEventListener('mouseleave', () => this.tip.classList.add('hidden'));
  }
  private showTip(el: HTMLElement, html: string): void {
    this.tip.innerHTML = html;
    this.tip.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    const t = this.tip.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2));
    const y = r.top - t.height - 10 < 8 ? r.bottom + 10 : r.top - t.height - 10;
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
  }

  private bindStatic(): void {
    this.layer.querySelectorAll<HTMLElement>('[data-tip]').forEach((el) => {
      const text = el.dataset.tip!;
      this.tipFor(el, () => `<p>${text}</p>`);
    });
    this.r('btn-pause').onclick = () => this.togglePause();
    this.r('btn-mute').onclick = () => this.toggleMute();
    this.r('btn-quit').onclick = () => this.openLeave();
    this.r('resume').onclick = () => this.closePause();
    this.r('quit').onclick = () => this.actions.onQuit();
    this.r('menu').onclick = () => this.actions.onQuit();
    const rematch = this.r('rematch');
    if (this.actions.onRematch) rematch.onclick = () => this.actions.onRematch!();
    else rematch.classList.add('hidden');
    this.r('special').onclick = () => this.cmd({ type: 'USE_SPECIAL' });
    this.r('evolve').onclick = () => this.cmd({ type: 'EVOLVE' });
    this.r('dbg-gold').onclick = () => this.ctl.debugGrant(1000, 0);
    this.r('dbg-xp').onclick = () => this.ctl.debugGrant(0, 1000);
    this.r('dbg-big').onclick = () => this.ctl.debugGrant(50000, 50000);
    if (!this.ctl.canCheat) ['dbg-gold', 'dbg-xp', 'dbg-big'].forEach((n) => ((this.r(n) as HTMLButtonElement).disabled = true));
    if (!this.ctl.canPause) this.r('btn-pause').classList.add('hidden');
    this.set('modename', this.ctl.label);

    // minimap
    const mm = this.layer.querySelector<HTMLCanvasElement>('.minimap')!;
    const move = (e: PointerEvent) => {
      const rect = mm.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      this.host.setScroll(f * LANE_LENGTH - this.host.getView().width / 2);
    };
    mm.addEventListener('pointerdown', (e) => ((this.mmDrag = true), mm.setPointerCapture(e.pointerId), move(e)));
    mm.addEventListener('pointermove', (e) => this.mmDrag && move(e));
    mm.addEventListener('pointerup', () => (this.mmDrag = false));
    this.tipFor(this.r('special'), () => {
      const s = SPECIALS[AGES[this.me().age].special];
      return `<h5>${s.name} <kbd>S</kbd></h5><p>${s.desc}</p><p class="dim">Damages enemy units only. ${s.strikes} impacts × ${s.damage} dmg. Cooldown ${s.cooldown}s.</p>`;
    });
    this.tipFor(this.r('evolve'), () => {
      const p = this.me();
      if (p.age >= LAST_AGE) return '<p>You have reached the final age.</p>';
      const next = AGES[p.age + 1];
      return `<h5>Evolve to ${next.name} <kbd>V</kbd></h5><p>Costs ${AGES[p.age].evolveXp} XP. Unlocks new units, turrets, a new special and a stronger base.</p><p class="dim">Units already on the field stay.</p>`;
    });
  }

  private me() {
    return this.ctl.state.players[this.ctl.me];
  }

  /** (Re)builds the unit/turret buttons for the current age. */
  private buildAge(): void {
    const p = this.me();
    this.ageShown = p.age;
    const age = AGES[p.age];
    const ub = this.r('ubtns');
    ub.innerHTML = '';
    age.units.forEach((id, i) => {
      const d = UNITS[id];
      const b = document.createElement('button');
      b.className = 'ubtn' + (d.role === 'super' ? ' super' : '');
      b.dataset.unit = id;
      b.innerHTML = `<img src="${unitIcon(id)}" alt=""><span class="key">${KEY_LABEL.units[i]}</span><span class="cost">${fmt(d.cost)}</span>`;
      b.onclick = () => this.cmd({ type: 'TRAIN_UNIT', unit: id });
      this.tipFor(b, () => {
        const dps = (d.damage / d.attackInterval).toFixed(1);
        return `<h5>${d.name} <kbd>${KEY_LABEL.units[i]}</kbd></h5><p>${d.desc}</p>
          <table><tr><td>Cost</td><td>${d.cost} gold</td></tr><tr><td>Health</td><td>${d.hp}</td></tr><tr><td>Damage</td><td>${d.damage} (${dps}/s)${d.proj?.splash ? ' area' : ''}</td></tr>
          <tr><td>Range</td><td>${d.range}</td></tr><tr><td>Speed</td><td>${d.speed}</td></tr><tr><td>Train time</td><td>${d.trainTime}s</td></tr><tr><td>Bounty</td><td>${d.gold} gold, ${d.xp} xp</td></tr></table>`;
      });
      ub.appendChild(b);
    });
    const tb = this.r('tbtns');
    tb.innerHTML = '';
    age.turrets.forEach((id, i) => {
      const d = TURRETS[id];
      const b = document.createElement('button');
      b.className = 'tbtn';
      b.dataset.turret = id;
      b.innerHTML = `<img src="${turretIcon(id)}" alt=""><span class="key">${KEY_LABEL.turrets[i]}</span><span class="cost">${fmt(d.cost)}</span>`;
      b.onclick = () => this.buyTurret(id);
      this.tipFor(b, () => {
        const dps = (d.damage / d.fireInterval).toFixed(1);
        return `<h5>${d.name} <kbd>${KEY_LABEL.turrets[i]}</kbd></h5><p>${d.desc}</p>
          <table><tr><td>Cost</td><td>${d.cost} gold</td></tr><tr><td>Damage</td><td>${d.damage} (${dps}/s)${d.proj.splash ? ' area' : ''}</td></tr><tr><td>Range</td><td>${d.range}</td></tr><tr><td>Fire rate</td><td>${(1 / d.fireInterval).toFixed(2)}/s</td></tr></table><p class="dim">Placed in the first free slot. Sells for 50%.</p>`;
      });
      tb.appendChild(b);
    });
    const q = this.r('queue');
    q.innerHTML = '';
    for (let i = 0; i < QUEUE_MAX; i++) q.insertAdjacentHTML('beforeend', `<div class="qcell"><img alt=""><i></i></div>`);
    this.slotsShown = -1; // force slot rebuild
    this.cache.clear();
    this.set('modename', this.ctl.label);
  }

  private buildSlots(): void {
    const p = this.me();
    this.slotsShown = p.slotCount;
    const box = this.r('slots');
    box.innerHTML = '';
    for (let i = 0; i < MAX_TURRET_SLOTS; i++) {
      const c = document.createElement('button');
      c.className = 'slot';
      c.dataset.slot = String(i);
      c.innerHTML = '<img alt=""><span class="lbl"></span>';
      if (i < p.slotCount) {
        c.onclick = () => this.cmd({ type: 'SELL_TURRET', slot: i });
        this.tipFor(c, () => {
          const t = this.me().turrets[i];
          return t ? `<h5>${TURRETS[t.def].name}</h5><p>Click to sell for ${Math.floor(t.paid * 0.5)} gold <kbd>Shift+${i + 1}</kbd></p>` : '<p>Empty slot. Buy a turret with Q / W / E.</p>';
        });
      } else {
        c.onclick = () => this.cmd({ type: 'BUY_TURRET_SLOT' });
        this.tipFor(c, () => {
          const cost = nextSlotCost(this.me().slotCount);
          return i === this.me().slotCount ? `<h5>Buy turret slot <kbd>R</kbd></h5><p>${cost} gold</p>` : '<p>Locked. Buy slots in order.</p>';
        });
      }
      box.appendChild(c);
    }
  }

  // ------------------------------------------------------------------ input
  private cmd(c: Command): void {
    if (this.ctl.status.kind !== 'ok' || this.ctl.result()) return;
    const res = this.ctl.send(c);
    if (res.ok) sfx.play('click');
    else {
      sfx.play('error');
      this.toast(this.explain(res.reason ?? ''));
    }
  }
  private explain(r: string): string {
    const m: Record<string, string> = {
      'not enough gold': 'Not enough gold!', 'queue full': 'Training queue is full', 'not enough xp': 'Not enough XP to evolve yet', 'special on cooldown': 'Special is still recharging',
      'slot occupied': 'That slot is occupied', 'invalid slot': 'No free slot', 'max slots': 'All turret slots owned', 'only one at a time': 'Only one Colossus at a time', paused: 'Game is paused',
    };
    return m[r] ?? r;
  }
  private toast(msg: string): void {
    const el = this.r('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => el.classList.remove('show'), 1400);
  }

  private buyTurret(id: string): void {
    const p = this.me();
    const slot = p.turrets.findIndex((t, i) => i < p.slotCount && !t);
    if (slot < 0) {
      sfx.play('error');
      this.toast(p.slotCount < MAX_TURRET_SLOTS ? 'No free slot — buy another slot (R) or sell a turret' : 'No free slot — sell a turret first');
      return;
    }
    this.cmd({ type: 'BUY_TURRET', slot, turret: id });
  }

  private keydown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.code === 'F3') {
      e.preventDefault();
      this.debugOn = !this.debugOn;
      this.r('debug').classList.toggle('hidden', !this.debugOn);
      return;
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const age = AGES[this.me().age];
    const digit = /^(Digit|Numpad)([1-4])$/.exec(e.code);
    if (digit) {
      const i = Number(digit[2]) - 1;
      if (e.shiftKey) this.cmd({ type: 'SELL_TURRET', slot: i });
      else if (age.units[i]) this.cmd({ type: 'TRAIN_UNIT', unit: age.units[i] });
      return;
    }
    switch (e.code) {
      case 'KeyQ': case 'KeyW': case 'KeyE': {
        const id = age.turrets['QWE'.indexOf(e.code[3])];
        if (id) this.buyTurret(id);
        break;
      }
      case 'KeyR': this.cmd({ type: 'BUY_TURRET_SLOT' }); break;
      case 'KeyS': this.cmd({ type: 'USE_SPECIAL' }); break;
      case 'KeyV': this.cmd({ type: 'EVOLVE' }); break;
      case 'KeyM': this.toggleMute(); break;
      case 'KeyP': case 'Escape': this.togglePause(); break;
    }
  }

  private togglePause(): void {
    if (this.ctl.result()) return;
    if (this.ctl.canPause) {
      this.ctl.paused = !this.ctl.paused;
      this.r('pausetitle').textContent = 'Paused';
      this.r('pausetext').textContent = '';
      this.r('resume').textContent = 'Resume';
      this.r('pause').classList.toggle('hidden', !this.ctl.paused);
    } else this.openLeave();
  }
  private openLeave(): void {
    if (this.ctl.result()) return this.actions.onQuit();
    const o = this.r('pause');
    if (!o.classList.contains('hidden') && !this.ctl.paused) return this.closePause();
    this.r('pausetitle').textContent = this.ctl.canPause ? 'Paused' : 'Menu';
    this.r('pausetext').textContent = this.ctl.online ? 'The match keeps running while this menu is open. Leaving forfeits the game.' : 'Leave the game? Progress is lost.';
    this.r('resume').textContent = 'Back to game';
    if (this.ctl.canPause) this.ctl.paused = true;
    o.classList.remove('hidden');
  }
  private closePause(): void {
    this.ctl.paused = false;
    this.r('pause').classList.add('hidden');
  }
  private toggleMute(): void {
    settings.muted = !settings.muted;
    saveSettings();
  }

  showResult(won: boolean, reason?: string): void {
    this.resultShown = true;
    this.r('pause').classList.add('hidden');
    const p = this.ctl.state.players;
    const me = this.ctl.me;
    const t = Math.floor(this.ctl.state.tick / TICK_RATE);
    const row = (label: string, a: number, b: number) => `<tr><td>${label}</td><td>${fmt(a)}</td><td>${fmt(b)}</td></tr>`;
    this.r('restitle').textContent = won ? 'VICTORY' : 'DEFEAT';
    this.r('restitle').className = won ? 'win' : 'lose';
    this.r('resreason').textContent = reason ?? (won ? 'The enemy base has fallen.' : 'Your base has fallen.');
    const a = p[me].stats;
    const b = p[1 - me].stats;
    this.r('resstats').innerHTML = `<table><tr><th></th><th>You</th><th>${this.ctl.online ? 'Opponent' : 'Enemy'}</th></tr>
      ${row('Units trained', a.trained, b.trained)}${row('Kills', a.kills, b.kills)}${row('Gold earned', a.goldEarned, b.goldEarned)}${row('Damage dealt', a.damage, b.damage)}
      <tr><td>Time</td><td colspan="2">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</td></tr></table>`;
    this.r('result').classList.remove('hidden');
  }

  // ------------------------------------------------------------------ per-frame
  update(_time: number): void {
    const s = this.ctl.state;
    const p = this.me();
    const o = s.players[1 - this.ctl.me];
    if (p.age !== this.ageShown) this.buildAge();
    if (p.slotCount !== this.slotsShown) this.buildSlots();
    const age = AGES[p.age];

    this.set('gold', fmt(p.gold));
    const need = age.evolveXp;
    if (p.age < LAST_AGE) {
      this.css('xpfill', 'width', `${Math.min(100, (p.xp / need) * 100)}%`);
      this.set('xptext', `XP ${Math.floor(p.xp)} / ${need}`);
    } else {
      this.css('xpfill', 'width', '100%');
      this.set('xptext', `XP ${Math.floor(p.xp)} — final age`);
    }
    this.css('hpme', 'width', `${Math.max(0, (p.baseHp / p.baseMaxHp) * 100)}%`);
    this.css('hpthem', 'width', `${Math.max(0, (o.baseHp / o.baseMaxHp) * 100)}%`);
    this.set('hpmetext', `${Math.max(0, Math.ceil(p.baseHp))}`);
    this.set('hpthemtext', `${Math.max(0, Math.ceil(o.baseHp))}`);
    this.set('agename', `${age.name}  vs  ${AGES[o.age].name}`);
    this.set('btn-mute', settings.muted ? '✕♪' : '♪');

    // unit buttons
    const alive = (id: string) => s.units.some((u) => u.owner === this.ctl.me && u.def === id && u.hp > 0) || p.queue.some((q) => q.unit === id);
    this.layer.querySelectorAll<HTMLElement>('.ubtn').forEach((b) => {
      const d = UNITS[b.dataset.unit!];
      const dis = p.gold < d.cost || p.queue.length >= QUEUE_MAX || (d.role === 'super' && alive(d.id));
      b.classList.toggle('disabled', dis);
    });
    const freeSlot = p.turrets.some((t, i) => i < p.slotCount && !t);
    this.layer.querySelectorAll<HTMLElement>('.tbtn').forEach((b) => b.classList.toggle('disabled', p.gold < TURRETS[b.dataset.turret!].cost || !freeSlot));
    // queue
    const cells = this.layer.querySelectorAll<HTMLElement>('.qcell');
    cells.forEach((c, i) => {
      const it = p.queue[i];
      const img = c.querySelector('img')!;
      const src = it ? unitIcon(it.unit) : '';
      if (img.getAttribute('src') !== src) {
        if (src) img.setAttribute('src', src);
        else img.removeAttribute('src');
      }
      c.classList.toggle('full', !!it);
      c.querySelector('i')!.style.width = it ? `${i === 0 ? (1 - it.remaining / it.total) * 100 : 0}%` : '0%';
    });
    // slots
    this.layer.querySelectorAll<HTMLElement>('.slot').forEach((c, i) => {
      const t = i < p.slotCount ? p.turrets[i] : null;
      const img = c.querySelector('img')!;
      const src = t ? turretIcon(t.def) : i < p.slotCount ? '' : artUrl('icon:slot');
      if (img.getAttribute('src') !== src) {
        if (src) img.setAttribute('src', src);
        else img.removeAttribute('src');
      }
      c.classList.toggle('empty', i < p.slotCount && !t);
      c.classList.toggle('locked', i >= p.slotCount);
      const lbl = c.querySelector('.lbl')!;
      const text = i >= p.slotCount ? (i === p.slotCount ? fmt(nextSlotCost(p.slotCount) ?? 0) : '') : t ? '' : 'free';
      if (lbl.textContent !== text) lbl.textContent = text;
      c.classList.toggle('afford', i === p.slotCount && p.gold >= (nextSlotCost(p.slotCount) ?? Infinity));
    });
    // special
    const sp = SPECIALS[age.special];
    const total = sp.cooldown * TICK_RATE;
    const ready = p.specialCd <= 0;
    this.css('special', '--p', `${(1 - p.specialCd / total) * 360}deg`);
    this.cls('special', 'ready', ready);
    this.set('specialcd', ready ? '' : String(Math.ceil(p.specialCd / TICK_RATE)));
    const icon = artUrl(`icon:${sp.id}`);
    if (this.cache.get('spicon') !== icon) {
      this.cache.set('spicon', icon);
      this.r<HTMLImageElement>('specialicon').src = icon;
    }
    // evolve
    const canEvolve = p.age < LAST_AGE && p.xp >= need;
    this.cls('evolve', 'ready', canEvolve);
    this.cls('evolve', 'hidden', p.age >= LAST_AGE);
    if (p.age < LAST_AGE) this.set('evolvesub', canEvolve ? `to ${AGES[p.age + 1].name}` : `${need} XP`);

    this.drawMinimap();
    this.status();
    this.fpsAndDebug();
  }

  private status(): void {
    const st = this.ctl.status;
    const b = this.r('banner');
    if (st.kind === 'ok') {
      this.cls('banner', 'show', false);
      return;
    }
    const txt = st.message + (st.secondsLeft !== undefined ? ` (${Math.ceil(st.secondsLeft)}s)` : '');
    this.set('banner', txt);
    b.classList.add('show');
    this.cache.set('banner#show', '1');
  }

  private fpsAndDebug(): void {
    this.frames++;
    const fpsEl = this.r('fps');
    const showFps = settings.showFps;
    fpsEl.classList.toggle('hidden', !showFps);
    if (this.frames % 20 === 0) {
      if (showFps) fpsEl.textContent = `${Math.round(this.host.fps())} fps`;
      this.r('ping').textContent = this.ctl.online ? `${Math.round(this.ctl.ping)} ms` : '';
      if (this.debugOn) {
        const s = this.ctl.state;
        this.r('debugtext').textContent = `tick      ${s.tick}\nunits     ${s.units.length}\nprojectl. ${s.projectiles.length}\nspecials  ${s.specials.length}\nentities  ${s.units.length + s.projectiles.length + s.specials.length}\nfps       ${Math.round(this.host.fps())}\nlatency   ${this.ctl.online ? Math.round(this.ctl.ping) + ' ms' : 'n/a (local)'}\nmode      ${this.ctl.label}\nside      ${this.ctl.me}${this.ctl.mirror ? ' (mirrored)' : ''}\ncheats    ${this.ctl.canCheat ? 'enabled' : 'disabled online'}`;
      }
    }
  }

  private drawMinimap(): void {
    const c = this.layer.querySelector<HTMLCanvasElement>('.minimap')!;
    const g = c.getContext('2d')!;
    const W = c.width;
    const H = c.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8,10,20,0.7)';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#2d3b2a';
    g.fillRect(0, H - 6, W, 6);
    const mx = (x: number) => ((this.ctl.mirror ? LANE_LENGTH - x : x) / LANE_LENGTH) * W;
    const s = this.ctl.state;
    for (const side of [0, 1] as const) {
      g.fillStyle = side === this.ctl.me ? '#4fd1ff' : '#ff5a5a';
      const x = mx(side === 0 ? 70 : LANE_LENGTH - 70);
      g.fillRect(x - 8, 2, 16, H - 4);
    }
    for (const u of s.units) {
      g.fillStyle = u.owner === this.ctl.me ? '#9ae6ff' : '#ff9a9a';
      const big = UNITS[u.def].role === 'heavy' || UNITS[u.def].role === 'super';
      g.fillRect(mx(u.x) - 1, H - 12 - (big ? 3 : 0), big ? 4 : 3, big ? 8 : 5);
    }
    const v = this.host.getView();
    const x0 = ((v.scroll) / LANE_LENGTH) * W;
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.strokeRect(x0, 1, (v.width / LANE_LENGTH) * W, H - 2);
  }
}
