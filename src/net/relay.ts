import { Mqtt, type Bytes } from './mqtt';
import type { Msg, Transport } from './protocol';

/**
 * Fallback transport for when a direct WebRTC connection can't be made (mobile data / carrier-grade NAT) and no TURN relay
 * is configured. Messages go through free public MQTT brokers over secure WebSockets, which every network allows.
 * No account needed. Traffic is compressed, then encrypted with a key derived from the room code (the brokers are public:
 * anyone could subscribe), and the topic is a hash of the code, so only the two players can read or forge messages.
 *
 * The host listens on every broker; a guest uses whichever answers first.
 */
export const BROKERS = ['wss://test.mosquitto.org:8081/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];

/** At most one publish per FLUSH_MS per connection (some public brokers cap message rates around 10/s). */
const FLUSH_MS = 100;

type Frame = { c: string; k: 'open' | 'ok' | 'close' } | { c: string; m: Msg[] };

interface Room {
  topic: string;
  key: CryptoKey;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));

export async function relayRoom(code: string): Promise<Room> {
  const [t, k] = await Promise.all([sha256('aow2-relay-topic:' + code), sha256('aow2-relay-key:' + code)]);
  return { topic: 'aow2/' + hex(t).slice(0, 32), key: await crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['encrypt', 'decrypt']) };
}

const canZip = typeof CompressionStream !== 'undefined';
const pipe = async (b: Bytes, s: CompressionStream | DecompressionStream): Promise<Bytes> =>
  new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(s)).arrayBuffer());

/** Frame -> [flag | json (deflated when supported)] -> AES-GCM -> iv ‖ ciphertext. */
export async function seal(room: Room, f: Frame): Promise<Bytes> {
  const json = enc.encode(JSON.stringify(f));
  const body = canZip ? await pipe(json, new CompressionStream('deflate-raw')) : json;
  const plain = new Uint8Array(body.length + 1);
  plain[0] = canZip ? 1 : 0;
  plain.set(body, 1);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, room.key, plain));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

/** Inverse of `seal`; null for anything that was not sealed with this room's key. */
export async function unseal(room: Room, data: Bytes): Promise<Frame | null> {
  try {
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12) }, room.key, data.subarray(12)));
    const body = plain.subarray(1);
    const f = JSON.parse(dec.decode(plain[0] === 1 ? await pipe(body, new DecompressionStream('deflate-raw')) : body));
    return f && typeof f.c === 'string' ? f : null;
  } catch {
    return null;
  }
}

/** One logical connection over a broker. Batches outgoing messages; a newer snapshot replaces an unsent one (events merged). */
class Link implements Transport {
  readonly kind = 'relay' as const;
  onMessage: (m: Msg) => void = () => {};
  onClose: () => void = () => {};
  closed = false;
  private out: Msg[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private lastFlush = 0;
  private tx: Promise<unknown> = Promise.resolve();
  private rx: Promise<unknown> = Promise.resolve();

  constructor(readonly mq: Mqtt, private room: Room, private dst: string, readonly c: string, private onDone: () => void) {}

  send(m: Msg): void {
    if (this.closed) return;
    const i = m.t === 'snap' ? this.out.findIndex((o) => o.t === 'snap') : -1;
    if (m.t === 'snap' && i >= 0) {
      const prev = this.out[i] as Extract<Msg, { t: 'snap' }>;
      this.out[i] = { ...m, events: [...prev.events, ...m.events] };
    } else this.out.push(m);
    if (this.timer) return;
    const wait = this.lastFlush + FLUSH_MS - Date.now();
    if (wait <= 0) this.flush();
    else this.timer = setTimeout(() => this.flush(), wait);
  }

  private flush(): void {
    this.timer = undefined;
    if (!this.out.length) return;
    this.lastFlush = Date.now();
    this.publish({ c: this.c, m: this.out });
    this.out = [];
  }

  publish(f: Frame): void {
    // Sealing is async: chain it so frames leave in order.
    this.tx = this.tx.then(() => seal(this.room, f)).then((b) => this.mq.publish(this.dst, b), () => {});
  }

  /** Incoming sealed payload for this connection (decrypted in arrival order). */
  receive(data: Bytes, handle: (f: Frame) => void): void {
    this.rx = this.rx.then(() => unseal(this.room, data)).then((f) => f && !this.closed && handle(f));
  }

  deliver(ms: Msg[]): void {
    for (const m of ms) if (!this.closed) this.onMessage(m);
  }

  close(): void {
    if (this.closed) return;
    clearTimeout(this.timer);
    this.flush();
    this.publish({ c: this.c, k: 'close' });
    this.end();
  }

  /** The other side, or the broker, went away. */
  end(): void {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.onDone();
    this.onClose();
  }
}

/** Host: accept relayed guests for this room code on every broker, reconnecting to brokers that drop. */
export function listenRelay(code: string, onConnection: (t: Transport) => void): { close(): void } {
  let closed = false;
  const clients = new Set<Mqtt>();
  const links = new Map<string, Link>();
  const roomP = relayRoom(code);

  const serve = async (url: string, delay: number): Promise<void> => {
    if (closed) return;
    try {
      const room = await roomP;
      const mq = await Mqtt.connect(url);
      if (closed) return mq.close();
      clients.add(mq);
      const inbox = room.topic + '/h';
      const handle = (f: Frame) => {
        const link = links.get(f.c);
        if ('k' in f && f.k === 'open') {
          if (link) return link.publish({ c: f.c, k: 'ok' }); // repeated open: answer again
          const l = new Link(mq, room, `${room.topic}/g/${f.c}`, f.c, () => links.get(f.c) === l && links.delete(f.c));
          links.set(f.c, l);
          l.publish({ c: f.c, k: 'ok' });
          onConnection(l);
        } else if (link) {
          if ('m' in f) link.deliver(f.m);
          else if (f.k === 'close') link.end();
        }
      };
      // Decrypt in arrival order; anything not sealed with this room's key is dropped.
      let rx: Promise<unknown> = Promise.resolve();
      mq.onMessage = (topic, data) => {
        if (topic === inbox) rx = rx.then(() => unseal(room, data)).then((f) => f && !closed && handle(f));
      };
      mq.onClose = () => {
        clients.delete(mq);
        for (const l of [...links.values()]) if (l.mq === mq) l.end();
        setTimeout(() => serve(url, 2000), 2000);
      };
      await mq.subscribe(inbox);
    } catch {
      setTimeout(() => serve(url, Math.min(delay * 2, 30000)), delay);
    }
  };
  BROKERS.forEach((u) => serve(u, 2000));
  return {
    close: () => {
      closed = true;
      for (const l of [...links.values()]) l.end();
      for (const mq of clients) mq.close();
      clients.clear();
    },
  };
}

/** Guest: open a relayed connection to the host of this room code. Rejects if no broker gets an answer in time. */
export function relayConnect(code: string, timeoutMs = 8000): Promise<Transport> {
  const c = Math.random().toString(36).slice(2, 12);
  return new Promise((resolve, reject) => {
    let done = false;
    const clients = new Set<Mqtt>();
    const finish = (winner?: { mq: Mqtt; room: Room }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const mq of clients) if (mq !== winner?.mq) mq.close();
      if (!winner) return reject(new Error('relay: no answer from host'));
      const { mq, room } = winner;
      const link = new Link(mq, room, room.topic + '/h', c, () => mq.close());
      mq.onMessage = (_t, data) =>
        link.receive(data, (f) => {
          if ('m' in f) link.deliver(f.m);
          else if (f.k === 'close') link.end();
        });
      mq.onClose = () => link.end();
      resolve(link);
    };
    const timer = setTimeout(() => finish(), timeoutMs);
    relayRoom(code).then((room) => {
      for (const url of BROKERS) {
        Mqtt.connect(url, timeoutMs)
          .then(async (mq) => {
            if (done) return mq.close();
            clients.add(mq);
            mq.onMessage = (_t, data) => unseal(room, data).then((f) => f && f.c === c && 'k' in f && f.k === 'ok' && finish({ mq, room }));
            await mq.subscribe(`${room.topic}/g/${c}`);
            // Say hello until the host answers (it may still be (re)connecting to this broker).
            const hello = () => !done && !mq.closed && seal(room, { c, k: 'open' }).then((b) => mq.publish(room.topic + '/h', b));
            hello();
            const again = setInterval(() => (done || mq.closed ? clearInterval(again) : hello()), 1500);
          })
          .catch(() => {});
      }
    }, () => finish());
  });
}
