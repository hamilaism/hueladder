// Les daltonismes : simuler (Machado, Oliveira et Fernandes 2009, sévérité maximale), mesurer
// ce qui reste distinguable entre familles, et dériver des modes daltoniens qui ne cassent
// rien. Le verrou de luminance de Hueladder s'applique tel quel : une couleur d'un mode daltonien
// garde la luminance Y de sa couleur d'origine, seules sa teinte (et sa chroma, si le gamut
// l'exige) bougent. Contrastes et interchangeabilité restent donc identiques par construction.

import { hexToRgb, rgbToHex, srgbToLinear, linearToSrgb, hexToOklch, relativeLuminance, linearToOklab } from './color.mjs';
import { solveAtLuminance } from './tune.mjs';

// matrices de Machado 2009, sévérité 1, sur le RGB linéaire
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
export const VISIONS = ['normal', 'protan', 'deutan', 'tritan'];
// un mode par axe perdu : le rouge-vert (protanopie et deutéranopie ensemble), le bleu-jaune
export const CVD_MODES = { 'protan-deutan': ['protan', 'deutan'], tritan: ['tritan'] };

const clamp01 = v => Math.min(1, Math.max(0, v));
const lin = hex => { const { r, g, b } = hexToRgb(hex); return [r, g, b].map(srgbToLinear); };

/** La couleur telle qu'une personne daltonienne la voit (vision `normal` : inchangée). */
export function simulate(hex, vision) {
  if (vision === 'normal') return hex;
  const M = MACHADO[vision], c = lin(hex);
  const out = M.map(row => clamp01(row[0] * c[0] + row[1] * c[1] + row[2] * c[2]));
  return rgbToHex({ r: linearToSrgb(out[0]), g: linearToSrgb(out[1]), b: linearToSrgb(out[2]) });
}

/** Distance perçue entre deux couleurs, en OKLab × 100 : sous 5, deux aplats se confondent. */
export function distance(a, b, vision = 'normal') {
  const ok = hex => { const [r, g, b] = lin(hex); return linearToOklab({ r, g, b }); };
  const p = ok(simulate(a, vision)), q = ok(simulate(b, vision));
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b) * 100;
}

/** La plus petite distance entre deux couleurs d'une liste, et la paire qui la porte. */
function closest(items, visions) {
  let best = { d: Infinity, a: null, b: null };
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const d = Math.min(...visions.map(v => distance(items[i].hex, items[j].hex, v)));
    if (d < best.d) best = { d, a: items[i].name, b: items[j].name };
  }
  return best;
}

/**
 * Ce qui reste distinguable entre familles, au cran d'ancrage, pour chaque vision : la plus
 * petite distance et la paire qui la porte. C'est la mesure qui dit si une erreur et une
 * réussite restent séparables pour une personne sur douze.
 */
export function distinguishability(data, { index = data.meta.seedIndex, method = data.meta.coreMethod } = {}) {
  const i = index;
  const items = data.ramps.filter(r => !r.derived && r.kind !== 'neutral').map(r => ({ name: r.name, hex: r.colors[method]?.[i] })).filter(x => x.hex);
  return Object.fromEntries(VISIONS.map(v => {
    const c = closest(items, [v]);
    return [v, { min: items.length > 1 ? Math.round(c.d * 10) / 10 : null, pair: c.a ? [c.a, c.b] : null }];
  }));
}

// une rampe tournée en teinte, à luminance verrouillée cran par cran
const rotate = (scale, deg) => scale.map(hex => {
  if (!hex || !deg) return hex;
  const { C, H } = hexToOklch(hex);
  if (C < 0.02) return hex;
  return solveAtLuminance(relativeLuminance(hex), C, (H + deg + 360) % 360).hex;
});

/**
 * Les modes daltoniens d'un système. Pour chaque mode, on cherche la rotation de teinte de
 * chaque famille de statut (`kind: system`) qui écarte le plus les couleurs à sens sous les
 * visions de ce mode (descente coordonnée sur ±60°, pas de 5°) ; « ne pas bouger » reste une
 * option. Les autres familles ne changent pas. Rien ne change de luminance.
 */
export function cvdModes(data, modes = Object.keys(CVD_MODES), { method = data.meta.coreMethod, range = 60, stepDeg = 5 } = {}) {
  const i = data.meta.seedIndex;
  const real = data.ramps.filter(r => !r.derived);
  const meaning = real.filter(r => r.kind === 'system');
  const anchor = real.filter(r => r.kind !== 'neutral').map(r => ({ name: r.name, hex: r.colors[method][i] })).filter(x => x.hex);
  return modes.filter(m => CVD_MODES[m]).map(key => {
    const visions = CVD_MODES[key];
    const shift = Object.fromEntries(meaning.map(r => [r.name, 0]));
    const score = () => {
      const items = anchor.map(a => (a.name in shift ? { name: a.name, hex: rotate([a.hex], shift[a.name])[0] } : a));
      // ce qui compte, ce sont les paires où une couleur à sens est en jeu
      let best = Infinity;
      for (const s of items.filter(x => x.name in shift)) for (const o of items) if (o !== s) best = Math.min(best, ...visions.map(v => distance(s.hex, o.hex, v)));
      return best;
    };
    const before = score();
    if (meaning.length) {
      for (let pass = 0; pass < 3; pass++) {
        for (const r of meaning) {
          let bestDeg = shift[r.name], bestScore = score();
          for (let d = -range; d <= range; d += stepDeg) {
            shift[r.name] = d;
            const sc = score();
            // à 0,2 près, on préfère bouger le moins possible
            if (sc > bestScore + 0.2 || (Math.abs(sc - bestScore) <= 0.2 && Math.abs(d) < Math.abs(bestDeg))) { bestScore = sc; bestDeg = d; }
          }
          shift[r.name] = bestDeg;
        }
      }
    }
    const light = Object.fromEntries(real.map(r => [r.name, r.name in shift ? rotate(r.colors[method], shift[r.name]) : r.colors[method]]));
    const dark = data.meta.dark ? Object.fromEntries(real.map(r => [r.name, r.name in shift ? rotate(r.darkColors[method], shift[r.name]) : r.darkColors[method]])) : null;
    return { key, visions, shift, before: Math.round(before * 10) / 10, after: Math.round(score() * 10) / 10, light, dark };
  });
}
