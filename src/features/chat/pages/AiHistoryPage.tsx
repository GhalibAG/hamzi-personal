// Riwayat AI `/chat/riwayat` (UI-SPEC §10, AI-03, SET-03, CHAT-08): izin data untuk AI, hapus riwayat, daftar kronologis
// (Ringkasan dari ai_requests + Chat dari ai_messages asisten) dengan "Lihat data terkirim" & umpan balik jempol.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { wibDate, wibTime } from '@common/calc/index.ts';
import { dayLabel } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Button, Card, ConfirmRow, EmptyState, ErrorState, ListSkeleton, Page, ScreenHeader, SectionTitle, Switch, Tag, type TagTone,
} from '@/components/ui';
import { useRows, useSettings, useUpdate, useUpdateSettings } from '@/data/hooks';
import type { AiMessage, AiRequest, Settings } from '@/data/types';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/ui';
import { clearAiHistory, startNewConversation } from '../hooks';
import type { ToolUse } from '../types';

/** Kunci ai_share (TECH-SPEC §7.2) dengan label Indonesia. `parent` = sub-izin yang bergantung pada kunci induk. */
export const SHARE_ITEMS: { key: string; label: string; desc: string; parent?: string }[] = [
  { key: 'tasks', label: 'Tugas', desc: 'Jumlah & status tugas' },
  { key: 'task_titles', label: 'Judul tugas', desc: 'Mati = "Tugas A/B/C" + prioritas + tenggat', parent: 'tasks' },
  { key: 'courses', label: 'Kuliah', desc: 'Nama matkul, jam, ujian (tanpa dosen/ruang)' },
  { key: 'learning', label: 'Belajar mandiri', desc: 'Menit belajar, judul modul, progres' },
  { key: 'routines', label: 'Rutinitas & kebun', desc: 'Jumlah wajib/selesai, level kebun, streak, tahap pohon' },
  { key: 'finance', label: 'Keuangan', desc: 'Agregat pengeluaran' },
  { key: 'finance_amounts', label: 'Kirim nominal keuangan', desc: 'Mati = hanya persen/rasio', parent: 'finance' },
  { key: 'goals', label: 'Target', desc: 'Jenis, progres %, status' },
  { key: 'goals_amounts', label: 'Kirim nominal target', desc: 'Mati = hanya persen', parent: 'goals' },
  { key: 'investments', label: 'Investasi', desc: 'Alokasi %, untung/rugi %' },
  { key: 'investments_amounts', label: 'Kirim nominal investasi', desc: 'Mati = hanya persen', parent: 'investments' },
];

interface Entry {
  id: string;
  source: 'request' | 'message';
  type: 'Ringkasan' | 'Review mingguan' | 'Chat';
  at: string;
  provider: string;
  status: string;
  preview: string;
  data: unknown;
  feedback?: -1 | 1 | null;
}

const STATUS: Record<string, { label: string; tone: TagTone }> = {
  ok: { label: 'Berhasil', tone: 'masuk' },
  ai: { label: 'Berhasil', tone: 'masuk' },
  cache: { label: 'Dari cache', tone: 'neutral' },
  fallback: { label: 'Templat', tone: 'event' },
  template: { label: 'Templat', tone: 'event' },
  error: { label: 'Gagal', tone: 'danger' },
  limited: { label: 'Kuota habis', tone: 'ujian' },
};

const PROVIDER: Record<string, string> = { templat: 'Templat lokal (tanpa AI)', demo: 'Mode demo (tanpa AI)', cache: 'Cache' };

function providerLabel(provider?: string | null, model?: string | null): string {
  if (!provider) return 'Tanpa penyedia';
  return [PROVIDER[provider] ?? provider, model].filter(Boolean).join(' · ');
}

function when(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return `${dayLabel(wibDate(d))} · ${wibTime(d)}`;
}

function requestPreview(r: AiRequest): string {
  const res = (r.response ?? {}) as Record<string, unknown>;
  if (typeof res.summary === 'string') return res.summary;
  const hl = Array.isArray(res.highlights) ? res.highlights.filter((x): x is string => typeof x === 'string') : [];
  return [typeof res.greeting === 'string' ? res.greeting : '', hl[0] ?? ''].filter(Boolean).join(' ');
}

function toEntries(reqs: AiRequest[], msgs: AiMessage[]): Entry[] {
  const a: Entry[] = reqs.map((r) => ({
    id: r.id, source: 'request', type: r.kind === 'weekly_review' ? 'Review mingguan' : 'Ringkasan', at: r.created_at ?? r.updated_at ?? '',
    provider: providerLabel(r.provider, r.model), status: r.status, preview: requestPreview(r),
    data: { payload: r.payload, response: r.response }, feedback: r.feedback ?? null,
  }));
  const b: Entry[] = msgs.filter((m) => m.role === 'assistant').map((m) => {
    const tools = (m.tools_used ?? []) as ToolUse[];
    const weekly = tools.some((t) => t?.name === 'weekly_review');
    return {
      id: m.id, source: 'message', type: weekly ? 'Review mingguan' : 'Chat', at: m.created_at ?? '',
      provider: providerLabel(m.provider, m.model), status: m.status, preview: m.content,
      data: { sent_payload: m.sent_payload ?? null, tools_used: tools },
    };
  });
  return [...a, ...b].sort((x, y) => y.at.localeCompare(x.at));
}

function Row({ label, desc, checked, onChange, sub, disabled }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; sub?: boolean; disabled?: boolean }) {
  return (
    <div className={cx('flex items-center gap-3 py-1.5', sub && 'pl-4')}>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cx('text-body font-bold', disabled && 'text-ink-3')}>{label}</span>
        <span className="text-meta text-ink-3">{desc}</span>
      </div>
      {/* text-left: knob Switch bersama memakai posisi statis (tanpa left-0) sehingga ikut text-align tombol */}
      <span className="[&_button]:text-left"><Switch checked={checked} onChange={onChange} label={label} disabled={disabled} /></span>
    </div>
  );
}

function PrivacyCard() {
  const s = useSettings();
  const upd = useUpdateSettings();
  const share = s.ai_share;
  const setShare = (key: string, v: boolean) => upd.mutate({ ai_share: { ...share, [key]: v } });
  const main: { key: keyof Pick<Settings, 'ai_enabled' | 'ai_chat_enabled'>; label: string; desc: string }[] = [
    { key: 'ai_enabled', label: 'AI aktif', desc: 'Kata Hamzi & review mingguan. Mati = templat lokal tanpa AI.' },
    { key: 'ai_chat_enabled', label: 'Chat Hamzi aktif', desc: 'Ngobrol, baca file dosen, dan kartu aksi.' },
  ];
  return (
    <Card className="flex flex-col p-4">
      {main.map((m) => <Row key={m.key} label={m.label} desc={m.desc} checked={s[m.key]} onChange={(v) => upd.mutate({ [m.key]: v })} />)}
      <div className="my-2 h-px bg-line" />
      <span className="pb-1 text-meta font-bold text-ink-3">Data yang boleh dibaca Hamzi (hanya agregat)</span>
      {SHARE_ITEMS.map((it) => (
        <Row
          key={it.key}
          label={it.label}
          desc={it.desc}
          sub={!!it.parent}
          checked={!!share[it.key] && (!it.parent || !!share[it.parent])}
          disabled={!!it.parent && !share[it.parent]}
          onChange={(v) => setShare(it.key, v)}
        />
      ))}
      <p className="m-0 mt-2 rounded-md bg-surface-2 p-3 text-meta text-ink-2">
        Hamzi tidak pernah menerima nomor rekening/kartu, NIK, atau password. Chat hanya bisa membaca ringkasan dan mengusulkan data baru; semua aksi menunggu konfirmasimu.
      </p>
    </Card>
  );
}

function EntryCard({ e }: { e: Entry }) {
  const [open, setOpen] = useState(false);
  const fb = useUpdate('ai_requests');
  const st = STATUS[e.status] ?? { label: e.status, tone: 'neutral' as TagTone };
  const setFeedback = (v: -1 | 1) => void fb.patch(e.id, { feedback: e.feedback === v ? null : v });
  return (
    <Card className="flex flex-col gap-2 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={e.type === 'Chat' ? 'rutinitas' : e.type === 'Review mingguan' ? 'kuliah' : 'modul'}>{e.type}</Tag>
        <Tag tone={st.tone}>{st.label}</Tag>
        <span className="ml-auto text-meta font-semibold text-ink-3">{when(e.at)}</span>
      </div>
      <span className="text-meta text-ink-3">{e.provider}</span>
      {e.preview && <p className="m-0 line-clamp-3 whitespace-pre-line text-body text-ink-2">{e.preview}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline-soft" size="xs" aria-expanded={open} onClick={() => setOpen((v) => !v)} icon={<Icon.Database size={15} />}>
          {open ? 'Tutup data terkirim' : 'Lihat data terkirim'}
        </Button>
        {e.source === 'request' && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Membantu"
              aria-pressed={e.feedback === 1}
              onClick={() => setFeedback(1)}
              className={cx('flex size-11 items-center justify-center rounded-full', e.feedback === 1 ? 'bg-primary-soft text-primary' : 'bg-transparent text-ink-3 hover:bg-surface-2')}
            >
              <Icon.ThumbUp size={18} />
            </button>
            <button
              type="button"
              aria-label="Kurang membantu"
              aria-pressed={e.feedback === -1}
              onClick={() => setFeedback(-1)}
              className={cx('flex size-11 items-center justify-center rounded-full', e.feedback === -1 ? 'bg-danger-bg text-danger-fg' : 'bg-transparent text-ink-3 hover:bg-surface-2')}
            >
              <Icon.ThumbDown size={18} />
            </button>
          </div>
        )}
      </div>
      {open && (
        <pre className="m-0 max-h-80 overflow-auto rounded-md bg-surface-2 p-3 font-mono text-micro leading-normal whitespace-pre-wrap break-words text-ink-2">
          {JSON.stringify(e.data ?? null, null, 2)}
        </pre>
      )}
    </Card>
  );
}

export default function AiHistoryPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const reqs = useRows('ai_requests');
  const msgs = useRows('ai_messages');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const entries = useMemo(() => toEntries(reqs.rows, msgs.rows), [reqs.rows, msgs.rows]);
  const loading = reqs.isLoading || msgs.isLoading;

  const clear = async () => {
    setBusy(true);
    try {
      await clearAiHistory(qc);
      toast('Riwayat AI dihapus. Data yang sudah ditambahkan tetap ada.');
    } catch {
      toast('Riwayat belum bisa dihapus. Coba lagi ya.');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  const fresh = async () => {
    await startNewConversation(qc);
    nav('/chat');
  };

  return (
    <Page narrow>
      <ScreenHeader back="/chat" overline="Chat Hamzi · privasi" title="Riwayat AI" />
      <div className="flex flex-col gap-5.5 px-4 pt-4 lg:px-0 lg:pt-0">
        <section className="flex flex-col gap-2.5">
          <SectionTitle title="Izin data untuk AI" />
          <PrivacyCard />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline-soft" icon={<Icon.Plus size={18} />} onClick={() => void fresh()}>Percakapan baru</Button>
            <Button variant="danger-outline" icon={<Icon.Trash size={18} />} onClick={() => setConfirm(true)} disabled={busy || (!entries.length && !loading)}>Hapus riwayat</Button>
          </div>
          {confirm && (
            <ConfirmRow
              danger
              text="Hapus semua percakapan, kartu aksi, dan log ringkasan AI? Ini tidak bisa dibatalkan. Tugas/transaksi yang sudah ditambahkan tetap ada."
              confirmLabel={busy ? 'Menghapus…' : 'Hapus permanen'}
              onConfirm={() => void clear()}
              onCancel={() => setConfirm(false)}
            />
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionTitle title="Riwayat" right={entries.length ? <span className="text-meta font-semibold text-ink-3">{entries.length} catatan</span> : undefined} />
          <p className="m-0 text-meta text-ink-3">Setiap ringkasan & balasan chat tercatat di sini beserta data yang dikirim. Pesan chat disimpan 30 hari, file lampiran 7 hari.</p>
          {loading && <ListSkeleton rows={4} />}
          {(reqs.isError || msgs.isError) && <ErrorState text="Riwayat belum bisa dimuat." onRetry={() => { void reqs.refetch(); void msgs.refetch(); }} />}
          {!loading && !entries.length && (
            <EmptyState mood="calm" title="Belum ada riwayat AI" text="Saat Hamzi merangkum harimu atau membalas chat, catatannya muncul di sini." />
          )}
          {entries.map((e) => <EntryCard key={`${e.source}-${e.id}`} e={e} />)}
        </section>
      </div>
    </Page>
  );
}
