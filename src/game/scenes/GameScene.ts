import Phaser from 'phaser';
import { AGES } from '../../data/ages';
import { LANE_LENGTH, SLOT_HEIGHTS, TICK_RATE } from '../../data/config';
import { SPECIALS } from '../../data/specials';
import { UNITS } from '../../data/units';
import { baseFront } from '../../sim/state';
import { UNIT_TY } from '../../sim/step';
import type { Projectile, SimEvent, Unit } from '../../sim/types';
import { BASE_H, BASE_SCALE, BASE_W, MINE_W } from '../art/bases';
import { sfx, type Sfx } from '../audio';
import type { GameController } from '../controller';
import { Hud, type HudHost } from '../../ui/hud';

export interface GameSceneData {
  controller: GameController;
  onExit: () => void;
  onRematch?: () => void;
}

const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
export const GROUND_Y = 560;
const FOOT_Y = GROUND_Y + 6;
const SCALE = 2;
const MINE = 0x4fd1ff;
const THEIRS = 0xff5a5a;
const SPLASHY = new Set(['shell', 'rocket', 'plasma', 'ball', 'grenade']);
const ARCED = new Set(['rock', 'ball', 'shell', 'spear', 'arrow', 'tar', 'oil', 'grenade', 'gas', 'stasis']);
const TRAIL: Record<string, number> = { rocket: 0xdddddd, plasma: 0xb47bff, gas: 0x8ae86a, stasis: 0x9a7bff };
const IMPACT: Record<string, number> = { plasma: 0xb47bff, gas: 0x8ae86a, stasis: 0xb48cff, tar: 0x6a5a8a, oil: 0xffb02e, chain: 0xcfd6e0, ion: 0xffe066 };
const SLOWED = 0x9fc8ff;
const SPECIAL_INDEX: Record<string, number> = { meteors: 0, volley: 1, barrage: 2, airstrike: 3, laser: 4 };

interface UnitView {
  sprite: Phaser.GameObjects.Image;
  def: string;
  owner: number;
  x: number;
  phase: number;
  atkStart: number;
  lastAtk: number; // newest of attack / heal tick (drives the 'atk' animation)
  key: string;
  flash: number;
  hp: number;
  maxHp: number;
  dispH: number;
  y: number;
}

export class GameScene extends Phaser.Scene implements HudHost {
  private ctl!: GameController;
  private hud!: Hud;
  private data0!: GameSceneData;
  private me = 0;
  private mirror = false;

  private units = new Map<number, UnitView>();
  private projs = new Map<number, { img: Phaser.GameObjects.Image; kind: string; x: number; y: number; owner: number; splash: number }>();
  private baseImgs: Phaser.GameObjects.Image[] = [];
  private mineImgs: Phaser.GameObjects.Image[] = [];
  private mineLv = [0, 0];
  private turretImgs: Phaser.GameObjects.Image[][] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private sky!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private bgAge = -1;
  private baseAges = [-1, -1];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private drag?: { x: number; scroll: number; moved: boolean };
  private mouse = { x: -1, y: -1, inside: false };
  private floaters = 0;
  private finished = false;
  private smokeT = 0;
  private cleanup: (() => void)[] = [];

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.data0 = data;
    this.ctl = data.controller;
    this.me = this.ctl.me;
    this.mirror = this.ctl.mirror;
    this.units = new Map();
    this.projs = new Map();
    this.baseImgs = [];
    this.mineImgs = [];
    this.mineLv = [0, 0];
    this.turretImgs = [];
    this.bgAge = -1;
    this.baseAges = [-1, -1];
    this.finished = false;
    this.cleanup = [];
  }

  // ------------------------------------------------------------------ coordinates
  private wx(x: number): number {
    return this.mirror ? LANE_LENGTH - x : x;
  }
  /** 0 = drawn on the left of the screen, 1 = right. */
  private vside(side: number): number {
    return this.mirror ? 1 - side : side;
  }

  /** Screen x of the centre of a side's gold mine (just outside the base's back edge). */
  private mineX(side: 0 | 1): number {
    const fx = this.wx(baseFront(side));
    const off = BASE_W * BASE_SCALE + 2 + (MINE_W * SCALE) / 2;
    return this.vside(side) === 0 ? fx - off : fx + off;
  }

  // ------------------------------------------------------------------ HudHost
  getView() {
    const c = this.cameras.main;
    return { scroll: c.scrollX, width: this.scale.width, min: -260, max: LANE_LENGTH + 260 - this.scale.width };
  }
  setScroll(x: number): void {
    const max = LANE_LENGTH + 260 - this.scale.width;
    this.cameras.main.scrollX = max < -260 ? (max - 260) / 2 : Phaser.Math.Clamp(x, -260, max);
  }
  fps(): number {
    return this.game.loop.actualFps;
  }

  // ------------------------------------------------------------------ create
  create(): void {
    const cam = this.cameras.main;
    cam.setBounds(-260, -3000, LANE_LENGTH + 520, 6000);
    cam.scrollX = -90; // my base is always on the left of the screen (the view is mirrored for the guest)
    cam.setBackgroundColor('#000000');

    this.sky = this.add.tileSprite(0, 0, this.scale.width / SCALE, this.scale.height / SCALE, 'bg:0:sky').setOrigin(0).setScale(SCALE).setScrollFactor(0).setDepth(-100);
    this.far = this.add.tileSprite(0, -30, this.scale.width / SCALE, this.scale.height / SCALE, 'bg:0:far').setOrigin(0).setScale(SCALE).setScrollFactor(0).setDepth(-90);
    this.mid = this.add.tileSprite(0, -110, this.scale.width / SCALE, this.scale.height / SCALE, 'bg:0:mid').setOrigin(0).setScale(SCALE).setScrollFactor(0).setDepth(-80);
    this.ground = this.add.tileSprite(-400, GROUND_Y, (LANE_LENGTH + 800) / SCALE, 240, 'ground:0').setOrigin(0).setScale(SCALE).setDepth(-50);

    // bases + turret slots
    for (const side of [0, 1]) {
      const v = this.vside(side);
      const fx = this.wx(baseFront(side as 0 | 1));
      const half = (BASE_W * BASE_SCALE) / 2;
      const base = this.add
        .image(v === 0 ? fx - half : fx + half, FOOT_Y + 2, 'base:0')
        .setOrigin(0.5, 1)
        .setScale(BASE_SCALE)
        .setFlipX(v === 1)
        .setDepth(FOOT_Y - 30);
      this.baseImgs.push(base);
      // gold mine: behind the base, out on the lane's outer edge
      const mine = this.add
        .image(this.mineX(side as 0 | 1), FOOT_Y + 2, 'mine:1')
        .setOrigin(0.5, 1)
        .setScale(SCALE)
        .setFlipX(v === 1)
        .setDepth(FOOT_Y - 34)
        .setVisible(false);
      this.mineImgs.push(mine);
      const row: Phaser.GameObjects.Image[] = [];
      for (let slot = 0; slot < SLOT_HEIGHTS.length; slot++) {
        const t = this.add
          .image(v === 0 ? fx - 30 : fx + 30, FOOT_Y + 2 - SLOT_HEIGHTS[slot], 'turret:slingpost:0')
          .setOrigin(0.5, 1)
          .setScale(SCALE)
          .setFlipX(v === 1)
          .setDepth(FOOT_Y - 20)
          .setVisible(false);
        row.push(t);
      }
      this.turretImgs.push(row);
    }
    this.bars = this.add.graphics().setDepth(9000);

    this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,A,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.drag = { x: p.x, scroll: this.cameras.main.scrollX, moved: false }));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      if (Math.abs(p.x - this.drag.x) > 4) this.drag.moved = true;
      if (this.drag.moved) this.setScroll(this.drag.scroll - (p.x - this.drag.x));
    });
    this.input.on('pointerup', () => (this.drag = undefined));

    const onMove = (e: MouseEvent) => {
      const r = this.game.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * this.scale.width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * this.scale.height;
      this.mouse.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    window.addEventListener('mousemove', onMove);
    this.cleanup.push(() => window.removeEventListener('mousemove', onMove));

    this.hud = new Hud(document.getElementById('hud-root')!, this.ctl, this, {
      onQuit: () => this.data0.onExit(),
      onRematch: this.data0.onRematch,
    });
    this.cleanup.push(() => this.hud.destroy());
    this.scale.on('resize', this.layout, this);
    this.cleanup.push(() => this.scale.off('resize', this.layout, this));
    this.layout();
    this.time.delayedCall(250, () => this.layout()); // once the HUD has measured itself
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup.forEach((f) => f());
      this.ctl.destroy();
      this.units.clear();
      this.projs.clear();
    });
    this.applyAge(this.ctl.state.players[this.me].age);
  }

  /**
   * Fits the world to the current screen: stretches the background layers and shifts the view vertically so the
   * ground (and the units walking on it) always sits just above the bottom HUD panel, whatever the aspect ratio.
   */
  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const k = this.scale.displaySize.width / w || 1; // screen px per world px
    const inset = this.hud ? this.hud.bottomInset() / k : 150;
    const shift = Phaser.Math.Clamp(GROUND_Y + 30 + inset - h, -400, 300);
    this.cameras.main.scrollY = shift;
    this.sky.setSize(w / SCALE, h / SCALE);
    this.far.setSize(w / SCALE, h / SCALE).setY(-30 - shift);
    this.mid.setSize(w / SCALE, h / SCALE).setY(-110 - shift);
    this.setScroll(this.cameras.main.scrollX);
  }

  private applyAge(age: number): void {
    if (age === this.bgAge) return;
    this.bgAge = age;
    this.sky.setTexture(`bg:${age}:sky`);
    this.far.setTexture(`bg:${age}:far`);
    this.mid.setTexture(`bg:${age}:mid`);
    this.ground.setTexture(`ground:${age}`);
  }

  // ------------------------------------------------------------------ frame
  update(time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.ctl.update(delta);
    const s = this.ctl.state;

    this.handleCamera(dt);
    this.applyAge(s.players[this.me].age);

    const events = this.ctl.drainEvents();
    for (const e of events) this.handleEvent(e);

    this.syncBases(time);
    this.syncUnits(time, dt);
    this.syncProjectiles(dt);
    this.drawBars();

    const cam = this.cameras.main.scrollX;
    this.sky.tilePositionX = (cam * 0.03) / SCALE;
    this.far.tilePositionX = (cam * 0.14) / SCALE;
    this.mid.tilePositionX = (cam * 0.4) / SCALE;

    const res = this.ctl.result();
    if (res && !this.finished) {
      this.finished = true;
      const won = res.winner === this.me;
      sfx.play(won ? 'win' : 'lose');
      this.hud.showResult(res.winner === this.me, res.reason);
    }
    this.hud.update(time);
  }

  private handleCamera(dt: number): void {
    let v = 0;
    if (this.keys.LEFT.isDown || this.keys.A.isDown) v -= 1;
    if (this.keys.RIGHT.isDown || this.keys.D.isDown) v += 1;
    const edge = 22;
    if (!COARSE && this.mouse.inside && !this.drag?.moved && this.mouse.y < this.scale.height - 160) {
      if (this.mouse.x < edge) v -= 1;
      else if (this.mouse.x > this.scale.width - edge) v += 1;
    }
    if (v) this.setScroll(this.cameras.main.scrollX + v * 900 * dt);
  }

  // ------------------------------------------------------------------ sync
  private syncBases(time: number): void {
    const s = this.ctl.state;
    for (const side of [0, 1] as const) {
      const p = s.players[side];
      if (this.baseAges[side] !== p.age) {
        this.baseAges[side] = p.age;
        this.baseImgs[side].setTexture(`base:${p.age}`);
      }
      if (this.mineLv[side] !== p.econ) {
        this.mineLv[side] = p.econ;
        const mi = this.mineImgs[side];
        mi.setVisible(p.econ > 0);
        if (p.econ > 0) mi.setTexture(`mine:${Math.min(4, p.econ)}`);
      }
      const ratio = p.baseHp / p.baseMaxHp;
      const dmg = ratio < 0.4 ? 0.55 + ratio : 1;
      const g = Math.round(255 * Math.min(1, dmg));
      this.baseImgs[side].setTint(Phaser.Display.Color.GetColor(255, g, g));
      for (let slot = 0; slot < SLOT_HEIGHTS.length; slot++) {
        const img = this.turretImgs[side][slot];
        const t = slot < p.slotCount ? p.turrets[slot] : null;
        if (!t) {
          img.setVisible(false);
          continue;
        }
        const firing = s.tick - t.lastAtk < Math.max(2, TICK_RATE * 0.12);
        const key = `turret:${t.def}:${firing ? 1 : 0}`;
        if (img.texture.key !== key) img.setTexture(key);
        img.setVisible(true);
      }
      if (ratio < 0.5 && time - this.smokeT > 220) {
        this.smokeT = time;
        const v = this.vside(side);
        const x = (v === 0 ? this.wx(baseFront(side)) - 90 : this.wx(baseFront(side)) + 90) + Phaser.Math.Between(-30, 30);
        this.puff(x, FOOT_Y - 150, 0x555560, 1.4);
      }
    }
  }

  private syncUnits(time: number, dt: number): void {
    const s = this.ctl.state;
    const seen = new Set<number>();
    const k = 1 - Math.exp(-dt * 20);
    for (const u of s.units) {
      seen.add(u.id);
      let v = this.units.get(u.id);
      if (!v) v = this.createUnitView(u);
      const tx = this.wx(u.x);
      v.x = Math.abs(tx - v.x) > 250 ? tx : v.x + (tx - v.x) * k;
      const act = Math.max(u.lastAtk, u.lastHeal ?? -999);
      if (act !== v.lastAtk) {
        v.lastAtk = act;
        v.atkStart = time;
      }
      let anim: string;
      let frame: number;
      if (time - v.atkStart < 330) {
        anim = 'atk';
        frame = Math.min(2, Math.floor((time - v.atkStart) / 110));
      } else if (u.mode === 'walk') {
        anim = 'walk';
        frame = Math.floor(time / 120 + v.phase) % 4;
      } else {
        anim = 'walk';
        frame = 0;
      }
      const key = `unit:${u.def}:${anim}:${frame}`;
      if (key !== v.key) {
        v.key = key;
        v.sprite.setTexture(key);
      }
      v.hp = u.hp;
      const dirScreen = (u.owner === 0 ? 1 : -1) * (this.mirror ? -1 : 1);
      v.sprite.setPosition(v.x, v.y).setFlipX(dirScreen < 0).setDepth(v.y);
      if (time < v.flash) v.sprite.setTintFill(0xffffff);
      else if (u.slow && u.slow > 0) v.sprite.setTint(SLOWED);
      else v.sprite.clearTint();
    }
    for (const [id, v] of this.units) {
      if (seen.has(id)) continue;
      this.units.delete(id);
      this.playDeath(v);
    }
  }

  private createUnitView(u: Unit): UnitView {
    const def = UNITS[u.def];
    const key = `unit:${u.def}:walk:0`;
    const x = this.wx(u.x);
    const y = FOOT_Y + (u.id % 3) * 6;
    const sprite = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(SCALE).setDepth(y);
    const v: UnitView = {
      sprite, def: u.def, owner: u.owner, x, phase: u.id % 4, atkStart: -1e9, lastAtk: Math.max(u.lastAtk, u.lastHeal ?? -999), key, flash: 0, hp: u.hp, maxHp: Math.max(def.hp, u.hp),
      dispH: sprite.height * SCALE, y,
    };
    this.units.set(u.id, v);
    return v;
  }

  private playDeath(v: UnitView): void {
    const s = v.sprite;
    s.clearTint();
    s.setTexture(`unit:${v.def}:dead:0`);
    this.time.delayedCall(140, () => s.active && s.setTexture(`unit:${v.def}:dead:1`));
    this.tweens.add({ targets: s, alpha: 0, delay: 650, duration: 450, onComplete: () => s.destroy() });
    this.puff(v.x, v.y - 8, 0xb8a48a, 1);
  }

  private syncProjectiles(dt: number): void {
    const seen = new Set<number>();
    for (const p of this.ctl.state.projectiles) {
      seen.add(p.id);
      let v = this.projs.get(p.id);
      if (!v) {
        const img = this.add.image(0, 0, `proj:${p.kind}`).setScale(SCALE).setDepth(8000);
        v = { img, kind: p.kind, x: 0, y: 0, owner: p.owner, splash: p.splash };
        this.projs.set(p.id, v);
      }
      const pos = this.projPos(p);
      v.x = pos.x;
      v.y = pos.y;
      v.img.setPosition(pos.x, pos.y).setRotation(pos.angle);
      if (TRAIL[p.kind] !== undefined && Math.random() < 0.5) this.puff(pos.x, pos.y, TRAIL[p.kind], 0.5);
    }
    for (const [id, v] of this.projs) {
      if (seen.has(id)) continue;
      this.projs.delete(id);
      v.img.destroy();
      if (SPLASHY.has(v.kind) || v.splash > 0) this.explode(v.x, v.y, Math.max(30, v.splash * 0.8), IMPACT[v.kind] ?? 0xffa14a, false);
      else this.sparks(v.x, v.y, IMPACT[v.kind] ?? 0xffe08a, v.kind === 'tar' || v.kind === 'oil' ? 6 : 3);
    }
  }

  private projPos(p: Projectile): { x: number; y: number; angle: number } {
    const prog = Phaser.Math.Clamp(Math.abs(p.x - p.sx) / p.dist0, 0, 1);
    const arc = ARCED.has(p.kind) ? Math.min(70, p.dist0 * 0.2) : 0;
    const h = Phaser.Math.Linear(p.sy, UNIT_TY, prog) + arc * 4 * prog * (1 - prog);
    const sdir = (p.tx >= p.sx ? 1 : -1) * (this.mirror ? -1 : 1);
    const dys = -((UNIT_TY - p.sy) + arc * 4 * (1 - 2 * prog));
    return { x: this.wx(p.x), y: FOOT_Y - h, angle: Math.atan2(dys, sdir * p.dist0) };
  }

  private drawBars(): void {
    const g = this.bars;
    g.clear();
    for (const v of this.units.values()) {
      const w = Math.max(22, UNITS[v.def].width * 0.8);
      const y = v.y - v.dispH - 8;
      g.fillStyle(0x000000, 0.65).fillRect(v.x - w / 2 - 1, y - 1, w + 2, 5);
      g.fillStyle(v.owner === this.me ? MINE : THEIRS, 1).fillRect(v.x - w / 2, y, Math.max(0, (v.hp / v.maxHp) * w), 3);
    }
  }

  // ------------------------------------------------------------------ events
  private handleEvent(e: SimEvent): void {
    const mine = (o: number) => o === this.me;
    switch (e.k) {
      case 'hit': {
        const v = this.units.get(e.id);
        if (v) v.flash = this.time.now + 70;
        this.sparks(this.wx(e.x), FOOT_Y - 18, 0xffffff, 2);
        if (e.crit) this.sparks(this.wx(e.x), FOOT_Y - 24, 0xffd84a, 6);
        if (this.floaters < 8 || e.crit) this.floatText(this.wx(e.x), FOOT_Y - (v ? v.dispH : 40) - 14, e.crit ? `${e.dmg}!` : String(e.dmg), e.crit ? '#ffd84a' : mine(e.owner) ? '#ff8a8a' : '#ffffff', e.crit ? 20 : 14);
        sfx.play('hit');
        break;
      }
      case 'melee':
        sfx.play('melee');
        break;
      case 'heal': {
        const v = this.units.get(e.id);
        const x = v ? v.x : this.wx(e.x);
        if (e.amount >= 1 && this.floaters < 8) this.floatText(x, FOOT_Y - (v ? v.dispH : 40) - 14, `+${Math.round(e.amount)}`, '#7dff9a', 14);
        this.rise(x, v ? v.y - v.dispH * 0.5 : FOOT_Y - 24, 0x7dff9a, 4);
        break;
      }
      case 'slowed':
        this.slowFx(this.wx(e.x), e.radius);
        break;
      case 'econ': {
        const x = this.mineX(e.owner);
        this.coinBurst(x, FOOT_Y - 40, 8);
        this.floatText(x, FOOT_Y - 90, `GOLD MINE ${e.level}`, '#ffd84a', 16, 1400);
        if (mine(e.owner)) sfx.play('build');
        break;
      }
      case 'shot':
        sfx.play(this.shotSfx(e.kind));
        break;
      case 'death':
        sfx.play('death');
        break;
      case 'gold':
        if (mine(e.owner)) {
          this.floatText(this.wx(e.x), FOOT_Y - 70, `+${e.amount}`, '#ffd84a', 20);
          if (e.xp > 0) this.floatText(this.wx(e.x), FOOT_Y - 48, `+${e.xp} xp`, '#7ee0ff', 13);
          sfx.play('coin');
        }
        break;
      case 'base_hit':
        sfx.play('base_hit');
        if (mine(e.owner)) this.cameras.main.shake(120, 0.0025);
        this.sparks(this.wx(baseFront(e.owner)) + (this.vside(e.owner) === 0 ? -40 : 40), FOOT_Y - 60, 0xffc27a, 4);
        break;
      case 'build':
        if (mine(e.owner)) sfx.play('build');
        break;
      case 'sell':
        if (mine(e.owner)) sfx.play('sell');
        break;
      case 'spawn':
        if (mine(e.owner)) sfx.play('spawn');
        this.puff(this.wx(e.x), FOOT_Y - 4, 0xc8b898, 0.8);
        break;
      case 'evolve': {
        sfx.play('evolve');
        const x = this.wx(baseFront(e.owner)) + (this.vside(e.owner) === 0 ? -80 : 80);
        this.explode(x, FOOT_Y - 100, 90, 0xffe066, false);
        for (let i = 0; i < 14; i++) this.starBurst(x, FOOT_Y - 100);
        this.floatText(x, FOOT_Y - 220, AGES[e.age].name.toUpperCase(), '#ffe066', 28, 2000);
        if (mine(e.owner)) this.cameras.main.flash(350, 255, 255, 200);
        break;
      }
      case 'special':
        this.specialStart(e.owner, e.def);
        break;
      case 'strike':
        this.strikeFx(e.def, e.x, e.delay, e.radius);
        break;
      case 'laststand': {
        const x = this.wx(baseFront(e.owner)) + (this.vside(e.owner) === 0 ? -80 : 80);
        this.explode(x, FOOT_Y - 100, 80, 0xff5a5a, true);
        this.floatText(x, FOOT_Y - 230, 'LAST STAND!', '#ff7a7a', 28, 2000);
        if (mine(e.owner)) this.cameras.main.flash(300, 255, 80, 80);
        break;
      }
      case 'win':
        break;
    }
  }

  private shotSfx(kind: string): Sfx {
    switch (kind) {
      case 'rock': case 'spear': return 'shoot_rock';
      case 'tar': case 'oil': case 'grenade': return 'shoot_rock';
      case 'arrow': case 'bolt': return 'shoot_bolt';
      case 'bullet': return 'shoot_gun';
      case 'laser': case 'plasma': case 'stasis': case 'ion': return 'shoot_laser';
      default: return 'shoot_cannon';
    }
  }

  private specialStart(owner: number, def: string): void {
    const name = SPECIALS[def].name.toUpperCase();
    sfx.play(`special_${SPECIAL_INDEX[def]}` as Sfx);
    this.cameras.main.shake(500, 0.004);
    const cx = this.cameras.main.scrollX + this.scale.width / 2;
    this.floatText(cx, 150, name + '!', owner === this.me ? '#7ee0ff' : '#ff7a7a', 36, 1800, true);
    if (def === 'airstrike') {
      const fromLeft = this.vside(owner) === 0;
      const y = 110;
      const x0 = this.cameras.main.scrollX + (fromLeft ? -80 : this.scale.width + 80);
      const x1 = this.cameras.main.scrollX + (fromLeft ? this.scale.width + 80 : -80);
      const plane = this.add.image(x0, y, 'fx:plane').setScale(3).setFlipX(!fromLeft).setDepth(9500);
      this.tweens.add({ targets: plane, x: x1, duration: 3200, onComplete: () => plane.destroy() });
    }
  }

  private strikeFx(def: string, simX: number, delay: number, radius: number): void {
    const x = this.wx(simX);
    const ms = delay * 1000;
    const gy = FOOT_Y - 8;
    const land = (color: number, size = radius) => this.explode(x, gy, size, color, true);
    switch (def) {
      case 'meteors': {
        const img = this.add.image(x + 280, -90, 'proj:meteor').setScale(3).setDepth(9400);
        img.setRotation(Math.atan2(gy + 90, -280));
        this.tweens.add({ targets: img, x, y: gy, duration: ms, ease: 'Quad.easeIn', onComplete: () => (img.destroy(), land(0xff8a3a)) });
        break;
      }
      case 'volley': {
        const img = this.add.image(x + 90, -30, 'proj:arrow').setScale(2.2).setDepth(9400);
        img.setRotation(Math.atan2(gy + 30, -90));
        this.tweens.add({ targets: img, x, y: gy, duration: ms * 0.8, ease: 'Linear', onComplete: () => (img.destroy(), this.sparks(x, gy, 0xdddddd, 4)) });
        break;
      }
      case 'barrage': {
        const img = this.add.image(x + 30, -60, 'proj:shell').setScale(2.5).setDepth(9400).setRotation(Math.PI / 2 + 0.2);
        this.tweens.add({ targets: img, x, y: gy, duration: ms, ease: 'Quad.easeIn', onComplete: () => (img.destroy(), land(0xffb04a)) });
        break;
      }
      case 'airstrike': {
        const img = this.add.image(x, 100, 'proj:bomb').setScale(2.5).setDepth(9400).setRotation(Math.PI / 2 * 0);
        this.tweens.add({ targets: img, y: gy, duration: ms, ease: 'Quad.easeIn', onComplete: () => (img.destroy(), land(0xff7a3a)) });
        break;
      }
      case 'laser': {
        const warn = this.add.rectangle(x, gy / 2, 3, gy, 0xff4fb8, 0.5).setDepth(9400);
        this.tweens.add({ targets: warn, alpha: 0.9, duration: ms * 0.9, onComplete: () => warn.destroy() });
        this.time.delayedCall(ms, () => {
          const beam = this.add.rectangle(x, gy / 2, radius * 1.4, gy, 0x7ae8ff, 0.9).setDepth(9400).setBlendMode(Phaser.BlendModes.ADD);
          const core = this.add.rectangle(x, gy / 2, radius * 0.5, gy, 0xffffff, 1).setDepth(9401).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: [beam, core], alpha: 0, scaleX: 0.2, duration: 380, onComplete: () => (beam.destroy(), core.destroy()) });
          land(0x7ae8ff, radius * 0.8);
        });
        break;
      }
    }
  }

  // ------------------------------------------------------------------ small fx
  private floatText(x: number, y: number, text: string, color: string, size: number, dur = 900, fixed = false): void {
    this.floaters++;
    const t = this.add
      .text(x, y, text, { fontFamily: 'monospace', fontStyle: 'bold', fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(9800);
    this.tweens.add({
      targets: t, y: y - (fixed ? 20 : 38), alpha: 0, duration: dur, ease: 'Cubic.easeOut',
      onComplete: () => (t.destroy(), this.floaters--),
    });
  }

  private sparks(x: number, y: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'fx:spark').setTint(color).setDepth(9300).setScale(Phaser.Math.FloatBetween(0.5, 1));
      this.tweens.add({
        targets: s, x: x + Phaser.Math.Between(-24, 24), y: y + Phaser.Math.Between(-26, 6), alpha: 0, duration: Phaser.Math.Between(180, 340),
        onComplete: () => s.destroy(),
      });
    }
  }

  private starBurst(x: number, y: number): void {
    const s = this.add.image(x, y, 'fx:star').setScale(2).setDepth(9300);
    this.tweens.add({ targets: s, x: x + Phaser.Math.Between(-140, 140), y: y + Phaser.Math.Between(-140, 80), alpha: 0, duration: 900, onComplete: () => s.destroy() });
  }

  /** Little pixels drifting upwards (heal sparkles). */
  private rise(x: number, y: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-6, 8), 'fx:spark').setTint(color).setDepth(9300).setScale(Phaser.Math.FloatBetween(0.5, 0.9));
      this.tweens.add({ targets: s, y: s.y - Phaser.Math.Between(22, 38), alpha: 0, duration: Phaser.Math.Between(450, 700), onComplete: () => s.destroy() });
    }
  }

  /** Flattened violet ground ring + frosty puff where enemies got slowed. */
  private slowFx(x: number, radius: number): void {
    const ring = this.add.image(x, FOOT_Y - 4, 'fx:ring').setTint(0x9a7bff).setAlpha(0.8).setScale(0.3, 0.1).setDepth(9100);
    this.tweens.add({ targets: ring, scaleX: radius / 22, scaleY: (radius / 22) * 0.3, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    this.puff(x, FOOT_Y - 6, SLOWED, Math.max(0.6, radius / 60));
    this.sparks(x, FOOT_Y - 10, 0x7ae8ff, 4);
  }

  private coinBurst(x: number, y: number, n: number): void {
    this.sparks(x, y, 0xffd84a, 6);
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x, y, 'fx:coin').setScale(2).setDepth(9300);
      this.tweens.add({
        targets: c, x: x + Phaser.Math.Between(-50, 50), y: y - Phaser.Math.Between(40, 90), alpha: 0, duration: Phaser.Math.Between(500, 800), ease: 'Cubic.easeOut',
        onComplete: () => c.destroy(),
      });
    }
  }

  private puff(x: number, y: number, color: number, scale: number): void {
    const s = this.add.image(x, y, 'fx:smoke').setTint(color).setAlpha(0.7).setScale(scale).setDepth(9200);
    this.tweens.add({ targets: s, y: y - 24 * scale, scale: scale * 2, alpha: 0, duration: 600, onComplete: () => s.destroy() });
  }

  private explode(x: number, y: number, radius: number, color: number, shake: boolean): void {
    const flash = this.add.image(x, y - 6, 'fx:flash').setTint(color).setScale(radius / 14).setDepth(9500).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, alpha: 0, scale: radius / 8, duration: 260, onComplete: () => flash.destroy() });
    const ring = this.add.image(x, y - 6, 'fx:ring').setTint(color).setScale(0.3).setDepth(9500);
    this.tweens.add({ targets: ring, scale: radius / 18, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    this.sparks(x, y - 8, color, 8);
    this.puff(x, y - 8, 0x666670, radius / 36);
    if (shake) this.cameras.main.shake(90, 0.0018);
    sfx.play('boom');
  }
}

