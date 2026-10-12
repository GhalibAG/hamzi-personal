// Validasi form Kuliah (zod). Pesan galat spesifik dalam bahasa Indonesia.
import { z } from 'zod';

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Jam belum diisi');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal belum diisi');

/** Angka desimal dari input id-ID ("3,65" atau "3.65"). */
export function parseDecimal(s: string): number {
  return Number(s.trim().replace(',', '.'));
}

export const scheduleRowSchema = z
  .object({ weekday: z.number().int().min(1).max(7), start_time: hhmm, end_time: hhmm, room: z.string().max(60).optional() })
  .refine((r) => r.end_time > r.start_time, { message: 'Jam selesai harus setelah jam mulai', path: ['end_time'] });

export const courseFormSchema = z.object({
  semester_id: z.string().min(1, 'Pilih semester'),
  name: z.string().trim().min(1, 'Nama matkul wajib diisi').max(120, 'Nama terlalu panjang (maks 120)'),
  code: z.string().trim().max(20, 'Kode terlalu panjang').optional(),
  credits: z.number({ invalid_type_error: 'SKS harus angka' }).int('SKS harus bilangan bulat').min(1, 'SKS minimal 1').max(10, 'SKS maksimal 10'),
  lecturer: z.string().trim().max(80).optional(),
  room: z.string().trim().max(60).optional(),
  min_attendance_pct: z.number({ invalid_type_error: 'Batas kehadiran harus angka' }).int().min(0, 'Minimal 0').max(100, 'Maksimal 100'),
  schedules: z.array(scheduleRowSchema),
});

export const examFormSchema = z.object({
  course_id: z.string().min(1, 'Pilih mata kuliah'),
  kind: z.enum(['kuis', 'uts', 'uas', 'praktikum']),
  date: dateStr,
  time: hhmm,
  material: z.string().max(300, 'Materi maksimal 300 karakter').optional(),
  room: z.string().max(60).optional(),
});

export const semesterFormSchema = z
  .object({
    number: z.number({ invalid_type_error: 'Nomor semester harus angka' }).int().min(1, 'Nomor 1–20').max(20, 'Nomor 1–20'),
    label: z.string().trim().min(1, 'Label wajib diisi, mis. "Ganjil 2026/2027"').max(60),
    start_date: dateStr,
    end_date: dateStr,
  })
  .refine((s) => s.end_date >= s.start_date, { message: 'Tanggal selesai harus setelah tanggal mulai', path: ['end_date'] });

export const componentFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama komponen wajib diisi').max(40),
  weight_pct: z.number({ invalid_type_error: 'Bobot harus angka' }).gt(0, 'Bobot harus lebih dari 0').max(100, 'Bobot maksimal 100'),
  score: z.number({ invalid_type_error: 'Skor harus angka' }).min(0, 'Skor 0–100').max(100, 'Skor 0–100').nullable(),
});

export const academicSettingsSchema = z.object({
  target_gpa: z.number({ invalid_type_error: 'Target IPK harus angka' }).gt(0, 'Target IPK 0–4').max(4, 'Target IPK maksimal 4,00').nullable(),
  curriculum_credits: z.number({ invalid_type_error: 'SKS kurikulum harus angka' }).int().min(1, 'Minimal 1').max(300, 'Maksimal 300'),
});

/** Galat pertama per field dari hasil safeParse. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join('.');
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
