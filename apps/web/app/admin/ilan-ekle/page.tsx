import Link from 'next/link';
import { AdminTabs } from '@/components/admin-tabs';
import { Card, Empty, Field, LoadError, PageTitle, inputCls } from '@/components/common';
import { ListingForm } from '@/components/listing-form';
import { Button } from '@/components/ui/button';
import type { AdminCompanyRow, Paged } from '@/lib/admin-types';
import { loadCategories, requireMe, serverGet, toQuery } from '@/lib/server-api';

export const metadata = { title: 'İlan ekle · Yönetim · ARC Global' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminAddListingPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; q?: string }>;
}) {
  const me = await requireMe();
  if (!me.user.isAdmin) return <Empty>Bu sayfaya erişim yetkiniz yok.</Empty>;
  const sp = await searchParams;
  const companyId = sp.companyId && UUID.test(sp.companyId) ? sp.companyId : undefined;

  let body: React.ReactNode;
  if (companyId) {
    const [company, tree] = await Promise.all([
      serverGet<{ company: { id: string; legalName: string; status: string } }>(
        `/admin/companies/${companyId}`,
      ),
      loadCategories(),
    ]);
    if (!company.ok) body = <LoadError error={company.error} />;
    else if (company.data.company.status !== 'verified') {
      body = (
        <Empty>
          Yalnızca doğrulanmış şirketler adına ilan eklenebilir.{' '}
          <Link href="/admin/ilan-ekle" className="underline">
            Başka şirket seç
          </Link>
        </Empty>
      );
    } else {
      body = (
        <div className="space-y-4">
          <p className="text-sm">
            Satıcı şirket: <strong>{company.data.company.legalName}</strong>{' '}
            <Link href="/admin/ilan-ekle" className="underline">
              Değiştir
            </Link>
          </p>
          <p className="max-w-3xl rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            Bu ilan şirket adına oluşturulur ve inceleme olmadan doğrudan yayına alınır; işlem
            denetim kaydına yazılır.
          </p>
          <ListingForm categories={tree} adminCompanyId={companyId} />
        </div>
      );
    }
  } else {
    const res = await serverGet<Paged<AdminCompanyRow>>(
      `/admin/companies${toQuery({ q: sp.q, status: 'verified' })}`,
    );
    body = (
      <div className="space-y-3">
        <form method="get" className="grid max-w-xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Şirket ara (ünvan veya vergi no)" htmlFor="q">
            <input id="q" name="q" defaultValue={sp.q} className={inputCls} />
          </Field>
          <Button type="submit" variant="outline">
            Ara
          </Button>
        </form>
        {!res.ok ? (
          <LoadError error={res.error} />
        ) : res.data.items.length === 0 ? (
          <Empty>Doğrulanmış şirket bulunamadı.</Empty>
        ) : (
          <ul className="space-y-2">
            {res.data.items.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.legalName}</p>
                    <p className="text-xs text-muted-foreground">
                      VKN {c.taxNo} · {c.listingCount} ilan
                    </p>
                  </div>
                  <Link
                    href={`/admin/ilan-ekle?companyId=${c.id}`}
                    className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
                  >
                    Bu şirket adına ilan ekle
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {res.ok && res.data.total > res.data.items.length ? (
          <p className="text-xs text-muted-foreground">
            İlk {res.data.items.length} şirket gösteriliyor; aramayı daraltın.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageTitle sub="Yönetici olarak bir şirket adına ilan veya mezat açın">İlan ekle</PageTitle>
      <AdminTabs current="ilan-ekle" />
      {body}
    </div>
  );
}
