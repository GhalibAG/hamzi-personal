// Pengaturan > Profil (SET-01): nama panggilan.
import { useState, type FormEvent } from 'react';
import { Mascot } from '@/components/mascot/Mascot';
import { Button, ErrorState, Field, inputCls, Skeleton } from '@/components/ui';
import { DEMO } from '@/data';
import { useProfile, useSettings, useUpdateProfile } from '@/data/hooks';
import { toast } from '@/stores/ui';
import { useSession } from '@/features/auth/session';
import { CardBody, SettingsCard } from '../components/rows';

export function ProfileSection() {
  const profile = useProfile();
  const s = useSettings();
  const session = useSession();
  const upd = useUpdateProfile();
  const [draft, setDraft] = useState<string | null>(null);
  if (profile.isLoading) return <Skeleton className="h-40" />;
  if (profile.isError || !profile.data) return <ErrorState text="Profil belum bisa dimuat." onRetry={() => void profile.refetch()} />;
  const current = profile.data.display_name;
  const value = draft ?? current;
  const name = value.trim();
  const error = name.length === 0 ? 'Nama panggilan wajib diisi.' : name.length > 40 ? 'Maksimal 40 karakter.' : undefined;
  const dirty = name !== current;
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (error || !dirty) return;
    upd.mutate({ display_name: name }, {
      onSuccess: () => { setDraft(null); toast('Nama tersimpan.'); },
      onError: () => toast('Nama belum tersimpan. Coba lagi.'),
    });
  };
  return (
    <>
      <div className="flex items-center gap-3.5 rounded-3xl bg-primary-soft p-4">
        <Mascot mood="happy" size={64} mirror={s.eye_mirror} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-h3 font-extrabold text-brand-900">Hai, {current}!</span>
          <span className="truncate text-meta text-brand-800">{DEMO ? 'Mode demo · data di perangkat ini' : session.email ?? 'Akun Hamzi'}</span>
        </div>
      </div>
      <SettingsCard title="Profil">
        <CardBody>
          <form onSubmit={save} className="flex flex-col gap-3" noValidate>
            <Field label="Nama panggilan" htmlFor="pf-name" hint="Dipakai Hamzi untuk menyapamu." error={draft !== null ? error : undefined}>
              <input id="pf-name" className={inputCls} value={value} maxLength={60} autoComplete="nickname" onChange={(e) => setDraft(e.target.value)} />
            </Field>
            <Button type="submit" className="self-start" disabled={!!error || !dirty || upd.isPending}>Simpan</Button>
          </form>
        </CardBody>
      </SettingsCard>
    </>
  );
}
