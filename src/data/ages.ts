import { gap, int } from './tune';
import { BASE_HP_MULT, EVOLVE_XP_MULT } from './tuning';
export interface AgeDef {
  id: string;
  name: string;
  /** XP needed to evolve INTO the next age (consumed). 0 for the last age. */
  evolveXp: number;
  baseHp: number;
  units: string[]; // trainable unit ids, in hotkey order (1..n)
  turrets: string[]; // buildable turret ids, in hotkey order (Q/W/E/R)
  special: string;
}

const RAW_AGES: AgeDef[] = [
  { id: 'stone', name: 'Stone Age', evolveXp: 260, baseHp: 1500, units: ['bonebasher', 'pebbler', 'tuskrider', 'shaman'], turrets: ['slingpost', 'spearcaster', 'boulderthrower', 'tarpot'], special: 'meteors' },
  { id: 'medieval', name: 'Medieval Age', evolveXp: 950, baseHp: 2400, units: ['pikeman', 'crossbower', 'lancer', 'ram'], turrets: ['crossbownest', 'ballista', 'trebuchet', 'oilcauldron'], special: 'volley' },
  { id: 'renaissance', name: 'Renaissance', evolveXp: 3000, baseHp: 3600, units: ['sabreman', 'flintlocker', 'cuirassier', 'grenadier'], turrets: ['musketrack', 'culverin', 'mortar', 'chainshot'], special: 'barrage' },
  { id: 'modern', name: 'Modern Age', evolveXp: 8500, baseHp: 5200, units: ['breacher', 'marksman', 'crawler', 'medic'], turrets: ['mgnest', 'autocannon', 'rocketpod', 'gaslauncher'], special: 'airstrike' },
  { id: 'future', name: 'Future Age', evolveXp: 0, baseHp: 8000, units: ['plasmalancer', 'lasergunner', 'striderMech', 'disruptor', 'titan'], turrets: ['pulsetower', 'railgun', 'plasmamortar', 'stasis'], special: 'laser' },
];

export const AGES: AgeDef[] = RAW_AGES.map((a) => ({
  ...a,
  baseHp: int(gap(a.baseHp, RAW_AGES[0].baseHp) * BASE_HP_MULT),
  evolveXp: a.evolveXp > 0 ? int(gap(a.evolveXp, RAW_AGES[0].evolveXp) * EVOLVE_XP_MULT) : 0,
}));
export const LAST_AGE = AGES.length - 1;

/** 'classic' = the original three units / three turrets per age; 'extended' adds the newer units and slowing turrets. */
export type Roster = 'classic' | 'extended';
const EXTENDED_ONLY = new Set(['shaman', 'ram', 'grenadier', 'medic', 'disruptor', 'tarpot', 'oilcauldron', 'chainshot', 'gaslauncher', 'stasis']);
export const unitsOf = (age: AgeDef, roster: Roster = 'extended'): string[] => (roster === 'classic' ? age.units.filter((id) => !EXTENDED_ONLY.has(id)) : age.units);
export const turretsOf = (age: AgeDef, roster: Roster = 'extended'): string[] => (roster === 'classic' ? age.turrets.filter((id) => !EXTENDED_ONLY.has(id)) : age.turrets);
