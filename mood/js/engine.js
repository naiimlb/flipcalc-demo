/* Mood — moteur : profil de goûts, analyse d'humeur, recommandation. */

const CLE = 'mood.profil.v1';
const AXES = ['en', 'lu', 'pr', 'te'];

/* ───────────────────────── Profil ───────────────────────── */

function profilVide() {
  return {
    v: 1,
    fini: false,
    prenom: '',
    medias: ['film', 'musique'],
    gFilm: {},          // genre → poids 0..1
    gMus: {},
    refs: [],           // ids des œuvres choisies à l'inscription
    gout: { en: .5, lu: .5, pr: .5, te: .5 },
    vo: true,
    epoque: 'peu',      // 'peu' | 'recent' | 'avant'
    ouverture: .5,      // 0 = doudou, 1 = découverte permanente
    dureeConfort: 999,
    interdits: [],
    aimes: [],
    rejets: [],
    vus: [],
    histo: []           // [{ t, humeur, direction, ids }]
  };
}

function chargerProfil() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return profilVide();
    return Object.assign(profilVide(), JSON.parse(brut));
  } catch (e) { return profilVide(); }
}

function sauverProfil(p) {
  try { localStorage.setItem(CLE, JSON.stringify(p)); } catch (e) {}
}

function parTitre(titre) {
  return CATALOGUE.filter(function (i) { return i.t === titre; })[0];
}
function parId(id) {
  return CATALOGUE.filter(function (i) { return i.id === id; })[0];
}

/* Recalcule le vecteur de goût moyen à partir des œuvres de référence
   et des coups de cœur enregistrés. */
function majGout(p) {
  const ids = p.refs.concat(p.aimes);
  const items = ids.map(parId).filter(Boolean);
  if (!items.length) return;
  const g = { en: 0, lu: 0, pr: 0, te: 0 };
  items.forEach(function (it) { AXES.forEach(function (a) { g[a] += it[a]; }); });
  AXES.forEach(function (a) { g[a] = g[a] / items.length; });
  p.gout = g;
}

/* Les genres des œuvres de référence renforcent les genres cochés. */
function appliquerRefs(p) {
  p.refs.map(parId).filter(Boolean).forEach(function (it) {
    const cible = it.type === 'film' ? p.gFilm : p.gMus;
    it.g.forEach(function (genre) {
      cible[genre] = Math.min(1, (cible[genre] || 0) + .35);
    });
  });
  majGout(p);
}

/* ─────────────────── Session d'analyse d'humeur ─────────────────── */

function nouvelleSession(medias) {
  return {
    medias: medias.slice(),
    humeur: null,
    direction: null,
    cible: { en: .5, lu: .5, pr: .5, te: .5 },
    conf: { en: .05, lu: .05, pr: .05, te: .05, fa: .05, so: .05 },
    fa: .5,           // besoin de familiarité
    so: .5,           // contexte social
    temps: null,
    evite: [],
    autorise: [],
    boost: {},
    epoque: null,
    posees: [],
    reponses: [],
    montres: []
  };
}

function appliquerHumeur(s, humeur, direction) {
  s.humeur = humeur;
  s.direction = direction;
  let mix = direction.mix;
  if (mix < 0) mix = Math.random();                    // « surprends-moi »
  AXES.forEach(function (a) {
    let v = humeur.miroir[a] * (1 - mix) + humeur.antidote[a] * mix;
    if (direction.mix < 0) v = Math.min(1, Math.max(0, v + (Math.random() - .5) * .25));
    s.cible[a] = v;
    s.conf[a] = .45;
  });
  s.fa = humeur.fa;
  s.conf.fa = .3;
  /* Quand quelqu'un qui va mal demande à être sorti de là, on évite
     d'office les œuvres plombantes — sauf s'il dit ensuite le contraire. */
  const fragile = ['triste', 'epuise', 'anxieux', 'surcharge', 'perdu'].indexOf(humeur.id) >= 0;
  if (fragile && direction.mix >= .5) { s.evite.push('triste'); s.evite.push('lourd'); }
}

/* Mélange une valeur dans la cible, pondérée par la confiance acquise. */
function fondre(s, axe, valeur, poids) {
  const c = s.conf[axe] || .05;
  const courant = (axe === 'fa') ? s.fa : (axe === 'so') ? s.so : s.cible[axe];
  const v = (courant * c + valeur * poids) / (c + poids);
  if (axe === 'fa') s.fa = v;
  else if (axe === 'so') s.so = v;
  else s.cible[axe] = v;
  s.conf[axe] = Math.min(1, c + poids * .8);
}

function repondre(s, question, option) {
  s.posees.push(question.id);
  s.reponses.push({ q: question.q, r: option.l });
  if (option.set) {
    Object.keys(option.set).forEach(function (axe) {
      fondre(s, axe, option.set[axe], option.w || .6);
    });
  }
  if (option.temps) s.temps = option.temps;
  if (option.evite) option.evite.forEach(function (t) { if (s.evite.indexOf(t) < 0) s.evite.push(t); });
  if (option.autorise) option.autorise.forEach(function (t) {
    if (s.autorise.indexOf(t) < 0) s.autorise.push(t);
    const i = s.evite.indexOf(t);                  // l'utilisateur lève lui-même le garde-fou
    if (i >= 0) s.evite.splice(i, 1);
    if (t === 'triste') { const j = s.evite.indexOf('lourd'); if (j >= 0) s.evite.splice(j, 1); }
  });
  if (option.boost) option.boost.forEach(function (g) { s.boost[g] = (s.boost[g] || 0) + 1; });
  if (option.epoque) s.epoque = option.epoque;
}

/* Choisit la question qui lève le plus d'incertitude.
   Les deux questions de contexte (entourage, temps disponible) passent
   d'abord : sans elles, tout le reste peut tomber à côté. */
function prochaineQuestion(s) {
  const posee = function (id) { return s.posees.indexOf(id) >= 0; };
  const par = function (id) { return QUESTIONS.filter(function (q) { return q.id === id; })[0]; };

  if (!posee('avec')) return par('avec');
  if (s.medias.indexOf('film') >= 0 && !posee('temps')) return par('temps');

  const dispo = QUESTIONS.filter(function (q) {
    if (posee(q.id)) return false;
    if (q.ctx === 'temps') return false;
    if (q.id === 'volume' && s.medias.indexOf('musique') < 0) return false;
    return true;
  });
  if (!dispo.length) return null;

  let best = null, bestScore = -1;
  dispo.forEach(function (q) {
    const axes = q.axes || [];
    let sc = 0;
    axes.forEach(function (a) { sc += 1 - (s.conf[a] || 0); });
    sc = axes.length ? sc / axes.length : .2;   // incertitude moyenne levée
    if (axes.length > 1) sc += .05 * (axes.length - 1);
    if (q.ctx) sc += .08;
    sc += Math.random() * .35;                  // évite de poser toujours les mêmes
    if (sc > bestScore) { bestScore = sc; best = q; }
  });
  return best;
}

/* ─────────────────────── Recommandation ─────────────────────── */

function poidsGenre(p, item) {
  const table = item.type === 'film' ? p.gFilm : p.gMus;
  let max = 0, somme = 0;
  item.g.forEach(function (g) {
    const v = table[g] || 0;
    somme += v;
    if (v > max) max = v;
  });
  return Math.min(1, max * .75 + (somme / item.g.length) * .25);
}

function noter(item, s, p) {
  /* Filtres durs */
  if (p.rejets.indexOf(item.id) >= 0) return null;
  const sens = item.sens || [];
  for (let i = 0; i < p.interdits.length; i++) {
    const ban = p.interdits[i];
    if (ban === 'vo') { if (item.type === 'film' && item.la === 'vo') return null; continue; }
    if (ban === 'long') { if (item.type === 'film' && item.du > 140) return null; continue; }
    if (sens.indexOf(ban) >= 0) return null;
  }
  /* Temps disponible : au-delà de 20 min de dépassement, on écarte ;
     juste au-dessus, on garde avec un malus. */
  if (item.type === 'film' && s.temps && item.du > s.temps + 20) return null;

  /* Distance d'humeur, pondérée par la confiance de chaque axe */
  let dist = 0, poids = 0;
  AXES.forEach(function (a) {
    const w = .3 + (s.conf[a] || 0) * .7;
    dist += Math.abs(item[a] - s.cible[a]) * w;
    poids += w;
  });
  let score = 1 - dist / poids;                    // 0..1

  /* Goûts déclarés */
  const pg = poidsGenre(p, item);
  score += pg * .22;

  /* Boosts de la session (« parle-moi d'amour », etc.) */
  let boost = 0;
  item.g.forEach(function (g) { if (s.boost[g]) boost += .05 * s.boost[g]; });
  score += Math.min(.12, boost);

  /* Proximité avec le vecteur de goût global */
  let dg = 0;
  AXES.forEach(function (a) { dg += Math.abs(item[a] - p.gout[a]); });
  score += (1 - dg / 4) * .10;

  /* Familiarité voulue vs notoriété de l'œuvre */
  score -= Math.abs(s.fa - (item.cu || .5)) * .16;
  const dejaVu = p.vus.indexOf(item.id) >= 0 || p.aimes.indexOf(item.id) >= 0;
  if (dejaVu) score += (s.fa > .65 ? .12 : -.22);
  if (p.aimes.indexOf(item.id) >= 0 && s.fa > .65) score += .06;

  /* Ouverture du profil : envie chronique de découverte ou de doudou */
  score += (1 - Math.abs((1 - p.ouverture) - (item.cu || .5))) * .04;

  /* Contexte social */
  score -= Math.abs(s.so - (item.so || .5)) * .13;

  /* Époque */
  const ep = s.epoque || (p.epoque !== 'peu' ? p.epoque : null);
  if (ep === 'recent') score += item.an >= 2015 ? .07 : (item.an < 2000 ? -.08 : 0);
  if (ep === 'avant') score += item.an <= 2005 ? .07 : -.05;

  /* Contenus à éviter ce soir (sans être interdits à vie) */
  let mou = 0;
  sens.forEach(function (t) { if (s.evite.indexOf(t) >= 0) mou += .3; });
  if (sens.indexOf('lourd') >= 0 && s.evite.indexOf('triste') >= 0) mou += .15;
  score -= mou;

  /* Déjà proposé récemment → on varie */
  const recents = [];
  p.histo.slice(0, 4).forEach(function (h) { (h.ids || []).forEach(function (id) { recents.push(id); }); });
  if (recents.indexOf(item.id) >= 0) score -= .12;

  /* Durée confortable */
  if (item.type === 'film' && s.temps && item.du > s.temps) score -= .18;
  if (item.type === 'film' && p.dureeConfort < 900 && item.du > p.dureeConfort) score -= .08;

  score += (Math.random() - .5) * .03;
  return score;
}

/* elargi = on ignore les contraintes de la séance (temps, contenus évités)
   pour ne pas laisser l'utilisateur les mains vides. */
function recommander(s, p, type, n, elargi) {
  if (elargi) {
    s = Object.assign({}, s, { temps: null, evite: [] });
  }
  const notes = [];
  CATALOGUE.forEach(function (item) {
    if (item.type !== type) return;
    const sc = noter(item, s, p);
    if (sc === null) return;
    notes.push({ item: item, score: sc });
  });
  notes.sort(function (a, b) { return b.score - a.score; });
  return notes.slice(0, n || 6);
}

/* ─────────────────── Explication « pourquoi » ─────────────────── */

const PHRASES = {
  en: [['ça ne demande aucune énergie', .28], ['un rythme tranquille', .55], ['ça a du rythme', .78], ['ça envoie de l\u2019énergie', 1]],
  lu: [['sombre, sans filtre', .26], ['plutôt sombre', .48], ['doux-amer, nuancé', .72], ['lumineux, ça réchauffe', 1]],
  pr: [['zéro prise de tête', .3], ['facile à suivre', .55], ['assez riche sans être lourd', .78], ['exigeant, ça donne à penser', 1]],
  te: [['apaisant, aucune tension', .28], ['calme, sans stress', .5], ['juste ce qu\u2019il faut de suspense', .75], ['tendu, ça tient en haleine', 1]]
};

function motAxe(axe, valeur) {
  const p = PHRASES[axe];
  for (let i = 0; i < p.length; i++) if (valeur <= p[i][1]) return p[i][0];
  return p[p.length - 1][0];
}

function raisons(item, s, p) {
  const out = [];
  /* Les deux axes les mieux cernés et bien respectés par l'œuvre */
  const cand = AXES.map(function (a) {
    return { a: a, prox: 1 - Math.abs(item[a] - s.cible[a]), conf: s.conf[a] || 0 };
  }).filter(function (o) { return o.prox > .78; })
    .sort(function (x, y) { return (y.prox * .6 + y.conf * .4) - (x.prox * .6 + x.conf * .4); });
  cand.slice(0, 2).forEach(function (o) { out.push(motAxe(o.a, item[o.a])); });

  /* Goût déclaré */
  const table = item.type === 'film' ? p.gFilm : p.gMus;
  const aimes = item.g.filter(function (g) { return (table[g] || 0) >= .5; });
  if (aimes.length) out.push('tu aimes ' + aimes[0].toLowerCase());

  /* Familiarité / découverte */
  if (s.fa > .68 && (item.cu || 0) > .8) out.push('une valeur sûre');
  if (s.fa < .35 && (item.cu || 0) < .7) out.push('sûrement une découverte');

  /* Contexte */
  if (item.type === 'film' && s.temps && s.temps < 900 && item.du <= s.temps) out.push(item.du + ' min, ça rentre');
  if (item.type === 'film' && s.temps && s.temps < 900 && item.du > s.temps) out.push('un peu long (' + item.du + ' min) mais ça vaut le coup');
  if (s.so > .75 && (item.so || 0) > .8) out.push('ça passe bien à plusieurs');
  if (s.so < .3 && (item.so || 1) < .45) out.push('parfait en solo');

  return out.slice(0, 4);
}

function resumeHumeur(s) {
  if (!s.humeur) return '';
  const d = s.direction;
  const mots = AXES.map(function (a) { return { a: a, c: s.conf[a] }; })
    .sort(function (x, y) { return y.c - x.c; }).slice(0, 2)
    .map(function (o) { return motAxe(o.a, s.cible[o.a]); });
  return 'Tu es ' + s.humeur.l.toLowerCase() + ' et tu veux que ça ' +
    (d.id === 'miroir' ? 't’accompagne' : d.id === 'doux' ? 't’adoucisse les choses' :
     d.id === 'contre' ? 'te change les idées' : 'te surprenne') +
    '. Je pars sur : ' + mots.join(', ') + '.';
}
