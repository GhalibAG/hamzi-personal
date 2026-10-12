// Outbox offline (OFF-01..04): FIFO, berhenti pada galat jaringan, membuang galat server.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v); },
  del: async (k: string) => { store.delete(k); },
}));

const { enqueue, flushOutbox, pendingCount, isNetworkError } = await import('@/data/outbox');

describe('outbox', () => {
  beforeEach(() => store.clear());

  it('mengirim FIFO lalu kosong', async () => {
    await enqueue({ kind: 'rpc', fn: 'rpc_routine_set', args: { n: 1 } });
    await enqueue({ kind: 'upsert', table: 'transactions', rows: [{ id: 'a' }] });
    const sent: string[] = [];
    const n = await flushOutbox(async (op) => { sent.push(op.kind); });
    expect(n).toBe(2);
    expect(sent).toEqual(['rpc', 'upsert']);
    expect(await pendingCount()).toBe(0);
  });

  it('berhenti saat galat jaringan dan menyimpan sisa', async () => {
    await enqueue({ kind: 'rpc', fn: 'x', args: {} });
    await enqueue({ kind: 'rpc', fn: 'y', args: {} });
    const n = await flushOutbox(async () => { throw new Error('TypeError: Failed to fetch'); });
    expect(n).toBe(0);
    expect(await pendingCount()).toBe(2);
  });

  it('membuang operasi yang ditolak server', async () => {
    await enqueue({ kind: 'update', table: 'tasks', id: '1', patch: {} });
    await enqueue({ kind: 'update', table: 'tasks', id: '2', patch: {} });
    const dropped: string[] = [];
    const n = await flushOutbox(
      async (op) => { if (op.kind === 'update' && op.id === '1') throw new Error('new row violates row-level security policy'); },
      (e) => dropped.push(e.op.kind === 'update' ? e.op.id : ''),
    );
    expect(n).toBe(1);
    expect(dropped).toEqual(['1']);
    expect(await pendingCount()).toBe(0);
  });

  it('mengenali galat jaringan', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('duplicate key value'))).toBe(false);
  });
});
