import { settings } from '../game/settings';

const STUN: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
/** PeerJS' free public relay: best-effort last resort, used when nothing better is configured. */
const PEERJS_TURN: RTCIceServer = { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' };

let cached: { servers: RTCIceServer[]; until: number } | null = null;

/** Short-lived TURN credentials from the deploy's /api/ice function (see api/ice.ts). Empty when unavailable (e.g. `vite dev`). */
async function fetchRelays(): Promise<RTCIceServer[]> {
  if (cached && Date.now() < cached.until) return cached.servers;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(new URL('api/ice', document.baseURI), { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!r.ok) return [];
    const body = (await r.json()) as { iceServers?: RTCIceServer[]; ttl?: number };
    const servers = Array.isArray(body.iceServers) ? body.iceServers : [];
    // Refresh well before the credentials expire.
    cached = { servers, until: Date.now() + Math.max(60, (body.ttl ?? 3600) / 2) * 1000 };
    return servers;
  } catch {
    return [];
  }
}

const isTurn = (s: RTCIceServer) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/.test(u));

/** STUN + every relay we can get: deploy-provided, then manual Settings, then PeerJS' public one as a fallback. */
export async function iceServers(): Promise<{ servers: RTCIceServer[]; relay: boolean }> {
  const servers = [...STUN, ...(await fetchRelays())];
  const manual = settings.turnUrls.split(',').map((u) => u.trim()).filter(Boolean);
  if (manual.length) servers.push({ urls: manual, username: settings.turnUser, credential: settings.turnPass });
  const relay = servers.some(isTurn);
  servers.push(PEERJS_TURN);
  return { servers, relay };
}
