import { gap, int } from './tune';
import { BASE_HP_MULT, EVOLVE_XP_MULT } from './tuning';
export interface AgeDef {
  id: string;
  name: string;
  /** XP needed to evolve INTO the next age (consumed). 0 for the last age. */
  evolveXp: number;
  baseHp: number;
  units: string[]; // trainable unit ids, in hotkey order (1..n)
  turrets: string[]; // buildable turret ids, in hotkey order (Q/W/E)
  special: string;
}

const RAW_AGES: AgeDef[] = [
  { id: 'stone', name: 'Stone Age', evolveXp: 260, baseHp: 1500, units: ['bonebasher', 'pebbler', 'tuskrider'], turrets: ['slingpost', 'spearcaster', 'boulderthrower'], special: 'meteors' },
  { id: 'medieval', name: 'Medieval Age', evolveXp: 950, baseHp: 2400, units: ['pikeman', 'crossbower', 'lancer'], turrets: ['crossbownest', 'ballista', 'trebuchet'], special: 'volley' },
  { id: 'renaissance', name: 'Renaissance', evolveXp: 3000, baseHp: 3600, units: ['sabreman', 'flintlocker', 'cuirassier'], turrets: ['musketrack', 'culverin', 'mortar'], special: 'barrage' },
  { id: 'modern', name: 'Modern Age', evolveXp: 8500, baseHp: 5200, units: ['breacher', 'marksman', 'crawler'], turrets: ['mgnest', 'autocannon', 'rocketpod'], special: 'airstrike' },
  { id: 'future', name: 'Future Age', evolveXp: 0, baseHp: 8000, units: ['plasmalancer', 'lasergunner', 'striderMech', 'titan'], turrets: ['pulsetower', 'railgun', 'plasmamortar'], special: 'laser' },
];

export const AGES: AgeDef[] = RAW_AGES.map((a) => ({
  ...a,
  baseHp: int(gap(a.baseHp, RAW_AGES[0].baseHp) * BASE_HP_MULT),
  evolveXp: a.evolveXp > 0 ? int(gap(a.evolveXp, RAW_AGES[0].evolveXp) * EVOLVE_XP_MULT) : 0,
}));
export const LAST_AGE = AGES.length - 1;
