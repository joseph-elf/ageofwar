import { gap, int } from './tune';
import { COST_MULT, TURRET_DAMAGE_MULT, TURRET_RANGE_MULT } from './tuning';
import type { ProjKind } from './units';

export interface TurretDef {
  id: string;
  name: string;
  age: number;
  desc: string;
  cost: number;
  damage: number;
  fireInterval: number; // seconds
  range: number; // from the base front edge
  proj: { kind: ProjKind; speed: number; splash?: number };
}
const t = (d: TurretDef): TurretDef => d;

const RAW_TURRETS: Record<string, TurretDef> = {
  // Stone
  slingpost: t({ id: 'slingpost', name: 'Sling Post', age: 0, desc: 'Cheap and cheerful.', cost: 100, damage: 7, fireInterval: 0.9, range: 250, proj: { kind: 'rock', speed: 400 } }),
  spearcaster: t({ id: 'spearcaster', name: 'Spear Caster', age: 0, desc: 'Heavy throws, slow reload.', cost: 220, damage: 22, fireInterval: 1.6, range: 290, proj: { kind: 'spear', speed: 520 } }),
  boulderthrower: t({ id: 'boulderthrower', name: 'Boulder Thrower', age: 0, desc: 'Area damage.', cost: 450, damage: 34, fireInterval: 2.6, range: 340, proj: { kind: 'rock', speed: 340, splash: 55 } }),
  // Medieval
  crossbownest: t({ id: 'crossbownest', name: 'Crossbow Nest', age: 1, desc: 'Reliable bolts.', cost: 320, damage: 22, fireInterval: 0.9, range: 290, proj: { kind: 'bolt', speed: 560 } }),
  ballista: t({ id: 'ballista', name: 'Ballista', age: 1, desc: 'Armour-piercing bolts.', cost: 650, damage: 62, fireInterval: 1.7, range: 350, proj: { kind: 'bolt', speed: 700 } }),
  trebuchet: t({ id: 'trebuchet', name: 'Trebuchet', age: 1, desc: 'Lobs huge area stones.', cost: 1150, damage: 90, fireInterval: 3.0, range: 410, proj: { kind: 'rock', speed: 380, splash: 65 } }),
  // Renaissance
  musketrack: t({ id: 'musketrack', name: 'Musket Rack', age: 2, desc: 'A row of muskets.', cost: 850, damage: 36, fireInterval: 0.9, range: 320, proj: { kind: 'bullet', speed: 780 } }),
  culverin: t({ id: 'culverin', name: 'Culverin', age: 2, desc: 'Iron ball cannon.', cost: 1600, damage: 100, fireInterval: 1.8, range: 380, proj: { kind: 'ball', speed: 640 } }),
  mortar: t({ id: 'mortar', name: 'Mortar', age: 2, desc: 'Explosive area shells.', cost: 2900, damage: 145, fireInterval: 3.0, range: 430, proj: { kind: 'shell', speed: 500, splash: 75 } }),
  // Modern
  mgnest: t({ id: 'mgnest', name: 'MG Nest', age: 3, desc: 'Streams of bullets.', cost: 2300, damage: 22, fireInterval: 0.25, range: 340, proj: { kind: 'bullet', speed: 1000 } }),
  autocannon: t({ id: 'autocannon', name: 'Autocannon', age: 3, desc: 'Rapid heavy rounds.', cost: 4300, damage: 80, fireInterval: 0.9, range: 400, proj: { kind: 'shell', speed: 900 } }),
  rocketpod: t({ id: 'rocketpod', name: 'Rocket Pod', age: 3, desc: 'Guided rockets, area blast.', cost: 7200, damage: 180, fireInterval: 2.4, range: 460, proj: { kind: 'rocket', speed: 640, splash: 80 } }),
  // Future
  pulsetower: t({ id: 'pulsetower', name: 'Pulse Tower', age: 4, desc: 'Rapid energy pulses.', cost: 6000, damage: 60, fireInterval: 0.35, range: 380, proj: { kind: 'laser', speed: 1500 } }),
  railgun: t({ id: 'railgun', name: 'Rail Cannon', age: 4, desc: 'One shot, one kill.', cost: 10500, damage: 420, fireInterval: 2.0, range: 480, proj: { kind: 'laser', speed: 2200 } }),
  plasmamortar: t({ id: 'plasmamortar', name: 'Plasma Mortar', age: 4, desc: 'Wide plasma blasts.', cost: 16000, damage: 380, fireInterval: 2.8, range: 500, proj: { kind: 'plasma', speed: 560, splash: 100 } }),
};

// ---- Tuning: each turret is compared with the Stone-Age turret in the same slot (cheap / mid / splash) ----------------
const raws = Object.values(RAW_TURRETS);
export const TURRETS: Record<string, TurretDef> = {};
raws.forEach((d, i) => {
  const ref = raws[i % 3];
  TURRETS[d.id] = {
    ...d,
    cost: int(gap(d.cost, ref.cost) * COST_MULT),
    damage: int(gap(d.damage, ref.damage) * TURRET_DAMAGE_MULT),
    range: Math.round(d.range * TURRET_RANGE_MULT),
  };
});
