'use client';

import { useState, useSyncExternalStore } from 'react';
import { clientApi } from '@/lib/api';

const ROLES = [
  ['visitor', 'Ziyaretçi'],
  ['buyer', 'Alıcı'],
  ['seller', 'Satıcı'],
  ['admin', 'Yönetici'],
] as const;

const noop = () => () => undefined;
const roleFromCookie = () =>
  /(?:^|; )arc-demo-role=([^;]+)/.exec(document.cookie)?.[1] ?? 'visitor';

export function DemoRoleSwitch() {
  const [busy, setBusy] = useState(false);
  const current = useSyncExternalStore(noop, roleFromCookie, () => 'visitor');

  async function pick(role: string) {
    if (role === current || busy) return;
    setBusy(true);
    try {
      await clientApi.post('/demo/role', { role }, false);
    } finally {
      // Full navigation: server components re-read the role cookie.
      window.location.assign(role === 'admin' ? '/admin' : role === 'seller' ? '/satici' : '/');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Demo rolü">
      <span className="mr-1">Rol:</span>
      {ROLES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={key === current}
          disabled={busy}
          onClick={() => void pick(key)}
          className={`rounded-md px-2.5 py-0.5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-chrome ${
            key === current
              ? 'bg-chrome text-chrome-foreground'
              : 'bg-brand-foreground/15 hover:bg-brand-foreground/25'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
