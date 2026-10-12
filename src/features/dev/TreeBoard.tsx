// /dev/pohon — 6 tahap pohon + ikon kebun (hanya DEV).
import { TREE_NAMES } from '@common/calc/index.ts';
import { GardenIcon, Tree } from '@/components/tree/Tree';
import { Page, ScreenHeader } from '@/components/ui';

export default function TreeBoard() {
  return (
    <Page>
      <ScreenHeader overline="Halaman pengembang" title="Pohon & kebun" />
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:p-0">
        {TREE_NAMES.map((n, i) => (
          <div key={n} className="flex flex-col items-center gap-2 rounded-3xl bg-primary-soft p-3">
            <Tree stage={i} bloom={i % 2 === 1} label={n} />
            <span className="text-label font-bold">{i} · {n}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 p-4 lg:p-0">
        {[-1, 0, 1, 2, 3].map((l) => <GardenIcon key={l} level={l} />)}
        <GardenIcon level={3} bloom />
      </div>
    </Page>
  );
}
