'use client';

/* =====================================================================
   ReglagesPWA.tsx — Ce que Next.js ne pose pas tout seul dans le <head>.
   ---------------------------------------------------------------------
   Deux choses :
     • les écrans de lancement iOS (`apple-touch-startup-image`), qui
       n'ont pas d'équivalent dans l'API `metadata` de Next ;
     • l'enregistrement du service worker.
   React 19 remonte automatiquement les <link> dans le <head>.
   ===================================================================== */

import { useEffect } from 'react';

const LANCEMENTS = [
  { fichier: 'lancement-1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
  { fichier: 'lancement-1179x2556.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
  { fichier: 'lancement-1170x2532.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
  { fichier: 'lancement-750x1334.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
];

export function ReglagesPWA() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // En développement, un service worker complique le rechargement.
    if (process.env.NODE_ENV !== 'production') return;
    const enregistrer = () => navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    if (document.readyState === 'complete') enregistrer();
    else window.addEventListener('load', enregistrer, { once: true });
  }, []);

  return (
    <>
      {LANCEMENTS.map((l) => (
        <link key={l.fichier} rel="apple-touch-startup-image" href={`/icons/${l.fichier}`} media={l.media} />
      ))}
    </>
  );
}
