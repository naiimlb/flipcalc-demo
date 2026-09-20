# Mood — films & musiques selon ton humeur

Appli web (PWA) pensée pour iPhone : elle apprend d'abord **tes goûts**, puis analyse **ton humeur du
moment** avec une série de questions adaptatives, et te propose le film ou l'album qui colle
vraiment — avec les raisons du choix.

Tout tient dans le navigateur : pas de compte, pas de serveur, pas de donnée qui sort du téléphone.

## L'idée

Trois couches, dans cet ordre :

1. **Le profil de goûts** (une fois, ~2 min) — genres de films et de musique, œuvres de référence
   (« lesquelles te ressemblent ? »), époque préférée, tolérance aux sous-titres et à la durée,
   curseur *doudou ↔ découverte*, et des **lignes rouges** (horreur, violence, trucs plombants…)
   écartées définitivement.
2. **L'analyse d'humeur** (à chaque séance, ~8 taps) — l'humeur de départ parmi 12, puis la
   **direction** voulue (m'accompagner / m'adoucir les choses / me changer les idées / me
   surprendre), puis 6 questions **choisies dynamiquement** : l'appli pose en priorité celles qui
   lèvent le plus d'incertitude sur les axes encore flous.
3. **La recommandation** — chaque œuvre du catalogue est notée contre l'humeur visée *et* le profil.

### Les quatre axes

Chaque humeur, chaque réponse et chaque œuvre sont décrites sur les mêmes axes (0 → 1) :

| axe | de | à |
|---|---|---|
| `en` énergie | posé, immobile | électrique |
| `lu` lumière | sombre, sans filtre | solaire, réconfortant |
| `pr` profondeur | pur divertissement | exigeant, ça travaille |
| `te` tension | apaisant | le cœur qui cogne |

À quoi s'ajoutent le besoin de **familiarité** (valeur sûre ↔ jamais-vu), le **contexte social**
(seul sous le plaid ↔ à plusieurs) et le **temps disponible**.

Chaque humeur porte deux vecteurs : son *miroir* (une œuvre qui lui ressemble) et son *antidote*
(une œuvre qui la rééquilibre). La direction choisie fait le mélange entre les deux. Les réponses
suivantes déplacent la cible, pondérées par la confiance déjà acquise sur chaque axe.

### Garde-fous

- Quand quelqu'un se dit triste, épuisé ou anxieux **et** demande à être sorti de là, les œuvres
  plombantes sont écartées d'office — sauf s'il répond ensuite qu'il a envie de pleurer un coup.
- Si les filtres du moment ne laissent presque rien, l'appli élargit et le dit.
- Les lignes rouges du profil, elles, ne sont jamais contournées.

### Ce que l'appli apprend

`❤️ J'aime` renforce les genres de l'œuvre et recentre le vecteur de goût, `🚫 Pas pour moi`
l'écarte définitivement et affaiblit ses genres, `👀 Déjà vu` évite les redites quand on cherche de
la nouveauté (et devient un atout quand on cherche un doudou).

## Utilisation sur iPhone

Ouvrir `index.html` (par exemple via GitHub Pages), puis **Partager → Sur l'écran d'accueil** :
l'appli s'installe en plein écran, avec son icône, et fonctionne hors ligne (service worker).

## Contenu

125 œuvres : 64 films et 61 albums, choisis pour couvrir largement l'espace des humeurs
(du *Dîner de cons* à *Hérédité*, de *Music for Airports* à *Rage Against the Machine*),
12 humeurs de départ, 4 directions et 15 questions adaptatives.

Pour enrichir le catalogue : ajouter une ligne `F(...)` ou `M(...)` dans `js/data.js` — titre,
métadonnées, genres, les quatre axes, puis `cu` (notoriété), `so` (ça marche à plusieurs), `an`
(année), `du` (durée, films), `la` (langue), `sens` (contenus sensibles) et `d` (l'accroche).

## Fichiers

| fichier | rôle |
|---|---|
| `index.html` | structure des écrans |
| `css/app.css` | style (fond réactif à l'humeur, safe areas iPhone) |
| `js/data.js` | catalogue, humeurs, banque de questions |
| `js/engine.js` | profil, analyse d'humeur, scoring, explications |
| `js/app.js` | interface et navigation |
| `sw.js` | cache hors ligne |
