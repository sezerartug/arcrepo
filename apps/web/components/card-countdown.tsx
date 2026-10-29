'use client';

import { useEffect, useState } from 'react';
import { formatRemaining } from '@/components/auction-panel';

/** Display-only countdown for cards (client clock); the auction panel and server stay authoritative. */
export function CardCountdown({ endsAt }: { endsAt: string }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      setMs(Date.parse(endsAt) - Date.now());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => {
      clearInterval(t);
    };
  }, [endsAt]);
  const urgent = ms !== null && ms > 0 && ms < 3_600_000;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${urgent ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.5V8l2.5 1.5" />
      </svg>
      <span suppressHydrationWarning>
        {ms === null ? '--:--:--' : ms > 0 ? formatRemaining(ms) : 'Sona erdi'}
      </span>
    </span>
  );
}
