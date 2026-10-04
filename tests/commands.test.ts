import { describe, expect, it } from 'vitest';
import { newGame, run } from './helpers';
import { applyCommand } from '../src/sim/commands';
import { QUEUE_MAX, SELL_REFUND, TURRET_SLOT_COSTS } from '../src/data/config';
import { SPECIALS } from '../src/data/specials';
import { TURRETS } from '../src/data/turrets';
import type { Command } from '../src/sim/types';

describe('command validation', () => {
  it('rejects training with too little gold, wrong age units, unknown ids', () => {
    const s = newGame();
    s.players[0].gold = 5;
    expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'bonebasher' }).reason).toBe('not enough gold');
    s.players[0].gold = 9999;
    expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'pikeman' }).ok).toBe(false);
    expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'nope' }).ok).toBe(false);
  });

  it('caps the training queue', () => {
    const s = newGame();
    s.players[0].gold = 9999;
    for (let i = 0; i < QUEUE_MAX; i++) expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'bonebasher' }).ok).toBe(true);
    expect(applyCommand(s, 0, { type: 'TRAIN_UNIT', unit: 'bonebasher' }).reason).toBe('queue full');
  });

  it('turret slots: invalid / locked / occupied slots are rejected, buying a slot unlocks it', () => {
    const s = newGame();
    s.players[0].gold = 99999;
    const buy = (slot: number): Command => ({ type: 'BUY_TURRET', slot, turret: 'slingpost' });
    expect(applyCommand(s, 0, buy(1)).reason).toBe('invalid slot');
    expect(applyCommand(s, 0, buy(-1)).ok).toBe(false);
    expect(applyCommand(s, 0, buy(0.5)).ok).toBe(false);
    expect(applyCommand(s, 0, buy(0)).ok).toBe(true);
    expect(applyCommand(s, 0, buy(0)).reason).toBe('slot occupied');
    const g = s.players[0].gold;
    expect(applyCommand(s, 0, { type: 'BUY_TURRET_SLOT' }).ok).toBe(true);
    expect(s.players[0].gold).toBe(g - TURRET_SLOT_COSTS[0]);
    expect(applyCommand(s, 0, buy(1)).ok).toBe(true);
    applyCommand(s, 0, { type: 'BUY_TURRET_SLOT' });
    applyCommand(s, 0, { type: 'BUY_TURRET_SLOT' });
    expect(s.players[0].slotCount).toBe(4);
    expect(applyCommand(s, 0, { type: 'BUY_TURRET_SLOT' }).reason).toBe('max slots');
  });

  it('rejects turrets from other ages', () => {
    const s = newGame();
    s.players[0].gold = 99999;
    expect(applyCommand(s, 0, { type: 'BUY_TURRET', slot: 0, turret: 'ballista' }).ok).toBe(false);
  });

  it('selling refunds 50% and empties the slot', () => {
    const s = newGame();
    s.players[0].gold = 1000;
    applyCommand(s, 0, { type: 'BUY_TURRET', slot: 0, turret: 'spearcaster' });
    const g = s.players[0].gold;
    expect(applyCommand(s, 0, { type: 'SELL_TURRET', slot: 0 }).ok).toBe(true);
    expect(s.players[0].gold).toBe(g + Math.floor(TURRETS.spearcaster.cost * SELL_REFUND));
    expect(s.players[0].turrets[0]).toBeNull();
    expect(applyCommand(s, 0, { type: 'SELL_TURRET', slot: 0 }).ok).toBe(false);
  });

  it('special respects its cooldown', () => {
    const s = newGame();
    expect(applyCommand(s, 0, { type: 'USE_SPECIAL' }).ok).toBe(true);
    expect(applyCommand(s, 0, { type: 'USE_SPECIAL' }).reason).toBe('special on cooldown');
    run(s, SPECIALS.meteors.cooldown * 30 + 1);
    expect(applyCommand(s, 0, { type: 'USE_SPECIAL' }).ok).toBe(true);
  });

  it('rejects malformed commands and commands after the game ended', () => {
    const s = newGame();
    expect(applyCommand(s, 0, null as unknown as Command).ok).toBe(false);
    expect(applyCommand(s, 0, { type: 'HACK' } as unknown as Command).ok).toBe(false);
    expect(applyCommand(s, 5 as 0, { type: 'EVOLVE' }).ok).toBe(false);
    s.winner = 1;
    expect(applyCommand(s, 0, { type: 'BUY_TURRET_SLOT' }).ok).toBe(false);
  });

  it('players cannot touch each other: commands only affect their own side', () => {
    const s = newGame();
    applyCommand(s, 1, { type: 'TRAIN_UNIT', unit: 'bonebasher' });
    expect(s.players[0].queue.length).toBe(0);
    expect(s.players[1].queue.length).toBe(1);
  });
});
