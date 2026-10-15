// Halaman editor catatan ("/catatan/baru" dan "/catatan/:id") — form tambah & ubah catatan hidup.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Icon } from '@/components/icons';
import {
  Button, Card, ConfirmRow, EmptyState, ErrorState, Field, IconButton, ListSkeleton, Page, ScreenHeader, Switch, inputCls, textareaCls,
} from '@/components/ui';
import { useToday } from '@/lib/hooks';
import type { NoteDraft, NoteErrors } from '../schema';
import { toNoteRow, validateNoteDraft } from '../schema';
import { useNotes, useRemoveNote, useSaveNote } from '../hooks';

export default function NoteEditorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const today = useToday();
  const { rows: notes, isLoading, isError, refetch } = useNotes();
  const { saveNote, isPending: isSaving } = useSaveNote();
  const { removeNote, isPending: isDeleting } = useRemoveNote();

  const note = useMemo(() => (id ? notes.find((n) => n.id === id) : undefined), [id, notes]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [noteDate, setNoteDate] = useState(today);
  const [pinned, setPinned] = useState(false);
  const [errors, setErrors] = useState<NoteErrors>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [initialized, setInitialized] = useState(!id);

  useEffect(() => {
    if (note) {
      setTitle(note.title ?? '');
      setBody(note.body ?? '');
      setNoteDate(note.note_date ?? today);
      setPinned(!!note.pinned);
      setInitialized(true);
    }
  }, [note, today]);

  const isDirty = useMemo(() => {
    if (!initialized) return false;
    const initTitle = note ? (note.title ?? '') : '';
    const initBody = note ? (note.body ?? '') : '';
    const initDate = note ? (note.note_date ?? today) : today;
    const initPinned = note ? !!note.pinned : false;

    return (
      title !== initTitle ||
      body !== initBody ||
      noteDate !== initDate ||
      pinned !== initPinned
    );
  }, [initialized, note, title, body, noteDate, pinned, today]);

  const handleBack = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      nav('/catatan');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft: NoteDraft = {
      ...(id ? { id } : {}),
      title,
      body,
      note_date: noteDate,
      pinned,
    };

    const errs = validateNoteDraft(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const row = toNoteRow(draft);
    await saveNote(row);
    nav('/catatan');
  };

  const handleDelete = async () => {
    if (!id) return;
    await removeNote(id);
    nav('/catatan');
  };

  if (id && isLoading) {
    return (
      <Page narrow>
        <ScreenHeader back="/catatan" onBack={handleBack} overline="Pribadi" title="Catatan" />
        <div className="px-4 pt-4 lg:px-0">
          <ListSkeleton rows={4} />
        </div>
      </Page>
    );
  }

  if (id && isError) {
    return (
      <Page narrow>
        <ScreenHeader back="/catatan" onBack={handleBack} overline="Pribadi" title="Catatan" />
        <div className="px-4 pt-4 lg:px-0">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      </Page>
    );
  }

  if (id && !isLoading && !note) {
    return (
      <Page narrow>
        <ScreenHeader back="/catatan" overline="Pribadi" title="Catatan" />
        <div className="px-4 pt-4 lg:px-0">
          <EmptyState
            mood="worried"
            title="Catatan tidak ditemukan"
            text="Catatan ini mungkin sudah dihapus."
            action={<Button onClick={() => nav('/catatan')}>Kembali ke Catatan</Button>}
          />
        </div>
      </Page>
    );
  }

  const pageTitle = id ? 'Edit Catatan' : 'Catatan Baru';

  return (
    <Page narrow>
      <ScreenHeader
        back="/catatan"
        onBack={handleBack}
        overline="Pribadi"
        title={pageTitle}
        right={
          id ? (
            <IconButton label="Hapus catatan" onClick={() => setShowDeleteConfirm(true)}>
              <Icon.Trash size={20} />
            </IconButton>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 px-4 pt-4 pb-12 lg:px-0">
        {showDiscardConfirm && (
          <ConfirmRow
            text="Ada perubahan yang belum tersimpan. Buang perubahan?"
            confirmLabel="Buang perubahan"
            danger
            onConfirm={() => nav('/catatan')}
            onCancel={() => setShowDiscardConfirm(false)}
          />
        )}

        {showDeleteConfirm && (
          <ConfirmRow
            text="Hapus catatan ini? Anda dapat mengurungkannya nanti."
            confirmLabel="Hapus"
            danger
            onConfirm={() => void handleDelete()}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}

        <Card className="p-4 sm:p-5">
          <form id="note-form" onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <Field label="Tanggal" htmlFor="note-date" error={errors.note_date}>
              <input
                id="note-date"
                type="date"
                value={noteDate}
                onChange={(e) => {
                  setNoteDate(e.target.value);
                  if (errors.note_date) setErrors((prev) => ({ ...prev, note_date: undefined }));
                }}
                className={inputCls}
              />
            </Field>

            <Field label="Judul (opsional)" htmlFor="note-title" error={errors.title} hint="Maksimal 120 karakter">
              <input
                id="note-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                placeholder="Mis. Ide proyek semester ini…"
                maxLength={120}
                className={inputCls}
              />
            </Field>

            <Field label="Isi catatan" htmlFor="note-body" error={errors.body} hint="Tulis bebas, maksimal 20.000 karakter">
              <textarea
                id="note-body"
                rows={12}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  if (errors.body) setErrors((prev) => ({ ...prev, body: undefined }));
                }}
                placeholder="Tulis apa saja: kejadian hari ini, ide, atau pengingat untuk dirimu sendiri…"
                maxLength={20000}
                className={textareaCls}
              />
            </Field>

            <div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-3 sm:p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-body font-bold text-ink">Sematkan catatan</span>
                <span className="text-meta text-ink-3">Tampilkan catatan di paling atas daftar</span>
              </div>
              <Switch checked={pinned} onChange={setPinned} label="Sematkan catatan" />
            </div>

            <div className="mt-2 flex flex-col gap-2.5">
              <Button size="lg" block type="submit" disabled={isSaving}>
                {isSaving ? 'Menyimpan…' : 'Simpan catatan'}
              </Button>

              {id && (
                <Button
                  type="button"
                  variant="danger-outline"
                  block
                  icon={<Icon.Trash size={18} />}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                >
                  Hapus catatan
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </Page>
  );
}
