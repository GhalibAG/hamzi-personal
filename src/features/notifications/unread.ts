import { useRows } from '@/data/hooks';

/** Jumlah notifikasi terkirim yang belum dibaca (titik lonceng & badge sidebar). */
export function useUnreadCount(): number {
  const { rows } = useRows('scheduled_notifications');
  return rows.filter((n) => n.status === 'sent' && !n.read_at).length;
}
