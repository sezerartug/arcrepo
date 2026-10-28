import { ActionButton } from '@/components/action-button';
import { Empty, LoadError, PageTitle } from '@/components/common';
import { ListingCard } from '@/components/listing-card';
import { loadCategories, requireMe, serverGet } from '@/lib/server-api';
import { withUnits, type Listing } from '@/lib/types';

export const metadata = { title: 'Favoriler · ARC Global' };

export default async function FavoritesPage() {
  await requireMe();
  const [res, cats] = await Promise.all([
    serverGet<Listing[] | { items: Listing[] }>('/favorites'),
    loadCategories(),
  ]);
  const items = res.ok ? (Array.isArray(res.data) ? res.data : res.data.items) : [];

  return (
    <>
      <PageTitle>Favoriler</PageTitle>
      {!res.ok ? (
        <LoadError error={res.error} />
      ) : items.length === 0 ? (
        <Empty>Henüz favori ilanınız yok.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {withUnits(items, cats).map((l) => (
            <div key={l.id} className="space-y-2">
              <ListingCard listing={l} />
              <ActionButton
                path={`/listings/${l.id}/favorite`}
                method="DELETE"
                label="Favorilerden çıkar"
                variant="outline"
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
