import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { App } from './app/App';
import { initStore } from './lib/store';

const root = createRoot(document.getElementById('root')!);

initStore()
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch(() => {
    root.render(<p className="fatal">OpeningOS could not start in this browser. Try reloading the page.</p>);
  });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}
