// Onboarding `/onboarding` (AUTH-04, UI-SPEC §12): satu langkah per layar, indikator titik, Hamzi menyapa.
// 1 nama · 2 semester (opsional) · 3 saran rutinitas (TECH-SPEC §15, hanya yang dicentang) · 4 siklus & anggaran (+ saldo dompet awal)
// · 5 pasang ke layar utama + aktifkan pengingat · 6 panduan baterai + coba pengingat → onboarded_at.
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { cycleStart, repeatLabel } from '@common/calc/index.ts';
import { thousands } from '@common/format.ts';
import type { Mood } from '@common/lines.id.ts';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button, CheckBox, ErrorState, Field, IconButton, inputCls, Skeleton } from '@/components/ui';
import {
  useProfile, useRows, useSettings, useUpdateProfile, useUpdateSettings, useUpsert,
} from '@/data/hooks';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { BatteryGuide } from '@/features/notifications/components/BatteryGuide';
import { InstallHint } from '@/features/notifications/components/InstallHint';
import { useTestReminder } from '@/features/notifications/hooks';
import { enableNotifications, notifPermission, type PermissionState } from '@/features/notifications/push';
import { ReminderEngine } from '@/features/notifications/ReminderEngine';
import { AuthCard } from '../components/AuthFrame';

const STEPS: { title: string; mood: Mood; line: string }[] = [
  { title: 'Kenalan dulu', mood: 'happy', line: 'Halo! Aku Hamzi, teman kecil untuk rencanamu. Kamu mau dipanggil siapa?' },
  { title: 'Semester sekarang', mood: 'calm', line: 'Kamu kuliah semester berapa? Boleh dilewati dulu.' },
  { title: 'Rutinitas pertama', mood: 'excited', line: 'Pilih rutinitas yang mau kamu bangun. Tiap centang menyiram pohonmu.' },
  { title: 'Anggaran bulanan', mood: 'calm', line: 'Berapa anggaranmu sebulan? Aku bantu jaga sampai akhir bulan.' },
  { title: 'Pasang & izinkan pengingat', mood: 'focus', line: 'Pasang aku di layar utama supaya pengingat tetap sampai.' },
  { title: 'Panduan baterai', mood: 'worried', line: 'HP suka menahan notifikasi demi baterai. Atur sekali saja ya.' },
];

/** Saran rutinitas (TECH-SPEC §15) — tidak dibuat otomatis. */
const ROUTINE_SUGGESTIONS = [
  { name: 'Bangun sebelum 05:30', remind_at: '05:00', repeat_days: [1, 2, 3, 4, 5, 6, 7] },
  { name: 'Olahraga 20 menit', remind_at: '06:00', repeat_days: [1, 2, 3, 4, 5] },
  { name: 'Catat pengeluaran hari ini', remind_at: '21:00', repeat_days: [1, 2, 3, 4, 5, 6, 7] },
  { name: 'Tidur sebelum 23:00', remind_at: '22:30', repeat_days: [1, 2, 3, 4, 5, 6, 7] },
];

/** Semester bawaan dari tanggal hari ini (Ganjil: Agu–Jan, Genap: Feb–Jul). */
function defaultSemester(today: string) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (m >= 8) return { label: `Ganjil ${y}/${y + 1}`, start: `${y}-08-01`, end: `${y + 1}-01-31` };
  if (m === 1) return { label: `Ganjil ${y - 1}/${y}`, start: `${y - 1}-08-01`, end: `${y}-01-31` };
  return { label: `Genap ${y - 1}/${y}`, start: `${y}-02-01`, end: `${y}-07-31` };
}

const digits = (s: string) => Number(s.replace(/\D/g, '').slice(0, 13) || '0');
const moneyInput = (s: string) => { const n = digits(s); return n ? thousands(n) : ''; };

function Dots({ step }: { step: number }) {
  return (
    <ol aria-label={`Langkah ${step + 1} dari ${STEPS.length}`} className="m-0 flex flex-1 list-none items-center justify-center gap-1.5 p-0">
      {STEPS.map((s, i) => (
        <li
          key={s.title}
          aria-current={i === step ? 'step' : undefined}
          className={cx('h-2 rounded-full transition-all', i === step ? 'w-6 bg-primary' : i < step ? 'w-2 bg-brand-300' : 'w-2 bg-line-strong')}
        />
      ))}
    </ol>
  );
}

export default function OnboardingPage() {
  const desktop = useIsDesktop();
  const nav = useNavigate();
  const today = useToday();
  const profile = useProfile();
  const settings = useSettings();
  const updProfile = useUpdateProfile();
  const updSettings = useUpdateSettings();
  const semesters = useRows('semesters');
  const routines = useRows('routines');
  const budgets = useRows('budgets');
  const wallets = useRows('wallets');
  const txs = useRows('transactions');
  const saveSemester = useUpsert('semesters');
  const saveRoutines = useUpsert('routines');
  const saveBudget = useUpsert('budgets');
  const saveWallet = useUpsert('wallets');
  const test = useTestReminder();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const sem0 = defaultSemester(today);
  const [semNo, setSemNo] = useState('1');
  const [semLabel, setSemLabel] = useState(sem0.label);
  const [semStart, setSemStart] = useState(sem0.start);
  const [semEnd, setSemEnd] = useState(sem0.end);
  const [picked, setPicked] = useState<string[]>([]);
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [budget, setBudget] = useState('');
  const [balance, setBalance] = useState('');
  const [perm, setPerm] = useState<PermissionState>(() => notifPermission());
  const [permMsg, setPermMsg] = useState<string | null>(null);

  if (profile.isLoading) {
    const sk = <div className="flex flex-col gap-4 p-6"><Skeleton className="h-24" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>;
    return desktop ? <AuthCard>{sk}</AuthCard> : <main className="min-h-dvh bg-bg">{sk}</main>;
  }

  const nameVal = name ?? (profile.data && profile.data.display_name !== 'Teman' ? profile.data.display_name : '');
  const activeSem = semesters.rows.find((s) => s.is_active && !s.deleted_at);
  const existingRoutine = (n: string) => routines.rows.some((r) => !r.deleted_at && r.name.trim().toLowerCase() === n.toLowerCase());
  const day = cycleDay ?? settings.budget_cycle_day;
  const defaultWallet = wallets.rows.find((w) => w.is_default && !w.archived) ?? wallets.rows.find((w) => !w.archived);
  const showBalance = !!defaultWallet && txs.isSuccess && txs.rows.length === 0;

  const go = (n: number) => { setError(null); setStep(n); };
  const run = async (fn: () => Promise<unknown>, next = step + 1) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      go(next);
    } catch (e) {
      setError(`Belum tersimpan: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const steps: { body: ReactNode; primary: { label: string; onClick: () => void; disabled?: boolean }; skip?: () => void }[] = [
    {
      body: (
        <Field label="Nama panggilan" htmlFor="ob-name" hint="Bisa diubah kapan saja di Pengaturan.">
          <input id="ob-name" className={inputCls} value={nameVal} maxLength={40} autoComplete="nickname" placeholder="mis. Iqbal" onChange={(e) => setName(e.target.value)} data-autofocus />
        </Field>
      ),
      primary: {
        label: 'Lanjut',
        disabled: !nameVal.trim(),
        onClick: () => void run(() => updProfile.mutateAsync({ display_name: nameVal.trim() })),
      },
    },
    {
      body: activeSem ? (
        <div className="flex items-center gap-3 rounded-3xl bg-kuliah-bg p-4">
          <Icon.Cap size={24} className="shrink-0 text-kuliah-fg" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-body font-extrabold text-kuliah-deep">{activeSem.label}</span>
            <span className="text-meta text-ink-2">Semester {activeSem.number} sudah tercatat. Matkul bisa ditambah di tab Kuliah.</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[96px_1fr] gap-3">
            <Field label="Semester ke-" htmlFor="ob-sem-no">
              <select id="ob-sem-no" className={inputCls} value={semNo} onChange={(e) => setSemNo(e.target.value)}>
                {Array.from({ length: 14 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            </Field>
            <Field label="Nama semester" htmlFor="ob-sem-label">
              <input id="ob-sem-label" className={inputCls} value={semLabel} maxLength={40} onChange={(e) => setSemLabel(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mulai" htmlFor="ob-sem-start">
              <input id="ob-sem-start" type="date" className={inputCls} value={semStart} onChange={(e) => setSemStart(e.target.value)} />
            </Field>
            <Field label="Selesai" htmlFor="ob-sem-end">
              <input id="ob-sem-end" type="date" className={inputCls} value={semEnd} onChange={(e) => setSemEnd(e.target.value)} />
            </Field>
          </div>
          {semStart && semEnd && semEnd <= semStart && <span role="alert" className="text-meta font-semibold text-danger-fg">Tanggal selesai harus setelah tanggal mulai.</span>}
        </div>
      ),
      primary: activeSem
        ? { label: 'Lanjut', onClick: () => go(2) }
        : {
            label: 'Simpan & lanjut',
            disabled: !semLabel.trim() || !semStart || !semEnd || semEnd <= semStart,
            onClick: () => void run(() => saveSemester.save({ number: Number(semNo), label: semLabel.trim(), start_date: semStart, end_date: semEnd, is_active: true })),
          },
      skip: activeSem ? undefined : () => go(2),
    },
    {
      body: (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {ROUTINE_SUGGESTIONS.map((r) => {
            const exists = existingRoutine(r.name);
            const on = exists || picked.includes(r.name);
            return (
              <li key={r.name} className={cx('flex items-center gap-1 rounded-2xl border py-2 pr-3.5 pl-1.5', on ? 'border-brand-200 bg-primary-soft' : 'border-line bg-surface')}>
                <CheckBox
                  round
                  checked={on}
                  disabled={exists}
                  label={`${r.name}, ${r.remind_at}`}
                  onToggle={() => setPicked((p) => (p.includes(r.name) ? p.filter((x) => x !== r.name) : [...p, r.name]))}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={cx('text-body font-bold', on ? 'text-brand-800' : 'text-ink')}>{r.name}</span>
                  <span className="text-meta text-ink-3">{exists ? 'Sudah ada' : `${repeatLabel(r.repeat_days)} · pengingat ${r.remind_at}`}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ),
      primary: {
        label: picked.length ? `Tambahkan ${picked.length} & lanjut` : 'Lanjut',
        onClick: () => {
          if (!picked.length) { go(3); return; }
          const base = routines.rows.length;
          void run(() => saveRoutines.save(ROUTINE_SUGGESTIONS.filter((r) => picked.includes(r.name)).map((r, i) => ({
            name: r.name, kind: 'check' as const, target_count: 1, is_required: true, repeat_days: r.repeat_days, remind_at: r.remind_at,
            remind_enabled: true, icon: null, color: null, sort: base + i, archived: false,
          }))));
        },
      },
      skip: picked.length ? () => go(3) : undefined,
    },
    {
      body: (
        <div className="flex flex-col gap-3">
          <Field label="Siklus anggaran mulai tanggal" htmlFor="ob-cycle" hint="Mis. tanggal kiriman/gaji masuk.">
            <select id="ob-cycle" className={inputCls} value={day} onChange={(e) => setCycleDay(Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>Tanggal {i + 1}</option>)}
            </select>
          </Field>
          <Field label="Anggaran pengeluaran sebulan" htmlFor="ob-budget" hint="Boleh dikosongkan.">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-body font-bold text-ink-3">Rp</span>
              <input id="ob-budget" inputMode="numeric" className={cx(inputCls, 'pl-10 tabular')} placeholder="mis. 1.500.000" value={budget} onChange={(e) => setBudget(moneyInput(e.target.value))} />
            </div>
          </Field>
          {showBalance && defaultWallet && (
            <Field label={`Saldo ${defaultWallet.name} sekarang`} htmlFor="ob-balance" hint="Saldo awal dompet utama. Boleh dikosongkan.">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-body font-bold text-ink-3">Rp</span>
                <input id="ob-balance" inputMode="numeric" className={cx(inputCls, 'pl-10 tabular')} placeholder="0" value={balance} onChange={(e) => setBalance(moneyInput(e.target.value))} />
              </div>
            </Field>
          )}
        </div>
      ),
      primary: {
        label: budget || balance || cycleDay ? 'Simpan & lanjut' : 'Lanjut',
        onClick: () => {
          if (!budget && !balance && !cycleDay) { go(4); return; }
          void run(async () => {
            if (cycleDay && cycleDay !== settings.budget_cycle_day) await updSettings.mutateAsync({ budget_cycle_day: cycleDay });
            const amount = digits(budget);
            if (amount > 0) {
              const from = cycleStart(today, day);
              const same = budgets.rows.find((b) => b.category_id === null && b.effective_from === from);
              await saveBudget.save({ id: same?.id, category_id: null, amount, effective_from: from });
            }
            const bal = digits(balance);
            if (balance && defaultWallet) await saveWallet.save({ id: defaultWallet.id, opening_balance: bal });
          });
        },
      },
      skip: budget || balance ? () => go(4) : undefined,
    },
    {
      body: (
        <div className="flex flex-col gap-3">
          <InstallHint />
          <div className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-3.5">
            <span className="flex items-center gap-2 text-body font-extrabold"><Icon.Bell size={18} className="text-primary" aria-hidden="true" />Izinkan notifikasi</span>
            <span className="text-label text-ink-2">Hamzi mengingatkan rutinitas, belajar, tugas, dan kelas tepat pada jamnya. Isi notifikasi tidak memuat nominal.</span>
            {perm === 'granted' ? (
              <span className="flex items-center gap-1.5 text-label font-bold text-brand-800"><Icon.Check size={16} strokeWidth={2.6} />Pengingat aktif</span>
            ) : (
              <Button className="self-start" disabled={busy || perm === 'unsupported'} onClick={() => {
                setBusy(true);
                void enableNotifications().then((r) => { setPerm(r.permission); setPermMsg(r.message); }).finally(() => setBusy(false));
              }}>
                Aktifkan pengingat
              </Button>
            )}
            {permMsg && <span role="status" className={cx('text-meta font-semibold', perm === 'granted' ? 'text-brand-800' : 'text-warn-strong')}>{permMsg}</span>}
          </div>
        </div>
      ),
      primary: { label: 'Lanjut', onClick: () => go(5) },
    },
    {
      body: (
        <div className="flex flex-col gap-3">
          <BatteryGuide />
          <div className="flex flex-col gap-2 rounded-3xl bg-info-bg p-3.5">
            <span className="text-label font-semibold text-info-fg">Sudah diatur? Kirim satu pengingat uji untuk memastikan.</span>
            <Button variant="info" size="sm" className="self-start" disabled={test.busy} onClick={() => void test.send()}>Coba pengingat</Button>
            {test.message && <span role="status" className={cx('text-meta font-semibold', test.ok === false ? 'text-danger-fg' : 'text-info-fg')}>{test.message}</span>}
          </div>
        </div>
      ),
      primary: {
        label: 'Selesai, mulai pakai Hamzi',
        onClick: () => void run(async () => {
          await updProfile.mutateAsync({ onboarded_at: new Date().toISOString() });
          nav('/', { replace: true });
        }, step),
      },
    },
  ];

  const cur = steps[step];
  const meta = STEPS[step];
  const content = (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-2">
        {step > 0
          ? <IconButton label="Kembali" onClick={() => go(step - 1)} disabled={busy}><Icon.ChevronLeft size={20} /></IconButton>
          : <span className="size-11" aria-hidden="true" />}
        <Dots step={step} />
        <span className="flex size-11 items-center justify-center text-meta font-bold text-ink-3 tabular">{step + 1}/{STEPS.length}</span>
      </div>
      <div className="flex items-end gap-2.5">
        <Mascot mood={meta.mood} size={88} mirror={settings.eye_mirror} />
        <p className="m-0 mb-3 flex-1 rounded-[18px_18px_18px_6px] bg-primary-soft px-3.5 py-2.5 text-label leading-[1.45] font-semibold text-brand-900">{meta.line}</p>
      </div>
      <h1 className="m-0 text-title font-extrabold tracking-[-0.5px]">{meta.title}</h1>
      <div className="flex flex-col gap-3">{cur.body}</div>
      {error && <ErrorState text={error} />}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button size="lg" block onClick={cur.primary.onClick} disabled={busy || cur.primary.disabled}>{cur.primary.label}</Button>
        {cur.skip && <Button size="md" block variant="ghost" onClick={cur.skip} disabled={busy}>Lewati</Button>}
      </div>
    </div>
  );

  return (
    <>
      {desktop ? (
        <AuthCard className="min-h-160 p-7">{content}</AuthCard>
      ) : (
        <main className="flex min-h-dvh flex-col bg-bg">
          <div className="mx-auto flex w-full max-w-120 flex-1 flex-col px-4 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">{content}</div>
        </main>
      )}
      <ReminderEngine />
    </>
  );
}
