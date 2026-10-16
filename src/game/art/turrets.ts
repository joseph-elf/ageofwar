import { Pix } from './pixel';

export const TURRET_W = 26;
export const TURRET_H = 22;

type Draw = (p: Pix, fire: boolean) => void;
const flash = (p: Pix, x: number, y: number, c = '#ffd24a') => {
  p.r(x, y - 1, 4, 3, c);
  p.p(x + 4, y, '#fff');
};
const wheel = (p: Pix, x: number, y: number, r: number, c = '#4a3320') => {
  p.disc(x, y, r, c);
  p.disc(x, y, Math.max(1, r - 2), '#8a6a3a');
  p.p(x, y, c);
};

const D: Record<string, Draw> = {
  // ---- Stone
  slingpost: (p, f) => {
    p.r(10, 8, 3, 14, '#6a4a2a');
    p.r(7, 6, 9, 2, '#7a5a3a');
    p.r(6, 4, 2, 3, '#7a5a3a');
    p.r(15, 4, 2, 3, '#7a5a3a');
    p.line(7, 5, 1, 0, 9, '#c9a46a');
    f ? p.line(16, 5, 1, -0.2, 6, '#c9a46a') : p.disc(11, 8, 2, '#8a8a8a');
    if (f) p.disc(23, 3, 1, '#8a8a8a');
    p.r(7, 20, 9, 2, '#8a8a80');
  },
  spearcaster: (p, f) => {
    p.r(5, 14, 14, 8, '#7a5a3a');
    p.r(6, 13, 12, 2, '#5a3a22');
    p.line(8, 14, 1, f ? -0.4 : -0.9, 10, '#6a4a2a', 2);
    if (!f) p.line(9, 12, 1, -0.6, 14, '#cfc6a8', 1);
    if (!f) p.line(21, 5, 1, -0.6, 3, '#dfe', 1);
    p.r(4, 20, 4, 2, '#8a8a80');
  },
  boulderthrower: (p, f) => {
    p.r(4, 15, 18, 4, '#6a4a2a');
    wheel(p, 7, 19, 3);
    wheel(p, 19, 19, 3);
    p.r(10, 6, 3, 10, '#7a5a3a');
    const dx = f ? 1 : -1;
    p.line(11, 7, dx, f ? -0.2 : -0.3, 11, '#5a3a22', 2);
    p.r(f ? 21 : 2, f ? 4 : 3, 5, 3, '#4a3320');
    if (!f) p.disc(4, 2, 2, '#8a8a8a');
  },
  tarpot: (p, f) => {
    p.line(3, 21, 1, -2, 9, '#6a4a2a', 1);
    p.line(12, 21, -1, -2, 9, '#6a4a2a', 1);
    p.r(5, 19, 8, 3, '#4a3320');
    p.p(6, 18, '#ff7a2a');
    p.p(8, 17, '#ffd24a');
    p.p(10, 18, '#ff7a2a');
    p.p(12, 18, '#ffd24a');
    p.disc(8, 12, 4, '#a8673a');
    p.r(3, 8, 11, 1, '#7a4a2a');
    p.r(4, 8, 9, 1, '#15121a');
    p.p(5, 7, '#15121a');
    p.p(9, 7, '#15121a');
    p.p(7, 8, '#4a4458');
    p.r(15, 15, 2, 7, '#6a4a2a');
    p.line(16, 16, 1, f ? -0.4 : -1.2, 9, '#7a5a3a', 2);
    if (!f) {
      p.disc(21, 8, 2, '#15121a');
      p.p(20, 7, '#4a4458');
    } else {
      p.disc(23, 8, 2, '#15121a');
      p.p(22, 7, '#4a4458');
      p.p(19, 9, '#15121a');
    }
  },
  // ---- Medieval
  crossbownest: (p, f) => {
    p.r(5, 14, 16, 8, '#8d8f98');
    for (let x = 5; x < 21; x += 4) p.r(x, 13, 2, 2, '#8d8f98');
    p.r(6, 11, 16, 3, '#6a4a2a');
    p.r(19, 5, 2, 12, '#3a2a22');
    p.p(18, 5, '#3a2a22');
    p.p(18, 16, '#3a2a22');
    p.line(19, 5, f ? 0 : -1, 1, f ? 12 : 6, '#ccc');
    if (!f) p.r(7, 10, 13, 1, '#dfe');
    else p.r(21, 10, 4, 1, '#dfe');
  },
  ballista: (p, f) => {
    p.r(4, 15, 18, 7, '#6a4a2a');
    p.r(8, 12, 10, 3, '#7a5a3a');
    wheel(p, 8, 20, 2);
    wheel(p, 18, 20, 2);
    p.r(17, 4, 3, 13, '#4a3320');
    p.line(18, 4, f ? 1 : -1, 1, 7, '#ddd');
    p.line(18, 16, f ? 1 : -1, -1, 7, '#ddd');
    p.r(5, 9, 18, 2, '#b8bdc6');
    if (!f) p.r(5, 9, 21, 1, '#fff');
  },
  trebuchet: (p, f) => {
    p.r(3, 19, 20, 3, '#5a3a22');
    p.line(6, 19, 1, -2, 11, '#6a4a2a', 2);
    p.line(20, 19, -1, -2, 11, '#6a4a2a', 2);
    p.r(10, 4, 6, 2, '#7a5a3a');
    p.line(13, 5, f ? 1 : -1, f ? -0.4 : 0.6, 11, '#8a6a3a', 2);
    p.r(f ? 4 : 18, f ? 14 : 12, 4, 5, '#555');
    if (!f) p.disc(5, 11, 2, '#999');
    else p.disc(23, 3, 2, '#999');
  },
  oilcauldron: (p, f) => {
    p.r(4, 16, 18, 6, '#8d8f98');
    p.r(4, 19, 18, 1, '#6b6d78');
    p.r(11, 16, 1, 3, '#6b6d78');
    p.r(17, 19, 1, 3, '#6b6d78');
    p.r(8, 18, 6, 4, '#2a1d14');
    p.p(10, 20, '#ff7a2a');
    p.p(12, 21, '#ffd24a');
    if (!f) {
      p.disc(11, 12, 5, '#3a3d46');
      p.r(5, 8, 13, 2, '#5a5d68');
      p.r(6, 8, 11, 1, '#d89a2a');
      p.p(4, 10, '#5a5d68');
      p.p(18, 10, '#5a5d68');
      p.p(8, 11, '#5a5d68');
      p.p(9, 4, '#cfd6e0');
      p.p(10, 3, '#cfd6e0');
      p.p(13, 5, '#cfd6e0');
      p.p(14, 2, '#cfd6e0');
    } else {
      p.disc(12, 12, 5, '#3a3d46');
      p.line(7, 7, 1, 0.8, 11, '#5a5d68', 2);
      p.line(9, 12, 1, 0, 4, '#5a5d68');
      p.r(17, 12, 2, 2, '#d89a2a');
      p.r(19, 14, 2, 2, '#ffc24a');
      p.r(21, 16, 2, 2, '#d89a2a');
      p.r(20, 19, 6, 2, '#ffc24a');
      p.p(24, 18, '#ffe08a');
      p.p(18, 10, '#ffe08a');
    }
  },
  // ---- Renaissance
  musketrack: (p, f) => {
    p.r(4, 15, 18, 7, '#6a4524');
    p.r(3, 14, 20, 2, '#9a7a44');
    for (let i = 0; i < 3; i++) {
      p.r(7, 6 + i * 3, 17, 1, '#59606b');
      p.r(5, 6 + i * 3, 3, 2, '#6a4524');
    }
    if (f) flash(p, 24, 7);
  },
  culverin: (p, f) => {
    wheel(p, 8, 18, 4);
    wheel(p, 18, 18, 4);
    p.r(5, 13, 16, 3, '#6a4524');
    p.r(4 + (f ? -1 : 0), 8, 19, 5, '#b98a3a');
    p.r(4 + (f ? -1 : 0), 8, 19, 1, '#e0b85a');
    p.r(22, 7, 3, 7, '#b98a3a');
    if (f) flash(p, 25, 10, '#ffb04a');
  },
  mortar: (p, f) => {
    p.r(5, 17, 16, 5, '#6a4524');
    p.r(3, 20, 20, 2, '#4a3320');
    p.line(9, 17, 1, -1.4, 10, '#3d4048', 5);
    p.line(9, 17, 1, -1.4, 10, '#5a5f6a', 2);
    if (f) {
      p.disc(18, 4, 2, '#ffb04a');
      p.disc(18, 4, 1, '#fff');
    }
  },
  chainshot: (p, f) => {
    const r = f ? -1 : 0;
    p.r(2, 15, 13, 3, '#6a4524');
    wheel(p, 7, 18, 3);
    p.r(3 + r, 10, 14, 4, '#b98a3a');
    p.r(3 + r, 10, 14, 1, '#e0b85a');
    p.r(16 + r, 9, 3, 6, '#b98a3a');
    p.r(1 + r, 11, 2, 3, '#b98a3a');
    p.p(8 + r, 9, '#7a5a2a');
    p.disc(17, 19, 2, '#2a2a30');
    p.disc(23, 19, 2, '#2a2a30');
    p.p(16, 18, '#666');
    p.p(22, 18, '#666');
    p.p(20, 19, '#9aa0aa');
    p.p(20, 20, '#6b727c');
    if (f) flash(p, 19, 12, '#ffb04a');
  },
  // ---- Modern
  mgnest: (p, f) => {
    p.r(2, 15, 22, 7, '#a89a6a');
    for (let x = 2; x < 22; x += 5) p.r(x, 14, 4, 2, '#8d7f50');
    p.r(9, 10, 10, 4, '#33383d');
    p.r(17, 11, 8, 2, '#222');
    p.r(11, 8, 4, 2, '#33383d');
    if (f) flash(p, 25, 12, '#ffe9a0');
  },
  autocannon: (p, f) => {
    p.r(3, 16, 20, 6, '#4a5535');
    p.r(7, 9, 12, 7, '#5d6f45');
    p.r(7, 9, 12, 1, '#7d9560');
    p.r(17 + (f ? -1 : 0), 11, 9, 3, '#2a2f2a');
    p.r(11, 7, 4, 2, '#2a2f2a');
    if (f) flash(p, 25, 12, '#ffb04a');
  },
  rocketpod: (p, f) => {
    p.r(4, 17, 18, 5, '#3f4a30');
    p.line(8, 17, 1, -1.1, 11, '#5d6f45', 9);
    for (let i = 0; i < 4; i++) p.disc(12 + (i % 2) * 4, 9 - (i >> 1) * 3 + (i % 2) * 1, 1, '#1a1f1a');
    if (!f) for (let i = 0; i < 2; i++) p.r(15 + i * 3, 6 - i * 3 + 2, 3, 1, '#d33');
    else p.r(18, 2, 6, 4, '#ffb04a');
  },
  gaslauncher: (p, f) => {
    p.r(4, 17, 18, 5, '#3f4a30');
    p.r(4, 17, 18, 1, '#5d6f45');
    p.r(6, 14, 14, 3, '#4a5535');
    for (let i = 0; i < 3; i++) {
      p.line(7 + i * 4, 15, 0.6, -1, 8, '#2a2f2a', 3);
      p.line(8 + i * 4, 15, 0.6, -1, 8, '#3a403a', 1);
      if (!f) p.r(10 + i * 4, 7, 2, 2, '#7ddc5a');
    }
    p.r(21, 16, 3, 6, '#4a9a3a');
    p.r(21, 15, 3, 1, '#9ad87a');
    p.r(21, 18, 3, 1, '#2a5a22');
    if (f) {
      p.disc(15, 5, 3, '#8ae86a');
      p.disc(20, 4, 2, '#8ae86a');
      p.disc(11, 7, 2, '#8ae86a');
      p.p(15, 5, '#d6ffb8');
      p.p(20, 4, '#d6ffb8');
    }
  },
  // ---- Future
  pulsetower: (p, f) => {
    p.r(8, 13, 10, 9, '#cfd7f0');
    p.r(8, 20, 10, 2, '#8892b3');
    p.r(11, 8, 4, 5, '#8892b3');
    p.disc(13, 6, f ? 4 : 3, f ? '#aef' : '#38d6ff');
    p.disc(13, 6, 1, '#fff');
    p.r(16, 5, 8, 2, '#8892b3');
    p.r(16, 8, 8, 1, '#8892b3');
    if (f) p.r(24, 4, 2, 5, '#aef');
  },
  railgun: (p, f) => {
    p.r(4, 16, 18, 6, '#39405c');
    p.r(4, 21, 18, 1, '#ff4fb8');
    p.r(7, 11, 10, 5, '#8892b3');
    p.r(12 + (f ? -1 : 0), 9, 14, 2, '#cfd7f0');
    p.r(12 + (f ? -1 : 0), 13, 14, 2, '#cfd7f0');
    for (let x = 14; x < 24; x += 3) p.r(x + (f ? -1 : 0), 11, 1, 2, '#ff4fb8');
    if (f) p.r(25, 10, 1, 4, '#fff');
  },
  plasmamortar: (p, f) => {
    p.r(5, 17, 16, 5, '#39405c');
    p.disc(12, 14, 6, '#8892b3');
    p.r(6, 14, 13, 6, '#8892b3');
    p.line(13, 11, 0.6, -1, 10, '#cfd7f0', 5);
    p.disc(18, f ? 2 : 4, f ? 3 : 2, '#d6a9ff');
    p.p(18, f ? 2 : 4, '#fff');
  },
  stasis: (p, f) => {
    p.r(8, 17, 10, 5, '#39405c');
    p.r(8, 20, 10, 1, '#9a7bff');
    p.r(11, 9, 4, 8, '#8892b3');
    p.r(11, 9, 1, 8, '#cfd7f0');
    p.r(10, 15, 6, 2, '#586179');
    const rx = f ? 9 : 6;
    const ry = f ? 4 : 3;
    for (let a = 0; a < 360; a += 12) {
      const c = (a / 12) % 2 ? '#9a7bff' : '#7ae8ff';
      p.p(13 + Math.cos((a * Math.PI) / 180) * rx, 6 + Math.sin((a * Math.PI) / 180) * ry, f ? '#7ae8ff' : c);
    }
    if (f) for (let a = 0; a < 360; a += 20) p.p(13 + Math.cos((a * Math.PI) / 180) * 6, 6 + Math.sin((a * Math.PI) / 180) * 3, '#9a7bff');
    p.disc(13, 6, f ? 2 : 1, f ? '#aef' : '#7ae8ff');
    p.p(13, 6, '#fff');
  },
};

export function buildTurretFrames(): Map<string, Pix> {
  const out = new Map<string, Pix>();
  for (const [id, draw] of Object.entries(D)) {
    for (const fire of [false, true]) {
      const p = new Pix(TURRET_W, TURRET_H);
      draw(p, fire);
      out.set(`turret:${id}:${fire ? 1 : 0}`, p);
    }
  }
  return out;
}
