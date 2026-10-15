import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { settings } from '../game/settings';
import { iceServers } from './ice';
import type { Msg, Transport } from './protocol';
import { listenRelay, relayConnect } from './relay';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const PREFIX = 'aow2-';
export const randomCode = (): string => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

/** PeerJS options from Settings. An empty host means PeerJS' free public cloud server. */
export function peerOptions(ice: RTCIceServer[]): PeerOptions {
  const o: PeerOptions = { debug: 1, config: { iceServers: ice } };
  if (settings.peerHost) Object.assign(o, { host: settings.peerHost, port: settings.peerPort, path: settings.peerPath, secure: settings.peerSecure });
  return o;
}

/** A direct (WebRTC) connection gets this head start before the guest also tries the MQTT relay (see relay.ts). */
const DIRECT_HEAD_START_MS = 5000;
/** TURN-relayed WebRTC over mobile data can take a while to open. */
const DIRECT_TIMEOUT_MS = 20000;

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
  let relay: { close(): void } | null = null;
  const open = () => {
    const code = randomCode();
    const p = new Peer(PREFIX + code, peerOptions(ice));
    peer = p;
    p.on('open', () => {
      if (closed || relay) return;
      // Guests that can't reach us directly (mobile data) come in through the relay instead.
      relay = listenRelay(code, cb.onConnection);
      cb.onCode(code);
    });
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
      relay?.close();
    },
  };
}

export interface JoinHandle extends RoomHandle {
  /** Open a fresh data connection to the same room (used after a drop). */
  reconnect(): Promise<Transport>;
}

export function joinRoom(code: string, cb: { onOpen(t: Transport): void; onError(msg: string): void; onStatus?(msg: string): void }): JoinHandle {
  let closed = false;
  let peer: Peer | null = null;
  let viaRelay = false; // the last connection was relayed: go straight to the relay on reconnect
  let lastPeerError = '';

  const direct = (): Promise<Transport> =>
    new Promise((resolve, reject) => {
      const p = peer;
      if (!p || p.destroyed) return reject(new Error('no peer'));
      if (p.disconnected) p.reconnect();
      let conn: DataConnection | undefined;
      const timer = setTimeout(() => (conn?.close(), reject(new Error('timeout'))), DIRECT_TIMEOUT_MS);
      const go = () => {
        if (closed) return;
        const c = (conn = p.connect(PREFIX + code, { serialization: 'json', reliable: true }));
        c.on('open', () => (clearTimeout(timer), resolve(wrap(c))));
        c.on('error', (e) => (clearTimeout(timer), reject(e)));
        c.on('close', () => (clearTimeout(timer), reject(new Error('closed'))));
      };
      if (p.open) go();
      else p.once('open', go);
    });

  /** Direct first; the relay joins the race after a head start (or at once when direct fails). First to open wins. */
  const connect = (): Promise<Transport> =>
    new Promise((resolve, reject) => {
      let settled = false;
      let pending = 1;
      let relayStarted = false;
      const win = (t: Transport) => {
        if (settled) return t.close(); // the slower path: not needed
        settled = true;
        clearTimeout(head);
        viaRelay = t.kind === 'relay';
        resolve(t);
      };
      const lose = () => {
        if (--pending > 0 || settled) return;
        settled = true;
        clearTimeout(head);
        reject(new Error('unreachable'));
      };
      const tryRelay = () => {
        if (relayStarted || settled || closed) return;
        relayStarted = true;
        pending++;
        cb.onStatus?.('Direct connection is slow, trying the relay…');
        relayConnect(code).then(win, lose);
      };
      const head = setTimeout(tryRelay, viaRelay ? 0 : DIRECT_HEAD_START_MS);
      direct().then(win, () => (tryRelay(), lose()));
    });

  iceServers().then(({ servers }) => {
    if (closed) return;
    const p = new Peer(peerOptions(servers));
    peer = p;
    // Peer-level errors are not fatal on their own (the relay may still work); remember them for the final message.
    p.on('error', (err) => (lastPeerError = (err as { type?: string }).type ?? ''));
    p.on('disconnected', () => !closed && !p.destroyed && p.reconnect());
    connect().then(
      (t) => !closed && cb.onOpen(t),
      () => {
        if (closed) return;
        if (lastPeerError === 'peer-unavailable' || lastPeerError === 'browser-incompatible') cb.onError(describe({ type: lastPeerError }));
        else cb.onError('Could not connect. Check the code and that the host is still waiting, then try again.');
      },
    );
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
