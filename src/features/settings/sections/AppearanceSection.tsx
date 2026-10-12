// Pengaturan > Tampilan (SET-01, SET-06): tema, mode Minimal, sembunyikan nominal, orientasi mata Hamzi (A/B).
import { Mascot } from '@/components/mascot/Mascot';
import { Segmented } from '@/components/ui';
import { useSettings, useUpdateSettings } from '@/data/hooks';
import type { Settings } from '@/data/types';
import { cx } from '@/lib/cx';
import { CardBody, SettingsCard, ToggleRow } from '../components/rows';

const THEMES: { value: Settings['theme']; label: string }[] = [
  { value: 'light', label: 'Terang' }, { value: 'dark', label: 'Gelap' }, { value: 'system', label: 'Sistem' },
];

export function AppearanceSection() {
  const s = useSettings();
  const upd = useUpdateSettings();
  const set = (patch: Partial<Settings>) => upd.mutate(patch);
  return (
    <>
      <SettingsCard title="Tema">
        <CardBody>
          <Segmented label="Tema" options={THEMES} value={s.theme} onChange={(theme) => set({ theme })} />
        </CardBody>
      </SettingsCard>
      <SettingsCard title="Tampilan">
        <ToggleRow label="Mode Minimal" desc="Tanpa animasi & dekorasi. Hamzi diam." checked={s.minimal_mode} onChange={(v) => set({ minimal_mode: v })} />
        <ToggleRow label="Sembunyikan nominal" desc="Nominal tampil sebagai Rp •••••. Sama dengan tombol mata di Beranda." checked={s.hide_amounts} onChange={(v) => set({ hide_amounts: v })} />
      </SettingsCard>
      <SettingsCard title="Mata Hamzi" desc="Orientasi A adalah bawaan. B mencerminkan mata kanan.">
        <CardBody>
          <div role="radiogroup" aria-label="Orientasi mata Hamzi" className="grid grid-cols-2 gap-3">
            {[false, true].map((mirror) => {
              const sel = s.eye_mirror === mirror;
              return (
                <button
                  key={String(mirror)}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => set({ eye_mirror: mirror })}
                  className={cx(
                    'flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-surface px-2 pt-2 pb-3 transition-colors',
                    sel ? 'border-brand-500 bg-primary-soft' : 'border-line hover:bg-surface-2',
                  )}
                >
                  <Mascot mood="calm" size={84} mirror={mirror} />
                  <span className={cx('text-label font-extrabold', sel ? 'text-brand-800' : 'text-ink')}>{mirror ? 'B · Cermin' : 'A · Bawaan'}</span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </SettingsCard>
    </>
  );
}
