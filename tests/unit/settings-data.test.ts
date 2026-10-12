// Export/Import Pengaturan > Data (SET-04, TECH-SPEC §16).
import { describe, expect, it } from 'vitest';
import { parseBackup, routinesCsv, toCsv } from '@/features/settings/data-export';

const backup = (p: Record<string, unknown> = {}) => JSON.stringify({ app: 'hamzi', schema_version: 2, exported_at: '2026-10-12T09:00:00.000Z', tables: { tasks: [{ id: 't1', title: 'A' }] }, ...p });

describe('parseBackup', () => {
  it('menerima backup Hamzi v2 dan menghitung baris', () => {
    const r = parseBackup(backup({ tables: { tasks: [{ id: 't1' }, { id: 't2' }], user_settings: [{ theme: 'dark' }], push_subscriptions: [{ id: 'p' }], asing: [] } }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toBe(2);
      expect(Object.keys(r.tables).sort()).toEqual(['tasks', 'user_settings']);
      expect(r.ignored.sort()).toEqual(['asing', 'push_subscriptions']);
    }
  });
  it('menolak JSON rusak, app lain, versi lain, dan baris tanpa id', () => {
    expect(parseBackup('{').ok).toBe(false);
    expect(parseBackup(backup({ app: 'lain' }))).toEqual({ ok: false, error: 'Ini bukan file backup Hamzi.' });
    expect(parseBackup(backup({ schema_version: 1 })).ok).toBe(false);
    expect(parseBackup(backup({ tables: { tasks: [{ title: 'x' }] } }))).toEqual({ ok: false, error: 'Baris ke-1 di tabel tasks tidak punya id.' });
  });
});

describe('CSV', () => {
  it('UTF-8 BOM, CRLF, kutip untuk koma/kutip', () => {
    const s = toCsv(['a', 'b'], [['x,y', 'say "hi"'], [1, null]]);
    expect(s.charCodeAt(0)).toBe(0xfeff);
    expect(s.slice(1)).toBe('a,b\r\n"x,y","say ""hi"""\r\n1,\r\n');
  });
  it('rutinitas & log', () => {
    const csv = routinesCsv(
      [{ id: 'r', name: 'Minum air', kind: 'count', target_count: 8, is_required: false, repeat_days: [1], remind_enabled: false, sort: 0, archived: false }],
      [{ id: 'l', routine_id: 'r', log_date: '2026-10-12', value: 5, done: false }],
    );
    expect(csv.slice(1).split('\r\n')[1]).toBe('2026-10-12,Minum air,kebiasaan,jumlah,5,8,tidak');
  });
});
