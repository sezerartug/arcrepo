import Link from 'next/link';
import { HOME_TABS, tabHref } from '@/lib/home';

export function HomeTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Öne çıkan ilan süzgeçleri" className="mb-4 flex flex-wrap gap-2">
      {HOME_TABS.map((t) => {
        const current = t.key === active;
        return (
          <Link
            key={t.key}
            href={tabHref(t)}
            aria-current={current ? 'page' : undefined}
            className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${current ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-brand'}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
