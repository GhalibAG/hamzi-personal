// Kartu "Pasang ke layar utama" (Pengaturan > Notifikasi, onboarding langkah 5). Tersembunyi bila sudah standalone.
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui';
import { canInstall, isStandalone, promptInstall } from '@/app/PwaPrompt';

export function InstallHint() {
  const [installable, setInstallable] = useState(canInstall());
  if (isStandalone()) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-3xl bg-info-bg p-3.5">
      <span className="flex items-center gap-2 text-body font-extrabold text-info-fg"><Icon.Phone size={18} aria-hidden="true" />Pasang ke layar utama</span>
      <span className="text-label font-semibold text-info-fg">
        Pengingat muncul sebagai notifikasi HP walau app ditutup setelah Hamzi dipasang.
        {!installable && ' Di Chrome Android: buka menu titik tiga, lalu "Instal aplikasi" atau "Tambahkan ke layar utama". Di iPhone (Safari): ketuk Bagikan, lalu "Tambah ke Layar Utama".'}
      </span>
      {installable && (
        <Button size="sm" variant="info" className="self-start" onClick={() => void promptInstall().then(() => setInstallable(canInstall()))}>
          Pasang sekarang
        </Button>
      )}
    </div>
  );
}

