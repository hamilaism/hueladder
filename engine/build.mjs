#!/usr/bin/env node
// CLI : node build.mjs [brands/<marque>.json] [--out <dossier>]
//
// Prend une spécification de marque (nuanciers + couleurs déjà choisies) et produit
// l'artefact de comparaison, les données brutes, les tokens DTCG et le manifeste Figma.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildData } from './lib/build.mjs';
import { tunerDataFrom, tokenTrees, usageGuide, migrationTable } from './lib/outputs.mjs';
import { applyNaming } from './lib/naming.mjs';
import { inlineModule, inlineIsolated } from './lib/bundle.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const outFlag = argv.indexOf('--out');
const outDir = outFlag >= 0 ? resolve(argv[outFlag + 1]) : HERE;
const specArg = argv.find((a, i) => !a.startsWith('--') && (outFlag < 0 || i !== outFlag + 1));
if (!specArg) {
  console.error('usage : node build.mjs <brands/marque.json> [--out <dossier>]\n'
    + '        node build.mjs brands/example.json --out ../clients/demo');
  process.exit(1);
}
const specPath = resolve(specArg);

const spec = applyNaming(JSON.parse(readFileSync(specPath, 'utf8')));
const data = buildData(spec);

mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- artefact HTML

const template = readFileSync(join(HERE, 'template.html'), 'utf8');
const html = template
  .replace(/__TITLE__/g, () => data.meta.title)
  .replace('/*APCA_INJECT*/', () => inlineModule(join(HERE, 'lib/apca.mjs')))
  .replace('/*DATA_INJECT*/{}', () => JSON.stringify(data));

writeFileSync(join(outDir, 'index.html'), html);
writeFileSync(join(outDir, 'data.json'), JSON.stringify(data));

// ---------------------------------------------------------------- outil de réglage

// L'artefact de comparaison sert à arbitrer une méthode ; le régleur sert à travailler la
// couleur une fois la méthode choisie. Deux gestes distincts, deux pages distinctes.
const tunerData = tunerDataFrom(spec, data);

const tunerHtml = readFileSync(join(HERE, 'tuner.template.html'), 'utf8')
  .replace(/__TUNER_TITLE__/g, () => `Réglage des échelles — ${spec.brand}`)
  .replace(/__ACCENT__/g, () => spec.accent || '#2f5bd3')
  // color d'abord : tune s'appuie sur ses fonctions dans la portée partagée.
  // deltae est isolé, il redéclare des noms que color définit déjà.
  .replace('/*COLOR_INJECT*/', () => inlineModule(join(HERE, 'lib/color.mjs')))
  .replace('/*TUNE_INJECT*/', () => inlineModule(join(HERE, 'lib/tune.mjs'))
    + '\n' + inlineIsolated(join(HERE, 'lib/deltae.mjs'), 'deltaE2000Hex'))
  .replace('/*TUNER_DATA*/{}', () => JSON.stringify(tunerData));
writeFileSync(join(outDir, 'tuner.html'), tunerHtml);

// ---------------------------------------------------------------- tokens DTCG

const core = data.meta.coreMethod;

function emitTokens(mode) {
  const { tokens, variantTokens } = tokenTrees(spec, data, mode);
  const tag = mode === 'dark' ? '.dark' : (data.meta.dark ? '.light' : '');
  const path = join(outDir, `${spec.id}-core-colors${tag}.tokens.json`);
  writeFileSync(path, JSON.stringify(tokens, null, 2));
  let variantPath = null;
  if (variantTokens) {
    variantPath = join(outDir, `${spec.id}-hue-variants${tag}.tokens.json`);
    writeFileSync(variantPath, JSON.stringify(variantTokens, null, 2));
  }
  return { path, variantPath };
}

const emitted = [emitTokens('light')];
// le guide d'usage, pour les personnes et les IA qui consomment les tokens
const guidePath = join(outDir, `${spec.id}-color-guide.md`);
writeFileSync(guidePath, usageGuide(spec, data));
const migrationPath = join(outDir, `${spec.id}-migration.md`);
writeFileSync(migrationPath, migrationTable(spec, data));
if (data.meta.dark) emitted.push(emitTokens('dark'));

// ---------------------------------------------------------------- manifeste Figma

const manifest = {
  brand: spec.brand,
  intent: spec.figmaIntent || `Collection de variables couleur du core ${spec.brand}, générée par la méthode « ${data.methods[core].label} ».`,
  target: spec.notes?.figmaTarget || null,
  method: core,
  methodRationale: data.methods[core].desc,
  steps: data.meta.steps,
  seedStep: data.meta.seedStep,
  contrastRule: {
    shadePerRank: data.rules.shadePerRank,
    rankForUI: data.rules.rankForUI,
    rankForAA: data.rules.rankForAA,
    rankForAAA: data.rules.rankForAAA,
  },
  // Le mode sombre n'est pas une seconde palette : c'est le même barreau de contraste relu
  // contre un autre fond. Le manifeste porte donc le fond et son budget, pas seulement les
  // valeurs — sans quoi personne ne peut recalculer un cran ajouté plus tard.
  modes: data.meta.dark
    ? {
      light: { background: data.meta.lightBackground, contrastBudget: 21 },
      dark: {
        background: data.meta.dark.background,
        backgroundY: data.meta.dark.backgroundY,
        contrastBudget: data.meta.dark.contrastBudget,
        chromaProfile: data.meta.dark.profile,
        gamutCeiling: data.meta.dark.gamutCeiling,
        derivation: 'Y_sombre = C_clair × (Y_fond + 0,05) − 0,05 — égalité de contraste, cran par cran.',
        outOfBudget: data.meta.dark.outOfBudget,
      },
    }
    : { light: { background: data.meta.lightBackground, contrastBudget: 21 } },
  staticTokens: data.staticTokens,
  staticTokensNote: 'Valeur identique dans tous les modes. À créer comme variables littérales, jamais comme alias vers un cran de rampe.',
  ramps: data.ramps.filter(r => !r.derived).map(r => ({
    name: r.name,
    label: r.label,
    kind: r.kind,
    ...(r.primitives.length ? { primitives: r.primitives } : {}),
    seed: r.seed,
    seedProvided: r.seedProvided,
    figmaSource: r.source,
    scale: Object.fromEntries(data.meta.steps.map((s, i) => [s, r.colors[core][i]])),
    darkScale: r.darkColors ? Object.fromEntries(data.meta.steps.map((s, i) => [s, r.darkColors[core][i]])) : null,
    existingColors: r.anchors,
    existingColorMapping: data.anchorMap
      .filter(a => a.ramp === r.name)
      .map(a => ({ role: a.role, hex: a.hex, nativeStep: a.nativeStep, coreStep: a.perMethod[core].step, deltaE: a.perMethod[core].deltaE })),
  })),
  hueVariants: data.ramps.filter(r => r.derived).map(r => ({
    name: r.name, label: r.label, derivedFrom: r.derivedFrom, hueOffset: r.hueOffset,
    hue: r.hue, chromaLoss: r.chromaLoss, seed: r.seed,
    scale: Object.fromEntries(data.meta.steps.map((s, i) => [s, r.colors[core][i]])),
  })),
  hueVariantsNote: 'Hypothèses de travail, livrées à part (<id>-hue-variants.tokens.json). '
    + 'Ne pas les importer dans la collection de primitives sans arbitrage explicite.',
  nextSteps: spec.nextSteps || [
    'Connecter le Figma Desktop Bridge sur la librairie cible.',
    'Importer le fichier de tokens via figma_import_tokens (format: dtcg, strategy: dry-run puis merge).',
    'Mapper ensuite ces primitives core vers les collections sémantiques par marque et par mode.',
  ],
};
writeFileSync(join(outDir, `${spec.id}-core-colors.manifest.json`), JSON.stringify(manifest, null, 2));

// ---------------------------------------------------------------- rapport console

const m = data.metrics[core];
console.log(`${spec.brand} — ${data.meta.rampCount} nuanciers`
  + (data.meta.derivedCount ? ` (+ ${data.meta.derivedCount} déclinaisons de teinte)` : '')
  + ` × ${data.methodOrder.length} méthodes × ${data.meta.steps.length} steps`);
console.log(`  règle de contraste : Δrang ≥ ${data.rules.rankForUI} ⇒ 3.0 · ≥ ${data.rules.rankForAA} ⇒ AA · ≥ ${data.rules.rankForAAA} ⇒ AAA`);
console.log(`  méthode core « ${core} » : ${m.violationCount} violation(s), garantie réelle dès Δ ≥ ${m.safeRank}, dispersion ${m.meanSpread}`);
const il = m.interchangeability.light;
console.log(`  interchangeabilité clair : ${il.totalPairs} paires à rang égal, écart max ${il.maxSpread} (${il.worstStep}), ${il.crossingPairs} franchissement(s)`);
if (m.interchangeability.dark) {
  const id = m.interchangeability.dark;
  console.log(`  interchangeabilité sombre : ${id.totalPairs} paires, écart max ${id.maxSpread} (${id.worstStep}), ${id.crossingPairs} franchissement(s)`
    + ` — fond ${id.background}, budget ${data.meta.dark.contrastBudget}:1`);
}
console.log(`  dérive de teinte intra-rampe : ${m.hueDrift.light.maxDrift}° en clair`
  + (m.hueDrift.dark ? ` · ${m.hueDrift.dark.maxDrift}° en sombre` : '')
  + (m.hueDrift.light.worst ? ` (pire : ${m.hueDrift.light.worst.ramp}/${m.hueDrift.light.worst.step})` : ''));
console.log(`  ${data.meta.anchorCount} couleurs existantes replacées · fidélité moyenne ΔE ${m.meanFidelity}`);
console.log(`  → ${join(outDir, 'index.html')}`);
console.log(`  → ${join(outDir, 'tuner.html')}`);
for (const e of emitted) {
  console.log(`  → ${e.path}`);
  if (e.variantPath) console.log(`  → ${e.variantPath} (${data.meta.derivedCount} déclinaisons de teinte, hors core)`);
}
console.log(`  → ${guidePath} (guide d'usage)`);
console.log(`  → ${migrationPath} (avant / après)`);
