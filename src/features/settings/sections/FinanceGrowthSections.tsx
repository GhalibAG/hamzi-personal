// Pengaturan > Keuangan (SET-01: awal siklus anggaran, kategori) dan > Tumbuh (SET-02: "Tugas juga menyiram pohon", timer default).
import { Icon } from '@/components/icons';
import { Chip, Field, inputCls } from '@/components/ui';
import { useSettings, useUpdateSettings } from '@/data/hooks';
import { CardBody, LinkRow, SettingsCard, ToggleRow } from '../components/rows';

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const FOCUS = [15, 25, 30, 45, 60];

export function FinanceSection() {
  const s = useSettings();
  const upd = useUpdateSettings();
  return (
    <>
      <SettingsCard title="Siklus anggaran" desc="Anggaran, sisa hari, dan 'aman per hari' dihitung mulai tanggal ini setiap bulan.">
        <CardBody>
          <Field label="Awal siklus (tanggal)" htmlFor="fin-cycle">
            <select
              id="fin-cycle"
              className={inputCls}
              value={s.budget_cycle_day}
              onChange={(e) => upd.mutate({ budget_cycle_day: Number(e.target.value) })}
            >
              {DAYS.map((d) => <option key={d} value={d}>Tanggal {d}</option>)}
            </select>
          </Field>
        </CardBody>
      </SettingsCard>
      <SettingsCard title="Kelola">
        <LinkRow to="/keuangan/anggaran" icon={<Icon.Wallet size={20} className="shrink-0 text-primary" />} label="Kategori & anggaran" desc="Tambah, ubah, atur anggaran per kategori" />
        <LinkRow to="/keuangan/dompet" icon={<Icon.Receipt size={20} className="shrink-0 text-primary" />} label="Dompet" desc="Tunai, bank, e-wallet" />
      </SettingsCard>
    </>
  );
}

export function GrowthSection() {
  const s = useSettings();
  const upd = useUpdateSettings();
  return (
    <>
      <SettingsCard title="Pohon">
        <ToggleRow
          label="Tugas juga menyiram pohon"
          desc="Setiap tugas selesai = +1 tetes air (maks 3 per hari)."
          checked={s.water_from_tasks}
          onChange={(v) => upd.mutate({ water_from_tasks: v })}
        />
      </SettingsCard>
      <SettingsCard title="Timer fokus" desc="Durasi bawaan saat memulai sesi belajar.">
        <CardBody>
          <div role="group" aria-label="Durasi timer bawaan" className="flex flex-wrap gap-2">
            {FOCUS.map((m) => (
              <Chip key={m} size="lg" selected={s.default_focus_min === m} onClick={() => upd.mutate({ default_focus_min: m })}>{m} menit</Chip>
            ))}
          </div>
        </CardBody>
      </SettingsCard>
      <SettingsCard>
        <LinkRow to="/tumbuh?tab=pengingat" icon={<Icon.Clock size={20} className="shrink-0 text-primary" />} label="Pengingat rutinitas & modul" desc="Atur jam dan hari pengingat" />
      </SettingsCard>
    </>
  );
}
