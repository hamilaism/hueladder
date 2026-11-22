#!/usr/bin/env node
// CLI : node studio.mjs [--out <fichier>]
//
// Produit le studio Hueladder : une seule page HTML, sans serveur ni dépendance, qui embarque
// le moteur complet. Contrairement à build.mjs, elle ne dépend d'aucune marque : c'est
// l'utilisateur qui apporte ses couleurs dans la page.
//
// Les deux pages historiques restent embarquées telles quelles : le régleur devient l'étape
// « Régler », l'artefact de comparaison le rapport complet ouvert depuis « Livrer ».

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleLib, inlineModule, inlineIsolated } from './lib/bundle.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const outFlag = argv.indexOf('--out');
const outPath = outFlag >= 0 ? resolve(argv[outFlag + 1]) : resolve(HERE, '..', 'hueladder.html');

const read = p => readFileSync(join(HERE, p), 'utf8');
// Une chaîne JSON posée dans un <script> : `</` y fermerait la balise.
const embed = s => JSON.stringify(s).replace(/<\//g, '<\\/');

// Les pages historiques attendent leurs modules dans la portée partagée, comme build.mjs les
// leur fournit : seules les données restent à injecter, dans la page.
const lib = name => join(HERE, 'lib', name + '.mjs');
const tunerTpl = read('tuner.template.html')
  .replace('/*COLOR_INJECT*/', () => inlineModule(lib('color')))
  .replace('/*TUNE_INJECT*/', () => inlineModule(lib('tune')) + '\n' + inlineIsolated(lib('deltae'), 'deltaE2000Hex'));
const reportTpl = read('template.html')
  .replace('/*APCA_INJECT*/', () => inlineModule(lib('apca')));

const html = read('studio.template.html')
  .replace('/*LIB_INJECT*/', () => bundleLib(join(HERE, 'lib')))
  .replace('/*TUNER_TPL*/""', () => embed(tunerTpl))
  .replace('/*REPORT_TPL*/""', () => embed(reportTpl));

writeFileSync(outPath, html);
console.log(`→ ${outPath} (${Math.round(html.length / 1024)} Ko)`);
