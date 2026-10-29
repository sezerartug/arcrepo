import type { ReactNode } from 'react';

// 32x32 line icons for the seven top-level categories, keyed by category slug.
const GLYPHS: Record<string, ReactNode> = {
  'insaat-malzemeleri': (
    <>
      <rect x="3" y="6" width="26" height="6" rx="1" />
      <rect x="3" y="12" width="26" height="6" rx="1" />
      <rect x="3" y="18" width="26" height="6" rx="1" />
      <path d="M12 6v6M20 12v6M12 18v6M3 28h26" />
    </>
  ),
  'makine-ekipman': (
    <>
      <circle cx="16" cy="16" r="4.5" />
      <path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M25.2 6.8l-2.8 2.8M9.6 22.4l-2.8 2.8" />
      <circle cx="16" cy="16" r="9" />
    </>
  ),
  'is-makineleri': (
    <>
      <rect x="2" y="22" width="16" height="5" rx="2.5" />
      <path d="M5 22v-5h8l2 5M9 17v-5h5v5" />
      <path d="M14 13l7-8 5 3-3 8M26 8l2 8h-4" />
    </>
  ),
  'hurda-geri-donusum': (
    <>
      <path d="M8 13l3-6h6M24 13l-3-6M21 7l3 6-5 1" />
      <path d="M22 19l-3 6H9M10 25l-3-6 5-1" />
      <path d="M5 16l3-3 3 3M27 16l-3 3-3-3" />
    </>
  ),
  'el-aletleri-hirdavat': (
    <>
      <path d="M21 4a6 6 0 0 0-5.6 8.2L4.5 23.1a2.8 2.8 0 0 0 4 4l10.9-10.9A6 6 0 0 0 27.6 11l-3.7 3.7-3.9-.7-.7-3.9L23 6.4A6 6 0 0 0 21 4z" />
    </>
  ),
  'fabrika-depo-ekipmanlari': (
    <>
      <path d="M3 28V14l7 4v-4l7 4v-4l7 4V6h5v22z" />
      <path d="M8 28v-5h4v5M16 28v-5h4v5" />
    </>
  ),
  'proje-is-ihaleleri': (
    <>
      <rect x="6" y="5" width="20" height="23" rx="2" />
      <path d="M12 5V3h8v2M11 15l3 3 6-6M11 23h10" />
    </>
  ),
};

export function TopCategoryIcon({ slug, className }: { slug: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[slug] ?? <circle cx="16" cy="16" r="10" />}
    </svg>
  );
}
