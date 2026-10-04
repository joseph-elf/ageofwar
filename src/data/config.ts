// Technical constants (tick rate, networking). Gameplay numbers live in tuning.ts, which is re-exported here.
export * from './tuning';

export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;
export const sec = (s: number) => Math.max(1, Math.round(s * TICK_RATE));

/** Height (world px above the ground) of the ledge each turret slot sits on. */
export const SLOT_HEIGHTS = [52, 96, 140, 184];

export const SPAWN_CLEARANCE = 22; // a trained unit waits in the base until the spawn point is free

export const SNAPSHOT_EVERY_TICKS = 2; // 30 / 2 = 15 Hz snapshots in multiplayer
export const RECONNECT_GRACE_SEC = 30;
export const PROTOCOL_VERSION = 1;
