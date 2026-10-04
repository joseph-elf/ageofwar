import { Pix, hash } from './pixel';

export const BG_W = 640;
export const BG_H = 360;
const TAU = Math.PI * 2;
/** Periodic noise so layers tile seamlessly every BG_W pixels. */
const wave = (x: number, seed: number, k: number) => Math.sin((x / BG_W) * TAU * k + seed) * 0.5 + 0.5;

function gradient(p: Pix, stops: [number, string][], bands = 18, h = BG_H): void {
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) if (t >= stops[s][0] && t <= stops[s + 1][0]) [a, b] = [stops[s], stops[s + 1]];
    const k = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    p.r(0, Math.floor((i / bands) * h), BG_W, Math.ceil(h / bands) + 1, mix(a[1], b[1], k));
  }
}
function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
function ridge(p: Pix, base: number, amp: number, col: string, seed: number, k1 = 3, k2 = 7): void {
  for (let x = 0; x < BG_W; x++) {
    const y = base - (wave(x, seed, k1) * 0.7 + wave(x, seed * 2, k2) * 0.3) * amp;
    p.r(x, y, 1, BG_H - y, col);
  }
}
function clouds(p: Pix, n: number, col: string, y0: number, y1: number, seed = 0): void {
  for (let i = 0; i < n; i++) {
    const x = hash(i + seed) * BG_W;
    const y = y0 + hash(i + 50 + seed) * (y1 - y0);
    const w = 30 + hash(i + 9) * 40;
    p.r(x, y, w, 5, col);
    p.r(x + 6, y - 4, w * 0.6, 5, col);
  }
}
function stars(p: Pix, n: number, h: number): void {
  for (let i = 0; i < n; i++) p.p(hash(i) * BG_W, hash(i + 500) * h, hash(i + 3) > 0.8 ? '#ffffff' : '#9a9ad8');
}

export interface Layers {
  sky: Pix;
  far: Pix;
  mid: Pix;
}

const AGE_LAYERS: ((l: Layers) => void)[] = [
  // Stone Age: volcanic dawn
  ({ sky, far, mid }) => {
    gradient(sky, [[0, '#3c2d63'], [0.45, '#b4577a'], [0.8, '#f2a572'], [1, '#f8d28a']]);
    sky.disc(430, 215, 26, '#ffe6a0');
    sky.disc(430, 215, 20, '#fff4cc');
    clouds(sky, 6, '#d98aa0', 40, 140);
    ridge(far, 270, 90, '#5a3d6e', 1.3, 2, 6);
    // volcano
    for (let y = 0; y < 90; y++) far.r(150 - y * 0.9 - 12, 270 - 90 + y - 8 + 8, y * 1.8 + 24, 1, '#4a3058');
    far.r(138, 175, 24, 6, '#ff7a3a');
    for (let i = 0; i < 9; i++) far.disc(150 + Math.sin(i) * 10, 165 - i * 12, 7 + i, 'rgba(60,40,70,0.55)');
    ridge(mid, 330, 60, '#3d2c4a', 4.1, 4, 9);
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * BG_W + hash(i) * 30;
      mid.r(x, 270, 3, 60, '#2c2118');
      for (let a = 0; a < 5; a++) mid.line(x + 1, 270, Math.cos(a * 1.3 - 0.6) * 2, -Math.abs(Math.sin(a * 1.3)) * 1 + 0.3, 14, '#3a6a32', 2);
    }
  },
  // Medieval: bright countryside with distant castles
  ({ sky, far, mid }) => {
    gradient(sky, [[0, '#4f9ee0'], [1, '#d4eefb']]);
    clouds(sky, 9, '#ffffff', 30, 170);
    ridge(far, 285, 70, '#7fb2c8', 0.5, 2, 5);
    for (const cx of [90, 300, 520]) {
      far.r(cx, 205, 40, 70, '#8fa0b0');
      for (let x = 0; x < 40; x += 8) far.r(cx + x, 199, 5, 6, '#8fa0b0');
      far.r(cx + 12, 180, 16, 30, '#8fa0b0');
      far.p(cx + 20, 168, '#b8302c');
      far.r(cx + 20, 168, 1, 14, '#6a6a76');
    }
    ridge(mid, 335, 55, '#4f8f3a', 2.2, 3, 8);
    for (let i = 0; i < 14; i++) {
      const x = hash(i + 4) * BG_W;
      mid.r(x, 292, 3, 20, '#4a3320');
      mid.disc(x + 1, 288, 9, '#2f6a2c');
      mid.disc(x - 3, 292, 6, '#3a7a34');
    }
  },
  // Renaissance: golden-hour city
  ({ sky, far, mid }) => {
    gradient(sky, [[0, '#e0a060'], [0.5, '#f4cf94'], [1, '#fbe8c0']]);
    clouds(sky, 8, '#f9dcae', 40, 160, 7);
    ridge(far, 290, 40, '#b49a9a', 1, 2, 5);
    for (let i = 0; i < 20; i++) {
      const x = i * 32 + hash(i) * 10;
      const h = 40 + hash(i + 1) * 60;
      far.r(x, 290 - h, 24, h, '#9a8a94');
      far.r(x, 290 - h, 24, 3, '#7a6a76');
      if (i % 3 == 0) for (let y = 0; y < 14; y++) far.r(x + 12 - y * 0.8, 290 - h - y, Math.max(1, y * 1.6), 1, '#6a6a86');
      if (i % 5 == 2) far.disc(x + 12, 290 - h - 2, 8, '#7a8aa0');
    }
    // windmill
    far.r(560, 230, 14, 60, '#8a7a76');
    far.line(567, 232, 1, 1, 26, '#6a5a50', 2);
    far.line(567, 232, -1, -1, 26, '#6a5a50', 2);
    far.line(567, 232, 1, -1, 26, '#6a5a50', 2);
    far.line(567, 232, -1, 1, 26, '#6a5a50', 2);
    ridge(mid, 338, 40, '#6a8a4a', 3.3, 3, 8);
    for (let i = 0; i < 11; i++) {
      const x = hash(i + 22) * BG_W;
      for (let y = 0; y < 30; y++) mid.r(x - y * 0.18, 300 + y - 30 + 4, y * 0.36 + 2, 1, '#2f5a2c');
      mid.r(x, 304, 2, 14, '#4a3320');
    }
    for (let i = 0; i < 5; i++) {
      const x = hash(i + 80) * BG_W;
      for (let y = 0; y < 14; y++) mid.r(x - y, 312 - 14 + y, y * 2 + 1, 1, i % 2 ? '#e8e0cc' : '#c9553a');
    }
  },
  // Modern: grey metropolis
  ({ sky, far, mid }) => {
    gradient(sky, [[0, '#6f8398'], [1, '#c9d2d9']]);
    clouds(sky, 7, '#aab6c0', 40, 150, 2);
    for (let i = 0; i < 26; i++) {
      const x = i * 25 + hash(i) * 8;
      const h = 60 + hash(i + 3) * 130;
      far.r(x, 295 - h, 20, h, '#7e8c9a');
      far.r(x + 14, 295 - h, 6, h, '#6e7c8a');
      for (let y = 295 - h + 5; y < 290; y += 7) for (let wx = x + 3; wx < x + 17; wx += 5) if (hash(wx * 7 + y) > 0.45) far.r(wx, y, 2, 3, '#b8cde0');
    }
    for (let i = 0; i < 22; i++) {
      const x = i * 30 + hash(i + 40) * 10;
      const h = 30 + hash(i + 8) * 40;
      mid.r(x, 335 - h, 26, h, '#5c6874');
      mid.r(x, 335 - h, 26, 2, '#47515b');
      for (let y = 335 - h + 5; y < 330; y += 8) for (let wx = x + 3; wx < x + 23; wx += 6) mid.r(wx, y, 3, 3, hash(wx + y * 3) > 0.5 ? '#e8d890' : '#2c3640');
    }
    for (const x of [100, 330, 560]) {
      mid.r(x, 270, 3, 66, '#2c3138');
      mid.r(x - 10, 276, 23, 2, '#2c3138');
      mid.r(x - 10, 284, 23, 2, '#2c3138');
    }
    mid.r(0, 330, BG_W, 3, '#2c3138');
  },
  // Future: neon night
  ({ sky, far, mid }) => {
    gradient(sky, [[0, '#07041a'], [0.55, '#2a1260'], [0.9, '#a02a78'], [1, '#ff5aa8']], 24);
    stars(sky, 90, 200);
    sky.disc(160, 100, 40, '#6a5ad8');
    sky.disc(150, 92, 34, '#8a7af0');
    for (let a = 0; a < 360; a += 2) sky.p(160 + Math.cos((a * Math.PI) / 180) * 64, 100 + Math.sin((a * Math.PI) / 180) * 12, '#d8c8ff');
    sky.disc(480, 60, 10, '#ffd8f0');
    for (let i = 0; i < 20; i++) {
      const x = i * 32 + hash(i) * 8;
      const h = 70 + hash(i + 2) * 150;
      far.r(x, 300 - h, 14, h, '#241a4a');
      far.r(x + 10, 300 - h, 4, h, '#1a1238');
      far.r(x + 5, 300 - h - 10, 2, 10, '#38d6ff');
      for (let y = 300 - h + 6; y < 296; y += 9) far.r(x + 3, y, 8, 1, hash(y + x) > 0.5 ? '#38d6ff' : '#ff4fb8');
    }
    for (let i = 0; i < 7; i++) {
      const x = hash(i + 60) * BG_W;
      const y = 200 + hash(i + 61) * 60;
      mid.r(x - 16, y, 32, 5, '#3a3470');
      mid.r(x - 10, y + 5, 20, 3, '#2a2458');
      mid.r(x - 16, y, 32, 1, '#38d6ff');
    }
    for (let i = 0; i < 12; i++) {
      const x = i * 54 + hash(i) * 20;
      mid.r(x, 280, 4, 56, '#2e2864');
      mid.disc(x + 2, 278, 5, '#38d6ff');
      mid.disc(x + 2, 278, 2, '#fff');
    }
    mid.r(0, 332, BG_W, 3, '#38d6ff');
  },
];

export function buildBackground(age: number): Layers {
  const l = { sky: new Pix(BG_W, BG_H), far: new Pix(BG_W, BG_H), mid: new Pix(BG_W, BG_H) };
  AGE_LAYERS[age](l);
  return l;
}

/** 64x80 tile for the lane's ground. Row 0 is the walking surface. */
export function buildGround(age: number): Pix {
  const p = new Pix(64, 80);
  const pal = [
    ['#6b9a3c', '#8a6a46', '#6e5236', '#a88a60'],
    ['#4f9a3a', '#7a5a3a', '#5e4430', '#93ab6a'],
    ['#8a8a8a', '#6a655c', '#54504a', '#a8a29a'],
    ['#4a4f58', '#343840', '#2a2d34', '#e0c84a'],
    ['#2a2f4a', '#1c2038', '#141829', '#38d6ff'],
  ][age];
  p.r(0, 0, 64, 80, pal[1]);
  p.r(0, 0, 64, 5, pal[0]);
  p.r(0, 5, 64, 1, pal[2]);
  for (let i = 0; i < 40; i++) p.r(hash(i + age * 50) * 62, 7 + hash(i + 9) * 70, 2, 1 + (i % 2), i % 3 ? pal[2] : pal[3]);
  if (age === 0 || age === 1) for (let x = 0; x < 64; x += 5) p.r(x + (hash(x) * 3) | 0, -1, 1, 2, pal[0]);
  if (age === 2) for (let x = 0; x < 64; x += 8) p.r(x, 0, 1, 5, pal[2]);
  if (age === 3) for (let x = 0; x < 64; x += 16) p.r(x, 2, 8, 1, pal[3]);
  if (age === 4) {
    p.r(0, 0, 64, 1, pal[3]);
    for (let x = 0; x < 64; x += 16) p.r(x, 1, 1, 79, pal[2]);
    p.r(0, 20, 64, 1, pal[2]);
  }
  return p;
}
