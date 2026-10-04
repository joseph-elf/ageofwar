import { describe, expect, it } from 'vitest';
import { AI } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { addUnit } from './helpers';
import { DIFFICULTY, type Difficulty } from '../src/data/config';

describe('AI', () => {
  for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
    it(`${d}: only issues valid commands, trains units and eventually evolves`, () => {
      const s = createGame({ seed: 7 });
      const ai = new AI(1, d, 3);
      let invalid = 0;
      let trained = 0;
      for (let t = 0; t < 30 * 60 * 6; t++) {
        for (const c of ai.update(s)) {
          const r = applyCommand(s, 1, c);
          if (!r.ok) invalid++;
          if (c.type === 'TRAIN_UNIT' && r.ok) trained++;
        }
        s.players[1].xp += 1; // slow xp drip so evolution can happen without a human opponent
        step(s);
        s.players[0].baseHp = 1e9; // keep the idle "human" alive
      }
      expect(invalid).toBe(0);
      expect(trained).toBeGreaterThan(5);
      expect(s.players[1].age).toBeGreaterThan(0);
    });
  }

  it('uses its special when enemies are clumped', () => {
    const s = createGame({ seed: 1 });
    const ai = new AI(1, 'normal');
    for (let i = 0; i < 6; i++) addUnit(s, 0, 'bonebasher', 800 + i * 10);
    const cmds = ai.update(s);
    expect(cmds.some((c) => c.type === 'USE_SPECIAL')).toBe(true);
  });

  it('hard AI beats an idle opponent', () => {
    const s = createGame({ seed: 2, goldMult: [1, 1.25], xpMult: [1, 1.2] });
    const ai = new AI(1, 'hard');
    for (let t = 0; t < 30 * 60 * 8 && s.winner === null; t++) {
      for (const c of ai.update(s)) applyCommand(s, 1, c);
      step(s);
    }
    expect(s.winner).toBe(1);
  });

  it('hard AI beats normal AI (regression guard for AI strength)', () => {
    const h = DIFFICULTY.hard;
    const n = DIFFICULTY.normal;
    let hardWins = 0;
    for (const seed of [1, 2, 3]) {
      const s = createGame({ seed, goldMult: [n.goldMult, h.goldMult], xpMult: [n.xpMult, h.xpMult], incomeMult: [n.incomeMult, h.incomeMult], trainSpeed: [n.trainSpeed, h.trainSpeed], power: [n.power, h.power] });
      const a = new AI(0, 'normal', seed);
      const b = new AI(1, 'hard', seed + 1);
      for (let t = 0; t < 30 * 60 * 20 && s.winner === null; t++) {
        for (const c of a.update(s)) applyCommand(s, 0, c);
        for (const c of b.update(s)) applyCommand(s, 1, c);
        step(s);
        s.events.length = 0;
      }
      if (s.winner === 1) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(2);
  });
});
