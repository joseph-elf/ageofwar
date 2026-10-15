import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { settings } from '../game/settings';
import { iceServers } from './ice';
import type { Msg, Transport } from './protocol';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const PREFIX = 'aow2-';
export const randomCode = (): string => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

/** PeerJS options from Settings. An empty host means PeerJS' free public cloud server. */
export function peerOptions(ice: RTCIceServer[]): PeerOptions {
  const o: PeerOptions = { debug: 1, config: { iceServers: ice } };
  if (settings.peerHost) Object.assign(o, { host: settings.peerHost, port: settings.peerPort, path: settings.peerPath, secure: settings.peerSecure });
  return o;
}

/** Relayed connections over mobile data take longer to set up than direct ones. */
const CONNECT_TIMEOUT_MS = 20000;

export function wrap(conn: DataConnection): Transport {
  const t: Transport = {
    send: (m: Msg) => conn.open && conn.send(m),
    close: () => conn.close(),
    onMessage: () => {},
    onClose: () => {},
  };
  conn.on('data', (d) => t.onMessage(d as Msg));
  conn.on('close', () => t.onClose());
  conn.on('error', () => t.onClose());
  return t;
}

export interface RoomHandle {
  close(): void;
}

/** Opens a peer with a fresh room code and reports every incoming data connection. */
export function createRoom(cb: { onCode(code: string): void; onError(msg: string): void; onConnection(t: Transport): void }): RoomHandle {
  let peer: Peer | null = null;
  let closed = false;
  let attempts = 0;
  let ice: RTCIceServer[] = [];
  const open = () => {
    const code = randomCode();
    const p = new Peer(PREFIX + code, peerOptions(ice));
    peer = p;
    p.on('open', () => !closed && cb.onCode(code));
    p.on('connection', (conn) => {
      conn.on('open', () => cb.onConnection(wrap(conn)));
    });
    p.on('disconnected', () => !closed && !p.destroyed && p.reconnect());
    p.on('error', (err) => {
      if (closed) return;
      if ((err as { type?: string }).type === 'unavailable-id' && attempts++ < 6) {
        p.destroy();
        return open();
      }
      cb.onError(describe(err));
    });
  };
  iceServers().then(({ servers }) => {
    ice = servers;
    if (!closed) open();
  });
  return {
    close: () => {
      closed = true;
      peer?.destroy();
    },
  };
}

export interface JoinHandle extends RoomHandle {
  /** Open a fresh data connection to the same room (used after a drop). */
  reconnect(): Promise<Transport>;
}

export function joinRoom(code: string, cb: { onOpen(t: Transport): void; onError(msg: string): void }): JoinHandle {
  let closed = false;
  let peer: Peer | null = null;
  let relay = false;
  const connect = (): Promise<Transport> =>
    new Promise((resolve, reject) => {
      if (!peer) return reject(new Error('not ready'));
      if (peer.disconnected && !peer.destroyed) peer.reconnect();
      const conn = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      const timer = setTimeout(() => {
        conn.close();
        reject(new Error('timeout'));
      }, CONNECT_TIMEOUT_MS);
      conn.on('open', () => (clearTimeout(timer), resolve(wrap(conn))));
      conn.on('error', (e) => (clearTimeout(timer), reject(e)));
      conn.on('close', () => (clearTimeout(timer), reject(new Error('closed'))));
    });
  iceServers().then(({ servers, relay: hasRelay }) => {
    if (closed) return;
    relay = hasRelay;
    const p = new Peer(peerOptions(servers));
    peer = p;
    p.on('open', () => {
      connect().then(
        (t) => !closed && cb.onOpen(t),
        () =>
          !closed &&
          cb.onError(
            relay
              ? 'Could not connect. Check the code and that the host is still waiting, then try again.'
              : 'Could not connect. Check the code and that the host is still waiting. On mobile data a TURN relay is needed and none is configured (Settings → TURN relay).',
          ),
      );
    });
    p.on('error', (err) => !closed && cb.onError(describe(err)));
  });
  return {
    close: () => {
      closed = true;
      peer?.destroy();
    },
    reconnect: connect,
  };
}

function describe(err: unknown): string {
  const type = (err as { type?: string }).type;
  switch (type) {
    case 'peer-unavailable': return 'Room not found. Check the code, and that the host is still waiting.';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return 'Cannot reach the signaling server. Check your connection or the server in Settings.';
    case 'browser-incompatible': return 'This browser does not support WebRTC.';
    default: return `Connection error${type ? ` (${type})` : ''}.`;
  }
}
