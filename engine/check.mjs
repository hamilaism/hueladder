#!/usr/bin/env node
// Contrôle complet : colorimétrie, généricité du moteur, intégrité des pages produites.
// Une seule commande, verte ou rouge. À lancer après toute modification, et avant de livrer.
//
//   node check.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { relativeLuminance, contrast, hexToOklch } from './lib/color.mjs';
import { luminanceQuantum, luminanceForContrastVsBlack, solveAtLuminance } from './lib/tune.mjs';
import { contractChecks } from './lib/contract.mjs';
import { bundleLib } from './lib/bundle.mjs';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const ok = (label, detail = '') => console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? '  ' + detail : ''}`);
const ko = (label, detail = '') => { failed++; console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? '  ' + detail : ''}`); };

function step(title) { console.log(`\n\x1b[1m${title}\x1b[0m`); }

// ---------------------------------------------------------------- 1. colorimétrie
step('1 · Colorimétrie — vecteurs de test publiés');
for (const mod of ['deltae', 'apca', 'cam16', 'tune', 'analysis', 'crans', 'naming', 'dark']) {
  try {
    execFileSync('node', [join(HERE, 'lib', `${mod}.test.mjs`)], { stdio: 'pipe' });
    ok(`lib/${mod}.test.mjs`);
  } catch (e) {
    ko(`lib/${mod}.test.mjs`, (e.stdout?.toString() || '').trim().split('\n').slice(-3).join(' | '));
  }
}

// ---------------------------------------------------------------- 2. généricité
step('2 · Généricité — la fixture doit passer telle quelle');
const out = mkdtempSync(join(tmpdir(), 'cs-check-'));
let built = false;
try {
  execFileSync('node', [join(HERE, 'build.mjs'), join(HERE, 'brands/example.json'), '--out', out], { stdio: 'pipe' });
  built = true;
  ok('build de brands/example.json');
} catch (e) {
  ko('build de brands/example.json', (e.stderr?.toString() || '').trim().split('\n')[0]);
}

if (built) {
  for (const f of ['index.html', 'tuner.html', 'data.json',
    'example-core-colors.light.tokens.json', 'example-core-colors.dark.tokens.json']) {
    existsSync(join(out, f)) ? ok(`produit ${f}`) : ko(`produit ${f}`, 'absent');
  }

  const data = JSON.parse(readFileSync(join(out, 'data.json'), 'utf8'));
  // la fixture est en 9 crans réguliers : la règle doit s'être recalculée dessus
  data.meta.coreSteps.length === 9
    ? ok('échelle de la fixture', '9 crans réguliers — le moteur ne suppose pas 11')
    : ko('échelle de la fixture', `${data.meta.coreSteps.length} crans réguliers`);
  data.rules.rankForAA === 5
    ? ok('règle recalculée', 'Δrang ≥ 5 ⇒ AA sur 9 crans')
    : ko('règle recalculée', `Δrang ≥ ${data.rules.rankForAA}`);

  // --- crans hors grille ---
  const last = data.meta.steps.length - 1;
  const withExtra = data.ramps.find(r => r.usesExtra);
  const withoutExtra = data.ramps.find(r => !r.usesExtra && !r.derived);
  if (!withExtra || !withoutExtra) {
    ko('crans hors grille', 'la fixture ne couvre plus les deux cas');
  } else {
    const w = withExtra.colors.fusilier, o = withoutExtra.colors.fusilier;
    w[0] === '#ffffff' && w[last] === '#000000'
      ? ok('bornes définitionnelles', '0 = blanc pur, 1000 = noir pur')
      : ko('bornes définitionnelles', `${w[0]} / ${w[last]}`);
    o[0] === null && o[last] === null
      ? ok('crans non demandés', 'laissés vides sur les autres nuanciers')
      : ko('crans non demandés', `${o[0]} / ${o[last]}`);
    // La règle ne doit engager que la grille régulière. On le vérifie directement : une paire
    // touchant un cran hors grille n'a pas de rang, donc moins de paires sont « rangées » que
    // de paires tout court. Compter les violations ne suffirait pas — sur une échelle où les
    // extras tombent aux extrémités, les inclure par erreur n'en produit aucune.
    const M = data.metrics.fusilier;
    M.rankedPairs < M.totalPairs
      ? ok('règle hors grille', `${M.totalPairs - M.rankedPairs} paires sans rang, exclues de la règle`)
      : ko('règle hors grille', 'des paires hors grille ont reçu un rang');
    M.violationCount === 0
      ? ok('aucune violation', `garantie réelle dès Δ ≥ ${M.safeRank}`)
      : ko('aucune violation', `${M.violationCount} violations`);
  }

  // --- valeurs réglées à la main ---
  const tunedRamp = data.ramps.find(r => data.methodOrder.includes('tuned')
    && r.colors.tuned && r.colors.tuned.some((c, i) => c !== r.colors[data.meta.coreMethod][i]));
  if (!data.methodOrder.includes('tuned')) {
    ko('méthode réglée', 'absente alors que la fixture déclare un bloc tuned');
  } else if (!tunedRamp) {
    ko('méthode réglée', 'présente mais identique à la méthode de base');
  } else {
    const i = data.meta.steps.indexOf('500');
    tunedRamp.colors.tuned[i] === '#1f7fb5'
      ? ok('méthode réglée', 'les valeurs déclarées sont reprises telles quelles')
      : ko('méthode réglée', `step 500 = ${tunedRamp.colors.tuned[i]}`);
    const j = data.meta.steps.indexOf('200');
    tunedRamp.colors.tuned[j] === tunedRamp.colors[data.meta.coreMethod][j]
      ? ok('repli du réglage', 'un cran non réglé retombe sur la méthode de base')
      : ko('repli du réglage', 'un cran non réglé a été modifié');
  }

  // --- déclinaisons de teinte ---
  const derived = data.ramps.filter(r => r.derived);
  derived.length
    ? ok('déclinaisons de teinte', `${derived.length} générées, exclues des métriques`)
    : ko('déclinaisons de teinte', 'aucune alors que la fixture en déclare');
  derived.every(r => r.colors.existing.every(c => c === null))
    ? ok('déclinaisons sans existant', 'elles n\'inventent aucune couleur d\'origine')
    : ko('déclinaisons sans existant', 'une déclinaison porte une couleur « existante »');

  // aucune valeur aberrante
  let bad = 0, nan = 0;
  for (const r of data.ramps) for (const m of data.methodOrder) for (const hex of r.colors[m]) {
    if (hex === null) continue;
    if (!/^#[0-9a-f]{6}$/.test(hex)) bad++;
    if (/nan/i.test(hex)) nan++;
  }
  bad === 0 && nan === 0 ? ok('toutes les couleurs sont des hex valides')
                         : ko('couleurs invalides', `${bad} malformées, ${nan} NaN`);

  // les tokens du core ne doivent pas contenir d'hypothèses
  const tok = JSON.parse(readFileSync(join(out, 'example-core-colors.light.tokens.json'), 'utf8'));
  const groups = Object.keys(Object.values(tok)[0].color);
  groups.some(g => /-[pm]\d+$/.test(g))
    ? ko('tokens du core', 'des déclinaisons de teinte ont fui dans le core')
    : ok('tokens du core', `${groups.length} groupes, aucune hypothèse`);
  existsSync(join(out, 'example-hue-variants.light.tokens.json'))
    ? ok('tokens des déclinaisons', 'livrés à part du core')
    : ko('tokens des déclinaisons', 'fichier absent');

  // --- couleurs littérales ---
  // Le seul groupe dont un diff clair↔sombre ne doit rien montrer. S'il bougeait, il ne
  // servirait plus à rien : c'est précisément « ce qui ne s'inverse jamais » qu'il exprime.
  const tokDark = JSON.parse(readFileSync(join(out, 'example-core-colors.dark.tokens.json'), 'utf8'));
  const sL = Object.values(tok)[0].color.static, sD = Object.values(tokDark)[0].color.static;
  if (!sL || !sD) {
    ko('couleurs littérales', 'groupe static absent d\'un des deux modes');
  } else {
    const names = Object.keys(sL).filter(k => !k.startsWith('$'));
    // un littéral déclaré par mode (`{ light, dark }`) change par construction : il est marqué perMode
    const moved = names.filter(k => sL[k].$value !== sD[k].$value && !Object.values(sL[k].$extensions || {})[0]?.perMode);
    moved.length ? ko('couleurs littérales', `${moved.join(', ')} change(nt) entre les modes`)
                 : ok('couleurs littérales', `${names.length} tokens identiques dans les deux modes`);
    names.every(k => sL[k].$extensions && Object.values(sL[k].$extensions)[0].static === true)
      ? ok('couleurs littérales marquées', 'repérables par $extensions, pas seulement par leur nom')
      : ko('couleurs littérales marquées', 'aucun marquage exploitable par un import');
  }

  // --- le reste doit bel et bien s'inverser ---
  const rampGroups = groups.filter(g => g !== 'static');
  let inverted = 0, frozen = 0;
  for (const g of rampGroups) {
    for (const s of Object.keys(Object.values(tok)[0].color[g])) {
      if (s.startsWith('$')) continue;
      const a = Object.values(tok)[0].color[g][s].$value, b = Object.values(tokDark)[0].color[g][s].$value;
      if (a === null || b === null) continue;
      a === b ? frozen++ : inverted++;
    }
  }
  frozen === 0 ? ok('rampes inversées', `${inverted} tokens changent de valeur en sombre, aucun ne reste figé`)
               : ko('rampes inversées', `${frozen} token(s) de rampe identiques dans les deux modes`);
}

// ---------------------------------------------------------------- 3. pages produites
step('3 · Pages produites — rendu réel dans un navigateur');
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find(p => existsSync(p));

if (!CHROME) {
  console.log('  \x1b[33m•\x1b[0m Chrome introuvable — contrôle du rendu ignoré.');
  console.log('    Les pages sont autonomes : les ouvrir à la main suffit à vérifier.');
} else if (built) {
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = h => {
    const v = h.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => lin(parseInt(v.slice(i, i + 2), 16) / 255));
    return 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  };
  const contrast = (a, b) => { const x = lum(a) + 0.05, y = lum(b) + 0.05; return x > y ? x / y : y / x; };

  for (const [file, containers] of [
    ['index.html', ['summary', 'charts', 'tester', 'anchors', 'usages', 'ramps', 'spread', 'annex']],
    ['tuner.html', ['compare', 'pad', 'side', 'verify', 'preview']],
  ]) {
    let dom = '';
    try {
      dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--virtual-time-budget=9000',
        '--dump-dom', 'file://' + join(out, file)], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 }).toString();
    } catch (e) { ko(`${file} — rendu`, 'le navigateur a échoué'); continue; }

    const body = dom.slice(dom.indexOf('<body'), dom.indexOf('<script'));
    // un conteneur vide = le script a planté et la page est une coquille
    const empty = containers.filter(id => {
      const m = body.match(new RegExp(`id="${id}"[^>]*>`));
      if (!m) return true;
      const from = body.indexOf(m[0]) + m[0].length;
      const to = body.indexOf('<h2', from);
      return ((to > 0 ? to : body.length) - from) < 150;
    });
    empty.length ? ko(`${file} — conteneurs`, 'vides : ' + empty.join(', '))
                 : ok(`${file} — conteneurs`, `${containers.length} remplis`);

    // zéro tolérance : une étiquette illisible sur un swatch est le défaut le plus visible
    const pairs = [...body.matchAll(/background:(#[0-9a-fA-F]{6});color:(#[0-9a-fA-F]{6})/g)];
    const unreadable = pairs.filter(([, bg, fg]) => contrast(bg, fg) < 3);
    unreadable.length
      ? ko(`${file} — lisibilité`, `${unreadable.length} étiquette(s) sous 3:1`)
      : ok(`${file} — lisibilité`, `${pairs.length} étiquettes, toutes lisibles`);

    // autonomie : rien ne doit être chargé depuis le réseau
    const html = readFileSync(join(out, file), 'utf8');
    const remote = [...html.matchAll(/(?:src|href)\s*=\s*["']https?:\/\//g)].length
      + [...html.matchAll(/@import\s+url\(\s*["']?https?:/g)].length;
    remote === 0 ? ok(`${file} — autonomie`, 'aucune dépendance réseau')
                 : ko(`${file} — autonomie`, `${remote} ressource(s) distante(s)`);
  }
}

// ---------------------------------------------------------------- 3 bis. studio
step('3 bis · Studio Hueladder — le moteur embarqué dans la page est le même que la ligne de commande');
{
  const studioPath = join(out, 'hueladder.html');
  try {
    execFileSync('node', [join(HERE, 'studio.mjs'), '--out', studioPath], { stdio: 'pipe' });
    const html = readFileSync(studioPath, 'utf8');
    const left = html.match(/\/\*(LIB_INJECT|TUNER_TPL|REPORT_TPL)\*\//g);
    left ? ko('studio — injection', 'marqueurs restés : ' + left.join(', ')) : ok('studio — généré', Math.round(html.length / 1024) + ' Ko, autonome');
    // le moteur tel qu'il est embarqué, exécuté hors navigateur : il doit rendre les mêmes données
    const ctx = {}; vm.createContext(ctx);
    const lib = vm.runInContext(bundleLib(join(HERE, 'lib')) + '\n;__lib', ctx);
    const spec = JSON.parse(readFileSync(join(HERE, 'brands', 'example.json'), 'utf8'));
    const same = built && JSON.stringify(lib.build.buildData(spec)) === readFileSync(join(out, 'data.json'), 'utf8');
    same ? ok('studio — moteur embarqué', 'données identiques au bit près à celles du build') : ko('studio — moteur embarqué', 'les données divergent du build');
    if (CHROME) {
      // un profil à soi : le profil par défaut peut être tenu par un autre Chrome, et la page ne rend jamais la main
      const prof = mkdtempSync(join(tmpdir(), 'hueladder-dom-'));
      const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--virtual-time-budget=5000', '--user-data-dir=' + prof, '--dump-dom', 'file://' + studioPath],
        { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28, timeout: 60000 }).toString();
      // une page vierge s'ouvre sur les trois entrées (Créer, Auditer, Comprendre)
      const shown = (dom.match(/<header[\s\S]*?<\/header>/) || [''])[0] + (dom.match(/<main id="main">[\s\S]*?<\/main>/) || [''])[0];
      const doors = (shown.match(/class="panel door"/g) || []).length, entries = (shown.match(/data-entry="(create|audit|understand)"/g) || []).length;
      doors === 3 && entries >= 6 ? ok('studio — rendu', 'page d\'accueil : trois entrées, onglets dans l\'en-tête') : ko('studio — rendu', `${doors} entrée(s) affichée(s), ${entries} lien(s) d'entrée`);
      // le parcours complet, geste par geste (studio.test.mjs) : toutes les fonctionnalités
      try {
        const outp = execFileSync('node', [join(HERE, 'studio.test.mjs'), studioPath], { stdio: 'pipe', timeout: 480000 }).toString(); // le parcours prend ~4 min
        ok('studio — parcours complet', (outp.match(/(\d+) vérifications passées/) || [, '?'])[1] + ' vérifications, français et anglais, largeur téléphone');
      } catch (e) {
        const lines = (e.stdout?.toString() || '').split('\n').filter(l => l.includes('✗'));
        ko('studio — parcours complet', lines.slice(0, 3).map(l => l.replace(/\x1b\[\d+m/g, '').trim()).join(' | ') || e.message);
      }
    }
  } catch (e) {
    ko('studio', (e.stderr?.toString() || e.message || '').trim().split('\n')[0]);
  }
}

// ---------------------------------------------------------------- 3 ter. ligne de commande
step('3 ter · hueladder.mjs — les gestes du studio, pour un agent');
{
  const dir = mkdtempSync(join(tmpdir(), 'cs-cli-'));
  const hueladder = (...a) => execFileSync('node', [join(HERE, 'hueladder.mjs'), ...a], { stdio: 'pipe', cwd: dir }).toString();
  try {
    hueladder('new', '#2f5bd3', '--brand', 'Acme', '--out', 'acme.json');
    const spec = () => JSON.parse(readFileSync(join(dir, 'acme.json'), 'utf8'));
    hueladder('suggest', 'acme.json', '--write');
    const kinds = spec().ramps.map(r => r.kind);
    kinds.includes('neutral') && kinds.filter(k => k === 'system').length === 4 ? ok('new + suggest : un neutre et quatre couleurs système') : ko('suggest', kinds.join(','));
    const fs = JSON.parse(hueladder('diagnose', 'acme.json', '--json'));
    Array.isArray(fs) && fs.every(f => f.title && f.actions.length) ? ok('diagnose --json : ' + fs.length + ' constat(s), chacun avec titre et actions') : ko('diagnose');
    // une palette importée aux noms faux : « garder » doit survivre dans la spec
    writeFileSync(join(dir, 'old.css'), ':root {\n  --blue-500: #3b82f6;\n  --blue-700: #1d4ed8;\n  --green-500: #22c55e;\n  --x: rgba(0,0,0,.5);\n}\n');
    hueladder('import', 'old.css', '--out', 'old.json');
    const old = JSON.parse(hueladder('diagnose', 'old.json', '--json'));
    const keep = old.findIndex(f => f.type === 'misnamed');
    if (keep >= 0) {
      hueladder('fix', 'old.json', String(keep + 1), String(old[keep].actions.length));
      const o = JSON.parse(readFileSync(join(dir, 'old.json'), 'utf8')), after = JSON.parse(hueladder('diagnose', 'old.json', '--json'));
      o.accepted?.length === 1 && o.notes?.length === 1 && after.length === old.length - 1
        ? ok('import + fix : l\'exception acceptée est gardée dans la spec, avec sa note, et ne revient pas') : ko('fix accept');
    } else ko('import', 'aucun cran mal nommé trouvé sur une palette aux noms faux');
    const cmp = JSON.parse(hueladder('compare', 'acme.json', '--json'));
    cmp[0].method === 'fusilier' ? ok('compare : Fusilier d\'abord (le défaut), ' + cmp.filter(r => r.holds).length + ' méthode(s) tiennent le contrat') : ko('compare', cmp[0].method);
    const dk = JSON.parse(hueladder('compare', 'acme.json', '--dark', '--bg', '#121212', '--json'));
    const by = Object.fromEntries(dk.map(r => [r.method, r]));
    by['mirror-wcag'].wcag.rule === 0 && by['mirror-bridge'].wcag.rule === 0 && by['mirror-bridge'].apca.worst > by['mirror-wcag'].apca.worst
      ? ok('compare --dark : le pont tient la règle comme le miroir WCAG, et perd moins en APCA') : ko('compare --dark', JSON.stringify(by['mirror-bridge']));
    // Comprendre sur l'exemple neutre : les leçons qui portent la recommandation doivent s'y écrire
    const ex = JSON.parse(hueladder('explain', '--json')), keys = ex.lessons.map(l => l.key);
    ['luminance', 'intervals', 'quantity', 'usage', 'identity'].every(k => keys.includes(k)) && ex.guide.length >= 8 && ex.lessons.every(l => l.title && l.text) && !ex.methods.some(m => m.method === 'existing')
      ? ok('explain : ' + keys.length + ' constats titrés et un guide de choix, sur l\'exemple (aucune couleur « fournie »)') : ko('explain', keys.join(', '));
    const exMd = hueladder('explain');
    (exMd.match(/^- Réglages : /gm) || []).length >= 10 && /Ce qui ne change pas, quelle que soit la méthode/.test(exMd) && !/couleurs fournies/.test(exMd)
      && (exMd.split('## Le contraste face au blanc, cran par cran')[1] || '').split('\n## ')[0].split('\n').filter(l => /^\| .+ \| [\d,–]+ \|/.test(l)).length >= 10
      ? ok('explain : chaque méthode dit ses réglages et son contraste cran par cran, et l\'argumentaire ce qu\'aucune méthode ne change') : ko('explain réglages', (exMd.match(/^- Réglages : /gm) || []).length + ' réglages');
    const css = hueladder('export', 'acme.json', '--format', 'css');
    /--color-acme-500: #/.test(css) ? ok('export css') : ko('export css');
    hueladder('export', 'acme.json', '--format', 'package', '--out', 'pkg');
    ['README.md', 'figma/Light.tokens.json', 'tokens-studio/tokens.json', 'ai/palette.json', 'code/tailwind-v4.css'].every(f => existsSync(join(dir, 'pkg/acme-colors', f)))
      ? ok('export package : un dossier par destination') : ko('export package');
  } catch (e) { ko('hueladder.mjs', (e.stderr?.toString() || e.message || '').trim().split('\n')[0]); }
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- 4. déterminisme
step('4 · Déterminisme — deux builds identiques au bit près');
if (built) {
  const out2 = mkdtempSync(join(tmpdir(), 'cs-check2-'));
  try {
    execFileSync('node', [join(HERE, 'build.mjs'), join(HERE, 'brands/example.json'), '--out', out2], { stdio: 'pipe' });
    const same = ['index.html', 'tuner.html', 'data.json']
      .every(f => readFileSync(join(out, f), 'utf8') === readFileSync(join(out2, f), 'utf8'));
    same ? ok('rebuild identique') : ko('rebuild identique', 'les sorties diffèrent');
  } catch (e) { ko('rebuild', 'échec'); }
  rmSync(out2, { recursive: true, force: true });
}

// ---------------------------------------------------------------- 5. échecs bruyants
step('5 · Entrées invalides — le moteur doit refuser clairement');
const badSpecs = [
  ['seedStep hors échelle', { id: 't', brand: 'T', steps: ['100', '200'], seedStep: '999', ramps: [{ name: 'a', anchors: { default: '#f00000' } }] }],
  ['nuancier vide', { id: 't', brand: 'T', steps: ['100', '200'], seedStep: '100', ramps: [{ name: 'a', anchors: {} }] }],
  ['hex malformé', { id: 't', brand: 'T', steps: ['100', '200'], seedStep: '100', ramps: [{ name: 'a', anchors: { default: 'pas-un-hex' } }] }],
];
for (const [label, spec] of badSpecs) {
  const f = join(out, 'bad.json');
  execFileSync('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(f)}, ${JSON.stringify(JSON.stringify(spec))})`]);
  try {
    execFileSync('node', [join(HERE, 'build.mjs'), f, '--out', join(out, 'bad')], { stdio: 'pipe' });
    ko(`refus — ${label}`, 'le build a réussi alors qu\'il aurait dû échouer');
  } catch (e) {
    const msg = (e.stderr?.toString() || '').match(/Error: (.*)/)?.[1] || '';
    msg ? ok(`refus — ${label}`, '« ' + msg.slice(0, 58) + ' »') : ko(`refus — ${label}`, 'échec sans message clair');
  }
}

// ---------------------------------------------------------------- 6. contrat du système
step('6 · Contrat du système — ce que la palette promet, dans les deux modes');

// La logique vit dans lib/contract.mjs (le studio affiche les mêmes verdicts) ; on imprime ici.
function printContract(data, label) {
  for (const v of contractChecks(data, label)) (v.pass ? ok : ko)(v.label, v.detail);
}

if (built) {
  printContract(JSON.parse(readFileSync(join(out, 'data.json'), 'utf8')), 'fixture');

  // Toute autre spec présente dans brands/ — chez un client, c'est la sienne. `check.mjs`
  // pouvait jusqu'ici être vert alors que la spec livrée était fausse : elle n'était jamais
  // construite.
  const others = readdirSync(join(HERE, 'brands'))
    .filter(f => f.endsWith('.json') && f !== 'example.json' && !f.startsWith('_'));
  for (const f of others) {
    const dir = mkdtempSync(join(tmpdir(), 'cs-spec-'));
    try {
      execFileSync('node', [join(HERE, 'build.mjs'), join(HERE, 'brands', f), '--out', dir], { stdio: 'pipe' });
      ok(`build de brands/${f}`);
      printContract(JSON.parse(readFileSync(join(dir, 'data.json'), 'utf8')), basename(f, '.json'));
    } catch (e) {
      ko(`build de brands/${f}`, (e.stderr?.toString() || e.message || '').trim().split('\n')[0]);
    }
    rmSync(dir, { recursive: true, force: true });
  }
  if (!others.length) {
    console.log('  \x1b[33m•\x1b[0m Aucune spec cliente dans brands/ — seule la fixture est passée au contrat.');
  }
}

rmSync(out, { recursive: true, force: true });

console.log();
if (failed) {
  console.log(`\x1b[31m✗ ${failed} contrôle(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\x1b[32m✓ Tout est vert.\x1b[0m Le moteur est sain et générique, les pages tiennent debout.');
