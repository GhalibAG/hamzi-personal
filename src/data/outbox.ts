// Outbox offline (TECH-SPEC §9, OFF-01..04): tulisan yang gagal karena jaringan disimpan di IndexedDB (FIFO)
// lalu dikirim ulang saat online. Idempoten karena id dibuat klien (upsert onConflict id) dan RPC bernilai absolut.
import { get, set } from 'idb-keyval';

export type OutboxOp =
  | { kind: 'upsert'; table: string; rows: Record<string, unknown>[] }
  | { kind: 'update'; table: string; id: string; patch: Record<string, unknown> }
  | { kind: 'remove'; table: string; id: string; hard?: boolean }
  | { kind: 'restore'; table: string; id: string }
  | { kind: 'rpc'; fn: string; args: Record<string, unknown> };

export interface OutboxEntry { id: string; createdAt: string; op: OutboxOp }

const KEY = 'hamzi-outbox-v1';
const listeners = new Set<(n: number) => void>();
let flushing = false;

async function read(): Promise<OutboxEntry[]> {
  try {
    return ((await get(KEY)) as OutboxEntry[] | undefined) ?? [];
  } catch {
    return [];
  }
}
async function write(list: OutboxEntry[]) {
  try {
    await set(KEY, list);
  } catch {
    /* IndexedDB tidak tersedia: antrean hilang saat tab ditutup */
  }
  listeners.forEach((l) => l(list.length));
}

export async function enqueue(op: OutboxOp) {
  const list = await read();
  list.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), op });
  await write(list);
}

export async function pendingCount(): Promise<number> {
  return (await read()).length;
}

/** Berlangganan jumlah antrean (Diagnostik / indikator sinkron). */
export function onOutboxChange(fn: (n: number) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Galat jaringan (offline, DNS, CORS gagal) → layak diantrekan; galat server (RLS, validasi) → tidak. */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_INTERNET/i.test(msg);
}

/**
 * Kirim ulang antrean secara FIFO. Berhenti pada galat jaringan pertama; galat non-jaringan dibuang
 * (dilaporkan lewat `onDrop`) agar antrean tidak macet selamanya.
 */
export async function flushOutbox(send: (op: OutboxOp) => Promise<void>, onDrop?: (e: OutboxEntry, err: unknown) => void): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    let list = await read();
    while (list.length) {
      const head = list[0];
      try {
        await send(head.op);
        sent++;
      } catch (err) {
        if (isNetworkError(err)) break;
        onDrop?.(head, err);
      }
      list = list.slice(1);
      await write(list);
    }
  } finally {
    flushing = false;
  }
  return sent;
}
