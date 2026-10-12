// Header Chat: layar /chat (Chat.dc.html) dan panel desktop (DeskChat.dc.html).
import { useNavigate } from 'react-router';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { IconButton, Menu } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { ChatController } from '../hooks';
import { HIT44, type ChatVariant } from './ChatParts';

function ShieldMenu({ ctl, panel }: { ctl: ChatController; panel: boolean }) {
  const nav = useNavigate();
  return (
    <Menu
      width={240}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label="Riwayat AI dan izin data"
          aria-haspopup="menu"
          aria-expanded={open}
          title="Riwayat AI dan izin data"
          onClick={toggle}
          className={cx('flex shrink-0 items-center justify-center rounded-full bg-transparent text-ink-muted hover:bg-surface-2', panel ? cx(HIT44, 'size-10') : 'size-11')}
        >
          <Icon.Shield size={panel ? 20 : 22} />
        </button>
      )}
      items={[
        { label: 'Riwayat AI & izin data', icon: <Icon.Shield size={18} />, onSelect: () => nav('/chat/riwayat') },
        { label: 'Percakapan baru', icon: <Icon.Plus size={18} />, onSelect: () => void ctl.newConversation() },
      ]}
    />
  );
}

export function ChatHeader({ ctl, variant = 'page', onBack, onClose }: { ctl: ChatController; variant?: ChatVariant; onBack?: () => void; onClose?: () => void }) {
  const panel = variant === 'panel';
  const mood = ctl.waiting ? 'focus' : 'calm';
  if (panel) {
    return (
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-surface py-3 pr-3 pl-4">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft">
          <Mascot mood={mood} size={40} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="m-0 text-card leading-snug font-extrabold">Chat Hamzi</h2>
          <span className="truncate text-meta leading-snug font-semibold text-brand-600" aria-live="polite">{ctl.waiting ? 'sedang mikir…' : 'Bisa baca file & nambah data'}</span>
        </div>
        <ShieldMenu ctl={ctl} panel />
        <button
          type="button"
          aria-label="Tutup panel chat"
          title="Tutup panel chat"
          onClick={onClose}
          className={cx(HIT44, 'flex size-10 shrink-0 items-center justify-center rounded-full bg-transparent text-ink-muted hover:bg-surface-2')}
        >
          <Icon.X size={20} />
        </button>
      </div>
    );
  }
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-2.5">
      <IconButton label="Kembali" variant="plain" onClick={onBack}>
        <Icon.ChevronLeft size={22} />
      </IconButton>
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft">
        <Mascot mood={mood} size={44} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="m-0 text-section leading-snug font-extrabold">Hamzi</h1>
        <span className="text-meta leading-tight font-semibold text-brand-600" aria-live="polite">{ctl.waiting ? 'sedang membaca & mikir…' : 'Asisten · bisa baca file & nambah data'}</span>
      </div>
      <ShieldMenu ctl={ctl} panel={false} />
    </header>
  );
}
