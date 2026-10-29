'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, ReactNode, TouchEvent } from 'react';
import { ctaCls } from '@/components/common';
import { HeroArt } from '@/components/illustrations';
import {
  HardwareSceneArt,
  HeavyMachineSceneArt,
  MachinerySceneArt,
  ProjectSceneArt,
  ScrapSceneArt,
  WarehouseSceneArt,
} from '@/components/illustrations/hero-scenes';
import type { Category } from '@/lib/types';

const INTERVAL_MS = 6000;
const SWIPE_PX = 50;

type Slide = {
  title: string;
  text: string;
  cta: string;
  /** Category name (root or child) the primary button filters by; null keeps the plain list. */
  category: string | null;
  Art: (props: { className?: string }) => ReactNode;
};

const SLIDES: Slide[] = [
  {
    title: 'İnşaat malzemesinde şirketler arası güvenli ticaret',
    text: 'Çelik ve yapı malzemelerini sabit fiyatla satın alın veya canlı mezatta teklif verin. Ödemeniz teslimata kadar emanette (escrow) güvende kalır.',
    cta: 'İlanlara göz at',
    category: 'İnşaat Malzemeleri',
    Art: HeroArt,
  },
  {
    title: 'Makine ve ekipmanda güvenilir ticaret',
    text: 'CNC tezgâhlarından robotik hatlara kadar sanayi makinelerini sabit fiyatla alın veya mezatta teklif verin. Ödeme teslimata kadar emanette kalır.',
    cta: 'Makine ilanlarına göz at',
    category: 'Makine ve Ekipman',
    Art: MachinerySceneArt,
  },
  {
    title: 'İş makinelerinde şeffaf, güvenli alım satım',
    text: 'Ekskavatör, yükleyici ve daha fazlası: doğrulanmış şirketlerin ilanlarını inceleyin, canlı mezatla en iyi fiyatı yakalayın.',
    cta: 'İş makinelerine göz at',
    category: 'İş Makineleri',
    Art: HeavyMachineSceneArt,
  },
  {
    title: 'Hurda ve geri dönüşümde adil fiyat',
    text: 'Demir, alüminyum, bakır ve daha fazlası: balya hurdayı tonaj bazlı satın alın ya da mezata çıkarın, ödemeniz emanette güvende.',
    cta: 'Hurda ilanlarına göz at',
    category: 'Hurda ve Geri Dönüşüm',
    Art: ScrapSceneArt,
  },
  {
    title: 'El aletleri ve hırdavatta toptan avantaj',
    text: 'Dişli, rulman, pompa ve motor gibi yedek parça ve el aletlerini şirketler arası güvenle tedarik edin.',
    cta: 'Hırdavat ilanlarına göz at',
    category: 'El Aletleri ve Hırdavat',
    Art: HardwareSceneArt,
  },
  {
    title: 'Fabrika ve depo ekipmanlarında ikinci el fırsatlar',
    text: 'Raf sistemleri, konveyörler ve forkliftler: tesisinizi doğrulanmış satıcılardan donatın veya atıl ekipmanınızı satın.',
    cta: 'Depo ekipmanlarına göz at',
    category: 'Fabrika ve Depo Ekipmanları',
    Art: WarehouseSceneArt,
  },
  {
    title: 'Proje ve iş ihalelerinde doğru ortak',
    text: 'Çelik konstrüksiyon, kalıp ve mühendislik işlerini şirketler arası şeffaf teklif süreciyle yürütün.',
    cta: 'Proje ilanlarına göz at',
    category: 'Proje ve İş İhaleleri',
    Art: ProjectSceneArt,
  },
];

const norm = (s: string) => s.toLocaleLowerCase('tr');

function findCategoryId(tree: Category[], name: string): string | null {
  for (const c of tree) {
    if (norm(c.name) === norm(name)) return c.id;
    const inner = c.children ? findCategoryId(c.children, name) : null;
    if (inner) return inner;
  }
  return null;
}

function hrefFor(tree: Category[], slide: Slide): string {
  if (!slide.category) return '/ilanlar';
  const id = findCategoryId(tree, slide.category);
  return id ? `/ilanlar?categoryId=${encodeURIComponent(id)}` : '/ilanlar';
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => {
        mq.removeEventListener('change', cb);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function useTabHidden(): boolean {
  return useSyncExternalStore(
    (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => {
        document.removeEventListener('visibilitychange', cb);
      };
    },
    () => document.visibilityState === 'hidden',
    () => false,
  );
}

const ctrlCls =
  'grid size-9 place-items-center rounded-full border border-chrome-foreground/40 text-chrome-foreground outline-none hover:bg-chrome-foreground/10 focus-visible:ring-3 focus-visible:ring-brand';

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export function HeroSlider({ categories }: { categories: Category[] }) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const tabHidden = useTabHidden();
  const touchX = useRef<number | null>(null);
  const count = SLIDES.length;

  const playing = !reduced && !userPaused && !hover && !focusIn && !tabHidden;
  const go = useCallback(
    (to: number) => {
      setIndex(((to % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => {
      clearTimeout(t);
    };
  }, [playing, index, count]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'ArrowRight') go(index + 1);
  }
  function onTouchStart(e: TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    if (end - start <= -SWIPE_PX) go(index + 1);
    else if (end - start >= SWIPE_PX) go(index - 1);
  }

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Sektörler"
      className="hero-gradient relative overflow-hidden rounded-3xl text-chrome-foreground shadow-lg ring-1 ring-chrome-foreground/10"
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
      onFocus={() => {
        setFocusIn(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocusIn(false);
      }}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="grid" aria-live={playing ? 'off' : 'polite'}>
        {SLIDES.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${String(i + 1)} / ${String(count)}`}
              className={`col-start-1 row-start-1 grid items-center gap-6 px-6 pt-10 pb-20 transition-opacity duration-700 motion-reduce:transition-none sm:px-10 lg:grid-cols-[1.2fr_1fr] lg:pt-14 lg:pb-20 ${active ? 'visible opacity-100' : 'invisible opacity-0'}`}
            >
              <div>
                {i === 0 ? (
                  <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
                    {s.title}
                  </h1>
                ) : (
                  <p className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
                    {s.title}
                  </p>
                )}
                <p className="mt-4 max-w-xl text-lg text-chrome-foreground/85">{s.text}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={hrefFor(categories, s)}
                    className={`${ctaCls} !h-11 !px-6 !text-base shadow-md`}
                  >
                    {s.cta}
                  </Link>
                  <Link
                    href="/kayit"
                    className="inline-flex h-11 items-center rounded-lg border border-chrome-foreground/40 px-6 text-base font-medium outline-none hover:bg-chrome-foreground/10 focus-visible:ring-3 focus-visible:ring-brand"
                  >
                    Şirketinizi kaydedin
                  </Link>
                </div>
              </div>
              <s.Art className="mx-auto h-auto max-h-56 w-full max-w-md lg:max-h-none" />
            </div>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-6 pb-5 sm:px-10">
        <button
          type="button"
          className={ctrlCls}
          aria-label="Önceki slayt"
          onClick={() => {
            go(index - 1);
          }}
        >
          <Icon d="m15 6-6 6 6 6" />
        </button>
        <button
          type="button"
          className={ctrlCls}
          aria-label="Sonraki slayt"
          onClick={() => {
            go(index + 1);
          }}
        >
          <Icon d="m9 6 6 6-6 6" />
        </button>
        {reduced ? null : (
          <button
            type="button"
            className={ctrlCls}
            aria-label={userPaused ? 'Otomatik geçişi başlat' : 'Otomatik geçişi duraklat'}
            onClick={() => {
              setUserPaused((p) => !p);
            }}
          >
            <Icon d={userPaused ? 'M8 5v14l11-7z' : 'M9 5v14M15 5v14'} />
          </button>
        )}
        <ul className="ml-2 flex items-center">
          {SLIDES.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                className="group grid size-6 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-brand"
                aria-label={`Slayt ${String(i + 1)}: ${s.title}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => {
                  go(i);
                }}
              >
                <span
                  className={`block h-2.5 rounded-full transition-all motion-reduce:transition-none ${i === index ? 'w-6 bg-brand' : 'w-2.5 bg-chrome-foreground/45 group-hover:bg-chrome-foreground/75'}`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
