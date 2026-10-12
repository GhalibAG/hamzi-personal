// Sidebar desktop 240 px (DeskSidebar.dc.html, DESIGN-SYSTEM §11.2).
import { Link, useLocation } from 'react-router';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Kbd, ProgressBar } from '@/components/ui';
import { cx } from '@/lib/cx';
import { useUi } from '@/stores/ui';
import { useGrowth, useXp } from '@/features/growth/hooks';
import { useUnreadCount } from '@/features/notifications/unread';
import { TABS } from './nav';

const itemCls = 'flex h-11 items-center gap-3 rounded-md px-3 text-body no-underline';

export function Sidebar() {
  const { pathname } = useLocation();
  const chatOpen = useUi((s) => s.chatOpen);
  const toggleChat = useUi((s) => s.toggleChat);
  const unread = useUnreadCount();
  const { data } = useGrowth();
  const xp = useXp();
  return (
    <nav aria-label="Navigasi utama" className="flex h-full w-60 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-line bg-surface px-3.5 py-5">
      <Link to="/" className="flex items-center gap-2.5 px-1.5 pb-3.5 text-ink no-underline">
        <span className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-primary-soft">
          <Mascot mood="calm" size={44} still />
        </span>
        <span className="flex flex-col">
          <span className="text-h3 font-extrabold tracking-[-0.3px]">Hamzi</span>
          <span className="text-meta font-semibold text-ink-3">Plan tracker pribadi</span>
        </span>
      </Link>
      {TABS.map((t) => {
        const on = t.match(pathname);
        const I = t.icon;
        return (
          <Link key={t.to} to={t.to} aria-current={on ? 'page' : undefined} className={cx(itemCls, on ? 'bg-primary-soft font-extrabold text-primary' : 'font-bold text-ink-muted hover:bg-surface-2')}>
            <I size={22} />
            <span className="flex-1">{t.label}</span>
          </Link>
        );
      })}
      <div className="mx-1.5 my-2.5 h-px bg-line" />
      <button type="button" onClick={toggleChat} aria-pressed={chatOpen} className={cx(itemCls, 'border-0 text-left font-bold', chatOpen ? 'bg-primary-soft text-primary' : 'bg-transparent text-ink-muted hover:bg-surface-2')}>
        <Icon.Sparkle size={20} />
        <span className="flex-1">Chat Hamzi</span>
        <Kbd>C</Kbd>
      </button>
      <Link to="/notifikasi" aria-current={pathname === '/notifikasi' ? 'page' : undefined} className={cx(itemCls, 'font-bold', pathname === '/notifikasi' ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-2')}>
        <Icon.Bell size={22} />
        <span className="flex-1">Notifikasi</span>
        {unread > 0 && <span aria-label={`${unread} belum dibaca`} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-badge-dot px-1.5 text-micro font-extrabold text-n-900">{unread}</span>}
      </Link>
      <Link to="/pengaturan" aria-current={pathname.startsWith('/pengaturan') ? 'page' : undefined} className={cx(itemCls, 'font-bold', pathname.startsWith('/pengaturan') ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-2')}>
        <Icon.Gear size={22} />
        <span className="flex-1">Pengaturan</span>
      </Link>
      <div className="mt-auto flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-rutin-bg text-rutin-fg"><Icon.Flame size={18} /></span>
          <div className="flex flex-col">
            <span className="text-label font-extrabold">Streak {data.streak} hari</span>
            <span className="text-small font-semibold text-ink-3">Lv {xp.level} · {xp.into}/{xp.need} XP</span>
          </div>
        </div>
        <ProgressBar value={xp.pct} color="belajar" height={6} label="Progres XP" />
        <span className="text-micro leading-normal text-ink-3">Pintasan: <b>N</b> tugas · <b>E</b> pengeluaran · <b>T</b> timer · <b>/</b> cari</span>
      </div>
    </nav>
  );
}
