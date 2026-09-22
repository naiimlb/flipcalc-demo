/* =====================================================================
   faux-client.ts — Un client Supabase factice, pour les tests UNIQUEMENT.
   ---------------------------------------------------------------------
   Ce module n'est jamais importé par l'application : il n'existe que
   pour `compte.test.ts`. Il n'appelle aucun réseau et ne dépend
   d'aucun paquet — c'est un magasin en mémoire qui imite le sous-
   ensemble de l'API `@supabase/supabase-js` réellement utilisé par
   `compte.ts` (`from().select().eq().maybeSingle()`, `upsert`,
   `insert`, `delete().match()`, `rpc()`, et les méthodes `auth.*`).

   Le point important : il applique la MÊME RÈGLE que la Row Level
   Security du vrai schéma SQL — une ligne n'est visible ou modifiable
   que par son propriétaire, tel que déterminé par la session en cours,
   jamais par l'identifiant qu'un appelant prétend lui donner. C'est ce
   qui permet de vérifier « un compte ne voit jamais les données d'un
   autre » au niveau du code, sans base Postgres réelle.

   Ce que ce test NE remplace PAS : l'exécution réelle de `schema.sql`
   sur un projet Supabase, et la configuration de ses policies. Voir le
   commentaire en tête de `compte.test.ts`.
   ===================================================================== */

interface LigneProfilFactice {
  id: string;
  pseudo: string;
  annee_naissance: number | null;
  genre_personne: string | null;
  pays: string;
  plateformes: string[];
  types_souhaites: string[];
  genres_adores: string[];
  genres_detestes: string[];
  tonalite_preferee: string;
  duree_max: number | null;
  langue_preferee: string;
  epoque_preferee: string;
  animation_ok: boolean;
  a_eviter: string[];
  interets: string[];
  gouts: unknown;
  plateformes_ok: boolean;
  test_termine: boolean;
}

interface Session {
  id: string;
  email: string;
}

interface UtilisateurFactice {
  id: string;
  email: string;
  motDePasse: string;
  /** `false` tant que l'e-mail n'a pas été « confirmé » via le lien envoyé. */
  confirme: boolean;
}

interface ErreurFactice {
  message: string;
}

/** Un objet `{ data, error }`, comme en renvoie chaque appel Supabase. */
interface Reponse<T> {
  data: T;
  error: ErreurFactice | null;
}

function ligneProfilVide(id: string): LigneProfilFactice {
  return {
    id,
    pseudo: '',
    annee_naissance: null,
    genre_personne: null,
    pays: 'FR',
    plateformes: [],
    types_souhaites: ['film', 'serie'],
    genres_adores: [],
    genres_detestes: [],
    tonalite_preferee: 'intense',
    duree_max: null,
    langue_preferee: 'indifferent',
    epoque_preferee: 'indifferent',
    animation_ok: true,
    a_eviter: [],
    interets: [],
    gouts: {},
    plateformes_ok: false,
    test_termine: false,
  };
}

/** Un enregistrement quelconque, pour les tables où la forme varie peu. */
type Ligne = Record<string, unknown>;

class ConstructeurRequete {
  private readonly table: string;
  private readonly magasin: FauxSupabase;
  private filtres: Array<[string, unknown]> = [];
  private operation: 'select' | 'upsert' | 'insert' | 'delete' | null = null;
  private charge: Ligne | null = null;
  private unique = false;

  constructor(table: string, magasin: FauxSupabase) {
    this.table = table;
    this.magasin = magasin;
  }

  select(_colonnes: string): this {
    this.operation ??= 'select';
    return this;
  }

  eq(colonne: string, valeur: unknown): this {
    this.filtres.push([colonne, valeur]);
    return this;
  }

  match(objet: Record<string, unknown>): this {
    this.filtres.push(...Object.entries(objet));
    return this;
  }

  maybeSingle(): this {
    this.unique = true;
    return this;
  }

  upsert(charge: Ligne): this {
    this.operation = 'upsert';
    this.charge = charge;
    return this;
  }

  insert(charge: Ligne): this {
    this.operation = 'insert';
    this.charge = charge;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  /** Rend l'objet « attendable » : `await constructeur` fonctionne. */
  then<T1 = Reponse<unknown>, T2 = never>(
    resoudre: (valeur: Reponse<unknown>) => T1,
    rejeter?: (raison: unknown) => T2,
  ): Promise<T1 | T2> {
    try {
      return Promise.resolve(resoudre(this.executer()));
    } catch (erreur) {
      return rejeter ? Promise.resolve(rejeter(erreur)) : Promise.reject(erreur);
    }
  }

  private valeurFiltre(colonne: string): unknown {
    return this.filtres.find(([c]) => c === colonne)?.[1];
  }

  /** Simule la RLS : visible/modifiable seulement par son propriétaire connecté. */
  private appartientALaSession(idProprietaire: string): boolean {
    const session = this.magasin.sessionCourante();
    return session !== null && session.id === idProprietaire;
  }

  private executer(): Reponse<unknown> {
    if (this.operation === 'select') return this.executerSelect();
    if (this.operation === 'upsert') return this.executerUpsert();
    if (this.operation === 'insert') return this.executerInsert();
    if (this.operation === 'delete') return this.executerDelete();
    throw new Error(`Opération non simulée sur « ${this.table} ».`);
  }

  private executerSelect(): Reponse<unknown> {
    if (this.table === 'profils') {
      const id = this.valeurFiltre('id') as string;
      const ligne = this.magasin.profils.get(id);
      const visible = ligne && this.appartientALaSession(ligne.id) ? ligne : null;
      return { data: this.unique ? (visible ?? null) : visible ? [visible] : [], error: null };
    }

    const table = this.magasin.tablePersonnelle(this.table);
    const utilisateurId = this.valeurFiltre('utilisateur_id') as string;
    const lignes = [...table.values()].filter(
      (l) => l.utilisateur_id === utilisateurId && this.appartientALaSession(l.utilisateur_id as string),
    );
    return { data: this.unique ? (lignes[0] ?? null) : lignes, error: null };
  }

  private executerUpsert(): Reponse<unknown> {
    const charge = this.charge!;
    if (this.table === 'profils') {
      const id = charge.id as string;
      if (!this.appartientALaSession(id)) return { data: null, error: { message: 'RLS : accès refusé' } };
      this.magasin.profils.set(id, { ...(this.magasin.profils.get(id) ?? ligneProfilVide(id)), ...charge });
      return { data: null, error: null };
    }

    const utilisateurId = charge.utilisateur_id as string;
    if (!this.appartientALaSession(utilisateurId)) return { data: null, error: { message: 'RLS : accès refusé' } };
    const table = this.magasin.tablePersonnelle(this.table);
    const cle = `${utilisateurId}:${charge.titre_id}`;
    table.set(cle, { ...table.get(cle), cree_le: table.get(cle)?.cree_le ?? new Date().toISOString(), ...charge });
    return { data: null, error: null };
  }

  private executerInsert(): Reponse<unknown> {
    const charge = this.charge!;
    const utilisateurId = charge.utilisateur_id as string;
    if (!this.appartientALaSession(utilisateurId)) return { data: null, error: { message: 'RLS : accès refusé' } };
    this.magasin.tableJournal(this.table).push({ cree_le: new Date().toISOString(), ...charge });
    return { data: null, error: null };
  }

  private executerDelete(): Reponse<unknown> {
    const utilisateurId = this.valeurFiltre('utilisateur_id') as string;
    const titreId = this.valeurFiltre('titre_id') as string;
    if (!this.appartientALaSession(utilisateurId)) return { data: null, error: { message: 'RLS : accès refusé' } };
    this.magasin.tablePersonnelle(this.table).delete(`${utilisateurId}:${titreId}`);
    return { data: null, error: null };
  }
}

/**
 * Le client factice. `_debug` expose l'intérieur du magasin pour les
 * assertions de test — jamais utilisé par `compte.ts`, qui ne connaît
 * que l'API publique (`from`, `auth`, `rpc`).
 */
export class FauxSupabase {
  readonly profils = new Map<string, LigneProfilFactice>();
  private readonly utilisateursParEmail = new Map<string, UtilisateurFactice>();
  private session: Session | null = null;
  private compteur = 0;
  private dernierEmailDeReinitialisation: string | null = null;

  private readonly tablesPersonnelles: Record<string, Map<string, Ligne>> = {
    liste: new Map(),
    refus: new Map(),
    expositions: new Map(),
  };
  private readonly tablesJournal: Record<string, Ligne[]> = {
    interactions: [],
    humeurs_choisies: [],
  };

  private readonly confirmationEmailRequise: boolean;

  constructor(confirmationEmailRequise = false) {
    this.confirmationEmailRequise = confirmationEmailRequise;
  }

  tablePersonnelle(nom: string): Map<string, Ligne> {
    const table = this.tablesPersonnelles[nom];
    if (!table) throw new Error(`Table personnelle inconnue : ${nom}`);
    return table;
  }

  tableJournal(nom: string): Ligne[] {
    const table = this.tablesJournal[nom];
    if (!table) throw new Error(`Table journal inconnue : ${nom}`);
    return table;
  }

  sessionCourante(): Session | null {
    return this.session;
  }

  from(table: string): ConstructeurRequete {
    return new ConstructeurRequete(table, this);
  }

  readonly auth = {
    signUp: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
      options?: { emailRedirectTo?: string };
    }): Promise<Reponse<{ user: Session | null; session: { user: Session } | null }>> => {
      if (this.utilisateursParEmail.has(email)) {
        return { data: { user: null, session: null }, error: { message: 'User already registered' } };
      }
      this.compteur += 1;
      const id = `u-${this.compteur}`;
      const confirme = !this.confirmationEmailRequise;
      this.utilisateursParEmail.set(email, { id, email, motDePasse: password, confirme });
      // Simule le déclencheur SQL `au_nouvel_utilisateur`.
      this.profils.set(id, ligneProfilVide(id));

      if (!confirme) return { data: { user: { id, email }, session: null }, error: null };
      this.session = { id, email };
      return { data: { user: { id, email }, session: { user: { id, email } } }, error: null };
    },

    signInWithPassword: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }): Promise<Reponse<{ user: Session | null; session: { user: Session } | null }>> => {
      const u = this.utilisateursParEmail.get(email);
      if (!u || u.motDePasse !== password) {
        return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
      }
      if (!u.confirme) {
        return { data: { user: null, session: null }, error: { message: 'Email not confirmed' } };
      }
      this.session = { id: u.id, email: u.email };
      return { data: { user: this.session, session: { user: this.session } }, error: null };
    },

    signOut: async (): Promise<{ error: null }> => {
      this.session = null;
      return { error: null };
    },

    getUser: async (): Promise<Reponse<{ user: Session | null }>> => ({ data: { user: this.session }, error: null }),

    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),

    updateUser: async (champs: { email?: string; password?: string }): Promise<Reponse<{ user: Session | null }>> => {
      if (!this.session) return { data: { user: null }, error: { message: 'Aucun utilisateur connecté' } };
      const u = this.utilisateursParEmail.get(this.session.email);
      if (!u) return { data: { user: null }, error: { message: 'Aucun utilisateur connecté' } };
      if (champs.password) u.motDePasse = champs.password;
      if (champs.email && champs.email !== u.email) {
        this.utilisateursParEmail.delete(u.email);
        u.email = champs.email;
        this.utilisateursParEmail.set(champs.email, u);
        this.session = { id: u.id, email: u.email };
      }
      return { data: { user: this.session }, error: null };
    },

    resetPasswordForEmail: async (email: string): Promise<Reponse<Record<string, never>>> => {
      // Comme le vrai Supabase : la réponse ne doit JAMAIS révéler si le
      // compte existe. On n'envoie (et ne journalise) réellement le lien
      // que si le compte existe, mais la réponse au client est identique
      // dans les deux cas.
      if (this.utilisateursParEmail.has(email)) this.dernierEmailDeReinitialisation = email;
      return { data: {}, error: null };
    },
  };

  async rpc(nom: string, arguments_?: Record<string, unknown>): Promise<Reponse<null>> {
    if (nom === 'enregistrer_expositions') {
      if (!this.session) return { data: null, error: { message: 'Aucun utilisateur connecté' } };
      const table = this.tablesPersonnelles.expositions;
      for (const titreId of (arguments_?.p_titre_ids as string[]) ?? []) {
        const cle = `${this.session.id}:${titreId}`;
        const existant = table.get(cle);
        table.set(cle, {
          utilisateur_id: this.session.id,
          titre_id: titreId,
          nb: ((existant?.nb as number) ?? 0) + 1,
          derniere: new Date().toISOString(),
        });
      }
      return { data: null, error: null };
    }

    if (nom === 'supprimer_mon_compte') {
      if (!this.session) return { data: null, error: { message: 'Aucun utilisateur connecté' } };
      const id = this.session.id;
      this.profils.delete(id);
      for (const table of Object.values(this.tablesPersonnelles)) {
        for (const [cle, ligne] of table) if (ligne.utilisateur_id === id) table.delete(cle);
      }
      for (const nomTable of Object.keys(this.tablesJournal)) {
        this.tablesJournal[nomTable] = this.tablesJournal[nomTable].filter((l) => l.utilisateur_id !== id);
      }
      for (const [email, u] of this.utilisateursParEmail) if (u.id === id) this.utilisateursParEmail.delete(email);
      this.session = null;
      return { data: null, error: null };
    }

    throw new Error(`RPC non simulée : ${nom}`);
  }

  /** Réservé aux tests : simule le clic sur le lien de confirmation reçu par e-mail. */
  confirmerEmail(email: string): void {
    const u = this.utilisateursParEmail.get(email);
    if (u) u.confirme = true;
  }

  /** Réservé aux tests : dernière adresse ayant reçu un lien de réinitialisation. */
  dernierEmailReinitialise(): string | null {
    return this.dernierEmailDeReinitialisation;
  }

  /** Réservé aux tests : accès direct aux tables, sans passer par la RLS. */
  inspecter(nomTable: string): Ligne[] {
    if (nomTable in this.tablesPersonnelles) return [...this.tablesPersonnelles[nomTable].values()];
    if (nomTable in this.tablesJournal) return this.tablesJournal[nomTable];
    // `LigneProfilFactice` n'a pas de signature d'index (c'est une forme
    // fixe et documentée) : le transtypage est sûr, il ne fait que
    // relâcher cette contrainte purement statique pour un usage de debug.
    if (nomTable === 'profils') return [...this.profils.values()] as unknown as Ligne[];
    throw new Error(`Table inconnue : ${nomTable}`);
  }
}

/** Fabrique un client factice tout neuf, aucun compte enregistré. */
export function creerFauxClient(options: { confirmationEmailRequise?: boolean } = {}): FauxSupabase {
  return new FauxSupabase(options.confirmationEmailRequise ?? false);
}
