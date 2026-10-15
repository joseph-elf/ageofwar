/**
 * Vercel serverless function: GET /api/ice -> { iceServers: RTCIceServer[] }
 *
 * Hands the game short-lived TURN relay credentials so players on mobile data (carrier-grade NAT) can connect.
 * The provider secrets stay server-side (set them in Vercel → Project → Settings → Environment Variables):
 *   Cloudflare (recommended, 1000 GB/month free): CF_TURN_KEY_ID + CF_TURN_API_TOKEN
 *   Metered.ca:                                   METERED_DOMAIN (e.g. myapp.metered.live) + METERED_API_KEY
 *   Any static TURN server (e.g. coturn):         TURN_URLS (comma-separated) + TURN_USER + TURN_PASS
 */
declare const process: { env: Record<string, string | undefined> };

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const TTL_SEC = 6 * 3600;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const asList = (x: unknown): IceServer[] => (Array.isArray(x) ? x : x && typeof x === 'object' ? [x as IceServer] : []);

/** Browsers block port 53, and those candidates just time out: drop them. */
const dropPort53 = (servers: IceServer[]): IceServer[] =>
  servers
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0);

async function cloudflare(id: string, token: string): Promise<IceServer[]> {
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ttl: TTL_SEC }),
  });
  if (!r.ok) throw new Error(`cloudflare ${r.status}`);
  return asList(((await r.json()) as { iceServers?: unknown }).iceServers);
}

async function metered(domain: string, key: string): Promise<IceServer[]> {
  const r = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error(`metered ${r.status}`);
  return asList(await r.json());
}

export async function GET(): Promise<Response> {
  const e = process.env;
  const servers: IceServer[] = [];
  try {
    if (e.CF_TURN_KEY_ID && e.CF_TURN_API_TOKEN) servers.push(...(await cloudflare(e.CF_TURN_KEY_ID, e.CF_TURN_API_TOKEN)));
  } catch (err) {
    console.error('TURN (Cloudflare) failed:', err);
  }
  try {
    if (e.METERED_DOMAIN && e.METERED_API_KEY) servers.push(...(await metered(e.METERED_DOMAIN, e.METERED_API_KEY)));
  } catch (err) {
    console.error('TURN (Metered) failed:', err);
  }
  const urls = (e.TURN_URLS ?? '').split(',').map((u) => u.trim()).filter(Boolean);
  if (urls.length) servers.push({ urls, username: e.TURN_USER, credential: e.TURN_PASS });
  return json({ iceServers: dropPort53(servers), ttl: TTL_SEC });
}
