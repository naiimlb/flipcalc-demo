/* =====================================================================
   catalogue-demo.ts — Catalogue local du MODE DÉMO.
   ---------------------------------------------------------------------
   Pourquoi ce fichier existe : l'app doit être utilisable et démontrable
   AVANT que TMDB et Supabase soient configurés. Dès que
   `TMDB_ACCESS_TOKEN` est renseigné, ce catalogue n'est plus utilisé :
   les titres viennent de TMDB (voir `src/lib/tmdb/`).

   ⚠️  Les disponibilités par plateforme ci-dessous sont ILLUSTRATIVES et
   figées dans le temps : elles servent à démontrer le filtrage strict.
   Les vraies disponibilités viennent de /watch/providers (région FR).

   Format d'une ligne — champs séparés par « | », listes par « ~ » :
     0  identifiant TMDB
     1  type : f = film, s = série
     2  titre français
     3  année de sortie
     4  durée en minutes (pour une série : durée moyenne d'un épisode)
     5  nombre de saisons (vide pour un film)
     6  genres
     7  mots-clés
     8  réalisateur(s) / créateur(s)
     9  têtes d'affiche
    10  pays d'origine
    11  langue originale
    12  note sur 10
    13  nombre de votes
    14  popularité (0-100)
    15  classification : TP, 10, 12, 16, 18
    16  plateformes (identifiants de `src/lib/reco/plateformes.ts`)
    17  tonalités : leger, intense, emouvant, reflechi, flippant
    18  rythme : l = lent, m = modéré, r = rapide
    19  animation : 0 ou 1
    20  synopsis court
   ===================================================================== */

import type { Classification, Rythme, Titre, Tonalite, TypeContenu } from '@/lib/reco/types';

const RYTHMES: Record<string, Rythme> = { l: 'lent', m: 'modere', r: 'rapide' };

/** Transforme une ligne du tableau brut en `Titre` normalisé. */
function parserLigne(ligne: string): Titre {
  const c = ligne.split('|');
  const liste = (s: string): string[] => (s ? s.split('~').filter(Boolean) : []);
  const type: TypeContenu = c[1] === 's' ? 'serie' : 'film';

  return {
    id: `${type}:${c[0]}`,
    tmdbId: Number(c[0]),
    type,
    titre: c[2],
    annee: Number(c[3]),
    duree: c[4] ? Number(c[4]) : null,
    saisons: c[5] ? Number(c[5]) : null,
    genres: liste(c[6]),
    motsCles: liste(c[7]),
    realisateurs: liste(c[8]),
    acteurs: liste(c[9]),
    pays: liste(c[10]),
    langueOriginale: c[11],
    note: Number(c[12]),
    nbVotes: Number(c[13]),
    popularite: Number(c[14]),
    classification: c[15] as Classification,
    plateformes: liste(c[16]),
    tonalites: liste(c[17]) as Tonalite[],
    rythme: RYTHMES[c[18]] ?? 'modere',
    animation: c[19] === '1',
    synopsis: c[20] ?? '',
    affiche: null,
    bandeAnnonce: null,
  };
}

/* ---------------------------------------------------------------------
   Le catalogue, classé par décennie.
   --------------------------------------------------------------------- */
const LIGNES: string[] = [
  // ----- Années 1970-1980 ---------------------------------------------
  '238|f|Le Parrain|1972|175||Drame~Crime|mafia~famille~pouvoir~new york|Francis Ford Coppola|Marlon Brando~Al Pacino|US|en|8.7|20500|38|16|canal~prime|intense~reflechi|l|0|La chronique d’une famille de la mafia new-yorkaise et de sa succession.',
  '578|f|Les Dents de la mer|1975|124||Thriller~Aventure|requin~océan~station balnéaire|Steven Spielberg|Roy Scheider~Richard Dreyfuss|US|en|7.7|10200|30|12|prime~universcine|flippant~intense|m|0|Un requin blanc terrorise une petite station balnéaire américaine.',
  '11|f|Star Wars : Un nouvel espoir|1977|121||Science-Fiction~Aventure|espace~rébellion~épopée|George Lucas|Mark Hamill~Harrison Ford|US|en|8.2|20000|44|10|disney|leger~intense|r|0|Un fermier de Tatooine rejoint la rébellion contre l’Empire galactique.',
  '348|f|Alien, le huitième passager|1979|117||Horreur~Science-Fiction|espace~créature~huis clos|Ridley Scott|Sigourney Weaver~Tom Skerritt|GB~US|en|8.2|14800|36|16|disney~canal|flippant~intense|l|0|L’équipage d’un cargo spatial ramène à bord une créature parfaite.',
  '694|f|Shining|1980|144||Horreur~Thriller|hôtel~folie~hiver|Stanley Kubrick|Jack Nicholson~Shelley Duvall|GB~US|en|8.2|17000|33|16|max~canal|flippant~reflechi|l|0|Un écrivain s’installe avec sa famille dans un hôtel isolé pour l’hiver.',
  '85|f|Les Aventuriers de l’arche perdue|1981|115||Aventure~Action|archéologie~nazis~relique|Steven Spielberg|Harrison Ford~Karen Allen|US|en|7.9|11500|31|10|disney~prime|leger~intense|r|0|Indiana Jones part à la recherche de l’arche d’alliance avant les nazis.',
  '78|f|Blade Runner|1982|117||Science-Fiction~Thriller|dystopie~androïdes~pluie|Ridley Scott|Harrison Ford~Rutger Hauer|US|en|7.9|14300|29|12|max~prime|reflechi~intense|l|0|Un chasseur de répliquants traque des androïdes dans un Los Angeles noyé de néons.',
  '601|f|E.T. l’extra-terrestre|1982|115||Science-Fiction~Familial|amitié~enfance~extraterrestre|Steven Spielberg|Henry Thomas~Drew Barrymore|US|en|7.6|11800|27|TP|prime~canal|emouvant~leger|m|0|Un enfant cache chez lui un extraterrestre échoué sur Terre.',
  '105|f|Retour vers le futur|1985|116||Science-Fiction~Aventure~Comédie|voyage dans le temps~années 50~amitié|Robert Zemeckis|Michael J. Fox~Christopher Lloyd|US|en|8.3|20100|40|TP|prime~netflix|leger~intense|r|0|Un adolescent est projeté en 1955 par la DeLorean de son ami inventeur.',
  '8688|f|Le Nom de la rose|1986|131||Mystère~Drame~Histoire|abbaye~enquête~moyen âge|Jean-Jacques Annaud|Sean Connery~Christian Slater|FR~IT~DE|en|7.7|3200|16|12|canal~arte|reflechi~flippant|l|0|Un moine franciscain enquête sur des morts mystérieuses dans une abbaye italienne.',
  '380|f|Rain Man|1988|133||Drame|autisme~fratrie~road movie|Barry Levinson|Dustin Hoffman~Tom Cruise|US|en|8.0|8200|18|10|prime~canal|emouvant~reflechi|l|0|Un homme d’affaires découvre l’existence de son frère autiste.',
  '8358|f|Le Grand Bleu|1988|168||Drame~Aventure|plongée~mer~amitié|Luc Besson|Jean-Marc Barr~Jean Reno|FR|fr|7.4|2600|15|TP|canal~francetv|emouvant~reflechi|l|0|Deux amis d’enfance se retrouvent dans la compétition de plongée en apnée.',
  '8392|f|Mon voisin Totoro|1988|86||Animation~Familial~Fantastique|nature~enfance~esprits|Hayao Miyazaki|Noriko Hidaka~Chika Sakamoto|JP|ja|8.1|8900|32|TP|netflix|leger~emouvant|l|1|Deux sœurs emménagent à la campagne et rencontrent les esprits de la forêt.',

  // ----- Années 1990 ---------------------------------------------------
  '274|f|Le Silence des agneaux|1991|119||Thriller~Crime~Horreur|tueur en série~profilage~FBI|Jonathan Demme|Jodie Foster~Anthony Hopkins|US|en|8.3|15800|31|16|max~prime|flippant~intense|m|0|Une jeune recrue du FBI consulte un tueur cannibale pour en arrêter un autre.',
  '280|f|Terminator 2 : Le Jugement dernier|1991|137||Action~Science-Fiction|robots~futur~poursuite|James Cameron|Arnold Schwarzenegger~Linda Hamilton|US|en|8.1|12400|29|12|prime~canal|intense|r|0|Un cyborg revient protéger l’enfant qui sauvera l’humanité.',
  '329|f|Jurassic Park|1993|127||Aventure~Science-Fiction|dinosaures~parc~science|Steven Spielberg|Sam Neill~Jeff Goldblum|US|en|8.0|15600|40|10|netflix~prime|intense~leger|r|0|Un parc d’attractions peuplé de dinosaures cloné échappe à tout contrôle.',
  '424|f|La Liste de Schindler|1993|195||Drame~Histoire~Guerre|shoah~seconde guerre mondiale~sauvetage|Steven Spielberg|Liam Neeson~Ben Kingsley|US|en|8.6|15900|22|16|netflix~prime|emouvant~reflechi|l|0|Un industriel allemand sauve un millier de Juifs pendant la Shoah.',
  '10665|f|Les Visiteurs|1993|107||Comédie~Fantastique|voyage dans le temps~moyen âge~quiproquo|Jean-Marie Poiré|Christian Clavier~Jean Reno|FR|fr|7.0|2400|20|TP|canal~m6plus|leger|r|0|Un chevalier et son écuyer sont projetés dans la France des années 90.',
  '680|f|Pulp Fiction|1994|154||Crime~Drame|récits croisés~gangsters~dialogues|Quentin Tarantino|John Travolta~Samuel L. Jackson|US|en|8.5|27000|45|16|netflix~max|intense~leger|m|0|Des histoires de truands de Los Angeles s’entrecroisent dans le désordre.',
  '13|f|Forrest Gump|1994|142||Drame~Romance~Comédie|destin~amérique~amour|Robert Zemeckis|Tom Hanks~Robin Wright|US|en|8.5|26800|43|10|netflix~paramount|emouvant~leger|m|0|La vie d’un homme au grand cœur traverse trente ans d’histoire américaine.',
  '278|f|Les Évadés|1994|142||Drame~Crime|prison~amitié~espoir|Frank Darabont|Tim Robbins~Morgan Freeman|US|en|8.7|26500|41|12|netflix~max|emouvant~reflechi|l|0|Condamné à perpétuité, un banquier noue une amitié décisive derrière les barreaux.',
  '8587|f|Le Roi lion|1994|89||Animation~Familial~Drame|savane~deuil~transmission|Roger Allers~Rob Minkoff|Jonathan Taylor Thomas~Matthew Broderick|US|en|8.3|17400|46|TP|disney|emouvant~leger|m|1|Un lionceau doit reconquérir le royaume que son oncle lui a volé.',
  '862|f|Toy Story|1995|81||Animation~Familial~Aventure|jouets~amitié~rivalité|John Lasseter|Tom Hanks~Tim Allen|US|en|8.0|18200|38|TP|disney|leger~emouvant|r|1|Les jouets d’une chambre d’enfant prennent vie dès qu’on a le dos tourné.',
  '807|f|Seven|1995|127||Thriller~Crime~Mystère|tueur en série~pluie~péchés capitaux|David Fincher|Brad Pitt~Morgan Freeman|US|en|8.4|19600|34|16|max~netflix|flippant~intense|m|0|Deux inspecteurs traquent un meurtrier qui met en scène les sept péchés capitaux.',
  '949|f|Heat|1995|170||Crime~Thriller~Action|braquage~los angeles~duel|Michael Mann|Al Pacino~Robert De Niro|US|en|7.9|6900|20|16|prime~canal|intense|m|0|Un flic obsessionnel traque un braqueur méthodique dans Los Angeles.',
  '406|f|La Haine|1995|98||Drame~Crime|banlieue~jeunesse~police|Mathieu Kassovitz|Vincent Cassel~Hubert Koundé|FR|fr|8.0|2900|17|12|canal~arte|intense~reflechi|m|0|Vingt-quatre heures dans la vie de trois amis d’une cité française.',
  '128|f|Princesse Mononoké|1997|134||Animation~Aventure~Fantastique|nature~guerre~esprits|Hayao Miyazaki|Yoji Matsuda~Yuriko Ishida|JP|ja|8.3|7800|28|12|netflix|intense~reflechi|m|1|Un jeune prince se retrouve pris entre les dieux de la forêt et les hommes.',
  '597|f|Titanic|1997|194||Drame~Romance|naufrage~amour impossible~classes sociales|James Cameron|Leonardo DiCaprio~Kate Winslet|US|en|7.9|25000|42|10|disney~paramount|emouvant|l|0|Une idylle naît à bord du paquebot réputé insubmersible.',
  '18|f|Le Cinquième Élément|1997|126||Science-Fiction~Aventure~Action|futur~new york~humour|Luc Besson|Bruce Willis~Milla Jovovich|FR|en|7.5|10600|27|10|canal~prime|leger~intense|r|0|Un chauffeur de taxi du futur devient le garde du corps d’une créature parfaite.',
  '603|f|Matrix|1999|136||Science-Fiction~Action|réalité virtuelle~élu~philosophie|Lana Wachowski~Lilly Wachowski|Keanu Reeves~Laurence Fishburne|US|en|8.2|25400|47|16|max~netflix|intense~reflechi|r|0|Un informaticien découvre que le monde n’est qu’une simulation.',
  '550|f|Fight Club|1999|139||Drame~Thriller|identité~consumérisme~violence|David Fincher|Brad Pitt~Edward Norton|US|en|8.4|29400|44|16|disney~prime|intense~reflechi|m|0|Un employé insomniaque fonde un club de combat clandestin.',
  '745|f|Sixième Sens|1999|107||Thriller~Mystère~Drame|fantômes~enfant~révélation|M. Night Shyamalan|Bruce Willis~Haley Joel Osment|US|en|8.0|10400|24|12|disney~canal|flippant~emouvant|l|0|Un psychologue tente d’aider un enfant qui voit les morts.',

  // ----- Années 2000 ---------------------------------------------------
  '77|f|Memento|2000|113||Thriller~Mystère|amnésie~vengeance~récit inversé|Christopher Nolan|Guy Pearce~Carrie-Anne Moss|US|en|8.2|13200|24|12|prime~canal|reflechi~intense|m|0|Un homme incapable de fixer de nouveaux souvenirs traque l’assassin de sa femme.',
  '98|f|Gladiator|2000|155||Action~Drame~Aventure|rome antique~vengeance~arène|Ridley Scott|Russell Crowe~Joaquin Phoenix|US~GB|en|8.2|18200|33|12|paramount~prime|intense~emouvant|m|0|Un général romain trahi devient gladiateur pour se venger de l’empereur.',
  '194|f|Le Fabuleux Destin d’Amélie Poulain|2001|122||Comédie~Romance|paris~montmartre~bonheur|Jean-Pierre Jeunet|Audrey Tautou~Mathieu Kassovitz|FR|fr|7.9|10100|26|TP|netflix~canal|leger~emouvant|m|0|Une serveuse de Montmartre décide de changer discrètement la vie des autres.',
  '120|f|Le Seigneur des anneaux : La Communauté de l’anneau|2001|178||Fantastique~Aventure|quête~terre du milieu~amitié|Peter Jackson|Elijah Wood~Ian McKellen|NZ~US|en|8.4|23800|43|10|max~prime|intense~emouvant|m|0|Un hobbit part détruire un anneau qui menace la Terre du Milieu.',
  '129|f|Le Voyage de Chihiro|2001|125||Animation~Fantastique~Familial|monde des esprits~courage~passage|Hayao Miyazaki|Rumi Hiiragi~Miyu Irino|JP|ja|8.5|16200|41|TP|netflix|emouvant~reflechi|m|1|Une fillette doit travailler dans les bains des esprits pour sauver ses parents.',
  '671|f|Harry Potter à l’école des sorciers|2001|152||Fantastique~Aventure~Familial|magie~école~amitié|Chris Columbus|Daniel Radcliffe~Emma Watson|GB~US|en|7.9|27000|52|TP|max|leger~emouvant|m|0|Un orphelin découvre qu’il est un sorcier et entre à Poudlard.',
  '24|f|Kill Bill : Volume 1|2003|111||Action~Crime|vengeance~sabre~arts martiaux|Quentin Tarantino|Uma Thurman~Lucy Liu|US|en|7.9|16400|28|16|netflix~prime|intense|r|0|Une ancienne tueuse à gages se venge de ceux qui l’ont laissée pour morte.',
  '12|f|Le Monde de Nemo|2003|100||Animation~Familial~Aventure|océan~père et fils~voyage|Andrew Stanton|Albert Brooks~Ellen DeGeneres|US|en|7.8|19000|37|TP|disney|leger~emouvant|m|1|Un poisson-clown traverse l’océan pour retrouver son fils.',
  '670|f|Old Boy|2003|120||Thriller~Mystère~Action|enfermement~vengeance~secret|Park Chan-wook|Choi Min-sik~Yoo Ji-tae|KR|ko|8.3|7300|21|18|prime~universcine|intense~flippant|m|0|Un homme séquestré quinze ans sans explication cherche son geôlier.',
  '38|f|Eternal Sunshine of the Spotless Mind|2004|108||Romance~Drame~Science-Fiction|mémoire~rupture~amour|Michel Gondry|Jim Carrey~Kate Winslet|US|en|8.1|13500|26|10|prime~canal|emouvant~reflechi|m|0|Un homme fait effacer le souvenir de son amour perdu, et le regrette.',
  '9806|f|Les Indestructibles|2004|115||Animation~Action~Familial|super-héros~famille~secret|Brad Bird|Craig T. Nelson~Holly Hunter|US|en|7.7|14700|31|TP|disney|leger~intense|r|1|Une famille de super-héros à la retraite reprend du service.',
  '9479|f|Les Choristes|2004|97||Drame~Musique|internat~chorale~transmission|Christophe Barratier|Gérard Jugnot~François Berléand|FR|fr|7.5|2100|14|TP|canal~francetv|emouvant|l|0|Un surveillant crée une chorale dans un internat pour enfants difficiles.',
  '272|f|Batman Begins|2005|140||Action~Crime~Thriller|origines~peur~gotham|Christopher Nolan|Christian Bale~Michael Caine|US~GB|en|7.7|19800|30|12|max|intense|m|0|Bruce Wayne revient à Gotham et devient Batman.',
  '1417|f|Le Labyrinthe de Pan|2006|118||Fantastique~Drame~Guerre|conte~franquisme~enfance|Guillermo del Toro|Ivana Baquero~Sergi López|ES~MX|es|7.7|6300|18|12|canal~universcine|flippant~emouvant|l|0|En 1944, une fillette s’invente un monde féerique face à la brutalité franquiste.',
  '1422|f|Les Infiltrés|2006|151||Crime~Thriller~Drame|taupe~mafia~boston|Martin Scorsese|Leonardo DiCaprio~Matt Damon|US|en|8.2|13900|24|16|max~prime|intense|m|0|Un flic infiltre la mafia pendant qu’un mafieux infiltre la police.',
  '2062|f|Ratatouille|2007|111||Animation~Familial~Comédie|cuisine~paris~ambition|Brad Bird|Patton Oswalt~Lou Romano|US|en|7.8|17600|36|TP|disney|leger~emouvant|m|1|Un rat doué pour la cuisine s’associe à un jeune commis parisien.',
  '6977|f|No Country for Old Men|2007|122||Thriller~Crime~Drame|traque~désert~fatalité|Joel Coen~Ethan Coen|Javier Bardem~Josh Brolin|US|en|8.0|11400|20|16|paramount~prime|intense~reflechi|l|0|Un chasseur trouve une mallette d’argent et déclenche une traque implacable.',
  '155|f|The Dark Knight : Le Chevalier noir|2008|152||Action~Crime~Drame|chaos~joker~gotham|Christopher Nolan|Christian Bale~Heath Ledger|US~GB|en|8.5|32000|50|12|max~netflix|intense~reflechi|r|0|Batman affronte un criminel qui ne veut ni argent ni pouvoir, seulement le chaos.',
  '10681|f|WALL-E|2008|98||Animation~Familial~Science-Fiction|robot~écologie~amour|Andrew Stanton|Ben Burtt~Elissa Knight|US|en|8.1|18100|35|TP|disney|emouvant~reflechi|m|1|Un robot nettoyeur resté seul sur Terre tombe amoureux d’une sonde.',
  '13446|f|Bienvenue chez les Ch’tis|2008|106||Comédie|nord~préjugés~amitié|Dany Boon|Kad Merad~Dany Boon|FR|fr|6.6|2000|12|TP|canal~tf1plus|leger|m|0|Un directeur de poste provençal est muté dans le Nord malgré lui.',
  '13223|f|Gran Torino|2008|116||Drame~Crime|voisinage~racisme~rédemption|Clint Eastwood|Clint Eastwood~Bee Vang|US|en|8.1|9200|19|12|max~prime|emouvant~reflechi|l|0|Un vétéran bougon se lie avec la famille asiatique installée à côté de chez lui.',
  '17654|f|District 9|2009|112||Science-Fiction~Action~Thriller|extraterrestres~apartheid~documentaire|Neill Blomkamp|Sharlto Copley~David James|ZA~US|en|7.4|7900|18|16|netflix~prime|intense~reflechi|r|0|Des extraterrestres parqués à Johannesburg sont déplacés de force.',
  '14160|f|Là-haut|2009|96||Animation~Familial~Aventure|deuil~voyage~vieillesse|Pete Docter|Edward Asner~Jordan Nagai|US|en|7.9|19300|34|TP|disney|emouvant~leger|m|1|Un veuf s’envole vers l’Amérique du Sud avec sa maison accrochée à des ballons.',

  // ----- Années 2010 ---------------------------------------------------
  '27205|f|Inception|2010|148||Science-Fiction~Action~Thriller|rêve~mémoire~labyrinthe|Christopher Nolan|Leonardo DiCaprio~Marion Cotillard|US~GB|en|8.4|36000|55|12|max~netflix|intense~reflechi|r|0|Une équipe s’infiltre dans les rêves pour y implanter une idée.',
  '77338|f|Intouchables|2011|112||Comédie~Drame|handicap~amitié~classes sociales|Olivier Nakache~Éric Toledano|François Cluzet~Omar Sy|FR|fr|8.3|17200|30|TP|netflix~canal|emouvant~leger|m|0|Un aristocrate tétraplégique engage un jeune de banlieue comme auxiliaire de vie.',
  '64690|f|Drive|2011|100||Thriller~Crime~Drame|los angeles~cascadeur~néon|Nicolas Winding Refn|Ryan Gosling~Carey Mulligan|US|en|7.6|11400|22|16|prime~canal|intense~reflechi|l|0|Un cascadeur silencieux sert de chauffeur pour des braquages nocturnes.',
  '74643|f|The Artist|2011|100||Drame~Romance~Comédie|cinéma muet~hollywood~déclin|Michel Hazanavicius|Jean Dujardin~Bérénice Bejo|FR|en|7.3|2500|11|TP|canal~arte|emouvant~leger|m|0|Une star du muet voit sa carrière s’effondrer avec l’arrivée du parlant.',
  '68718|f|Django Unchained|2012|165||Western~Drame|esclavage~vengeance~duo|Quentin Tarantino|Jamie Foxx~Christoph Waltz|US|en|8.2|26000|36|16|netflix~prime|intense~leger|m|0|Un esclave affranchi et un chasseur de primes partent libérer sa femme.',
  '49047|f|Gravity|2013|91||Science-Fiction~Thriller|espace~survie~solitude|Alfonso Cuarón|Sandra Bullock~George Clooney|US~GB|en|7.2|13800|22|10|max~prime|intense|r|0|Deux astronautes dérivent dans l’espace après la destruction de leur navette.',
  '152601|f|Her|2013|126||Romance~Drame~Science-Fiction|intelligence artificielle~solitude~amour|Spike Jonze|Joaquin Phoenix~Scarlett Johansson|US|en|7.9|14000|24|12|prime~canal|emouvant~reflechi|l|0|Un homme seul tombe amoureux du système d’exploitation de son téléphone.',
  '157336|f|Interstellar|2014|169||Science-Fiction~Drame~Aventure|espace~temps~père et fille|Christopher Nolan|Matthew McConaughey~Anne Hathaway|US~GB|en|8.5|35000|58|10|max~prime|intense~emouvant|m|0|Un pilote quitte sa fille pour chercher une planète habitable au-delà des étoiles.',
  '244786|f|Whiplash|2014|107||Drame~Musique|jazz~exigence~humiliation|Damien Chazelle|Miles Teller~J.K. Simmons|US|en|8.4|14900|27|12|netflix~canal|intense|r|0|Un batteur de jazz subit la méthode brutale d’un professeur obsessionnel.',
  '76341|f|Mad Max : Fury Road|2015|120||Action~Aventure~Science-Fiction|désert~poursuite~post-apocalyptique|George Miller|Tom Hardy~Charlize Theron|AU~US|en|7.6|21500|33|16|max~netflix|intense|r|0|Une course-poursuite sans répit à travers un désert post-apocalyptique.',
  '150540|f|Vice-versa|2015|95||Animation~Familial~Comédie|émotions~enfance~mémoire|Pete Docter|Amy Poehler~Phyllis Smith|US|en|7.9|19800|38|TP|disney|emouvant~leger|m|1|Les cinq émotions d’une fillette de onze ans prennent la parole.',
  '329865|f|Premier Contact|2016|116||Science-Fiction~Drame~Mystère|langage~extraterrestres~temps|Denis Villeneuve|Amy Adams~Jeremy Renner|US|en|7.6|18700|28|10|paramount~prime|reflechi~emouvant|l|0|Une linguiste tente de communiquer avec des visiteurs venus d’ailleurs.',
  '313369|f|La La Land|2016|128||Romance~Drame~Musique|los angeles~jazz~ambition|Damien Chazelle|Ryan Gosling~Emma Stone|US|en|7.9|17100|29|TP|prime~canal|emouvant~leger|m|0|Une actrice et un pianiste de jazz s’aiment sans renoncer à leurs rêves.',
  '335984|f|Blade Runner 2049|2017|164||Science-Fiction~Drame~Mystère|répliquants~mémoire~dystopie|Denis Villeneuve|Ryan Gosling~Harrison Ford|US~GB|en|7.6|14100|26|12|prime~canal|reflechi~intense|l|0|Un blade runner découvre un secret capable de faire basculer la société.',
  '419430|f|Get Out|2017|104||Horreur~Thriller~Mystère|racisme~famille~hypnose|Jordan Peele|Daniel Kaluuya~Allison Williams|US|en|7.6|13600|25|16|netflix~canal|flippant~reflechi|m|0|Un jeune homme noir rencontre la famille blanche de sa petite amie.',
  '354912|f|Coco|2017|105||Animation~Familial~Musique|mexique~mémoire~famille|Lee Unkrich|Anthony Gonzalez~Gael García Bernal|US|en|8.2|19400|39|TP|disney|emouvant~leger|m|1|Un enfant passionné de musique traverse le pays des morts le jour des morts.',
  '374720|f|Dunkerque|2017|107||Guerre~Drame~Action|évacuation~seconde guerre mondiale~tension|Christopher Nolan|Fionn Whitehead~Tom Hardy|GB~US|en|7.5|13200|22|12|max~prime|intense|r|0|Trois récits entrelacés de l’évacuation de Dunkerque en 1940.',
  '324857|f|Spider-Man : New Generation|2018|117||Animation~Action~Aventure|multivers~adolescence~héritage|Bob Persichetti~Peter Ramsey|Shameik Moore~Jake Johnson|US|en|8.4|14600|37|TP|netflix~paramount|leger~intense|r|1|Un adolescent de Brooklyn devient Spider-Man et rencontre ses alter ego.',
  '493922|f|Hérédité|2018|127||Horreur~Drame~Mystère|deuil~famille~occultisme|Ari Aster|Toni Collette~Alex Wolff|US|en|7.3|8700|22|16|prime~canal|flippant~emouvant|l|0|Après la mort de la grand-mère, une famille voit son quotidien se fissurer.',
  '426426|f|Roma|2018|135||Drame|mexico~domesticité~1970|Alfonso Cuarón|Yalitza Aparicio~Marina de Tavira|MX|es|7.4|4900|13|16|netflix|emouvant~reflechi|l|0|Une année dans la vie d’une employée de maison à Mexico, en 1971.',
  '455714|f|Le Grand Bain|2018|122||Comédie~Drame|natation synchronisée~dépression~équipe|Gilles Lellouche|Mathieu Amalric~Guillaume Canet|FR|fr|7.0|2200|12|10|canal~francetv|leger~emouvant|m|0|Des hommes en crise forment une équipe de natation synchronisée.',
  '496243|f|Parasite|2019|132||Thriller~Drame~Comédie|classes sociales~famille~maison|Bong Joon-ho|Song Kang-ho~Lee Sun-kyun|KR|ko|8.5|18400|38|16|prime~canal|intense~reflechi|m|0|Une famille pauvre s’infiltre chez des riches, jusqu’au basculement.',
  '475557|f|Joker|2019|122||Crime~Drame~Thriller|solitude~violence~gotham|Todd Phillips|Joaquin Phoenix~Robert De Niro|US|en|8.1|26000|41|16|max~netflix|intense~flippant|l|0|Un humoriste raté de Gotham glisse lentement vers la folie.',
  '531428|f|Portrait de la jeune fille en feu|2019|122||Romance~Drame~Histoire|peinture~bretagne~amour interdit|Céline Sciamma|Noémie Merlant~Adèle Haenel|FR|fr|8.1|2600|14|12|arte~canal|emouvant~reflechi|l|0|Une peintre est chargée du portrait d’une jeune femme promise au mariage.',
  '618344|f|Les Misérables|2019|104||Drame~Crime|banlieue~police~montfermeil|Ladj Ly|Damien Bonnard~Alexis Manenti|FR|fr|7.2|1900|12|12|canal~francetv|intense~reflechi|r|0|Une bavure filmée par un drone embrase une cité de Montfermeil.',

  // ----- Années 2020 ---------------------------------------------------
  '438631|f|Dune|2021|155||Science-Fiction~Aventure~Drame|désert~épice~destin|Denis Villeneuve|Timothée Chalamet~Rebecca Ferguson|US|en|7.8|12800|44|12|max~canal|intense~reflechi|l|0|L’héritier d’une grande maison est envoyé sur la planète la plus convoitée de l’univers.',
  '361743|f|Top Gun : Maverick|2022|130||Action~Drame|aviation~transmission~vitesse|Joseph Kosinski|Tom Cruise~Miles Teller|US|en|8.2|10400|35|10|paramount~prime|intense~emouvant|r|0|Un pilote légendaire forme une nouvelle génération pour une mission impossible.',
  '545611|f|Everything Everywhere All at Once|2022|139||Science-Fiction~Comédie~Aventure|multivers~famille~absurde|Daniel Kwan~Daniel Scheinert|Michelle Yeoh~Ke Huy Quan|US|en|7.8|7900|28|12|prime~canal|intense~emouvant|r|0|Une gérante de laverie découvre qu’elle peut vivre toutes ses vies parallèles.',
  '800158|f|Aftersun|2022|102||Drame|père et fille~vacances~mémoire|Charlotte Wells|Paul Mescal~Frankie Corio|GB~US|en|7.4|1500|11|10|max~universcine|emouvant~reflechi|l|0|Une femme revoit les images des vacances passées avec son père, vingt ans plus tôt.',
  '724495|f|Sans filtre|2022|147||Comédie~Drame|croisière~classes sociales~satire|Ruben Östlund|Harris Dickinson~Charlbi Dean|SE~DE|en|7.0|3400|13|16|canal~arte|reflechi~leger|m|0|Une croisière de luxe tourne au naufrage social et intime.',
  '872585|f|Oppenheimer|2023|181||Drame~Histoire~Thriller|bombe atomique~science~procès|Christopher Nolan|Cillian Murphy~Emily Blunt|US~GB|en|8.1|9800|48|12|prime~canal|intense~reflechi|m|0|Le physicien qui a conçu la bombe atomique face aux conséquences de son œuvre.',
  '346698|f|Barbie|2023|114||Comédie~Aventure~Fantastique|identité~satire~couleurs|Greta Gerwig|Margot Robbie~Ryan Gosling|US~GB|en|7.0|9200|42|10|max|leger~reflechi|m|0|Barbie quitte son monde parfait pour découvrir le monde réel.',
  '915935|f|Anatomie d’une chute|2023|151||Drame~Thriller~Mystère|procès~couple~vérité|Justine Triet|Sandra Hüller~Swann Arlaud|FR|fr|7.6|2400|18|12|canal~arte|reflechi~intense|l|0|Une romancière est jugée pour la mort de son mari, tombé de leur chalet.',
  '1035048|f|Le Règne animal|2023|128||Science-Fiction~Drame~Fantastique|mutation~père et fils~forêt|Thomas Cailley|Romain Duris~Paul Kircher|FR|fr|7.1|1200|14|12|canal~francetv|intense~emouvant|m|0|Dans un monde où des humains mutent en animaux, un père cherche sa femme.',
  '667538|f|Past Lives|2023|106||Romance~Drame|exil~amour manqué~destin|Celine Song|Greta Lee~Teo Yoo|US~KR|en|7.6|2100|15|10|prime~universcine|emouvant~reflechi|l|0|Deux amis d’enfance coréens se retrouvent à New York, vingt-quatre ans plus tard.',
  '508883|f|Le Garçon et le Héron|2023|124||Animation~Fantastique~Aventure|deuil~guerre~passage|Hayao Miyazaki|Soma Santoki~Masaki Suda|JP|ja|7.5|3100|24|10|netflix|reflechi~emouvant|l|1|Un garçon endeuillé suit un héron gris vers un monde parallèle.',
  '693134|f|Dune : Deuxième Partie|2024|167||Science-Fiction~Aventure~Drame|désert~prophétie~guerre|Denis Villeneuve|Timothée Chalamet~Zendaya|US|en|8.2|6900|60|12|max~canal|intense~reflechi|m|0|Paul Atréides rejoint les Fremen et embrasse son destin de chef de guerre.',
  '933260|f|The Substance|2024|141||Horreur~Science-Fiction~Drame|jeunesse~corps~célébrité|Coralie Fargeat|Demi Moore~Margaret Qualley|FR~GB~US|en|7.3|3800|38|18|prime~canal|flippant~intense|m|0|Une star vieillissante teste une substance qui crée une version plus jeune d’elle-même.',
  '1084736|f|Le Comte de Monte-Cristo|2024|178||Aventure~Drame~Histoire|vengeance~trahison~évasion|Matthieu Delaporte~Alexandre de La Patellière|Pierre Niney~Bastien Bouillon|FR|fr|8.0|1900|34|10|canal~tf1plus|intense~emouvant|m|0|Trahi et emprisonné, Edmond Dantès revient méconnaissable pour se venger.',
  '974576|f|Conclave|2024|120||Thriller~Drame~Mystère|vatican~élection~secret|Edward Berger|Ralph Fiennes~Stanley Tucci|GB~US|en|7.2|2600|30|10|prime~canal|reflechi~intense|l|0|À la mort du pape, un cardinal orchestre un conclave miné par les secrets.',
  '1156593|f|Flow, le chat qui n’avait plus peur de l’eau|2024|85||Animation~Aventure~Fantastique|inondation~animaux~survie|Gints Zilbalodis|~|LV~FR~BE|xx|8.1|1400|28|TP|arte~canal|emouvant~reflechi|l|1|Un chat solitaire embarque avec d’autres animaux pour fuir une inondation.',
  '1189055|f|Un p’tit truc en plus|2024|99||Comédie|handicap~colonie~imposture|Artus|Artus~Clovis Cornillac|FR|fr|7.4|900|22|TP|canal~m6plus|leger~emouvant|m|0|Un père et son fils se cachent dans une colonie pour adultes handicapés.',

  // ----- Séries --------------------------------------------------------
  '1398|s|Les Soprano|1999|55|6|Drame~Crime|mafia~psychanalyse~new jersey|David Chase|James Gandolfini~Edie Falco|US|en|8.6|3200|22|18|max~prime|intense~reflechi|l|0|Un parrain du New Jersey consulte une psychiatre entre deux règlements de comptes.',
  '1668|s|Friends|1994|22|10|Comédie~Romance|amitié~new york~colocation|David Crane~Marta Kauffman|Jennifer Aniston~Matthew Perry|US|en|8.4|8900|45|10|max~netflix|leger|r|0|Six amis new-yorkais traversent ensemble leurs vingt et trente ans.',
  '2316|s|The Office|2005|22|9|Comédie|bureau~faux documentaire~absurde|Greg Daniels|Steve Carell~John Krasinski|US|en|8.6|4400|38|10|prime~netflix|leger|r|0|Le quotidien absurde d’une PME de papier filmée en faux documentaire.',
  '1396|s|Breaking Bad|2008|48|5|Drame~Crime~Thriller|méthamphétamine~transformation~nouveau-mexique|Vince Gilligan|Bryan Cranston~Aaron Paul|US|en|8.9|13500|52|16|netflix|intense~reflechi|m|0|Un professeur de chimie malade se met à fabriquer de la méthamphétamine.',
  '1622|s|Kaamelott|2005|4|6|Comédie~Fantastique~Histoire|arthur~humour~table ronde|Alexandre Astier|Alexandre Astier~Lionnel Astier|FR|fr|8.2|1100|18|TP|canal~m6plus|leger|r|0|Le roi Arthur et ses chevaliers, entre quête du Graal et incompétence crasse.',
  '42009|s|Black Mirror|2011|55|6|Science-Fiction~Drame~Thriller|technologie~anthologie~dystopie|Charlie Brooker|~|GB|en|8.3|4600|34|16|netflix|reflechi~flippant|m|0|Une anthologie sur les dérives de nos technologies quotidiennes.',
  '1399|s|Game of Thrones|2011|60|8|Fantastique~Drame~Action|trônes~intrigues~dragons|David Benioff~D.B. Weiss|Emilia Clarke~Peter Dinklage|US|en|8.4|23000|48|16|max|intense|m|0|Sept familles se déchirent pour le trône de fer de Westeros.',
  '19885|s|Sherlock|2010|88|4|Crime~Drame~Mystère|déduction~londres~modernisation|Steven Moffat~Mark Gatiss|Benedict Cumberbatch~Martin Freeman|GB|en|8.5|6100|30|12|netflix~prime|intense~reflechi|r|0|Sherlock Holmes enquête dans le Londres d’aujourd’hui.',
  '60574|s|Peaky Blinders|2013|55|6|Crime~Drame|birmingham~gang~années 20|Steven Knight|Cillian Murphy~Helen McCrory|GB|en|8.5|7800|36|16|netflix|intense|m|0|Un gang de Birmingham prend le pouvoir dans l’Angleterre d’après-guerre.',
  '1429|s|L’Attaque des Titans|2013|24|4|Animation~Action~Fantastique|titans~murs~survie|Hajime Isayama|Yuki Kaji~Marina Inoue|JP|ja|8.7|6900|42|16|crunchyroll~adn|intense~flippant|r|1|L’humanité survit derrière d’immenses murs, assiégée par des géants.',
  '46648|s|True Detective|2014|55|4|Crime~Drame~Mystère|louisiane~enquête~duo|Nic Pizzolatto|Matthew McConaughey~Woody Harrelson|US|en|8.3|4100|26|16|max|intense~reflechi|l|0|Deux inspecteurs traquent un tueur rituel sur dix-sept ans.',
  '63174|s|Le Bureau des légendes|2015|52|5|Drame~Thriller|espionnage~dgse~clandestin|Éric Rochant|Mathieu Kassovitz~Sara Giraudeau|FR|fr|8.3|900|16|16|canal|intense~reflechi|l|0|Le quotidien des agents clandestins de la DGSE.',
  '66732|s|Stranger Things|2016|50|4|Science-Fiction~Drame~Mystère|années 80~amitié~monde parallèle|Matt Duffer~Ross Duffer|Millie Bobby Brown~Finn Wolfhard|US|en|8.6|17000|55|12|netflix|intense~emouvant|r|0|Dans l’Indiana des années 80, des enfants affrontent un monde parallèle.',
  '65494|s|The Crown|2016|58|6|Drame~Histoire|monarchie~pouvoir~famille|Peter Morgan|Claire Foy~Olivia Colman|GB|en|8.2|3200|24|12|netflix|reflechi~emouvant|l|0|Le règne d’Élisabeth II, décennie après décennie.',
  '67070|s|Fleabag|2016|27|2|Comédie~Drame|deuil~londres~quatrième mur|Phoebe Waller-Bridge|Phoebe Waller-Bridge~Andrew Scott|GB|en|8.5|1300|18|16|prime|leger~emouvant|r|0|Une trentenaire londonienne raconte sa vie cabossée face caméra.',
  '70523|s|Dark|2017|55|3|Science-Fiction~Mystère~Thriller|voyage dans le temps~village~boucle|Baran bo Odar~Jantje Friese|Louis Hofmann~Lisa Vicari|DE|de|8.4|4900|30|16|netflix|reflechi~flippant|l|0|La disparition d’enfants révèle une boucle temporelle dans un village allemand.',
  '67744|s|Mindhunter|2017|50|2|Crime~Drame~Thriller|profilage~fbi~tueurs en série|Joe Penhall|Jonathan Groff~Holt McCallany|US|en|8.5|3400|22|16|netflix|reflechi~flippant|l|0|Deux agents du FBI inventent le profilage en interrogeant des tueurs en série.',
  '76331|s|Succession|2018|60|4|Drame~Comédie|héritage~médias~famille|Jesse Armstrong|Brian Cox~Jeremy Strong|US|en|8.4|2600|26|16|max|intense~reflechi|m|0|Les enfants d’un magnat des médias se disputent sa succession.',
  '87108|s|Chernobyl|2019|65|1|Drame~Histoire~Thriller|catastrophe~urss~vérité|Craig Mazin|Jared Harris~Stellan Skarsgård|US~GB|en|8.7|5200|28|16|max|intense~reflechi|l|0|La catastrophe de Tchernobyl et le mensonge d’État qui l’a suivie.',
  '76479|s|The Boys|2019|60|4|Action~Science-Fiction~Comédie|super-héros~satire~violence|Eric Kripke|Karl Urban~Antony Starr|US|en|8.4|8900|44|18|prime|intense~leger|r|0|Des justiciers ordinaires s’attaquent à des super-héros corrompus.',
  '85937|s|Demon Slayer|2019|24|4|Animation~Action~Fantastique|démons~sabre~fratrie|Koyoharu Gotouge|Natsuki Hanae~Akari Kito|JP|ja|8.6|6100|46|16|crunchyroll~adn|intense~emouvant|r|1|Un jeune bûcheron devient pourfendeur de démons pour sauver sa sœur.',
  '97546|s|Ted Lasso|2020|35|3|Comédie~Drame|football~bienveillance~angleterre|Bill Lawrence~Jason Sudeikis|Jason Sudeikis~Hannah Waddingham|US|en|8.5|2200|24|10|appletv|leger~emouvant|m|0|Un coach de football américain débarque à la tête d’un club anglais.',
  '93405|s|Squid Game|2021|55|3|Drame~Thriller~Action|jeux~dette~survie|Hwang Dong-hyuk|Lee Jung-jae~Park Hae-soo|KR|ko|7.8|14000|58|18|netflix|intense~flippant|r|0|Des surendettés participent à des jeux d’enfants mortels pour une fortune.',
  '96677|s|Lupin|2021|48|3|Crime~Drame~Action|gentleman cambrioleur~paris~vengeance|George Kay~François Uzan|Omar Sy~Ludivine Sagnier|FR|fr|7.6|3100|32|10|netflix|leger~intense|r|0|Un gentleman cambrioleur venge son père en s’inspirant d’Arsène Lupin.',
  '94605|s|Arcane|2021|42|2|Animation~Science-Fiction~Action|sœurs~cité~magie|Christian Linke~Alex Yee|Hailee Steinfeld~Ella Purnell|FR~US|en|8.8|5100|50|16|netflix|intense~emouvant|r|1|Deux sœurs se retrouvent dans des camps opposés entre deux cités rivales.',
  '95479|s|HPI|2021|52|4|Crime~Comédie~Drame|haut potentiel~police~lille|Stéphane Carrié~Alice Chegaray-Breugnot|Audrey Fleurot~Mehdi Nebbou|FR|fr|7.4|700|20|10|tf1plus|leger~intense|r|0|Une femme de ménage au QI hors norme devient consultante pour la police.',
  '119051|s|Mercredi|2022|48|2|Comédie~Fantastique~Mystère|académie~enquête~gothique|Alfred Gough~Miles Millar|Jenna Ortega~Catherine Zeta-Jones|US|en|8.4|8200|54|12|netflix|leger~flippant|r|0|Mercredi Addams enquête sur une série de meurtres depuis son internat.',
  '95396|s|Severance|2022|50|2|Science-Fiction~Drame~Mystère|travail~mémoire~entreprise|Dan Erickson|Adam Scott~Britt Lower|US|en|8.4|2900|40|16|appletv|reflechi~flippant|l|0|Des employés acceptent de séparer chirurgicalement leur mémoire de travail et leur vie privée.',
  '83867|s|Andor|2022|48|2|Science-Fiction~Drame~Action|rébellion~espionnage~empire|Tony Gilroy|Diego Luna~Stellan Skarsgård|US|en|8.3|2600|32|12|disney|intense~reflechi|l|0|La naissance d’un rebelle dans l’ombre de l’Empire galactique.',
  '100088|s|The Last of Us|2023|55|2|Drame~Science-Fiction~Action|pandémie~survie~père de substitution|Craig Mazin~Neil Druckmann|Pedro Pascal~Bella Ramsey|US|en|8.5|5600|46|18|max|intense~emouvant|m|0|Un passeur escorte une adolescente immunisée à travers une Amérique dévastée.',
  '136315|s|Shōgun|2024|58|1|Drame~Histoire~Action|japon féodal~pouvoir~traduction|Justin Marks~Rachel Kondo|Hiroyuki Sanada~Anna Sawai|US|en|8.5|1900|34|16|disney|intense~reflechi|l|0|Un marin anglais échoue au Japon féodal, au cœur d’une lutte de pouvoir.',

  // ----- Compléments : années 1960, offres gratuites, animation japonaise
  '10344|f|Les Tontons flingueurs|1963|105||Comédie~Crime|dialogues~gangsters~cuisine|Georges Lautner|Lino Ventura~Bernard Blier|FR|fr|7.6|1100|10|TP|m6plus~plutotv|leger|m|0|Un ancien truand reprend les affaires d’un ami mourant et doit gérer sa fille.',
  '11576|f|La Grande Vadrouille|1966|132||Comédie~Guerre~Aventure|occupation~fuite~duo|Gérard Oury|Louis de Funès~Bourvil|FR|fr|7.5|1300|11|TP|tf1plus~plutotv|leger|m|0|Un chef d’orchestre et un peintre en bâtiment aident des aviateurs anglais à fuir.',
  '429|f|Le Bon, la Brute et le Truand|1966|161||Western~Aventure|or~guerre de sécession~duel|Sergio Leone|Clint Eastwood~Eli Wallach|IT~ES|it|8.5|8600|24|12|plutotv~prime|intense~leger|l|0|Trois hommes se disputent un trésor enfoui en pleine guerre de Sécession.',
  '62|f|2001 : L’Odyssée de l’espace|1968|149||Science-Fiction~Aventure|intelligence artificielle~espace~évolution|Stanley Kubrick|Keir Dullea~Gary Lockwood|GB~US|en|8.1|11200|22|TP|max~plutotv|reflechi|l|0|De la préhistoire à Jupiter, l’humanité face à une intelligence qu’elle a créée.',
  '4011|f|Le Dîner de cons|1998|80||Comédie|quiproquo~appartement~cruauté|Francis Veber|Jacques Villeret~Thierry Lhermitte|FR|fr|7.4|1500|12|TP|m6plus~plutotv|leger|r|0|Un éditeur invite à dîner un homme qu’il juge idiot, et la soirée déraille.',
  '5528|f|Astérix et Obélix : Mission Cléopâtre|2002|107||Comédie~Aventure~Familial|gaulois~égypte~absurde|Alain Chabat|Christian Clavier~Jamel Debbouze|FR|fr|7.3|2100|17|TP|tf1plus~m6plus|leger|r|0|Deux Gaulois aident un architecte égyptien à bâtir un palais en trois mois.',
  '275|f|Fargo|1996|98||Crime~Thriller~Comédie|neige~enlèvement~minnesota|Joel Coen~Ethan Coen|Frances McDormand~William H. Macy|US|en|8.0|6200|17|16|plutotv~prime|reflechi~intense|m|0|Un enlèvement bricolé tourne mal dans le Minnesota enneigé.',
  '328111|f|Demain|2015|118||Documentaire|écologie~initiatives~espoir|Cyril Dion~Mélanie Laurent|~|FR|fr|7.6|500|8|TP|francetv~arte|reflechi~emouvant|l|0|Un tour du monde des solutions concrètes face à l’effondrement écologique.',
  '1408|s|Engrenages|2005|52|8|Crime~Drame~Thriller|police judiciaire~justice~paris|Alexandra Clert|Caroline Proust~Thierry Godard|FR|fr|7.9|600|14|16|canal~francetv|intense~reflechi|m|0|Flics, juges et avocats dans les rouages de la justice parisienne.',
  '1438|s|Sur écoute|2002|59|5|Crime~Drame|baltimore~drogue~institutions|David Simon|Dominic West~Idris Elba|US|en|8.6|1800|18|16|ocs~max|reflechi~intense|l|0|Baltimore vue depuis la police, le trafic, le port, l’école et la presse.',
  '86853|s|Watchmen|2019|60|1|Science-Fiction~Drame~Mystère|justiciers~racisme~uchronie|Damon Lindelof|Regina King~Jeremy Irons|US|en|7.9|1400|16|16|ocs~max|reflechi~intense|m|0|Trente ans après le roman graphique, des justiciers masqués face au suprémacisme.',
  '505192|f|Drive My Car|2021|179||Drame|théâtre~deuil~voiture|Ryusuke Hamaguchi|Hidetoshi Nishijima~Toko Miura|JP|ja|7.4|1100|10|12|ocs~universcine|reflechi~emouvant|l|0|Un metteur en scène endeuillé travaille avec une jeune chauffeuse silencieuse.',
  '776503|f|CODA|2021|111||Drame~Musique|surdité~famille~émancipation|Sian Heder|Emilia Jones~Troy Kotsur|US~FR|en|8.0|2400|18|10|appletv|emouvant~leger|m|0|Seule entendante d’une famille sourde, une adolescente rêve de chanter.',
  '125988|s|Silo|2023|55|2|Science-Fiction~Drame~Mystère|silo~secret~survie|Graham Yost|Rebecca Ferguson~Tim Robbins|US|en|8.0|1500|30|16|appletv|reflechi~flippant|l|0|Dix mille personnes vivent sous terre et nul ne sait pourquoi.',
  '95557|s|Jujutsu Kaisen|2020|24|2|Animation~Action~Fantastique|exorcisme~malédictions~lycée|Gege Akutami|Junya Enoki~Yuma Uchida|JP|ja|8.5|4300|44|16|crunchyroll~adn|intense|r|1|Un lycéen avale un doigt maudit et rejoint une école d’exorcistes.',
  '31911|s|Fullmetal Alchemist : Brotherhood|2009|24|1|Animation~Action~Aventure|alchimie~fratrie~quête|Hiromu Arakawa|Romi Park~Rie Kugimiya|JP|ja|8.7|3600|30|12|crunchyroll~adn|intense~emouvant|r|1|Deux frères alchimistes cherchent à réparer une transmutation interdite.',
  '372058|f|Your Name|2016|106||Animation~Romance~Fantastique|échange de corps~comète~japon|Makoto Shinkai|Ryunosuke Kamiki~Mone Kamishiraishi|JP|ja|8.5|11500|38|10|netflix~crunchyroll|emouvant~leger|m|1|Deux adolescents que tout sépare se réveillent dans le corps de l’autre.',
];

/** Le catalogue de démonstration, prêt à être servi au moteur. */
export const CATALOGUE_DEMO: Titre[] = LIGNES.map(parserLigne);

/** Accès direct par identifiant (`film:550`). */
export const CATALOGUE_DEMO_PAR_ID: Record<string, Titre> = Object.fromEntries(
  CATALOGUE_DEMO.map((t) => [t.id, t]),
);

/** Retrouve un titre du catalogue de démonstration. */
export function titreDemo(id: string): Titre | null {
  return CATALOGUE_DEMO_PAR_ID[id] ?? null;
}
