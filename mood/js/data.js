/* Mood — données : axes d'humeur, catalogue, questions.
   Axes (0 → 1) :
     en = énergie      (posé ............ électrique)
     lu = lumière      (sombre .......... solaire)
     pr = profondeur   (divertissant .... exigeant)
     te = tension      (apaisant ........ sous tension)
   Attributs : cu = culte/familiarité, so = ça marche à plusieurs,
               an = année, du = durée (min), la = langue, sens = contenus sensibles */

const GENRES_FILM = ['Comédie','Drame','Thriller','Science-fiction','Action','Animation','Romance','Horreur','Polar','Fantastique','Aventure','Documentaire','Biopic','Musical'];
const GENRES_MUSIQUE = ['Pop','Rock','Rap / Hip-hop','Électro','R&B / Soul','Jazz','Classique','Chanson française','Folk / Indie','Métal','Funk / Disco','Ambient / Chill','Afro / Latino','Reggae','BO de films'];

const SENSIBILITES = [
  { id:'horreur',   l:'Horreur, films qui font peur' },
  { id:'violence',  l:'Violence graphique' },
  { id:'triste',    l:'Trucs qui plombent le moral' },
  { id:'romance',   l:'Histoires d’amour' },
  { id:'vo',        l:'Sous-titres (VO)' },
  { id:'long',      l:'Films de plus de 2h20' },
  { id:'agressif',  l:'Musique saturée / agressive' }
];

function F(t, m, g, en, lu, pr, te, o) { return Object.assign({ type:'film', t, m, g, en, lu, pr, te, sens:[] }, o); }
function M(t, m, g, en, lu, pr, te, o) { return Object.assign({ type:'musique', t, m, g, en, lu, pr, te, sens:[] }, o); }

const FILMS = [
  F('Whiplash','2014 · Damien Chazelle',['Drame','Musical'],.85,.45,.65,.85,{an:2014,du:107,cu:.82,so:.6,la:'vo',sens:['lourd'],d:'Un duel prof-élève à la batterie, filmé comme un thriller.'}),
  F('Intouchables','2011 · Nakache & Toledano',['Comédie','Drame'],.6,.95,.35,.2,{an:2011,du:112,cu:.95,so:.95,la:'fr',d:'La valeur sûre pour se réchauffer le cœur sans réfléchir.'}),
  F('Le Fabuleux Destin d’Amélie Poulain','2001 · Jean-Pierre Jeunet',['Comédie','Romance'],.5,.95,.45,.15,{an:2001,du:122,cu:.92,so:.7,la:'fr',sens:['romance'],d:'Un Paris en carte postale, des petits bonheurs et zéro cynisme.'}),
  F('Spider-Man: New Generation','2018 · Persichetti, Ramsey, Rothman',['Animation','Action'],.92,.85,.4,.55,{an:2018,du:117,cu:.8,so:.9,la:'vo',d:'Une claque graphique qui donne envie de sauter partout.'}),
  F('Interstellar','2014 · Christopher Nolan',['Science-fiction','Drame'],.7,.6,.85,.7,{an:2014,du:169,cu:.9,so:.6,la:'vo',sens:['long','triste'],d:'Immense, bruyant, bouleversant. À voir fort.'}),
  F('Parasite','2019 · Bong Joon-ho',['Thriller','Drame'],.65,.3,.85,.8,{an:2019,du:132,cu:.9,so:.7,la:'vo',sens:['violence'],d:'Commence en comédie sociale, finit en apnée.'}),
  F('La La Land','2016 · Damien Chazelle',['Musical','Romance'],.6,.7,.5,.3,{an:2016,du:128,cu:.85,so:.7,la:'vo',sens:['romance','triste'],d:'Des couleurs plein l’écran et une petite écharde dans le cœur.'}),
  F('Mad Max: Fury Road','2015 · George Miller',['Action','Science-fiction'],1,.5,.4,.95,{an:2015,du:120,cu:.85,so:.85,la:'vo',sens:['violence'],d:'Deux heures de course-poursuite. Le cerveau en pause, le pouls à 140.'}),
  F('Your Name','2016 · Makoto Shinkai',['Animation','Romance'],.55,.8,.6,.45,{an:2016,du:106,cu:.75,so:.6,la:'vo',sens:['romance'],d:'Romantique, lumineux, et un twist qui serre la gorge.'}),
  F('Le Voyage de Chihiro','2001 · Hayao Miyazaki',['Animation','Fantastique'],.5,.8,.65,.4,{an:2001,du:125,cu:.95,so:.8,la:'vo',d:'La couverture chauffante du cinéma d’animation.'}),
  F('Le Château ambulant','2004 · Hayao Miyazaki',['Animation','Fantastique'],.5,.8,.6,.4,{an:2004,du:119,cu:.8,so:.8,la:'vo',d:'Un conte doux avec une bande-son qui reste des semaines.'}),
  F('Lost in Translation','2003 · Sofia Coppola',['Drame','Romance'],.2,.45,.75,.15,{an:2003,du:102,cu:.8,so:.3,la:'vo',sens:['romance'],d:'Pour les nuits où on se sent un peu à côté du monde.'}),
  F('Portrait de la jeune fille en feu','2019 · Céline Sciamma',['Romance','Drame'],.2,.5,.85,.3,{an:2019,du:122,cu:.7,so:.3,la:'fr',sens:['romance','triste'],d:'Chaque plan est un tableau, chaque silence pèse une tonne.'}),
  F('Call Me by Your Name','2017 · Luca Guadagnino',['Romance','Drame'],.25,.6,.7,.2,{an:2017,du:132,cu:.72,so:.3,la:'vo',sens:['romance','triste'],d:'Un été italien, et la dernière scène qui t’achève.'}),
  F('OSS 117 : Le Caire, nid d’espions','2006 · Michel Hazanavicius',['Comédie'],.6,.9,.25,.15,{an:2006,du:99,cu:.9,so:.95,la:'fr',d:'Répliques cultes en rafale. Marche même en fond sonore.'}),
  F('La Cité de la peur','1994 · Alain Berbérian',['Comédie'],.7,.9,.2,.2,{an:1994,du:95,cu:.85,so:.9,la:'fr',d:'Absurde, daté, irrésistible. Le rire garanti entre potes.'}),
  F('Les Tontons flingueurs','1963 · Georges Lautner',['Comédie','Polar'],.5,.85,.3,.25,{an:1963,du:105,cu:.85,so:.85,la:'fr',d:'Les dialogues d’Audiard, le confort d’un vieux fauteuil.'}),
  F('Le Dîner de cons','1998 · Francis Veber',['Comédie'],.6,.85,.25,.25,{an:1998,du:80,cu:.9,so:.95,la:'fr',d:'80 minutes, zéro temps mort, rire mécanique parfait.'}),
  F('Le Grand Bain','2018 · Gilles Lellouche',['Comédie','Drame'],.5,.8,.45,.25,{an:2018,du:122,cu:.65,so:.85,la:'fr',d:'Des mecs cabossés et une fin qui fait du bien.'}),
  F('Dune','2021 · Denis Villeneuve',['Science-fiction','Aventure'],.65,.4,.75,.7,{an:2021,du:155,cu:.8,so:.7,la:'vo',sens:['long'],d:'Du sable, du son, du vertige. Grand écran obligatoire.'}),
  F('Blade Runner 2049','2017 · Denis Villeneuve',['Science-fiction','Thriller'],.4,.3,.9,.6,{an:2017,du:163,cu:.75,so:.4,la:'vo',sens:['long'],d:'Lent, hypnotique, mélancolique. Une transe néon.'}),
  F('Premier Contact','2016 · Denis Villeneuve',['Science-fiction','Drame'],.35,.5,.9,.6,{an:2016,du:116,cu:.75,so:.5,la:'vo',sens:['triste'],d:'De la SF qui parle de deuil et de langage. Ça remue.'}),
  F('Matrix','1999 · Lana & Lilly Wachowski',['Science-fiction','Action'],.85,.5,.65,.75,{an:1999,du:136,cu:.95,so:.85,la:'vo',sens:['violence'],d:'Le film-pilule. Efficace même à la dixième fois.'}),
  F('Retour vers le futur','1985 · Robert Zemeckis',['Aventure','Science-fiction'],.8,.9,.3,.4,{an:1985,du:116,cu:.95,so:.95,la:'vo',d:'Le doudou absolu. Rythme parfait, zéro prise de tête.'}),
  F('Everything Everywhere All at Once','2022 · Daniels',['Science-fiction','Comédie'],.95,.7,.7,.6,{an:2022,du:139,cu:.8,so:.8,la:'vo',d:'Le chaos total qui finit par te parler de ta famille.'}),
  F('Top Gun: Maverick','2022 · Joseph Kosinski',['Action'],.9,.8,.3,.7,{an:2022,du:130,cu:.8,so:.9,la:'vo',d:'Du spectacle pur, sans ironie. Ça décolle vraiment.'}),
  F('Baby Driver','2017 · Edgar Wright',['Action','Musical'],.95,.7,.35,.7,{an:2017,du:113,cu:.7,so:.85,la:'vo',d:'Un film monté sur la musique. Un shot de caféine.'}),
  F('Le Seigneur des anneaux : La Communauté de l’anneau','2001 · Peter Jackson',['Fantastique','Aventure'],.7,.6,.6,.65,{an:2001,du:178,cu:.95,so:.85,la:'vo',sens:['long'],d:'Le grand voyage. Idéal quand on a la soirée entière.'}),
  F('Harry Potter à l’école des sorciers','2001 · Chris Columbus',['Fantastique','Aventure'],.55,.85,.3,.35,{an:2001,du:152,cu:.9,so:.9,la:'vo',sens:['long'],d:'Retour direct en enfance, sans effort.'}),
  F('Paddington 2','2017 · Paul King',['Comédie','Aventure'],.6,.95,.25,.25,{an:2017,du:103,cu:.7,so:.95,la:'vo',d:'Le film le plus gentil du monde. Antidépresseur légal.'}),
  F('Ratatouille','2007 · Brad Bird',['Animation','Comédie'],.55,.9,.45,.3,{an:2007,du:111,cu:.9,so:.9,la:'vo',d:'Chaleureux, gourmand, et étonnamment malin.'}),
  F('Vice-versa','2015 · Pete Docter',['Animation'],.55,.75,.6,.35,{an:2015,du:95,cu:.85,so:.9,la:'vo',sens:['triste'],d:'Ça explique tes émotions mieux que toi. Et ça fait pleurer.'}),
  F('Coco','2017 · Lee Unkrich',['Animation','Musical'],.6,.85,.5,.35,{an:2017,du:105,cu:.8,so:.9,la:'vo',sens:['triste'],d:'Des couleurs, de la musique, et la dernière chanson qui tue.'}),
  F('Forrest Gump','1994 · Robert Zemeckis',['Drame','Comédie'],.5,.8,.5,.35,{an:1994,du:142,cu:.95,so:.85,la:'vo',sens:['triste'],d:'Une vie entière en deux heures. Sûr et réconfortant.'}),
  F('Les Évadés','1994 · Frank Darabont',['Drame'],.4,.7,.7,.5,{an:1994,du:142,cu:.95,so:.6,la:'vo',d:'De l’espoir pur, patiemment construit.'}),
  F('Le Parrain','1972 · Francis Ford Coppola',['Polar','Drame'],.4,.35,.9,.65,{an:1972,du:175,cu:1,so:.5,la:'vo',sens:['violence','long'],d:'Le monument. Lent, dense, imbattable.'}),
  F('Pulp Fiction','1994 · Quentin Tarantino',['Polar','Thriller'],.75,.55,.65,.6,{an:1994,du:154,cu:.95,so:.8,la:'vo',sens:['violence','long'],d:'Dialogues en or et structure en zigzag.'}),
  F('Kill Bill : Volume 1','2003 · Quentin Tarantino',['Action'],.95,.5,.4,.85,{an:2003,du:111,cu:.85,so:.8,la:'vo',sens:['violence'],d:'Vengeance stylisée, sabre et adrénaline.'}),
  F('Drive','2011 · Nicolas Winding Refn',['Thriller','Polar'],.55,.35,.7,.85,{an:2011,du:100,cu:.85,so:.6,la:'vo',sens:['violence'],d:'Peu de mots, beaucoup de néon et de tension.'}),
  F('Fight Club','1999 · David Fincher',['Drame','Thriller'],.8,.3,.8,.8,{an:1999,du:139,cu:.9,so:.7,la:'vo',sens:['violence'],d:'Nerveux, cynique, parfait pour une colère sourde.'}),
  F('Gone Girl','2014 · David Fincher',['Thriller'],.6,.25,.75,.9,{an:2014,du:149,cu:.75,so:.65,la:'vo',sens:['violence','long'],d:'Un piège qui se referme lentement. Impossible de couper.'}),
  F('Sixième Sens','1999 · M. Night Shyamalan',['Thriller','Fantastique'],.4,.3,.7,.85,{an:1999,du:107,cu:.85,so:.7,la:'vo',d:'Angoisse feutrée et twist légendaire.'}),
  F('Get Out','2017 · Jordan Peele',['Horreur','Thriller'],.7,.3,.7,.9,{an:2017,du:104,cu:.8,so:.75,la:'vo',sens:['horreur','violence'],d:'Malaise croissant et satire tranchante.'}),
  F('Hérédité','2018 · Ari Aster',['Horreur'],.6,.1,.7,1,{an:2018,du:127,cu:.7,so:.5,la:'vo',sens:['horreur','violence','triste'],d:'Traumatisant. À ne lancer que si tu assumes.'}),
  F('Shining','1980 · Stanley Kubrick',['Horreur','Thriller'],.5,.15,.8,.95,{an:1980,du:146,cu:.95,so:.5,la:'vo',sens:['horreur','long'],d:'Le froid, les couloirs, la folie. Un classique glaçant.'}),
  F('La Haine','1995 · Mathieu Kassovitz',['Drame'],.7,.2,.8,.8,{an:1995,du:98,cu:.95,so:.6,la:'fr',sens:['violence','lourd'],d:'Noir et blanc, rage intacte trente ans après.'}),
  F('Un prophète','2009 · Jacques Audiard',['Polar','Drame'],.6,.25,.8,.85,{an:2009,du:155,cu:.7,so:.4,la:'fr',sens:['violence','long'],d:'Ascension carcérale, sèche et magnétique.'}),
  F('Anatomie d’une chute','2023 · Justine Triet',['Drame','Thriller'],.35,.3,.9,.7,{an:2023,du:152,cu:.65,so:.5,la:'fr',sens:['long','lourd'],d:'Un procès, un couple disséqué. Ça discute après.'}),
  F('Le Comte de Monte-Cristo','2024 · La Patellière & Delaporte',['Aventure','Drame'],.75,.6,.55,.7,{an:2024,du:178,cu:.6,so:.85,la:'fr',sens:['long'],d:'Du grand spectacle à la française, vengeance comprise.'}),
  F('Joker','2019 · Todd Phillips',['Drame','Thriller'],.6,.1,.75,.85,{an:2019,du:122,cu:.8,so:.5,la:'vo',sens:['violence','lourd','triste'],d:'Descente lente. À éviter si le moral est déjà bas.'}),
  F('Eternal Sunshine of the Spotless Mind','2004 · Michel Gondry',['Romance','Science-fiction'],.45,.45,.85,.45,{an:2004,du:108,cu:.85,so:.4,la:'vo',sens:['romance','triste'],d:'Sur l’amour qu’on voudrait effacer. Le film des ruptures.'}),
  F('Her','2013 · Spike Jonze',['Romance','Science-fiction'],.3,.5,.8,.3,{an:2013,du:126,cu:.8,so:.35,la:'vo',sens:['romance','triste'],d:'Doux, solitaire, étrangement actuel.'}),
  F('Little Miss Sunshine','2006 · Dayton & Faris',['Comédie','Drame'],.55,.8,.5,.3,{an:2006,du:101,cu:.75,so:.85,la:'vo',d:'Famille bancale, van jaune, final hilarant.'}),
  F('Jojo Rabbit','2019 · Taika Waititi',['Comédie','Drame'],.6,.7,.65,.45,{an:2019,du:108,cu:.65,so:.75,la:'vo',sens:['triste'],d:'On rit, puis on se prend une gifle.'}),
  F('Sing Street','2016 · John Carney',['Musical','Comédie'],.7,.85,.4,.3,{an:2016,du:106,cu:.55,so:.8,la:'vo',d:'Monter un groupe à 15 ans. Euphorie garantie.'}),
  F('Sound of Metal','2019 · Darius Marder',['Drame','Musical'],.45,.35,.8,.6,{an:2019,du:120,cu:.5,so:.35,la:'vo',sens:['lourd'],d:'Un batteur qui perd l’audition. Le son fait tout.'}),
  F('Perfect Days','2023 · Wim Wenders',['Drame'],.15,.65,.8,.1,{an:2023,du:124,cu:.5,so:.3,la:'vo',d:'Presque rien ne se passe, et ça répare quelque chose.'}),
  F('Aftersun','2022 · Charlotte Wells',['Drame'],.2,.35,.85,.3,{an:2022,du:102,cu:.5,so:.25,la:'vo',sens:['triste','lourd'],d:'Des vacances filmées en caméscope, une douleur à retardement.'}),
  F('Mommy','2014 · Xavier Dolan',['Drame'],.6,.3,.8,.7,{an:2014,du:139,cu:.6,so:.35,la:'fr',sens:['triste','lourd'],d:'Intense, électrique, en format carré puis grand ouvert.'}),
  F('Les Choristes','2004 · Christophe Barratier',['Drame','Musical'],.4,.7,.45,.3,{an:2004,du:97,cu:.85,so:.85,la:'fr',sens:['triste'],d:'Doux, un peu suranné, et ces voix d’enfants.'}),
  F('Le Loup de Wall Street','2013 · Martin Scorsese',['Biopic','Comédie'],.9,.65,.5,.5,{an:2013,du:180,cu:.85,so:.8,la:'vo',sens:['long'],d:'Trois heures de démesure. Ça réveille.'}),
  F('Titanic','1997 · James Cameron',['Romance','Drame'],.6,.5,.5,.7,{an:1997,du:195,cu:.95,so:.7,la:'vo',sens:['romance','triste','long'],d:'Tu sais comment ça finit. Tu pleureras quand même.'}),
  F('Free Solo','2018 · Chin & Vasarhelyi',['Documentaire'],.7,.7,.5,.9,{an:2018,du:100,cu:.6,so:.75,la:'vo',d:'Une paroi de 900 m sans corde. Les mains moites.'}),
  F('Demain','2015 · Dion & Laurent',['Documentaire'],.5,.85,.6,.2,{an:2015,du:118,cu:.55,so:.6,la:'fr',d:'Des solutions plutôt que des constats. Ça remonte le moral.'})
];

const MUSIQUES = [
  M('Random Access Memories','Daft Punk · 2013',['Électro','Funk / Disco'],.7,.85,.55,.2,{an:2013,cu:.9,so:.85,d:'Chaud, analogique, intemporel. Ça met tout le monde d’accord.'}),
  M('Discovery','Daft Punk · 2001',['Électro','Funk / Disco'],.85,.9,.35,.25,{an:2001,cu:.95,so:.9,d:'Le shot de dopamine français. Impossible de rester assis.'}),
  M('Cross','Justice · 2007',['Électro','Rock'],.95,.65,.45,.65,{an:2007,cu:.8,so:.85,sens:['agressif'],d:'Saturé, brutal, jouissif. Pour évacuer.'}),
  M('Settle','Disclosure · 2013',['Électro','Pop'],.85,.8,.35,.3,{an:2013,cu:.7,so:.9,d:'House lumineuse, parfaite pour lancer une soirée.'}),
  M('Isles','Bicep · 2021',['Électro','Ambient / Chill'],.6,.6,.6,.3,{an:2021,cu:.55,so:.6,d:'Nostalgie rave, mais douce. Idéal en marchant la nuit.'}),
  M('Selected Ambient Works 85-92','Aphex Twin · 1992',['Ambient / Chill','Électro'],.35,.5,.8,.3,{an:1992,cu:.7,so:.3,d:'Pour travailler, flotter, ou ne penser à rien.'}),
  M('Music for Airports','Brian Eno · 1978',['Ambient / Chill'],.05,.55,.7,.05,{an:1978,cu:.7,so:.2,d:'Le degré zéro de l’agitation. Ça ralentit le rythme cardiaque.'}),
  M('Music Has the Right to Children','Boards of Canada · 1998',['Ambient / Chill','Électro'],.35,.45,.8,.3,{an:1998,cu:.65,so:.3,d:'Souvenirs flous et cassettes usées. Mélancolie confortable.'}),
  M('Modal Soul','Nujabes · 2005',['Rap / Hip-hop','Jazz'],.4,.65,.55,.15,{an:2005,cu:.7,so:.5,d:'Le hip-hop jazzy qui accompagne sans jamais déranger.'}),
  M('To Pimp a Butterfly','Kendrick Lamar · 2015',['Rap / Hip-hop','Jazz'],.75,.45,.95,.6,{an:2015,cu:.9,so:.5,sens:['explicite'],d:'Dense, politique, touffu. Ça demande de l’attention.'}),
  M('good kid, m.A.A.d city','Kendrick Lamar · 2012',['Rap / Hip-hop'],.8,.5,.75,.6,{an:2012,cu:.9,so:.7,sens:['explicite'],d:'Un film en album. Un classique qui se réécoute en entier.'}),
  M('IGOR','Tyler, the Creator · 2019',['Rap / Hip-hop','R&B / Soul'],.65,.5,.7,.45,{an:2019,cu:.75,so:.6,d:'Rupture amoureuse en synthés saturés. Étrange et addictif.'}),
  M('Blonde','Frank Ocean · 2016',['R&B / Soul'],.3,.4,.85,.3,{an:2016,cu:.85,so:.3,sens:['triste'],d:'L’album des nuits seules. À écouter au casque.'}),
  M('Channel Orange','Frank Ocean · 2012',['R&B / Soul'],.5,.55,.7,.35,{an:2012,cu:.8,so:.5,d:'Plus chaud, plus soul, toujours aussi bien écrit.'}),
  M('SOS','SZA · 2022',['R&B / Soul','Pop'],.5,.4,.6,.35,{an:2022,cu:.75,so:.55,sens:['triste','explicite'],d:'Pour ressasser une histoire, mais avec du style.'}),
  M('Back to Black','Amy Winehouse · 2006',['R&B / Soul','Jazz'],.55,.35,.6,.4,{an:2006,cu:.9,so:.6,sens:['triste'],d:'Soul vintage et cœur en miettes. Voix incomparable.'}),
  M('What’s Going On','Marvin Gaye · 1971',['R&B / Soul'],.45,.55,.8,.35,{an:1971,cu:.85,so:.5,d:'Doux et grave à la fois. Un album qui console.'}),
  M('Songs in the Key of Life','Stevie Wonder · 1976',['R&B / Soul','Funk / Disco'],.7,.9,.65,.2,{an:1976,cu:.85,so:.8,d:'Une usine à joie. Impossible d’être triste jusqu’au bout.'}),
  M('Thriller','Michael Jackson · 1982',['Pop','Funk / Disco'],.85,.85,.35,.3,{an:1982,cu:.98,so:.9,d:'La valeur sûre pour faire bouger n’importe quelle pièce.'}),
  M('Rumours','Fleetwood Mac · 1977',['Rock','Pop'],.6,.7,.55,.3,{an:1977,cu:.9,so:.75,d:'Des ruptures transformées en tubes solaires.'}),
  M('The Dark Side of the Moon','Pink Floyd · 1973',['Rock'],.45,.4,.9,.5,{an:1973,cu:.95,so:.4,d:'Un voyage de 43 minutes. Casque, lumière basse, immobile.'}),
  M('OK Computer','Radiohead · 1997',['Rock'],.5,.2,.9,.7,{an:1997,cu:.9,so:.35,sens:['triste'],d:'L’angoisse moderne mise en musique. Sublime et froid.'}),
  M('In Rainbows','Radiohead · 2007',['Rock','Folk / Indie'],.45,.4,.85,.5,{an:2007,cu:.8,so:.4,d:'Le Radiohead le plus chaleureux. Une porte d’entrée idéale.'}),
  M('Is This It','The Strokes · 2001',['Rock','Folk / Indie'],.75,.7,.45,.35,{an:2001,cu:.8,so:.8,d:'Guitares sèches, cool sans effort. Ça réveille sans agresser.'}),
  M('AM','Arctic Monkeys · 2013',['Rock'],.7,.55,.5,.45,{an:2013,cu:.85,so:.8,d:'Groove nocturne, un peu dragueur. Parfait en voiture.'}),
  M('Currents','Tame Impala · 2015',['Rock','Électro'],.55,.6,.6,.3,{an:2015,cu:.8,so:.7,d:'Psyché moelleux pour laisser filer les pensées.'}),
  M('Nevermind','Nirvana · 1991',['Rock','Métal'],.9,.3,.5,.7,{an:1991,cu:.95,so:.7,sens:['agressif'],d:'La rage des 90s, toujours cathartique.'}),
  M('Master of Puppets','Metallica · 1986',['Métal','Rock'],1,.35,.55,.85,{an:1986,cu:.9,so:.6,sens:['agressif'],d:'Pour la salle de sport ou pour tout envoyer valser.'}),
  M('Rage Against the Machine','Rage Against the Machine · 1992',['Métal','Rap / Hip-hop'],1,.3,.6,.9,{an:1992,cu:.85,so:.6,sens:['agressif','explicite'],d:'De la colère utile. Volume maximum.'}),
  M('Hybrid Theory','Linkin Park · 2000',['Rock','Métal'],.9,.3,.4,.8,{an:2000,cu:.9,so:.75,sens:['agressif'],d:'Ado à jamais. Ça défoule et ça console en même temps.'}),
  M('Future Nostalgia','Dua Lipa · 2020',['Pop','Funk / Disco'],.9,.95,.25,.15,{an:2020,cu:.85,so:.95,d:'Trente-sept minutes de disco propre. Zéro temps mort.'}),
  M('RENAISSANCE','Beyoncé · 2022',['Pop','Funk / Disco','Électro'],.9,.9,.45,.2,{an:2022,cu:.8,so:.95,d:'Un DJ set house-disco. Fait pour danser seul·e ou pas.'}),
  M('Lemonade','Beyoncé · 2016',['R&B / Soul','Pop'],.7,.4,.75,.6,{an:2016,cu:.8,so:.5,d:'Trahison, colère, reconstruction. Puissant.'}),
  M('1989','Taylor Swift · 2014',['Pop'],.75,.8,.3,.2,{an:2014,cu:.9,so:.85,d:'Pop synthétique imparable. Ça marche toujours.'}),
  M('folklore','Taylor Swift · 2020',['Folk / Indie','Pop'],.25,.4,.6,.2,{an:2020,cu:.8,so:.4,sens:['triste'],d:'Pluie, plaid, guitare. Pour les dimanches gris.'}),
  M('21','Adele · 2011',['Pop','R&B / Soul'],.45,.3,.5,.4,{an:2011,cu:.9,so:.5,sens:['triste'],d:'Si tu veux pleurer un bon coup, c’est efficace.'}),
  M('ABBA Gold','ABBA · 1992',['Pop','Funk / Disco'],.8,.95,.2,.1,{an:1992,cu:.95,so:.95,d:'Aucune honte à avoir. Ça sauve n’importe quelle soirée.'}),
  M('Graceland','Paul Simon · 1986',['Folk / Indie','Afro / Latino'],.6,.85,.6,.15,{an:1986,cu:.8,so:.75,d:'Rythmes sud-africains et écriture parfaite. Lumineux.'}),
  M('Legend','Bob Marley & The Wailers · 1984',['Reggae'],.55,.85,.45,.15,{an:1984,cu:.95,so:.9,d:'Le soleil en bouteille. Ça détend toute la pièce.'}),
  M('Un Verano Sin Ti','Bad Bunny · 2022',['Afro / Latino','Pop'],.8,.85,.3,.2,{an:2022,cu:.8,so:.9,sens:['explicite'],d:'Plage, reggaeton, été permanent.'}),
  M('Made in Lagos','Wizkid · 2020',['Afro / Latino','R&B / Soul'],.6,.8,.35,.15,{an:2020,cu:.65,so:.85,d:'Afrobeats souple et chaud. Ça balance sans forcer.'}),
  M('Racine carrée','Stromae · 2013',['Chanson française','Électro'],.75,.6,.65,.35,{an:2013,cu:.9,so:.85,d:'On danse sur des textes tristes. Le grand écart parfait.'}),
  M('Multitude','Stromae · 2022',['Chanson française','Pop'],.65,.5,.7,.35,{an:2022,cu:.75,so:.7,sens:['triste'],d:'Plus intime, plus cabossé. À écouter en lisant les paroles.'}),
  M('Histoire de Melody Nelson','Serge Gainsbourg · 1971',['Chanson française','Rock'],.4,.4,.85,.4,{an:1971,cu:.75,so:.35,d:'28 minutes de classe pure. Un objet à part.'}),
  M('Chaleur humaine','Christine and the Queens · 2014',['Chanson française','Pop'],.55,.6,.65,.3,{an:2014,cu:.7,so:.6,d:'Pop française élégante, un peu mélancolique.'}),
  M('Cœur','Clara Luciani · 2021',['Chanson française','Pop'],.65,.75,.4,.2,{an:2021,cu:.6,so:.75,d:'Variété assumée et efficace. Ça fait bouger la tête.'}),
  M('Cyborg','Nekfeu · 2016',['Rap / Hip-hop','Chanson française'],.7,.45,.7,.5,{an:2016,cu:.75,so:.6,sens:['explicite'],d:'Écriture dense, production soignée. Le rap qui se lit.'}),
  M('QALF','Damso · 2020',['Rap / Hip-hop'],.65,.3,.65,.6,{an:2020,cu:.75,so:.55,sens:['explicite','triste'],d:'Sombre, chirurgical. Pour les nuits qui traînent.'}),
  M('Kind of Blue','Miles Davis · 1959',['Jazz'],.25,.6,.8,.15,{an:1959,cu:.9,so:.5,d:'Le disque parfait pour cuisiner, lire, ou décompresser.'}),
  M('A Love Supreme','John Coltrane · 1965',['Jazz'],.55,.6,.95,.4,{an:1965,cu:.8,so:.3,d:'Une prière en saxophone. Exigeant, immense.'}),
  M('Black Radio','Robert Glasper Experiment · 2012',['Jazz','R&B / Soul'],.45,.6,.7,.25,{an:2012,cu:.5,so:.5,d:'Jazz et soul modernes. Classe et facile à vivre.'}),
  M('Les Quatre Saisons','Vivaldi · 1725',['Classique'],.55,.8,.6,.3,{an:1725,cu:.9,so:.6,d:'Vivant, connu par cœur, et ça marche toujours.'}),
  M('Nocturnes','Chopin · 1832',['Classique'],.15,.5,.8,.1,{an:1832,cu:.85,so:.3,sens:['triste'],d:'Piano seul, lumière tamisée. Ça apaise ou ça fait pleurer.'}),
  M('Variations Goldberg','Bach / Glenn Gould · 1981',['Classique'],.3,.6,.9,.15,{an:1981,cu:.8,so:.3,d:'Mathématique et hypnotique. Le disque de la concentration.'}),
  M('Elements','Ludovico Einaudi · 2015',['Classique','Ambient / Chill'],.25,.6,.5,.15,{an:2015,cu:.6,so:.4,d:'Piano contemporain, facile, cinématographique.'}),
  M('Interstellar (BO)','Hans Zimmer · 2014',['BO de films','Classique'],.5,.55,.85,.6,{an:2014,cu:.85,so:.5,d:'De l’orgue et du vertige. Ça agrandit n’importe quelle pièce.'}),
  M('Drive (BO)','Cliff Martinez & co · 2011',['BO de films','Électro'],.55,.45,.6,.6,{an:2011,cu:.75,so:.5,d:'Synthwave nocturne. Tu conduis même en étant assis.'}),
  M('Le Fabuleux Destin d’Amélie Poulain (BO)','Yann Tiersen · 2001',['BO de films','Chanson française'],.4,.8,.55,.2,{an:2001,cu:.85,so:.6,d:'Accordéon et piano. La tendresse instantanée.'}),
  M('For Emma, Forever Ago','Bon Iver · 2007',['Folk / Indie'],.2,.3,.75,.25,{an:2007,cu:.75,so:.25,sens:['triste'],d:'Enregistré seul dans une cabane. Ça s’entend.'}),
  M('Carrie & Lowell','Sufjan Stevens · 2015',['Folk / Indie'],.15,.2,.85,.2,{an:2015,cu:.6,so:.2,sens:['triste'],d:'Un album sur le deuil. Magnifique et dévastateur.'}),
  M('2','Mac DeMarco · 2012',['Folk / Indie','Rock'],.35,.6,.5,.15,{an:2012,cu:.65,so:.6,d:'Guitare molle et clope au bec. Le dimanche après-midi.'})
];

const CATALOGUE = FILMS.concat(MUSIQUES);
CATALOGUE.forEach(function (it, i) { it.id = it.type.charAt(0) + i; });

/* Références proposées à l'inscription : des œuvres très connues,
   bien réparties dans l'espace des goûts. */
const REFS_FILM = ['Intouchables','Interstellar','Parasite','Le Voyage de Chihiro','Mad Max: Fury Road','Le Fabuleux Destin d’Amélie Poulain','Pulp Fiction','La La Land','Shining','Harry Potter à l’école des sorciers','Eternal Sunshine of the Spotless Mind','Matrix','OSS 117 : Le Caire, nid d’espions','Portrait de la jeune fille en feu','Top Gun: Maverick','Everything Everywhere All at Once'];
const REFS_MUSIQUE = ['Discovery','To Pimp a Butterfly','Blonde','Thriller','OK Computer','Kind of Blue','Racine carrée','Master of Puppets','Future Nostalgia','Legend','Nocturnes','Currents','Back to Black','Un Verano Sin Ti','QALF','For Emma, Forever Ago'];

/* ── Humeurs de départ ─────────────────────────────────────────────
   miroir   = une œuvre qui épouse l'humeur
   antidote = une œuvre qui la rééquilibre
   fa       = besoin de familiarité (0 découverte → 1 doudou)            */
const HUMEURS = [
  { id:'epuise',  e:'😮‍💨', l:'Épuisé·e',      s:'plus de batterie',      miroir:{en:.2,lu:.5,pr:.4,te:.15},  antidote:{en:.5,lu:.85,pr:.3,te:.2},  fa:.7 },
  { id:'enerve',  e:'😤',  l:'Énervé·e',       s:'ça bout à l’intérieur', miroir:{en:.9,lu:.3,pr:.5,te:.85},  antidote:{en:.35,lu:.75,pr:.4,te:.12}, fa:.5 },
  { id:'triste',  e:'😔',  l:'Triste',         s:'le moral au sol',       miroir:{en:.25,lu:.25,pr:.8,te:.3}, antidote:{en:.6,lu:.9,pr:.35,te:.2},  fa:.65 },
  { id:'anxieux', e:'😰',  l:'Anxieux·se',     s:'la tête qui tourne',    miroir:{en:.35,lu:.4,pr:.6,te:.45}, antidote:{en:.3,lu:.8,pr:.35,te:.07}, fa:.75 },
  { id:'blase',   e:'🫥',  l:'Blasé·e',        s:'rien ne me fait envie', miroir:{en:.3,lu:.45,pr:.6,te:.35}, antidote:{en:.85,lu:.75,pr:.6,te:.7}, fa:.2 },
  { id:'nostal',  e:'🌊',  l:'Nostalgique',    s:'la tête dans l’avant', miroir:{en:.4,lu:.6,pr:.65,te:.25}, antidote:{en:.7,lu:.8,pr:.4,te:.35},  fa:.85 },
  { id:'amoureux',e:'🥰',  l:'Amoureux·se',    s:'le cœur qui déborde',   miroir:{en:.5,lu:.85,pr:.6,te:.3},  antidote:{en:.75,lu:.7,pr:.45,te:.5}, fa:.45 },
  { id:'motive',  e:'🚀',  l:'Motivé·e',       s:'prêt·e à tout casser',  miroir:{en:.88,lu:.8,pr:.5,te:.6},  antidote:{en:.4,lu:.7,pr:.6,te:.25},  fa:.4 },
  { id:'surcharge',e:'🤯', l:'La tête pleine', s:'trop de choses à gérer',miroir:{en:.4,lu:.5,pr:.5,te:.5},   antidote:{en:.35,lu:.8,pr:.2,te:.1},  fa:.8 },
  { id:'euphorique',e:'🤩',l:'Euphorique',     s:'ça pétille',            miroir:{en:.92,lu:.95,pr:.3,te:.3}, antidote:{en:.5,lu:.75,pr:.6,te:.3},  fa:.35 },
  { id:'serein',  e:'😌',  l:'Serein·e',       s:'tout va bien',          miroir:{en:.35,lu:.75,pr:.6,te:.2}, antidote:{en:.7,lu:.7,pr:.55,te:.55}, fa:.4 },
  { id:'perdu',   e:'🌀',  l:'Perdu·e',        s:'je sais pas où j’en suis', miroir:{en:.35,lu:.35,pr:.85,te:.45}, antidote:{en:.6,lu:.8,pr:.45,te:.3}, fa:.5 }
];

/* ── Direction : accompagner l'humeur ou en sortir ─────────────── */
const DIRECTIONS = [
  { id:'miroir',   e:'🪞', l:'Accompagne-moi',   s:'quelque chose qui me ressemble, là, maintenant', mix:0 },
  { id:'doux',     e:'🌤️', l:'Adoucis les choses', s:'me sortir de là en douceur',                   mix:.6 },
  { id:'contre',   e:'🔄', l:'Change-moi les idées', s:'l’exact opposé, à fond',                mix:1 },
  { id:'surprise', e:'🎲', l:'Surprends-moi',    s:'je te laisse choisir',                          mix:-1 }
];

/* ── Banque de questions adaptatives ───────────────────────────────
   set  : valeurs visées sur les axes,  w = confiance apportée
   ctx  : question de contexte (durée, entourage…)                    */
const QUESTIONS = [
  { id:'corps', axes:['en'], q:'Ton corps, il te dit quoi là tout de suite ?', opts:[
    { e:'🛋️', l:'Je suis mort·e, je bouge plus', set:{en:.12}, w:.95 },
    { e:'🌙', l:'Posé·e, tranquille',            set:{en:.38}, w:.8 },
    { e:'🙂', l:'Normal, ni haut ni bas',        set:{en:.55}, w:.5 },
    { e:'⚡', l:'J’ai de l’énergie à revendre', set:{en:.9}, w:.95 }
  ]},
  { id:'cerveau', axes:['pr'], q:'Il reste combien de batterie à ton cerveau ?', opts:[
    { e:'🫠', l:'Zéro. Je veux juste qu’on me divertisse', set:{pr:.15}, w:.95 },
    { e:'🙃', l:'De quoi suivre, sans plus',                   set:{pr:.45}, w:.7 },
    { e:'🧠', l:'Assez pour qu’on me challenge',          set:{pr:.88}, w:.9 }
  ]},
  { id:'tension', axes:['te'], q:'Tu supportes quel niveau de tension ?', opts:[
    { e:'☁️', l:'Zéro stress, vraiment zéro', set:{te:.08}, w:.95, evite:['horreur'] },
    { e:'🎭', l:'Un peu de suspense, ça va',  set:{te:.5},  w:.7 },
    { e:'💓', l:'Je veux avoir le cœur qui cogne', set:{te:.92}, w:.9 }
  ]},
  { id:'fin', axes:['lu','pr'], q:'À la fin, tu veux te sentir comment ?', opts:[
    { e:'😌', l:'Apaisé·e', set:{lu:.75,te:.15}, w:.8 },
    { e:'🥹', l:'Ému·e, remué·e', set:{lu:.35,pr:.8}, w:.85 },
    { e:'🔥', l:'Gonflé·e à bloc', set:{lu:.8,en:.85}, w:.85 },
    { e:'🤔', l:'Avec quelque chose à penser', set:{pr:.92,lu:.45}, w:.85 }
  ]},
  { id:'lumiere', axes:['lu'], q:'Tu veux de la lumière ou du noir ?', opts:[
    { e:'☀️', l:'Du beau, du chaud, du positif', set:{lu:.92}, w:.9, evite:['triste'] },
    { e:'🌗', l:'Doux-amer, entre les deux',      set:{lu:.5},  w:.7 },
    { e:'🌑', l:'Du sombre, sans filtre',         set:{lu:.12}, w:.9 }
  ]},
  { id:'avec', axes:['so'], ctx:'social', q:'Tu es seul·e ou accompagné·e ?', opts:[
    { e:'🧣', l:'Seul·e, sous le plaid', set:{so:.15}, w:.95 },
    { e:'👥', l:'À deux',                set:{so:.6},  w:.85 },
    { e:'🎉', l:'À plusieurs, faut que ça plaise à tout le monde', set:{so:.95}, w:.95 }
  ]},
  { id:'temps', axes:[], ctx:'temps', q:'Il te reste combien de temps ?', opts:[
    { e:'⏱️', l:'Moins d’1h30', temps:90 },
    { e:'🕐', l:'Environ 2h',        temps:135 },
    { e:'🌌', l:'La soirée entière', temps:999 }
  ]},
  { id:'connu', axes:['fa'], q:'Valeur sûre ou découverte ?', opts:[
    { e:'🧸', l:'Un truc que je connais déjà par cœur', set:{fa:.95}, w:.95 },
    { e:'⭐', l:'Un classique que je n’ai jamais vu', set:{fa:.6}, w:.8 },
    { e:'🔭', l:'Surprends-moi, du jamais-vu',            set:{fa:.1}, w:.9 }
  ]},
  { id:'lieu', axes:['lu','en','pr'], q:'Si c’était un endroit, ce serait…', opts:[
    { e:'🌃', l:'Un appart à 2h du matin', set:{en:.22,lu:.35,pr:.75}, w:.75 },
    { e:'🛣️', l:'Une route de nuit',       set:{en:.55,te:.6,lu:.4},  w:.7 },
    { e:'🌴', l:'Une terrasse en plein été', set:{lu:.92,en:.5,pr:.3}, w:.75 },
    { e:'🎪', l:'Une salle de concert bondée', set:{en:.95,so:.9,lu:.8}, w:.8 }
  ]},
  { id:'rythme', axes:['en','te'], q:'Le rythme idéal, ce soir ?', opts:[
    { e:'🐌', l:'Lent, contemplatif',      set:{en:.15,pr:.75,te:.15}, w:.8 },
    { e:'🌀', l:'Régulier, hypnotique',    set:{en:.5,te:.4},          w:.65 },
    { e:'🏎️', l:'Nerveux, qui ne lâche rien', set:{en:.88,te:.85},    w:.85 }
  ]},
  { id:'pleurer', axes:['lu','pr'], q:'Une envie de pleurer un bon coup ?', opts:[
    { e:'💧', l:'Oui, carrément, ça me ferait du bien', set:{lu:.25,pr:.8}, w:.85, autorise:['triste'] },
    { e:'🚫', l:'Surtout pas aujourd’hui',          set:{lu:.8},        w:.85, evite:['triste'] },
    { e:'🤷', l:'Peu importe',                            set:{},            w:.1 }
  ]},
  { id:'nostalgie', axes:['fa'], q:'La nostalgie, aujourd’hui, ça te…', opts:[
    { e:'📼', l:'Fait du bien, ramène-moi en arrière', set:{fa:.85}, w:.85, epoque:'avant' },
    { e:'✨', l:'Non, je veux du récent',              set:{fa:.3},  w:.75, epoque:'recent' },
    { e:'🤷', l:'Peu importe',                          set:{},      w:.1 }
  ]},
  { id:'sujet', axes:['pr','lu'], q:'Tu veux que ça te parle de quoi ?', opts:[
    { e:'❤️', l:'D’amour',                    set:{lu:.65,pr:.6}, w:.6, boost:['Romance','R&B / Soul','Chanson française'] },
    { e:'🏆', l:'De gens qui s’en sortent',   set:{lu:.85,pr:.5}, w:.7, boost:['Drame','Biopic','Documentaire'] },
    { e:'🌍', l:'Du monde tel qu’il est',     set:{pr:.9,lu:.3},  w:.8, boost:['Documentaire','Drame','Rap / Hip-hop'] },
    { e:'🛸', l:'De rien de réel, je veux m’évader', set:{pr:.25,lu:.75}, w:.75, boost:['Science-fiction','Fantastique','Animation','Aventure'] }
  ]},
  { id:'attention', axes:['pr'], ctx:'attention', q:'Tu vas vraiment regarder / écouter ?', opts:[
    { e:'📱', l:'Non, je fais autre chose à côté', set:{pr:.2,te:.3}, w:.85 },
    { e:'👀', l:'Oui, à fond, téléphone rangé',    set:{pr:.75},      w:.8 }
  ]},
  { id:'volume', axes:['en','te'], q:'Et niveau intensité, tu montes le son ou pas ?', opts:[
    { e:'🔈', l:'Doucement, en fond',       set:{en:.25,te:.15}, w:.8 },
    { e:'🔉', l:'Confortable',              set:{en:.55},        w:.5 },
    { e:'🔊', l:'À fond, que ça vibre',     set:{en:.92,te:.7},  w:.85 }
  ]}
];
