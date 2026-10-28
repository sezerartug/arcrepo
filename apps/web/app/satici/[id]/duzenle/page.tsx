import { Empty, LoadError, PageTitle } from '@/components/common';
import { ListingEditForm } from '@/components/listing-edit-form';
import { loadCategories, requireMe, serverGet } from '@/lib/server-api';
import { flattenCategories, withUnits, type Listing } from '@/lib/types';

export const metadata = { title: 'İlanı düzenle · ARC Global' };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe();
  if (me.company?.status !== 'verified') {
    return <Empty>İlan düzenleyebilmek için şirketinizin onaylı olması gerekir.</Empty>;
  }
  const [res, tree] = await Promise.all([serverGet<Listing>(`/listings/${id}`), loadCategories()]);
  if (!res.ok) {
    return res.error.status === 404 ? <p>İlan bulunamadı.</p> : <LoadError error={res.error} />;
  }
  const listing = withUnits([res.data], tree)[0] ?? res.data;
  if (listing.companyId !== me.company.id) return <p>İlan bulunamadı.</p>;
  // Backend rules: sold/removed listings and published auctions cannot be edited.
  const editable =
    listing.status === 'pending_review' ||
    listing.status === 'rejected' ||
    (listing.status === 'published' && listing.saleType === 'fixed');
  return (
    <>
      <PageTitle sub="Değişiklikler yeniden yönetici incelemesine gönderilir">
        İlanı düzenle
      </PageTitle>
      {editable ? (
        <ListingEditForm listing={listing} categories={flattenCategories(tree)} />
      ) : (
        <Empty>Bu ilan mevcut durumunda düzenlenemez.</Empty>
      )}
    </>
  );
}
