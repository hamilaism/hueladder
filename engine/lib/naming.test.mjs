// node lib/naming.test.mjs — ce que chaque nomenclature promet quand on ajoute ou retire un cran.
import assert from 'node:assert/strict';
import { buildData } from './build.mjs';
import { applyNaming, NAMINGS, ruleWords } from './naming.mjs';
import { contractChecks } from './contract.mjs';

const ramps = ['#2f5bd3', '#079455', '#6b6f78'].map((h, i) => ({ name: 'r' + i, label: 'r' + i, kind: i === 2 ? 'neutral' : 'product', anchors: { default: h } }));
const build = (naming, stepList, dark = true) => buildData(applyNaming({ id: 't', brand: 't', naming, stepList, ramps, ...(dark ? { darkMode: { background: '#121212' } } : {}) }));
const scale = (d, mode = 'colors') => Object.fromEntries(d.meta.steps.map((st, i) => [st, d.ramps[0][mode][d.meta.coreMethod][i]]));

// chaque préréglage passe le contrat (le fond #121212 ne peut pas porter le 975 : attendu)
for (const [naming, N] of Object.entries(NAMINGS)) {
  for (const [p, list] of Object.entries(N.presets)) {
    const fails = contractChecks(build(naming, list)).filter(c => !c.pass).map(c => c.label);
    const expected = naming === 'hundreds' && p === 'quarter' ? ['règle du nom sombre', 'budget de contraste'] : [];
    assert.deepEqual(fails, expected, `${naming}/${p} : ${fails.join(', ')}`);
  }
}

// par contraste : ajouter un cran ne déplace aucun autre, en clair comme en sombre
for (const [naming, a, b] of [['hundreds', ['100', '500', '900'], ['100', '350', '500', '725', '900']], ['shade', ['150', '100', '50'], ['185', '150', '105', '100', '50']]]) {
  const d1 = build(naming, a), d2 = build(naming, b);
  for (const mode of ['colors', 'darkColors']) {
    const s1 = scale(d1, mode), s2 = scale(d2, mode);
    for (const k of a) assert.equal(s2[k], s1[k], `${naming} : ajouter des crans déplace le ${k} (${mode})`);
  }
}
// par rang : c'est la nature même de la nomenclature, tout se répartit à nouveau
{
  const s1 = scale(build('rank', ['1', '2', '3'], false)), s2 = scale(build('rank', ['1', '2', '3', '4'], false));
  assert.ok(['1', '2', '3'].some(k => s1[k] !== s2[k]), 'rank : ajouter un cran doit répartir les autres');
}

// les règles, dans l'unité de la nomenclature : le nom fixe le contraste, avec la marge de 4 %
assert.equal(ruleWords(build('hundreds', ['100', '900']).rules).aa, 'Δ 525');
assert.equal(ruleWords(build('shade', ['150', '50']).rules).aa, 'Δ 105');
assert.equal(ruleWords(build('grid', NAMINGS.grid.presets.standard).rules).aa, '6 rangs');
// et elles tiennent sur les couleurs livrées : 100 et 625 (Δ 525) passent AA sur toutes les teintes
{
  const d = build('hundreds', ['100', '625']);
  for (const r of d.ramps) {
    const c = r.colors[d.meta.coreMethod];
    const { contrast } = await import('./color.mjs');
    assert.ok(contrast(c[0], c[1]) >= 4.5, `${r.name} 100/625 sous AA`);
  }
}

// les noms invalides sont refusés, clairement
assert.throws(() => applyNaming({ naming: 'hundreds', stepList: ['100', '130'], ramps }), /130/);
assert.throws(() => applyNaming({ naming: 'shade', stepList: ['250', '100'], ramps }), /250/);
assert.throws(() => applyNaming({ naming: 'nope', stepList: ['1', '2'], ramps }), /inconnue/);
console.log('nomenclatures : ok');
