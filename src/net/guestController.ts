import { RECONNECT_GRACE_SEC } from '../data/config';
import { createGame } from '../sim/state';
import type { GameController, NetStatus } from '../game/controller';
import type { CmdResult, Command, GameState, Side, SimEvent } from '../sim/types';
import { GuestSession } from './guest';
import type { Transport } from './protocol';

const EMPTY: GameState = createGame({ seed: 0 });

/** Joins a host's match: renders snapshots, sends commands, predicts its own commands, reconnects on drops. */
export class GuestController implements GameController {
  readonly me: Side = 1;
  readonly mirror = true; // so the local player's base is on the left, like the host's view
  readonly online = true;
  readonly canCheat = false;
  readonly canPause = false;
  readonly label = 'Online — you joined';
  paused = false;
  status: NetStatus = { kind: 'ok' };
  private reconnectUntil = 0;
  private retry?: number;
  private localEnd: { winner: Side; reason: string } | null = null;
  private destroyed = false;

  constructor(readonly session: GuestSession, private reconnect: () => Promise<Transport>, private closeNet: () => void) {}

  get state(): GameState {
    return this.session.state ?? EMPTY;
  }
  get ping(): number {
    return this.session.rtt;
  }

  /** Called by the session glue when the data connection dropped. */
  connectionLost(): void {
    if (this.destroyed || this.result()) return;
    this.reconnectUntil = performance.now() + RECONNECT_GRACE_SEC * 1000;
    this.tryReconnect();
  }

  private tryReconnect(): void {
    if (this.destroyed || this.result()) return;
    const left = this.reconnectUntil - performance.now();
    if (left <= 0) {
      this.localEnd = { winner: 1, reason: 'The host did not come back. You win by forfeit.' };
      this.status = { kind: 'ok' };
      return;
    }
    this.status = { kind: 'waiting', message: 'Connection lost — reconnecting…', secondsLeft: left / 1000 };
    this.reconnect()
      .then((t) => {
        if (this.destroyed) return t.close();
        this.session.bind(t);
        this.status = { kind: 'ok' };
      })
      .catch(() => {
        this.retry = window.setTimeout(() => this.tryReconnect(), 1500);
      });
  }

  update(): void {
    this.session.maintain();
    if (this.status.kind === 'waiting') {
      this.status = { ...this.status, secondsLeft: Math.max(0, (this.reconnectUntil - performance.now()) / 1000) };
    }
  }
  send(cmd: Command): CmdResult {
    return this.session.send(cmd);
  }
  result() {
    if (this.localEnd) return this.localEnd;
    if (this.session.ended) return this.session.ended;
    const s = this.session.base;
    return s && s.winner !== null ? { winner: s.winner, reason: s.winReason } : null;
  }
  drainEvents(): SimEvent[] {
    return this.session.events.splice(0);
  }
  debugGrant(): void {}
  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.retry);
    this.session.leave();
    this.closeNet();
  }
}
