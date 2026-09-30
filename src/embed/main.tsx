import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/app.css';
import '../styles/embed.css';
import { countViews } from '../lib/beacon';
import { EmbedApp } from './EmbedApp';

countViews('openingos');

// The embed keeps no state of its own on disk and registers no service worker.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EmbedApp />
  </StrictMode>,
);
