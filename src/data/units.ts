import { gap, int } from './tune';
import { BOUNTY_MULT, COST_MULT, KILL_GOLD_MULT, TRAIN_TIME_MULT, UNIT_DAMAGE_MULT, UNIT_HP_MULT, UNIT_RANGE_MULT, UNIT_SPEED_MULT } from './tuning';
export type Role = 'melee' | 'ranged' | 'heavy' | 'super' | 'support' | 'siege';
export type ProjKind = 'rock' | 'spear' | 'arrow' | 'bolt' | 'ball' | 'bullet' | 'shell' | 'rocket' | 'laser' | 'plasma' | 'tar' | 'oil' | 'chain' | 'grenade' | 'gas' | 'stasis' | 'ion';

export interface UnitDef {
  id: string;
  name: string;
  age: number;
  role: Role;
  desc: string;
  cost: number;
  hp: number;
  damage: number;
  attackInterval: number; // seconds
  range: number; // world px (centre to centre)
  speed: number; // px/s
  trainTime: number; // seconds
  gold: number; // bounty paid to the killer's owner
  xp: number; // XP bounty
  width: number; // body width used for queueing spacing
  proj?: { kind: ProjKind; speed: number; splash?: number }; // present => ranged attack with projectile
  /** Damage multiplier against targets of a given role (missing = 1). The counter system: pikes beat horses, etc. */
  bonus?: Partial<Record<Role, number>>;
  /** Multiplier on damage dealt to the enemy base (siege units). */
  baseMult?: number;
  /** Support units: every `interval` s, heal the most injured ally within `range` by `amount` hp. */
  heal?: { amount: number; interval: number; range: number };
}

const u = (d: UnitDef): UnitDef => d;


const RAW_UNITS: Record<string, UnitDef> = {
  // ---- Stone Age
  bonebasher: u({ id: 'bonebasher', name: 'Bonebasher', age: 0, role: 'melee', desc: 'Cheap brawler with a bone club.', cost: 15, hp: 55, damage: 7, attackInterval: 0.8, range: 30, speed: 52, trainTime: 2.5, gold: 20, xp: 12, width: 30 }),
  pebbler: u({ id: 'pebbler', name: 'Pebbler', age: 0, role: 'ranged', desc: 'Hurls stones from behind the line.', cost: 25, hp: 38, damage: 6, attackInterval: 1.1, range: 150, speed: 50, trainTime: 3, gold: 32, xp: 20, width: 30, proj: { kind: 'rock', speed: 360 } }),
  shaman: u({ id: 'shaman', name: 'Shaman', age: 0, role: 'support', desc: 'Heals the most wounded ally nearby. Fights poorly.', cost: 40, hp: 48, damage: 3, attackInterval: 1.2, range: 30, speed: 48, trainTime: 3.5, gold: 52, xp: 32, width: 26, heal: { amount: 11, interval: 1.4, range: 150 } }),
  tuskrider: u({ id: 'tuskrider', name: 'Tuskrider', age: 0, role: 'heavy', desc: 'A hunter riding a charging boar.', cost: 100, hp: 260, damage: 14, attackInterval: 1.0, range: 36, speed: 44, trainTime: 6, gold: 130, xp: 80, width: 56 }),
  // ---- Medieval
  pikeman: u({ id: 'pikeman', name: 'Pikeman', age: 1, role: 'melee', desc: 'Long reach, sturdy armour. Strong vs cavalry.', cost: 45, hp: 135, damage: 13, attackInterval: 0.8, range: 36, speed: 50, trainTime: 3, gold: 60, xp: 36, width: 30, bonus: { heavy: 1.75, siege: 1.5 } }),
  crossbower: u({ id: 'crossbower', name: 'Crossbower', age: 1, role: 'ranged', desc: 'Slow but hard-hitting bolts.', cost: 75, hp: 85, damage: 14, attackInterval: 1.2, range: 180, speed: 48, trainTime: 3.5, gold: 98, xp: 60, width: 30, proj: { kind: 'bolt', speed: 520 } }),
  ram: u({ id: 'ram', name: 'Battering Ram', age: 1, role: 'siege', desc: 'Weak in a fight, but smashes bases (x5 damage).', cost: 240, hp: 950, damage: 18, attackInterval: 1.8, range: 40, speed: 36, trainTime: 8, gold: 312, xp: 190, width: 56, baseMult: 5 }),
  lancer: u({ id: 'lancer', name: 'Lancer', age: 1, role: 'heavy', desc: 'Armoured horseman. Tough as nails.', cost: 260, hp: 620, damage: 28, attackInterval: 1.0, range: 44, speed: 52, trainTime: 7, gold: 340, xp: 210, width: 58 }),
  // ---- Renaissance
  sabreman: u({ id: 'sabreman', name: 'Sabreman', age: 2, role: 'melee', desc: 'Fast duellist with a curved sabre.', cost: 120, hp: 290, damage: 26, attackInterval: 0.75, range: 34, speed: 58, trainTime: 3, gold: 156, xp: 96, width: 30 }),
  flintlocker: u({ id: 'flintlocker', name: 'Flintlocker', age: 2, role: 'ranged', desc: 'Powder and lead from long range.', cost: 190, hp: 190, damage: 32, attackInterval: 1.4, range: 215, speed: 48, trainTime: 3.5, gold: 250, xp: 152, width: 30, proj: { kind: 'bullet', speed: 700 } }),
  grenadier: u({ id: 'grenadier', name: 'Grenadier', age: 2, role: 'ranged', desc: 'Lobs bombs that hurt whole groups.', cost: 230, hp: 175, damage: 30, attackInterval: 2.0, range: 165, speed: 46, trainTime: 4, gold: 300, xp: 182, width: 30, proj: { kind: 'grenade', speed: 380, splash: 55 } }),
  cuirassier: u({ id: 'cuirassier', name: 'Cuirassier', age: 2, role: 'heavy', desc: 'Breastplate, horse, pistols and spite.', cost: 640, hp: 1250, damage: 55, attackInterval: 1.2, range: 44, speed: 54, trainTime: 8, gold: 830, xp: 510, width: 58 }),
  // ---- Modern
  breacher: u({ id: 'breacher', name: 'Breacher', age: 3, role: 'melee', desc: 'Close-quarters shotgun trooper.', cost: 320, hp: 560, damage: 46, attackInterval: 0.7, range: 70, speed: 56, trainTime: 3, gold: 416, xp: 256, width: 30 }),
  marksman: u({ id: 'marksman', name: 'Marksman', age: 3, role: 'ranged', desc: 'Precision rifle, deadly at range.', cost: 440, hp: 360, damage: 58, attackInterval: 1.0, range: 250, speed: 50, trainTime: 3.5, gold: 572, xp: 352, width: 30, proj: { kind: 'bullet', speed: 900 } }),
  medic: u({ id: 'medic', name: 'Field Medic', age: 3, role: 'support', desc: 'Patches up the most wounded ally nearby.', cost: 850, hp: 500, damage: 26, attackInterval: 1.2, range: 30, speed: 50, trainTime: 3.5, gold: 1100, xp: 680, width: 30, heal: { amount: 110, interval: 1.4, range: 170 } }),
  crawler: u({ id: 'crawler', name: 'Crawler Tank', age: 3, role: 'heavy', desc: 'Armoured tracks, shell cannon.', bonus: { siege: 1.5 }, cost: 1500, hp: 2700, damage: 100, attackInterval: 1.5, range: 210, speed: 42, trainTime: 9, gold: 1950, xp: 1200, width: 64, proj: { kind: 'shell', speed: 620, splash: 40 } }),
  // ---- Future
  plasmalancer: u({ id: 'plasmalancer', name: 'Plasma Lancer', age: 4, role: 'melee', desc: 'Energy blade, kinetic shield.', cost: 750, hp: 1200, damage: 90, attackInterval: 0.7, range: 40, speed: 62, trainTime: 3, gold: 975, xp: 600, width: 30 }),
  lasergunner: u({ id: 'lasergunner', name: 'Laser Gunner', age: 4, role: 'ranged', desc: 'Light-speed rifle, ignores clutter.', cost: 1000, hp: 780, damage: 105, attackInterval: 1.0, range: 270, speed: 52, trainTime: 3.5, gold: 1300, xp: 800, width: 30, proj: { kind: 'laser', speed: 1400 } }),
  striderMech: u({ id: 'striderMech', name: 'Strider Mech', age: 4, role: 'heavy', desc: 'Bipedal walker with twin cannons.', cost: 3200, hp: 5800, damage: 180, attackInterval: 1.5, range: 230, speed: 46, trainTime: 9, gold: 4160, xp: 2560, width: 64, proj: { kind: 'plasma', speed: 700, splash: 50 } }),
  disruptor: u({ id: 'disruptor', name: 'Ion Disruptor', age: 4, role: 'ranged', desc: 'Anti-armour cannon: shreds mechs and the Colossus, weak vs infantry.', cost: 1400, hp: 900, damage: 110, attackInterval: 1.6, range: 235, speed: 46, trainTime: 5, gold: 1820, xp: 1120, width: 30, proj: { kind: 'ion', speed: 1200 }, bonus: { heavy: 2.5, super: 3.5, siege: 2.5, melee: 0.5, ranged: 0.5, support: 0.5 } }),
  titan: u({ id: 'titan', name: 'Colossus Titan', age: 4, role: 'super', desc: 'Elite war-machine that crushes armies (half damage vs bases). One at a time. Ion Disruptors and Rail Cannons are its bane.', baseMult: 0.5, cost: 12000, hp: 21000, damage: 420, attackInterval: 1.6, range: 250, speed: 36, trainTime: 18, gold: 9000, xp: 7600, width: 84, proj: { kind: 'plasma', speed: 760, splash: 90 } }),
};

// ---- Tuning: compress age gaps (AGE_GAP) and apply global multipliers (tuning.ts) -----------------------------------
const REF: Record<string, string> = { melee: 'bonebasher', ranged: 'pebbler', heavy: 'tuskrider', support: 'shaman' };
type Scaled = 'cost' | 'hp' | 'damage' | 'gold' | 'xp';
const SCALED: Scaled[] = ['cost', 'hp', 'damage', 'gold', 'xp'];

function tuneOne(d: UnitDef, scale: (k: Scaled) => number): UnitDef {
  return {
    ...d,
    cost: int(scale('cost') * COST_MULT),
    hp: int(scale('hp') * UNIT_HP_MULT),
    damage: int(scale('damage') * UNIT_DAMAGE_MULT),
    gold: int(scale('gold') * BOUNTY_MULT * KILL_GOLD_MULT),
    xp: int(scale('xp') * BOUNTY_MULT),
    speed: d.speed * UNIT_SPEED_MULT,
    range: Math.round(d.range * UNIT_RANGE_MULT),
    trainTime: d.trainTime * TRAIN_TIME_MULT,
    // Heals grow with the age like hp does.
    heal: d.heal && { ...d.heal, amount: int(d.heal.amount * (scale('hp') / d.hp) * UNIT_HP_MULT) },
  };
}

export const UNITS: Record<string, UnitDef> = {};
for (const d of Object.values(RAW_UNITS)) {
  if (!REF[d.role]) continue;
  const ref = RAW_UNITS[REF[d.role]];
  UNITS[d.id] = tuneOne(d, (k) => gap(d[k], ref[k]));
}
// Roles without a Stone-Age reference (elite, siege) keep their raw ratio to the heavy of their age, on top of that unit's tuned stats.
for (const d of Object.values(RAW_UNITS)) {
  if (REF[d.role]) continue;
  const heavy = Object.values(RAW_UNITS).find((x) => x.age === d.age && x.role === 'heavy')!;
  const tunedHeavy = UNITS[heavy.id];
  UNITS[d.id] = tuneOne(d, (k) => (tunedHeavy[k] / (k === 'cost' ? COST_MULT : k === 'hp' ? UNIT_HP_MULT : k === 'damage' ? UNIT_DAMAGE_MULT : k === 'gold' ? BOUNTY_MULT * KILL_GOLD_MULT : BOUNTY_MULT)) * (d[k] / heavy[k]));
}
void SCALED;
