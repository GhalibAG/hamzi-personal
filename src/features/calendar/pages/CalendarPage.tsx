// `/rencana/kalender` — kalender bulan (CAL-01/02): grid 7×6 + titik warna sumber; agenda hari terpilih
// (kelas ungu, tugas biru, ujian oranye, event abu, rutinitas hijau opsional); FAB/ tombol → Event baru (CAL-03). UI-SPEC §3.5.
import { useMemo, useState } from 'react';
import { addDays } from '@common/calc/index.ts';
import { dayLabelComma, monthLabel } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Button, Card, Chip, Columns, EmptyState, ErrorState, Fab, IconButton, ListSkeleton, Page, ScreenHeader, SectionLink, SectionTitle,
} from '@/components/ui';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { readLocal, writeLocal } from '@/lib/storage';
import { useUi } from '@/stores/ui';
import { AGENDA_KINDS, AGENDA_LABEL, agendaOn, kindsByDay, shiftMonth, type AgendaKind } from '../derive';
import { useAgendaSources } from '../hooks';
import { AgendaList, KIND_DOT, MonthGrid } from '../components/MonthGrid';

const FILTER_KEY = 'hamzi-cal-kinds';
const DEFAULT_KINDS: AgendaKind[] = ['kelas', 'tugas', 'ujian', 'event'];

function useKinds(): [Set<AgendaKind>, (k: AgendaKind) => void] {
  const [list, setList] = useState<AgendaKind[]>(() => {
    const v = readLocal<AgendaKind[]>(FILTER_KEY, DEFAULT_KINDS);
    return Array.isArray(v) ? v.filter((k) => AGENDA_KINDS.includes(k)) : DEFAULT_KINDS;
  });
  const toggle = (k: AgendaKind) => setList((prev) => {
    const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
    writeLocal(FILTER_KEY, next);
    return next;
  });
  return [useMemo(() => new Set(list), [list]), toggle];
}

function Filters({ kinds, toggle }: { kinds: Set<AgendaKind>; toggle: (k: AgendaKind) => void }) {
  return (
    <div role="group" aria-label="Sumber yang ditampilkan" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
      {AGENDA_KINDS.map((k) => (
        <Chip key={k} selected={kinds.has(k)} onClick={() => toggle(k)}>
          <span aria-hidden="true" className={cx('size-2 rounded-full', KIND_DOT[k], !kinds.has(k) && 'opacity-40')} />
          {AGENDA_LABEL[k]}
        </Chip>
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const desktop = useIsDesktop();
  const today = useToday();
  const openQuick = useUi((s) => s.openQuick);
  const { src, loading, isError, refetch } = useAgendaSources();
  const [kinds, toggleKind] = useKinds();
  const [sel, setSel] = useState(today);
  const [ym, setYm] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const first = `${ym.year}-${String(ym.month).padStart(2, '0')}-01`;
  const first7 = addDays(first, -7);
  const dots = useMemo(() => kindsByDay(first7, addDays(first, 48), src, kinds), [first7, first, src, kinds]);
  const items = useMemo(() => agendaOn(sel, src, kinds), [sel, src, kinds]);

  const go = (delta: number) => setYm((v) => shiftMonth(v.year, v.month, delta));
  const pick = (d: string) => {
    setSel(d);
    const y = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7));
    if (y !== ym.year || m !== ym.month) setYm({ year: y, month: m });
  };
  const goToday = () => pick(today);
  const title = monthLabel(ym.year, ym.month);

  const arrows = (
    <>
      <IconButton label="Bulan sebelumnya" onClick={() => go(-1)}><Icon.ChevronLeft size={20} /></IconButton>
      <IconButton label="Bulan berikutnya" onClick={() => go(1)}><Icon.ChevronRight size={20} /></IconButton>
    </>
  );

  const agenda = (
    <section aria-live="polite" className="flex flex-col gap-2.5">
      <SectionTitle
        size="sm"
        title={sel === today ? `Hari ini · ${dayLabelComma(sel)}` : dayLabelComma(sel)}
        right={sel !== today ? <SectionLink onClick={goToday}>Ke hari ini</SectionLink> : undefined}
      />
      {isError ? <ErrorState text="Agenda belum bisa dimuat." onRetry={refetch} />
        : loading ? <ListSkeleton rows={3} />
          : items.length ? <AgendaList items={items} />
            : (
              <EmptyState
                compact
                text={kinds.size ? 'Tidak ada agenda di hari ini. Waktunya santai atau nyicil?' : 'Semua sumber disembunyikan. Nyalakan filter di atas.'}
                action={<Button size="xs" onClick={() => openQuick('event', { date: sel })}>+ Event</Button>}
              />
            )}
    </section>
  );

  if (desktop) {
    return (
      <Page>
        <ScreenHeader
          back="/rencana"
          overline="Kalender"
          title={title}
          right={(
            <>
              {arrows}
              <Button variant="secondary" onClick={goToday}>Hari ini</Button>
              <Button className="shadow-day-sel" icon={<Icon.Plus size={18} />} onClick={() => openQuick('event', { date: sel })}>Event baru</Button>
            </>
          )}
        />
        <Columns
          left={(
            <>
              <Card className="p-4">
                <MonthGrid size="xl" year={ym.year} month={ym.month} selected={sel} today={today} onSelect={pick} dots={dots} />
              </Card>
              <Filters kinds={kinds} toggle={toggleKind} />
            </>
          )}
          right={agenda}
        />
      </Page>
    );
  }

  return (
    <div>
      <ScreenHeader back="/rencana" overline="Kalender" title={title} right={arrows} />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        <Card className="px-2.5 py-3">
          <MonthGrid size="lg" year={ym.year} month={ym.month} selected={sel} today={today} onSelect={pick} dots={dots} />
        </Card>
        <Filters kinds={kinds} toggle={toggleKind} />
        {agenda}
      </div>
      <Fab label="Event baru" onClick={() => openQuick('event', { date: sel })} />
    </div>
  );
}
