import { describe, expect, it } from 'vitest';
import { addUnit, newGame, run } from './helpers';
import { MINE_COSTS, SUDDEN_DEATH_AFTER_SEC, TICK_RATE, TURRET_AGE_UPGRADE } from '../src/data/config';
import { UNITS } from '../src/data/units';
import { applyCommand } from '../src/sim/commands';
import { baseFront, createGame } from '../src/sim/state';
import { drainEvents, step } from '../src/sim/step';
import type { GameState, SimEvent } from '../src/sim/types';

const runEvents = (s: GameState, ticks: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(s);
    out.push(...drainEvents(s));
  }
  return out;
};

describe('counters, siege, healing and slows', () => {
  it('pikemen deal bonus damage to cavalry', () => {
    const dealt = (target: string) => {
      const s = newGame(5);
      addUnit(s, 0, 'pikeman', 1000);
      const t = addUnit(s, 1, target, 1030);
      t.hp = t.cd = 1e9;
      run(s, 30 * 6);
      return 1e9 - t.hp;
    };
    expect(dealt('lancer') / dealt('sabreman')).toBeCloseTo(UNITS.pikeman.bonus!.heavy!, 5);
  });

  it('a battering ram hits bases far harder than it hits units', () => {
    const s = newGame();
    const ram = addUnit(s, 0, 'ram', baseFront(1) - 20);
    const hits = runEvents(s, 30 * 6).filter((e) => e.k === 'base_hit' && e.owner === 1);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.k === 'base_hit' && h.dmg).toBeGreaterThanOrEqual(UNITS.ram.damage * UNITS.ram.baseMult! * 0.75);
    expect(ram.hp).toBe(UNITS.ram.hp);
  });

  it('a shaman heals the most wounded ally in range, never above max hp', () => {
    const s = newGame();
    const shaman = addUnit(s, 0, 'shaman', 400);
    const hurt = addUnit(s, 0, 'bonebasher', 460);
    const scratched = addUnit(s, 0, 'bonebasher', 500);
    hurt.hp = 10;
    scratched.hp = UNITS.bonebasher.hp - 2;
    hurt.cd = scratched.cd = 1e9;
    const heals = runEvents(s, 3).filter((e) => e.k === 'heal');
    expect(heals.length).toBe(1);
    expect(heals[0].k === 'heal' && heals[0].id).toBe(hurt.id);
    expect(hurt.hp).toBe(10 + UNITS.shaman.heal!.amount);
    run(s, 30 * 20);
    expect(hurt.hp).toBeLessThanOrEqual(UNITS.bonebasher.hp);
    expect(scratched.hp).toBeLessThanOrEqual(UNITS.bonebasher.hp);
    expect(shaman.lastHeal).toBeGreaterThan(0);
  });

  it('slowing turrets slow what they hit', () => {
    const s = newGame();
    s.players[0].gold = 9999;
    expect(applyCommand(s, 0, { type: 'BUY_TURRET', slot: 0, turret: 'tarpot' }).ok).toBe(true);
    const u = addUnit(s, 1, 'tuskrider', baseFront(0) + 300);
    u.hp = 1e9;
    let slowedAt = -1;
    for (let i = 0; i < 30 * 6 && slowedAt < 0; i++) {
      step(s);
      if (u.slow) slowedAt = s.tick;
    }
    expect(slowedAt).toBeGreaterThan(0);
    const x0 = u.x;
    run(s, 10);
    const slowStep = Math.abs(u.x - x0) / 10;
    expect(slowStep).toBeLessThan(UNITS.tuskrider.speed / TICK_RATE * 0.6);
  });

  it('turrets gain damage for every age their owner is past them', () => {
    const firstShot = (age: number) => {
      const s = newGame(9);
      s.players[0].gold = 9999;
      applyCommand(s, 0, { type: 'BUY_TURRET', slot: 0, turret: 'slingpost' });
      s.players[0].age = age;
      const u = addUnit(s, 1, 'tuskrider', baseFront(0) + 100);
      u.cd = 1e9;
      for (let i = 0; i < 60 && !s.projectiles.length; i++) step(s);
      return s.projectiles[0].damage;
    };
    expect(firstShot(2) / firstShot(0)).toBeCloseTo(1 + 2 * TURRET_AGE_UPGRADE, 5);
  });
});

describe('economy and match flow', () => {
  it('Gold Mine levels cost gold and raise passive income', () => {
    const income = (levels: number) => {
      const s = newGame();
      s.players[0].gold = 99999;
      for (let i = 0; i < levels; i++) expect(applyCommand(s, 0, { type: 'BUY_ECON' }).ok).toBe(true);
      const g = s.players[0].gold;
      run(s, 30 * 20);
      return s.players[0].gold - g;
    };
    expect(income(2)).toBeGreaterThan(income(0) * 1.8);
    const s = newGame();
    s.players[0].gold = MINE_COSTS[0] - 1;
    expect(applyCommand(s, 0, { type: 'BUY_ECON' }).reason).toBe('not enough gold');
    s.players[0].gold = 1e9;
    for (let i = 0; i < MINE_COSTS.length; i++) applyCommand(s, 0, { type: 'BUY_ECON' });
    expect(applyCommand(s, 0, { type: 'BUY_ECON' }).reason).toBe('max mine');
  });

  it('the player behind in age earns XP faster (catch-up)', () => {
    const xpFor = (behind: boolean) => {
      const s = newGame(4);
      if (behind) s.players[1].age = 2;
      addUnit(s, 0, 'bonebasher', 1000);
      const t = addUnit(s, 1, 'tuskrider', 1030);
      t.hp = t.cd = 1e9;
      run(s, 30 * 5);
      return s.players[0].xp;
    };
    expect(xpFor(true)).toBeGreaterThan(xpFor(false) * 1.5);
  });

  it('kill bounties do not pay more than the unit cost', () => {
    for (const d of Object.values(UNITS)) expect(d.gold).toBeLessThanOrEqual(d.cost * 1.01);
  });

  it('sudden death ends a match nobody can finish', () => {
    const s = newGame();
    run(s, SUDDEN_DEATH_AFTER_SEC * TICK_RATE);
    expect(s.winner).toBeNull();
    run(s, 30 * 300);
    expect(s.winner).not.toBeNull();
  });

  it('the classic roster hides the newer units and turrets', () => {
    const classic = createGame({ seed: 1, roster: 'classic' });
    const extended = createGame({ seed: 1 });
    for (const s of [classic, extended]) s.players[0].gold = 9999;
    expect(applyCommand(classic, 0, { type: 'TRAIN_UNIT', unit: 'shaman' }).reason).toBe('unit not available');
    expect(applyCommand(classic, 0, { type: 'BUY_TURRET', slot: 0, turret: 'tarpot' }).reason).toBe('turret not available');
    expect(applyCommand(classic, 0, { type: 'TRAIN_UNIT', unit: 'bonebasher' }).ok).toBe(true);
    expect(applyCommand(extended, 0, { type: 'TRAIN_UNIT', unit: 'shaman' }).ok).toBe(true);
    expect(applyCommand(extended, 0, { type: 'BUY_TURRET', slot: 0, turret: 'tarpot' }).ok).toBe(true);
  });
});
