// /dev/maskot — papan 8 mood (hanya DEV). Bandingkan dengan docs/prototype/screens/21-maskot-8-mood.png.
import { useState } from 'react';
import { Mascot } from '@/components/mascot/Mascot';
import { MOOD_LIST, MOODS } from '@/components/mascot/moods';
import { Chip, Page, ScreenHeader } from '@/components/ui';

export default function MascotBoard() {
  const [mirror, setMirror] = useState(false);
  return (
    <Page>
      <ScreenHeader overline="Halaman pengembang" title="Maskot Hamzi" right={<Chip selected={mirror} onClick={() => setMirror((v) => !v)}>Orientasi B</Chip>} />
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:p-0">
        {MOOD_LIST.map((m) => (
          <div key={m} className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface p-3">
            <Mascot mood={m} size={120} mirror={mirror} decorative={false} />
            <span className="text-label font-bold">{m} · {MOODS[m].name}</span>
          </div>
        ))}
      </div>
    </Page>
  );
}
