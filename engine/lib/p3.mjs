// La sortie Display P3 : rendre l'éclat que sRGB a dû couper. Une méthode garde la chroma du
// seed tant que le gamut sRGB la tient, puis la réduit aux extrémités de l'échelle ; un écran
// P3 tient davantage. Pour chaque cran écrêté, on reprend la chroma voulue (celle du seed),
// bornée à 96 % de ce que P3 tient à cette luminance — même luminance Y, donc même contraste.
// Les crans qui n'étaient pas écrêtés ne changent pas.

import { lchToLab, oklabToLinear, hexToOklch, relativeLuminance, linearToSrgb } from './color.mjs';

// sRGB linéaire → XYZ (D65) → Display P3 linéaire
const M = [[0.4123908, 0.3575843, 0.1804808], [0.212639, 0.7151687, 0.0721923], [0.0193308, 0.1191948, 0.9505322]];
const P = [[2.4934969, -0.9313836, -0.4027108], [-0.829489, 1.7626641, 0.0236247], [0.0358458, -0.0761724, 0.9568845]];
const mul = (m, v) => m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

function linearP3(L, C, H) {
  const { r, g, b } = oklabToLinear(lchToLab({ L, C, H }));
  return { p3: mul(P, mul(M, [r, g, b])), y: 0.2126 * r + 0.7152 * g + 0.0722 * b };
}
const inP3 = v => v.every(x => x >= -1e-5 && x <= 1 + 1e-5);

// la clarté qui donne la luminance voulue, à chroma et teinte données (Y croît avec L)
function solveL(targetY, C, H) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (linearP3(m, C, H).y < targetY) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** La chroma maximale que Display P3 tient à luminance et teinte données. */
export function maxChromaP3(targetY, H) {
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 24; i++) { const c = (lo + hi) / 2; if (inP3(linearP3(solveL(targetY, c, H), c, H).p3)) lo = c; else hi = c; }
  return lo;
}

const css = v => 'color(display-p3 ' + v.map(x => (Math.round(Math.min(1, Math.max(0, linearToSrgb(Math.max(0, x)))) * 10000) / 10000)).join(' ') + ')';

/**
 * Les couleurs P3 d'une rampe, cran par cran : `null` quand le cran ne change pas (il n'était
 * pas écrêté), sinon la couleur `color(display-p3 …)`, ses composantes et le gain de chroma.
 */
export function p3Scale(scale, seed, { ceiling = 0.96 } = {}) {
  const want = seed ? hexToOklch(seed).C : 0;
  return scale.map(hex => {
    if (!hex || want < 0.03) return null;
    const { C, H } = hexToOklch(hex);
    if (C >= want - 0.002) return null;
    const y = relativeLuminance(hex);
    const c = Math.min(want, maxChromaP3(y, H) * ceiling);
    if (c <= C + 0.002) return null;
    const L = solveL(y, c, H), { p3 } = linearP3(L, c, H);
    return { css: css(p3), components: p3.map(x => Math.round(Math.min(1, Math.max(0, linearToSrgb(Math.max(0, x)))) * 10000) / 10000), gain: Math.round((c / C) * 100) / 100 };
  });
}

/** Les variables CSS P3, sous `@media (color-gamut: p3)` : seulement les crans qui y gagnent. */
export function p3Css(spec, data, mode = 'light') {
  const core = data.meta.coreMethod, lines = [];
  for (const r of data.ramps.filter(x => !x.derived)) {
    const src = mode === 'dark' ? r.darkColors && r.darkColors[core] : r.colors[core];
    if (!src || r.kind === 'neutral') continue;
    p3Scale(src, r.seed).forEach((v, i) => { if (v) lines.push(`    --color-${r.name}-${data.meta.steps[i]}: ${v.css};`); });
  }
  return lines;
}
