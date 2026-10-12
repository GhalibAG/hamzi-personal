/** Kontrak semua sheet/dialog tambah cepat yang dibuka lewat useUi().openQuick(kind, initial) atau ?quick=kind. */
export interface QuickSheetProps {
  open: boolean;
  onClose: () => void;
  /** Nilai awal opsional (mis. { title, due_date:'YYYY-MM-DD', due_time:'HH:MM', priority, source_tag, course_id, project_id }). */
  initial?: Record<string, unknown>;
}
