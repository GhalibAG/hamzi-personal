// Keluar (AUTH-03; tersembunyi di demo) & Hapus akun (AUTH-06/SET-08; konfirmasi dua langkah: buka dialog + ketik "HAPUS").
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/icons';
import { Button, Field, inputCls, Sheet } from '@/components/ui';
import { DEMO, repo } from '@/data';
import { signOut } from '@/features/auth/session';
import { useOnline } from '@/lib/hooks';
import { toast } from '@/stores/ui';
import { LinkRow, SettingsCard } from './rows';

function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const online = useOnline();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = text.trim() === 'HAPUS';
  const run = async () => {
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await repo.invoke('account-delete', { confirm: 'HAPUS' });
      await signOut();
      qc.clear();
      window.location.assign(DEMO ? '/' : '/masuk');
    } catch (e) {
      setError(`Akun belum terhapus: ${(e as Error).message}`);
      setBusy(false);
    }
  };
  const close = () => { if (!busy) { setText(''); setError(null); onClose(); } };
  return (
    <Sheet
      open={open}
      onClose={close}
      title="Hapus akun"
      footer={(
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={close} disabled={busy}>Batal</Button>
          <Button variant="danger" size="lg" className="flex-1" onClick={() => void run()} disabled={!ok || busy || (!DEMO && !online)}>
            {busy ? 'Menghapus…' : 'Hapus permanen'}
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft p-3">
          <Icon.Alert size={20} className="mt-0.5 shrink-0 text-danger-fg" aria-hidden="true" />
          <p className="m-0 text-label text-danger-fg">
            {DEMO
              ? 'Semua data demo di perangkat ini akan dihapus dan kamu mulai dari awal.'
              : 'Akun dan SELURUH data (tugas, kuliah, keuangan, rutinitas, chat) dihapus permanen dan tidak bisa dikembalikan. Export backup dulu bila perlu.'}
          </p>
        </div>
        <Field label='Ketik "HAPUS" untuk konfirmasi' htmlFor="del-confirm" error={error ?? undefined}>
          <input id="del-confirm" className={inputCls} value={text} autoComplete="off" autoCapitalize="characters" onChange={(e) => setText(e.target.value)} data-autofocus />
        </Field>
        {!DEMO && !online && <span className="text-meta text-warn-strong">Butuh internet untuk menghapus akun.</span>}
      </div>
    </Sheet>
  );
}

export function AccountActions() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [del, setDel] = useState(false);
  const out = async () => {
    try {
      await signOut();
      qc.clear();
      nav('/masuk', { replace: true });
    } catch {
      toast('Belum bisa keluar. Coba lagi.');
    }
  };
  return (
    <>
      <SettingsCard title="Akun">
        {!DEMO && (
          <LinkRow onClick={() => void out()} icon={<Icon.Logout size={20} className="shrink-0 text-ink-muted" />} label="Keluar" desc="Keluar dari perangkat ini" right={<span />} />
        )}
        <LinkRow onClick={() => setDel(true)} icon={<Icon.Trash size={20} className="shrink-0 text-danger-fg" />} label="Hapus akun" desc="Hapus akun & semua data" danger right={<span />} />
      </SettingsCard>
      <DeleteAccountSheet open={del} onClose={() => setDel(false)} />
    </>
  );
}
