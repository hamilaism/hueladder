// node lib/crans.test.mjs — un cran garde sa couleur quel que soit le préréglage.
import assert from 'node:assert/strict';
import { buildData } from './build.mjs';
import { applyStepPreset, STEP_PRESETS, REFERENCE_STEPS } from './crans.mjs';

const spec = {
  id: 't', brand: 'T', crans: 'standard',
  ramps: [
    { name: 'brand', label: 'Brand', kind: 'brand', anchors: { default: '#2f5bd3' } },
    { name: 'neutral', label: 'Neutral', kind: 'neutral', anchors: { default: '#6b6f78' } },
  ],
};
const scaleOf = (s, ramp) => {
  const d = buildData(applyStepPreset(s));
  const r = d.ramps.find(x => x.name === ramp);
  return Object.fromEntries(d.meta.steps.map((st, i) => [st, r.colors[d.meta.coreMethod][i]]));
};

const ref = scaleOf(spec, 'brand');
for (const key of Object.keys(STEP_PRESETS)) {
  const got = scaleOf({ ...spec, crans: key }, 'brand');
  for (const st of REFERENCE_STEPS) assert.equal(got[st], ref[st], `${key} déplace le ${st}`);
  const expanded = applyStepPreset({ ...spec, crans: key });
  for (const st of expanded.emitSteps || []) assert.ok(st in got, `${key} livre ${st} sans le calculer`);
}

const maxi = scaleOf({ ...spec, crans: 'maxi' }, 'brand');
assert.equal(Object.keys(maxi).length, 23);
// l'ordre de clarté tient, cinquantaines comprises : chaque cran est plus foncé que le précédent
const order = Object.keys(maxi).sort((a, b) => a - b);
const Y = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
order.slice(1).forEach((st, i) => assert.ok(Y(maxi[st]) < Y(maxi[order[i]]), `${st} n'est pas plus foncé que ${order[i]}`));

// en sombre aussi, y compris avec le profil vif : le profil se lit sur la grille, pas sur la liste
for (const chromaProfile of [undefined, 'bell']) {
  const dspec = { ...spec, darkMode: { background: '#121212', ...(chromaProfile ? { chromaProfile } : {}) } };
  const darkOf = s2 => { const d = buildData(applyStepPreset(s2)); const r = d.ramps.find(x => x.name === 'brand');
    return Object.fromEntries(d.meta.steps.map((st, i) => [st, r.darkColors[d.meta.coreMethod][i]])); };
  const dref = darkOf(dspec);
  for (const key of Object.keys(STEP_PRESETS)) {
    const got = darkOf({ ...dspec, crans: key });
    for (const st of REFERENCE_STEPS) assert.equal(got[st], dref[st], `${key} déplace le ${st} sombre (${chromaProfile || 'aligné'})`);
  }
}

assert.throws(() => applyStepPreset({ ...spec, crans: 'nope' }), /inconnu/);
console.log('crans : ok');
