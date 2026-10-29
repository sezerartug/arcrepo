import Link from 'next/link';
import { ADMIN_SHORTCUTS } from '@/lib/account';
import type { PendingCounts } from '@/lib/types';
import { Badge } from './common';

export function AdminShortcuts({ counts }: { counts: PendingCounts | null }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ADMIN_SHORTCUTS.map(([key, label, href]) => {
        const n = counts?.[key];
        return (
          <li key={key}>
            <Link
              href={href}
              className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{label}</span>
              {n === undefined ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Badge tone={n > 0 ? 'warn' : 'neutral'}>{n}</Badge>
              )}
            </Link>
          </li>
        );
      })}
      <li className="sm:col-span-2 lg:col-span-4">
        <Link href="/admin" className="text-sm underline">
          Yönetim paneline git
        </Link>
      </li>
    </ul>
  );
}
