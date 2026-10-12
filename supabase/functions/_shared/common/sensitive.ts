// Detektor & redaksi data sensitif (TECH-SPEC §11). Dipakai klien (peringatan) dan Edge Function (redaksi).
const LONG_DIGITS = /(?:\d[\s-]?){9,}\d?/g;          // ≥ 9 digit berurutan (boleh spasi/tanda hubung)
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+62|62|0)8\d{7,11}/g;
const URL_RE = /https?:\/\/\S+/g;

export type SensitiveKind = 'nomor_panjang' | 'email' | 'telepon';

export function detectSensitive(text: string): SensitiveKind[] {
  const found = new Set<SensitiveKind>();
  if (!text) return [];
  if (PHONE.test(text)) found.add('telepon');
  PHONE.lastIndex = 0;
  const digitsOnly = text.replace(PHONE, ' ');
  if (new RegExp(LONG_DIGITS.source).test(digitsOnly)) found.add('nomor_panjang');
  if (new RegExp(EMAIL.source).test(text)) found.add('email');
  return [...found];
}

export function hasSensitive(text: string): boolean {
  return detectSensitive(text).length > 0;
}

/** Ganti pola sensitif dengan penanda. */
export function redact(text: string, opts: { urls?: boolean } = {}): string {
  let t = text.replace(EMAIL, '[email]').replace(PHONE, '[telepon]').replace(LONG_DIGITS, '[nomor]');
  if (opts.urls) t = t.replace(URL_RE, '[tautan]');
  return t;
}

export const SENSITIVE_MESSAGE: Record<SensitiveKind, string> = {
  nomor_panjang: 'Sepertinya ada nomor panjang (rekening/kartu/NIK). Hapus dulu ya, jangan disimpan di sini.',
  email: 'Ada alamat email. Sebaiknya tidak disimpan di catatan.',
  telepon: 'Ada nomor telepon. Sebaiknya tidak disimpan di catatan.',
};
