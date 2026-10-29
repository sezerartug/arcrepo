'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { THEME_KEY, isThemePref, type ThemePref } from '@/lib/theme';

const CHANGE = 'arc-theme-change';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemePref(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

const getServerPref = (): ThemePref => 'system';

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener('storage', cb);
  };
}

const OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  {
    value: 'light',
    label: 'Açık tema',
    icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  },
  { value: 'dark', label: 'Koyu tema', icon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' },
  {
    value: 'system',
    label: 'Sistem teması',
    icon: 'M3 5h18v11H3zM8 20h8M12 16v4',
  },
];

export function ThemeToggle() {
  const pref = useSyncExternalStore(subscribe, readPref, getServerPref);

  // Keep data-theme in sync with the preference (and with OS changes while on "system").
  useEffect(() => {
    apply(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      apply('system');
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, [pref]);

  function choose(next: ThemePref) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable: preference lasts for this page view only
    }
    apply(next);
    window.dispatchEvent(new Event(CHANGE));
  }

  return (
    <div
      role="group"
      aria-label="Tema"
      className="flex items-center rounded-lg border border-chrome-foreground/30 p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.label}
          aria-pressed={pref === o.value}
          title={o.label}
          onClick={() => {
            choose(o.value);
          }}
          className={`grid size-7 place-items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand ${pref === o.value ? 'bg-chrome-foreground text-chrome' : 'text-chrome-foreground/85 hover:bg-chrome-foreground/10'}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d={o.icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}
