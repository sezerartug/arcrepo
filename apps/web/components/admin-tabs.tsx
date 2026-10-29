import Link from 'next/link';
import { cn } from '@/lib/utils';

export const ADMIN_TABS = [
  ['genel', 'Genel', '/admin'],
  ['sirketler', 'Şirketler', '/admin/sirketler'],
  ['kullanicilar', 'Kullanıcılar', '/admin?tab=kullanicilar'],
  ['ilanlar', 'İlanlar', '/admin?tab=ilanlar'],
  ['mezatlar', 'Mezatlar', '/admin?tab=mezatlar'],
  ['siparisler', 'Siparişler', '/admin?tab=siparisler'],
  ['itirazlar', 'İtirazlar', '/admin?tab=itirazlar'],
  ['havaleler', 'Havaleler', '/admin?tab=havaleler'],
  ['mali-rapor', 'Mali rapor', '/admin?tab=mali-rapor'],
  ['denetim', 'Denetim', '/admin?tab=denetim'],
  ['ilan-ekle', 'İlan ekle', '/admin/ilan-ekle'],
] as const;

export function AdminTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Yönetim bölümleri" className="mb-6 flex flex-wrap gap-2">
      {ADMIN_TABS.map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={key === current ? 'page' : undefined}
          className={cn(
            'rounded-full border px-4 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            key === current ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
