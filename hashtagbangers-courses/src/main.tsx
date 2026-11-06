import '@fontsource/anton/latin-400.css';
import '@fontsource/permanent-marker/latin-400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { hydrate } from './state/store';

// On relit d'abord ce qui a été sauvegardé (IndexedDB), puis on affiche : l'écran s'ouvre déjà dans l'état laissé.
// Si la lecture échoue pour une raison imprévue, on démarre quand même (liste vide) plutôt qu'un écran blanc.
hydrate()
  .catch(() => undefined)
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
