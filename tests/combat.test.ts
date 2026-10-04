import { describe, expect, it } from 'vitest';
import { addUnit, newGame, run } from './helpers';
import { UNITS } from '../src/data/units';
import { baseFront } from '../src/sim/state';
import { applyCommand } from '../src/sim/commands';

describe('combat', () => {
  it('units walk toward the enemy', () => {
    const s = newGame();
    const u = addUnit(s, 0, 'bonebasher', 500);
    run(s, 30);
    expect(u.x).toBeGreaterThan(500 + UNITS.bonebasher.speed * 0.9);
  });

  it('opposing melee units fight and the stronger one survives', () => {
    const s = newGame();
    const a = addUnit(s, 0, 'pikeman', 1000);
    const b = addUnit(s, 1, 'bonebasher', 1060);
    run(s, 300);
    expect(s.units.find((u) => u.id === b.id)).toBeUndefined();
    expect(a.hp).toBeGreaterThan(0);
  });

  it('allies queue behind each other instead of overlapping', () => {
    const s = newGame();
    const front = addUnit(s, 0, 'tuskrider', 1200);
    front.cd = 99999;
    const back = addUnit(s, 0, 'bonebasher', 1100);
    // block the front unit by an unkillable-ish enemy so it stands still
    const enemy = addUnit(s, 1, 'tuskrider', 1230);
    enemy.hp = 1e9;
    run(s, 120);
    expect(back.x).toBeLessThan(front.x);
    expect(front.x - back.x).toBeGreaterThan(30);
    expect(back.mode).toBe('wait');
  });

  it('a melee unit stuck behind an ally cannot hit the enemy, but a ranged one can', () => {
    const s = newGame();
    const tank = addUnit(s, 0, 'tuskrider', 1000);
    const enemy = addUnit(s, 1, 'tuskrider', 1040);
    enemy.hp = 1e9;
    tank.cd = 1e9;
    const melee = addUnit(s, 0, 'bonebasher', 960);
    const ranged = addUnit(s, 0, 'pebbler', 940);
    const before = enemy.hp;
    run(s, 90);
    expect(melee.mode).toBe('wait');
    expect(before - enemy.hp).toBeGreaterThan(0); // only ranged damage
    expect(ranged.lastAtk).toBeGreaterThan(0);
    expect(melee.lastAtk).toBeLessThan(0);
  });

  it('damage is varied but bounded, and specials do not always land', () => {
    const s = newGame(3);
    const e = addUnit(s, 1, 'tuskrider', 1000);
    e.hp = e.cd = 1e9;
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const a = addUnit(s, 0, 'bonebasher', 975);
      const before = e.hp;
      a.cd = 0;
      run(s, 1);
      if (e.hp < before) seen.add(Math.round(before - e.hp));
      s.units = s.units.filter((u) => u === e);
    }
    expect(seen.size).toBeGreaterThan(3);
    for (const d of seen) expect(d).toBeLessThanOrEqual(Math.ceil(UNITS.bonebasher.damage * 1.2 * 1.4 * 1.8) + 1);
  });

  it('last stand refreshes the special once when the base is nearly dead', () => {
    const s = newGame();
    const p = s.players[1];
    p.baseHp = p.baseMaxHp * 0.26;
    p.specialCd = 9999;
    addUnit(s, 0, 'tuskrider', baseFront(1) - 20);
    run(s, 60);
    expect(p.lastStand).toBe(true);
    expect(p.specialCd).toBeLessThan(9999 - 30);
  });

  it('units attack the enemy base when no unit is in range', () => {
    const s = newGame();
    addUnit(s, 0, 'bonebasher', baseFront(1) - 20);
    const hp = s.players[1].baseHp;
    run(s, 40);
    expect(s.players[1].baseHp).toBeLessThan(hp);
  });

  it('ranged units hit the base through projectiles', () => {
    const s = newGame();
    addUnit(s, 0, 'pebbler', baseFront(1) - 100);
    const hp = s.players[1].baseHp;
    run(s, 80);
    expect(s.players[1].baseHp).toBeLessThan(hp);
  });

  it('reaching 0 base HP ends the game', () => {
    const s = newGame();
    s.players[1].baseHp = 5;
    addUnit(s, 0, 'bonebasher', baseFront(1) - 20);
    run(s, 60);
    expect(s.winner).toBe(0);
  });

  it('turrets shoot enemies in range and splash hits several units', () => {
    const s = newGame();
    s.players[0].gold = 1000;
    expect(applyCommand(s, 0, { type: 'BUY_TURRET', slot: 0, turret: 'boulderthrower' }).ok).toBe(true);
    const a = addUnit(s, 1, 'tuskrider', baseFront(0) + 200);
    const b = addUnit(s, 1, 'tuskrider', baseFront(0) + 230);
    a.cd = b.cd = 1e9;
    run(s, 200);
    expect(a.hp).toBeLessThan(UNITS.tuskrider.hp);
    expect(b.hp).toBeLessThan(UNITS.tuskrider.hp);
  });

  it('special damages enemy units but never the base', () => {
    const s = newGame();
    const e = addUnit(s, 1, 'tuskrider', 1200);
    e.cd = 1e9;
    expect(applyCommand(s, 0, { type: 'USE_SPECIAL' }).ok).toBe(true);
    const baseHp = s.players[1].baseHp;
    run(s, 30 * 6);
    expect(e.hp).toBeLessThan(UNITS.tuskrider.hp);
    expect(s.players[1].baseHp).toBe(baseHp);
  });
});
