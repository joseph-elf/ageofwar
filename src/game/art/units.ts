import { Pix } from './pixel';

export type Anim = 'walk' | 'atk' | 'dead';
export const FRAMES: Record<Anim, number> = { walk: 4, atk: 3, dead: 2 };

type Weapon = 'club' | 'sling' | 'pike' | 'crossbow' | 'sabre' | 'musket' | 'shotgun' | 'rifle' | 'blade' | 'laser' | 'lance' | 'pistol' | 'staff' | 'bomb' | 'medkit' | 'ioncannon' | 'none';
type Head = 'bush' | 'band' | 'kettle' | 'hood' | 'tricorn' | 'bicorne' | 'helmet' | 'visor' | 'beret' | 'great' | 'feathers' | 'mitre' | 'medhelm';

interface Human {
  skin: string;
  torso: string;
  trim: string;
  legs: string;
  boots: string;
  head: Head;
  hc: string;
  weapon: Weapon;
  w1: string;
  w2: string;
  cape?: string;
  glow?: string;
  armor?: boolean;
  bulk?: boolean; // heavy pauldrons (disruptor)
  cross?: boolean; // red-cross armband (medic)
}

const OUT = '#1a1420';
const SWING = [-2, 0, 2, 0];

/** Direction the weapon arm points for this animation frame. */
function pose(weapon: Weapon, anim: Anim, f: number): [number, number] {
  const ranged = ['sling', 'crossbow', 'musket', 'shotgun', 'rifle', 'laser', 'pistol', 'ioncannon'].includes(weapon);
  if (weapon === 'staff') return anim === 'atk' ? ([[1, -0.5], [1, -0.8], [1, -0.5]][f] as [number, number]) : [1, -0.2];
  if (weapon === 'bomb') return anim === 'atk' ? ([[-0.7, -1], [1, -0.3], [0.8, 0.4]][f] as [number, number]) : [0.9, 0.2];
  if (weapon === 'medkit') return anim === 'atk' ? ([[0.6, -0.6], [0.4, -1], [0.6, -0.6]][f] as [number, number]) : [0.9, 0.5];
  if (anim === 'atk') {
    if (ranged) return [[1, -0.05], [1, -0.1], [1, 0.05]][f] as [number, number];
    if (weapon === 'sling') return [[-0.2, -1], [1, 0], [0.8, 0.6]][f] as [number, number];
    if (weapon === 'pike' || weapon === 'lance') return [[0.4, 0.1], [1, 0], [1, 0.1]][f] as [number, number];
    return [[-0.5, -1], [1, 0.5], [0.8, 1]][f] as [number, number];
  }
  if (ranged) return [1, 0.1];
  if (weapon === 'pike' || weapon === 'lance') return [1, -0.35];
  return [0.9, 0.7];
}

function weapon(p: Pix, h: Human, hx: number, hy: number, d: [number, number], anim: Anim, f: number, big = 1): void {
  const [dx, dy] = d;
  const m = Math.hypot(dx, dy);
  const ex = (n: number) => hx + (dx / m) * n;
  const ey = (n: number) => hy + (dy / m) * n;
  const fire = anim === 'atk' && f === 1;
  switch (h.weapon) {
    case 'club':
      p.line(hx, hy, dx, dy, 6, h.w1, 1);
      p.r(ex(6) - 1, ey(6) - 1, 3, 3, h.w2);
      break;
    case 'pike':
    case 'lance': {
      const len = (h.weapon === 'lance' ? 20 : 15) * big;
      p.line(hx - dx * 3, hy - dy * 3, dx, dy, len, h.w1, 1);
      p.line(hx - dx * 3 + (dx / m) * len, hy - dy * 3 + (dy / m) * len, dx, dy, 3, h.w2, 1);
      break;
    }
    case 'sabre':
      p.line(hx, hy, dx, dy, 2, '#7a5a2a');
      p.line(ex(2), ey(2) - 0.5, dx, dy, 8, h.w1);
      p.p(ex(10), ey(10) + 1, h.w1);
      break;
    case 'blade':
      p.line(hx, hy, dx, dy, 3, '#33384a');
      p.line(ex(3), ey(3), dx, dy, 10, h.w1, 2);
      p.line(ex(3), ey(3), dx, dy, 10, '#ffffff');
      break;
    case 'sling':
      p.line(hx, hy, dx, dy, 3, h.w1);
      if (anim === 'atk' && f === 0) p.disc(ex(3) - 1, ey(3) - 3, 2, h.w2);
      else p.p(ex(3), ey(3) + 1, h.w2);
      if (fire) p.p(ex(8), ey(8), h.w2);
      break;
    case 'crossbow':
      p.line(hx, hy, dx, dy, 6, h.w1, 1);
      p.r(ex(6), ey(6) - 3, 1, 7, h.w2);
      p.p(ex(6) - 1, ey(6) - 3, h.w2);
      p.p(ex(6) - 1, ey(6) + 3, h.w2);
      p.p(ex(5), ey(5), '#ddd');
      break;
    case 'musket':
      p.line(hx - 2, hy, dx, dy, 4, h.w1, 1);
      p.line(hx + 2, hy, dx, dy, 8, h.w2, 1);
      if (fire) p.r(ex(11), ey(11) - 1, 3, 3, '#ffd24a');
      break;
    case 'shotgun':
      p.line(hx - 1, hy, dx, dy, 3, h.w1, 2);
      p.line(hx + 2, hy, dx, dy, 6, h.w2, 1);
      if (fire) p.r(ex(8), ey(8) - 1, 3, 3, '#ffd24a');
      break;
    case 'rifle':
      p.line(hx - 2, hy, dx, dy, 4, h.w1, 2);
      p.line(hx + 2, hy, dx, dy, 9, h.w2, 1);
      p.p(ex(2), ey(2) - 2, '#79c');
      if (fire) p.r(ex(12), ey(12) - 1, 3, 2, '#ffe9a0');
      break;
    case 'laser':
      p.line(hx - 1, hy, dx, dy, 4, '#3a4256', 2);
      p.line(hx + 3, hy, dx, dy, 7, '#cfd6e6', 1);
      p.p(ex(10), ey(10), h.glow ?? '#5ff');
      if (fire) p.r(ex(11), ey(11) - 1, 4, 3, '#aef');
      break;
    case 'pistol':
      p.line(hx, hy, dx, dy, 4, '#444', 1);
      if (fire) p.r(ex(5), ey(5) - 1, 3, 3, '#ffd24a');
      break;
    case 'staff': {
      // upright totem pole: the orb flares while casting
      const oy = Math.max(2, Math.round(hy) - 6);
      const cast = anim === 'atk';
      p.r(hx, oy + 1, 1, 20 - oy, h.w1);
      p.p(hx - 1, oy + 3, h.w2);
      p.p(hx + 1, oy + 5, h.w2);
      p.disc(hx, oy, cast ? 2 : 1, cast ? '#7dff9a' : '#3fd16a');
      p.p(hx, oy, cast ? '#e6ffec' : '#b8ffcc');
      if (cast && f === 1) {
        p.p(hx - 3, oy - 1, '#7dff9a');
        p.p(hx + 3, oy + 1, '#7dff9a');
      }
      break;
    }
    case 'bomb': {
      // round black bomb with a lit fuse; gone once thrown (atk f1/f2)
      if (anim === 'atk' && f > 0) break;
      const bx = ex(2);
      const by = ey(2) - 1;
      p.disc(bx, by, 2, '#1c1c22');
      p.p(bx - 1, by - 1, '#666');
      p.p(bx + 1, by - 3, '#a88a5a');
      p.p(bx + 2, by - 4, '#ffb04a');
      if (anim !== 'atk' || f === 0) p.p(bx + 2, by - 5, '#ffe9a0');
      break;
    }
    case 'medkit': {
      const x0 = Math.round(ex(2)) - 2;
      const y0 = Math.round(ey(2)) - 2;
      p.r(x0 + 2, y0 - 1, 2, 1, '#888');
      p.r(x0, y0, 6, 5, '#f2f2f2');
      p.r(x0, y0 + 4, 6, 1, '#b8bcc4');
      p.r(x0 + 2, y0 + 1, 2, 3, '#d33');
      p.r(x0 + 1, y0 + 2, 4, 1, '#d33');
      if (anim === 'atk') {
        const sx = x0 + 7;
        const sy = y0 + 1;
        const sp = '#7dff9a';
        if (f === 1) {
          p.p(sx, sy - 1, sp);
          p.p(sx - 1, sy, sp);
          p.p(sx, sy, '#e6ffec');
          p.p(sx + 1, sy, sp);
          p.p(sx, sy + 1, sp);
        } else p.p(sx, sy, sp);
      }
      break;
    }
    case 'ioncannon': {
      // long chunky shoulder cannon with amber coils; the muzzle blazes on the fire frame
      const gl = h.glow ?? '#ffcf3a';
      p.line(hx - 4, hy - 4, dx, dy, 7, '#3a3f4c', 4);
      p.line(hx - 4, hy - 4, dx, dy, 7, '#6b7385', 1);
      p.line(hx + 3, hy - 3, dx, dy, 7, '#555c6e', 2);
      p.line(hx + 3, hy - 3, dx, dy, 7, '#8a92a6', 1);
      for (const i of [1, 4]) p.r(ex(3 + i), ey(3 + i) - 4, 1, 4, gl);
      p.p(hx - 2, hy - 2, gl);
      if (fire) {
        p.r(ex(10), ey(10) - 4, 3, 4, gl);
        p.r(ex(11), ey(11) - 3, 3, 2, '#fff');
        p.p(ex(13), ey(13) - 4, '#7ae8ff');
        p.p(ex(13), ey(13) - 1, '#7ae8ff');
      } else p.r(ex(10), ey(10) - 3, 1, 2, gl);
      break;
    }
    default:
  }
}

/** Draws a humanoid (20x22 canvas, feet at the bottom). `ox/oy` offset it (used for riders); `noLegs` for mounted figures. */
function human(p: Pix, h: Human, anim: Anim, f: number, ox = 0, oy = 0, noLegs = false, big = 1): void {
  const walking = anim === 'walk';
  const sb = walking ? SWING[f] : anim === 'atk' ? (f === 1 ? -2 : 1) : 0;
  const lift = walking ? (f === 1 ? 1 : f === 3 ? 1 : 0) : 0;
  const by = walking && f % 2 === 1 ? 1 : 0;
  const X = (x: number) => x + ox;
  const Y = (y: number) => y + oy;
  if (h.cape) p.r(X(4), Y(9 + by), 3, 9, h.cape);
  if (!noLegs) {
    p.r(X(7 + sb), Y(15), 2, 6 - (sb > 0 ? lift : 0), h.legs);
    p.r(X(7 + sb), Y(21 - (sb > 0 ? lift : 0)), 3, 1, h.boots);
    p.r(X(10 - sb), Y(15), 2, 6 - (sb < 0 ? lift : 0), shadeLeg(h.legs));
    p.r(X(10 - sb), Y(21 - (sb < 0 ? lift : 0)), 3, 1, h.boots);
  }
  // torso
  p.r(X(6), Y(8 + by), 7, 7, h.torso);
  if (h.bulk) {
    p.r(X(5), Y(7 + by), 3, 4, h.trim);
    p.r(X(11), Y(7 + by), 3, 3, h.trim);
    p.r(X(7 + sb), Y(17), 2, 1, h.trim);
    p.r(X(10 - sb), Y(17), 2, 1, h.trim);
  }
  p.r(X(6), Y(13 + by), 7, 1, h.trim);
  if (h.armor) {
    p.r(X(7), Y(9 + by), 5, 3, h.trim);
    p.r(X(6), Y(8 + by), 7, 1, h.trim);
  }
  // head
  p.r(X(7), Y(3 + by), 5, 5, h.skin);
  p.p(X(10), Y(5 + by), OUT);
  headgear(p, h, X(0), Y(by));
  // weapon arm
  const d = pose(h.weapon, anim, f);
  const sx = X(11);
  const sy = Y(9 + by);
  p.line(sx, sy, d[0], d[1], 3, h.skin, 2);
  const m = Math.hypot(d[0], d[1]);
  weapon(p, h, sx + (d[0] / m) * 3, sy + (d[1] / m) * 3, d, anim, f, big);
  // off-hand arm
  p.r(X(6), Y(9 + by), 2, 4, shadeLeg(h.torso));
  if (h.cross) {
    p.r(X(6), Y(10 + by), 2, 3, '#fff');
    p.r(X(6), Y(11 + by), 2, 1, '#d33');
  }
}

function headgear(p: Pix, h: Human, x: number, y: number): void {
  const c = h.hc;
  switch (h.head) {
    case 'bush':
      p.r(x + 6, y + 2, 7, 3, c);
      p.r(x + 6, y + 4, 2, 4, c);
      break;
    case 'band':
      p.r(x + 6, y + 2, 7, 2, c);
      p.r(x + 6, y + 4, 2, 3, c);
      p.r(x + 7, y + 3, 5, 1, '#d8c26a');
      p.p(x + 6, y + 1, '#e04a3a');
      break;
    case 'kettle':
      p.r(x + 6, y + 1, 7, 3, c);
      p.r(x + 5, y + 4, 9, 1, c);
      p.p(x + 9, y + 2, '#fff');
      break;
    case 'hood':
      p.r(x + 6, y + 2, 7, 3, c);
      p.r(x + 5, y + 4, 3, 5, c);
      break;
    case 'tricorn':
      p.r(x + 5, y + 3, 9, 1, c);
      p.r(x + 6, y + 1, 7, 2, c);
      p.r(x + 6, y + 1, 7, 1, '#e8d9a0');
      break;
    case 'bicorne':
      p.r(x + 5, y + 1, 9, 3, c);
      p.r(x + 4, y + 3, 11, 1, c);
      p.r(x + 5, y + 1, 9, 1, '#e8d9a0');
      break;
    case 'helmet':
      p.r(x + 6, y + 1, 7, 4, c);
      p.r(x + 6, y + 4, 2, 4, c);
      p.p(x + 11, y + 2, '#9ab');
      break;
    case 'visor':
      p.r(x + 6, y + 1, 7, 6, c);
      p.r(x + 9, y + 4, 4, 2, h.glow ?? '#4ff');
      p.p(x + 8, y, c);
      break;
    case 'beret':
      p.r(x + 6, y + 2, 8, 2, c);
      p.r(x + 6, y + 3, 7, 1, c);
      break;
    case 'great':
      p.r(x + 6, y + 1, 7, 7, c);
      p.r(x + 9, y + 4, 4, 1, '#111');
      p.r(x + 8, y - 1, 1, 2, '#c33');
      break;
    case 'feathers':
      p.r(x + 6, y + 3, 7, 1, '#efe6c8');
      p.r(x + 6, y + 4, 2, 4, '#2a1d18');
      p.r(x + 6, y + 1, 1, 2, c);
      p.r(x + 8, y, 1, 3, '#d33');
      p.r(x + 10, y, 1, 3, c);
      p.r(x + 12, y + 1, 1, 2, '#e8c84a');
      break;
    case 'mitre':
      p.r(x + 7, y, 5, 3, c);
      p.r(x + 6, y + 3, 7, 1, c);
      p.r(x + 8, y + 1, 3, 1, '#e0b84a');
      p.r(x + 6, y + 3, 7, 1, '#e8d9a0');
      break;
    case 'medhelm':
      p.r(x + 6, y + 1, 7, 4, c);
      p.r(x + 6, y + 4, 2, 4, c);
      p.r(x + 9, y + 1, 3, 3, '#fff');
      p.p(x + 10, y + 1, '#d33');
      p.p(x + 9, y + 2, '#d33');
      p.p(x + 10, y + 2, '#d33');
      p.p(x + 11, y + 2, '#d33');
      p.p(x + 10, y + 3, '#d33');
      break;
  }
}

const shadeLeg = (c: string) => {
  // quick darkening for the far limb
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.78));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

// ---------------------------------------------------------------------------------------------------------------
interface UnitSprite {
  w: number;
  h: number;
  draw: (p: Pix, anim: Anim, f: number) => void;
  deathRot?: [number, number]; // degrees for the two death frames
}

const H = (h: Human): UnitSprite => ({ w: 20, h: 22, draw: (p, a, f) => human(p, h, a, f), deathRot: [35, 85] });

function mount(p: Pix, o: { coat: string; dark: string; bard?: string; trim?: string; tusk?: boolean; mane?: string; rider: Human; big?: number }, anim: Anim, f: number): void {
  const swing = anim === 'walk' ? SWING[f] : 0;
  const lunge = anim === 'atk' ? (f === 1 ? 2 : f === 0 ? -1 : 0) : 0;
  const bob = anim === 'walk' && f % 2 === 1 ? 1 : 0;
  const L = (x: number, ph: number, c: string) => {
    p.r(x + lunge + (ph > 0 ? swing : -swing), 21, 3, 6, c);
    p.r(x + lunge + (ph > 0 ? swing : -swing), 27, 4, 1, '#222');
  };
  L(9, -1, o.dark);
  L(23, 1, o.dark);
  // tail + body
  p.r(4 + lunge, 12 + bob, 3, 3, o.dark);
  p.r(6 + lunge, 12 + bob, 21, 9, o.coat);
  p.r(6 + lunge, 19 + bob, 21, 2, o.dark);
  if (o.bard) {
    p.r(8 + lunge, 12 + bob, 17, 6, o.bard);
    p.r(8 + lunge, 17 + bob, 17, 1, o.trim ?? '#fff');
  }
  // head
  p.r(26 + lunge, 10 + bob, 7, 7, o.coat);
  p.r(31 + lunge, 13 + bob, 5, 4, o.dark);
  p.p(30 + lunge, 12 + bob, '#111');
  p.r(27 + lunge, 8 + bob, 2, 2, o.dark);
  if (o.mane) p.r(23 + lunge, 9 + bob, 4, 4, o.mane);
  if (o.tusk) {
    p.r(35 + lunge, 15 + bob, 2, 1, '#f4eed2');
    p.r(36 + lunge, 14 + bob, 1, 1, '#f4eed2');
  }
  L(12, 1, o.coat);
  L(26, -1, o.coat);
  human(p, o.rider, anim, f, 12 + lunge, -4 + bob, true, o.big ?? 1);
}

function tank(p: Pix, anim: Anim, f: number, c: { hull: string; dark: string; glow?: string }): void {
  const kick = anim === 'atk' && f === 1 ? -2 : 0;
  p.r(2, 15, 36, 7, '#25262c');
  for (let i = 0; i < 9; i++) {
    const x = 3 + ((i * 4 + (anim === 'walk' ? f : 0)) % 36);
    p.r(x, 16, 2, 1, '#5b5d66');
  }
  for (const x of [6, 14, 22, 30]) p.disc(x, 19, 2, '#3a3c44');
  p.r(5, 9, 30, 7, c.hull);
  p.r(5, 14, 30, 2, c.dark);
  p.r(8, 5, 15, 5, c.hull);
  p.r(8, 9, 15, 1, c.dark);
  p.r(23 + kick, 6, 15, 2, c.dark);
  p.r(37 + kick, 5, 2, 4, c.dark);
  p.p(14, 7, '#cfe');
  p.r(28, 11, 4, 2, '#d8c24a');
  if (anim === 'atk' && f === 1) p.r(39 + kick, 5, 4, 4, '#ffd24a');
}

function ram(p: Pix, anim: Anim, f: number): void {
  const bob = anim === 'walk' && f % 2 === 1 ? 1 : 0;
  const k = anim === 'atk' ? [-4, 3, 0][f] : anim === 'walk' ? SWING[f] >> 1 : 0; // log travel: pull back, slam, return
  const Y = (y: number) => y - bob;
  for (const x of [9, 34]) {
    p.disc(x, 22, 3, '#2b1c10');
    p.disc(x, 22, 2, '#6a4a2a');
    p.p(x, 22, '#2b1c10');
    const odd = anim === 'walk' && f % 2 === 1;
    p.p(x - (odd ? 1 : 0), 21, '#2b1c10');
    p.p(x + (odd ? 1 : 0), 23, '#2b1c10');
  }
  p.r(5, Y(18), 34, 2, '#4a3320');
  p.r(9, Y(14), 2, 5, '#6a4a2a');
  p.r(33, Y(14), 2, 5, '#6a4a2a');
  // hide-covered slanted plank roof
  for (let y = 4; y <= 14; y++) {
    const hw = Math.round(5 + (y - 4) * 1.3);
    p.r(22 - hw, Y(y), hw * 2, 1, y % 3 === 0 ? '#5a4028' : y % 2 ? '#8a6a46' : '#7a5c3c');
    p.p(22 - hw, Y(y), OUT);
    p.p(22 + hw - 1, Y(y), OUT);
  }
  for (let i = 0; i < 9; i++) {
    const x = 12 + ((i * 7) % 21);
    const y = 6 + ((i * 3) % 8);
    if (Math.abs(x - 22) < 5 + (y - 4) * 1.3 - 1 && y % 3 !== 0) p.p(x, Y(y), '#c9b48a');
  }
  p.r(3, Y(15), 38, 1, '#3a2414');
  // swinging log with an iron cap
  p.r(8 + k, Y(16), 28, 4, '#7a5430');
  p.r(8 + k, Y(16), 28, 1, '#9a7444');
  p.r(14 + k, Y(16), 1, 4, '#6b727c');
  p.r(26 + k, Y(16), 1, 4, '#6b727c');
  p.r(36 + k, Y(15), 4, 6, '#9aa0aa');
  p.r(36 + k, Y(15), 4, 1, '#cfd6e0');
  p.r(36 + k, Y(20), 4, 1, '#6b727c');
  p.r(40 + k, Y(17), 1, 2, '#cfd6e0');
  if (anim === 'atk' && f === 1) {
    p.p(43, Y(14), '#ffe9a0');
    p.p(43, Y(21), '#ffe9a0');
  }
}

function mech(p: Pix, anim: Anim, f: number): void {
  const sw = anim === 'walk' ? SWING[f] : 0;
  const bob = anim === 'walk' && f % 2 === 1 ? 1 : 0;
  const leg = (x: number, s: number, c: string) => {
    p.r(x + s, 19 + bob, 4, 8, c);
    p.r(x + s * 2, 26, 7, 4, '#2c3140');
    p.r(x + s - 2, 27, 3, 1, '#9ff');
  };
  leg(8, -sw, '#586179');
  leg(17, sw, '#7a85a3');
  p.r(6, 6 + bob, 20, 14, '#8d98b8');
  p.r(6, 16 + bob, 20, 4, '#586179');
  p.r(18, 8 + bob, 7, 5, '#4ff');
  p.r(20, 9 + bob, 3, 2, '#fff');
  p.r(8, 3 + bob, 8, 4, '#586179');
  const k = anim === 'atk' && f === 1 ? -2 : 0;
  p.r(22 + k, 14 + bob, 9, 3, '#33394d');
  p.r(22 + k, 10 + bob, 7, 2, '#33394d');
  if (anim === 'atk' && f === 1) {
    p.r(31 + k, 13 + bob, 4, 5, '#d6a9ff');
    p.r(29 + k, 9 + bob, 3, 4, '#d6a9ff');
  }
}

function titan(p: Pix, anim: Anim, f: number): void {
  const sw = anim === 'walk' ? SWING[f] : 0;
  const bob = anim === 'walk' && f % 2 === 1 ? 1 : 0;
  p.r(10 - sw, 36, 9, 14, '#4a5068');
  p.r(8 - sw, 49, 13, 5, '#2b2f40');
  p.r(25 + sw, 36, 9, 14, '#6b7392');
  p.r(23 + sw, 49, 13, 5, '#2b2f40');
  p.r(8, 12 + bob, 28, 26, '#8892b3');
  p.r(8, 32 + bob, 28, 6, '#565e7a');
  p.r(16, 18 + bob, 12, 10, '#2a2f44');
  p.disc(22, 23 + bob, 4, '#ff7a3a');
  p.disc(22, 23 + bob, 2, '#ffe39a');
  p.r(2, 10 + bob, 10, 10, '#6b7392');
  p.r(32, 10 + bob, 10, 10, '#a7b0cf');
  p.r(16, 2 + bob, 12, 11, '#a7b0cf');
  p.r(19, 6 + bob, 9, 3, '#ff4a4a');
  p.p(18, 0 + bob, '#ff4a4a');
  const k = anim === 'atk' && f === 1 ? -3 : 0;
  p.r(34 + k, 20 + bob, 12, 6, '#333a52');
  p.r(34 + k, 21 + bob, 10, 1, '#ff9a4a');
  p.r(2, 20 + bob, 5, 12, '#586179');
  if (anim === 'atk' && f === 1) {
    p.disc(48 + k, 23 + bob, 3, '#ffb36b');
    p.disc(48 + k, 23 + bob, 1, '#fff');
  }
  if (anim === 'atk' && f === 0) p.r(30, 14 + bob, 14, 2, '#ff9a4a');
}

export const UNIT_SPRITES: Record<string, UnitSprite> = {
  // ---------------- Stone Age: furs, bone, leaf and hide
  bonebasher: H({ skin: '#d29a6a', torso: '#8a5a34', trim: '#5a3a20', legs: '#d29a6a', boots: '#6a4a2a', head: 'bush', hc: '#2a1d18', weapon: 'club', w1: '#7a5a3a', w2: '#efe6c8' }),
  pebbler: H({ skin: '#c98d5e', torso: '#a8743c', trim: '#6b4a2a', legs: '#c98d5e', boots: '#5a4126', head: 'band', hc: '#3a2a20', weapon: 'sling', w1: '#6a4a2a', w2: '#9a9a9a' }),
  tuskrider: {
    w: 40, h: 28, deathRot: [18, 45],
    draw: (p, a, f) => mount(p, { coat: '#5e4636', dark: '#3a2a22', tusk: true, mane: '#2a1d18', rider: { skin: '#d29a6a', torso: '#8a5a34', trim: '#5a3a20', legs: '#d29a6a', boots: '#6a4a2a', head: 'bush', hc: '#2a1d18', weapon: 'pike', w1: '#7a5a3a', w2: '#cfc6a8' } }, a, f),
  },
  shaman: H({ skin: '#b8794a', torso: '#9a6a3c', trim: '#5a3a20', legs: '#7a5230', boots: '#4a3220', head: 'feathers', hc: '#3fae6a', weapon: 'staff', w1: '#6a4a2a', w2: '#efe6c8' }),
  // ---------------- Medieval: mail, wool, steel
  pikeman: H({ skin: '#e2b48c', torso: '#8b95a3', trim: '#4a5260', legs: '#4a4f66', boots: '#3a2a22', head: 'kettle', hc: '#b8c0cc', weapon: 'pike', w1: '#8a6a3a', w2: '#dfe4ea', armor: true }),
  crossbower: H({ skin: '#e2b48c', torso: '#4f7a46', trim: '#33502d', legs: '#6a5a3a', boots: '#3a2a22', head: 'hood', hc: '#3a5f36', weapon: 'crossbow', w1: '#7a5a3a', w2: '#3a2a22' }),
  lancer: {
    w: 40, h: 28, deathRot: [18, 45],
    draw: (p, a, f) => mount(p, { coat: '#e9e6df', dark: '#9a968c', bard: '#b83a3a', trim: '#f0c84a', mane: '#9a968c', rider: { skin: '#e2b48c', torso: '#c9d0da', trim: '#8e97a6', legs: '#c9d0da', boots: '#444', head: 'great', hc: '#c9d0da', weapon: 'lance', w1: '#7a5a3a', w2: '#e8edf2', armor: true } }, a, f),
  },
  ram: { w: 44, h: 26, deathRot: [6, 12], draw: ram },
  // ---------------- Renaissance: coats, powder, brass
  sabreman: H({ skin: '#e8bf98', torso: '#2f4f9a', trim: '#e9e2cf', legs: '#efe9d8', boots: '#2a2018', head: 'tricorn', hc: '#1f2a4a', weapon: 'sabre', w1: '#e4e9f0', w2: '#c9a24a', cape: undefined }),
  flintlocker: H({ skin: '#e8bf98', torso: '#a8302c', trim: '#e9e2cf', legs: '#e9e2cf', boots: '#2a2018', head: 'bicorne', hc: '#2a2a33', weapon: 'musket', w1: '#6a4524', w2: '#59606b' }),
  cuirassier: {
    w: 40, h: 28, deathRot: [18, 45],
    draw: (p, a, f) => mount(p, { coat: '#6a4430', dark: '#3c261a', bard: '#2a3d7a', trim: '#e0b84a', mane: '#2a1c12', rider: { skin: '#e8bf98', torso: '#c9ced6', trim: '#e0b84a', legs: '#efe9d8', boots: '#2a2018', head: 'helmet', hc: '#c9ced6', weapon: 'pistol', w1: '#444', w2: '#444', cape: '#a8302c', armor: true } }, a, f),
  },
  grenadier: H({ skin: '#e8bf98', torso: '#a8302c', trim: '#2f4f9a', legs: '#efe9d8', boots: '#2a2018', head: 'mitre', hc: '#2f4f9a', weapon: 'bomb', w1: '#1c1c22', w2: '#ffb04a' }),
  // ---------------- Modern: fatigues, gunmetal
  breacher: H({ skin: '#d9a97f', torso: '#58663a', trim: '#2f3820', legs: '#4a5530', boots: '#1f1f1f', head: 'helmet', hc: '#3f4a2a', weapon: 'shotgun', w1: '#5a3a22', w2: '#2a2a2a', armor: true }),
  marksman: H({ skin: '#d9a97f', torso: '#7a7f55', trim: '#3a3f28', legs: '#6a6e48', boots: '#1f1f1f', head: 'beret', hc: '#7a2a2a', weapon: 'rifle', w1: '#2a2a2a', w2: '#444', armor: false }),
  medic: H({ skin: '#d9a97f', torso: '#6a7340', trim: '#3a4226', legs: '#5a6338', boots: '#1f1f1f', head: 'medhelm', hc: '#6a7340', weapon: 'medkit', w1: '#f2f2f2', w2: '#d33', cross: true }),
  crawler: { w: 44, h: 24, deathRot: [6, 12], draw: (p, a, f) => tank(p, a, f, { hull: '#5d6f45', dark: '#3a4a2c' }) },
  // ---------------- Future: alloys, neon
  plasmalancer: H({ skin: '#cdd6ee', torso: '#e9eefc', trim: '#38d6ff', legs: '#aab4d4', boots: '#38d6ff', head: 'visor', hc: '#e9eefc', weapon: 'blade', w1: '#7ae8ff', w2: '#fff', glow: '#7ae8ff', armor: true }),
  lasergunner: H({ skin: '#cdd6ee', torso: '#39405c', trim: '#ff4fb8', legs: '#2b3047', boots: '#ff4fb8', head: 'visor', hc: '#39405c', weapon: 'laser', w1: '#ff4fb8', w2: '#fff', glow: '#ff4fb8', armor: true }),
  disruptor: {
    w: 30, h: 22, deathRot: [35, 85], // wider canvas so the long ion cannon is not clipped
    draw: (p, a, f) => human(p, { skin: '#9aa2b4', torso: '#4a4e58', trim: '#7a7f8c', legs: '#33363f', boots: '#c8962a', head: 'visor', hc: '#3a3e48', weapon: 'ioncannon', w1: '#3a3f4c', w2: '#6b7385', glow: '#ffcf3a', armor: true, bulk: true }, a, f, 2, 0),
  },
  striderMech: { w: 40, h: 30, deathRot: [10, 22], draw: mech },
  titan: { w: 50, h: 56, deathRot: [6, 14], draw: titan },
};

export function buildUnitFrames(): Map<string, Pix> {
  const out = new Map<string, Pix>();
  for (const [id, spr] of Object.entries(UNIT_SPRITES)) {
    for (const anim of ['walk', 'atk'] as Anim[]) {
      for (let f = 0; f < FRAMES[anim]; f++) {
        const p = new Pix(spr.w, spr.h);
        spr.draw(p, anim, f);
        out.set(`unit:${id}:${anim}:${f}`, p);
      }
    }
    const base = out.get(`unit:${id}:walk:0`)!;
    const [r0, r1] = spr.deathRot ?? [30, 80];
    out.set(`unit:${id}:dead:0`, base.rotated(r0, 0.15, 1, 0));
    out.set(`unit:${id}:dead:1`, base.rotated(r1, 0.45, 3, 1));
  }
  return out;
}
