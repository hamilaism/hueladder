// Les nomenclatures de crans : ce que le nom d'un cran encode, et donc ce qui se passe quand
// on en ajoute ou en retire. Recherche et sources : references/nomenclatures.md.
//
// Toutes se ramènent à la même coordonnée interne, le shade s ∈ [0, 200] (contraste face au
// noir = 21^(s/200), 200 = blanc). Une nomenclature est une façon de choisir le shade d'un cran :
//
// - `grid` (défaut) : centaines sur la grille de référence 50 → 950 ; un cran hors grille
//   (25, 150…) est interpolé par son nom entre ses voisins, et reste hors de la règle.
// - `hundreds` : centaines **par contraste**, s = 200 · (1 − nom / 1000), noms multiples de 25.
//   Tout cran entre dans la règle, et en ajouter un ne déplace aucun autre.
// - `shade` : le nom **est** le shade (David Fusilier, color-shades), 0 = noir, 200 = blanc,
//   noms multiples de 5. Même propriété, règle lue directement dans l'écart des noms.
// - `rank` : les crans sont répartis régulièrement dans l'ordre donné (Radix 1–12, Carbon
//   10–100, Primer 0–9…). Le nom n'encode qu'une position : ajouter ou retirer un cran
//   répartit à nouveau tous les autres.

import { REFERENCE_STEPS, REFERENCE_SEED, STEP_PRESETS, applyStepPreset } from './crans.mjs';

const range = (from, to, by) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => String(from + i * by));

export const NAMINGS = {
  grid: {
    grain: null,
    valid: n => /^\d{1,4}$/.test(n) && +n >= 0 && +n <= 1000,
    presets: Object.fromEntries(Object.entries(STEP_PRESETS).map(([k, p]) => [k,
      p.emit || [...REFERENCE_STEPS, ...(p.extra || [])].sort((a, b) => a - b)])),
    defaultPreset: 'standard',
  },
  hundreds: {
    grain: 25, toShade: n => 200 * (1 - n / 1000), seed: '500', lightFirst: true,
    valid: n => /^\d{1,4}$/.test(n) && +n >= 0 && +n <= 1000 && n % 25 === 0,
    presets: {
      standard: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
      fine: range(50, 950, 50),
      quarter: range(25, 975, 25),
      compact: ['100', '300', '500', '700', '900'],
    },
    defaultPreset: 'standard',
  },
  shade: {
    grain: 5, toShade: n => +n, seed: '100', lightFirst: false,
    valid: n => /^\d{1,3}$/.test(n) && +n >= 0 && +n <= 200 && n % 5 === 0,
    presets: {
      fusilier: ['175', '150', '125', '100', '75', '50', '25', '10'],
      step25: range(0, 200, 25).reverse().filter(n => n !== '0' && n !== '200'),
      step10: range(10, 190, 10).reverse(),
    },
    defaultPreset: 'fusilier',
  },
  rank: {
    grain: null,
    valid: n => /^[\w.-]{1,8}$/.test(n),
    presets: {
      radix: range(1, 12, 1),
      carbon: range(10, 100, 10),
      primer: range(0, 9, 1),
      ant: range(1, 10, 1),
      tailwind: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
    },
    defaultPreset: 'radix',
  },
};

/**
 * Déplie `naming` + `stepList` en clés que le moteur connaît. Sans `naming`, la spec garde
 * `crans` (préréglages de la grille) ou ses `steps` écrits à la main.
 */
export function applyNaming(spec) {
  if (!spec.naming) return applyStepPreset(spec);
  const N = NAMINGS[spec.naming];
  if (!N) throw new Error(`naming "${spec.naming}" inconnue — attendu : ${Object.keys(NAMINGS).join(', ')}`);
  const list = [...new Set((spec.stepList || N.presets[N.defaultPreset]).map(String))];
  const bad = list.filter(n => !N.valid(n));
  if (bad.length) throw new Error(`crans invalides pour la nomenclature « ${spec.naming} » : ${bad.join(', ')}`);
  if (list.length < 2) throw new Error('il faut au moins deux crans');
  const { stepList, ...rest } = spec;

  if (spec.naming === 'grid') {
    const extra = list.filter(n => !REFERENCE_STEPS.includes(n));
    return {
      ...rest, steps: REFERENCE_STEPS, seedStep: REFERENCE_SEED,
      extraSteps: [...new Set([...(spec.extraSteps || []), ...extra])],
      ramps: extra.length ? spec.ramps.map(r => ({ ...r, extraSteps: true })) : spec.ramps,
      emitSteps: list.length === REFERENCE_STEPS.length && list.every(n => REFERENCE_STEPS.includes(n)) ? null : list,
    };
  }
  if (spec.naming === 'rank') {
    // l'ordre donné est l'ordre de clarté : du plus clair au plus foncé
    const seedStep = list.includes('500') ? '500' : list[Math.floor((list.length - 1) / 2)];
    return { ...rest, steps: list, seedStep, rankUnit: null };
  }
  // par contraste : chaque cran a le shade que son nom lui donne, du plus clair au plus foncé
  const steps = list.slice().sort((a, b) => N.toShade(b) - N.toShade(a));
  const shade = steps.map(n => N.toShade(+n));
  const seedStep = steps.includes(N.seed) ? N.seed
    : steps.reduce((a, b) => (Math.abs(N.toShade(+b) - 100) < Math.abs(N.toShade(+a) - 100) ? b : a));
  // un rang virtuel par grain de nom : 5 unités de shade dans les deux nomenclatures
  const per = Math.abs(N.toShade(N.grain) - N.toShade(0));
  return {
    ...rest, steps, seedStep,
    ladders: { ...(spec.ladders || {}), shadeLadder: shade },
    rankPositions: shade.map(s => Math.round((200 - s) / per)),
    ruleLadder: Array.from({ length: Math.round(200 / per) + 1 }, (_, k) => 200 - k * per),
    rankUnit: { grain: N.grain, per },
  };
}

/**
 * La règle, dans l'unité de la nomenclature : « 6 rangs » pour une nomenclature par rang ou
 * par grille, « Δ 525 » quand le nom encode le contraste. `gap(k)` rend l'écart à écrire
 * pour k rangs de la règle.
 */
export function ruleWords(rules, lang = 'fr') {
  const g = rules.grain;
  const fr = lang !== 'en';
  const gap = k => (g ? 'Δ ' + k * g : k + (fr ? (k > 1 ? ' rangs' : ' rang') : (k > 1 ? ' ranks' : ' rank')));
  return { gap, ui: gap(rules.rankForUI), aa: gap(rules.rankForAA), aaa: gap(rules.rankForAAA),
    unit: g ? (fr ? 'd\'écart entre les noms' : 'name gap') : (fr ? 'd\'écart de rang' : 'rank gap') };
}
