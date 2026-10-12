// Panduan baterai Android (AUTH-04 langkah 6, NOT-09, TECH-SPEC §8.4): agar notifikasi tidak ditahan penghemat baterai.
import { Icon } from '@/components/icons';

const BRANDS: { name: string; steps: string[] }[] = [
  {
    name: 'Semua HP Android (Chrome)',
    steps: [
      'Buka Setelan HP, lalu Aplikasi, lalu Chrome.',
      'Pilih Baterai, lalu pilih "Tidak dibatasi" (atau matikan "Optimalkan penggunaan baterai").',
      'Di Notifikasi Chrome, pastikan notifikasi untuk Hamzi diizinkan.',
    ],
  },
  {
    name: 'Xiaomi / Redmi / POCO',
    steps: [
      'Setelan, lalu Aplikasi, lalu Kelola aplikasi, lalu Chrome.',
      'Penghemat baterai: pilih "Tanpa batasan".',
      'Aktifkan juga "Mulai otomatis" untuk Chrome.',
    ],
  },
  {
    name: 'Oppo / Realme',
    steps: [
      'Setelan, lalu Baterai, lalu Konsumsi daya aplikasi (atau Pengoptimalan pemakaian daya).',
      'Pilih Chrome, lalu izinkan aktivitas latar belakang dan mulai otomatis.',
    ],
  },
  {
    name: 'Vivo',
    steps: [
      'Setelan, lalu Baterai, lalu Konsumsi daya latar belakang tinggi.',
      'Aktifkan untuk Chrome. Di i Manager, izinkan juga Chrome mulai otomatis.',
    ],
  },
  {
    name: 'Samsung',
    steps: [
      'Setelan, lalu Perawatan perangkat (atau Baterai), lalu Batas penggunaan latar belakang.',
      'Keluarkan Chrome dari daftar "Aplikasi tidur" dan "Aplikasi tidur nyenyak".',
    ],
  },
];

export function BatteryGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <p className="m-0 flex items-start gap-2 text-label text-ink-2">
          <Icon.Battery size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          HP Android sering menahan notifikasi untuk menghemat baterai. Atur sekali supaya pengingat Hamzi sampai tepat waktu.
        </p>
      )}
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {BRANDS.map((b, i) => (
          <details key={b.name} className="group" open={i === 0 && !compact}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3.5 text-body font-bold [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{b.name}</span>
              <Icon.ChevronDown size={18} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ol className="m-0 flex list-decimal flex-col gap-1.5 pr-3.5 pb-3.5 pl-8 text-label text-ink-2">
              {b.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </details>
        ))}
      </div>
    </div>
  );
}
