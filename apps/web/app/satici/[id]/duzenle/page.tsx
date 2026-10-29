import { Empty, LoadError, PageTitle } from '@/components/common';
import { ListingEditForm } from '@/components/listing-edit-form';
import { ListingImageGallery } from '@/components/listing-image-gallery';
import { loadCategories, requireMe, serverGet } from '@/lib/server-api';
import { withUnits, type Listing } from '@/lib/types';

export const metadata = { title: 'İlanı düzenle · ARC Global' };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe();
  const isAdmin = me.user.isAdmin;
  if (!isAdmin && me.company?.status !== 'verified') {
    return <Empty>İlan düzenleyebilmek için şirketinizin onaylı olması gerekir.</Empty>;
  }
  const [res, tree] = await Promise.all([serverGet<Listing>(`/listings/${id}`), loadCategories()]);
  if (!res.ok) {
    return res.error.status === 404 ? <p>İlan bulunamadı.</p> : <LoadError error={res.error} />;
  }
  const listing = withUnits([res.data], tree)[0] ?? res.data;
  const isOwner = !!me.company && listing.companyId === me.company.id;
  if (!isAdmin && !isOwner) return <p>İlan bulunamadı.</p>;
  // Backend rules: sold/removed listings and published auctions cannot be edited.
  const editable =
    isOwner &&
    (listing.status === 'pending_review' ||
      listing.status === 'rejected' ||
      (listing.status === 'published' && listing.saleType === 'fixed'));
  const closed = listing.status === 'removed' || listing.status === 'sold';
  const images = (listing.images ?? []).flatMap((i) =>
    typeof i !== 'string' && i.id && i.url ? [{ id: i.id, url: i.url }] : [],
  );
  const adminOnly = isAdmin && !isOwner;
  // Admin edit follows the same lock: sold/removed listings and published auctions stay fixed.
  const adminEditable =
    adminOnly && !closed && !(listing.saleType === 'auction' && listing.status === 'published');
  return (
    <div className="space-y-8">
      <PageTitle
        sub={
          adminOnly
            ? `${listing.sellerName ?? 'Şirket'} adına ilanı düzenleyin`
            : 'Değişiklikler yeniden yönetici incelemesine gönderilir'
        }
      >
        İlanı düzenle
      </PageTitle>
      {editable || adminEditable ? (
        <ListingEditForm listing={listing} categories={tree} admin={adminEditable} />
      ) : (
        <Empty>
          {adminOnly
            ? 'Bu ilanın alanları mevcut durumunda düzenlenemez (yayındaki mezat ilanı veya kapalı ilan); yönetici olarak görselleri değiştirebilirsiniz.'
            : 'Bu ilan mevcut durumunda düzenlenemez.'}
        </Empty>
      )}
      {closed ? null : <ListingImageGallery listingId={listing.id} initial={images} />}
    </div>
  );
}
