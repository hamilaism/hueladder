// Toutes les métriques comparatives : accessibilité, règles de contraste, dispersion
// cross-teintes, dérive d'identité et fidélité aux couleurs existantes.

import { contrast, contrastVsWhite, contrastVsBlack, hexToOklch, hueDelta, fmtRatio } from './color.mjs';
import { deltaE2000Hex } from './deltae.mjs';
import { nearestInScale, SPARSE_METHODS } from './methods.mjs';

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Matrice de contraste step × step d'une rampe (null si l'un des deux steps manque).
 */
export function contrastMatrix(scale) {
  return scale.map(a => scale.map(b => (a && b ? round(contrast(a, b), 3) : null)));
}

/**
 * Toutes les paires de couleurs d'une méthode, tous nuanciers confondus.
 * L'écart de rang |i − j| est ce qui porte la garantie : c'est lui qu'on veut
 * pouvoir lire directement dans le nom des steps.
 */
function allPairs(ramps, method, coreRank) {
  const flat = [];
  for (const r of ramps) {
    r.colors[method].forEach((hex, i) => { if (hex) flat.push({ ramp: r.name, step: r.steps[i], i, hex }); });
  }
  const pairs = [];
  for (let a = 0; a < flat.length; a++) {
    for (let b = a + 1; b < flat.length; b++) {
      // L'écart de rang se compte sur la grille **régulière** : c'est elle seule que la règle
      // de contraste engage. Une paire touchant un cran hors grille n'a pas de rang, et ne
      // peut donc ni respecter ni violer la règle.
      const ra = coreRank[flat[a].i], rb = coreRank[flat[b].i];
      const rank = (ra === null || rb === null) ? null : Math.abs(ra - rb);
      pairs.push({ a: flat[a], b: flat[b], rank, ratio: contrast(flat[a].hex, flat[b].hex) });
    }
  }
  return pairs;
}

/**
 * Métriques d'une méthode. Les méthodes creuses (l'existant) sont mesurées mais
 * signalées : leurs totaux ne sont pas comparables à ceux des méthodes complètes.
 */
export function methodMetrics(ramps, method, { ruleRank, referenceMethod, coreRank }) {
  const sparse = SPARSE_METHODS.has(method);
  const pairs = allPairs(ramps, method, coreRank);
  const total = pairs.length;
  const aa = pairs.filter(p => p.ratio >= 4.5);

  // écart de rang minimal garantissant AA partout
  const ranked = pairs.filter(p => p.rank !== null);
  let safeRank = null;
  const maxRank = Math.max(0, ...ranked.map(p => p.rank));
  for (let d = 1; d <= maxRank; d++) {
    if (ranked.every(p => p.rank < d || p.ratio >= 4.5)) { safeRank = d; break; }
  }

  const violations = ranked.filter(p => p.rank >= ruleRank && p.ratio < 4.5);
  violations.sort((x, y) => x.ratio - y.ratio);

  // dispersion cross-teintes : à rang égal, l'écart de contraste sur blanc entre nuanciers
  const chromatic = ramps.filter(r => r.kind !== 'neutral');
  const stepSpread = {};
  const spreads = [];
  const nSteps = ramps[0].steps.length;
  for (let i = 0; i < nSteps; i++) {
    const vals = chromatic.map(r => r.colors[method][i]).filter(Boolean).map(contrastVsWhite);
    if (vals.length < 2) { stepSpread[ramps[0].steps[i]] = null; continue; }
    const lo = Math.min(...vals), hi = Math.max(...vals);
    stepSpread[ramps[0].steps[i]] = { min: round(lo), max: round(hi), spread: round(hi - lo) };
    spreads.push(hi - lo);
  }

  const flatColors = ramps.flatMap(r => r.colors[method]).filter(Boolean);
  const onWhite = flatColors.filter(h => contrastVsWhite(h) >= 4.5).length;
  const onBlack = flatColors.filter(h => contrastVsBlack(h) >= 4.5).length;

  // ce que la méthode garde de l'éclat du seed : un cran « écrêté » n'a pas pu tenir la chroma
  // de sa couleur d'origine à sa luminosité (3 % de tolérance pour l'arrondi hex). Sur une
  // méthode qui ne cherche pas à la garder (mix, easing, dessin manuel), c'est une désaturation.
  let gamut = null;
  if (!sparse) {
    let clipped = 0, count = 0;
    const kept = [], families = new Set();
    for (const r of chromatic) {
      const seedC = r.seed ? hexToOklch(r.seed).C : 0;
      if (seedC < 0.03) continue;
      for (const hex of r.colors[method]) {
        if (!hex) continue;
        const k = hexToOklch(hex).C / seedC;
        count++; kept.push(Math.min(1, k));
        if (k < 0.97) { clipped++; families.add(r.name); }
      }
    }
    if (count) gamut = { clipped, count, rate: round(clipped / count, 3), families: [...families], meanKept: round(mean(kept), 3) };
  }

  // dérive vs la couleur d'identité, au step d'ancrage
  let drift = null;
  if (method !== referenceMethod) {
    const per = [];
    for (const r of ramps) {
      // pas de dérive mesurable sur un nuancier dont le seed est synthétique : il n'y a
      // pas de couleur d'identité d'origine à trahir
      const ref = r.seedProvided ? r.seed : null;
      const got = r.colors[method][r.seedIndex];
      if (ref && got) per.push({ ramp: r.name, dE: round(deltaE2000Hex(ref, got), 1) });
    }
    // sans couleur d'identité fournie, la dérive n'est pas nulle : elle n'est pas mesurable
    drift = per.length ? { perRamp: per, meanDE: round(mean(per.map(p => p.dE)), 1) } : null;
  }

  // fidélité à TOUTES les couleurs fournies (pas seulement au step d'ancrage)
  const fidelity = [];
  for (const r of ramps) {
    for (const [role, hex] of Object.entries(r.anchors)) {
      if (!hex) continue;
      const { index, deltaE } = nearestInScale(hex, r.colors[method]);
      if (index < 0) continue;
      fidelity.push({ ramp: r.name, role, hex, step: r.steps[index], index, deltaE });
    }
  }

  return {
    sparse,
    colorCount: flatColors.length,
    pairsAA: aa.length,
    // les seuils voisins : 3:1 (éléments d'interface) et 7:1 (AAA), où une méthode peut payer
    // ce qu'elle gagne en AA
    pairsUI: pairs.filter(p => p.ratio >= 3).length,
    pairsAAA: pairs.filter(p => p.ratio >= 7).length,
    totalPairs: total,
    rankedPairs: ranked.length,
    pctAA: total ? round((aa.length / total) * 100, 1) : 0,
    safeRank,
    ruleRank,
    violationCount: violations.length,
    violationSample: violations.slice(0, 12).map(v => ({
      a: `${v.a.ramp}/${v.a.step}`, b: `${v.b.ramp}/${v.b.step}`, rank: v.rank, ratio: fmtRatio(v.ratio),
    })),
    stepSpread,
    meanSpread: round(mean(spreads)),
    onWhite,
    onBlack,
    gamut,
    drift,
    fidelity,
    meanFidelity: round(mean(fidelity.map(f => f.deltaE)), 1),
  };
}

/**
 * Le test formel d'interchangeabilité : **toutes** les paires de nuanciers à rang égal.
 *
 * `stepSpread` ci-dessus donne un min/max agrégé, ce qui répond à « de combien ça bouge »
 * mais pas à la seule question qui engage vraiment le design system : *est-ce que remplacer
 * une teinte par une autre au même cran peut faire basculer une règle d'accessibilité ?*
 * D'où deux mesures distinctes ici, et non une seule :
 *
 * - **l'écart** de contraste à rang égal — combien de points sépare la famille la moins
 *   contrastée de la plus contrastée ;
 * - **les franchissements** — le nombre de paires dont les deux membres, au même cran, ne
 *   donnent pas la même réponse à « est-ce que ça passe 3 / 4,5 / 7 ». C'est ça qui coûte
 *   cher : un seul franchissement suffit à rendre la règle inapplicable et à obliger à
 *   documenter une exception par teinte.
 *
 * Un écart non nul sans aucun franchissement est un système sain — la grille hex étant
 * discrète, l'écart ne peut jamais valoir zéro (mesuré : ~0,04 point de contraste au mieux
 * sur 20 teintes en sRGB 8 bits). Exiger zéro écart produirait un contrôle rouge à vie ;
 * exiger zéro franchissement est atteignable et c'est la vraie promesse.
 *
 * Le fond est un paramètre : le contrat porte sur les deux modes, et « contraste sur blanc »
 * ne veut rien dire une fois le thème inversé.
 */
export function interchangeability(ramps, method, {
  background = '#ffffff', coreRank, key = 'colors', thresholds = [3, 4.5, 7], includeNeutral = true,
} = {}) {
  // Le neutre en fait partie : remplacer une teinte par le gris (un bouton secondaire, un
  // état désactivé, un texte sur fond neutre) est la substitution la plus courante en
  // interface. Les déclinaisons sont des hypothèses, et les crans hors grille n'ont pas de
  // rang : aucune paire à rang égal à former.
  const chromatic = ramps.filter(r => !r.derived && (includeNeutral || r.kind !== 'neutral'));
  const steps = ramps[0]?.steps || [];

  const perStep = {}, crossings = [];
  let totalPairs = 0, crossingPairs = 0, maxSpread = 0, worstStep = null, sumSpread = 0, counted = 0;

  for (let i = 0; i < steps.length; i++) {
    if (!coreRank || coreRank[i] === null) continue;
    const at = chromatic
      .map(r => ({ ramp: r.name, hex: (r[key] || {})[method]?.[i] }))
      .filter(x => !!x.hex)
      .map(x => ({ ...x, c: contrast(x.hex, background) }));
    if (at.length < 2) { perStep[steps[i]] = null; continue; }

    at.sort((x, y) => x.c - y.c);
    const lo = at[0], hi = at[at.length - 1];
    const spread = hi.c - lo.c;
    const pairs = (at.length * (at.length - 1)) / 2;
    totalPairs += pairs;
    sumSpread += spread; counted++;
    if (spread > maxSpread) { maxSpread = spread; worstStep = steps[i]; }

    for (const t of thresholds) {
      const pass = at.filter(x => x.c >= t), fail = at.filter(x => x.c < t);
      if (!pass.length || !fail.length) continue;
      // chaque couple (qui passe, qui échoue) au même rang est un franchissement :
      // c'est exactement le nombre de substitutions qui casseraient la règle
      const n = pass.length * fail.length;
      crossingPairs += n;
      // `at` est trié par contraste croissant : le premier des recalés est le pire.
      crossings.push({
        step: steps[i], threshold: t, pairs: n,
        pass: pass.length, fail: fail.length,
        worstFail: `${fail[0].ramp} (${fmtRatio(fail[0].c)})`,
      });
    }

    perStep[steps[i]] = {
      min: round(lo.c, 3), max: round(hi.c, 3), spread: round(spread, 3),
      minRamp: lo.ramp, maxRamp: hi.ramp, ramps: at.length, pairs,
    };
  }

  return {
    background,
    ramps: chromatic.length,
    totalPairs,
    maxSpread: round(maxSpread, 4),
    worstStep,
    meanSpread: counted ? round(sumSpread / counted, 4) : null,
    thresholds,
    crossingPairs,
    crossings,
    perStep,
  };
}

/**
 * Monotonie d'une rampe : la luminance doit varier strictement, dans un sens et un seul.
 * Une inversion — même d'un millième — rend le nom du cran mensonger et casse tout dégradé
 * qui traverse la zone.
 */
export function monotonicity(scales, { steps, coreRank, direction = 'down' } = {}) {
  const faults = [];
  for (const s of scales) {
    const pts = steps.map((step, i) => ({ step, i, hex: s.colors[i] }))
      .filter(p => p.hex && (!coreRank || coreRank[p.i] !== null))
      .map(p => ({ ...p, y: relativeLuminance(p.hex) }));
    for (let k = 1; k < pts.length; k++) {
      const d = pts[k].y - pts[k - 1].y;
      if (direction === 'down' ? d >= 0 : d <= 0) {
        faults.push({ ramp: s.name, from: pts[k - 1].step, to: pts[k].step, delta: round(d, 6) });
      }
    }
  }
  return { ok: faults.length === 0, faults };
}

/**
 * La dérive de teinte **le long** d'une rampe, mesurée contre son cran d'ancrage.
 *
 * À ne pas confondre avec le `drift` de `methodMetrics`, qui compare la couleur générée à la
 * couleur d'origine au seul cran d'ancrage : celui-ci mesure la cohérence interne d'une
 * rampe. Une rampe dont la teinte tourne de 20° entre son cran 50 et son cran 950 n'est plus
 * une couleur déclinée, c'est deux couleurs qui partagent un nom — et c'est invisible sur un
 * nuancier, parce que l'œil compare les crans voisins, jamais les extrémités.
 *
 * Les crans trop peu chromatiques sont exclus : sous C ≈ 0,03 en OKLCh l'angle de teinte est
 * numériquement instable — un quasi-gris peut afficher n'importe quelle teinte sans qu'on
 * voie quoi que ce soit. Les inclure produirait des dérives de 100° parfaitement fictives.
 */
export function hueDrift(ramps, method, { seedIndex, minChroma = 0.03, key = 'colors' } = {}) {
  const perRamp = [], excluded = [];
  let maxDrift = 0, worst = null;

  for (const r of ramps) {
    if (r.kind === 'neutral' || r.derived) { excluded.push(r.name); continue; }
    const scale = (r[key] || {})[method];
    const anchor = scale?.[seedIndex ?? r.seedIndex];
    if (!anchor) { excluded.push(r.name); continue; }
    const ref = hexToOklch(anchor);
    if (ref.C < minChroma) { excluded.push(r.name); continue; }

    let rampMax = 0, rampAt = null;
    const deltas = [];
    scale.forEach((hex, i) => {
      if (!hex) return;
      const c = hexToOklch(hex);
      if (c.C < minChroma) return;
      const d = hueDelta(ref.H, c.H);
      deltas.push(d);
      if (Math.abs(d) > Math.abs(rampMax)) { rampMax = d; rampAt = r.steps[i]; }
    });
    if (!deltas.length) { excluded.push(r.name); continue; }

    const range = Math.max(...deltas) - Math.min(...deltas);
    perRamp.push({ ramp: r.name, max: round(rampMax, 2), at: rampAt, range: round(range, 2), steps: deltas.length });
    if (Math.abs(rampMax) > Math.abs(maxDrift)) {
      maxDrift = rampMax;
      worst = { ramp: r.name, step: rampAt, delta: round(rampMax, 2) };
    }
  }

  perRamp.sort((a, b) => Math.abs(b.max) - Math.abs(a.max));
  return {
    minChroma,
    maxDrift: round(Math.abs(maxDrift), 2),
    worst,
    meanAbs: round(mean(perRamp.map(p => Math.abs(p.max))), 2),
    measured: perRamp.length,
    excluded,
    perRamp,
  };
}

/**
 * Score de chaque usage conventionnel : sur combien de nuanciers la paire passe son seuil.
 * C'est la traduction concrète de « est-ce que je peux appliquer cette règle partout ».
 */
export function usageScores(ramps, methods, patterns) {
  return patterns.map(p => {
    const byMethod = {};
    for (const m of methods) {
      const fails = [];
      let applicable = 0;
      for (const r of ramps) {
        const fg = resolveStep(r, m, p.fg);
        const bg = resolveStep(r, m, p.bg);
        if (!fg || !bg) continue;
        applicable++;
        const ratio = contrast(fg, bg);
        if (ratio < p.threshold) fails.push(`${r.name} (${fmtRatio(ratio)})`);
      }
      byMethod[m] = { pass: applicable - fails.length, applicable, fails };
    }
    return { ...p, byMethod };
  });
}

function resolveStep(ramp, method, token) {
  if (token === 'W') return '#ffffff';
  if (token === 'B') return '#000000';
  const i = ramp.steps.indexOf(token);
  return i < 0 ? null : ramp.colors[method][i];
}

/**
 * Cohérence interne des couleurs déjà choisies à la main : de combien la teinte et la
 * saturation dérivent-elles entre les différentes valeurs d'un même nuancier.
 */
export function anchorConsistency(anchors) {
  const hexes = Object.values(anchors).filter(Boolean);
  const chromatic = hexes.map(hexToOklch).filter(c => c.C >= 0.03);
  if (chromatic.length < 2) return null;
  const base = chromatic[0].H;
  const deltas = chromatic.map(c => hueDelta(base, c.H));
  const chromas = chromatic.map(c => c.C);
  return {
    hueRange: round(Math.max(...deltas) - Math.min(...deltas), 1),
    chromaRange: round(Math.max(...chromas) - Math.min(...chromas), 3),
    count: hexes.length,
  };
}

/**
 * Proximité de teinte entre nuanciers réels : quelles familles pourraient être factorisées ?
 *
 * Né d'un cas réel : trois bleus (marque, catégorie, bleu d'une autre marque) à 1° de teinte
 * l'un de l'autre, qui ne se distinguaient que par la clarté et la saturation de leur couleur
 * d'origine. Or une méthode à contraste verrouillé impose la clarté par cran : une fois
 * régénérés, ces nuanciers convergent presque d'eux-mêmes (ΔE2000 moyen de 1 à 3,5). Adopter
 * la méthode pose donc mécaniquement la question de la fusion — mieux vaut la poser en amont.
 *
 * La teinte seule ne suffit pas, et c'est tout l'objet du rapport de chroma : deux familles
 * à la même teinte dont l'une a moins de 60 % de la saturation de l'autre (un violet et un
 * prune terne, un rouge et un bordeaux grisé) se lisent comme deux couleurs différentes.
 * Un rapprochement proposé sur le seul ΔE a déjà été rejeté à la relecture pour cette raison :
 * ces paires sont remontées à part, jamais comme candidates.
 *
 * Verdicts, du plus au moins actionnable :
 * - `factorisable` — même teinte, saturation comparable, et les rampes régénérées par la
 *   méthode core sont quasi indiscernables (ΔE2000 moyen < `maxCoreDE`) ;
 * - `voisines` — même teinte, saturation comparable, mais encore distinctes une fois
 *   régénérées : un choix à faire en conscience, pas un doublon ;
 * - `saturation` — même teinte, saturation trop différente : fausse proximité.
 *
 * Les neutres et les quasi-gris (chroma < `minChroma`) sont exclus : leur teinte n'a pas de
 * sens perceptif, et rapprocher deux gris est une question de température, pas de teinte.
 */
export function hueProximity(ramps, {
  coreMethod, maxHueGap = 12, minChromaRatio = 0.6, maxCoreDE = 5, minChroma = 0.05,
} = {}) {
  const chromatic = ramps.filter(r => r.kind !== 'neutral' && !r.derived && r.chroma >= minChroma);
  const pairs = [];
  for (let i = 0; i < chromatic.length; i++) {
    for (let j = i + 1; j < chromatic.length; j++) {
      const a = chromatic[i], b = chromatic[j];
      const hueGap = Math.abs(hueDelta(a.hue, b.hue));
      if (hueGap >= maxHueGap) continue;
      const chromaRatio = Math.min(a.chroma, b.chroma) / Math.max(a.chroma, b.chroma);
      const ca = a.colors[coreMethod] || [], cb = b.colors[coreMethod] || [];
      const des = ca.map((h, k) => (h && cb[k] ? deltaE2000Hex(h, cb[k]) : null)).filter(v => v !== null);
      const coreDE = des.length ? mean(des) : null;
      const verdict = chromaRatio < minChromaRatio ? 'saturation'
        : coreDE !== null && coreDE < maxCoreDE ? 'factorisable' : 'voisines';
      pairs.push({
        a: a.name, b: b.name, kinds: [a.kind, b.kind],
        hueGap: round(hueGap, 1), chromaRatio: round(chromaRatio, 2),
        seedDE: round(deltaE2000Hex(a.seed, b.seed), 1),
        coreDE: coreDE === null ? null : round(coreDE, 1),
        coreMaxDE: des.length ? round(Math.max(...des), 1) : null,
        verdict,
      });
    }
  }
  const rank = { factorisable: 0, voisines: 1, saturation: 2 };
  pairs.sort((x, y) => rank[x.verdict] - rank[y.verdict] || (x.coreDE ?? 99) - (y.coreDE ?? 99));
  return {
    maxHueGap, minChromaRatio, maxCoreDE, minChroma, coreMethod,
    measured: chromatic.length,
    factorisable: pairs.filter(p => p.verdict === 'factorisable').length,
    pairs,
  };
}
