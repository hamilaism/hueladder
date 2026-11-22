// node lib/options.test.mjs — les options de la 1.1 : chacune fait ce qu'elle dit, et le dit.
import assert from 'node:assert/strict';
import { buildData } from './build.mjs';
import { applyNaming } from './naming.mjs';
import { contractChecks } from './contract.mjs';
import { contrast } from './color.mjs';
import { proposeGrouping } from './diagnose.mjs';
import { readSource } from './audit.mjs';
import { usageGuide } from './outputs.mjs';
import { p3Scale } from './p3.mjs';
import { relativeLuminance } from './color.mjs';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const spec = extra => applyNaming({ id: 't', brand: 'T', naming: 'grid', stepList: STEPS,
  ramps: [{ name: 'b', kind: 'brand', anchors: { default: '#3b6fd6' } }, { name: 'g', kind: 'product', anchors: { default: '#2e9e52' } }, { name: 's', kind: 'neutral', anchors: { default: '#6b6f78' } }], ...extra });
const fails = d => contractChecks(d, '', { lang: 'fr' }).filter(c => !c.pass).map(c => c.label);

// le haut du sombre : rien ne bouge s'il tient sous le budget ; le plafond anti-halo se paie, et le contrat le dit
const plain = buildData(spec({ darkMode: { background: '#0d0d0f' } }));
const spread = buildData(spec({ darkMode: { background: '#0d0d0f', spreadTop: true } }));
assert.deepEqual(spread.ramps[0].darkColors.fusilier, plain.ramps[0].darkColors.fusilier, 'en deux morceaux : sans effet quand le haut tient');
const halo = buildData(spec({ darkMode: { background: '#0d0d0f', haloCap: true } }));
const top = halo.ramps[2].darkColors.fusilier.filter(Boolean).map(h => contrast(h, '#0d0d0f'));
assert.ok(Math.max(...top) <= 14.05, 'aucun cran au-delà de 14:1 sous le plafond anti-halo');
assert.ok(top.every((c, i) => !i || c > top[i - 1]), 'et l\'ordre est gardé');
assert.ok(fails(halo).some(l => /règle du nom sombre/.test(l)), 'le plafond coûte la règle en sombre : le contrat le dit');

// la norme APCA : une règle en Lc, dans les deux modes
const apca = contractChecks(buildData(spec({ contract: { norm: 'apca' }, darkMode: { background: '#121212' } })), '', { lang: 'fr' }).filter(c => /APCA/.test(c.label));
assert.equal(apca.length, 2);

// le contraste élevé : aucun contraste face au fond ne baisse, les encres montent
const hc = buildData(spec({ highContrast: true }));
hc.ramps.filter(r => !r.derived).forEach(r => r.colors.fusilier.forEach((h, i) => {
  if (!h) return;
  assert.ok(contrast(hc.highContrast.light[r.name][i], '#ffffff') >= contrast(h, '#ffffff') - 0.02, `${r.name}/${STEPS[i]} ne baisse pas`);
}));
assert.ok(contrast(hc.highContrast.light.b[8], '#ffffff') > contrast(hc.ramps[0].colors.fusilier[8], '#ffffff') + 0.5, 'l\'encre 800 monte');
assert.ok(/prefers-contrast/.test(usageGuide(spec({ highContrast: true }), hc)));

// le panachage : la marque garde ses couleurs, le reste est régénéré, et le contrat juge le mélange
const kept = buildData(applyNaming({ id: 't', brand: 'T', naming: 'grid', stepList: STEPS, pinDefault: false,
  ramps: [{ name: 'brand', kind: 'brand', method: 'anchored', anchors: { 500: '#e53e3e', 900: '#4a1414' } }, { name: 'info', kind: 'system', anchors: { default: '#1c64f2' } }] }));
assert.ok(kept.ramps[0].colors.fusilier.includes('#e53e3e') && kept.ramps[0].colors.fusilier.includes('#4a1414'), 'la marque est gardée telle quelle');
assert.equal(kept.ramps[0].methodOverride, 'anchored');

// le regroupement : doublons fusionnés, une couleur vive hors famille devient sa propre famille
const src = readSource('--blue-100: #e6efff;\n--blue-500: #2563eb;\n--blue-900: #0d1d45;\n--azure-100: #e5eeff;\n--azure-500: #2664ea;\n--azure-900: #0e1e46;\n--blue-300: #f5a000;\n--slate-500: #6b6f78;', { name: 'x' });
const g = proposeGrouping(buildData(applyNaming(src.spec)), src.spec.ramps);
assert.deepEqual(g.ramps.map(r => r.name).sort(), ['blue', 'orange', 'slate']);
assert.ok(g.steps.some(s => s.kind === 'merge' && s.from === 'azure') && g.steps.some(s => s.kind === 'split' && s.hex === '#f5a000'));

// les usages ajoutés : lien (G183) et focus (2.4.13)
const u = buildData(spec({})).usages.map(x => x.ref);
assert.ok(u.includes('G183 · 1.4.1') && u.some(r => /2\.4\.13/.test(r)));

// la dispersion se juge contre le plancher sRGB du cran
assert.ok(/plancher sRGB/.test(contractChecks(buildData(spec({})), '', { lang: 'fr' }).find(c => /^dispersion clair/.test(c.label)).detail));

// P3 : seuls les crans écrêtés regagnent de l'éclat, à luminance égale (donc à contraste égal)
const vivid = buildData(spec({ ramps: [{ name: 'g', kind: 'product', anchors: { default: '#00b36b' } }] }));
const pr = vivid.ramps[0], p3 = p3Scale(pr.colors.fusilier, pr.seed);
assert.ok(p3.some(Boolean) && p3.some(x => x === null), 'des crans gagnent, d\'autres ne bougent pas');
const toLin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
p3.forEach((v, i) => {
  if (!v) return;
  const [r, g, b] = v.components.map(toLin);
  const y = 0.2289746 * r + 0.6917385 * g + 0.0792869 * b;
  assert.ok(Math.abs(y - relativeLuminance(pr.colors.fusilier[i])) < 0.003, `${STEPS[i]} : même luminance en P3`);
  assert.ok(v.gain > 1, 'plus vif');
});

// la dixième méthode : des courbes par canal, ancrées sur le seed, sans garantie entre teintes
const cv = buildData(spec({}));
assert.ok(cv.methodOrder.includes('curves') && cv.ramps[0].colors.curves[cv.meta.seedIndex] === cv.ramps[0].seed);

// le test perceptif : quatre décisions confrontées à des yeux, une page autonome, des réponses agrégées
import('./perceptual.mjs').then(({ perceptualTrials, perceptualPage, perceptualSummary }) => {
  const tr = perceptualTrials(spec({}));
  assert.equal(tr.length, 4);
  assert.ok(tr.every(x => x.a.ui.bg && x.b.ui.button));
  const page = perceptualPage(tr, { lang: 'en' });
  assert.ok(page.includes('const TRIALS=') && !/https?:\/\//.test(page.replace(/xmlns="[^"]*"/g, '')) && page.includes('Dashboard'));
  const sum = perceptualSummary([{ answers: [{ trial: 'dark-method', chosen: 'mirror-bridge' }] }, { answers: [{ trial: 'dark-method', chosen: 'mirror-wcag' }] }]);
  assert.deepEqual(sum['dark-method'], { n: 2, share: { 'mirror-bridge': 50, 'mirror-wcag': 50 } });
  console.log('options : ok');
});
