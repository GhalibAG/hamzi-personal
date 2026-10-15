// Unit test fitur Catatan ("catatan hidup"): derive, pengelompokan, pencarian, preview, dan skema validasi.
import { describe, expect, it } from 'vitest';
import type { Note } from '@/data/types';
import { filterNotes, groupByMonth, notePreview, sortNotes } from '@/features/notes/derive';
import { noteSchema, validateNoteDraft } from '@/features/notes/schema';

function makeNote(partial: Partial<Note>): Note {
  return {
    id: partial.id ?? 'note-1',
    title: partial.title ?? null,
    body: partial.body ?? '',
    note_date: partial.note_date ?? '2026-10-14',
    pinned: partial.pinned ?? false,
    created_at: partial.created_at ?? '2026-10-14T08:00:00.000Z',
    updated_at: partial.updated_at ?? '2026-10-14T08:00:00.000Z',
    deleted_at: partial.deleted_at ?? null,
  };
}

describe('sortNotes', () => {
  it('menangani kasus daftar kosong', () => {
    expect(sortNotes([])).toEqual([]);
  });

  it('mendahulukan catatan yang disematkan (pinned) meskipun tanggal lebih lama', () => {
    const n1 = makeNote({ id: '1', note_date: '2026-10-14', pinned: false });
    const n2 = makeNote({ id: '2', note_date: '2026-10-01', pinned: true });
    const n3 = makeNote({ id: '3', note_date: '2026-10-10', pinned: false });

    const sorted = sortNotes([n1, n2, n3]);
    expect(sorted.map((n) => n.id)).toEqual(['2', '1', '3']);
  });

  it('mengurutkan berdasarkan note_date menurun untuk status sematan yang sama', () => {
    const n1 = makeNote({ id: '1', note_date: '2026-10-05', pinned: false });
    const n2 = makeNote({ id: '2', note_date: '2026-10-12', pinned: false });
    const n3 = makeNote({ id: '3', note_date: '2026-09-30', pinned: false });

    const sorted = sortNotes([n1, n2, n3]);
    expect(sorted.map((n) => n.id)).toEqual(['2', '1', '3']);
  });

  it('pada tanggal sama, mengurutkan berdasarkan created_at menurun', () => {
    const n1 = makeNote({ id: '1', note_date: '2026-10-14', created_at: '2026-10-14T08:00:00.000Z', pinned: false });
    const n2 = makeNote({ id: '2', note_date: '2026-10-14', created_at: '2026-10-14T14:30:00.000Z', pinned: false });
    const n3 = makeNote({ id: '3', note_date: '2026-10-14', created_at: '2026-10-14T10:15:00.000Z', pinned: false });

    const sorted = sortNotes([n1, n2, n3]);
    expect(sorted.map((n) => n.id)).toEqual(['2', '3', '1']);
  });

  it('mengurutkan beberapa catatan disematkan berdasarkan tanggal dan created_at', () => {
    const n1 = makeNote({ id: '1', note_date: '2026-10-10', created_at: '2026-10-10T10:00:00.000Z', pinned: true });
    const n2 = makeNote({ id: '2', note_date: '2026-10-12', created_at: '2026-10-12T08:00:00.000Z', pinned: true });
    const n3 = makeNote({ id: '3', note_date: '2026-10-14', created_at: '2026-10-14T09:00:00.000Z', pinned: false });

    const sorted = sortNotes([n1, n2, n3]);
    expect(sorted.map((n) => n.id)).toEqual(['2', '1', '3']);
  });
});

describe('filterNotes', () => {
  const notes: Note[] = [
    makeNote({ id: '1', title: 'Belajar Kalkulus', body: 'Persiapan UTS materi turunan parsial', pinned: true }),
    makeNote({ id: '2', title: 'Daftar Belanja', body: 'Beli kopi dan buku tulis', pinned: false }),
    makeNote({ id: '3', title: null, body: 'Refleksi harian: kalkulus tadi sore cukup lancar', pinned: false }),
  ];

  it('menangani kasus kosong', () => {
    expect(filterNotes([])).toEqual([]);
    expect(filterNotes(notes, {})).toHaveLength(3);
    expect(filterNotes(notes, { q: '   ' })).toHaveLength(3);
  });

  it('pencarian tidak peka huruf besar/kecil (case-insensitive) pada judul', () => {
    expect(filterNotes(notes, { q: 'kalkulus' }).map((n) => n.id)).toEqual(['1', '3']);
    expect(filterNotes(notes, { q: 'KALKULUS' }).map((n) => n.id)).toEqual(['1', '3']);
    expect(filterNotes(notes, { q: 'KaLkUlUs' }).map((n) => n.id)).toEqual(['1', '3']);
  });

  it('pencarian tidak peka huruf besar/kecil pada isi catatan', () => {
    expect(filterNotes(notes, { q: 'kopi' }).map((n) => n.id)).toEqual(['2']);
    expect(filterNotes(notes, { q: 'KOPI' }).map((n) => n.id)).toEqual(['2']);
    expect(filterNotes(notes, { q: 'PARSIAL' }).map((n) => n.id)).toEqual(['1']);
  });

  it('menyaring hanya yang disematkan dengan pinnedOnly: true', () => {
    expect(filterNotes(notes, { pinnedOnly: true }).map((n) => n.id)).toEqual(['1']);
  });

  it('menggabungkan pencarian teks dan filter pinnedOnly', () => {
    expect(filterNotes(notes, { q: 'kalkulus', pinnedOnly: true }).map((n) => n.id)).toEqual(['1']);
    expect(filterNotes(notes, { q: 'belanja', pinnedOnly: true })).toHaveLength(0);
  });
});

describe('groupByMonth', () => {
  it('menangani kasus daftar kosong', () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it('mengelompokkan catatan per bulan dengan label lokal Indonesia', () => {
    const list = [
      makeNote({ id: '1', note_date: '2026-10-14' }),
      makeNote({ id: '2', note_date: '2026-10-02' }),
      makeNote({ id: '3', note_date: '2026-09-28' }),
      makeNote({ id: '4', note_date: '2026-09-01' }),
      makeNote({ id: '5', note_date: '2026-08-17' }),
    ];

    const groups = groupByMonth(list);
    expect(groups).toHaveLength(3);

    expect(groups[0].key).toBe('2026-10');
    expect(groups[0].label).toBe('Oktober 2026');
    expect(groups[0].items.map((n) => n.id)).toEqual(['1', '2']);

    expect(groups[1].key).toBe('2026-09');
    expect(groups[1].label).toBe('September 2026');
    expect(groups[1].items.map((n) => n.id)).toEqual(['3', '4']);

    expect(groups[2].key).toBe('2026-08');
    expect(groups[2].label).toBe('Agustus 2026');
    expect(groups[2].items.map((n) => n.id)).toEqual(['5']);
  });
});

describe('notePreview', () => {
  it('menangani kasus kosong dan hanya spasi', () => {
    expect(notePreview('')).toBe('');
    expect(notePreview('   ')).toBe('');
  });

  it('mengembalikan teks pendek apa adanya jika panjang <= max', () => {
    expect(notePreview('Catatan singkat', 140)).toBe('Catatan singkat');
  });

  it('meratakan whitespace dan baris baru menjadi spasi tunggal', () => {
    const input = 'Baris pertama.\n\nBaris kedua\t  dan ketiga.';
    expect(notePreview(input, 140)).toBe('Baris pertama. Baris kedua dan ketiga.');
  });

  it('memotong teks jika melebihi batas max dan menambahkan elipsis', () => {
    const text = 'Halo dunia, ini adalah catatan pribadi yang cukup panjang untuk diuji.';
    const preview = notePreview(text, 20);
    expect(preview).toBe('Halo dunia, ini adal…');
    expect(preview.endsWith('…')).toBe(true);
  });
});

describe('noteSchema & sensitivitas data', () => {
  it('menerima catatan yang valid dengan judul dan isi', () => {
    const r = noteSchema.safeParse({
      title: 'Catatan Rapat',
      body: 'Membahas pembagian modul tugas akhir',
      note_date: '2026-10-14',
      pinned: false,
    });
    expect(r.success).toBe(true);
  });

  it('menerima catatan hanya dengan judul (tanpa isi)', () => {
    const r = noteSchema.safeParse({
      title: 'Judul Saja',
      body: '',
      note_date: '2026-10-14',
    });
    expect(r.success).toBe(true);
  });

  it('menerima catatan hanya dengan isi (tanpa judul/judul null)', () => {
    const r = noteSchema.safeParse({
      title: null,
      body: 'Isi catatan tanpa judul',
      note_date: '2026-10-14',
    });
    expect(r.success).toBe(true);
  });

  it('menolak catatan kosong total (judul dan isi kosong)', () => {
    const r = noteSchema.safeParse({
      title: '',
      body: '   ',
      note_date: '2026-10-14',
    });
    expect(r.success).toBe(false);
  });

  it('menolak tanggal yang tidak sesuai format YYYY-MM-DD', () => {
    const r = noteSchema.safeParse({
      title: 'Uji tanggal',
      body: 'Isi',
      note_date: '14-10-2026',
    });
    expect(r.success).toBe(false);
  });

  it('menolak data sensitif: nomor telepon dan email pada judul atau isi', () => {
    const draftTelepon = {
      title: 'Hubungi 081234567890',
      body: 'Catatan biasa',
      note_date: '2026-10-14',
      pinned: false,
    };
    const errorsTel = validateNoteDraft(draftTelepon);
    expect(errorsTel.title).toBeDefined();

    const draftEmail = {
      title: 'Kontak',
      body: 'Kirim ke teman@kampus.ac.id segera',
      note_date: '2026-10-14',
      pinned: false,
    };
    const errorsEmail = validateNoteDraft(draftEmail);
    expect(errorsEmail.body).toBeDefined();
  });
});
