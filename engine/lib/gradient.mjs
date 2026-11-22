// Les dégradés comme objets de la spec : un départ, un milieu (souvent la couleur d'offre), une
// arrivée. On mesure la longueur perceptuelle de chaque moitié (distance OKLab) et leur
// asymétrie (×1,00 : équilibré ; au-delà de ×2, une moitié paraît nettement plus courte), et on
// propose une normalisation qui égalise les deux moitiés à une amplitude cible en gardant la
// direction de chaque extrémité — le mouvement de teinte et de clarté voulu par le designer.
//
// Les extrémités se déclarent, elles ne se calculent pas : un écart fixe de ±30° en HSL inverse
// le sens du dégradé sur la plupart des teintes.

import { hexToRgb, srgbToLinear, linearToOklab, oklabToLinear, linearToRgb, rgbToHex, oklchToHex } from './color.mjs';

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const lab = hex => { const { r, g, b } = hexToRgb(hex); return linearToOklab({ r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) }); };
const dist = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

// le point à `len` du milieu, dans la direction de l'extrémité ; hors du gamut, on réduit la
// chroma à clarté et teinte constantes (comme partout dans le moteur), sans raccourcir la moitié
function along(mid, end, len) {
  const d = dist(mid, end);
  if (d < 1e-6) return toHex(end);
  const k = len / d;
  const p = { L: mid.L + (end.L - mid.L) * k, a: mid.a + (end.a - mid.a) * k, b: mid.b + (end.b - mid.b) * k };
  return oklchToHex(p.L, Math.hypot(p.a, p.b), (Math.atan2(p.b, p.a) * 180 / Math.PI + 360) % 360);
}
const toHex = p => rgbToHex(linearToRgb(oklabToLinear(p)));

/** Une mesure et sa normalisation, pour un dégradé `{ name, stops: [départ, milieu, arrivée] }`. */
export function measureGradient(g, { target = null } = {}) {
  const [a, m, b] = g.stops.map(lab);
  const halves = [dist(m, a), dist(m, b)];
  const asym = Math.max(...halves) / Math.max(1e-6, Math.min(...halves));
  // par défaut, la moyenne des deux moitiés : on égalise sans allonger ni raccourcir le tout
  const amp = target ?? (halves[0] + halves[1]) / 2;
  const na = along(m, a, amp), nb = along(m, b, amp);
  const nh = [dist(m, lab(na)), dist(m, lab(nb))];
  return {
    name: g.name, stops: g.stops, halves: halves.map(h => round(h)), asymmetry: round(asym, 2),
    normalized: { target: round(amp), stops: [na, g.stops[1], nb], halves: nh.map(h => round(h)), asymmetry: round(Math.max(...nh) / Math.max(1e-6, Math.min(...nh)), 2) },
  };
}

/** Les dégradés de la spec, mesurés ; `normalize: true` livre la version égalisée. */
export function gradients(spec) {
  return (spec.gradients || []).filter(g => Array.isArray(g.stops) && g.stops.length === 3)
    .map(g => ({ ...measureGradient(g, { target: g.target ?? spec.gradientTarget ?? null }), use: g.normalize ? 'normalized' : 'declared' }));
}

/** Les tokens d'arrêt (DTCG `gradient`) et les variables CSS, interpolés en OKLab. */
export function gradientOutputs(list) {
  const stopsOf = g => (g.use === 'normalized' ? g.normalized.stops : g.stops);
  const tokens = { gradient: Object.fromEntries(list.map(g => [g.name, {
    $type: 'gradient',
    $value: stopsOf(g).map((c, i) => ({ color: c, position: i / 2 })),
    $description: `asymétrie ×${g.use === 'normalized' ? g.normalized.asymmetry : g.asymmetry}`,
  }])) };
  const css = ':root {\n' + list.map(g => `  --gradient-${g.name}: linear-gradient(in oklab 90deg, ${stopsOf(g).join(', ')});`).join('\n') + '\n}\n';
  return { tokens, css };
}
