import { Pix } from './pixel';

/** Projectile & effect sprites. Projectiles point to the right (+x). */
export function buildMisc(): Map<string, Pix> {
  const m = new Map<string, Pix>();
  const add = (k: string, w: number, h: number, f: (p: Pix) => void) => {
    const p = new Pix(w, h);
    f(p);
    m.set(k, p);
  };
  add('proj:rock', 6, 6, (p) => p.disc(3, 3, 2, '#8a8a8a').p(2, 2, '#bbb'));
  add('proj:spear', 16, 3, (p) => p.r(0, 1, 13, 1, '#8a6a3a').r(13, 0, 3, 3, '#dfe4ea'));
  add('proj:arrow', 14, 3, (p) => p.r(0, 1, 12, 1, '#8a6a3a').r(12, 0, 2, 3, '#dfe4ea').p(0, 0, '#d33').p(0, 2, '#d33'));
  add('proj:bolt', 10, 3, (p) => p.r(0, 1, 8, 1, '#5a3a22').r(8, 0, 2, 3, '#cfd6e6'));
  add('proj:ball', 7, 7, (p) => p.disc(3, 3, 3, '#2a2a30').p(2, 2, '#666'));
  add('proj:bullet', 6, 2, (p) => p.r(0, 0, 6, 2, '#ffe28a').p(5, 0, '#fff'));
  add('proj:shell', 10, 5, (p) => p.r(0, 1, 8, 3, '#c9a24a').r(8, 1, 2, 3, '#7a5a2a').p(2, 0, '#e8d28a'));
  add('proj:rocket', 14, 5, (p) => p.r(2, 1, 9, 3, '#e8e8ee').r(11, 1, 3, 3, '#d33').r(0, 2, 2, 1, '#ffb04a').p(5, 0, '#aaa'));
  add('proj:laser', 16, 3, (p) => p.r(0, 0, 16, 3, '#38d6ff').r(1, 1, 14, 1, '#fff'));
  add('proj:plasma', 10, 10, (p) => p.disc(5, 5, 4, '#a96bff').disc(5, 5, 2, '#f0dcff'));
  add('proj:meteor', 22, 22, (p) => {
    p.disc(14, 14, 7, '#7a4a2a').disc(14, 14, 5, '#d8672a').disc(13, 13, 2, '#ffe39a');
    p.line(8, 8, -1, -1, 8, '#ffb04a', 2);
    p.line(10, 12, -1, -1, 9, '#d8672a', 2);
  });
  add('proj:bomb', 10, 14, (p) => p.r(2, 3, 6, 9, '#3a3f48').r(3, 12, 4, 2, '#3a3f48').r(1, 0, 8, 3, '#586179').p(4, 5, '#8a92a0'));
  add('fx:plane', 44, 16, (p) => {
    p.r(4, 6, 36, 4, '#7a8290').r(0, 7, 6, 2, '#586179').r(36, 6, 8, 3, '#9aa2b0').r(14, 0, 8, 7, '#586179').r(14, 9, 8, 7, '#586179').r(34, 4, 3, 2, '#38d6ff');
  });
  add('fx:spark', 4, 4, (p) => p.r(0, 0, 4, 4, '#fff'));
  add('fx:smoke', 10, 10, (p) => p.disc(5, 5, 4, '#9a9aa4'));
  add('fx:flash', 24, 24, (p) => p.disc(12, 12, 11, '#fff'));
  add('fx:ring', 48, 48, (p) => {
    for (let a = 0; a < 360; a += 3) p.p(24 + Math.cos((a * Math.PI) / 180) * 22, 24 + Math.sin((a * Math.PI) / 180) * 22, '#fff');
    for (let a = 0; a < 360; a += 3) p.p(24 + Math.cos((a * Math.PI) / 180) * 21, 24 + Math.sin((a * Math.PI) / 180) * 21, '#fff');
  });
  add('fx:coin', 7, 7, (p) => p.disc(3, 3, 3, '#f5c542').disc(3, 3, 1, '#fff2a8'));
  add('fx:star', 9, 9, (p) => p.r(4, 0, 1, 9, '#7ee0ff').r(0, 4, 9, 1, '#7ee0ff').r(3, 3, 3, 3, '#fff'));
  return m;
}
