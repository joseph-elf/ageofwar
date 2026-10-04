import { gap, int } from './tune';
import { SPECIAL_COOLDOWN_MULT, SPECIAL_DAMAGE_MULT } from './tuning';
export interface SpecialDef {
  id: string;
  name: string;
  desc: string;
  cooldown: number; // seconds
  strikes: number; // total number of impacts
  duration: number; // seconds over which the impacts are spread
  damage: number; // per impact, per unit in radius
  radius: number;
}

const RAW_SPECIALS: Record<string, SpecialDef> = {
  meteors: { id: 'meteors', name: 'Meteor Rain', desc: 'Flaming rocks fall on enemy units.', cooldown: 55, strikes: 10, duration: 4, damage: 90, radius: 70 },
  volley: { id: 'volley', name: 'Arrow Volley', desc: 'A hail of arrows darkens the sky.', cooldown: 60, strikes: 18, duration: 3.5, damage: 140, radius: 50 },
  barrage: { id: 'barrage', name: 'Cannon Barrage', desc: 'Off-screen cannons shell the field.', cooldown: 65, strikes: 12, duration: 4, damage: 300, radius: 75 },
  airstrike: { id: 'airstrike', name: 'Airstrike', desc: 'Bombers sweep over the enemy.', cooldown: 70, strikes: 12, duration: 3, damage: 520, radius: 95 },
  laser: { id: 'laser', name: 'Orbital Laser', desc: 'A satellite sweeps the lane with a beam.', cooldown: 80, strikes: 16, duration: 4, damage: 900, radius: 65 },
};

const rawList = Object.values(RAW_SPECIALS);
export const SPECIALS: Record<string, SpecialDef> = {};
for (const d of rawList) {
  SPECIALS[d.id] = { ...d, damage: int(gap(d.damage, rawList[0].damage) * SPECIAL_DAMAGE_MULT), cooldown: d.cooldown * SPECIAL_COOLDOWN_MULT };
}
