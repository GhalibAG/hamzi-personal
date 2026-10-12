// Detail target `/keuangan/target/:id` (GOAL-02, GOAL-03, GOAL-07): ring besar, terkumpul/target, kebutuhan per bulan,
// status, riwayat setoran, Setor/Tarik, ubah/selesai/batalkan.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { dayLabelComma } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Button, ButtonLink, Card, Columns, EmptyState, IconButton, ListSkeleton, Menu, Page, Ring, ScreenHeader, SectionTitle, StatTile, Tag,
} from '@/components/ui';
import { useRemove, useRows, useUpdate } from '@/data/hooks';
import type { GoalContribution } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { toastUndo } from '@/stores/ui';
import { GOAL_KIND_LABEL, goalScenarios, goalStatus, goalView } from '../derive';
import { ContributionSheet, GoalFormSheet } from '../components/GoalSheets';
import { GoalStatusTag, shortDate } from '../components/GoalBits';

type SheetState = { kind: 'edit' } | { kind: 'contrib'; mode: 'setor' | 'tarik' } | null;

function HistoryRow({ c, onDelete }: { c: GoalContribution; onDelete: () => void }) {
  const money = useMoney();
  const plus = c.amount > 0;
  return (
    <li className="flex items-center gap-3 border-b border-surface-2 py-1 last:border-b-0">
      <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-lg', plus ? 'bg-target-bg text-target-fg' : 'bg-surface-2 text-ink-muted')}>
        {plus ? <Icon.ArrowDown size={18} /> : <Icon.ArrowUp size={18} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-bold">{plus ? 'Setor' : 'Tarik'}</span>
        <span className="truncate text-meta text-ink-3">{[dayLabelComma(c.contributed_at), c.note].filter(Boolean).join(' · ')}</span>
      </span>
      <span className={cx('tabular text-body font-extrabold', plus ? 'text-primary' : 'text-ink')}>{plus ? '+' : '−'}{money.rp(Math.abs(c.amount))}</span>
      <IconButton variant="plain" label={`Hapus ${plus ? 'setoran' : 'penarikan'} ${dayLabelComma(c.contributed_at)}`} onClick={onDelete} className="text-ink-3">
        <Icon.Trash size={18} />
      </IconButton>
    </li>
  );
}

export default function GoalDetailPage() {
  const { id = '' } = useParams();
  const desktop = useIsDesktop();
  const today = useToday();
  const money = useMoney();
  const nav = useNavigate();
  const goalsQ = useRows('savings_goals');
  const contributions = useRows('goal_contributions').rows;
  const updGoal = useUpdate('savings_goals');
  const removeGoal = useRemove('savings_goals');
  const removeContrib = useRemove('goal_contributions');
  const [sheet, setSheet] = useState<SheetState>(null);
  const goal = goalsQ.rows.find((g) => g.id === id);

  if (goalsQ.isLoading) return <Page narrow><ScreenHeader back="/keuangan/target" title="Target" /><div className="px-4 pt-4 lg:px-0"><ListSkeleton rows={3} /></div></Page>;
  if (!goal) {
    return (
      <Page narrow>
        <ScreenHeader back="/keuangan/target" title="Target" />
        <div className="px-4 pt-4 lg:px-0">
          <EmptyState mood="worried" title="Target tidak ditemukan" text="Mungkin sudah dihapus." action={<ButtonLink to="/keuangan/target" size="sm">Lihat semua target</ButtonLink>} />
        </div>
      </Page>
    );
  }

  const v = goalView(goal, contributions, today);
  const status = goalStatus(v, today);
  const history = contributions.filter((c) => c.goal_id === goal.id && !c.deleted_at).sort((a, b) => b.contributed_at.localeCompare(a.contributed_at) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const active = goal.status === 'aktif';

  const setStatus = (s: 'aktif' | 'selesai' | 'dibatalkan') => {
    const prev = goal.status;
    void updGoal.patch(goal.id, { status: s });
    toastUndo(s === 'selesai' ? 'Target ditandai selesai.' : s === 'dibatalkan' ? 'Target dibatalkan.' : 'Target aktif lagi.', () => void updGoal.patch(goal.id, { status: prev }));
  };
  const del = () => {
    void removeGoal.remove(goal.id);
    nav('/keuangan/target');
    toastUndo(`Target "${goal.name}" dihapus.`, () => void removeGoal.undo(goal.id));
  };
  const delContrib = (c: GoalContribution) => {
    void removeContrib.remove(c.id);
    toastUndo('Riwayat dihapus.', () => void removeContrib.undo(c.id));
  };

  const neededText = status === 'selesai' ? 'Tercapai' : v.monthly !== null ? money.rp(v.monthly) : '–';
  const ringSize = desktop ? 220 : 200;

  const hero = (
    <Card className="flex flex-col items-center gap-3 rounded-5xl p-5 text-center">
      <Ring value={v.pct} size={ringSize} stroke={12} label={`${goal.name} ${v.pct} persen terkumpul`} textClass="flex flex-col items-center">
        <span className="tabular text-display-xl leading-none font-extrabold">{v.pct}%</span>
        <span className="mt-1 text-meta font-semibold text-ink-3">terkumpul</span>
      </Ring>
      <div className="flex flex-col gap-0.5">
        <span className="tabular text-h2 font-extrabold">{money.rp(v.saved)}</span>
        <span className="text-label text-ink-2">dari <span className="tabular font-bold">{money.rp(goal.target_amount)}</span></span>
      </div>
      <GoalStatusTag status={status} />
      {active && (
        <div className="grid w-full grid-cols-2 gap-2 pt-1">
          <Button onClick={() => setSheet({ kind: 'contrib', mode: 'setor' })} icon={<Icon.Plus size={18} />}>Setor</Button>
          <Button variant="secondary" onClick={() => setSheet({ kind: 'contrib', mode: 'tarik' })} disabled={v.saved <= 0} icon={<Icon.Minus size={18} />}>Tarik</Button>
        </div>
      )}
      {active && status === 'selesai' && (
        <Button variant="soft" size="sm" onClick={() => setStatus('selesai')} icon={<Icon.Check size={16} />}>Tandai selesai</Button>
      )}
    </Card>
  );

  const tiles = (
    <div className="grid grid-cols-2 gap-2">
      <StatTile tone="soft" label="Butuh per bulan" value={<span className="tabular">{neededText}</span>} sub={v.monthsLeft && status !== 'selesai' ? <span className="text-micro text-brand-800">{v.monthsLeft} bulan lagi</span> : undefined} />
      <StatTile tone="plain" label="Rencana setoran" value={<span className="tabular">{goal.monthly_plan ? money.rp(goal.monthly_plan) : '–'}</span>} sub={goal.monthly_plan && goal.plan_day ? <span className="text-micro text-ink-3">tiap tgl {goal.plan_day}</span> : undefined} />
      <StatTile tone="plain" label="Tenggat" value={goal.due_date ? shortDate(goal.due_date) : 'Tanpa tenggat'} />
      <StatTile tone="plain" label="Asumsi imbal hasil" value={`${String(goal.assumed_return_pct).replace('.', ',')}%/thn`} />
    </div>
  );

  const note = v.onTrack === false && active ? (
    <p className="m-0 flex items-start gap-2 rounded-lg bg-warn-banner px-3 py-2.5 text-label text-warn-fg">
      <Icon.Alert size={16} className="mt-0.5 shrink-0" />
      Rencana setoranmu {money.rp(goal.monthly_plan ?? 0)}/bulan masih kurang dari kebutuhan {money.rp(v.monthly ?? 0)}/bulan. Naikkan setoran atau mundurkan tenggat.
    </p>
  ) : null;

  const sc = goal.status === 'aktif' ? goalScenarios(v, contributions, today) : null;
  const scenarios = sc ? (
    <section aria-label="Proyeksi 3 skenario" className="flex flex-col gap-2.5">
      <SectionTitle title="Proyeksi 3 skenario" right={<span className="text-meta text-ink-3">{goal.due_date ? `sampai ${shortDate(goal.due_date)}` : `${sc.horizon} bulan`}</span>} />
      <Card className="px-3.5 py-1">
        <ul className="m-0 list-none p-0">
          {sc.items.map((x) => (
            <li key={x.key} className="flex items-center gap-3 border-b border-surface-2 py-3 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body font-bold">{x.label}</span>
                <span className="text-meta text-ink-3">
                  setor <span className="tabular">{money.rp(x.monthly)}</span>/bln · imbal {String(x.annualPct).replace('.', ',')}%/thn
                  {x.reachMonths ? ` · tercapai ±${x.reachMonths} bln` : ''}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="tabular text-body font-extrabold">{money.rp(x.projected)}</span>
                <Tag tone={x.reached ? 'masuk' : 'ujian'}>{x.reached ? 'Tercapai' : 'Belum tercapai'}</Tag>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  ) : null;

  const historyBlock = (
    <section aria-label="Riwayat setoran" className="flex flex-col gap-2.5">
      <SectionTitle title="Riwayat setoran" right={<span className="text-meta text-ink-3">{history.length} catatan</span>} />
      {history.length ? (
        <Card className="px-3.5 py-1"><ul className="m-0 list-none p-0">{history.map((c) => <HistoryRow key={c.id} c={c} onDelete={() => delContrib(c)} />)}</ul></Card>
      ) : (
        <EmptyState compact text="Belum ada setoran. Setor pertama, sekecil apa pun!" action={active ? <Button size="xs" onClick={() => setSheet({ kind: 'contrib', mode: 'setor' })}>Setor</Button> : undefined} />
      )}
      <p className="m-0 text-meta text-ink-3">Kebutuhan per bulan dan proyeksi adalah perkiraan, bukan jaminan.</p>
    </section>
  );

  return (
    <Page>
      <ScreenHeader
        back="/keuangan/target"
        overline={`Target · ${GOAL_KIND_LABEL[goal.kind]}`}
        title={goal.name}
        right={
          <>
            <IconButton label="Ubah target" onClick={() => setSheet({ kind: 'edit' })}><Icon.Edit size={20} /></IconButton>
            <Menu
              trigger={({ open, toggle }) => <IconButton label="Menu lainnya" aria-expanded={open} onClick={toggle}><Icon.More size={20} /></IconButton>}
              items={[
                ...(goal.status !== 'selesai' ? [{ label: 'Tandai selesai', onSelect: () => setStatus('selesai') }] : []),
                ...(goal.status !== 'aktif' ? [{ label: 'Aktifkan lagi', onSelect: () => setStatus('aktif') }] : []),
                ...(goal.status === 'aktif' ? [{ label: 'Batalkan target', onSelect: () => setStatus('dibatalkan') }] : []),
                { label: 'Hapus target', danger: true, onSelect: del },
              ]}
            />
          </>
        }
      />
      {desktop ? (
        <Columns left={<>{hero}{note}{tiles}</>} right={<>{scenarios}{historyBlock}</>} />
      ) : (
        <div className="flex flex-col gap-4 px-4 pt-4">{hero}{note}{tiles}{scenarios}{historyBlock}</div>
      )}
      {sheet?.kind === 'edit' && <GoalFormSheet open onClose={() => setSheet(null)} editing={goal} />}
      {sheet?.kind === 'contrib' && <ContributionSheet open onClose={() => setSheet(null)} goal={goal} mode={sheet.mode} />}
    </Page>
  );
}
