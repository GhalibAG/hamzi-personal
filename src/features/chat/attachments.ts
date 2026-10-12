// Lampiran chat (CHAT-02): validasi jenis/ukuran, hitung halaman PDF (perkiraan), label kartu file.
import { CHAT_MIMES, MAX_ATTACHMENTS, MAX_FILE_BYTES, MAX_TOTAL_BYTES, type ChatMime } from './types';

export const ACCEPT = CHAT_MIMES.join(',');

const EXT_MIME: Record<string, ChatMime> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** MIME yang diizinkan (dari tipe file atau ekstensi bila tipe kosong). */
export function chatMime(file: { name: string; type: string }): ChatMime | null {
  if ((CHAT_MIMES as readonly string[]).includes(file.type)) return file.type as ChatMime;
  if (file.type) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? null;
}

/** Pesan galat ramah, atau null bila boleh. */
export function validateFile(file: { name: string; type: string; size: number }, current: { size: number }[]): string | null {
  if (!chatMime(file)) return `${file.name}: hanya PDF, JPG, PNG, atau WebP.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} lebih dari 10 MB.`;
  if (current.length >= MAX_ATTACHMENTS) return 'Maksimal 3 file per pesan.';
  if (current.reduce((s, f) => s + f.size, 0) + file.size > MAX_TOTAL_BYTES) return 'Total lampiran maksimal 15 MB per pesan.';
  return null;
}

/** Perkiraan jumlah halaman PDF (objek /Type /Page). Tidak pasti untuk PDF terkompresi → undefined. */
export async function pdfPageCount(file: Blob): Promise<number | undefined> {
  try {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder('latin1').decode(buf);
    const n = (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
    if (n > 0) return n;
    const count = /\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/.exec(text);
    return count ? Number(count[1]) || undefined : undefined;
  } catch {
    return undefined;
  }
}

export function fileBadge(mime: string, name: string): string {
  if (mime === 'application/pdf') return 'PDF';
  const ext = name.split('.').pop()?.toUpperCase() ?? '';
  return ext === 'JPEG' ? 'JPG' : ext.slice(0, 4) || 'IMG';
}

export function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toString().replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "PDF · 6 halaman" / "Gambar · 230 KB". */
export function fileMeta(a: { mime: string; size: number; pages?: number }): string {
  const kind = a.mime === 'application/pdf' ? 'PDF' : 'Gambar';
  return a.pages ? `${kind} · ${a.pages} halaman` : `${kind} · ${sizeLabel(a.size)}`;
}
