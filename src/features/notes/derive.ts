// Turunan catatan ("catatan hidup"): urutan, filter pencarian, pengelompokan bulan, preview isi.
// Fungsi murni tanpa React.
import { dayLabel, monthLabel } from '@common/format.ts';
import type { Note } from '@/data/types';

export interface NoteFilter {
  q?: string;
  pinnedOnly?: boolean;
}

export interface NoteMonthGroup {
  key: string;
  label: string;
  items: Note[];
}

/**
 * Urutkan catatan:
 * 1. Disematkan dulu (pinned = true sebelum pinned = false)
 * 2. note_date menurun (terbaru dulu)
 * 3. created_at menurun (dibuat belakangan dulu bila tanggal sama)
 */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    if (a.note_date !== b.note_date) {
      return b.note_date.localeCompare(a.note_date);
    }
    const ca = a.created_at ?? '';
    const cb = b.created_at ?? '';
    return cb.localeCompare(ca);
  });
}

/**
 * Filter catatan:
 * - pinnedOnly: hanya catatan yang disematkan
 * - q: pencarian tidak peka huruf besar-kecil pada judul dan isi
 */
export function filterNotes(notes: readonly Note[], filter: NoteFilter = {}): Note[] {
  const needle = filter.q?.trim().toLowerCase();
  return notes.filter((n) => {
    if (filter.pinnedOnly && !n.pinned) return false;
    if (needle && needle.length > 0) {
      const titleMatch = (n.title ?? '').toLowerCase().includes(needle);
      const bodyMatch = (n.body ?? '').toLowerCase().includes(needle);
      if (!titleMatch && !bodyMatch) return false;
    }
    return true;
  });
}

/**
 * Kelompokkan catatan per bulan berdasarkan note_date (YYYY-MM).
 * Mengembalikan daftar grup berurutan [{ key: '2026-10', label: 'Oktober 2026', items }].
 */
export function groupByMonth(notes: readonly Note[]): NoteMonthGroup[] {
  const groups: NoteMonthGroup[] = [];
  const map = new Map<string, NoteMonthGroup>();

  for (const note of notes) {
    const key = (note.note_date || '').slice(0, 7);
    if (!key) continue;

    let group = map.get(key);
    if (!group) {
      const [year, month] = key.split('-').map(Number);
      const label = Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12
        ? monthLabel(year, month)
        : key;
      group = { key, label, items: [] };
      map.set(key, group);
      groups.push(group);
    }
    group.items.push(note);
  }

  return groups;
}

/**
 * Cuplikan teks isi catatan:
 * - Membersihkan whitespace berlebih & baris baru
 * - Jika panjang melebihi max (default 140), potong dan beri elipsis ('…')
 */
export function notePreview(body: string, max = 140): string {
  if (!body) return '';
  const clean = body.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd() + '…';
}

/** Format label tanggal catatan menggunakan helper dayLabel (@common/format). */
export function formatNoteDate(dateStr: string): string {
  return dayLabel(dateStr);
}
