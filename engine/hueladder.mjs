#!/usr/bin/env node
// La ligne de commande de Hueladder : les gestes du studio, pour une personne au terminal ou pour
// un agent. Tout passe par la spec, comme dans le studio : chaque commande la lit, certaines
// la réécrivent. Usage : node engine/hueladder.mjs help

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildData } from './lib/build.mjs';
import { applyNaming, NAMINGS } from './lib/naming.mjs';
import { parseInput, groupItems, normHex, slug } from './lib/import.mjs';
import { suggestSystem, suggestNeutral } from './lib/suggest.mjs';
import { diagnose, applyAction, describe, proposeGrouping } from './lib/diagnose.mjs';
import { compareMethods, compareDark } from './lib/compare.mjs';
import { contractChecks } from './lib/contract.mjs';
import { tokenTrees, usageGuide, guideData, migrationTable, cssVariables, tailwindConfig, tailwindTheme } from './lib/outputs.mjs';
import { packageFiles } from './lib/package.mjs';
import { readSource, auditSource, compareSources, diffVersions, decision, auditMarkdown, decisionMarkdown, verifyTokens, medianLadder, auditDark } from './lib/audit.mjs';
import { demoSpec, explainMarkdown, methodTable, lessons, choose, THESIS, FRAME, FAMILIES } from './lib/explain.mjs';
import { extractPairs, auditPairs, pairsMarkdown } from './lib/pairs.mjs';
import { isFigmaScan, figmaAudit, figmaMarkdown } from './lib/figma.mjs';
import { perceptualTrials, perceptualPage, perceptualSummary } from './lib/perceptual.mjs';
import { basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HELP_FR = `hueladder — échelles de couleur dont le nom porte le contraste

Trois entrées : créer un système, auditer l'existant, comprendre les méthodes.

  audit <fichier…> [--names A,B]        auditer une ou plusieurs palettes (marques, produits,
        [--diff] [--format decision]    versions) sans rien générer ; --diff compare deux
        [--dark <f> --bg #hex]          versions ; decision : la page « garder ou régénérer » ;
                                        --dark : le mode sombre déclaré de la première
  explain [spec]                        comprendre : la thèse, les leçons, une fiche par méthode,
                                        ce que chacune coûte, le guide de choix, l'argumentaire
                                        (sur un exemple neutre sans spec)
  perceptual [spec] [--out test.html]   la page du test perceptif (variantes du sombre et de l'éclat,
             --summary <r1.json…>        choix au clavier) ; --summary agrège des réponses
  figma <relevé.json>                   l'audit d'un fichier Figma relevé par engine/figma-scan.js :
                                        couleurs en dur, taux de liaison, libellés, doublons
  pairs <tokens.json>                   les paires par état (texte sur fond en survol, focus,
                                        pression…) d'un fichier de tokens sémantiques
  verify <tokens.json> [--dark <f>]     vérifier des tokens livrés : validité, monotonie, seuils
         [--bg #hex] [--rule N]         au même cran, règle du nom (N rangs ⇒ AA attendu)

  new <#hex> [--brand Nom]              une marque à partir d'une couleur → spec
  import <fichier> [--brand Nom]        une palette existante (hex, CSS, SCSS, Tailwind, DTCG,
                                        Tokens Studio) → spec ; dit ce qui n'a pas été lu
  suggest <spec> [--write] [--ladder]   le neutre et les couleurs système qui manquent ; --ladder :
                                        le barreau médian de la palette fournie
  diagnose <spec>                       les constats, chacun avec ses actions numérotées
  fix <spec> <constat> <action>         applique une action du diagnostic (numéros 1, 2…)
  group <spec> [--write]                le regroupement proposé d'un coup : familles en doublon
                                        fusionnées, couleurs hors famille déplacées
  compare <spec> [--dark] [--bg #hex]   les méthodes, et ce que chacune donnera au contrat
  check <spec>                          le contrat du système (code de sortie 1 si rouge)
  export <spec> --format <f>            css | tailwind | tailwind4 | dtcg | dtcg-dark | guide
                                        | palette | migration | package (dossier, --out)
  build <spec> [--out dossier]          le rapport, le régleur et tous les fichiers

  --out <chemin>   écrit dans un fichier (ou un dossier pour package/build) au lieu de stdout
  --json           sortie en données, pour un agent
  --lang fr        textes en français (sinon la langue de la spec, ou l'anglais)

Une commande qui modifie la spec (new, import, suggest --write, fix) l'écrit sur --out, ou
sur place pour suggest et fix.`;
const HELP_EN = `hueladder — color scales whose step names carry their contrast

Three ways in: create a system, audit what exists, understand the methods.

  audit <file…> [--names A,B]           audit one or several palettes (brands, products,
        [--diff] [--format decision]    versions) without generating anything; --diff compares
        [--dark <f> --bg #hex]          two versions; decision: the keep-or-regenerate page;
                                        --dark: the declared dark mode of the first one
  explain [spec]                        understand: the thesis, the lessons, one card per method,
                                        what each one costs, the choice guide, the pitch
                                        (on a neutral example without a spec)
  perceptual [spec] [--out test.html]   the perceptual test page (dark and chroma variants,
             --summary <r1.json…>        keyboard choices); --summary aggregates answers
  figma <scan.json>                     audit a Figma file scanned with engine/figma-scan.js:
                                        hard-coded colors, binding rate, labels, duplicates
  pairs <tokens.json>                   pairs by state (text on background on hover, focus,
                                        press…) in a semantic token file
  verify <tokens.json> [--dark <f>]     check delivered tokens: validity, monotonicity, thresholds
         [--bg #hex] [--rule N]         at the same step, naming rule (N ranks ⇒ AA expected)

  new <#hex> [--brand Name]             a brand from one color → spec
  import <file> [--brand Name]          an existing palette (hex, CSS, SCSS, Tailwind, DTCG,
                                        Tokens Studio) → spec; says what could not be read
  suggest <spec> [--write] [--ladder]   the missing neutral and system colors; --ladder: the
                                        median ladder of the supplied palette
  diagnose <spec>                       the findings, each with numbered actions
  fix <spec> <finding> <action>         apply one diagnosis action (numbers 1, 2…)
  group <spec> [--write]                the proposed regrouping in one go: duplicate families
                                        merged, off-family colors moved
  compare <spec> [--dark] [--bg #hex]   the methods, and what each one will give the contract
  check <spec>                          the system contract (exit code 1 if red)
  export <spec> --format <f>            css | tailwind | tailwind4 | dtcg | dtcg-dark | guide
                                        | palette | migration | package (folder, --out)
  build <spec> [--out folder]           the report, the tuner and every file

  --out <path>     write to a file (or a folder for package/build) instead of stdout
  --json           data output, for an agent
  --lang fr        French texts (otherwise the spec's language, or English)

A command that changes the spec (new, import, suggest --write, fix) writes it to --out, or
in place for suggest and fix.`;

const argv = process.argv.slice(2);
const flag = name => { const i = argv.indexOf('--' + name); return i < 0 ? null : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--json', '--dark', '--write', '--diff', '--ladder'].includes(argv[i - 1])));
const [cmd, ...args] = pos;
const asJson = !!flag('json');

const FR = flag('lang') === 'fr';
const L = (fr, en) => (FR ? fr : en);   // messages written before any spec is read
const HELP = FR ? HELP_FR : HELP_EN;
const die = msg => { console.error(msg); process.exit(1); };
const readSpec = p => { if (!p) die(L('spec manquante — ', 'missing spec — ') + cmd + ' <spec.json>'); return JSON.parse(readFileSync(resolve(p), 'utf8')); };
const langOf = spec => flag('lang') || (spec && spec.lang) || 'en';
const built = raw => { const spec = applyNaming(raw); return { spec, data: buildData(spec) }; };
const emit = (text, out = flag('out')) => { if (out && out !== true) { writeFileSync(resolve(out), text); console.error('→ ' + out); } else process.stdout.write(text.endsWith('\n') ? text : text + '\n'); };
const saveSpec = (spec, path) => emit(JSON.stringify(spec, null, 2) + '\n', path);
const base = brand => ({ id: slug(brand), brand, naming: 'grid', stepList: NAMINGS.grid.presets.standard.slice(), lang: flag('lang') || 'en', source: 'Hueladder' });

const commands = {
  help() { console.log(HELP); },

  audit() {
    if (!args.length) die(L('fichier attendu — hueladder audit <palette> [<autre palette>…]', 'file expected — hueladder audit <palette> [<other palette>…]'));
    const names = typeof flag('names') === 'string' ? flag('names').split(',') : [];
    const lang = flag('lang') || 'en';
    const sources = args.map((p, i) => readSource(readFileSync(resolve(p), 'utf8'), { name: names[i] || basename(p).replace(/\.[^.]+$/, ''), origin: p, lang }));
    const audits = sources.map(s => auditSource(s, { lang }));
    const cross = audits.length > 1 ? compareSources(audits) : null;
    const diff = flag('diff') ? (sources.length === 2 ? diffVersions(sources[0], sources[1]) : die(L('--diff compare exactement deux versions', '--diff compares exactly two versions'))) : null;
    const darkPath = typeof flag('dark') === 'string' ? flag('dark') : null;
    const dark = darkPath ? [{ of: sources[0].name, ...auditDark(sources[0], readSource(readFileSync(resolve(darkPath), 'utf8'), { name: 'dark', lang }), { background: typeof flag('bg') === 'string' ? flag('bg') : '#121212', lang }) }] : [];
    if (flag('format') === 'decision') {
      return emit(audits.map(a => decisionMarkdown(decision(a), { lang, brand: a.name })).join('\n---\n\n'));
    }
    // les données brutes du moteur restent dans le moteur : un agent lit les constats et les mesures
    const lean = a => { const { spec, data, ...rest } = a; return { ...rest, decision: (({ chosen, fallback, ...d }) => ({ ...d, fallback: fallback && fallback.method }))(decision(a)) }; };
    if (asJson) return emit(JSON.stringify({ audits: audits.map(lean), cross, diff, dark }, null, 2));
    emit(auditMarkdown({ audits, cross, diff, dark }, { lang }));
  },

  perceptual() {
    if (flag('summary')) {
      const files = argv.filter(a => a.endsWith('.json')).map(p => JSON.parse(readFileSync(resolve(p), 'utf8')));
      return emit(JSON.stringify(perceptualSummary(files), null, 2));
    }
    const raw = args[0] ? readSpec(args[0]) : demoSpec(flag('lang') || 'en');
    emit(perceptualPage(perceptualTrials(raw), { lang: langOf(raw), title: raw.brand || 'Hueladder' }), typeof flag('out') === 'string' ? flag('out') : 'hueladder-test-perceptif.html');
  },

  figma() {
    if (!args[0]) die(L('relevé attendu — hueladder figma <figma-scan.json> (produit par engine/figma-scan.js)', 'scan expected — hueladder figma <figma-scan.json> (made by engine/figma-scan.js)'));
    const j = JSON.parse(readFileSync(resolve(args[0]), 'utf8'));
    if (!isFigmaScan(j)) die(L('ce fichier n\'est pas un relevé de engine/figma-scan.js', 'this file is not a scan from engine/figma-scan.js'));
    const a = figmaAudit(j);
    if (asJson) return emit(JSON.stringify(a, null, 2));
    emit(figmaMarkdown(a, { lang: flag('lang') || 'en' }));
  },

  pairs() {
    if (!args[0]) die(L('fichier de tokens attendu — hueladder pairs <tokens.json>', 'token file expected — hueladder pairs <tokens.json>'));
    const p = extractPairs(readFileSync(resolve(args[0]), 'utf8'));
    if (!p.length) die(L('aucune paire lue : il faut des chemins qui portent un rôle (fg, bg, text, border…) et, s\'il y en a, un état (hover, focus…)', 'no pair read: paths need a role (fg, bg, text, border…) and, if any, a state (hover, focus…)'));
    const r = auditPairs(p);
    if (asJson) emit(JSON.stringify(r, null, 2)); else emit(pairsMarkdown(r, { lang: flag('lang') || 'en' }));
    if (r.totals.invisible || r.totals.fail) process.exitCode = 1;
  },

  verify() {
    if (!args[0]) die(L('fichier de tokens attendu — hueladder verify <tokens.json>', 'token file expected — hueladder verify <tokens.json>'));
    const lang = flag('lang') || 'en', expect = flag('rule') ? Number(flag('rule')) : null;
    const runs = [['light', args[0], undefined]];
    if (typeof flag('dark') === 'string') runs.push(['dark', flag('dark'), typeof flag('bg') === 'string' ? flag('bg') : undefined]);
    const all = runs.map(([mode, p, background]) => ({ mode, file: p, checks: verifyTokens(readFileSync(resolve(p), 'utf8'), { mode, background, lang, expect }) }));
    if (asJson) emit(JSON.stringify(all, null, 2));
    else for (const r of all) { console.log(r.file); for (const c of r.checks) console.log(`  ${c.info ? '·' : c.pass ? '✓' : '✗'} ${c.label} — ${c.detail}`); }
    if (all.some(r => r.checks.some(c => !c.pass))) process.exitCode = 1;
  },

  explain() {
    const raw = args[0] ? readSpec(args[0]) : demoSpec(flag('lang') || 'en');
    const lang = langOf(raw), { data } = built(raw);
    if (asJson) return emit(JSON.stringify({ demo: !args[0], frame: FRAME[lang === 'en' ? 'en' : 'fr'], families: FAMILIES.map(f => ({ key: f.key, methods: f.methods, ...Object.fromEntries([['title', f[lang === 'en' ? 'en' : 'fr'][0]], ['text', f[lang === 'en' ? 'en' : 'fr'][1]]]) })),
      thesis: THESIS[lang === 'en' ? 'en' : 'fr'], methods: methodTable(data), lessons: lessons(data, { lang }), guide: choose(data, { lang }) }, null, 2));
    if (!args[0]) console.error(lang === 'en' ? 'Synthetic example (no real brand colors). hueladder explain <spec> for yours.' : 'Exemple synthétique (aucune couleur de client). hueladder explain <spec> pour les tiennes.');
    emit(explainMarkdown(data, { lang }));
  },

  new() {
    const hex = normHex(args[0] || '')?.hex;
    if (!hex) die(L('couleur attendue, par exemple : hueladder new "#2f5bd3" --brand Acme', 'color expected, for example: hueladder new "#2f5bd3" --brand Acme'));
    const brand = flag('brand') || 'Brand';
    saveSpec({ ...base(brand), pinDefault: true, ramps: [{ name: slug(brand), label: brand, kind: 'brand', anchors: { default: hex } }] });
  },

  import() {
    if (!args[0]) die(L('fichier attendu', 'file expected'));
    const res = parseInput(readFileSync(resolve(args[0]), 'utf8'));
    if (res.spec) return saveSpec(res.spec);
    if (!res.items.length) die(L('aucune couleur lisible', 'no readable color'));
    const spec = { ...base(flag('brand') || 'Brand'), pinDefault: false, ramps: groupItems(res.items) };
    // ce qui n'a pas été lu se dit, avec la raison : rien ne disparaît en silence
    const en = spec.lang !== 'fr';
    console.error(en ? `${res.items.length} colors read of ${res.seen}, ${spec.ramps.length} ramps.` : `${res.items.length} couleurs lues sur ${res.seen}, ${spec.ramps.length} nuanciers.`);
    for (const d of res.dropped) console.error(`  ${en ? 'dropped:' : 'écartée :'} ${d.path.join('.')} = ${d.value} (${d.why})`);
    saveSpec(spec);
  },

  suggest() {
    const spec = readSpec(args[0]), lang = langOf(spec);
    if (flag('ladder')) {
      const { spec: s, data } = built(spec), m = medianLadder(s, data);
      if (!m) die(lang === 'fr' ? 'pas assez de crans nommés dans la palette pour un barreau médian' : 'not enough named steps in the palette for a median ladder');
      if (flag('write')) { spec.ladders = { ...(spec.ladders || {}), shadeLadder: m.shadeLadder }; return saveSpec(spec, flag('out') || args[0]); }
      if (asJson) return emit(JSON.stringify(m, null, 2));
      const fr = lang === 'fr';
      for (const g of m.steps) console.log(`${g.step.padStart(5)}  ${fr ? 'médiane' : 'median '} ${String(g.median).padStart(7)}  ${fr ? 'défaut' : 'default'} ${String(g.default).padStart(7)}  ${fr ? 'écart' : 'gap'} ${g.gap}${g.n ? '' : fr ? '  (interpolé)' : '  (interpolated)'}`);
      return console.log(fr ? `\nécart max ${m.maxGap} shade${m.monotone ? '' : ' — ne descend pas : pas une règle'} ; --write pour l'adopter.` : `\nmax gap ${m.maxGap} shade${m.monotone ? '' : ' — does not descend: not a rule'}; --write to adopt it.`);
    }
    const add = [suggestNeutral(spec.ramps, lang), ...suggestSystem(spec.ramps, lang)].filter(Boolean);
    if (flag('write')) { spec.ramps.push(...add); return saveSpec(spec, flag('out') || args[0]); }
    if (asJson) return emit(JSON.stringify(add, null, 2));
    if (!add.length) return console.log(lang === 'fr' ? 'Rien ne manque : un neutre et les quatre couleurs système sont là.' : 'Nothing is missing: a neutral and the four system colors are there.');
    for (const r of add) console.log(`${r.kind.padEnd(8)} ${r.name.padEnd(10)} ${r.anchors.default}`);
    console.log(lang === 'fr' ? '\n--write pour les ajouter à la spec.' : '\n--write to add them to the spec.');
  },

  diagnose() {
    const raw = readSpec(args[0]), lang = langOf(raw), { data } = built(raw);
    const fs = diagnose(data, raw.ramps, { accepted: (raw.accepted || []).map(a => a.key) });
    if (asJson) return emit(JSON.stringify(fs.map(f => ({ ...f, ...describe(f, data, lang) })), null, 2));
    if (!fs.length) return console.log(lang === 'en' ? 'Nothing to report.' : 'Rien à signaler.');
    fs.forEach((f, i) => {
      const d = describe(f, data, lang);
      console.log(`${i + 1}. [${f.sev === 'bad' ? '✗' : '!'}] ${d.kind} — ${d.title}\n   ${d.text}`);
      d.actions.forEach((a, k) => console.log(`   ${i + 1}.${k + 1} ${a}`));
    });
    console.log(lang === 'en' ? '\nhueladder fix <spec> <finding> <action> to apply one.' : '\nhueladder fix <spec> <constat> <action> pour en appliquer une.');
  },

  group() {
    const raw = readSpec(args[0]), lang = langOf(raw), { data } = built(raw);
    const g = proposeGrouping(data, raw.ramps, { accepted: (raw.accepted || []).map(a => a.key), lang });
    if (flag('write')) {
      if (!g.steps.length) return console.error(lang === 'fr' ? 'rien à regrouper' : 'nothing to regroup');
      raw.ramps = g.ramps; raw.notes = [...(Array.isArray(raw.notes) ? raw.notes : []), ...g.notes];
      return saveSpec(raw, flag('out') || args[0]);
    }
    if (asJson) return emit(JSON.stringify({ steps: g.steps, notes: g.notes }, null, 2));
    if (!g.steps.length) return console.log(lang === 'en' ? 'Nothing to regroup.' : 'Rien à regrouper.');
    g.notes.forEach((n, i) => console.log(`${i + 1}. ${n}`));
    console.log(lang === 'en' ? '\n--write to apply them all.' : '\n--write pour tout appliquer.');
  },

  fix() {
    const [path, n, k] = args;
    const raw = readSpec(path), lang = langOf(raw), { data } = built(raw);
    const fs = diagnose(data, raw.ramps, { accepted: (raw.accepted || []).map(a => a.key) });
    const f = fs[Number(n) - 1], action = f && f.actions[Number(k) - 1];
    if (!action) die(lang === 'fr' ? `pas de constat ${n} ou d'action ${k} — voir hueladder diagnose ${path}` : `no finding ${n} or action ${k} — see hueladder diagnose ${path}`);
    const res = applyAction(raw.ramps, f, action, data);
    raw.ramps = res.ramps;
    if (res.accept) {
      const note = describe(f, data, lang).note;
      raw.accepted = [...(raw.accepted || []), { key: res.accept.key, note }];
      raw.notes = [...(Array.isArray(raw.notes) ? raw.notes : []), note];
    }
    if (res.method) { raw.coreMethod = res.method; delete raw.tunedBase; raw.ramps = raw.ramps.map(({ tuned, ...r }) => r); }
    console.error('✓ ' + describe(f, data, lang).actions[Number(k) - 1]);
    saveSpec(raw, flag('out') || path);
  },

  compare() {
    const raw = readSpec(args[0]), lang = langOf(raw), { data } = built(raw);
    if (flag('dark')) {
      const background = typeof flag('bg') === 'string' ? flag('bg') : undefined;
      const rows = compareDark(data, { background, profile: raw.darkMode?.chromaProfile === 'bell' ? 'bell' : 'aligned', attenuate: raw.darkMode?.desaturate || 0 });
      if (asJson) return emit(JSON.stringify(rows, null, 2));
      for (const r of rows) {
        const en = lang === 'en';
        const W = en ? { rule: 'naming rule', thresh: 'AA threshold moved', mono: 'order', cross: 'interchangeability', oob: 'out of budget' }
          : { rule: 'règle du nom', thresh: 'seuil AA déplacé', mono: 'ordre', cross: 'interchangeabilité', oob: 'hors budget' };
        const w = r.wcagCount ? `✗ WCAG 2${en ? ':' : ' :'} ${Object.entries(r.wcag).filter(([, v]) => v).map(([k, v]) => `${W[k]} ${v}`).join(', ')}` : (en ? '✓ WCAG 2: rule held' : '✓ WCAG 2 : règle tenue');
        const a = r.apca.below ? (en ? `✗ APCA: ${r.apca.below} steps lose more than 5 Lc (worst ${r.apca.worst})` : `✗ APCA : ${r.apca.below} crans perdent plus de 5 Lc (pire ${r.apca.worst})`) : (en ? '✓ APCA: readability kept' : '✓ APCA : lisibilité gardée');
        console.log(`${r.method.padEnd(13)} ${w.padEnd(48)} ${a}`);
      }
      return;
    }
    const rows = compareMethods(data, { lang });
    if (asJson) return emit(JSON.stringify(rows.map(({ fails, ...r }) => ({ ...r, fails: fails.map(f => f.label + ' — ' + f.detail) })), null, 2));
    const en = lang === 'en';
    for (const r of rows) console.log(`${r.method.padEnd(14)} ${r.holds ? (en ? '✓ contract held  ' : '✓ contrat tenu   ') : `✗ ${String(r.fails.length).padStart(2)} ${en ? 'check(s)    ' : 'contrôle(s)  '}`} ΔE ${r.deltaE.toFixed(1).padStart(5)}   ${en ? 'crossings' : 'croisements'} ${r.crossings}`);
  },

  check() {
    const raw = readSpec(args[0]), { data } = built(raw);
    const checks = contractChecks(data, '', { lang: langOf(raw) });
    if (asJson) emit(JSON.stringify(checks, null, 2));
    else for (const c of checks) console.log(`${c.pass ? '✓' : '✗'} ${c.label} — ${c.detail}`);
    if (checks.some(c => !c.pass)) process.exitCode = 1;
  },

  export() {
    const raw = readSpec(args[0]), lang = langOf(raw), { spec, data } = built(raw);
    const format = flag('format');
    const one = {
      css: () => cssVariables(spec, data),
      tailwind: () => tailwindConfig(spec, data, { lang }),
      tailwind4: () => tailwindTheme(spec, data),
      dtcg: () => JSON.stringify(tokenTrees(spec, data, 'light', { lang }).tokens, null, 2),
      'dtcg-dark': () => (data.meta.dark ? JSON.stringify(tokenTrees(spec, data, 'dark', { lang }).tokens, null, 2) : die(lang === 'fr' ? 'pas de mode sombre dans cette spec' : 'no dark mode in this spec')),
      guide: () => usageGuide(spec, data, { lang }),
      palette: () => JSON.stringify(guideData(spec, data), null, 2),
      migration: () => migrationTable(spec, data, { lang }),
    };
    if (format === 'package') {
      const dir = resolve(typeof flag('out') === 'string' ? flag('out') : '.');
      const files = packageFiles(spec, data, { lang, specJson: raw, audit: raw.pinDefault === false });
      for (const [p, c] of files) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), c); }
      return console.error(`→ ${files.length} ${lang === 'en' ? 'files in' : 'fichiers dans'} ${join(dir, files[0][0].split('/')[0])}`);
    }
    if (!one[format]) die((lang === 'fr' ? '--format attendu : ' : '--format expected: ') + [...Object.keys(one), 'package'].join(', '));
    emit(one[format]());
  },

  build() {
    const r = spawnSync(process.execPath, [join(HERE, 'build.mjs'), ...argv.slice(1)], { stdio: 'inherit' });
    process.exitCode = r.status;
  },
};

(commands[cmd] || (() => { console.log(HELP); if (cmd) process.exitCode = 1; }))();
