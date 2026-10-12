// CORS (TECH-SPEC §6): dibatasi ALLOWED_ORIGIN (boleh beberapa, pisahkan koma).
// Pengecualian: scheduler-tick (server→server, tanpa CORS) dan notif-action (dipanggil service worker; dilindungi token HMAC).
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function allowedOrigins(): string[] {
  const list = (Deno.env.get('ALLOWED_ORIGIN') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEV_ORIGINS;
}

export function corsHeaders(req: Request, opts: { anyOrigin?: boolean } = {}): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = allowedOrigins();
  return {
    'Access-Control-Allow-Origin': opts.anyOrigin ? '*' : allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Balasan preflight OPTIONS, atau null bila bukan preflight. */
export function preflight(req: Request, opts: { anyOrigin?: boolean } = {}): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders(req, opts) });
}

/** Origin peramban yang tidak diizinkan (request tanpa Origin = bukan peramban → dibiarkan; JWT tetap wajib). */
export function originRejected(req: Request): boolean {
  const origin = req.headers.get('origin');
  return !!origin && !allowedOrigins().includes(origin);
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

/** Log terstruktur tanpa isi pesan/payload (hanya metadata). */
export function logEvent(fn: string, data: Record<string, string | number | boolean | null | undefined>): void {
  console.log(JSON.stringify({ fn, ...data }));
}
