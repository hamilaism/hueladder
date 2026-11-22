// node lib/dark.test.mjs — mirror-bridge : la règle du nom tient, le texte n'est jamais plus
// faible qu'en miroir WCAG, et il gagne en APCA (references/mode-sombre/perceptif.md).
import assert from 'node:assert/strict';
import { buildData } from './build.mjs';
import { applyNaming, NAMINGS } from './naming.mjs';
import { contractChecks } from './contract.mjs';
import { relativeLuminance } from './color.mjs';
import { apcaLc } from './apca.mjs';

const ramps = ['#2f5bd3', '#d92d20', '#6b6f78'].map((h, i) => ({ name: 'r' + i, label: 'r' + i, kind: i === 2 ? 'neutral' : 'product', anchors: { default: h } }));
const build = (naming, stepList, background, method) => buildData(applyNaming({ id: 't', brand: 't', naming, stepList, ramps, darkMode: { background, method } }));
const ruleFails = d => contractChecks(d, '', { lang: 'fr' }).filter(c => !c.pass && c.area === 'dark').map(c => c.label);

let gain = 0;
for (const bg of ['#000000', '#121212', '#1f1f1f']) {
  for (const [naming, N] of Object.entries(NAMINGS)) {
    for (const [p, list] of Object.entries(N.presets)) {
      if (naming === 'hundreds' && p === 'quarter') continue; // le 975 dépasse le budget de tout fond non noir
      const mirror = build(naming, list, bg, 'mirror-wcag'), bridge = build(naming, list, bg, 'mirror-bridge');
      // le prix connu : plus de contraste en sombre, donc des seuils atteints plus tôt qu'en clair
      const extra = ruleFails(bridge).filter(l => !ruleFails(mirror).includes(l) && l !== 'seuils identiques entre modes');
      assert.deepEqual(extra, [], `${naming}/${p} sur ${bg} : ${extra.join(', ')}`);
      const m = mirror.meta.coreMethod;
      bridge.ramps.forEach((r, k) => r.darkColors[m].forEach((h, i) => {
        const g = mirror.ramps[k].darkColors[m][i];
        if (!h || !g || !mirror.meta.isCore[i]) return;
        assert.ok(relativeLuminance(h) >= relativeLuminance(g) - 0.002, `${naming}/${p} ${bg} ${r.name} ${mirror.meta.steps[i]} : sous le miroir`);
        gain = Math.max(gain, Math.abs(apcaLc(h, bg)) - Math.abs(apcaLc(g, bg)));
      }));
    }
  }
}
assert.ok(gain > 10, `mirror-bridge devrait gagner plus de 10 Lc quelque part (${gain.toFixed(1)})`);

// sur la grille standard, #121212 : le 600 passe de Lc ~43 à ~60
const d = build('grid', NAMINGS.grid.presets.standard, '#121212', 'mirror-bridge');
const i600 = d.meta.steps.indexOf('600'), lc = Math.abs(apcaLc(d.ramps[0].darkColors[d.meta.coreMethod][i600], '#121212'));
assert.ok(lc > 55, `600 en mirror-bridge : Lc ${lc.toFixed(0)}`);
console.log('dark : ok');
