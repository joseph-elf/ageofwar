import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { UNITS } from '../src/data/units';
import type { GameState, Side, Unit } from '../src/sim/types';

export const newGame = (seed = 1) => createGame({ seed });
export const run = (s: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(s);
};
export function addUnit(s: GameState, owner: Side, def: string, x: number): Unit {
  const u: Unit = { id: s.nextId++, owner, def, x, hp: UNITS[def].hp, cd: 0, mode: 'walk', lastAtk: -999 };
  s.units.push(u);
  return u;
}
