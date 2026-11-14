# Journal des modifications

## Refonte v2 — phases 3 et 4 (branche `claude/forma3d-refonte`, non fusionnée)

### Ajouté
- Export 3MF posé et centré sur le plateau ; mention « générée par IA » dans le 3MF et le STL.
- Photo + une mesure de référence sur l'accueil ; bibliothèque de pièces normalisées ; miniatures dans Mon espace.
- Pages légales (à compléter), badge « Générée par IA » et avertissement d'usage sur chaque pièce.
- Filtre de contenu (armes, contenus protégés), CSP, limites de débit, robots.txt, sitemap.xml, Open Graph, page 404.

### Modifié
- « Utiliser comme point de départ » devient « Remixer cette pièce ».
- Accueil : un seul lien de compte et un pied de page légal.
- zod 3 → 4.6.7 (majeure) et postcss 8.5.33 : 0 vulnérabilité selon npm audit.

### À faire de ton côté
- Compléter les champs [À COMPLÉTER] des pages légales (et les faire relire).

## Refonte v2 — phase 2 : fiabilité (branche `claude/forma3d-refonte`, non fusionnée)

### Ajouté
- Vérifications automatiques après génération et niveau de confiance affiché.
- Une seule tentative de correction automatique pour les défauts bloquants (pièce flottante, paroi critique).
- Paramètres nommés (curseurs en langage courant, sans appel à l'IA) ; exemple sur le support de téléphone.
- Refus des pièces critiques (avant tout appel, sans crédit consommé) et avertissements pour les usages sensibles.
- Comparatif de modèles prêt (`scripts/compare-models.ts`, job CI manuel avec plafond de dépense).

### En attente
- Comparatif réel : nécessite le secret GitHub `ANTHROPIC_API_KEY` (budget validé ≈ 2 à 3 $).
- Choix du modèle et de l'effort, objectif « moins de 30 s dans 80 % des cas » : après le comparatif.

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
