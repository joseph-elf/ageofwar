import { buildBases } from './bases';
import { buildBackground, buildGround } from './backgrounds';
import { buildIcons } from './icons';
import { buildMisc } from './misc';
import { buildTurretFrames } from './turrets';
import { buildUnitFrames } from './units';
import type { Pix } from './pixel';

/** All procedurally drawn art, keyed by Phaser texture key. Built once at boot. */
export const ART = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();

let built = false;
export function buildAllArt(onStep?: (label: string) => void): void {
  if (built) return;
  built = true;
  const put = (m: Map<string, Pix>) => m.forEach((p, k) => ART.set(k, p.c));
  onStep?.('units');
  put(buildUnitFrames());
  onStep?.('turrets');
  put(buildTurretFrames());
  onStep?.('bases');
  put(buildBases());
  onStep?.('effects');
  put(buildMisc());
  put(buildIcons());
  onStep?.('worlds');
  for (let age = 0; age < 5; age++) {
    const l = buildBackground(age);
    ART.set(`bg:${age}:sky`, l.sky.c);
    ART.set(`bg:${age}:far`, l.far.c);
    ART.set(`bg:${age}:mid`, l.mid.c);
    ART.set(`ground:${age}`, buildGround(age).c);
  }
}

/** data: URL for DOM <img> usage (HUD icons). */
export function artUrl(key: string): string {
  let u = urls.get(key);
  if (!u) {
    const c = ART.get(key);
    u = c ? c.toDataURL() : '';
    urls.set(key, u);
  }
  return u;
}

export const unitIcon = (id: string) => artUrl(`unit:${id}:walk:0`);
export const turretIcon = (id: string) => artUrl(`turret:${id}:0`);
