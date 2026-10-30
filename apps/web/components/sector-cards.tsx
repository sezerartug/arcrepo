import Link from 'next/link';
import type { ReactNode } from 'react';
import { HeroArt } from '@/components/illustrations';
import { TopCategoryIcon } from '@/components/illustrations/category-icons';
import {
  HardwareSceneArt,
  HeavyMachineSceneArt,
  MachinerySceneArt,
  ProjectSceneArt,
  ScrapSceneArt,
  WarehouseSceneArt,
} from '@/components/illustrations/hero-scenes';
import { flattenAll, type Category } from '@/lib/types';

type Art = (props: { className?: string }) => ReactNode;

const SECTORS: { name: string; text: string; Art: Art }[] = [
  {
    name: 'İnşaat Malzemeleri',
    text: 'İnşaat demiri, sac, profil, boru, çimento ve yalıtım.',
    Art: HeroArt,
  },
  {
    name: 'Makine ve Ekipman',
    text: 'CNC tezgâhları, kaynak makineleri ve sanayi makineleri.',
    Art: MachinerySceneArt,
  },
  {
    name: 'İş Makineleri',
    text: 'Ekskavatör, yükleyici ve şantiye ekipmanları.',
    Art: HeavyMachineSceneArt,
  },
  {
    name: 'Hurda ve Geri Dönüşüm',
    text: 'Demir, alüminyum ve bakır hurda; tonaj bazlı alım satım.',
    Art: ScrapSceneArt,
  },
  {
    name: 'El Aletleri ve Hırdavat',
    text: 'Yedek parça, rulman, pompa, motor ve el aletleri.',
    Art: HardwareSceneArt,
  },
  {
    name: 'Fabrika ve Depo Ekipmanları',
    text: 'Raf sistemleri, konveyörler ve forkliftler.',
    Art: WarehouseSceneArt,
  },
  {
    name: 'Proje ve İş İhaleleri',
    text: 'Çelik konstrüksiyon, kalıp ve mühendislik hizmetleri.',
    Art: ProjectSceneArt,
  },
];

const norm = (s: string) => s.toLocaleLowerCase('tr');

/** Sector cards: the hero scene illustrations reused as card visuals. */
export function SectorCards({ categories }: { categories: Category[] }) {
  const all = flattenAll(categories);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SECTORS.map((s) => {
        const cat = all.find((c) => norm(c.name) === norm(s.name));
        const href = cat ? `/ilanlar?categoryId=${encodeURIComponent(cat.id)}` : '/ilanlar';
        return (
          <li key={s.name}>
            <Link
              href={href}
              className="group block h-full overflow-hidden rounded-2xl border bg-card shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="hero-gradient p-3" aria-hidden="true">
                <s.Art className="mx-auto h-36 w-full" />
              </div>
              <div className="p-4">
                <h3 className="flex items-center gap-2 font-semibold text-primary group-hover:text-brand-text">
                  {cat ? <TopCategoryIcon slug={cat.slug} className="size-5 shrink-0" /> : null}
                  {s.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            </Link>
          </li>
        );
      })}
      <li>
        <Link
          href="/ilanlar?condition=ikinci_el"
          className="group block h-full overflow-hidden rounded-2xl border border-brand/60 bg-card shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="hero-gradient grid h-[11.5rem] place-items-center" aria-hidden="true">
            <svg
              viewBox="0 0 32 32"
              className="size-20 text-brand"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              focusable="false"
            >
              <path d="M6 16a10 10 0 0 1 17-7l3 3M26 16a10 10 0 0 1-17 7l-3-3M26 5v7h-7M6 27v-7h7" />
            </svg>
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-primary group-hover:text-brand-text">İkinci El</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bakımlı ikinci el makine, ekipman ve hurda fırsatları.
            </p>
          </div>
        </Link>
      </li>
    </ul>
  );
}
