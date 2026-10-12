// Tipe baris tabel (mengikuti TECH-SPEC §5). Uang = number integer rupiah.
export interface Base { id: string; user_id?: string; created_at?: string; updated_at?: string; deleted_at?: string | null }

export interface Profile { id: string; display_name: string; onboarded_at: string | null; timezone?: string }

export interface Settings {
  user_id?: string;
  theme: 'light' | 'dark' | 'system';
  budget_cycle_day: number;
  quiet_start: string;
  quiet_end: string;
  hide_amounts: boolean;
  minimal_mode: boolean;
  eye_mirror: boolean;
  curriculum_credits: number;
  target_gpa: number | null;
  default_focus_min: number;
  water_from_tasks: boolean;
  ai_enabled: boolean;
  ai_chat_enabled: boolean;
  chat_privacy_ack: boolean;
  ai_share: Record<string, boolean>;
  grade_scale: Record<string, number>;
  grade_ranges: [string, number][];
  system_notif: Record<string, boolean>;
  last_backup_at: string | null;
}

export interface Project extends Base {
  name: string; description?: string | null; kind: 'kuliah' | 'pribadi' | 'skill' | 'lomba';
  status: 'aktif' | 'ditunda' | 'selesai'; color?: string | null; due_date?: string | null;
}
export interface Milestone extends Base { project_id: string; title: string; due_date?: string | null; status: 'belum' | 'berjalan' | 'selesai'; sort: number }

export type SourceTag = 'kuliah' | 'belajar' | 'keuangan' | 'pribadi' | 'proyek';
export interface Task extends Base {
  title: string; notes?: string | null;
  status: 'belum' | 'dikerjakan' | 'selesai' | 'dibatalkan';
  priority: 1 | 2 | 3 | 4; source_tag: SourceTag;
  due_at?: string | null; all_day?: boolean;
  project_id?: string | null; milestone_id?: string | null; course_id?: string | null;
  course_task_kind?: string | null; weight_pct?: number | null; estimate_min?: number | null;
  recurrence?: { freq: string; interval: number; by_day?: number[]; day_of_month?: number } | null;
  recurrence_parent_id?: string | null;
  remind_offsets?: number[]; completed_at?: string | null;
}
export interface Subtask extends Base { task_id: string; title: string; done: boolean; sort: number }
export interface CalEvent extends Base { title: string; starts_at: string; ends_at?: string | null; all_day: boolean; notes?: string | null }

export interface Routine extends Base {
  name: string; kind: 'check' | 'count'; target_count: number; is_required: boolean;
  repeat_days: number[]; remind_at?: string | null; remind_enabled: boolean;
  icon?: string | null; color?: string | null; sort: number; archived: boolean;
}
export interface RoutineLog extends Base { routine_id: string; log_date: string; value: number; done: boolean }

export interface LearningModule extends Base {
  title: string; category: string; color_index: number; weekly_target_min: number;
  remind_at?: string | null; remind_days: number[]; remind_enabled: boolean;
  status: 'aktif' | 'ditunda' | 'selesai'; template_key?: string | null; sort: number;
}
export interface LearningUnit extends Base {
  module_id: string; title: string; kind: 'video' | 'bacaan' | 'latihan' | 'proyek' | 'kuis';
  url?: string | null; est_min: number; status: 'belum' | 'sedang' | 'selesai'; notes?: string | null;
  completed_at?: string | null; sort: number;
}
export interface StudySession extends Base {
  started_at: string; duration_min: number; started_on: string;
  module_id?: string | null; unit_id?: string | null; course_id?: string | null; source: 'timer' | 'manual';
}
export interface WaterEvent extends Base { source: 'routine' | 'study' | 'task'; ref_id: string; day: string }
export interface XpEvent extends Base { kind: string; ref_id: string; day: string; xp: number }
export interface UserStats { user_id?: string; xp_total: number; level: number }

export interface Wallet extends Base { name: string; kind: 'cash' | 'bank' | 'ewallet' | 'other'; icon?: string | null; color?: string | null; opening_balance: number; is_default: boolean; archived: boolean; sort: number }
export interface Category extends Base { kind: 'expense' | 'income'; name: string; icon?: string | null; color?: string | null; sort: number; archived: boolean; is_default: boolean }
export interface Transaction extends Base {
  kind: 'expense' | 'income' | 'transfer' | 'adjustment'; amount: number; direction: 1 | -1;
  wallet_id: string; to_wallet_id?: string | null; category_id?: string | null;
  occurred_at: string; occurred_on: string; note?: string | null; recurring_rule_id?: string | null;
}
export interface Budget extends Base { category_id: string | null; amount: number; effective_from: string }
export interface RecurringRule extends Base {
  template: { kind: 'expense' | 'income'; amount: number; wallet_id: string; category_id: string | null; note?: string | null };
  freq: 'daily' | 'weekly' | 'monthly'; interval_n: number; by_day?: number[] | null; day_of_month?: number | null;
  next_run: string; auto_post: boolean; active: boolean;
}

export interface Semester extends Base { number: number; label: string; start_date: string; end_date: string; is_active: boolean }
export interface Course extends Base {
  semester_id: string; code?: string | null; name: string; credits: number; lecturer?: string | null; room?: string | null;
  color?: string | null; target_grade?: string | null; min_attendance_pct: number; final_grade?: string | null; sim_grade?: string | null;
}
export interface CourseSchedule extends Base { course_id: string; weekday: number; start_time: string; end_time: string; room?: string | null }
export interface Attendance extends Base { course_id: string; meeting_date: string; status: 'hadir' | 'izin' | 'sakit' | 'alpa'; note?: string | null }
export interface GradeComponent extends Base { course_id: string; name: string; weight_pct: number; score: number | null }
export interface Exam extends Base { course_id: string; kind: 'kuis' | 'uts' | 'uas' | 'praktikum'; starts_at: string; material?: string | null; room?: string | null; prep_status: string }

export interface SavingsGoal extends Base {
  name: string; kind: 'dana_darurat' | 'barang' | 'pendidikan' | 'investasi' | 'lainnya'; target_amount: number;
  due_date?: string | null; icon?: string | null; color?: string | null; priority: number; assumed_return_pct: number;
  status: 'aktif' | 'selesai' | 'dibatalkan'; emergency_months?: number | null; monthly_plan?: number | null; plan_day?: number | null;
}
export interface GoalContribution extends Base { goal_id: string; amount: number; contributed_at: string; note?: string | null }
export interface Asset extends Base { name: string; asset_class: string; platform_label?: string | null; archived: boolean }
export interface AssetTransaction extends Base { asset_id: string; kind: 'beli' | 'jual' | 'setor' | 'tarik'; amount: number; occurred_on: string }
export interface AssetValuation extends Base { asset_id: string; valued_on: string; value: number }

export interface PushSubscriptionRow extends Base { endpoint: string; p256dh: string; auth: string; user_agent?: string | null }
export interface ScheduledNotification extends Base {
  category: 'user' | 'system'; kind: string; ref_type?: string | null; ref_id?: string | null; dedupe_key: string;
  fire_at: string; title: string; body: string; url: string; actions: { action: string; title: string }[];
  status: 'pending' | 'sent' | 'failed' | 'skipped'; attempts?: number; sent_at?: string | null; read_at?: string | null;
}

export interface AiConversation extends Base { title?: string | null }
export interface AiMessage extends Base {
  conversation_id: string; role: 'user' | 'assistant'; content: string;
  attachments: { path: string; mime: string; name: string; size: number; pages?: number }[];
  proposals?: import('@common/schemas.ts').Proposals | null;
  tools_used?: unknown[]; sent_payload?: unknown; provider?: string | null; model?: string | null;
  status: 'ok' | 'error' | 'fallback' | 'limited';
}
export interface AiAction extends Base { message_id: string; state: 'pending' | 'applied' | 'cancelled' | 'undone'; applied_refs: { table: string; id: string; item?: number }[] }
export interface AiRequest extends Base { kind: string; cache_key: string; payload: unknown; response: unknown; provider?: string | null; model?: string | null; status: string; feedback?: -1 | 1 | null; error?: string | null }

export interface Tables {
  projects: Project; milestones: Milestone; tasks: Task; subtasks: Subtask; events: CalEvent;
  routines: Routine; routine_logs: RoutineLog; learning_modules: LearningModule; learning_units: LearningUnit;
  study_sessions: StudySession; water_events: WaterEvent; xp_events: XpEvent;
  wallets: Wallet; categories: Category; transactions: Transaction; budgets: Budget; recurring_rules: RecurringRule;
  semesters: Semester; courses: Course; course_schedules: CourseSchedule; attendances: Attendance; exams: Exam; grade_components: GradeComponent;
  savings_goals: SavingsGoal; goal_contributions: GoalContribution; assets: Asset; asset_transactions: AssetTransaction; asset_valuations: AssetValuation;
  scheduled_notifications: ScheduledNotification; push_subscriptions: PushSubscriptionRow;
  ai_conversations: AiConversation; ai_messages: AiMessage; ai_actions: AiAction; ai_requests: AiRequest;
}
export type TableName = keyof Tables;

/** Tabel yang memakai soft delete (`deleted_at`). */
export const SOFT_DELETE: TableName[] = [
  'projects', 'milestones', 'tasks', 'events', 'routines', 'learning_modules', 'semesters', 'courses', 'exams',
  'transactions', 'savings_goals', 'goal_contributions', 'ai_conversations',
];
