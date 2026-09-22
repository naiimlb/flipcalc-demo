'use client';

/* =====================================================================
   Humeur — l'écran qui repeint l'app.
   ---------------------------------------------------------------------
   Choisir une humeur ne change pas qu'une liste : la couleur retenue
   devient celle de toute l'interface (voir magasin.tsx, qui pose
   `--accent` sur la racine).
   ===================================================================== */

import { useRouter } from 'next/navigation';

import { Bouton } from '@/components/Boutons';
import { SelecteurHumeur } from '@/components/SelecteurHumeur';
import { useApp } from '@/lib/etat/magasin';

export default function PageHumeur() {
  const { contexte, definirHumeur, definirCompagnie } = useApp();
  const routeur = useRouter();

  return (
    <div className="pb-10">
      <header className="px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 26px)' }}>
        <p className="etiquette">Ce soir</p>
        <h1
          className="mt-2.5 equilibre font-affiche font-bold leading-[1.02] text-ivoire"
          style={{ fontSize: 'clamp(30px, 8.6vw, 40px)' }}
        >
          Tu es d’humeur à quoi ?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-cendre">
          Chaque humeur change vraiment la sélection — et la couleur de l’app.
        </p>
      </header>

      <div className="mt-7">
        <SelecteurHumeur
          humeur={contexte.humeur}
          compagnie={contexte.compagnie}
          onHumeur={definirHumeur}
          onCompagnie={definirCompagnie}
          sansEntete
        />
      </div>

      <div className="mt-8 space-y-2 px-5">
        <Bouton variante="accent" pleineLargeur className="min-h-[54px]" onClick={() => routeur.push('/accueil')}>
          {contexte.humeur ? 'Voir ma sélection' : 'Sans humeur particulière'}
        </Bouton>
        {contexte.humeur && (
          <Bouton
            variante="fantome"
            pleineLargeur
            onClick={() => {
              definirHumeur(null);
              routeur.push('/accueil');
            }}
          >
            Enlever l’humeur
          </Bouton>
        )}
      </div>
    </div>
  );
}
