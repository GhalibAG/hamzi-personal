// Skema form Catatan ("catatan hidup"): validasi Zod & pencegahan data sensitif.
import { z } from 'zod';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import type { Note } from '@/data/types';

export interface NoteDraft {
  id?: string;
  title: string;
  body: string;
  note_date: string;
  pinned: boolean;
}

const sensitive = (val: string, ctx: z.RefinementCtx, path: string) => {
  const kind = detectSensitive(val)[0];
  if (kind) {
    ctx.addIssue({
      code: 'custom',
      path: [path],
      message: SENSITIVE_MESSAGE[kind],
    });
  }
};

export const noteSchema = z.object({
  title: z
    .string()
    .max(120, 'Judul maksimal 120 karakter')
    .optional()
    .nullable(),
  body: z
    .string()
    .max(20000, 'Isi maksimal 20.000 karakter')
    .default(''),
  note_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  pinned: z.boolean().default(false),
}).superRefine((val, ctx) => {
  const titleText = (val.title ?? '').trim();
  const bodyText = (val.body ?? '').trim();

  // Catatan tidak boleh kosong total (judul terisi ATAU isi terisi)
  if (!titleText && !bodyText) {
    ctx.addIssue({
      code: 'custom',
      path: ['body'],
      message: 'Catatan tidak boleh kosong (isi judul atau isi catatan)',
    });
  }

  // Cek data sensitif (nomor panjang/kartu/rekening/NIK, email, telepon)
  if (val.title) sensitive(val.title, ctx, 'title');
  if (val.body) sensitive(val.body, ctx, 'body');
});

export const noteFormSchema = noteSchema;
export type NoteFormValues = z.infer<typeof noteSchema>;
export type NoteErrors = Partial<Record<'title' | 'body' | 'note_date' | 'pinned', string>>;

/** Validasi draf catatan dan kembalikan pemetaan pesan error. */
export function validateNoteDraft(draft: NoteDraft): NoteErrors {
  const parsed = noteSchema.safeParse(draft);
  const errors: NoteErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof NoteErrors;
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
  }
  return errors;
}

/** Inisialisasi draf dari baris Note yang ada atau catatan baru. */
export function draftFromNote(note?: Note, defaultDate = ''): NoteDraft {
  if (note) {
    return {
      id: note.id,
      title: note.title ?? '',
      body: note.body,
      note_date: note.note_date,
      pinned: !!note.pinned,
    };
  }
  return {
    title: '',
    body: '',
    note_date: defaultDate,
    pinned: false,
  };
}

/** Konversi draf yang sudah valid ke baris Note siap simpan. */
export function toNoteRow(draft: NoteDraft): Partial<Note> {
  const titleTrimmed = draft.title.trim();
  return {
    ...(draft.id ? { id: draft.id } : {}),
    title: titleTrimmed || null,
    body: draft.body.trim(),
    note_date: draft.note_date,
    pinned: !!draft.pinned,
  };
}
