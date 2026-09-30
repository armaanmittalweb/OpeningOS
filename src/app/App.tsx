import { lazy, Suspense, useMemo, useState } from 'react';
import { dueQueue, store, useDerived, useStore } from '../lib/store';
import { navigate, ROUTES, useRoute, useTheme } from './router';
import { RepertoireView } from './RepertoireView';
import { GraphView } from './GraphView';
import { DrillView } from './DrillView';
import { GamesView } from './GamesView';

const SyncDialog = lazy(() => import('./SyncDialog'));

const THEME_LABEL = { system: 'Auto', light: 'Paper', dark: 'Ink' } as const;
const NEXT_THEME = { system: 'light', light: 'dark', dark: 'system' } as const;

export function App() {
  const route = useRoute();
  const settings = useStore((s) => s.settings);
  const persistent = useStore((s) => s.persistent);
  const sched = useStore((s) => s.data.cards);
  const { cards } = useDerived();
  const [syncOpen, setSyncOpen] = useState(false);
  useTheme(settings.theme);

  const queue = useMemo(() => dueQueue(cards, sched), [cards, sched]);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <a
          className="wordmark"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('repertoire');
          }}
        >
          Opening<span>OS</span>
        </a>
        <nav className="nav" aria-label="Main">
          {ROUTES.map((r) => (
            <a
              key={r.id}
              href={r.path}
              aria-current={route === r.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(r.id);
              }}
            >
              {r.label}
            </a>
          ))}
        </nav>
        <div className="top-actions">
          {queue.length > 0 && route !== 'drill' && (
            <button type="button" className="btn btn-due top-due" onClick={() => navigate('drill')}>
              Drill <span className="count">{queue.length}</span>
            </button>
          )}
          <button
            type="button"
            className="link top-link"
            onClick={() => store.setSettings({ theme: NEXT_THEME[settings.theme] })}
            aria-label={`Theme: ${THEME_LABEL[settings.theme]}. Switch theme`}
          >
            {THEME_LABEL[settings.theme]}
          </button>
          <button type="button" className="link top-link" onClick={() => setSyncOpen(true)}>
            Sync
          </button>
        </div>
      </header>
      {!persistent && (
        <p className="notice" role="status">
          This browser is not letting OpeningOS save to disk (private window?). Your work will be lost when you close the tab.
        </p>
      )}
      <main id="main" tabIndex={-1}>
        {route === 'repertoire' && <RepertoireView />}
        {route === 'graph' && <GraphView />}
        {route === 'drill' && <DrillView />}
        {route === 'games' && <GamesView />}
      </main>
      {syncOpen && (
        <Suspense fallback={null}>
          <SyncDialog onClose={() => setSyncOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
