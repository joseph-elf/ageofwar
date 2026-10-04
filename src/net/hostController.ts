import { TICK_MS } from '../data/config';
import type { GameController, NetStatus } from '../game/controller';
import type { CmdResult, Command, GameState, Side, SimEvent } from '../sim/types';
import { HostSession } from './host';
import { startTicker } from './ticker';

/** Hosts a match: runs the authoritative simulation (driven by a worker timer so background tabs keep going). */
export class HostController implements GameController {
  readonly me: Side = 0;
  readonly mirror = false;
  readonly online = true;
  readonly canCheat = false;
  readonly canPause = false;
  readonly label = 'Online — you are hosting';
  paused = false;
  private last = performance.now();
  private acc = 0;
  private stop: () => void;

  constructor(readonly session: HostSession, private closeNet: () => void) {
    this.stop = startTicker(() => this.advance(), 16);
  }

  get state(): GameState {
    return this.session.state;
  }
  get ping(): number {
    return this.session.rtt;
  }
  get status(): NetStatus {
    if (this.session.guestConnected || this.session.state.winner !== null) return { kind: 'ok' };
    return { kind: 'waiting', message: 'Opponent disconnected — waiting for them to reconnect', secondsLeft: this.session.graceSecondsLeft };
  }
  set status(_v: NetStatus) {}

  private advance(): void {
    const now = performance.now();
    const dt = Math.min(now - this.last, 500);
    this.last = now;
    this.session.maintain();
    if (this.session.paused) {
      this.acc = 0;
      return;
    }
    this.acc += dt;
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.session.step();
    }
  }

  update(): void {
    this.advance(); // harmless extra call; keeps working if the worker is unavailable
  }
  send(cmd: Command): CmdResult {
    return this.session.localCommand(cmd);
  }
  result() {
    const s = this.session.state;
    return s.winner === null ? null : { winner: s.winner, reason: s.winReason };
  }
  drainEvents(): SimEvent[] {
    return this.session.localEvents.splice(0);
  }
  debugGrant(): void {}
  destroy(): void {
    this.stop();
    this.session.leave();
    this.closeNet();
  }
}
