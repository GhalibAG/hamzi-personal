// Masuk `/masuk` (UI-SPEC §12, AUTH-01): Google OAuth atau tautan email (magic link). Mode demo: langsung masuk.
import { useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button, inputCls } from '@/components/ui';
import { DEMO } from '@/data';
import { cx } from '@/lib/cx';
import { useIsDesktop } from '@/lib/hooks';
import { AuthCard, GreenBackdrop } from '../components/AuthFrame';
import { signInWithEmail, signInWithGoogle, useSession } from '../session';

const emailSchema = z.string().trim().email('Format email belum benar.');
const DEMO_MSG = 'Mode demo tidak memakai akun. Ketuk "Masuk ke demo".';

/** Tombol putih di atas latar hijau (HP). */
function WhiteButton({ icon, children, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button
      type={type}
      className={cx('inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-n-0 px-6 text-section font-extrabold text-brand-800 shadow-1 transition-colors hover:bg-brand-50 disabled:opacity-60', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export default function LoginPage() {
  const desktop = useIsDesktop();
  const session = useSession();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);

  if (!DEMO && session.status === 'in') return <Navigate to="/" replace />;

  const google = async () => {
    setErr(null);
    if (DEMO) { setErr(DEMO_MSG); return; }
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (e) {
      setErr(`Gagal masuk dengan Google: ${(e as Error).message}`);
      setBusy(null);
    }
  };
  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const p = emailSchema.safeParse(email);
    if (!p.success) { setErr(p.error.issues[0].message); return; }
    if (DEMO) { setErr(DEMO_MSG); return; }
    setBusy('email');
    try {
      await signInWithEmail(p.data);
      setSent(p.data);
    } catch (e2) {
      const m = (e2 as Error).message;
      setErr(/signups not allowed|not found|user/i.test(m) ? 'Email ini belum terdaftar sebagai pemilik Hamzi.' : `Tautan belum terkirim: ${m}`);
    } finally {
      setBusy(null);
    }
  };

  const onCard = desktop;
  const googleLabel = busy === 'google' ? 'Membuka Google…' : 'Masuk dengan Google';
  const emailLabel = busy === 'email' ? 'Mengirim…' : 'Kirim tautan ke email';
  const brand = (
    <div className="flex flex-col items-center gap-2 text-center">
      <Mascot mood="calm" size={120} />
      <h1 className={cx('m-0 text-title font-extrabold tracking-[-0.5px]', onCard ? 'text-ink' : 'text-on-primary')}>Hamzi</h1>
      <p className={cx('m-0 text-body', onCard ? 'text-ink-2' : 'text-on-header-sub')}>Teman kecil untuk rencanamu</p>
    </div>
  );

  const actions = (
    <div className="flex flex-col gap-3">
      {DEMO && (
        <div className={cx('flex flex-col gap-2 rounded-3xl p-3.5', onCard ? 'bg-primary-soft' : 'bg-white-14')}>
          <span className={cx('flex items-start gap-2 text-label font-semibold', onCard ? 'text-brand-800' : 'text-on-primary')}>
            <Icon.Info size={18} className="mt-px shrink-0" aria-hidden="true" />
            Mode demo — data tersimpan di perangkat ini
          </span>
          {onCard
            ? <Button size="lg" block onClick={() => nav('/', { replace: true })}>Masuk ke demo</Button>
            : <WhiteButton onClick={() => nav('/', { replace: true })}>Masuk ke demo</WhiteButton>}
        </div>
      )}
      {onCard ? (
        <Button size="lg" block variant="secondary" onClick={() => void google()} disabled={busy !== null}>{googleLabel}</Button>
      ) : (
        <WhiteButton onClick={() => void google()} disabled={busy !== null}>{googleLabel}</WhiteButton>
      )}
      {sent ? (
        <div role="status" className={cx('flex flex-col gap-1 rounded-3xl p-3.5 text-center', onCard ? 'bg-primary-soft' : 'bg-n-0')}>
          <span className="text-section font-extrabold text-brand-800">Cek email kamu</span>
          <span className="text-label text-ink-2">Tautan masuk sudah dikirim ke {sent}. Buka dari HP ini.</span>
          <button type="button" className="mt-1 h-11 bg-transparent text-label font-extrabold text-primary" onClick={() => setSent(null)}>Kirim ulang</button>
        </div>
      ) : (
        <form onSubmit={(e) => void sendLink(e)} noValidate className="flex flex-col gap-2">
          <label htmlFor="login-email" className={cx('text-label font-bold', onCard ? 'text-ink-muted' : 'text-on-header-sub')}>Email</label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nama@email.com"
            className={cx(inputCls, 'bg-n-0 text-n-900')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {onCard ? (
            <Button type="submit" size="lg" block icon={<Icon.Send size={18} />} disabled={busy !== null || !email.trim()}>{emailLabel}</Button>
          ) : (
            <WhiteButton type="submit" icon={<Icon.Send size={18} />} disabled={busy !== null || !email.trim()}>{emailLabel}</WhiteButton>
          )}
        </form>
      )}
      {err && (
        <p role="alert" className={cx('m-0 rounded-2xl px-3 py-2 text-label font-semibold', onCard ? 'bg-danger-bg text-danger-fg' : 'bg-n-0 text-danger-fg')}>{err}</p>
      )}
    </div>
  );

  if (desktop) {
    return (
      <AuthCard className="gap-6">
        {brand}
        {actions}
      </AuthCard>
    );
  }
  return (
    <GreenBackdrop className="flex flex-col px-6 pt-10 pb-8">
      <div className="relative flex flex-1 flex-col items-center justify-center py-8">{brand}</div>
      <div className="relative mx-auto w-full max-w-110">{actions}</div>
    </GreenBackdrop>
  );
}
