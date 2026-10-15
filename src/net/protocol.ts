import { AGES } from '../data/ages';
import { PROTOCOL_VERSION } from '../data/config';
import { SPECIALS } from '../data/specials';
import { TURRETS } from '../data/turrets';
import { UNITS } from '../data/units';
import type { Command, GameState, Side, SimEvent } from '../sim/types';

/**
 * Wire format (JSON). Host-authoritative:
 *   guest -> host : hello, cmd, ping/pong, bye
 *   host -> guest : welcome | reject, snap (≈15 Hz, full state + events since last snap + ack of last applied cmd seq), ping/pong, end, bye
 */
export type Msg =
  | { t: 'hello'; v: string; token: string }
  | { t: 'welcome'; v: string; token: string; seed: number }
  | { t: 'reject'; reason: string }
  | { t: 'cmd'; seq: number; cmd: Command }
  | { t: 'snap'; ack: number; state: GameState; events: SimEvent[] }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  | { t: 'end'; winner: Side; reason: string }
  | { t: 'bye' };

export interface Transport {
  /** 'relay' when the connection goes through the MQTT relay instead of WebRTC. */
  readonly kind?: 'relay';
  send(m: Msg): void;
  close(): void;
  onMessage: (m: Msg) => void;
  onClose: () => void;
}

function hash32(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

/** Protocol number + a hash of all balance data: builds that disagree on either refuse to play together. */
export const BUILD_VERSION = `${PROTOCOL_VERSION}-${hash32(JSON.stringify([UNITS, TURRETS, AGES, SPECIALS]))}`;

export const newToken = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** In-memory transport pair (tests, and a reference for the PeerJS adapter). Delivery is synchronous. */
export function loopbackPair(): [Transport & { drop(): void }, Transport & { drop(): void }] {
  const mk = () => ({ onMessage: (_m: Msg) => {}, onClose: () => {}, peer: null as any, closed: false } as any);
  const a = mk();
  const b = mk();
  const wire = (x: any, y: any) => {
    x.peer = y;
    x.send = (m: Msg) => {
      if (!x.closed && !y.closed) y.onMessage(JSON.parse(JSON.stringify(m)));
    };
    x.close = () => {
      if (x.closed) return;
      x.closed = true;
      x.onClose();
      if (!y.closed) {
        y.closed = true;
        y.onClose();
      }
    };
    x.drop = x.close;
  };
  wire(a, b);
  wire(b, a);
  return [a, b];
}
