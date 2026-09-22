/* =====================================================================
   verifier-rls.mjs — Prouve que les règles de sécurité fonctionnent.
   ---------------------------------------------------------------------
   Les tests de `src/lib/cloud/` vérifient la logique de l'application
   face à un client Supabase factice. Ils ne prouvent PAS que les
   politiques Row Level Security de `supabase/schema.sql` sont correctes :
   c'est du SQL, il faut un vrai PostgreSQL pour le vérifier.

   Ce script comble ce trou. Il démarre une base jetable, y reproduit le
   strict minimum que Supabase fournit d'office (schéma `auth`, fonction
   `auth.uid()`, rôle `authenticated`), applique `schema.sql` SANS LE
   MODIFIER, puis déroule le parcours complet : inscription, ajout d'un
   film, déconnexion, reconnexion, et tentative d'accès par un second
   compte.

   Prérequis : PostgreSQL installé localement (binaire `initdb`).
   Lancer :   npm run verifier:rls
   ===================================================================== */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const SUPABASE = join(ICI, '..', 'supabase');
const PORT = process.env.PORT_PG ?? '5455';

/** Retrouve les binaires PostgreSQL, y compris hors du PATH (Debian). */
function trouverBinaires() {
  const direct = spawnSync('which', ['initdb'], { encoding: 'utf8' });
  if (direct.status === 0) return dirname(direct.stdout.trim());

  for (const version of ['17', '16', '15', '14']) {
    const chemin = `/usr/lib/postgresql/${version}/bin`;
    if (existsSync(join(chemin, 'initdb'))) return chemin;
  }
  return null;
}

const bin = trouverBinaires();
if (!bin) {
  console.error(
    '\n  PostgreSQL est introuvable sur cette machine.\n' +
      '  Ce script a besoin d’une vraie base pour vérifier les politiques RLS.\n' +
      '  macOS :  brew install postgresql@16\n' +
      '  Debian : sudo apt install postgresql\n',
  );
  process.exit(1);
}

const base = mkdtempSync(join(tmpdir(), 'cinemood-rls-'));
const donnees = join(base, 'data');
const lancer = (commande, args) =>
  execFileSync(join(bin, commande), args, { encoding: 'utf8', stdio: 'pipe' });

let demarree = false;
try {
  console.log(`  Base jetable dans ${base}`);
  lancer('initdb', ['-D', donnees, '-U', 'postgres', '--auth=trust']);
  lancer('pg_ctl', ['-D', donnees, '-l', join(base, 'log'), '-o', `-p ${PORT} -k ${base}`, 'start']);
  demarree = true;

  const psql = (fichier) =>
    lancer('psql', ['-h', base, '-p', PORT, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', fichier]);

  psql(join(SUPABASE, 'shim-local.sql'));
  console.log('  ✓ environnement Supabase minimal en place');
  psql(join(SUPABASE, 'schema.sql'));
  console.log('  ✓ schema.sql appliqué sans erreur\n');

  // La vérification elle-même : sa sortie EST le rapport. On capture
  // aussi stderr, sans quoi une erreur SQL passerait inaperçue.
  const execution = spawnSync(
    join(bin, 'psql'),
    ['-h', base, '-p', PORT, '-U', 'postgres', '-f', join(SUPABASE, 'verifier-rls.sql')],
    { encoding: 'utf8' },
  );
  const rapport = `${execution.stdout ?? ''}${execution.stderr ?? ''}`;
  console.log(rapport);

  // Le verdict est rendu par le SQL lui-même, pas par une lecture de
  // tableaux à l'œil : une régression de sécurité fait sortir la commande
  // en erreur, donc casse la CI plutôt que de passer inaperçue.
  if (!/RESULTAT_GLOBAL=OK/.test(rapport)) {
    console.error('  ÉCHEC — la sécurité ou la persistance des données n’est pas garantie.\n');
    process.exitCode = 1;
  } else {
    console.log('  ✓ Isolation vérifiée : chaque compte ne voit et ne modifie que ses propres lignes.');
    console.log('  ✓ Persistance vérifiée : le film ajouté est retrouvé après déconnexion/reconnexion.\n');
  }
} finally {
  if (demarree) {
    try { lancer('pg_ctl', ['-D', donnees, '-m', 'immediate', 'stop']); } catch { /* déjà arrêtée */ }
  }
  rmSync(base, { recursive: true, force: true });
}
