import { gap, int } from './tune';
import { COST_MULT, TURRET_DAMAGE_MULT, TURRET_RANGE_MULT } from './tuning';
import type { ProjKind, Role } from './units';

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
  /** Damage multiplier against targets of a given role (missing = 1). */
  bonus?: Partial<Record<Role, number>>;
  /** Everything hit moves at `factor` speed (and attacks a bit slower) for `duration` seconds. */
  slow?: { factor: number; duration: number };
}
const t = (d: TurretDef): TurretDef => d;

const RAW_TURRETS: Record<string, TurretDef> = {
  // Stone
  slingpost: t({ id: 'slingpost', name: 'Sling Post', age: 0, desc: 'Cheap and cheerful.', cost: 100, damage: 7, fireInterval: 0.9, range: 250, proj: { kind: 'rock', speed: 400 } }),
  spearcaster: t({ id: 'spearcaster', name: 'Spear Caster', age: 0, desc: 'Heavy throws, slow reload.', cost: 220, damage: 22, fireInterval: 1.6, range: 290, proj: { kind: 'spear', speed: 520 } }),
  boulderthrower: t({ id: 'boulderthrower', name: 'Boulder Thrower', age: 0, desc: 'Area damage.', cost: 450, damage: 34, fireInterval: 2.6, range: 340, proj: { kind: 'rock', speed: 340, splash: 55 } }),
  tarpot: t({ id: 'tarpot', name: 'Tar Pot', age: 0, desc: 'Flings sticky tar: slows a whole group.', cost: 160, damage: 12, fireInterval: 2.2, range: 280, proj: { kind: 'tar', speed: 320, splash: 60 }, slow: { factor: 0.5, duration: 2.5 } }),
  // Medieval
  crossbownest: t({ id: 'crossbownest', name: 'Crossbow Nest', age: 1, desc: 'Reliable bolts.', cost: 320, damage: 22, fireInterval: 0.9, range: 290, proj: { kind: 'bolt', speed: 560 } }),
  ballista: t({ id: 'ballista', name: 'Ballista', age: 1, desc: 'Armour-piercing bolts: x2 vs cavalry, rams and machines.', bonus: { heavy: 2, super: 2, siege: 2 }, cost: 650, damage: 62, fireInterval: 1.7, range: 350, proj: { kind: 'bolt', speed: 700 } }),
  trebuchet: t({ id: 'trebuchet', name: 'Trebuchet', age: 1, desc: 'Lobs huge area stones.', cost: 1150, damage: 90, fireInterval: 3.0, range: 410, proj: { kind: 'rock', speed: 380, splash: 65 } }),
  oilcauldron: t({ id: 'oilcauldron', name: 'Boiling Oil', age: 1, desc: 'Short range. Scalds and slows everything at the gate.', cost: 480, damage: 48, fireInterval: 2.4, range: 220, proj: { kind: 'oil', speed: 300, splash: 75 }, slow: { factor: 0.5, duration: 2.5 } }),
  // Renaissance
  musketrack: t({ id: 'musketrack', name: 'Musket Rack', age: 2, desc: 'A row of muskets.', cost: 850, damage: 36, fireInterval: 0.9, range: 320, proj: { kind: 'bullet', speed: 780 } }),
  culverin: t({ id: 'culverin', name: 'Culverin', age: 2, desc: 'Iron ball cannon: x2 vs heavy targets.', bonus: { heavy: 2, super: 2, siege: 2 }, cost: 1600, damage: 100, fireInterval: 1.8, range: 380, proj: { kind: 'ball', speed: 640 } }),
  mortar: t({ id: 'mortar', name: 'Mortar', age: 2, desc: 'Explosive area shells.', cost: 2900, damage: 145, fireInterval: 3.0, range: 430, proj: { kind: 'shell', speed: 500, splash: 75 } }),
  chainshot: t({ id: 'chainshot', name: 'Chain-Shot Gun', age: 2, desc: 'Chained balls tangle legs and wheels: slows.', cost: 1200, damage: 90, fireInterval: 2.0, range: 340, proj: { kind: 'chain', speed: 600, splash: 45 }, slow: { factor: 0.45, duration: 2.5 } }),
  // Modern
  mgnest: t({ id: 'mgnest', name: 'MG Nest', age: 3, desc: 'Streams of bullets.', cost: 2300, damage: 22, fireInterval: 0.25, range: 340, proj: { kind: 'bullet', speed: 1000 } }),
  autocannon: t({ id: 'autocannon', name: 'Autocannon', age: 3, desc: 'Rapid heavy rounds: x2 vs armour.', bonus: { heavy: 2, super: 2, siege: 2 }, cost: 4300, damage: 80, fireInterval: 0.9, range: 400, proj: { kind: 'shell', speed: 900 } }),
  rocketpod: t({ id: 'rocketpod', name: 'Rocket Pod', age: 3, desc: 'Guided rockets, area blast.', cost: 7200, damage: 180, fireInterval: 2.4, range: 460, proj: { kind: 'rocket', speed: 640, splash: 80 } }),
  gaslauncher: t({ id: 'gaslauncher', name: 'Gas Launcher', age: 3, desc: 'Choking gas clouds: wide slow.', cost: 3200, damage: 130, fireInterval: 2.2, range: 380, proj: { kind: 'gas', speed: 450, splash: 90 }, slow: { factor: 0.45, duration: 3 } }),
  // Future
  pulsetower: t({ id: 'pulsetower', name: 'Pulse Tower', age: 4, desc: 'Rapid energy pulses.', cost: 6000, damage: 60, fireInterval: 0.35, range: 380, proj: { kind: 'laser', speed: 1500 } }),
  railgun: t({ id: 'railgun', name: 'Rail Cannon', age: 4, desc: 'One shot, one kill: x2.5 vs mechs and the Colossus.', bonus: { heavy: 2, super: 2.5, siege: 2 }, cost: 10500, damage: 420, fireInterval: 2.0, range: 480, proj: { kind: 'laser', speed: 2200 } }),
  plasmamortar: t({ id: 'plasmamortar', name: 'Plasma Mortar', age: 4, desc: 'Wide plasma blasts.', cost: 16000, damage: 380, fireInterval: 2.8, range: 500, proj: { kind: 'plasma', speed: 560, splash: 100 } }),
  stasis: t({ id: 'stasis', name: 'Stasis Projector', age: 4, desc: 'Freezes groups in a time field: strong slow.', cost: 8000, damage: 260, fireInterval: 2.4, range: 420, proj: { kind: 'stasis', speed: 700, splash: 90 }, slow: { factor: 0.35, duration: 3 } }),
};

// ---- Tuning: each turret is compared with the Stone-Age turret in the same hotkey position (cheap / mid / splash / slow)
const raws = Object.values(RAW_TURRETS);
const stone = raws.filter((d) => d.age === 0);
export const TURRETS: Record<string, TurretDef> = {};
raws.forEach((d) => {
  const ref = stone[raws.filter((x) => x.age === d.age).indexOf(d)];
  TURRETS[d.id] = {
    ...d,
    cost: int(gap(d.cost, ref.cost) * COST_MULT),
    damage: int(gap(d.damage, ref.damage) * TURRET_DAMAGE_MULT),
    range: Math.round(d.range * TURRET_RANGE_MULT),
  };
});
