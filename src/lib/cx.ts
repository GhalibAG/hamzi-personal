/** Gabung kelas CSS (abaikan nilai falsy). */
export function cx(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(' ');
}
