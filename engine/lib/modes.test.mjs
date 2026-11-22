// node lib/modes.test.mjs — modes daltoniens, dataviz et dégradés : rien ne casse le verrou.
import assert from 'node:assert/strict';
import { buildData } from './build.mjs';
import { applyNaming } from './naming.mjs';
import { relativeLuminance, contrast } from './color.mjs';
import { simulate, distance } from './cvd.mjs';
import { measureGradient } from './gradient.mjs';
import { packageFiles } from './package.mjs';
import { verifyTokens } from './audit.mjs';

const spec = applyNaming({
  id: 'm', brand: 'M', naming: 'grid', stepList: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
  darkMode: { background: '#121212' }, cvdModes: true, dataviz: true,
  gradients: [{ name: 'offre', stops: ['#0ddad4', '#0c8aff', '#006eff'], normalize: true, target: 0.11 }],
  ramps: [
    { name: 'brand', kind: 'brand', anchors: { default: '#d63b2f' } },
    { name: 'ocean', kind: 'product', anchors: { default: '#2f6fe4' } },
    { name: 'leaf', kind: 'product', anchors: { default: '#2e9e52' } },
    { name: 'plum', kind: 'product', anchors: { default: '#8e44ad' } },
    { name: 'error', kind: 'system', anchors: { default: '#d9342b' } },
    { name: 'success', kind: 'system', anchors: { default: '#2e9e52' } },
    { name: 'slate', kind: 'neutral', anchors: { default: '#6b6f78' } },
  ],
});
const d = buildData(spec), core = d.meta.coreMethod;

// simulation : le rouge et le vert se rapprochent sous une protanopie
assert.ok(distance('#d9342b', '#2e9e52', 'protan') < distance('#d9342b', '#2e9e52', 'normal'));
assert.equal(simulate('#808080', 'tritan'), simulate('#808080', 'tritan'));

// modes daltoniens : la luminance de chaque couleur est gardée, et l'écart ne se dégrade jamais
assert.equal(d.cvd.length, 2);
for (const m of d.cvd) {
  assert.ok(m.after >= m.before, m.key + ' : l\'écart minimal ne baisse pas');
  for (const r of d.ramps.filter(x => !x.derived)) r.colors[core].forEach((h, i) => {
    if (!h) return;
    const k = m.light[r.name][i];
    assert.ok(Math.abs(contrast(k, '#ffffff') / contrast(h, '#ffffff') - 1) < 0.01, `${m.key} ${r.name}/${d.meta.steps[i]} : contraste gardé`);
  });
}
const files = Object.fromEntries(packageFiles(spec, d, {}));
for (const mode of ['light-protan-deutan', 'light-tritan', 'dark-protan-deutan', 'dark-tritan']) {
  const txt = files[`m-colors/code/tokens/m.${mode}.tokens.json`];
  assert.ok(txt, mode + ' livré');
  const checks = verifyTokens(txt, { mode: mode.startsWith('dark') ? 'dark' : 'light', background: mode.startsWith('dark') ? '#121212' : '#ffffff', expect: d.rules.rankForAA });
  assert.ok(checks.every(c => c.pass), mode + ' : ' + JSON.stringify(checks.filter(c => !c.pass)));
}

// dataviz : des crans existants, 3:1 sur les deux fonds, au plus deux par famille, pas de statut
const dv = d.dataviz;
assert.ok(dv.categorical.length >= 5);
for (const c of dv.categorical.filter(x => !x.other)) {
  assert.ok(contrast(c.hex, '#ffffff') >= 3 && contrast(c.dark, '#121212') >= 3, `${c.family}/${c.step} : 3:1 dans les deux thèmes`);
  assert.ok(!['error', 'success'].includes(c.family), 'une couleur à sens ne colore pas des séries ordinaires');
}
assert.ok(Object.values(dv.categorical.reduce((m, c) => ((m[c.family] = (m[c.family] || 0) + 1), m), {})).every(n => n <= 2));
assert.ok(dv.minGap.light > 0 && files['m-colors/code/dataviz.css'].includes('var(--color-'));

// dégradés : la mesure d'origine, puis deux moitiés égales en gardant la direction
const g = measureGradient({ name: 'x', stops: ['#0ddad4', '#0c8aff', '#006eff'] }, { target: 0.11 });
assert.deepEqual(g.halves, [0.247, 0.07]);
assert.equal(g.asymmetry, 3.51);
assert.ok(Math.abs(g.normalized.halves[0] - 0.11) < 0.003 && Math.abs(g.normalized.halves[1] - 0.11) < 0.003);
assert.ok(files['m-colors/code/gradients.css'].includes('--gradient-offre') && JSON.parse(files['m-colors/code/tokens/m.gradients.tokens.json']).gradient.offre.$type === 'gradient');

console.log('modes : ok');
