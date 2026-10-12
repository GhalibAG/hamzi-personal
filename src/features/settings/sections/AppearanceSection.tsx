// Pengaturan > Tampilan (SET-01, SET-06): tema, mode Minimal, sembunyikan nominal, orientasi mata Hamzi (A/B).
import { Mascot } from '@/components/mascot/Mascot';
import { Segmented } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useSettings, useUpdateSettings } from '@/data/hooks';
import type { Settings } from '@/data/types';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/ui';
import { CardBody, SettingsCard, ToggleRow } from '../components/rows';

const THEMES: { value: Settings['theme']; label: string }[] = [
  { value: 'light', label: 'Terang' }, { value: 'dark', label: 'Gelap' }, { value: 'system', label: 'Sistem' },
];

const THEME_CARDS: {
  value: Settings['theme'];
  label: string;
  desc: string;
  icon: typeof Icon.Sun;
}[] = [
  { value: 'light', label: 'Terang', desc: 'Cerah & segar', icon: Icon.Sun },
  { value: 'dark', label: 'Gelap', desc: 'Nyaman di mata', icon: Icon.Moon },
  { value: 'system', label: 'Sistem', desc: 'Ikuti perangkat', icon: Icon.Sliders },
];

export function AppearanceSection() {
  const s = useSettings();
  const upd = useUpdateSettings();
  const set = (patch: Partial<Settings>) => upd.mutate(patch);
  const setTheme = (theme: Settings['theme']) => {
    set({ theme });
    toast(theme === 'dark' ? 'Tema gelap diaktifkan' : theme === 'light' ? 'Tema terang diaktifkan' : 'Tema mengikuti setelan sistem');
  };
  return (
    <>
      <SettingsCard title="Tema" desc="Pilih tampilan terang, gelap, atau menyesuaikan sistem perangkat kamu.">
        <CardBody>
          <div className="flex flex-col gap-3">
            <Segmented label="Tema" options={THEMES} value={s.theme} onChange={setTheme} />
            <div role="radiogroup" aria-label="Kartu pilihan tema" className="grid grid-cols-3 gap-2.5">
              {THEME_CARDS.map((t) => {
                const sel = s.theme === t.value;
                const Ico = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setTheme(t.value)}
                    className={cx(
                      'flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-surface p-2.5 text-center transition-all',
                      sel ? 'border-brand-500 bg-primary-soft shadow-1' : 'border-line hover:bg-surface-2',
                    )}
                  >
                    <span className={cx('flex size-9 items-center justify-center rounded-full transition-colors', sel ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-3')}>
                      <Ico size={18} />
                    </span>
                    <span className={cx('text-label font-extrabold', sel ? 'text-brand-800' : 'text-ink')}>{t.label}</span>
                    <span className="text-micro font-medium text-ink-3 leading-tight">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
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
