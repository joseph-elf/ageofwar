// Tiny offscreen-canvas pixel painter used to build all sprites procedurally at boot.
export class Pix {
  readonly c: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  constructor(readonly w: number, readonly h: number) {
    this.c = document.createElement('canvas');
    this.c.width = w;
    this.c.height = h;
    this.g = this.c.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
  }
  r(x: number, y: number, w: number, h: number, col: string): this {
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), w, h);
    return this;
  }
  p(x: number, y: number, col: string): this {
    return this.r(x, y, 1, 1, col);
  }
  /** Stamps `len` pixels from (x,y) along direction (dx,dy). */
  line(x: number, y: number, dx: number, dy: number, len: number, col: string, thick = 1): this {
    const m = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < len; i++) this.r(x + (dx / m) * i, y + (dy / m) * i, thick, thick, col);
    return this;
  }
  disc(cx: number, cy: number, rad: number, col: string): this {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + rad * 0.5) this.p(cx + x, cy + y, col);
    return this;
  }
  /** Copy of this sprite rotated about its bottom centre, optionally darkened (used for death frames). */
  rotated(deg: number, dark = 0, dx = 0, dy = 0): Pix {
    const W = Math.max(this.w, this.h) + 6; // wider canvas so a fallen sprite is not clipped
    const out = new Pix(W, this.h);
    const g = out.g;
    g.imageSmoothingEnabled = false;
    g.translate(W / 2 + dx, this.h + dy);
    g.rotate((-deg * Math.PI) / 180); // fall backwards
    g.drawImage(this.c, -this.w / 2, -this.h);
    if (dark > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = `rgba(10,5,5,${dark})`;
      g.fillRect(0, 0, W, this.h);
    }
    return out;
  }
}

export const hash = (n: number): number => {
  let x = (n | 0) * 374761393 + 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
