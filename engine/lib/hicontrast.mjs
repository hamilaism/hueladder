// Le mode contraste élevé (`prefers-contrast: more`) : les mêmes noms, les mêmes teintes, des
// encres plus franches. Sur l'axe du contraste en progression logarithmique face au fond (le
// shade de Fusilier en clair, son équivalent face au fond sombre), les crans du côté de l'encre
// s'éloignent du milieu, d'autant plus qu'ils en étaient proches ; les fonds ne bougent pas.
// Aucun contraste face au fond ne baisse, et toute règle écrite pour le mode normal
// (N rangs ⇒ AA) tient encore — avec de la marge.

import { relativeLuminance, hexToOklch } from './color.mjs';
import { solveAtLuminance } from './tune.mjs';

const LOG21 = Math.log(21);

function stretchScale(scale, bg, stretch) {
  const k = relativeLuminance(bg) + 0.05, budget = 1.05 / k;
  const lightBg = relativeLuminance(bg) > 0.5;
  return scale.map(hex => {
    if (!hex) return hex;
    const y = relativeLuminance(hex);
    // la position du cran sur l'échelle de ce fond, de 0 (le fond) à 1 (l'extrême opposé)
    const c = lightBg ? (k / (y + 0.05)) : ((y + 0.05) / k);
    const top = lightBg ? 21 * (k / 1.05) : budget;
    const s = Math.min(1, Math.log(Math.max(1, c)) / Math.log(top));
    // seul le côté de l'encre s'écarte (les crans plus contrastés que le milieu face au fond :
    // textes, icônes) ; les fonds ne bougent pas. Aucun contraste face au fond ne baisse, les
    // bouts restent les bouts, et l'ordre est strictement gardé
    const d = s - 0.5, s2 = d <= 0 ? s : 0.5 + 0.5 * Math.pow(2 * d, 1 / stretch);
    const c2 = Math.pow(top, s2);
    const y2 = lightBg ? k / c2 - 0.05 : c2 * k - 0.05;
    const { C, H } = hexToOklch(hex);
    return solveAtLuminance(Math.min(1, Math.max(0, y2)), C, H).hex;
  });
}

/** Le mode contraste élevé d'un système, en clair (face au blanc) et en sombre (face au fond). */
export function highContrastMode(data, { stretch = 1.25, method = data.meta.coreMethod } = {}) {
  const real = data.ramps.filter(r => !r.derived);
  const light = Object.fromEntries(real.map(r => [r.name, stretchScale(r.colors[method], data.meta.lightBackground || '#ffffff', stretch)]));
  const dark = data.meta.dark ? Object.fromEntries(real.map(r => [r.name, stretchScale(r.darkColors[method], data.meta.dark.background, stretch)])) : null;
  return { key: 'high-contrast', stretch, light, dark };
}
