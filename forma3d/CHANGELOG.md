# Journal des modifications

## Refonte v2 — phase 1 : simplicité d'usage (branche `claude/forma3d-refonte`, non fusionnée)

### Ajouté
- Parcours Simple sur `/` : demande, précisions, création en 4 étapes, résultat, téléchargement STL, curseurs de dimensions,
  « Plus petit / Plus solide / Moins cher », « Mode avancé » vers l'éditeur.
- Système de design Simple : direction « clair neutre », texte 16 px, composants (Button, Card, Slider, Tabs, Dialog, Toast).
- Bulles de premier lancement (3 au plus, fermables, mémorisées).
- Mode démonstration forcé sur les déploiements Preview Vercel (aucune écriture dans la base réelle).
- Mesures et tests : `scripts/e2e-simple.mjs`, `scripts/simple-captures.mjs`, `scripts/baseline.mjs`, `tests/preview-demo.test.ts`.
- Interrupteur administrateur « Objets décoratifs par Meshy (expérimental) », désactivé par défaut.
- Préréglages d'imprimantes (Bambu Lab, Creality, Prusa, Elegoo, Anycubic).

### Modifié
- Polices Inter et JetBrains Mono auto-hébergées (le build ne dépend plus de Google Fonts).
- `package-lock.json` versionné ; la CI utilise `npm ci`.
- L'ancienne page d'accueil est déplacée sur `/decouvrir` (rien n'est supprimé).
- Bandeau rouge « Mode démo » remplacé par un badge et un encart neutres « Exemple de démonstration ».
- Une demande sans rapport avec les exemples, en démonstration, reçoit « Je n'ai pas compris ce besoin » au lieu d'un modèle au hasard.

### Limites connues
- Les curseurs de dimensions ne sont pas encore enregistrés avec le projet.
- Parcours Simple en français uniquement pour l'instant.
- Aucune migration de base de données, aucune variable d'environnement Vercel modifiée.
