// Token aksi notifikasi (TECH-SPEC §6.2): HMAC-SHA256 (NOTIF_ACTION_SECRET) atas {nid, uid, kind, ref_id, day, exp},
// berlaku 24 jam, format base64url(payload).base64url(signature). Hanya WebCrypto (tanpa dependensi).
export interface ActionToken {
  nid: string;
  uid: string;
  kind: string;
  ref_id: string | null;
  day: string | null;
  exp: number; // detik epoch
}

export const TOKEN_TTL_SEC = 24 * 60 * 60;
const enc = new TextEncoder();

function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function signToken(
  p: Omit<ActionToken, 'exp'> & { exp?: number },
  secret: string,
  ttlSec = TOKEN_TTL_SEC,
): Promise<string> {
  const payload: ActionToken = {
    nid: p.nid, uid: p.uid, kind: p.kind, ref_id: p.ref_id ?? null, day: p.day ?? null,
    exp: p.exp ?? Math.floor(Date.now() / 1000) + ttlSec,
  };
  const body = toB64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(body)));
  return `${body}.${toB64url(sig)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verifikasi tanda tangan (waktu-konstan via WebCrypto) dan kedaluwarsa. null bila tidak sah. */
export async function verifyToken(token: string, secret: string, nowMs = Date.now()): Promise<ActionToken | null> {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sigS] = parts;
  const sig = fromB64url(sigS);
  if (!sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), sig, enc.encode(body));
  if (!ok) return null;
  const raw = fromB64url(body);
  if (!raw) return null;
  let p: unknown;
  try {
    p = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;
  const t = p as Record<string, unknown>;
  if (typeof t.nid !== 'string' || !UUID.test(t.nid)) return null;
  if (typeof t.uid !== 'string' || !UUID.test(t.uid)) return null;
  if (typeof t.kind !== 'string' || typeof t.exp !== 'number') return null;
  if (t.ref_id !== null && (typeof t.ref_id !== 'string' || !UUID.test(t.ref_id))) return null;
  if (t.day !== null && (typeof t.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.day))) return null;
  if (t.exp * 1000 <= nowMs) return null;
  return { nid: t.nid, uid: t.uid, kind: t.kind, ref_id: t.ref_id as string | null, day: t.day as string | null, exp: t.exp };
}

/** Bandingkan dua string rahasia dalam waktu konstan (panjang dibandingkan lewat digest). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0 && a.length > 0;
}
