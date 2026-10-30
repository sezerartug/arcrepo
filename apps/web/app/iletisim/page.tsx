import Link from 'next/link';
import { ctaCls, PageTitle } from '@/components/common';
import { COMPANY } from '@/lib/company';

export const metadata = { title: 'İletişim · ARC Global' };

export default function ContactPage() {
  const tel = COMPANY.phone.replace(/\s/g, '');
  const rows = [
    [
      'Telefon',
      <a key="t" className="underline" href={`tel:${tel}`}>
        {COMPANY.phone}
      </a>,
    ],
    [
      'E-posta',
      <a key="e" className="underline" href={`mailto:${COMPANY.email}`}>
        {COMPANY.email}
      </a>,
    ],
    ['Çalışma saatleri', COMPANY.hours],
    ['Adres', COMPANY.address],
    ['KEP adresi', COMPANY.kep],
  ] as const;
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle sub="Sorularınız, iş birliği ve destek talepleriniz için">İletişim</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="info" className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 id="info" className="text-lg font-semibold text-primary">
            {COMPANY.name}
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="help" className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 id="help" className="text-lg font-semibold text-primary">
            Ne için yazabilirsiniz?
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            <li>Şirket kaydı ve doğrulama</li>
            <li>İlan, mezat ve sipariş süreçleri</li>
            <li>Ödeme, teminat ve iade soruları</li>
            <li>Kurumsal iş birliği</li>
            <li>KVKK başvuruları</li>
          </ul>
          <a className={`${ctaCls} mt-5`} href={`mailto:${COMPANY.email}`}>
            E-posta gönderin
          </a>
          <p className="mt-4 text-xs text-muted-foreground">
            Yaygın sorular için{' '}
            <Link className="underline" href="/sss">
              sık sorulan sorular
            </Link>{' '}
            sayfasına bakabilirsiniz.
          </p>
        </section>
      </div>
    </div>
  );
}
