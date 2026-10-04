import type { CmdResult, Command, GameState, Side, SimEvent } from '../sim/types';

export type NetStatus =
  | { kind: 'ok' }
  | { kind: 'waiting'; message: string; secondsLeft?: number }; // paused: opponent/host connection problem

/**
 * What the renderer and HUD talk to. Implementations: LocalController (vs AI), HostController and GuestController.
 * `state` is always shown from the *sim's* point of view; `me` says which side the local player owns.
 */
export interface GameController {
  readonly me: Side;
  /** Mirror the view so the local player's base is on the left even when they are side 1. */
  readonly mirror: boolean;
  readonly online: boolean;
  readonly canCheat: boolean;
  readonly canPause: boolean;
  readonly label: string; // e.g. "vs AI (Normal)"
  readonly state: GameState;
  paused: boolean;
  status: NetStatus;
  /** Round-trip latency in ms (online only). */
  ping: number;
  result(): { winner: Side; reason?: string } | null;
  send(cmd: Command): CmdResult;
  update(dtMs: number): void;
  drainEvents(): SimEvent[];
  debugGrant(gold: number, xp: number): void;
  destroy(): void;
}
