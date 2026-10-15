// Halaman daftar Catatan ("/catatan") — daftar catatan hidup pengguna (HP & Desktop).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '@/components/icons';
import {
  Button, Card, EmptyState, ErrorState, Fab, ListSkeleton, Page, ScreenHeader, SectionTitle, Segmented, inputCls,
} from '@/components/ui';
import type { Note } from '@/data/types';
import { cx } from '@/lib/cx';
import { useIsDesktop } from '@/lib/hooks';
import { filterNotes, formatNoteDate, groupByMonth, notePreview, sortNotes } from '../derive';
import { useNotes } from '../hooks';

type Tab = 'all' | 'pinned';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pinned', label: 'Disematkan' },
];

function NoteCard({ note }: { note: Note }) {
  const displayTitle = note.title?.trim() || note.body.split('\n')[0]?.trim().slice(0, 80) || 'Catatan tanpa judul';
  const preview = notePreview(note.body, 140);
  const dateFormatted = formatNoteDate(note.note_date);

  return (
    <Link
      to={`/catatan/${note.id}`}
      aria-label={`Buka catatan: ${displayTitle}`}
      className="group block no-underline focus:outline-none"
    >
      <Card className="flex flex-col gap-2 p-4 transition-all duration-200 group-hover:border-primary-soft group-hover:shadow-1 group-focus-visible:border-brand-500">
        <div className="flex items-start justify-between gap-2">
          <h3 className="m-0 text-card font-extrabold text-ink line-clamp-1 group-hover:text-primary">
            {displayTitle}
          </h3>
          {note.pinned && (
            <span
              title="Disematkan"
              aria-label="Catatan disematkan"
              className="inline-flex shrink-0 text-primary"
            >
              <Icon.Pin size={18} />
            </span>
          )}
        </div>
        {preview && (
          <p className="m-0 text-label text-ink-3 line-clamp-2 leading-relaxed">
            {preview}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between text-meta text-ink-muted">
          <span>{dateFormatted}</span>
        </div>
      </Card>
    </Link>
  );
}

export default function NotesPage() {
  const desktop = useIsDesktop();
  const nav = useNavigate();
  const { rows: notes, isLoading, isError, refetch } = useNotes();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  const filtered = useMemo(
    () => filterNotes(notes, { q, pinnedOnly: tab === 'pinned' }),
    [notes, q, tab],
  );
  const sorted = useMemo(() => sortNotes(filtered), [filtered]);
  const groups = useMemo(() => groupByMonth(sorted), [sorted]);

  const searchControls = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
          <Icon.Search size={18} />
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari judul atau isi catatan…"
          aria-label="Cari catatan"
          className={cx(inputCls, 'pl-10 pr-9')}
        />
        {q && (
          <button
            type="button"
            aria-label="Hapus pencarian"
            onClick={() => setQ('')}
            className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"
          >
            <Icon.X size={15} />
          </button>
        )}
      </div>
      <Segmented
        label="Filter catatan"
        options={TABS}
        value={tab}
        onChange={setTab}
        className="w-full sm:w-64"
      />
    </div>
  );

  const content = (() => {
    if (isLoading) {
      return <ListSkeleton rows={4} />;
    }
    if (isError) {
      return <ErrorState onRetry={() => void refetch()} />;
    }
    if (notes.length === 0) {
      return (
        <EmptyState
          mood="calm"
          text="Belum ada catatan. Tulis apa saja: kejadian hari ini, ide, atau pengingat untuk dirimu sendiri."
          action={(
            <Button icon={<Icon.Plus size={18} />} onClick={() => nav('/catatan/baru')}>
              Catatan baru
            </Button>
          )}
        />
      );
    }
    if (groups.length === 0) {
      return (
        <EmptyState
          compact
          text="Tidak ada catatan yang cocok."
          action={(
            <Button size="xs" variant="soft" onClick={() => { setQ(''); setTab('all'); }}>
              Reset pencarian
            </Button>
          )}
        />
      );
    }
    return (
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.key} aria-label={`Catatan bulan ${group.label}`} className="flex flex-col gap-2.5">
            <SectionTitle size="sm" title={group.label} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  })();

  if (desktop) {
    return (
      <Page className="lg:gap-4.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-meta font-semibold text-ink-3">Pribadi</span>
            <h1 className="m-0 text-title font-extrabold tracking-[-0.5px]">Catatan</h1>
          </div>
          <Button className="shadow-day-sel" icon={<Icon.Plus size={18} />} onClick={() => nav('/catatan/baru')}>
            Catatan baru
          </Button>
        </div>
        {notes.length > 0 && searchControls}
        {content}
      </Page>
    );
  }

  return (
    <div>
      <ScreenHeader
        overline="Pribadi"
        title="Catatan"
      />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-16">
        {notes.length > 0 && searchControls}
        {content}
      </div>
      <Fab label="Catatan baru" onClick={() => nav('/catatan/baru')} />
    </div>
  );
}
