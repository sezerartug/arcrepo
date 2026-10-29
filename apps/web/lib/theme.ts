export const THEME_KEY = 'arc-theme';
export type ThemePref = 'light' | 'dark' | 'system';

export function isThemePref(v: unknown): v is ThemePref {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** Runs in <head> before first paint so the page never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;
