import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PublicSite from './PublicSite';
import { PUBLIC_SITE_MODE } from './runtimeMode';
import './styles.css';

if (PUBLIC_SITE_MODE) {
  document.documentElement.dataset.publicSite = 'true';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {PUBLIC_SITE_MODE ? <PublicSite /> : <App />}
  </React.StrictMode>,
);
