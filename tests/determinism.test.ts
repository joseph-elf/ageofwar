import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/sim/rng';
import { AI } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';

function play(seed: number) {
  const s = createGame({ seed });
  const a = new AI(0, 'normal', 1);
  const b = new AI(1, 'hard', 2);
  for (let t = 0; t < 30 * 60 * 4 && s.winner === null; t++) {
    for (const c of a.update(s)) applyCommand(s, 0, c);
    for (const c of b.update(s)) applyCommand(s, 1, c);
    step(s);
  }
  return JSON.stringify(s);
}

describe('determinism', () => {
  it('rng is reproducible', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('same seed + same commands => identical state', () => {
    expect(play(99)).toBe(play(99));
  });
  it('different seeds diverge', () => {
    expect(play(1)).not.toBe(play(2));
  });
  it('state survives a JSON round trip (snapshot safe)', () => {
    const s = createGame({ seed: 5 });
    applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'bonebasher' });
    for (let i = 0; i < 200; i++) step(s);
    const copy = JSON.parse(JSON.stringify(s));
    step(s);
    step(copy);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(s));
  });
});
