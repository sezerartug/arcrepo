import Link from 'next/link';
import { quickSearchTags } from '@/lib/home';
import type { Category } from '@/lib/types';
import { inputCls } from './common';

export function HomeSearch({ categories }: { categories: Category[] }) {
  const tags = quickSearchTags(categories);
  return (
    <section aria-labelledby="home-search" className="space-y-3">
      <h2 id="home-search" className="sr-only">
        İlan ara
      </h2>
      <form action="/ilanlar" method="get" role="search" className="flex gap-2">
        <label htmlFor="home-q" className="sr-only">
          İlanlarda ara
        </label>
        <input
          id="home-q"
          name="q"
          type="search"
          required
          placeholder="Ürün, kategori veya marka ara"
          className={`${inputCls} h-11 flex-1`}
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Ara
        </button>
      </form>
      <ul aria-label="Hızlı arama" className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="inline-flex h-8 items-center rounded-full border bg-card px-3 text-sm outline-none hover:border-brand focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
