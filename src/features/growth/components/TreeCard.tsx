// Kartu pohon (TUM-01, UI-SPEC §6.2): Tree + POHONMU + tahap + bar + "N tetes lagi jadi …" + chip "+1 tetes air".
import { Tree } from '@/components/tree/Tree';
import { DecoCircle, ProgressBar } from '@/components/ui';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/cx';
import type { GrowthOverview } from '../derive';
import { useJustWatered } from '../hooks';

function growText(g: GrowthOverview): string {
  return g.stage.nextName ? `${g.stage.toNext} tetes lagi jadi ${g.stage.nextName}` : 'Sudah tahap tertinggi. Kebunmu bertambah tiap bulan.';
}

function WateredChip({ center = false }: { center?: boolean }) {
  const watered = useJustWatered();
  return (
    <span role="status" className={cx('relative flex', center ? 'self-center' : 'self-start', !watered && '-mt-1.5')}>
      {watered && (
        <span className="inline-flex animate-pop-in items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-meta font-extrabold text-info-fg">
          <Icon.Drop size={13} strokeWidth={2.2} />+1 tetes air
        </span>
      )}
    </span>
  );
}

export function StreakChip({ n }: { n: number }) {
  return (
    <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-danger-tint px-3.5 text-body font-extrabold text-danger-fg" aria-label={`Streak ${n} hari`}>
      <Icon.Flame size={18} />
      <span aria-hidden="true">{n} hari</span>
    </span>
  );
}

export function TreeCard({ g, variant = 'mobile', className }: { g: GrowthOverview; variant?: 'mobile' | 'desktop'; className?: string }) {
  const bloom = g.today.bloom;
  const aria = `Pohon tahap ${g.stage.name}, ${g.waterTotal} tetes air${bloom ? ', berbunga hari ini' : ''}`;
  if (variant === 'desktop') {
    return (
      <div className={cx('relative flex flex-col items-center gap-1.5 overflow-hidden rounded-6xl bg-primary-soft px-4.5 pt-4 pb-4.5', className)}>
        <DecoCircle className="-top-15 -right-12.5 size-45 bg-brand-100" />
        <Tree stage={g.stage.index} bloom={bloom} width={240} height={228} label={aria} className="relative" />
        <span className="relative text-micro font-bold tracking-[0.5px] text-brand-800 uppercase">Pohonmu</span>
        <span className="relative text-name font-extrabold">{g.stage.name}</span>
        <ProgressBar className="relative w-full max-w-70" value={g.stage.progressPct} track="white" label={`Progres ke tahap ${g.stage.nextName ?? 'tertinggi'}`} />
        <span className="relative text-meta-lg font-semibold text-brand-800">{growText(g)}</span>
        <WateredChip center />
      </div>
    );
  }
  return (
    <div className={cx('relative mx-4 mt-3.5 flex items-end gap-2 overflow-hidden rounded-6xl bg-primary-soft px-4 pt-3.5 pb-4', className)}>
      <DecoCircle className="-top-12.5 -right-10 size-35 bg-brand-100" />
      <Tree stage={g.stage.index} bloom={bloom} width={170} height={160} label={aria} className="relative shrink-0" />
      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5 pb-1.5">
        <span className="text-micro font-bold tracking-[0.5px] text-brand-800 uppercase">Pohonmu</span>
        <span className="text-stage leading-[1.2] font-extrabold">{g.stage.name}</span>
        <ProgressBar value={g.stage.progressPct} track="white" label={`Progres ke tahap ${g.stage.nextName ?? 'tertinggi'}`} />
        <span className="text-meta font-semibold text-brand-800">{growText(g)}</span>
        <WateredChip />
      </div>
    </div>
  );
}
