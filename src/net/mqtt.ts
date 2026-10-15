/** Minimal MQTT 3.1.1 client over WebSocket: QoS 0 publish / subscribe only, which is all the relay needs. */

/** Bytes backed by a plain ArrayBuffer (what WebSocket.send and WebCrypto accept). */
export type Bytes = Uint8Array<ArrayBuffer>;

const enc = new TextEncoder();
const dec = new TextDecoder();

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) out.set(p, (o += p.length) - p.length);
  return out;
};
const u16 = (n: number) => new Uint8Array([n >> 8, n & 255]);
const str = (s: string) => {
  const b = enc.encode(s);
  return concat(u16(b.length), b);
};
function packet(type: number, body: Uint8Array): Bytes {
  const len: number[] = [];
  let n = body.length;
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) d |= 128;
    len.push(d);
  } while (n > 0);
  return concat(new Uint8Array([type, ...len]), body);
}

export class Mqtt {
  onMessage: (topic: string, payload: Bytes) => void = () => {};
  onClose: () => void = () => {};
  closed = false;
  private buf: Bytes = new Uint8Array(0);
  private nextId = 0;
  private subs = new Map<number, (ok: boolean) => void>();
  private ping?: ReturnType<typeof setInterval>;

  private constructor(private ws: WebSocket) {}

  static connect(url: string, timeoutMs = 6000): Promise<Mqtt> {
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url, 'mqtt');
      } catch (e) {
        return reject(e);
      }
      ws.binaryType = 'arraybuffer';
      const c = new Mqtt(ws);
      let ready = false;
      const fail = (why: string) => {
        if (ready) return c.shutdown();
        clearTimeout(timer);
        ws.onclose = ws.onerror = null;
        ws.close();
        reject(new Error(why));
      };
      const timer = setTimeout(() => fail('timeout'), timeoutMs);
      ws.onopen = () => {
        const id = 'aow2-' + Math.random().toString(36).slice(2, 12);
        // protocol "MQTT" v4, clean session, 30 s keep-alive
        ws.send(packet(0x10, concat(str('MQTT'), new Uint8Array([4, 0x02]), u16(30), str(id))));
      };
      ws.onerror = () => fail('socket error');
      ws.onclose = () => fail('closed');
      c.onConnack = (ok) => {
        if (!ok) return fail('refused');
        ready = true;
        clearTimeout(timer);
        ws.onclose = ws.onerror = () => c.shutdown();
        c.ping = setInterval(() => c.raw(new Uint8Array([0xc0, 0])), 20000);
        resolve(c);
      };
      ws.onmessage = (e) => c.receive(new Uint8Array(e.data as ArrayBuffer));
    });
  }

  private onConnack: (ok: boolean) => void = () => {};

  subscribe(topic: string, timeoutMs = 6000): Promise<void> {
    const id = (this.nextId = (this.nextId % 0xffff) + 1);
    this.raw(packet(0x82, concat(u16(id), str(topic), new Uint8Array([0]))));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => (this.subs.delete(id), reject(new Error('subscribe timeout'))), timeoutMs);
      this.subs.set(id, (ok) => (clearTimeout(timer), ok ? resolve() : reject(new Error('subscribe refused'))));
    });
  }

  publish(topic: string, payload: Uint8Array): void {
    this.raw(packet(0x30, concat(str(topic), payload)));
  }

  close(): void {
    if (this.closed) return;
    this.raw(new Uint8Array([0xe0, 0]));
    this.shutdown();
  }

  private raw(b: Bytes): void {
    if (!this.closed && this.ws.readyState === WebSocket.OPEN) this.ws.send(b);
  }

  private shutdown(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.ping);
    this.ws.onclose = this.ws.onerror = this.ws.onmessage = null;
    this.ws.close();
    this.onClose();
  }

  private receive(chunk: Bytes): void {
    this.buf = this.buf.length ? concat(this.buf, chunk) : chunk;
    for (;;) {
      const b = this.buf;
      let len = 0;
      let mul = 1;
      let i = 1;
      for (; ; i++) {
        if (i >= b.length) return; // header not complete yet
        len += (b[i] & 127) * mul;
        mul *= 128;
        if (!(b[i] & 128)) break;
        if (i >= 4) return this.shutdown(); // malformed
      }
      const start = i + 1;
      if (b.length < start + len) return;
      this.handle(b[0], b.subarray(start, start + len));
      this.buf = b.subarray(start + len);
    }
  }

  private handle(head: number, body: Bytes): void {
    switch (head >> 4) {
      case 2: // CONNACK
        return this.onConnack(body[1] === 0);
      case 3: {
        // PUBLISH
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        const qos = (head >> 1) & 3;
        return this.onMessage(topic, body.slice(2 + tl + (qos ? 2 : 0)));
      }
      case 9: {
        // SUBACK
        const id = (body[0] << 8) | body[1];
        this.subs.get(id)?.(body[2] !== 0x80);
        this.subs.delete(id);
      }
    }
  }
}
