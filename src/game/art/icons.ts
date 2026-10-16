import { Pix } from './pixel';

/** 16x16 icons for the special-ability buttons and a few HUD glyphs. */
export function buildIcons(): Map<string, Pix> {
  const m = new Map<string, Pix>();
  const add = (k: string, f: (p: Pix) => void) => {
    const p = new Pix(16, 16);
    f(p);
    m.set(k, p);
  };
  add('icon:meteors', (p) => {
    p.disc(10, 10, 4, '#7a4a2a').disc(10, 10, 3, '#e0702a').p(9, 9, '#ffe39a');
    p.line(6, 6, -1, -1, 6, '#ffb04a', 2);
    p.line(8, 3, -1, -1, 3, '#ffb04a');
  });
  add('icon:volley', (p) => {
    for (const [x, y] of [[3, 2], [8, 0], [12, 4]]) {
      p.line(x, y, 1, 2, 9, '#8a6a3a');
      p.disc(x + 4, y + 9, 1, '#dfe4ea');
    }
  });
  add('icon:barrage', (p) => {
    p.disc(8, 9, 5, '#2a2a30').p(6, 7, '#777');
    p.line(10, 4, 1, -1, 4, '#c9a24a');
    p.r(13, 0, 2, 2, '#ffb04a');
  });
  add('icon:airstrike', (p) => {
    p.r(1, 6, 14, 3, '#8a92a0').r(5, 2, 3, 11, '#6a7280').r(12, 4, 3, 2, '#38d6ff');
    p.r(7, 12, 2, 3, '#33383f');
  });
  add('icon:laser', (p) => {
    p.r(7, 0, 2, 16, '#38d6ff').r(8, 0, 1, 16, '#fff');
    p.r(3, 0, 10, 2, '#8892b3');
    p.disc(8, 14, 2, '#aef');
  });
  add('icon:evolve', (p) => {
    p.r(7, 2, 2, 12, '#ffe066');
    p.line(8, 2, -1, 1, 6, '#ffe066', 2);
    p.line(8, 2, 1, 1, 6, '#ffe066', 2);
    p.r(4, 12, 8, 2, '#ffb02e');
  });
  add('icon:slot', (p) => {
    p.r(7, 3, 2, 10, '#9fe870').r(3, 7, 10, 2, '#9fe870');
  });
  add('icon:econ', (p) => {
    p.disc(8, 11, 4, '#b8861a').disc(8, 11, 3, '#f5c542').p(7, 10, '#fff2a8').p(8, 10, '#fff2a8').p(9, 13, '#d8a82a');
    p.disc(12, 13, 2, '#f5c542').p(12, 12, '#fff2a8');
    p.line(4, 14, 0.7, -1, 12, '#8a5a2a', 2);
    p.line(5, 1.5, 1, 0.5, 10, '#cfd6e0', 2);
    p.p(5, 1, '#fff');
  });
  return m;
}
