import { DIFFICULTY, TICK_MS, type Difficulty } from '../data/config';
import { AI } from '../sim/ai';
import { applyCommand } from '../sim/commands';
import { createGame } from '../sim/state';
import { drainEvents, step } from '../sim/step';
import type { CmdResult, Command, GameState, Side, SimEvent } from '../sim/types';
import type { GameController, NetStatus } from './controller';
import { settings } from './settings';

/** Single-player: runs the simulation locally at a fixed tick rate and drives an AI for side 1. */
export class LocalController implements GameController {
  readonly me: Side = 0;
  readonly mirror = false;
  readonly online = false;
  readonly canCheat = true;
  readonly canPause = true;
  readonly label: string;
  readonly state: GameState;
  paused = false;
  status: NetStatus = { kind: 'ok' };
  ping = 0;
  private ai: AI;
  private acc = 0;
  private events: SimEvent[] = [];

  constructor(readonly difficulty: Difficulty, seed = Date.now() >>> 0) {
    const d = DIFFICULTY[difficulty];
    this.state = createGame({ seed, roster: settings.roster, goldMult: [1, d.goldMult], xpMult: [1, d.xpMult], incomeMult: [1, d.incomeMult], trainSpeed: [1, d.trainSpeed], power: [1, d.power] });
    this.ai = new AI(1, difficulty, seed);
    this.label = `vs AI (${d.label})`;
  }

  update(dtMs: number): void {
    if (this.paused) return;
    this.acc += Math.min(dtMs, 250);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      for (const c of this.ai.update(this.state)) applyCommand(this.state, 1, c);
      step(this.state);
      this.events.push(...drainEvents(this.state));
    }
  }

  send(cmd: Command): CmdResult {
    if (this.paused) return { ok: false, reason: 'paused' };
    const r = applyCommand(this.state, 0, cmd);
    this.events.push(...drainEvents(this.state));
    return r;
  }

  result() {
    return this.state.winner === null ? null : { winner: this.state.winner };
  }
  drainEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }
  debugGrant(gold: number, xp: number): void {
    this.state.players[0].gold += gold;
    this.state.players[0].xp += xp;
  }
  destroy(): void {}
}
