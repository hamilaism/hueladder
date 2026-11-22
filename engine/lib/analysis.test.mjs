/**
 * Tests de hueProximity (./analysis.mjs) sur des nuanciers synthétiques.
 *
 * Run with:  node analysis.test.mjs
 */

import { hueProximity } from './analysis.mjs';
import { oklchToHex, hexToOklch } from './color.mjs';

let checks = 0, failures = 0;
function assertTrue(label, cond, detail = '') {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${label} ${detail}`); }
}

const L = [0.93, 0.8, 0.65, 0.5, 0.38, 0.25];
const ramp = (name, H, C, kind = 'product') => {
  const colors = L.map(l => oklchToHex(l, C, H));
  const seed = colors[3];
  const o = hexToOklch(seed);
  return { name, kind, derived: false, hue: o.H, chroma: o.C, seed, colors: { m: colors } };
};

const ramps = [
  ramp('blue', 264, 0.12),
  ramp('sky', 266, 0.11),          // même teinte, même saturation : factorisable
  ramp('dull', 262, 0.04 + 0.02),    // même teinte, saturation < 60 % : fausse proximité
  ramp('red', 30, 0.15),             // loin sur la roue : hors paires
  ramp('grey', 264, 0.12, 'neutral'),// neutre : exclu quelle que soit sa teinte
];
const P = hueProximity(ramps, { coreMethod: 'm' });
const find = (a, b) => P.pairs.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));

assertTrue('blue ~ sky factorisable', find('blue', 'sky')?.verdict === 'factorisable', JSON.stringify(find('blue', 'sky')));
assertTrue('blue ~ dull fausse proximité', find('blue', 'dull')?.verdict === 'saturation', JSON.stringify(find('blue', 'dull')));
assertTrue('red hors paires', !P.pairs.some(p => p.a === 'red' || p.b === 'red'));
assertTrue('neutre exclu', !P.pairs.some(p => p.a === 'grey' || p.b === 'grey'));
assertTrue('factorisables en tête', P.pairs[0].verdict === 'factorisable');
assertTrue('compte factorisable', P.factorisable === 1, String(P.factorisable));

const wide = hueProximity([ramp('a', 250, 0.12), ramp('b', 268, 0.12)], { coreMethod: 'm' });
assertTrue('18° d\'écart : hors paires au seuil par défaut', wide.pairs.length === 0);

console.log(`${checks - failures}/${checks} assertions passed`);
if (failures > 0) { console.error(`\n${failures} assertion(s) FAILED`); process.exit(1); }
console.log('ALL TESTS PASSED');
