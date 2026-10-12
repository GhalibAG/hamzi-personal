// Simulasi IPS (KUL-06): chip nilai per matkul → courses.sim_grade; IPS & proyeksi dihitung ulang langsung (cache optimistis).
// "Jadikan nilai resmi" (konfirmasi) menyalin sim_grade → final_grade untuk matkul yang dipilih.
import { useState } from 'react';
import { Link } from 'react-router';
import { formatGpa, type GradeScale } from '@common/calc/index.ts';
import { Button, CheckBox, EmptyState, Sheet, Tag } from '@/components/ui';
import { useUpdate } from '@/data/hooks';
import type { Course } from '@/data/types';
import { cx } from '@/lib/cx';
import { toastUndo, useUi } from '@/stores/ui';
import { simGradeOptions, targetIpsText, type GpaSummary } from '../derive';

interface Props { courses: Course[]; summary: GpaSummary; semIps: number | null; scale: GradeScale; desktop?: boolean }

function GradeChips({ course, options, desktop }: { course: Course; options: string[]; desktop: boolean }) {
  const upd = useUpdate('courses');
  const selected = course.sim_grade ?? course.target_grade ?? null;
  return (
    <div role="group" aria-label={`Nilai simulasi ${course.name}`} className={cx('flex flex-wrap', desktop ? 'gap-1' : 'gap-1.5')}>
      {options.map((g) => {
        const sel = selected === g;
        return (
          <button
            key={g}
            type="button"
            aria-pressed={sel}
            aria-label={`${course.name} nilai ${g}`}
            onClick={() => { if (course.sim_grade !== g) void upd.patch(course.id, { sim_grade: g }); }}
            className={cx(
              'rounded-md font-extrabold transition-colors duration-150',
              desktop ? 'h-8.5 min-w-10 px-2 text-meta-lg' : 'h-9 min-w-11 px-2.5 text-label',
              sel ? 'bg-kuliah-hero text-n-0' : 'border border-line-strong bg-surface text-ink-muted hover:bg-surface-2',
            )}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}

function OfficialSheet({ open, onClose, courses }: { open: boolean; onClose: () => void; courses: Course[] }) {
  const upd = useUpdate('courses');
  const pending = courses.filter((c) => !c.final_grade);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const confirm = async () => {
    const rows = pending.filter((c) => picked.has(c.id) && (c.sim_grade ?? c.target_grade));
    if (!rows.length) return;
    await Promise.all(rows.map((c) => upd.patch(c.id, { final_grade: c.sim_grade ?? c.target_grade })));
    onClose();
    toastUndo(`${rows.length} nilai jadi resmi`, () => { rows.forEach((c) => void upd.patch(c.id, { final_grade: null })); });
  };
  const n = pending.filter((c) => picked.has(c.id)).length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Jadikan nilai resmi"
      closeButton
      footer={<Button size="lg" block disabled={n === 0} onClick={() => void confirm()}>{n ? `Jadikan resmi (${n})` : 'Pilih matkul dulu'}</Button>}
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-body text-ink-2">Pilih matkul yang nilai akhirnya sudah keluar. Nilai resmi masuk ke IPK dan tidak lagi disimulasikan.</p>
        {pending.length === 0 ? (
          <EmptyState compact mood="happy" text="Semua nilai semester ini sudah resmi." />
        ) : (
          <div className="flex flex-col rounded-2xl border border-line">
            {pending.map((c) => {
              const g = c.sim_grade ?? c.target_grade;
              return (
                <div key={c.id} className="flex items-center gap-2 border-b border-line pr-3.5 last:border-b-0">
                  <CheckBox checked={picked.has(c.id)} disabled={!g} onToggle={() => toggle(c.id)} label={`Pilih ${c.name}`} />
                  <span className="flex min-w-0 flex-1 flex-col py-2">
                    <span className="truncate text-body font-bold">{c.name}</span>
                    <span className="text-meta text-ink-3">{c.credits} SKS{g ? '' : ' · belum ada nilai simulasi'}</span>
                  </span>
                  {g && <span className="text-section font-extrabold text-kuliah-hero">{g}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function GradeSimulator({ courses, summary, semIps, scale, desktop = false }: Props) {
  const openQuick = useUi((s) => s.openQuick);
  const [official, setOfficial] = useState(false);
  const options = simGradeOptions(scale);
  const hasPending = courses.some((c) => !c.final_grade);
  const head = (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className={cx('m-0 font-extrabold', desktop ? 'text-card' : 'text-body')}>Simulasi IPS semester ini</h2>
      <span className="tabular shrink-0 text-h2 font-extrabold text-kuliah-hero">IPS {semIps !== null ? formatGpa(semIps) : '–'}</span>
    </div>
  );
  const text = <span className={cx('text-meta text-ink-2', !desktop && '-mt-1.5')}>Ketuk nilai untuk mencoba skenario. {targetIpsText(summary)}</span>;

  if (!courses.length) {
    return (
      <>
        {head}
        <EmptyState compact text="Belum ada mata kuliah di semester ini." action={<Button size="xs" onClick={() => openQuick('course')}>+ Matkul</Button>} />
      </>
    );
  }

  const officialRow = (c: Course) => (
    <span className="flex items-center gap-2">
      <Tag tone="rutinitas">Resmi</Tag>
      <span className="text-section font-extrabold text-kuliah-hero">{c.final_grade}</span>
    </span>
  );

  const body = desktop ? (
    <div className="flex flex-col">
      {courses.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2.5 border-t border-surface-2 py-2">
          <Link to={`/kuliah/matkul/${c.id}`} className="flex min-w-37.5 flex-1 flex-col text-ink no-underline">
            <span className="text-label-lg font-bold">{c.name}</span>
            <span className="text-small text-ink-3">{c.credits} SKS</span>
          </Link>
          {c.final_grade ? officialRow(c) : <GradeChips course={c} options={options} desktop />}
        </div>
      ))}
    </div>
  ) : (
    courses.map((c) => (
      <div key={c.id} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/kuliah/matkul/${c.id}`} className="min-w-0 text-body font-bold text-ink no-underline">{c.name}</Link>
          <span className="shrink-0 text-meta font-semibold text-ink-3">{c.credits} SKS</span>
        </div>
        {c.final_grade ? officialRow(c) : <GradeChips course={c} options={options} desktop={false} />}
      </div>
    ))
  );

  return (
    <>
      {head}
      {text}
      {body}
      {hasPending && (
        <Button variant="secondary" size={desktop ? 'sm' : 'md'} block={!desktop} className={desktop ? 'self-start' : 'mt-1'} onClick={() => setOfficial(true)}>
          Jadikan nilai resmi
        </Button>
      )}
      {official && <OfficialSheet open onClose={() => setOfficial(false)} courses={courses} />}
    </>
  );
}
