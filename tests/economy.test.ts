import { describe, expect, it } from 'vitest';
import { addUnit, newGame, run } from './helpers';
import { START_GOLD, DEFENDER_XP_MULT } from '../src/data/config';
import { UNITS } from '../src/data/units';
import { applyCommand } from '../src/sim/commands';
import { createGame } from '../src/sim/state';

describe('economy', () => {
  it('starts with the configured gold', () => {
    expect(newGame().players[0].gold).toBe(START_GOLD);
  });

  it('training deducts gold immediately and spawns the unit after the train time', () => {
    const s = newGame();
    applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'bonebasher' });
    expect(s.players[0].gold).toBe(START_GOLD - UNITS.bonebasher.cost);
    run(s, 10);
    expect(s.units.length).toBe(0);
    run(s, 30 * 3);
    expect(s.units.length).toBe(1);
    expect(s.players[0].stats.trained).toBe(1);
  });

  it('killing an enemy pays gold + xp to the killer', () => {
    const s = newGame();
    const victim = addUnit(s, 1, 'bonebasher', 500);
    victim.hp = 1;
    addUnit(s, 0, 'bonebasher', 470);
    const g = s.players[0].gold;
    run(s, 5);
    expect(s.players[0].gold).toBeGreaterThanOrEqual(g + UNITS.bonebasher.gold);
    expect(s.players[0].xp).toBeGreaterThan(0);
    expect(s.players[0].stats.kills).toBe(1);
    expect(s.players[1].stats.kills).toBe(0);
  });

  it('defenders earn more xp than attackers for the same kill', () => {
    const own = newGame();
    const v1 = addUnit(own, 1, 'pikeman', 400); // inside player 0's half
    v1.hp = 1;
    addUnit(own, 0, 'bonebasher', 370);
    run(own, 3);
    const away = newGame();
    const v2 = addUnit(away, 1, 'pikeman', 2000); // inside player 1's half
    v2.hp = 1;
    addUnit(away, 0, 'bonebasher', 1970);
    run(away, 3);
    const killXp = UNITS.pikeman.xp;
    expect(own.players[0].xp).toBeGreaterThanOrEqual(killXp * DEFENDER_XP_MULT);
    expect(away.players[0].xp).toBeLessThan(killXp * DEFENDER_XP_MULT);
  });

  it('difficulty gold multiplier applies to bounties', () => {
    const s = createGame({ seed: 1, goldMult: [1, 2] });
    const v = addUnit(s, 0, 'bonebasher', 500);
    v.hp = 1;
    addUnit(s, 1, 'bonebasher', 530);
    const g = s.players[1].gold;
    run(s, 3);
    expect(s.players[1].gold).toBeGreaterThanOrEqual(g + UNITS.bonebasher.gold * 2);
  });

  it('passive income trickles in', () => {
    const s = newGame();
    run(s, 30 * 10);
    expect(s.players[0].gold).toBeGreaterThan(START_GOLD);
  });
});
