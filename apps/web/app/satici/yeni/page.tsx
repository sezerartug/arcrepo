import { Empty, LoadError, PageTitle } from '@/components/common';
import { ListingForm } from '@/components/listing-form';
import { requireMe, serverGet } from '@/lib/server-api';
import { type Category } from '@/lib/types';

export const metadata = { title: 'Yeni ilan · ARC Global' };

export default async function NewListingPage() {
  const me = await requireMe();
  if (me.company?.status !== 'verified') {
    return (
      <Empty>İlan verebilmek için şirketinizin yönetici tarafından onaylanması gerekir.</Empty>
    );
  }
  const res = await serverGet<Category[]>('/categories');
  return (
    <>
      <PageTitle sub="İlanınız yayınlanmadan önce yönetici tarafından incelenir">
        Yeni ilan
      </PageTitle>
      {res.ok ? <ListingForm categories={res.data} /> : <LoadError error={res.error} />}
    </>
  );
}
