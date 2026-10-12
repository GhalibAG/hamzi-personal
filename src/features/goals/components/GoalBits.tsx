import { BULAN_PENDEK } from '@common/format.ts';
import { Tag, type TagTone } from '@/components/ui';
import { GOAL_STATUS_LABEL, type GoalStatus } from '../derive';

const TONE: Record<GoalStatus, TagTone> = {
  selesai: 'masuk', di_jalur: 'rutinitas', terlambat: 'ujian', dibatalkan: 'neutral', tanpa_tenggat: 'neutral',
};

export function GoalStatusTag({ status }: { status: GoalStatus }) {
  return <Tag tone={TONE[status]}>{GOAL_STATUS_LABEL[status]}</Tag>;
}

/** "9 Agu 2027" */
export function shortDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${BULAN_PENDEK[m]} ${y}`;
}
