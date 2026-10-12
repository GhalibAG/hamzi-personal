// STUB sementara — diganti implementasi penuh.
import { Sheet } from '@/components/ui';
import type { QuickSheetProps } from '@/app/quick';

export function EventFormSheet({ open, onClose }: QuickSheetProps) {
  return <Sheet open={open} onClose={onClose} title="EventFormSheet"><p className="text-body">Segera hadir.</p></Sheet>;
}
