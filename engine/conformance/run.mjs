#!/usr/bin/env node
// La suite de conformité : chaque méthode de Hueladder, réimplémentée sans dépendance, comparée à la
// librairie qui la porte à l'origine. Elle ne dit pas oui ou non : elle mesure l'écart, pour
// qu'on puisse écrire « Hueladder reproduit X à tant près ».
//
//   cd engine/conformance && npm install && node run.mjs
//   node run.mjs --modules <un node_modules qui contient déjà ces librairies> [--json]
//
// Corpus : l'exemple synthétique de `hueladder explain` (neuf teintes), sans donnée de client.

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildData } from '../lib/build.mjs';
import { applyNaming } from '../lib/naming.mjs';
import { deltaE2000Hex } from '../lib/deltae.mjs';
import { contrast } from '../lib/color.mjs';
import { demoSpec } from '../lib/explain.mjs';
import { TAILWIND } from '../lib/methods.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const mi = argv.indexOf('--modules');
const MODS = mi >= 0 ? resolve(argv[mi + 1]) : join(HERE, 'node_modules');
const req = createRequire(join(MODS, 'noop.js'));
const load = async (name, file) => { try { return await import(pathToFileURL(file ? join(MODS, name, file) : req.resolve(name)).href); } catch (e) { return null; } };

const chromaMod = await load('chroma-js'), chroma = chromaMod && (chromaMod.default || chromaMod);
const hct = await load('@material/material-color-utilities', 'hct/hct.js'), str = await load('@material/material-color-utilities', 'utils/string_utils.js');
const leo = await load('@adobe/leonardo-contrast-colors');
const cjs = (await load('colorjs.io', 'dist/color.js')) || (await load('colorjs.io')), Color = cjs && ((cjs.default && cjs.default.default) || cjs.default || cjs.Color);
let twCss = null; try { twCss = readFileSync(join(MODS, 'tailwindcss', 'theme.css'), 'utf8'); } catch (e) {}

// le corpus : chaque teinte en seed seul, posée au 500 — le geste « créer »
const demo = demoSpec('fr');
const spec = applyNaming({ ...demo, pinDefault: true, ramps: demo.ramps.map(r => ({ name: r.name, label: r.label, kind: r.kind, anchors: { default: r.anchors.default } })) });
const data = buildData(spec), steps = data.meta.steps, seedIndex = data.meta.seedIndex, n = steps.length;
const real = data.ramps.filter(r => !r.derived && r.kind !== 'neutral');

const results = [];
const report = (method, lib, pairs, extra = {}) => {
  const ok = pairs.filter(p => p.a && p.b);
  const des = ok.map(p => deltaE2000Hex(p.a, p.b));
  const same = ok.filter(p => p.a.toLowerCase() === p.b.toLowerCase()).length;
  const max = des.length ? Math.max(...des) : null;
  const verdict = !ok.length ? 'non mesuré' : same === ok.length ? 'identique au hex près' : max < 1 ? 'fidèle (ΔE < 1)' : max < 2.5 ? 'proche (ΔE < 2,5)' : 'divergent';
  results.push({ method, lib, compared: ok.length, identical: same, maxDE: max === null ? null : Math.round(max * 100) / 100, verdict, ...extra });
};

// mix : un mélange linéaire en sRGB vers le blanc ou le noir (Sass mix, Bootstrap)
if (chroma) {
  report('mix', 'chroma.mix(…, "rgb") ' + (chromaMod.default?.version || ''), real.flatMap(r => r.colors.mix.map((h, i) => {
    if (!h || i === seedIndex) return {};
    const span = i < seedIndex ? seedIndex : n - 1 - seedIndex;
    return { a: h, b: chroma.mix(r.seed, i < seedIndex ? '#ffffff' : '#000000', Math.abs(i - seedIndex) / span, 'rgb').hex() };
  })));
  // easing : chroma.scale(blanc, seed, noir) en Lab, clarté corrigée — échantillonnée à la même clarté L*
  const scaleOf = seed => chroma.scale(['#ffffff', seed, '#000000']).mode('lab').correctLightness();
  report('easing', 'chroma.scale().mode("lab").correctLightness()', real.flatMap(r => { const sc = scaleOf(r.seed); return r.colors.easing.map((h, i) => (h ? { a: h, b: sc((100 - data.ladders.easingL[i]) / 100).hex() } : {})); }));
} else results.push({ method: 'mix, easing', lib: 'chroma-js', verdict: 'librairie absente' });

// HCT : le ton Material, même teinte et même chroma CAM16 que le seed
if (hct && str) {
  report('hct', '@material/material-color-utilities Hct', real.flatMap(r => {
    const h = hct.Hct.fromInt(str.argbFromHex(r.seed));
    return r.colors.hct.map((x, i) => (x ? { a: x, b: str.hexFromArgb(hct.Hct.from(h.hue, h.chroma, data.ladders.tone[i]).toInt()) } : {}));
  }));
} else results.push({ method: 'hct', lib: '@material/material-color-utilities', verdict: 'librairie absente' });

// Leonardo : chaque cran vise un ratio face au blanc ; on compare les ratios obtenus et les couleurs.
// La librairie reçoit tous les ratios d'un coup, comme Hueladder : sa recherche partage un cache
// d'une couleur à l'autre, l'ordre et la liste comptent.
if (leo && leo.Color && leo.Theme) {
  const targets = data.ladders.leonardo;
  let errHueladder = 0, errLeo = 0;
  const pairs = real.flatMap(r => {
    const col = new leo.Color({ name: 'c', colorKeys: [r.seed], ratios: targets, colorSpace: 'OKLCH' });
    const theme = new leo.Theme({ colors: [col], backgroundColor: new leo.BackgroundColor({ name: 'bg', colorKeys: ['#ffffff'], ratios: [1] }), lightness: 100 });
    const vals = (theme.contrastColors.find(x => x.values) || { values: [] }).values.map(v => v.value);
    const hueladderCore = r.colors.leonardo;
    return hueladderCore.map((h, k) => {
      if (!h || !vals[k]) return {};
      errHueladder = Math.max(errHueladder, Math.abs(contrast(h, '#ffffff') - targets[k]));
      errLeo = Math.max(errLeo, Math.abs(contrast(vals[k], '#ffffff') - targets[k]));
      return { a: h, b: vals[k] };
    });
  });
  report('leonardo', '@adobe/leonardo-contrast-colors', pairs, { ratioErrorHueladder: Math.round(errHueladder * 1000) / 1000, ratioErrorLeonardo: Math.round(errLeo * 1000) / 1000 });
} else results.push({ method: 'leonardo', lib: '@adobe/leonardo-contrast-colors', verdict: 'librairie absente' });

// Tailwind : la table embarquée, face au theme.css officiel (OKLCH ramené en sRGB comme un navigateur)
if (twCss && Color) {
  const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  const pairs = [];
  for (const [fam, list] of Object.entries(TAILWIND)) STEPS.forEach((st, i) => {
    const m = new RegExp(`--color-${fam}-${st}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(twCss);
    if (m && list[i]) pairs.push({ a: list[i], b: new Color('oklch', [Number(m[1]) / 100, Number(m[2]), Number(m[3])]).toGamut({ space: 'srgb' }).to('srgb').toString({ format: 'hex' }) });
  });
  const v = (() => { try { return JSON.parse(readFileSync(join(MODS, 'tailwindcss', 'package.json'), 'utf8')).version; } catch (e) { return '?'; } })();
  report('tailwind', `tailwindcss ${v} theme.css`, pairs);
} else results.push({ method: 'tailwind', lib: 'tailwindcss + colorjs.io', verdict: 'librairie absente' });

if (argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
else {
  console.log(`Conformité — corpus : ${real.length} teintes × ${data.meta.coreSteps.length} crans\n`);
  for (const r of results) console.log(`${r.method.padEnd(10)} ${String(r.verdict).padEnd(24)} ${r.compared ?? ''}${r.compared ? ' couleurs, ' + r.identical + ' identiques, ΔE max ' + r.maxDE : ''}${r.ratioErrorHueladder !== undefined ? ` · erreur de ratio : Hueladder ${r.ratioErrorHueladder}, Leonardo ${r.ratioErrorLeonardo}` : ''}  — ${r.lib}`);
}
