import { SLOT_HEIGHTS } from '../../data/config';
import { Pix, hash, shade } from './pixel';

export const BASE_W = 56;
export const BASE_H = 80;
export const BASE_SCALE = 3;
/** y (in sprite px, from the top) of each turret ledge. */
export const LEDGE_ROWS = SLOT_HEIGHTS.map((h) => BASE_H - Math.round(h / BASE_SCALE));

function bricks(p: Pix, x: number, y: number, w: number, h: number, col: string, mortar: string, bw = 6, bh = 3): void {
  p.r(x, y, w, h, col);
  for (let r = 0; r * bh < h; r++) {
    p.r(x, y + r * bh, w, 1, mortar);
    for (let c = (r % 2) * (bw / 2); c < w; c += bw) p.r(x + c, y + r * bh, 1, bh, mortar);
  }
}

const ledges = (p: Pix, col: string, edge: string, rail?: string) => {
  for (const row of LEDGE_ROWS) {
    p.r(34, row, 22, 2, col);
    p.r(34, row + 2, 22, 1, edge);
    p.r(36, row + 3, 2, 3, edge);
    if (rail) for (let x = 36; x < 56; x += 5) p.r(x, row - 3, 1, 3, rail);
  }
};

const BASES: ((p: Pix) => void)[] = [
  // Stone Age: boulder mound, hide tent, bone arch
  (p) => {
    for (let i = 0; i < 70; i++) {
      const x = 4 + hash(i) * 38;
      const y = 14 + hash(i + 99) * 62;
      p.disc(x, y, 5 + hash(i + 7) * 5, shade(i % 2 ? '#8a7a68' : '#6e6052', (hash(i + 3) - 0.5) * 30));
    }
    p.r(10, 66, 24, 14, '#3a2a20');
    p.r(14, 62, 16, 6, '#3a2a20');
    p.r(20, 44, 3, 36, '#e9dfc4'); // bone totem
    p.disc(21, 42, 4, '#e9dfc4');
    p.r(19, 41, 2, 2, '#222');
    p.r(22, 41, 2, 2, '#222');
    p.line(4, 14, 1, 1, 14, '#a7743d', 2); // hide banner
    p.r(2, 4, 3, 14, '#6a4a2a');
    p.r(5, 5, 8, 10, '#b8452e');
    for (const [x, y] of [[44, 74], [38, 76]]) p.disc(x, y, 4, '#6e6052');
    ledges(p, '#7a5a3a', '#4a3320');
    p.r(46, 40, 2, 38, '#6a4a2a');
  },
  // Medieval: stone keep
  (p) => {
    bricks(p, 6, 14, 44, 66, '#8d8f98', '#6b6d78');
    p.r(6, 8, 44, 6, '#7a7c86');
    for (let x = 6; x < 50; x += 8) p.r(x, 4, 5, 6, '#7a7c86');
    p.r(22, 62, 12, 18, '#2a1d14');
    p.r(23, 60, 10, 3, '#2a1d14');
    p.r(26, 62, 4, 18, '#5a3a22');
    for (const y of [24, 40]) {
      p.r(12, y, 4, 8, '#1b1e2a');
      p.r(12, y, 4, 1, '#c9a24a');
    }
    p.r(27, 0, 1, 10, '#6a4a2a');
    p.r(28, 0, 9, 5, '#b8302c');
    p.r(28, 2, 9, 1, '#f0c84a');
    ledges(p, '#a6a8b2', '#6b6d78');
  },
  // Renaissance: brick fortress with a slate cap
  (p) => {
    bricks(p, 6, 16, 44, 64, '#a8553a', '#7a3a28', 5, 3);
    p.r(6, 16, 3, 64, '#e8e0cc');
    p.r(47, 16, 3, 64, '#e8e0cc');
    p.r(4, 12, 48, 5, '#e8e0cc');
    for (let i = 0; i < 12; i++) p.r(8 + i, 12 - i, 40 - i * 2, 1, i % 2 ? '#3a4458' : '#4a5670');
    p.r(26, 0, 4, 4, '#3a4458');
    p.r(28, 0, 1, 12, '#d8c26a');
    p.r(29, 0, 7, 4, '#e8e0cc');
    p.r(29, 1, 7, 2, '#2f4f9a');
    p.r(20, 62, 16, 18, '#2a1a12');
    p.r(22, 60, 12, 3, '#2a1a12');
    for (const y of [26, 42]) {
      p.r(12, y, 5, 8, '#e8e0cc');
      p.r(13, y + 1, 3, 6, '#1b2236');
    }
    for (const x of [14, 40]) p.r(x, 56, 6, 4, '#2a2a2a'); // cannon ports
    ledges(p, '#8a5a30', '#5a3a1c', '#5a3a1c');
  },
  // Modern: concrete command tower
  (p) => {
    p.r(6, 12, 44, 68, '#9aa0a6');
    for (let y = 12; y < 80; y += 11) p.r(6, y, 44, 1, '#7c8288');
    p.r(6, 12, 44, 3, '#6c7278');
    for (const y of [20, 34, 48]) for (let x = 10; x < 46; x += 9) p.r(x, y, 6, 4, '#1b2a3a'), p.r(x, y, 6, 1, '#6fa0c8');
    p.r(22, 60, 14, 20, '#32373c');
    p.r(22, 60, 14, 2, '#d8b02a');
    for (let x = 6; x < 50; x += 6) p.r(x, 76, 3, 4, '#d8b02a');
    p.r(30, 0, 1, 12, '#555');
    p.r(24, 6, 6, 1, '#555');
    p.disc(14, 8, 5, '#b8bec4');
    p.r(13, 8, 2, 4, '#555');
    p.p(30, 0, '#f33');
    for (let x = 0; x < 34; x += 8) p.r(x, 72, 8, 8, '#a8996a'), p.r(x, 72, 8, 1, '#c8b98a');
    ledges(p, '#6c7278', '#44494e', '#44494e');
  },
  // Future: tapered neon spire
  (p) => {
    for (let y = 0; y < 80; y++) {
      const w = 22 + Math.round((y / 80) * 24);
      p.r(28 - Math.round(w / 2) + 4, y, w, 1, y % 9 === 0 ? '#aab4d4' : '#dce3f7');
    }
    p.r(32, 10, 2, 70, '#8892b3');
    for (const y of [18, 32, 46]) p.r(22, y, 18, 3, '#38d6ff'), p.r(22, y + 1, 18, 1, '#e9ffff');
    p.r(18, 62, 22, 18, '#202640');
    p.r(24, 62, 10, 18, '#38d6ff');
    p.disc(30, 4, 4, '#ff4fb8');
    p.disc(30, 4, 2, '#fff');
    p.r(12, 28, 3, 40, '#6b7392');
    p.r(46, 28, 3, 40, '#6b7392');
    p.disc(13, 26, 3, '#38d6ff');
    ledges(p, '#38d6ff', '#1b6b8a');
  },
];

export function buildBases(): Map<string, Pix> {
  const out = new Map<string, Pix>();
  BASES.forEach((draw, i) => {
    const p = new Pix(BASE_W, BASE_H);
    draw(p);
    out.set(`base:${i}`, p);
  });
  return out;
}
