import type { ReactNode } from 'react';

const deco = { 'aria-hidden': true, focusable: false } as const;

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 32" role="img" aria-label="ARC Global" className={className}>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M7 24 16 7l9 17h-5l-4-8-4 8z" fill="var(--brand-foreground)" />
      <text
        x="40"
        y="22"
        fontSize="17"
        fontWeight="700"
        fill="currentColor"
        fontFamily="var(--font-sans), system-ui, sans-serif"
      >
        ARC <tspan fontWeight="400">Global</tspan>
      </text>
    </svg>
  );
}

/** Construction-site silhouette: crane, girders, rebar bundle. Decorative. */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 360" className={className} {...deco}>
      <circle cx="380" cy="80" r="46" fill="var(--brand)" opacity="0.18" />
      <circle cx="380" cy="80" r="26" fill="var(--brand)" opacity="0.35" />
      {/* crane */}
      <g stroke="#fff" strokeOpacity="0.85" strokeWidth="3" fill="none">
        <path d="M120 320V60M150 320V60M120 80h30M120 120h30M120 160h30M120 200h30M120 240h30M120 280h30" />
        <path d="M60 60h300M60 60l60-40 30 0 210 40M120 60l-20-22h50" />
        <path d="M300 60v90" strokeWidth="2" />
      </g>
      <rect x="284" y="150" width="32" height="22" rx="3" fill="var(--brand)" />
      <rect x="60" y="52" width="26" height="16" fill="#fff" fillOpacity="0.3" />
      {/* buildings */}
      <g fill="#fff" fillOpacity="0.12">
        <rect x="200" y="200" width="70" height="120" />
        <rect x="360" y="170" width="80" height="150" />
        <rect x="280" y="240" width="60" height="80" />
      </g>
      <g fill="#fff" fillOpacity="0.28">
        <rect x="212" y="214" width="12" height="12" />
        <rect x="236" y="214" width="12" height="12" />
        <rect x="212" y="242" width="12" height="12" />
        <rect x="236" y="242" width="12" height="12" />
        <rect x="374" y="186" width="12" height="12" />
        <rect x="400" y="186" width="12" height="12" />
        <rect x="374" y="214" width="12" height="12" />
        <rect x="400" y="214" width="12" height="12" />
      </g>
      {/* rebar bundle + I-beam */}
      <g stroke="var(--brand)" strokeWidth="6" strokeLinecap="round">
        <path d="M20 322h200M20 334h200M20 346h200" />
      </g>
      <g fill="#fff" fillOpacity="0.9">
        <rect x="250" y="322" width="190" height="8" />
        <rect x="250" y="346" width="190" height="8" />
        <rect x="340" y="330" width="10" height="16" />
      </g>
      <path d="M0 358h480" stroke="#fff" strokeOpacity="0.4" />
    </svg>
  );
}

type Kind =
  'demir' | 'profil' | 'sac' | 'boru' | 'cimento' | 'agrega' | 'tugla' | 'yalitim' | 'genel';

export const CATEGORY_KINDS: { kind: Exclude<Kind, 'genel'>; label: string }[] = [
  { kind: 'demir', label: 'İnşaat demiri' },
  { kind: 'profil', label: 'Profil' },
  { kind: 'sac', label: 'Sac' },
  { kind: 'boru', label: 'Boru' },
  { kind: 'cimento', label: 'Çimento' },
  { kind: 'agrega', label: 'Agrega' },
  { kind: 'tugla', label: 'Tuğla' },
  { kind: 'yalitim', label: 'Yalıtım' },
];

/** Maps a category name/slug to an illustration kind (Turkish keywords, ASCII-folded). */
export function categoryKind(name?: string): Kind {
  const n = (name ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o');
  if (/demir|nervur|filmasin|donati|insaat-d/.test(n)) return 'demir';
  if (/profil|ipe|hea|heb|kutu|npu|iprofil|kose/.test(n)) return 'profil';
  if (/sac|levha|rulo|galvaniz/.test(n)) return 'sac';
  if (/boru|tup/.test(n)) return 'boru';
  if (/cimento|beton|harc/.test(n)) return 'cimento';
  if (/agrega|kum|cakil|micir/.test(n)) return 'agrega';
  if (/tugla|briket|blok|gazbeton/.test(n)) return 'tugla';
  if (/yalitim|izolasyon|cam yunu|tas yunu|eps|xps/.test(n)) return 'yalitim';
  return 'genel';
}

function glyph(kind: Kind): ReactNode {
  switch (kind) {
    case 'demir':
      return (
        <g strokeLinecap="round">
          <path d="M5 8h22M5 16h22M5 24h22" strokeWidth="3" />
          <path
            d="M9 6l2 4M15 6l2 4M21 6l2 4M9 14l2 4M15 14l2 4M21 14l2 4M9 22l2 4M15 22l2 4M21 22l2 4"
            strokeWidth="1.2"
          />
        </g>
      );
    case 'profil':
      return <path d="M6 6h20v5h-7.5v10H26v5H6v-5h7.5V11H6z" fill="currentColor" stroke="none" />;
    case 'sac':
      return (
        <g>
          <path d="M4 12 22 8l6 5-18 4z" fill="currentColor" fillOpacity=".25" />
          <path d="M4 12v4l6 5V17M10 17l18-4M28 13v4l-18 4" />
        </g>
      );
    case 'boru':
      return (
        <g>
          <rect x="4" y="9" width="24" height="14" rx="7" />
          <circle cx="25" cy="16" r="3.5" />
          <path d="M4 16h2" />
        </g>
      );
    case 'cimento':
      return (
        <g>
          <path d="M7 8h18l2 3-1 15H6L5 11z" fill="currentColor" fillOpacity=".2" />
          <path d="M10 15h12M10 19h12" />
        </g>
      );
    case 'agrega':
      return (
        <g fill="currentColor" fillOpacity=".25">
          <path d="M3 26 11 12l7 14zM14 26l8-10 8 10z" />
          <circle cx="7" cy="28" r="1" />
        </g>
      );
    case 'tugla':
      return (
        <g>
          <path
            d="M4 8h24v6H4zM4 14h11v6H4zM15 14h13v6H15zM4 20h24v6H4z"
            fill="currentColor"
            fillOpacity=".2"
          />
        </g>
      );
    case 'yalitim':
      return (
        <g>
          <rect x="5" y="7" width="22" height="18" rx="2" fill="currentColor" fillOpacity=".15" />
          <path d="M5 12c3-3 5 3 8 0s5 3 8 0 4 3 6 0M5 19c3-3 5 3 8 0s5 3 8 0 4 3 6 0" />
        </g>
      );
    default:
      return <path d="M16 4 28 11v10L16 28 4 21V11zM4 11l12 7 12-7M16 18v10" />;
  }
}

export function CategoryIcon({ kind, className }: { kind: Kind; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      {...deco}
    >
      {glyph(kind)}
    </svg>
  );
}

const PALETTE: Record<Kind, [string, string]> = {
  demir: ['#1e3a5f', '#f08a24'],
  profil: ['#23405e', '#9fb7d1'],
  sac: ['#2c4a52', '#8fc1c9'],
  boru: ['#3a3f66', '#a9b0f0'],
  cimento: ['#46474f', '#c9c9d1'],
  agrega: ['#5a4a35', '#e0b87a'],
  tugla: ['#6b3a2e', '#e89a7e'],
  yalitim: ['#3d5a3a', '#e8d87a'],
  genel: ['#1f3556', '#8aa4c8'],
};

/** Category-coloured placeholder for listings without photos. Decorative; callers label it. */
export function PlaceholderArt({ category, className }: { category?: string; className?: string }) {
  const kind = categoryKind(category);
  const [bg, fg] = PALETTE[kind];
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} {...deco}>
      <rect width="400" height="300" fill={bg} />
      <g stroke={fg} strokeOpacity=".15" strokeWidth="2">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${String(i * 40 - 100)} 300 ${String(i * 40 + 100)} 0`} />
        ))}
      </g>
      <g transform="translate(140 90) scale(3.6)" style={{ color: fg }}>
        <CategoryGlyph kind={kind} />
      </g>
    </svg>
  );
}

function CategoryGlyph({ kind }: { kind: Kind }) {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {glyph(kind)}
    </g>
  );
}
