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

`npm run typecheck` · `npm run lint` · `npm test` (Vitest, dont 1 600 extraits bruités) · `npm run build`

## Tests de bout en bout

`e2e/` (Playwright, WebKit iPhone + Chromium avec micro simulé) tourne sur GitHub Actions
contre la production (`.github/workflows/gratcoran-e2e.yml`). Le workflow génère un mot de
passe aléatoire qui ne quitte jamais le runner, publie seulement son empreinte bcrypt sur la
branche `claude/grat-coran-e2e`, puis attend (15 min max) que le compte de test soit créé en
base. Captures publiées sur la branche `claude/grat-coran-screens`.

## Base de données

Migrations SQL dans `supabase/migrations/` : table `recognitions` (historique, RLS par
utilisateur) et fonction `consume_recognize_quota` (6 requêtes/minute, 150/jour).
L'audio n'est jamais stocké.

## Matching

Texte normalisé (sans voyelles, lettres unifiées, alifs et espaces retirés), index de
trigrammes sur des fenêtres de 1 à 3 versets consécutifs, score
`0,7 × couverture de la requête + 0,3 × Dice`. La confiance (haute / moyenne / faible)
dépend du score et de l'écart avec la meilleure autre sourate.

## Logo et icônes

`python3 scripts/logo.py logo > public/logo.svg` (variantes `square`, `maskable` dans
`scripts/`), puis `npm run icons` (Playwright) pour régénérer les PNG.
