// Hook data catatan (TanStack Query + UI toast). Komponen memakai hook ini, bukan supabase/localStorage langsung.
import { useCallback } from 'react';
import { useRemove, useRows, useUpsert } from '@/data/hooks';
import type { Note } from '@/data/types';
import { toastUndo } from '@/stores/ui';

/** Daftar baris aktif catatan pengguna (tidak termasuk yang di-soft-delete). */
export function useNotes(opts: { enabled?: boolean } = {}) {
  return useRows('notes', opts);
}

/** Hook untuk menyimpan (insert / update) catatan dengan optimistic update + rollback. */
export function useSaveNote() {
  const upsert = useUpsert('notes');
  const saveNote = useCallback(
    async (input: Partial<Note> | Partial<Note>[]) => upsert.save(input),
    [upsert],
  );
  return {
    ...upsert,
    saveNote,
  };
}

/** Hook untuk menghapus catatan (soft delete) dengan toast Urungkan (3,5 detik). */
export function useRemoveNote() {
  const r = useRemove('notes');

  const removeNote = useCallback(
    async (id: string, opts?: { hard?: boolean; toastMessage?: string }) => {
      await r.remove(id, { hard: opts?.hard });
      if (!opts?.hard) {
        toastUndo(opts?.toastMessage ?? 'Catatan dihapus', () => void r.undo(id));
      }
    },
    [r],
  );

  return {
    ...r,
    removeNote,
  };
}
