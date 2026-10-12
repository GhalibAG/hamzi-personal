// Cloudflare Worker — penjadwal Hamzi (TECH-SPEC §6.1, ADR #11).
// Cron Trigger tiap menit → POST ke Edge Function scheduler-tick dengan header x-cron-secret.
// Sekaligus menjaga project Supabase free tier tetap aktif. Tidak bergantung pada pg_cron/pg_net.
// TICK_URL = variabel biasa (wrangler.toml); CRON_SECRET = secret (`npx wrangler secret put CRON_SECRET`).

async function tick(env) {
  if (!env.TICK_URL || !env.CRON_SECRET) {
    console.log('scheduler: TICK_URL atau CRON_SECRET belum diatur');
    return;
  }
  const res = await fetch(env.TICK_URL, {
    method: 'POST',
    headers: { 'x-cron-secret': env.CRON_SECRET, 'content-type': 'application/json' },
    body: '{}',
  });
  // Respons hanya berisi angka {enqueued, sent, skipped, failed}; aman dicatat.
  const text = await res.text();
  console.log(`scheduler-tick ${res.status} ${text.slice(0, 200)}`);
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(tick(env));
  },
  // Worker tidak melayani HTTP publik (workers_dev = false); balas 404 bila terpanggil.
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
