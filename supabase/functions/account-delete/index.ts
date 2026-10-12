// account-delete — hapus akun permanen (TECH-SPEC §6.6, PRD SET-08). JWT + body { confirm: 'HAPUS' }.
// Service role: hapus folder Storage {uid}/ lalu auth.admin.deleteUser (semua tabel public ikut terhapus via FK cascade).
import { z } from 'zod';
import { corsHeaders, json, logEvent, originRejected, preflight } from '../_shared/cors.ts';
import { requireUser, serviceClient, type Db } from '../_shared/supabase.ts';

const Body = z.object({ confirm: z.literal('HAPUS') });

/** Kumpulkan semua path file di bawah prefix (rekursif, maks kedalaman 4). */
async function listFiles(db: Db, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from('chat-uploads').list(prefix, { limit: 1000, offset });
    if (error || !data?.length) break;
    for (const f of data) {
      const path = `${prefix}/${f.name}`;
      if (f.id === null) out.push(...(await listFiles(db, path, depth + 1))); // folder
      else out.push(path);
    }
    if (data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);
  if (originRejected(req)) return json({ ok: false, error: 'origin' }, 403, cors);
  const auth = await requireUser(req);
  if (!auth) return json({ ok: false, error: 'unauthorized' }, 401, cors);

  try {
    Body.parse(await req.json());
  } catch {
    return json({ ok: false, error: 'confirm_required', message: 'Ketik HAPUS untuk mengonfirmasi.' }, 400, cors);
  }

  const uid = auth.uid;
  const db = serviceClient();
  try {
    const files = await listFiles(db, uid);
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await db.storage.from('chat-uploads').remove(files.slice(i, i + 100));
      if (error) throw new Error('storage');
    }
    const { error } = await db.auth.admin.deleteUser(uid);
    if (error) throw new Error('auth');
    logEvent('account-delete', { ok: true, files: files.length });
    return json({ ok: true }, 200, cors);
  } catch (e) {
    logEvent('account-delete', { ok: false, error: e instanceof Error ? e.message : 'error' });
    return json({ ok: false, error: 'server', message: 'Akun belum bisa dihapus. Coba lagi nanti.' }, 500, cors);
  }
});
