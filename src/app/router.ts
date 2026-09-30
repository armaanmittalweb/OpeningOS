import { useEffect, useSyncExternalStore } from 'react';
import type { ThemePref } from '../lib/store';

export type Route = 'repertoire' | 'graph' | 'drill' | 'games';
export const ROUTES: Array<{ id: Route; path: string; label: string }> = [
  { id: 'repertoire', path: '/', label: 'Repertoire' },
  { id: 'graph', path: '/graph', label: 'Graph' },
  { id: 'drill', path: '/drill', label: 'Drill' },
  { id: 'games', path: '/games', label: 'Games' },
];

const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb);
  return () => window.removeEventListener('popstate', cb);
};

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, () => location.pathname, () => '/');
  return ROUTES.find((r) => r.path === path.replace(/\/$/, '') || (r.path === '/' && path === '/'))?.id ?? 'repertoire';
}

export function navigate(route: Route) {
  const path = ROUTES.find((r) => r.id === route)?.path ?? '/';
  if (location.pathname !== path) {
    history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.scrollTo(0, 0);
}

/** Apply the theme preference to <html data-theme>. 'system' removes it. */
export function useTheme(pref: ThemePref) {
  useEffect(() => {
    const root = document.documentElement;
    if (pref === 'system') delete root.dataset.theme;
    else root.dataset.theme = pref;
  }, [pref]);
}
