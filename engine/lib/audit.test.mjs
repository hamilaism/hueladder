// node lib/audit.test.mjs — l'audit d'une ou plusieurs sources, sans rien générer.
import assert from 'node:assert/strict';
import { readSource, auditSource, compareSources, diffVersions, decision, methodResemblance, auditMarkdown, decisionMarkdown } from './audit.mjs';
import { hslToHex } from './color.mjs';
import { verifyTokens, verifyRamps, auditDark, medianLadder } from './audit.mjs';
import { buildData } from './build.mjs';
import { applyNaming } from './naming.mjs';
import { tokenTrees } from './outputs.mjs';
import { readFileSync } from 'node:fs';

const css = fams => Object.entries(fams).map(([f, steps]) => Object.entries(steps).map(([s, h]) => `--${f}-${s}: ${h};`).join('\n')).join('\n');
const RED = { 100: '#fde8e8', 300: '#f8a5a5', 500: '#e53e3e', 700: '#9b2c2c', 900: '#4a1414' };
const BLUE = { 100: '#e6efff', 300: '#93b4f5', 500: '#2f5bd3', 700: '#1d3f8f', 900: '#0d1d45' };

const A = readSource(css({ red: RED, blue: BLUE }), { name: 'A', origin: 'fixture', date: '2026-10-21' });
const B = readSource(css({ red: { ...RED, 500: '#c53030' }, azure: BLUE, green: { 300: '#9ae6b4', 500: '#38a169', 700: '#276749' } }), { name: 'B' });

// une source : chemins et lecture
assert.equal(A.read, 10);
assert.equal(A.paths.get('red-500'), '#e53e3e');
const a = auditSource(A), b = auditSource(B);
assert.equal(a.rampCount, 2);
assert.ok(a.resemblance.closest && a.resemblance.ranking.length >= 6, 'chaque méthode génératrice est classée');
assert.ok(a.methods.some(m => m.method === 'fusilier'));

// plusieurs sources
const cross = compareSources([a, b]);
const fam = name => cross.families.find(f => f.name === name);
assert.equal(fam('red').status, 'divergent', 'même famille, un cran différent');
assert.equal(fam('red').divergent, 1);
assert.equal(fam('red').cells.find(c => c.step === '100').status, 'aligned');
assert.equal(fam('blue').status, 'exclusive');
assert.equal(fam('green').status, 'exclusive');
assert.ok(cross.renames.some(r => r.a.family === 'blue' && r.b.family === 'azure' && r.meanDE < 0.5), 'deux noms pour une même rampe');
assert.ok(!cross.renames.some(r => r.b.family === 'green'), 'pas de rapprochement sans couleurs proches');
assert.equal(cross.commonGrid, true);
assert.equal(cross.triage[0].name, 'red', 'les divergences d\'abord');
assert.equal(cross.sameNameDifferent.length, 0, 'un cran sur cinq ne fait pas une autre couleur');

// deux versions
const diff = diffVersions(A, B);
assert.equal(diff.lost.length, 5, 'les cinq crans de blue disparaissent sous ce nom');
assert.equal(diff.changed.length, 1);
assert.equal(diff.changed[0].path, 'red-500');
assert.equal(diff.added.length, 8);
assert.equal(diff.same, 4);

// l'hypothèse HSL : teinte et saturation constantes, seule la clarté varie
const hsl = { 100: 0.92, 300: 0.75, 500: 0.55, 700: 0.38, 900: 0.2 };
const H = readSource(css({ teal: Object.fromEntries(Object.entries(hsl).map(([s, l]) => [s, hslToHex({ h: 180, s: 0.6, l })])) }), { name: 'H' });
const r = methodResemblance(auditSource(H).data);
assert.equal(r.hsl.length, 1);
assert.equal(r.hslLike, 1, 'reconnue comme une rampe HSL');
assert.equal(methodResemblance(a.data).hslLike, 0, 'une rampe dessinée ne l\'est pas');

// la décision, et les rendus en mots
const d = decision(a);
assert.equal(d.core, 'fusilier');
assert.equal(d.bands.invisible.length + d.bands.perceptible.length + d.bands.visible.length, d.impact.length);
assert.ok(d.fallback === null || d.fallback.method !== 'fusilier');
const md = auditMarkdown({ audits: [a, b], cross, diff }, { lang: 'fr' });
assert.ok(md.includes('À lire avant les chiffres') && md.includes('Triage') && md.includes('Deux versions'));
assert.ok(decisionMarkdown(d, { lang: 'en' }).includes('Verdict'));

// des tokens livrés par le moteur tiennent leur contrat ; une palette dessinée, non
const fx = applyNaming(JSON.parse(readFileSync(new URL('../brands/example.json', import.meta.url), 'utf8')));
const fd = buildData(fx);
for (const mode of ['light', 'dark']) {
  const checks = verifyTokens(JSON.stringify(tokenTrees(fx, fd, mode).tokens), { mode, background: mode === 'dark' ? fd.meta.dark.background : '#ffffff', expect: fd.rules.rankForAA });
  assert.ok(checks.every(c => c.pass), mode + ' : ' + JSON.stringify(checks.filter(c => !c.pass)));
  assert.deepEqual(checks.find(c => c.key === 'rule').rule, { ui: fd.rules.rankForUI, aa: fd.rules.rankForAA, aaa: fd.rules.rankForAAA }, 'la règle relue dans les fichiers est celle du moteur');
}
assert.ok(!verifyRamps(B.spec.ramps).find(c => c.key === 'same').pass, 'une palette dessinée ne tient pas ses seuils au même cran');
assert.ok(!verifyTokens('{"a":{"$type":"color","b":{"$value":null}}}').find(c => c.key === 'valid').pass, 'un null est refusé');

// un sombre déclaré : ses propres contrôles, et le seuil qui change de cran d'un mode à l'autre
const L2 = readSource(css({ blue: { 100: '#e6efff', 500: '#2f5bd3', 900: '#0d1d45' }, red: { 100: '#fde8e8', 500: '#e53e3e', 900: '#4a1414' } }), { name: 'L' });
const D2 = readSource(css({ blue: { 100: '#2a2f3a', 500: '#6f9df0', 900: '#e8eefc' }, red: { 100: '#3a2a2a', 500: '#e06666', 900: '#fbe9e9' } }), { name: 'D' });
const dk = auditDark(L2, D2, { background: '#121212' });
assert.ok(dk.checks.find(c => c.key === 'mono').pass, 'le sombre monte du fond vers le blanc');
assert.ok(/red @4.5:1 900 → 500/.test(dk.checks.find(c => c.key === 'modes').detail), 'le seuil AA du rouge change de cran');

// le barreau médian : sur une palette générée par le moteur, il retombe sur le barreau par défaut
const gen = readSource(JSON.stringify(tokenTrees(fx, fd, 'light').tokens), { name: 'gen' });
const gs = applyNaming({ ...gen.spec, naming: 'grid', stepList: fd.meta.coreSteps });
const ml = medianLadder(gs, buildData(gs));
const off = ml.steps.filter(g => fd.meta.coreSteps.includes(g.step)).map(g => Math.abs(g.median - fd.ladders.shade[fd.meta.steps.indexOf(g.step)]));
assert.ok(ml.monotone && Math.max(...off) < 0.5, 'la médiane d\'une palette verrouillée retombe sur son barreau : ' + Math.max(...off));

// les paires par état : un focus où le fond devient le texte, un texte faible sous le seuil
import('./pairs.mjs').then(({ extractPairs, auditPairs }) => {
  const tok = { c: { b5: { $type: 'color', $value: '#2f5bd3' }, b7: { $type: 'color', $value: '#1d3f8f' }, w: { $type: 'color', $value: '#ffffff' }, g4: { $type: 'color', $value: '#9ca3af' } },
    button: { primary: { bg: { default: { $value: '{c.b5}' }, hover: { $value: '{c.b7}' }, focus: { $value: '{c.w}' } }, fg: { default: { $value: '{c.w}' } } } },
    text: { weak: { fg: { $value: '{c.g4}' }, bg: { $value: '{c.w}' } } } };
  const r = auditPairs(extractPairs(JSON.stringify(tok)));
  assert.equal(r.totals.pairs, 4, 'l\'état qui ne redéclare que son fond hérite de l\'encre par défaut');
  assert.equal(r.totals.invisible, 1);
  assert.equal(r.rows.find(x => x.name === 'text.weak').status, 'fail');
});

// un relevé Figma : les variables font la palette, le relevé fait les constats
const scan = { hueladderFigmaScan: 1, file: 'F', variables: [{ name: 'core/red/500', key: 'a', collection: 'core', scopes: ['ALL_SCOPES'], values: { Light: '#e53e3e', Dark: '#f06060' } }, { name: 'core/red/700', key: 'b', collection: 'core', scopes: [], values: { Light: '#9b2c2c' } }],
  styles: [{ name: 'W', key: 's1' }, { name: 'W', key: 's2' }], fills: [{ hex: '#ffffff', bound: false, count: 10 }, { hex: '#e53e3e', bound: true, count: 30 }], texts: { total: 4, bound: 1 }, labels: [{ node: 'n', label: '#46001d', fill: '#0f172a' }] };
const fsrc = readSource(JSON.stringify(scan), { name: 'Figma' });
assert.equal(fsrc.spec.ramps[0].name, 'red', 'les variables deviennent une palette (le nom générique « core » tombe)');
assert.equal(fsrc.figma.binding.fills, 75);
assert.equal(fsrc.figma.lies.length, 1);
assert.equal(fsrc.figma.duplicates.length, 1);

console.log('audit : ok');
