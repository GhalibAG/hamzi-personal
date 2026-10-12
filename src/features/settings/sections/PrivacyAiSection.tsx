// Pengaturan > Privasi AI (SET-03, TECH-SPEC §7.2): AI aktif, chat aktif, toggle data per modul (`ai_share`), kirim nominal.
import { Icon } from '@/components/icons';
import { useSettings, useUpdateSettings } from '@/data/hooks';
import { LinkRow, SettingsCard, ToggleRow } from '../components/rows';

/** Label & penjelasan per kunci ai_share (TECH-SPEC §7.2). `parent` = toggle induk yang harus aktif. */
export const AI_SHARE: { key: string; label: string; desc: string; parent?: string }[] = [
  { key: 'tasks', label: 'Tugas', desc: 'Jumlah & status tugas' },
  { key: 'task_titles', label: 'Judul tugas', desc: 'Mati: diganti "Tugas A/B/C" + prioritas & tenggat relatif', parent: 'tasks' },
  { key: 'courses', label: 'Kuliah', desc: 'Nama matkul, jam, ujian (tanpa dosen/ruang)' },
  { key: 'learning', label: 'Belajar mandiri', desc: 'Menit belajar, judul modul, progres' },
  { key: 'routines', label: 'Rutinitas & pohon', desc: 'Jumlah wajib/selesai, level kebun, streak, tahap pohon' },
  { key: 'finance', label: 'Keuangan', desc: 'Agregat pengeluaran (bukan transaksi satu per satu)' },
  { key: 'finance_amounts', label: 'Kirim nominal keuangan', desc: 'Mati: hanya persen/rasio', parent: 'finance' },
  { key: 'goals', label: 'Target tabungan', desc: 'Jenis, progres %, status' },
  { key: 'goals_amounts', label: 'Kirim nominal target', desc: 'Mati: hanya persen (bawaan)', parent: 'goals' },
  { key: 'investments', label: 'Investasi', desc: 'Alokasi %, untung/rugi %' },
  { key: 'investments_amounts', label: 'Kirim nominal investasi', desc: 'Mati: hanya persen (bawaan)', parent: 'investments' },
];

export function PrivacyAiSection() {
  const s = useSettings();
  const upd = useUpdateSettings();
  const share = (key: string, v: boolean) => upd.mutate({ ai_share: { ...s.ai_share, [key]: v } });
  return (
    <>
      <div className="flex items-start gap-3 rounded-3xl bg-primary-soft p-4">
        <Icon.Shield size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <p className="m-0 text-label leading-[1.5] text-brand-800">
          Hamzi hanya mengirim ringkasan angka (agregat) ke AI, bukan data mentah. Nomor rekening, NIK, dan kata sandi tidak pernah disimpan atau dikirim.
          AI tidak bisa mengubah datamu; semua usulan menunggu konfirmasimu.
        </p>
      </div>
      <SettingsCard title="AI">
        <ToggleRow label="AI aktif" desc="Kata Hamzi & review mingguan memakai AI. Mati = memakai templat." checked={s.ai_enabled} onChange={(v) => upd.mutate({ ai_enabled: v })} />
        <ToggleRow label="Chat Hamzi aktif" desc="Ngobrol & minta usulan dari Hamzi." checked={s.ai_chat_enabled} onChange={(v) => upd.mutate({ ai_chat_enabled: v })} />
      </SettingsCard>
      <SettingsCard title="Data yang boleh dikirim ke AI" desc="Berlaku untuk ringkasan dan alat baca di Chat Hamzi.">
        {AI_SHARE.map((k) => (
          <ToggleRow
            key={k.key}
            label={k.label}
            desc={k.desc}
            checked={!!s.ai_share[k.key] && (!k.parent || !!s.ai_share[k.parent])}
            disabled={!s.ai_enabled || (!!k.parent && !s.ai_share[k.parent])}
            onChange={(v) => share(k.key, v)}
          />
        ))}
      </SettingsCard>
      <SettingsCard>
        <LinkRow to="/chat/riwayat" icon={<Icon.Clock size={20} className="shrink-0 text-primary" />} label="Riwayat AI" desc="Lihat data yang terkirim & jawaban AI" />
      </SettingsCard>
    </>
  );
}
