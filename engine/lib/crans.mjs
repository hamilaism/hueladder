// Les jeux de crans proposés à l'utilisateur.
//
// Tous reposent sur la même grille de référence, 50 → 950 ancrée à 500. Un préréglage ne
// fait que deux choses : ajouter des crans intermédiaires (hors grille, interpolés par leur
// nom entre leurs voisins) ou n'en livrer qu'une partie. Conséquence voulue : un 300 est la
// même couleur quel que soit le préréglage, et passer de « Standard » à « Maxi » ne déplace
// aucune couleur déjà livrée.

export const REFERENCE_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
export const REFERENCE_SEED = '500';

const FIFTIES = ['150', '250', '350', '450', '550', '650', '750', '850'];

export const STEP_PRESETS = {
  maxi: {
    label: 'Maxi',
    hint: 'toutes les cinquantaines et les extrêmes 25, 75, 925, 975',
    extra: ['25', '75', ...FIFTIES, '925', '975'],
  },
  standard: { label: 'Standard', hint: '50, 100 → 900, 950' },
  centaines: { label: 'Centaines', hint: '100 → 900', emit: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
  impairs: { label: 'Impairs', hint: '100, 300, 500, 700, 900', emit: ['100', '300', '500', '700', '900'] },
  mini: { label: 'Mini', hint: '200, 500, 800', emit: ['200', '500', '800'] },
};

/**
 * Déplie `spec.crans` en clés que le moteur connaît : `steps`, `seedStep`, `extraSteps`
 * (déclarés sur chaque nuancier) et `emitSteps`, la liste des crans livrés.
 * Une spec sans `crans` est rendue telle quelle : les specs écrites à la main gardent la main.
 */
export function applyStepPreset(spec) {
  if (!spec.crans) return spec;
  const preset = STEP_PRESETS[spec.crans];
  if (!preset) throw new Error(`crans "${spec.crans}" inconnu — attendu : ${Object.keys(STEP_PRESETS).join(', ')}`);
  const extra = preset.extra || [];
  return {
    ...spec,
    steps: REFERENCE_STEPS,
    seedStep: REFERENCE_SEED,
    extraSteps: [...new Set([...(spec.extraSteps || []), ...extra])],
    ramps: extra.length ? spec.ramps.map(r => ({ ...r, extraSteps: true })) : spec.ramps,
    emitSteps: preset.emit || null,
  };
}
