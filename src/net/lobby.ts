import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { settings } from '../game/settings';
import type { Msg, Transport } from './protocol';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const PREFIX = 'aow2-';
export const randomCode = (): string => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

/** PeerJS options from Settings. An empty host means PeerJS' free public cloud server. */
export function peerOptions(): PeerOptions {
  const o: PeerOptions = { debug: 1 };
  if (settings.peerHost) Object.assign(o, { host: settings.peerHost, port: settings.peerPort, path: settings.peerPath, secure: settings.peerSecure });
  const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }];
  const turn = settings.turnUrls.split(',').map((u) => u.trim()).filter(Boolean);
  if (turn.length) iceServers.push({ urls: turn, username: settings.turnUser, credential: settings.turnPass });
  o.config = { iceServers };
  return o;
}

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
  const open = () => {
    const code = randomCode();
    const p = new Peer(PREFIX + code, peerOptions());
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
  open();
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
  const peer = new Peer(peerOptions());
  const connect = (): Promise<Transport> =>
    new Promise((resolve, reject) => {
      if (peer.disconnected && !peer.destroyed) peer.reconnect();
      const conn = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      const timer = setTimeout(() => {
        conn.close();
        reject(new Error('timeout'));
      }, 8000);
      conn.on('open', () => (clearTimeout(timer), resolve(wrap(conn))));
      conn.on('error', (e) => (clearTimeout(timer), reject(e)));
      conn.on('close', () => (clearTimeout(timer), reject(new Error('closed'))));
    });
  peer.on('open', () => {
    connect().then(
      (t) => !closed && cb.onOpen(t),
      () => !closed && cb.onError('Could not connect. Check the code and that the host is still waiting. If you are on mobile data or a strict network, a TURN relay server is needed (Settings → TURN relay).'),
    );
  });
  peer.on('error', (err) => !closed && cb.onError(describe(err)));
  return {
    close: () => {
      closed = true;
      peer.destroy();
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
