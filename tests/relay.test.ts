import { describe, expect, it } from 'vitest';
import { relayRoom, seal, unseal } from '../src/net/relay';

describe('relay framing', () => {
  it('round-trips frames through compression + encryption', async () => {
    const room = await relayRoom('ABC234');
    const frame = { c: 'x1', m: [{ t: 'ping' as const, ts: 12.5 }, { t: 'bye' as const }] };
    expect(await unseal(room, await seal(room, frame))).toEqual(frame);
  });

  it('rejects frames sealed for another room, and garbage', async () => {
    const a = await relayRoom('ABC234');
    const b = await relayRoom('ZZZ999');
    expect(a.topic).not.toBe(b.topic);
    expect(await unseal(b, await seal(a, { c: 'x', k: 'open' }))).toBeNull();
    expect(await unseal(a, new Uint8Array(40))).toBeNull();
  });
});
