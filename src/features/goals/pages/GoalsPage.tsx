// Target tabungan `/keuangan/target` (GOAL-01…03, GOAL-05): daftar target + tambah (sheet). `?baru=1` membuka form.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Icon } from '@/components/icons';
import { Button, EmptyState, ErrorState, ListSkeleton, Page, ProgressBar, Ring, ScreenHeader, SectionTitle } from '@/components/ui';
import { useRows } from '@/data/hooks';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { GoalGlyph } from '@/features/finance/components/bits';
import { GOAL_KIND_LABEL, goalStatus, goalView, type GoalView } from '../derive';
import { GoalFormSheet } from '../components/GoalSheets';
import { GoalStatusTag, shortDate } from '../components/GoalBits';

function GoalCard({ v, today }: { v: GoalView; today: string }) {
  const money = useMoney();
  const status = goalStatus(v, today);
  const done = status === 'selesai' || status === 'dibatalkan';
  return (
    <Link to={`/keuangan/target/${v.goal.id}`} className="flex items-center gap-3.5 rounded-3xl border border-line bg-surface p-3.5 text-ink no-underline hover:bg-surface-2">
      <Ring value={v.pct} label={`${v.goal.name} ${v.pct} persen`}>{v.pct}%</Ring>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-target-bg text-target-fg"><GoalGlyph goal={v.goal} size={14} /></span>
          <span className={cx('truncate text-card font-bold', done && status === 'dibatalkan' && 'text-ink-3')}>{v.goal.name}</span>
        </span>
        <span className="tabular text-label text-ink-2">{money.rp(v.saved)} <span className="text-ink-3">/ {money.rp(v.goal.target_amount)}</span></span>
        <span className="flex flex-wrap items-center gap-1.5">
          <GoalStatusTag status={status} />
          <span className="text-meta text-ink-3">
            {[
              GOAL_KIND_LABEL[v.goal.kind],
              !done && v.monthly ? `butuh ${money.short(v.monthly)}/bln` : null,
              v.goal.due_date ? `tenggat ${shortDate(v.goal.due_date)}` : null,
            ].filter(Boolean).join(' · ')}
          </span>
        </span>
      </span>
      <Icon.ChevronRight size={18} className="shrink-0 text-ink-3" />
    </Link>
  );
}

export default function GoalsPage() {
  const desktop = useIsDesktop();
  const today = useToday();
  const nav = useNavigate();
  const money = useMoney();
  const [params, setParams] = useSearchParams();
  const goalsQ = useRows('savings_goals');
  const contributions = useRows('goal_contributions').rows;
  const [formOpen, setFormOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (params.get('baru')) {
      setFormOpen(true);
      params.delete('baru');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const views = goalsQ.rows.filter((g) => !g.deleted_at).sort((a, b) => a.priority - b.priority).map((g) => goalView(g, contributions, today));
  const active = views.filter((v) => v.goal.status === 'aktif');
  const closed = views.filter((v) => v.goal.status !== 'aktif');
  const totalSaved = active.reduce((s, v) => s + v.saved, 0);
  const totalTarget = active.reduce((s, v) => s + v.goal.target_amount, 0);

  return (
    <Page narrow>
      <ScreenHeader
        back="/keuangan"
        overline="Keuangan"
        title="Target"
        right={<Button size={desktop ? 'md' : 'sm'} icon={<Icon.Plus size={18} />} onClick={() => setFormOpen(true)}>Target</Button>}
      />
      <div className="flex flex-col gap-4 px-4 pt-4 lg:px-0 lg:pt-0">
        {goalsQ.isError && <ErrorState onRetry={() => void goalsQ.refetch()} />}
        {goalsQ.isLoading ? <ListSkeleton rows={3} /> : (
          <>
            {active.length > 0 && (
              <div className="flex flex-col gap-2 rounded-3xl bg-target-bg p-4">
                <span className="text-meta font-semibold text-warn-strong">Terkumpul di {active.length} target aktif</span>
                <span className="tabular text-h2 font-extrabold">{money.rp(totalSaved)} <span className="text-label font-semibold text-ink-2">dari {money.rp(totalTarget)}</span></span>
                <ProgressBar value={totalTarget ? (totalSaved / totalTarget) * 100 : 0} color="target" track="white" height={8} label="Total progres target" />
              </div>
            )}
            {active.length ? (
              <div className={cx('grid gap-2.5', desktop && 'grid-cols-2')}>{active.map((v) => <GoalCard key={v.goal.id} v={v} today={today} />)}</div>
            ) : (
              <EmptyState
                mood="happy"
                title="Belum ada target aktif"
                text="Mulai dari dana darurat atau barang impian. Hamzi bantu hitung tabungan per bulannya."
                action={<Button size="sm" onClick={() => setFormOpen(true)}>+ Buat target</Button>}
              />
            )}
            {closed.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle
                  size="sm"
                  title={`Selesai & dibatalkan (${closed.length})`}
                  right={<button type="button" aria-expanded={showDone} onClick={() => setShowDone((x) => !x)} className="flex h-11 items-center bg-transparent text-label font-bold text-primary">{showDone ? 'Sembunyikan' : 'Tampilkan'}</button>}
                />
                {showDone && <div className={cx('grid gap-2.5', desktop && 'grid-cols-2')}>{closed.map((v) => <GoalCard key={v.goal.id} v={v} today={today} />)}</div>}
              </section>
            )}
          </>
        )}
      </div>
      {formOpen && <GoalFormSheet open onClose={() => setFormOpen(false)} onSaved={(id) => nav(`/keuangan/target/${id}`)} />}
    </Page>
  );
}
