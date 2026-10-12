// Susun `proposals` (TECH-SPEC §7.8.5) dari panggilan propose_*: validasi zod, label & detail dari proposal-format.ts.
import { PROPOSE_SCHEMAS, type ProposalItem, type Proposals, type ProposeTool } from '@common/schemas.ts';
import { proposalDetail, proposalKind, proposalLabel } from '@common/proposal-format.ts';

export interface ProposalCall { tool: ProposeTool; args: Record<string, unknown>; selected?: boolean }

/** Validasi argumen satu alat; mengembalikan argumen setelah default zod diterapkan. */
export function validateArgs(tool: ProposeTool, args: unknown): Record<string, unknown> | null {
  const schema = PROPOSE_SCHEMAS[tool];
  if (!schema) return null;
  const r = schema.safeParse(args);
  return r.success ? (r.data as Record<string, unknown>) : null;
}

const DEST_ORDER = ['Rencana', 'Kuliah', 'Keuangan', 'Tumbuh', 'Kalender', 'Target'] as const;

function destsOf(item: Pick<ProposalItem, 'tool' | 'args'>): string[] {
  switch (item.tool) {
    case 'propose_task': return item.args.course_name ? ['Rencana', 'Kuliah'] : ['Rencana'];
    case 'propose_exam':
    case 'propose_class_schedule': return ['Kuliah'];
    case 'propose_routine':
    case 'propose_learning_module': return ['Tumbuh'];
    case 'propose_transaction': return ['Keuangan'];
    case 'propose_event': return ['Kalender'];
    case 'propose_goal_contribution': return ['Target'];
  }
}

/** "Rencana", "Rencana & Kuliah", "Rencana, Kuliah & Tumbuh". */
export function proposalDest(items: Pick<ProposalItem, 'tool' | 'args'>[]): string {
  const set = new Set(items.flatMap(destsOf));
  const list = DEST_ORDER.filter((d) => set.has(d));
  if (list.length <= 1) return list[0] ?? 'Hamzi';
  return `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
}

const SINGLE_TITLE: Record<ProposeTool, string> = {
  propose_task: 'Tugas baru',
  propose_routine: 'Rutinitas baru',
  propose_learning_module: 'Modul belajar baru',
  propose_transaction: 'Catat pengeluaran',
  propose_exam: 'Ujian baru',
  propose_class_schedule: 'Jadwal kelas baru',
  propose_event: 'Event baru',
  propose_goal_contribution: 'Setoran target',
};

/** Judul kartu (TECH-SPEC §7.8.5). */
export function proposalTitle(items: Pick<ProposalItem, 'tool' | 'args'>[], fileName?: string): string {
  if (fileName) return `Usulan dari ${fileName.replace(/\.[a-z0-9]+$/i, '')} (${items.length})`;
  const tools = new Set(items.map((i) => i.tool));
  if (tools.size === 1) {
    const tool = items[0].tool;
    if (tool === 'propose_routine' && items.every((i) => i.args.is_required !== false)) return 'Rutinitas wajib baru';
    if (tool === 'propose_transaction' && items.every((i) => i.args.kind === 'income')) return 'Catat pemasukan';
    if (items.length === 1) return SINGLE_TITLE[tool];
  }
  return `Usulan (${items.length})`;
}

export function buildProposals(
  calls: ProposalCall[],
  ctx: { today: string; defaultWallet?: string; fileName?: string },
): { proposals: Proposals | null; invalid: number } {
  const items: ProposalItem[] = [];
  let invalid = 0;
  for (const c of calls) {
    const args = validateArgs(c.tool, c.args);
    if (!args) { invalid++; continue; }
    items.push({
      tool: c.tool,
      args,
      kind: proposalKind(c.tool, args),
      label: proposalLabel(c.tool, args),
      detail: proposalDetail(c.tool, args, { today: ctx.today, defaultWallet: ctx.defaultWallet }),
      selected: c.selected ?? true,
    });
  }
  if (!items.length) return { proposals: null, invalid };
  return {
    proposals: { title: proposalTitle(items, ctx.fileName), dest: proposalDest(items), items },
    invalid,
  };
}
