import type { Roster } from '../data/ages';

export interface Settings {
  volume: number; // 0..1 (sound effects)
  musicVolume: number; // 0..1
  muted: boolean;
  showFps: boolean;
  /** PeerJS signaling server. Empty host => PeerJS' free public cloud server. */
  peerHost: string;
  peerPort: number;
  peerPath: string;
  peerSecure: boolean;
  /** Optional TURN relay (needed when a player is on mobile data / a strict firewall). Comma-separated urls, e.g. turn:host:3478,turns:host:443?transport=tcp */
  turnUrls: string;
  turnUser: string;
  turnPass: string;
  /** Unit roster for new games: classic (original units) or extended (new units and turrets). */
  roster: Roster;
}

const env = import.meta.env as Record<string, string | undefined>;
const DEFAULTS: Settings = {
  volume: 0.6,
  musicVolume: 0.5,
  muted: false,
  showFps: false,
  peerHost: env.VITE_PEER_HOST ?? '',
  peerPort: Number(env.VITE_PEER_PORT ?? 443),
  peerPath: env.VITE_PEER_PATH ?? '/',
  peerSecure: (env.VITE_PEER_SECURE ?? 'true') !== 'false',
  turnUrls: env.VITE_TURN_URLS ?? '',
  turnUser: env.VITE_TURN_USER ?? '',
  turnPass: env.VITE_TURN_PASS ?? '',
  roster: 'extended',
};
const KEY = 'ages-of-war-ii.settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULTS };
}

export const settings: Settings = load();
const listeners = new Set<() => void>();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  listeners.forEach((f) => f());
}
export function onSettingsChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
