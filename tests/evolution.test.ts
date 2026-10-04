import { describe, expect, it } from 'vitest';
import { newGame, addUnit } from './helpers';
import { AGES } from '../src/data/ages';
import { applyCommand } from '../src/sim/commands';

describe('evolution', () => {
  it('requires enough xp', () => {
    const s = newGame();
    expect(applyCommand(s, 0, { type: 'EVOLVE' })).toEqual({ ok: false, reason: 'not enough xp' });
  });

  it('consumes xp, advances the age and raises max base HP while keeping damage taken', () => {
    const s = newGame();
    s.players[0].xp = AGES[0].evolveXp + 40;
    s.players[0].baseHp -= 300;
    expect(applyCommand(s, 0, { type: 'EVOLVE' }).ok).toBe(true);
    const p = s.players[0];
    expect(p.age).toBe(1);
    expect(p.xp).toBe(40);
    expect(p.baseMaxHp).toBe(AGES[1].baseHp);
    expect(p.baseHp).toBe(AGES[1].baseHp - 300);
  });

  it('unlocks the new units and locks the old ones, but old units on the field remain', () => {
    const s = newGame();
    addUnit(s, 0, 'bonebasher', 500);
    s.players[0].xp = 9999;
    s.players[0].gold = 9999;
    applyCommand(s, 0, { type: 'EVOLVE' });
    expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'bonebasher' }).ok).toBe(false);
    expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'pikeman' }).ok).toBe(true);
    expect(s.units.filter((u) => u.def === 'bonebasher').length).toBe(1);
  });

  it('cannot evolve past the final age; the super unit is future-only', () => {
    const s = newGame();
    s.players[0].xp = 1e9;
    s.players[0].gold = 1e9;
    for (let i = 0; i < AGES.length - 1; i++) expect(applyCommand(s, 0, { type: 'EVOLVE' }).ok).toBe(true);
    expect(applyCommand(s, 0, { type: 'EVOLVE' }).ok).toBe(false);
    expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'titan' }).ok).toBe(true);
    expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'titan' }).reason).toBe('only one at a time');
    const fresh = newGame();
    fresh.players[0].gold = 1e9;
    expect(applyCommand(fresh, 0, { type: 'TRAIN_UNIT', unit: 'titan' }).ok).toBe(false);
  });
});
