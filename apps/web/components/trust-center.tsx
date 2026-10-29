export const TRUST_ITEMS = [
  {
    title: 'Doğrulanmış şirketler',
    text: 'Vergi numarası ve yönetici onayıyla doğrulanan şirketler ilan açar ve alım yapar.',
    icon: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6',
  },
  {
    title: 'Emanette ödeme',
    text: 'Ödemeniz teslimat onayına kadar emanette (escrow) tutulur.',
    icon: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4',
  },
  {
    title: '%5 teminatlı mezat',
    text: 'Mezata katılım teminatla yapılır; teklifler bağlayıcıdır.',
    icon: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  },
  {
    title: 'Anonim teklif',
    text: 'Teklif verenler "Teklif veren #n" olarak görünür, şirket adları gizli kalır.',
    icon: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM4 4l16 16',
  },
  {
    title: 'Şeffaf işlem kaydı',
    text: 'Teklif, ödeme ve yönetici işlemleri denetim kaydına yazılır.',
    icon: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  },
];

export function TrustCenter() {
  return (
    <section aria-labelledby="trust-center">
      <h2 id="trust-center" className="mb-4 text-xl font-semibold text-primary">
        Güven merkezi
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TRUST_ITEMS.map((t) => (
          <li key={t.title} className="rounded-2xl border bg-card p-4 shadow-sm">
            <span className="grid size-10 place-items-center rounded-xl bg-brand/20 text-primary">
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d={t.icon} />
              </svg>
            </span>
            <h3 className="mt-3 font-semibold text-primary">{t.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
