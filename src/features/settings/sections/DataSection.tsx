// Pengaturan > Data (SET-04, SET-05, TECH-SPEC §16): export JSON/CSV, impor JSON (gabung / ganti semua), pengingat backup,
// mode demo: isi ulang data contoh / kosongkan.
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { diffDays, wibDate } from '@common/calc/index.ts';
import { dayLong, thousands } from '@common/format.ts';
import { Icon } from '@/components/icons';
import { Button, ConfirmRow, ErrorState, Sheet } from '@/components/ui';
import { DEMO, repo } from '@/data';
import { useSettings, useUpdateSettings } from '@/data/hooks';
import { resetDemo } from '@/data/local';
import { cx } from '@/lib/cx';
import { useOnline } from '@/lib/hooks';
import { toast } from '@/stores/ui';
import {
  backupFileName, buildBackup, buildCsv, CSV_LABEL, downloadText, parseBackup, type CsvKind, type ParsedBackup,
} from '../data-export';
import { CardBody, LinkRow, SettingsCard, ToggleRow } from '../components/rows';

const MAX_FILE = 20 * 1024 * 1024;
type Ok = Extract<ParsedBackup, { ok: true }>;

function ImportSheet({ parsed, onClose, onDone }: { parsed: Ok | null; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!parsed) return null;
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'replace') {
        const before = await buildBackup(repo);
        downloadText(`hamzi-sebelum-impor-${wibDate()}.json`, JSON.stringify(before, null, 2), 'application/json');
      }
      await repo.importAll(parsed.tables, mode);
      await qc.invalidateQueries();
      toast(`Impor selesai: ${thousands(parsed.rows)} baris.`);
      onDone();
    } catch (e) {
      setError(`Impor gagal: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const exported = new Date(parsed.backup.exported_at);
  const when = Number.isNaN(exported.getTime()) ? parsed.backup.exported_at : dayLong(wibDate(exported), true);
  const opt = (value: 'merge' | 'replace', title: string, desc: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setMode(value)}
      className={cx('flex flex-col gap-0.5 rounded-2xl border-2 p-3 text-left', mode === value ? 'border-brand-500 bg-primary-soft' : 'border-line bg-surface hover:bg-surface-2')}
    >
      <span className="text-body font-extrabold">{title}</span>
      <span className="text-meta text-ink-2">{desc}</span>
    </button>
  );
  return (
    <Sheet
      open
      onClose={busy ? () => undefined : onClose}
      title="Impor data"
      footer={(
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose} disabled={busy}>Batal</Button>
          <Button variant={mode === 'replace' ? 'danger' : 'primary'} size="lg" className="flex-1" onClick={() => void run()} disabled={busy}>
            {busy ? 'Mengimpor…' : mode === 'replace' ? 'Ganti semua' : 'Gabung'}
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-surface-2 p-3 text-label text-ink-2">
          Backup {when} · {parsed.tableCount} tabel · {thousands(parsed.rows)} baris
          {parsed.ignored.length > 0 && <span className="block text-meta text-ink-3">Diabaikan: {parsed.ignored.join(', ')}</span>}
        </div>
        <div role="radiogroup" aria-label="Cara impor" className="flex flex-col gap-2">
          {opt('merge', 'Gabung', 'Data dengan id yang sama diperbarui, sisanya ditambahkan. Data lain tetap ada.')}
          {opt('replace', 'Ganti semua', 'Semua data sekarang diganti isi backup. Hamzi mengunduh backup data sekarang dulu secara otomatis.')}
        </div>
        {error && <ErrorState text={error} />}
      </div>
    </Sheet>
  );
}

export function DataSection() {
  const s = useSettings();
  const upd = useUpdateSettings();
  const online = useOnline();
  const [busy, setBusy] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Ok | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'sample' | 'empty' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const needsNet = !DEMO && !online;

  const exportJson = async () => {
    setBusy('json');
    try {
      const b = await buildBackup(repo);
      downloadText(backupFileName(), JSON.stringify(b, null, 2), 'application/json');
      upd.mutate({ last_backup_at: b.exported_at });
      toast('Backup tersimpan. Simpan filenya di tempat aman.');
    } catch {
      toast('Export gagal. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };
  const exportCsv = async (k: CsvKind) => {
    setBusy(k);
    try {
      downloadText(`hamzi-${k}-${wibDate()}.csv`, await buildCsv(repo, k), 'text/csv;charset=utf-8');
    } catch {
      toast('Export CSV gagal. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };
  const onFile = async (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!f) return;
    if (f.size > MAX_FILE) { setImportErr('File terlalu besar (maks 20 MB).'); return; }
    const p = parseBackup(await f.text());
    if (!p.ok) { setImportErr(p.error); return; }
    setImportErr(null);
    setParsed(p);
  };
  const reset = (mode: 'sample' | 'empty') => {
    resetDemo(mode);
    window.setTimeout(() => window.location.assign('/'), 300);
  };

  const last = s.last_backup_at;
  const ago = last ? diffDays(wibDate(new Date(last)), wibDate()) : null;
  const lastText = last ? `${dayLong(wibDate(new Date(last)), true)} · ${ago === 0 ? 'hari ini' : `${ago} hari lalu`}` : 'Belum pernah';

  return (
    <>
      <SettingsCard title="Backup" desc={needsNet ? 'Butuh internet untuk export & impor.' : undefined}>
        <div className={cx('flex items-center gap-3 px-4 py-3', (ago !== null && ago >= 14) || !last ? 'bg-warn-banner' : '')}>
          <Icon.Database size={20} className="shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-meta text-ink-3">Backup terakhir</span>
            <span className="text-body font-bold">{lastText}</span>
          </div>
        </div>
        <CardBody>
          <Button icon={<Icon.Download size={18} />} onClick={() => void exportJson()} disabled={!!busy || needsNet} className="self-start">
            {busy === 'json' ? 'Menyiapkan…' : 'Export JSON (lengkap)'}
          </Button>
          <span className="text-meta text-ink-3">File JSON berisi semua data (tanpa lampiran chat). Bisa diimpor lagi kapan saja.</span>
        </CardBody>
        <ToggleRow
          label="Pengingat backup"
          desc="Ingatkan bila sudah 14 hari sejak backup terakhir."
          checked={s.system_notif.backup ?? true}
          onChange={(v) => upd.mutate({ system_notif: { ...s.system_notif, backup: v } })}
        />
      </SettingsCard>

      <SettingsCard title="Export CSV per modul" desc="CSV UTF-8 untuk dibuka di Excel / Google Sheets.">
        <CardBody>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CSV_LABEL) as CsvKind[]).map((k) => (
              <Button key={k} variant="secondary" size="sm" onClick={() => void exportCsv(k)} disabled={!!busy || needsNet}>
                {busy === k ? 'Menyiapkan…' : CSV_LABEL[k]}
              </Button>
            ))}
          </div>
        </CardBody>
      </SettingsCard>

      <SettingsCard title="Impor">
        <CardBody>
          <span className="text-label text-ink-2">Pulihkan dari file backup JSON Hamzi. Kamu bisa memilih gabung atau ganti semua.</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button variant="outline-primary" icon={<Icon.Upload size={18} />} className="self-start" onClick={() => fileRef.current?.click()} disabled={!!busy || needsNet}>
            Pilih file JSON
          </Button>
          {importErr && <ErrorState text={importErr} />}
        </CardBody>
      </SettingsCard>

      {DEMO && (
        <SettingsCard title="Data demo" desc="Mode demo menyimpan data di peramban ini saja.">
          {confirm ? (
            <CardBody>
              <ConfirmRow
                text={confirm === 'sample' ? 'Ganti semua data dengan data contoh?' : 'Hapus semua data demo dan mulai dari kosong?'}
                confirmLabel={confirm === 'sample' ? 'Isi ulang' : 'Kosongkan'}
                danger={confirm === 'empty'}
                onConfirm={() => reset(confirm)}
                onCancel={() => setConfirm(null)}
              />
            </CardBody>
          ) : (
            <>
              <LinkRow onClick={() => setConfirm('sample')} icon={<Icon.Undo size={20} className="shrink-0 text-primary" />} label="Isi ulang data contoh" desc="Kembalikan data prototipe" />
              <LinkRow onClick={() => setConfirm('empty')} icon={<Icon.Trash size={20} className="shrink-0 text-danger-fg" />} label="Kosongkan data" desc="Mulai seperti akun baru (onboarding)" danger />
            </>
          )}
        </SettingsCard>
      )}

      <ImportSheet parsed={parsed} onClose={() => setParsed(null)} onDone={() => setParsed(null)} />
    </>
  );
}
