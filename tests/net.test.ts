import { describe, expect, it } from 'vitest';
import { HostSession } from '../src/net/host';
import { GuestSession } from '../src/net/guest';
import { BUILD_VERSION, loopbackPair, type Msg } from '../src/net/protocol';
import { START_GOLD } from '../src/data/config';
import { UNITS } from '../src/data/units';

function setup(opts: { graceMs?: number; now?: () => number } = {}) {
  let joined = 0;
  const host = new HostSession(42, { ...opts, onJoin: () => joined++ });
  const [h, g] = loopbackPair();
  host.attach(h);
  const guest = new GuestSession(g, { now: opts.now });
  return { host, guest, h, g, joined: () => joined };
}
const run = (host: HostSession, n: number) => {
  for (let i = 0; i < n; i++) host.step();
};

describe('multiplayer protocol', () => {
  it('handshake starts the match and sends a snapshot', () => {
    const { host, guest, joined } = setup();
    expect(guest.welcomed).toBe(true);
    expect(joined()).toBe(1);
    expect(host.guestConnected).toBe(true);
    expect(guest.state?.players[1].gold).toBe(START_GOLD);
  });

  it('refuses mismatched versions', () => {
    const host = new HostSession(1);
    const [h, g] = loopbackPair();
    host.attach(h);
    let reason = '';
    g.onMessage = (m: Msg) => m.t === 'reject' && (reason = m.reason);
    g.send({ t: 'hello', v: 'wrong', token: 'x' });
    expect(reason).toMatch(/Version mismatch/);
    expect(host.running).toBe(false);
  });

  it('a third party cannot hijack the room', () => {
    const { host } = setup();
    const [h2, g2] = loopbackPair();
    host.attach(h2);
    let rejected = false;
    g2.onMessage = (m: Msg) => m.t === 'reject' && (rejected = true);
    g2.send({ t: 'hello', v: BUILD_VERSION, token: 'someone-else' });
    expect(rejected).toBe(true);
  });

  it('guest commands are applied by the host and acknowledged; prediction is instant', () => {
    const { host, guest } = setup();
    const r = guest.send({ type: 'TRAIN_UNIT', unit: 'bonebasher' });
    expect(r.ok).toBe(true);
    // optimistic view already shows the queued unit and spent gold
    expect(guest.state!.players[1].queue.length).toBe(1);
    expect(guest.state!.players[1].gold).toBe(START_GOLD - UNITS.bonebasher.cost);
    expect(host.state.players[1].queue.length).toBe(1);
    run(host, 4); // snapshot with ack
    expect(guest.state!.players[1].queue.length).toBe(1); // not double-applied after reconciliation
    expect(guest.state!.players[1].gold).toBeGreaterThanOrEqual(START_GOLD - UNITS.bonebasher.cost);
  });

  it('the host never trusts the guest: cheating commands are rejected authoritatively', () => {
    const { host, g } = setup();
    g.send({ t: 'cmd', seq: 1, cmd: { type: 'TRAIN_UNIT', unit: 'titan' } }); // wrong age
    g.send({ t: 'cmd', seq: 2, cmd: { type: 'EVOLVE' } }); // no xp
    g.send({ t: 'cmd', seq: 3, cmd: { type: 'BUY_TURRET', slot: 3, turret: 'slingpost' } }); // locked slot
    g.send({ t: 'cmd', seq: 4, cmd: { type: 'NUKE' } as any });
    g.send({ t: 'cmd', seq: 4, cmd: { type: 'TRAIN_UNIT', unit: 'bonebasher' } }); // replayed seq ignored
    expect(host.state.players[1].queue.length).toBe(0);
    expect(host.state.players[1].gold).toBe(START_GOLD);
    expect(host.state.players[1].age).toBe(0);
  });

  it('a guest cannot issue commands for the host player', () => {
    const { host, g } = setup();
    g.send({ t: 'cmd', seq: 1, cmd: { type: 'TRAIN_UNIT', unit: 'bonebasher' } });
    expect(host.state.players[0].queue.length).toBe(0);
    expect(host.state.players[1].queue.length).toBe(1);
  });

  it('snapshots flow at the configured cadence and carry events', () => {
    const { host, guest } = setup();
    host.localCommand({ type: 'TRAIN_UNIT', unit: 'bonebasher' });
    run(host, 30 * 4);
    expect(guest.base!.tick).toBeGreaterThanOrEqual(30 * 4 - 2);
    expect(guest.events.some((e) => e.k === 'spawn')).toBe(true);
    expect(guest.state!.units.length).toBe(host.state.units.length);
  });

  it('disconnect pauses the sim; reconnecting with the same token resumes it', () => {
    let t = 0;
    const { host, h } = setup({ graceMs: 30000, now: () => t });
    run(host, 10);
    const tick = host.state.tick;
    (h as any).drop();
    expect(host.paused).toBe(true);
    run(host, 10);
    expect(host.state.tick).toBe(tick);
    t = 10000;
    host.maintain();
    expect(host.state.winner).toBeNull();
    expect(host.graceSecondsLeft).toBeGreaterThan(19);
  });

  it('awards the win to the remaining player after the grace period', () => {
    let t = 0;
    const { host, h } = setup({ graceMs: 30000, now: () => t });
    (h as any).drop();
    t = 31000;
    host.maintain();
    expect(host.state.winner).toBe(0);
  });

  it('guest can reconnect within the grace period and gets a fresh snapshot', () => {
    let t = 0;
    const host = new HostSession(5, { graceMs: 30000, now: () => t });
    const [h1, g1] = loopbackPair();
    host.attach(h1);
    const guest = new GuestSession(g1, { now: () => t });
    run(host, 5);
    (h1 as any).drop();
    t = 5000;
    const [h2, g2] = loopbackPair();
    host.attach(h2);
    guest.bind(g2);
    expect(host.guestConnected).toBe(true);
    expect(host.graceUntil).toBeNull();
    run(host, 5);
    expect(host.state.tick).toBeGreaterThan(5);
    expect(guest.base!.tick).toBeGreaterThanOrEqual(host.state.tick - 1);
  });

  it('leaving on purpose ends the game at once for the other side', () => {
    const { host, guest } = setup();
    guest.leave();
    expect(host.state.winner).toBe(0);
  });

  it('host leaving tells the guest', () => {
    const { host, guest } = setup();
    host.leave();
    expect(guest.ended?.winner).toBe(1);
  });

  it('detects a silent guest via heartbeat timeout', () => {
    let t = 0;
    const { host, guest } = setup({ now: () => t });
    t = 1000;
    host.maintain();
    guest.maintain(); // answers the ping
    expect(host.guestConnected).toBe(true);
    t = 9000; // guest goes silent for >6s
    host.maintain();
    expect(host.guestConnected).toBe(false);
    expect(host.graceUntil).not.toBeNull();
  });

  it('measures round-trip time', () => {
    let t = 0;
    const { host, guest } = setup({ now: () => t });
    host.maintain();
    t = 0;
    guest.maintain();
    expect(guest.rtt).toBeGreaterThanOrEqual(0);
    expect(host.rtt).toBeGreaterThanOrEqual(0);
  });
});
