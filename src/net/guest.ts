import { applyCommand } from '../sim/commands';
import type { CmdResult, Command, GameState, Side, SimEvent } from '../sim/types';
import { BUILD_VERSION, newToken, type Msg, type Transport } from './protocol';

export interface GuestOptions {
  now?: () => number;
  onWelcome?: () => void;
  onReject?: (reason: string) => void;
  onDisconnect?: () => void;
}

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

/**
 * Guest side: plays side 1 but only renders host snapshots. Commands are sent to the host and ALSO applied locally
 * on top of the newest snapshot (client-side prediction) until the host acknowledges them, so the UI reacts instantly.
 */
export class GuestSession {
  base: GameState | null = null;
  rtt = 0;
  welcomed = false;
  ended: { winner: Side; reason: string } | null = null;
  readonly events: SimEvent[] = [];
  private view: GameState | null = null;
  private dirty = true;
  private seq = 0;
  private pending: { seq: number; cmd: Command }[] = [];
  private t!: Transport;
  private token = newToken();
  private now: () => number;
  private lastPing = 0;
  private lastHeard = 0;

  constructor(t: Transport, private opts: GuestOptions = {}) {
    this.now = opts.now ?? (() => performance.now());
    this.bind(t);
  }

  /** (Re)attach a transport and say hello. Used for the first connection and for reconnects. */
  bind(t: Transport): void {
    this.t = t;
    t.onMessage = (m) => this.onMsg(m);
    t.onClose = () => {
      if (this.t === t) this.opts.onDisconnect?.();
    };
    this.lastHeard = this.now();
    t.send({ t: 'hello', v: BUILD_VERSION, token: this.token });
  }

  private onMsg(m: Msg): void {
    if (!m || typeof m !== 'object') return;
    this.lastHeard = this.now();
    switch (m.t) {
      case 'welcome':
        if (!this.welcomed) {
          this.welcomed = true;
          this.opts.onWelcome?.();
        }
        return;
      case 'reject':
        this.opts.onReject?.(m.reason);
        return;
      case 'snap':
        this.base = m.state;
        this.pending = this.pending.filter((p) => p.seq > m.ack);
        this.events.push(...m.events);
        this.dirty = true;
        return;
      case 'ping':
        return this.t.send({ t: 'pong', ts: m.ts });
      case 'pong':
        this.rtt = this.now() - m.ts;
        return;
      case 'end':
        this.ended = { winner: m.winner, reason: m.reason };
        return;
      case 'bye':
        this.ended = { winner: 1, reason: 'The host left the game.' };
    }
  }

  /** Authoritative snapshot + still-unacknowledged commands replayed on top. */
  get state(): GameState | null {
    if (!this.base) return null;
    if (this.dirty || !this.view) {
      this.view = clone(this.base);
      for (const p of this.pending) applyCommand(this.view, 1, p.cmd);
      this.view.events = [];
      this.dirty = false;
    }
    return this.view;
  }

  send(cmd: Command): CmdResult {
    const view = this.state;
    if (!view) return { ok: false, reason: 'not ready' };
    const r = applyCommand(view, 1, cmd); // predicts locally; also validates so the player gets instant feedback
    view.events = [];
    if (!r.ok) return r;
    const seq = ++this.seq;
    this.pending.push({ seq, cmd });
    this.t.send({ t: 'cmd', seq, cmd });
    return r;
  }

  maintain(): void {
    const now = this.now();
    if (this.welcomed && !this.ended && now - this.lastHeard > 6000) {
      this.lastHeard = now;
      this.t.close(); // silent host: triggers onDisconnect -> reconnect attempts
    }
    if (now - this.lastPing > 2000) {
      this.lastPing = now;
      this.t.send({ t: 'ping', ts: now });
    }
  }

  leave(): void {
    if (!this.ended && this.base?.winner === null) this.t.send({ t: 'bye' });
    const t = this.t;
    t.onClose = () => {};
    t.close();
  }
}
