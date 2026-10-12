// Pengaturan `/pengaturan/*` (UI-SPEC §11, SET-01..08, NOT-09, AUTH-03/06).
// HP: daftar grup → sub-halaman dengan tombol kembali. Desktop: dua panel (daftar kiri, isi kanan), lebar maks ±1000.
import type { ComponentType } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router';
import { Icon } from '@/components/icons';
import { ErrorState, ListSkeleton, MOD_BG, Page, ScreenHeader } from '@/components/ui';
import { DEMO } from '@/data';
import { useSettingsQuery } from '@/data/hooks';
import { cx } from '@/lib/cx';
import { useIsDesktop } from '@/lib/hooks';
import { AccountActions } from '../components/AccountActions';
import { APP_VERSION, GROUPS, type GroupPath, type SettingsGroup } from '../groups';
import { AcademicSection } from '../sections/AcademicSection';
import { AppearanceSection } from '../sections/AppearanceSection';
import { DataSection } from '../sections/DataSection';
import { DiagnosticsSection } from '../sections/DiagnosticsSection';
import { FinanceSection, GrowthSection } from '../sections/FinanceGrowthSections';
import { NotificationsSection } from '../sections/NotificationsSection';
import { PrivacyAiSection } from '../sections/PrivacyAiSection';
import { ProfileSection } from '../sections/ProfileSection';

const SECTIONS: Record<GroupPath, ComponentType> = {
  profil: ProfileSection,
  tampilan: AppearanceSection,
  notifikasi: NotificationsSection,
  akademik: AcademicSection,
  keuangan: FinanceSection,
  tumbuh: GrowthSection,
  'privasi-ai': PrivacyAiSection,
  data: DataSection,
  diagnostik: DiagnosticsSection,
};

function SectionBody({ path }: { path: GroupPath }) {
  const q = useSettingsQuery();
  if (q.isLoading) return <ListSkeleton rows={4} />;
  if (q.isError) return <ErrorState text="Pengaturan belum bisa dimuat." onRetry={() => void q.refetch()} />;
  const C = SECTIONS[path];
  return <C />;
}

function GroupList({ desktop, active }: { desktop: boolean; active?: GroupPath }) {
  return (
    <nav aria-label="Grup pengaturan" className="flex flex-col divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
      {GROUPS.map((g) => {
        const Ico = g.icon;
        const sel = desktop && active === g.path;
        return (
          <NavLink
            key={g.path}
            to={`/pengaturan/${g.path}`}
            aria-current={sel ? 'page' : undefined}
            className={cx(
              'flex items-center gap-3 px-3.5 no-underline',
              desktop ? 'min-h-14 py-2' : 'min-h-16 py-2.5',
              sel ? 'bg-primary-soft' : 'hover:bg-surface-2',
            )}
          >
            <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-lg', MOD_BG[g.tone])}>
              <Ico size={20} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cx('text-body font-bold', sel ? 'text-primary' : 'text-ink')}>{g.label}</span>
              {!desktop && <span className="truncate text-meta text-ink-3">{g.desc}</span>}
            </span>
            {!desktop && <Icon.ChevronRight size={18} className="shrink-0 text-ink-3" />}
          </NavLink>
        );
      })}
    </nav>
  );
}

const footer = <p className="m-0 text-center text-meta text-ink-3">Hamzi {APP_VERSION}{DEMO ? ' · mode demo' : ''}</p>;

function MobileIndex() {
  return (
    <Page narrow>
      <ScreenHeader overline="Akun & aplikasi" title="Pengaturan" back />
      <div className="flex flex-col gap-5 px-4 pt-4">
        <GroupList desktop={false} />
        <AccountActions />
        {footer}
      </div>
    </Page>
  );
}

function MobileSub({ group }: { group: SettingsGroup }) {
  return (
    <Page narrow>
      <ScreenHeader overline="Pengaturan" title={group.label} back="/pengaturan" />
      <div className="flex flex-col gap-5 px-4 pt-4">
        <SectionBody path={group.path} />
      </div>
    </Page>
  );
}

function MobileSettings() {
  return (
    <Routes>
      <Route index element={<MobileIndex />} />
      {GROUPS.map((g) => <Route key={g.path} path={g.path} element={<MobileSub group={g} />} />)}
      <Route path="*" element={<Navigate to="/pengaturan" replace />} />
    </Routes>
  );
}

function DesktopSettings() {
  const { pathname } = useLocation();
  const seg = pathname.replace(/^\/pengaturan\/?/, '').split('/')[0];
  const active = (GROUPS.find((g) => g.path === seg) ?? GROUPS[0]).path;
  const content = (g: SettingsGroup) => (
    <section aria-labelledby={`set-${g.path}`} className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <h2 id={`set-${g.path}`} className="m-0 text-h2 font-extrabold">{g.label}</h2>
        <span className="text-label text-ink-3">{g.desc}</span>
      </div>
      <SectionBody path={g.path} />
    </section>
  );
  return (
    <Page>
      <div className="mx-auto flex w-full max-w-250 flex-col gap-5">
        <ScreenHeader overline="Akun & aplikasi" title="Pengaturan" />
        <div className="flex items-start gap-6">
          <div className="sticky top-6 flex w-72 shrink-0 flex-col gap-4">
            <GroupList desktop active={active} />
            <AccountActions />
            {footer}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <Routes>
              <Route index element={content(GROUPS[0])} />
              {GROUPS.map((g) => <Route key={g.path} path={g.path} element={content(g)} />)}
              <Route path="*" element={<Navigate to="/pengaturan" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </Page>
  );
}

export default function SettingsPage() {
  const desktop = useIsDesktop();
  return desktop ? <DesktopSettings /> : <MobileSettings />;
}
