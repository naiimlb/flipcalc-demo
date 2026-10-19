# Grat'Coran

Le « Shazam du Coran » : l'app écoute une récitation et indique la **sourate** et, pour les
sourates de 20 versets ou plus, le **verset**. PWA installable sur iPhone.

- Next.js (App Router) · TypeScript · Tailwind · Framer Motion
- Supabase : authentification email + mot de passe, historique (RLS stricte)
- Transcription arabe côté serveur (Groq `whisper-large-v3` par défaut, ou OpenAI)
- Texte coranique et traduction française : paquet npm `quran-json` (jamais modifié)

## Lancer en local

```bash
cd gratcoran
cp .env.example .env.local   # puis remplir les valeurs
npm install
npm run dev                  # http://localhost:3000
```

Le micro exige HTTPS sauf sur `localhost`. Pour tester sur iPhone, utiliser le déploiement Vercel.

## Variables d'environnement

| Nom | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase (publishable) |
| `TRANSCRIPTION_PROVIDER` | `groq` (défaut) ou `openai` |
| `GROQ_API_KEY` | Clé Groq (serveur uniquement) |
| `OPENAI_API_KEY` | Clé OpenAI si `TRANSCRIPTION_PROVIDER=openai` |
| `TRANSCRIPTION_MODEL` | Optionnel : remplace le modèle par défaut |
| `LONG_SURAH_THRESHOLD` | Optionnel : seuil « sourate longue » (défaut 20) |
| `NEXT_PUBLIC_SITE_URL` | Optionnel : URL publique (liens des emails) |

## Scripts

`npm run typecheck` · `npm run lint` · `npm test` (Vitest : 1 600 extraits bruités pour la
reconnaissance, détecteur de règles, alignement et 300 passages pour le Tajweed) · `npm run build`

## Tests de bout en bout

`e2e/` (Playwright, WebKit iPhone + Chromium avec micro simulé) tourne sur GitHub Actions
contre la production (`.github/workflows/gratcoran-e2e.yml`). Le workflow génère un mot de
passe aléatoire qui ne quitte jamais le runner, publie seulement son empreinte bcrypt sur la
branche `claude/grat-coran-e2e`, puis attend (15 min max) que le compte de test soit créé en
base. Captures publiées sur la branche `claude/grat-coran-screens`.

## Base de données

Migrations SQL dans `supabase/migrations/` : table `recognitions` (historique, RLS par
utilisateur), fonction `consume_recognize_quota` (6 requêtes/minute, 150/jour), tables
`user_settings` et `tajweed_sessions` et fonction `consume_tajweed_quota`.
L'audio n'est jamais stocké.

## Matching

Texte normalisé (sans voyelles, lettres unifiées, alifs et espaces retirés), index de
trigrammes sur des fenêtres de 1 à 3 versets consécutifs, score
`0,7 × couverture de la requête + 0,3 × Dice`. La confiance (haute / moyenne / faible)
dépend du score et de l'écart avec la meilleure autre sourate.

## Correcteur de Tajweed

Onglet « Tajweed » : choix d'un passage (1 à 3 versets, segments pour les longs versets),
préparation (texte voyellé, traduction, règles du passage en pastilles), récitation (30 s
maximum), analyse mot à mot, comparaison avec l'essai précédent et historique dédié
(« Mon parcours »). Un avertissement doit être accepté au premier accès (`user_settings`).

- Transcription : Groq `whisper-large-v3`, langue `ar`, `verbose_json` avec horodatage par mot,
  côté serveur (`/api/tajweed`, authentification, 5 Mo maximum, 6 requêtes/minute et
  120/jour). **Aucun texte attendu n'est passé dans le paramètre `prompt`** : il biaiserait la
  transcription et masquerait les erreurs.
- Comparaison : squelettes normalisés, alignement Needleman-Wunsch (avec mots collés, coupés et
  inversés), puis différences lettre à lettre (lettre confondue, mot manquant ou ajouté).
- Règles : détecteur maison (`src/lib/tajweed/rules.ts`) qui lit les signes du texte uthmani
  de `quran-json` (convention KFGQPC : soukoun, tanwin décalé, petit mim d'iqlab, maddah,
  chadda, signes de pause). Les règles de durée, de nasalisation, de rebond et de timbre sont
  présentées comme « points d'attention », jamais comme des fautes.
- Source d'annotations envisagée : [cpfair/quran-tajweed](https://github.com/cpfair/quran-tajweed)
  (CC BY 4.0). Non utilisée : ses positions renvoient au texte Tanzil de 2017, pas au texte
  affiché ici ; les appliquer risquerait de colorer les mauvaises lettres.
- Tables `tajweed_sessions` (essais, erreurs en jsonb) et `user_settings`, RLS par
  utilisateur. L'audio n'est jamais stocké : la réécoute se fait en mémoire sur le téléphone.

## Logo et icônes

`python3 scripts/logo.py logo > public/logo.svg` (variantes `square`, `maskable` dans
`scripts/`), puis `npm run icons` (Playwright) pour régénérer les PNG.
