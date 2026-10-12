// STUB sementara — parser chat MODE DEMO (tanpa AI).
import type { Db } from '@/data/rpc-logic';
import type { Repo } from '@/data/repo';

export async function localChat(_body: unknown, _db: Db, _repo: Repo): Promise<unknown> {
  return { conversation_id: null, message: { id: '', text: 'Segera hadir.' }, source: 'error' };
}
