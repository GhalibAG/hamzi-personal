import { ButtonLink, EmptyState, Page } from '@/components/ui';

export function NotFound() {
  return (
    <Page narrow>
      <div className="p-4 lg:p-0">
        <EmptyState mood="worried" title="Halaman tidak ditemukan" text="Tautannya mungkin sudah berubah." action={<ButtonLink to="/" size="sm">Ke Beranda</ButtonLink>} />
      </div>
    </Page>
  );
}
