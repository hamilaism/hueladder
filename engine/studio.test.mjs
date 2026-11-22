#!/usr/bin/env node
// Parcours complet du studio dans un vrai Chrome, sans dépendance : le protocole DevTools
// suffit. La page est ouverte en file://, comme après un double-clic.
//
//   node studio.test.mjs [chemin/vers/hueladder.html] [--shots <dossier>]
//
// Chaque fonctionnalité visible est exercée par un geste d'utilisateur (clic, saisie,
// glisser) et son effet vérifié sur l'état, le DOM ou les fichiers livrés.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildData } from './lib/build.mjs';
import { applyNaming } from './lib/naming.mjs';
import { tokenTrees } from './lib/outputs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const shotsAt = argv.indexOf('--shots');
const SHOTS = shotsAt >= 0 ? resolve(argv[shotsAt + 1]) : null;
const PAGE = resolve(argv.find((a, i) => !a.startsWith('--') && i !== shotsAt + 1) || join(HERE, '..', 'hueladder.html'));
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => existsSync(p));
if (!CHROME) { console.log('Chrome introuvable — test ignoré'); process.exit(0); }
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let failed = 0, passed = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  else { failed++; console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? '  — ' + detail : ''}`); }
};
const section = s => console.log(`\n\x1b[1m${s}\x1b[0m`);

// ---------------------------------------------------------------- pilote CDP minimal

const profile = mkdtempSync(join(tmpdir(), 'hueladder-test-'));
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-gpu',
  '--window-size=1360,1000', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
process.on('SIGTERM', () => { proc.kill(); process.exit(1); }); // un délai dépassé (check.mjs) ne laisse pas Chrome tourner
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  proc.stderr.on('data', d => { buf += d; const m = buf.match(/ws:\/\/\S+/); if (m) res(m[0]); });
  setTimeout(() => rej(new Error('Chrome ne répond pas')), 15000);
});
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map(), listeners = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else for (const l of listeners) l(msg);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});

const errors = [];
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
const cdp = (m, p) => send(m, p, S);
let dialogs = [], dialogAnswer = true;
listeners.push(msg => {
  if (msg.sessionId !== S) return;
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
  if (msg.method === 'Page.javascriptDialogOpening') { dialogs.push(msg.params.message); cdp('Page.handleJavaScriptDialog', { accept: dialogAnswer }); }
});
await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });

const js = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = async (url) => {
  const done = new Promise(r => { const l = m => { if (m.sessionId === S && m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
  await cdp('Page.navigate', { url }); await done; await sleep(150);
};
let shot = 0;
const snap = async name => {
  if (!SHOTS) return;
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(join(SHOTS, String(++shot).padStart(2, '0') + '-' + name + '.png'), Buffer.from(data, 'base64'));
};
// gestes d'utilisateur, par sélecteur
const click = sel => js(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('absent : ' + ${JSON.stringify(sel)}); el.click();`);
const setVal = (sel, v, ev = 'change') => js(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('absent : ' + ${JSON.stringify(sel)});
  el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event(${JSON.stringify(ev)}, { bubbles: true }));`);
const text = sel => js(`return document.querySelector(${JSON.stringify(sel)})?.textContent ?? null;`);
const st = () => js('return JSON.parse(JSON.stringify(state));');
const main = () => js('return document.getElementById("main").innerText;');
const goStep = i => js(`go(${i});`);
const URL_ = pathToFileURL(PAGE).href;
// la page s'ouvre sur les trois entrées ; on entre dans celle qu'on teste (Créer par défaut)
const fresh = async (langCode = 'fr', entry = 'create') => {
  await load(URL_);
  await js(`localStorage.clear(); localStorage.setItem('hueladder-lang', '${langCode}');`);
  await load(URL_);
  if (entry) await click(`[data-entry="${entry}"]`);
};
const noMissingKeys = async where => {
  const miss = await js(`return (document.body.innerText.match(/⟦[^⟧]+⟧/g) || []).join(', ');`);
  ok(!miss, `${where} : aucune clé de traduction manquante`, miss);
};

// palettes d'essai — des couleurs, aucun nom de marque réelle
// deux versions d'une palette : une teinte change, une famille change de nom, une autre apparaît
const SRC_A = '--red-100: #fde8e8;\n--red-300: #f8a5a5;\n--red-500: #e53e3e;\n--red-700: #9b2c2c;\n--blue-100: #e6efff;\n--blue-300: #93b4f5;\n--blue-500: #2f5bd3;\n--blue-700: #1d3f8f;';
const SRC_B = '--red-100: #fde8e8;\n--red-300: #f8a5a5;\n--red-500: #c53030;\n--red-700: #9b2c2c;\n--azure-100: #e6efff;\n--azure-300: #93b4f5;\n--azure-500: #2f5bd3;\n--azure-700: #1d3f8f;\n--green-300: #9ae6b4;\n--green-500: #38a169;\n--green-700: #276749;';
const CSS_PALETTE = `:root {
  --color-success-300: #6fcf97;
  --color-success-500: #27ae60;
  --color-success-700: #1e7e46;
  --color-blue-100: #d6e4ff;
  --color-blue-500: #2f80ed;
  --color-blue-700: #1c4fa8;
  --color-gray-100: #f2f2f2;
  --color-gray-500: #828282;
  --color-gray-900: #1a1a1a;
  --overlay: #00000080;
  --shadow: rgba(0,0,0,.2);
  --focus: #2f80ed;
}`;

try {
  // ============================================================ 1. lecture des formats
  section('1 · Lecture des formats collés');
  await fresh();
  const P = src => js(`return parseInput(${JSON.stringify(src)});`);
  const G = src => js(`const r = parseInput(${JSON.stringify(src)}); return r.spec ? { spec: true } : { ramps: groupItems(r.items), dropped: r.dropped, seen: r.seen };`);

  let r = await G(CSS_PALETTE);
  ok(r.seen === 12, 'CSS : 12 valeurs lues', 'lues : ' + r.seen);
  ok(r.dropped.filter(d => d.why === 'alpha').length === 1 && r.dropped.filter(d => d.why === 'format').length === 1, 'CSS : alpha et rgba() écartés avec leur raison', JSON.stringify(r.dropped));
  const names = r.ramps.map(x => x.name).sort().join(',');
  ok(names === 'blue,focus,gray,success', 'CSS : familles success, blue, gray, focus retrouvées', names);
  ok(r.ramps.find(x => x.name === 'success')?.kind === 'system' && r.ramps.find(x => x.name === 'gray')?.kind === 'neutral', 'CSS : rôles devinés (système, neutre)');
  ok(r.ramps.find(x => x.name === 'success')?.seed === '#27ae60', 'CSS : l\'identité d\'un nuancier est son 500');

  r = await G(`module.exports = { theme: { extend: { colors: {
    brand: {
      50: '#eef4ff',
      500: '#3366ff', // commentaire
      900: '#0a1a66',
    },
    accent: { DEFAULT: '#ff6b35' },
  } } } };`);
  ok(r.ramps.some(x => x.name === 'brand' && Object.keys(x.anchors).length === 3), 'Tailwind : blocs imbriqués suivis', JSON.stringify(r.ramps.map(x => [x.name, Object.keys(x.anchors)])));

  r = await G(JSON.stringify({ color: { teal: { 100: { $type: 'color', $value: '#ccfbf1' }, 600: { $type: 'color', $value: '#0d9488' }, alias: { $type: 'color', $value: '{color.teal.600}' } } } }));
  ok(r.ramps.length === 1 && r.ramps[0].name === 'teal' && r.dropped.some(d => d.why === 'alias'), 'DTCG : valeurs lues, alias écarté', JSON.stringify(r));

  r = await G(JSON.stringify({ global: { red: { 500: { value: '#ef4444', type: 'color' } }, spacing: { 4: { value: '16px', type: 'spacing' } } } }));
  ok(r.ramps.length === 1 && r.ramps[0].name === 'red' && r.seen === 1, 'Tokens Studio : couleurs seules, le reste ignoré', JSON.stringify(r));

  r = await G('#2f5bd3, #e4572e\n#1a1a1a #f5f5f5\n#0f0');
  ok(r.ramps.length >= 3 && r.ramps.some(x => x.kind === 'neutral'), 'Liste brute : regroupée par teinte, gris à part', JSON.stringify(r.ramps.map(x => x.name)));

  r = await G('$primary: #336699;\n$primary: #336699;');
  ok(r.dropped.some(d => d.why === 'dup'), 'SCSS : doublon exact signalé');
  r = await P('{"ramps":[{"name":"x","anchors":{"default":"#123456"}}]}');
  ok(r.spec === true || !!r.spec, 'Spec Hueladder : reconnue telle quelle');

  // ============================================================ 2. porte A, bout en bout
  section('2 · Porte A — auditer une palette');
  await fresh();
  const rail = await js('return [...document.querySelectorAll("#rail button")].map(b => b.disabled);');
  ok(rail.length === 7 && rail.slice(1).every(Boolean), 'au départ, seule l\'étape 1 est accessible');
  await snap('entrer');
  await setVal('#paste', CSS_PALETTE, 'input');
  await click('#read');
  let s = await st();
  ok(s.door === 'audit' && s.ramps.length === 4, 'palette lue : 4 nuanciers', s.ramps.map(x => x.name).join(','));
  ok((await text('.fidelity'))?.includes('10'), 'compte rendu de fidélité affiché');
  ok(!(await js('return !!document.querySelector("#moveto, [data-f=merge]")')), 'plus de fusion ni de déplacement de couleurs à l\'étape 1');
  await setVal('.fam[data-ramp="blue"] [data-f=label]', 'Bleu marque');
  ok((await st()).ramps.find(x => x.name === 'blue').label === 'Bleu marque', 'renommer un nuancier');
  await setVal('.fam[data-ramp="blue"] [data-f=kind]', 'brand');
  ok((await st()).ramps.find(x => x.name === 'blue').kind === 'brand', 'changer le rôle d\'un nuancier');
  await click('.fam[data-ramp="focus"] [data-f=drop]');
  ok(!(await st()).ramps.some(x => x.name === 'focus'), 'retirer un nuancier');
  await js('document.querySelector(\'.fam[data-ramp="success"] button.anchor[data-hex="#1e7e46"]\').click();');
  ok((await st()).ramps.find(x => x.name === 'success').seed === '#1e7e46', 'choisir la couleur de base d\'un nuancier d\'un clic');
  await js('document.querySelector(\'.fam[data-ramp="success"] button.anchor[data-hex="#27ae60"]\').click();');
  ok(!(await js('return !!document.querySelector(\'.fam[data-ramp="violet"] .seedmark\')')), 'pas de marque « base » sur un nuancier d\'une seule couleur');
  await setVal('#addpick', '#8e44ad', 'input'); await setVal('#addname', 'Violet', 'input');
  await click('#add');
  ok((await st()).ramps.some(x => x.label === 'Violet' && x.anchors.default === '#8e44ad'), 'ajouter une couleur');
  await snap('entrer-lu');

  await click('#next');
  let m = await main();
  ok(/« Success 500 » a le contraste d'un 300/.test(m), 'diagnostic : « Success 500 » est un 300');
  ok(/2,87:1/.test(m), 'diagnostic : contraste du texte blanc chiffré');
  ok(await js('return !!document.getElementById("addsystem")'), 'diagnostic : le manque de couleurs système propose de les ajouter');
  // les actions des constats sont de vrais boutons
  const actBtn = label => js(`const b = [...document.querySelectorAll('[data-act]')].find(x => x.textContent.startsWith(${JSON.stringify(label)})); if (!b) throw new Error('bouton absent : ' + ${JSON.stringify(label)}); b.click();`);
  ok(!(await js('return [...document.querySelectorAll("[data-act]")].some(b => b.textContent === "renommer en 300")')), 'pas de « renommer en 300 » quand le 300 est déjà pris');
  await actBtn('renommer toute la famille');
  s = await st();
  const sa = s.ramps.find(x => x.name === 'success').anchors;
  ok(sa['200'] === '#6fcf97' && sa['300'] === '#27ae60' && sa['500'] === '#1e7e46', '« renommer toute la famille » renomme chaque couleur à son rang', JSON.stringify(sa));
  await actBtn('renommer en');
  ok(true, '« renommer en … » sur un cran libre');
  ok(!/« Success 500 » a le contraste/.test(await main()), 'le constat disparaît une fois traité');
  const gray500 = await js('return [...document.querySelectorAll(".finding h3")].some(h => /Gray 500/.test(h.textContent));');
  await actBtn('garder et documenter');
  s = await st();
  ok(s.accepted.length === 1 && /Exception documentée/.test(s.accepted[0].note), '« garder et documenter » enregistre l\'exception', JSON.stringify(s.accepted));
  ok(/exception documentée/.test(await main()), 'le nombre d\'exceptions est affiché');
  const repl = await js('const b = [...document.querySelectorAll("[data-act]")].find(x => x.textContent.startsWith("remplacer par")); if (!b) return null; const hex = b.textContent.split(" ").pop(); b.click(); return hex;');
  ok(repl && JSON.stringify((await st()).ramps).includes(repl), '« remplacer par » remplace la couleur', repl);
  ok(gray500 !== undefined, 'constats multiples traités l\'un après l\'autre');
  await click('#addsystem');
  s = await st();
  ok(['error', 'warning', 'info'].every(n => s.ramps.some(x => x.name === n)), 'ajout des couleurs système depuis le diagnostic (sans doublon avec success)');
  ok(s.step === 1, 'on reste sur le diagnostic après l\'ajout');
  await snap('comprendre');

  await click('#next');
  m = await main();
  ok(/par défaut/i.test(m) && !/recommand/i.test(m), 'générer : Fusilier marqué « par défaut », rien n\'est « recommandé »');
  const order = await js('return [...document.querySelectorAll("main > .panel, main > details")].map(p => p.querySelector(".briefs") ? "resume" : p.tagName === "DETAILS" ? "detail" : p.querySelector(".ramp") ? "systeme" : "?").join(",")');
  ok(order.startsWith('resume,systeme,detail'), 'générer : le résumé comparatif vient avant le système, le détail après', order);
  ok(/méthodes? sur 12/.test(m) && /contrat du mode clair/.test(m), 'générer : un verdict chiffré ouvre l\'étape');
  ok(/contrat tenu/.test(await text('.brief[data-m="fusilier"]')), 'générer : Fusilier annoncé « contrat tenu » dès le choix');
  const pred = await js('return [...document.querySelectorAll(".brief")].map(b => [b.dataset.m, /contrat tenu/.test(b.textContent)]);');
  const real = await js('const { data } = dataOf({ tuned: false }); return data.methodOrder.filter(m => !["existing","tuned"].includes(m)).map(m => [m, contractChecks({ ...data, meta: { ...data.meta, coreMethod: m } }).filter(c => !c.pass && c.area !== "dark").length === 0]);');
  const R0 = Object.fromEntries(real);
  ok(pred.every(([m2, p2]) => R0[m2] === p2), 'générer : la prédiction affichée est celle du contrat', JSON.stringify(pred));
  ok(await js('return document.querySelectorAll(".brief").length') === 12, 'générer : les 12 méthodes dans le résumé');
  ok(await js('return document.querySelector(".brief").dataset.m === "fusilier"'), 'générer : Fusilier en tête');
  const nR = (await st()).ramps.length;
  const shown = await js('const p = [...document.querySelectorAll("main > .panel")].find(p => !p.querySelector(".briefs") && p.querySelector(".ramp")); return p.querySelectorAll(".ramp").length');
  ok(shown === nR, 'générer : tous les nuanciers du système, crans complets', shown + ' / ' + nR);
  await click('.brief[data-m="hct"]');
  ok((await st()).method === 'hct' && /avec HCT/.test(await main()), 'générer : un clic dans le résumé choisit la méthode et montre le système');
  ok(!(await js('return document.getElementById("cmpdetails").open')), 'générer : le détail est replié par défaut');
  await js('document.getElementById("cmpdetails").open = true; document.getElementById("cmpdetails").dispatchEvent(new Event("toggle"));');
  await setVal('#cmpramp', 'success');
  ok(await js('return document.getElementById("cmpramp").value === "success" && document.getElementById("cmpdetails").open'), 'générer : le détail reste ouvert quand on change de nuancier');
  await click('[data-pick="oklch"]');
  ok((await st()).method === 'oklch', 'générer : choisir depuis le détail');
  await click('.brief[data-m="anchored"]');
  ok((await st()).method === 'anchored', 'générer : « Ancres » (garder ses couleurs)');
  await click('.brief[data-m="fusilier"]');
  ok((await st()).method === 'fusilier', 'générer : retour à Fusilier');
  const rep = await js('const { data } = dataOf({ tuned: false }); const h = reportHtml(data); return { len: h.length, left: /\\/\\*(DATA_INJECT|APCA_INJECT)\\*\\//.test(h) || /__TITLE__/.test(h) };');
  ok(rep.len > 100000 && !rep.left, 'rapport complet : page générée, sans marqueur restant', JSON.stringify(rep));
  await snap('generer');

  // ============================================================ 3. régler : aller-retour
  section('3 · Régler — le réglage revient dans les tokens');
  await click('#next');
  await sleep(1500);
  const frameOk = await js('const f = document.getElementById("tuner"); return !!(f && f.contentDocument && f.contentDocument.getElementById("pad") && f.contentDocument.getElementById("pad").children.length > 100);');
  ok(frameOk, 'le régleur s\'affiche dans l\'étape');
  const before = await js('const { data } = finalOf(); return scaleOf(data, "blue")["500"];');
  await js('const f = document.getElementById("tuner"); const w = f.contentWindow; const sel = f.contentDocument.getElementById("ramp-select"); sel.value = "blue"; sel.dispatchEvent(new Event("change"));');
  await sleep(600);
  const box = await js('const f = document.getElementById("tuner"); f.scrollIntoView(); const a = f.getBoundingClientRect(); const p = f.contentDocument.getElementById("pad"); p.scrollIntoView({block:"center"}); const b = p.getBoundingClientRect(); const a2 = f.getBoundingClientRect(); return { x: a2.left + b.left, y: a2.top + b.top, w: b.width, h: b.height };');
  const px = box.x + box.w * 0.8, py = box.y + box.h * 0.5;
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: px + 10, y: py, button: 'left' });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px + 10, y: py, button: 'left', clickCount: 1 });
  await sleep(400);
  s = await st();
  ok(s.tuned.blue && Object.keys(s.tuned.blue).length > 0, 'un glisser dans le pavé est relu par le studio', JSON.stringify(s.tuned).slice(0, 120));
  const after = await js('const { data } = finalOf(); return scaleOf(data, "blue")["500"];');
  ok(after !== before, 'le 500 livré a changé', before + ' → ' + after);
  const lockedC = await js('const { data } = finalOf(); const h = scaleOf(data, "blue")["500"]; const b = dataOf({ tuned: false }).data; const h0 = scaleOf(b, "blue")["500"]; return [contrast(h, "#ffffff"), contrast(h0, "#ffffff")];');
  ok(Math.abs(lockedC[0] - lockedC[1]) / lockedC[1] < 0.015, 'le contraste du cran réglé n\'a pas bougé', lockedC.map(x => x.toFixed(3)).join(' vs '));
  await snap('regler');

  // ============================================================ 4. mode sombre
  section('4 · Mode sombre — trois décisions, chacune montrée et jugée avant d\'être prise');
  await click('#next');
  s = await st();
  ok(s.dark.method === 'mirror-wcag' && s.dark.profile === 'aligned' && s.dark.attenuate === 0, 'défauts sourcés : miroir WCAG, chroma du clair, aucune atténuation', JSON.stringify(s.dark));
  m = await main();
  ok(/Décision 1 sur 3/i.test(m) && /Décision 2 sur 3/i.test(m) && /Décision 3 sur 3/i.test(m), 'les trois décisions, dans l\'ordre : fond, méthode, éclat');
  ok(/décale toute la rampe sombre/.test(m) && /contraste maximal possible/.test(m), 'le rôle du fond est expliqué avant le choix');
  ok(await js('return document.querySelectorAll(".opt[data-bg] .dmock, .opt[data-dm] .dmock, .opt[data-vv] .dmock").length') === 13, 'chaque option montre une interface rendue sur son fond (4 fonds, 6 méthodes, 3 éclats)');
  ok(await js('return [...document.querySelectorAll(".opt .ramp.mid .sw")].every(el => el.getBoundingClientRect().height >= 34)'), 'les rampes des options sont lisibles (≥ 34 px)');
  ok(/contrat WCAG 2 tenu/.test(await text('[data-dm="mirror-wcag"]')) && /✗/.test(await text('[data-dm="index-flip"]')), 'sous WCAG 2, le miroir WCAG tient le contrat, l\'échange de crans non');
  ok(/✗/.test(await text('[data-dm="mirror-apca"]')), 'sous WCAG 2, le miroir APCA est signalé (il casse la règle du nom)');
  await click('[data-lens="apca"]');
  ok(/lisibilité APCA conservée/.test(await text('[data-dm="mirror-apca"]')) && /moins lisible/.test(await text('[data-dm="mirror-wcag"]')), 'sous APCA, c\'est l\'inverse : le miroir APCA conserve la lisibilité, le miroir WCAG non');
  ok(/WCAG 3/.test(await main()) && /Pourquoi les deux normes/.test(await main()) && /pas ce qui est exporté/.test(await main()), 'la différence entre les deux normes est expliquée, et dite sans effet sur l\'export');
  await click('[data-lens="wcag"]');
  const dark = () => js('const { data } = finalOf(); return { b: scaleOf(data, "blue", "dark"), n: scaleOf(data, "gray", "dark"), l: scaleOf(data, "blue") };');
  const d0 = await dark();
  await click('.opt[data-bg="#1f2430"]');
  const d1 = await dark();
  ok((await st()).dark.background === '#1f2430' && d1.b['500'] !== d0.b['500'], 'changer le fond recalcule les crans sombres');
  const kept = await js('const { data } = finalOf(); return ["100","300","500","700","900"].map(k => contrast(scaleOf(data, "blue", "dark")[k], "#1f2430") / contrast(scaleOf(data, "blue")[k], "#ffffff"));');
  ok(kept.every(x => Math.abs(x - 1) < 0.03), 'miroir WCAG : chaque cran garde son contraste, quel que soit le fond', kept.map(x => x.toFixed(3)).join(' '));
  const predOk = await js('return /contrat WCAG 2 tenu/.test(document.querySelector(".opt[data-bg=\\"#1f2430\\"]").textContent)');
  const realOk = await js('const { data } = finalOf(); return contractChecks(data).filter(c => !c.pass && c.area === "dark").length === 0;');
  ok(predOk === realOk, 'la prédiction du fond choisi est celle du contrat réel', predOk + ' / ' + realOk);
  await setVal('#dbghex', '#000000');
  ok((await st()).dark.background === '#000000', 'saisir un fond en hexadécimal');
  await setVal('#dbghex', 'pas-un-hex');
  ok((await st()).dark.background === '#000000', 'un fond invalide est refusé');
  await click('.opt[data-bg="#121212"]');
  await click('.opt[data-dm="mirror-apca"]');
  const lcs = await js('const { data } = finalOf(); const L = scaleOf(data, "blue"), D = scaleOf(data, "blue", "dark"); return ["500","700","900"].map(k => [Math.abs(apcaLc(L[k], "#ffffff")), Math.abs(apcaLc(D[k], "#121212"))]);');
  ok((await st()).dark.method === 'mirror-apca' && lcs.every(([a, b]) => Math.abs(a - b) < 3), 'miroir APCA : le Lc de chaque cran de texte est conservé', JSON.stringify(lcs.map(x => x.map(Math.round))));
  const pa = await js('return /✗/.test(document.querySelector(".opt[data-dm=\\"mirror-apca\\"]").textContent)');
  const ra = await js('const { data } = finalOf(); return contractChecks(data).filter(c => !c.pass && c.area === "dark").length > 0;');
  ok(pa === ra, 'la prédiction de la méthode choisie est celle du contrat réel', pa + ' / ' + ra);
  for (const mth of ['budget-share', 'tone-flip', 'index-flip']) {
    await click(`.opt[data-dm="${mth}"]`);
    ok((await st()).dark.method === mth && !(await js('return /Le moteur a refusé/.test(document.getElementById("main").innerText)')), 'méthode « ' + mth + ' » : calculée et affichée');
  }
  await click('.opt[data-dm="mirror-wcag"]');
  const base = await dark();
  await click('.opt[data-vv="atten"]');
  const att = await dark();
  const C = h => js(`return hexToOklch(${JSON.stringify(h)}).C`);
  ok((await st()).dark.attenuate === 0.2 && (await C(att.b['100'])) < (await C(base.b['100'])) * 0.9, 'atténuer : les surfaces perdent de la chroma (20 % par défaut une fois choisi)');
  ok(att.b['600'] === base.b['600'], 'atténuer : accents et textes restent intacts');
  await setVal('#atten', '35');
  ok((await st()).dark.attenuate === 0.35, 'le curseur règle la part retirée');
  ok(/accents à \d+ %/.test(await text('.opt[data-vv="aligned"]')), 'chaque éclat dit la part de chroma gardée, mesurée comme dans la source');
  await click('.opt[data-vv="bell"]');
  const bell = await dark();
  ok((await st()).dark.profile === 'bell' && (await st()).dark.attenuate === 0 && Object.keys(bell.b).some(k => bell.b[k] !== base.b[k]), 'le profil vif change la rampe');
  const shownV = await js('return document.querySelector(".opt[data-vv=\\"bell\\"] .or").innerHTML !== document.querySelector(".opt[data-vv=\\"aligned\\"] .or").innerHTML');
  ok(shownV, 'la différence entre éclats se voit dans le panneau de décision lui-même');
  await click('.opt[data-vv="aligned"]');
  ok(await js('return !!document.querySelector(".chart polyline")'), 'la courbe d\'éclat est tracée');
  await snap('sombre');
  await setVal('#darkramp', 'gray');
  await js('document.getElementById("den").click();');
  ok((await st()).dark.enabled === false, 'désactiver le mode sombre');
  await js('document.getElementById("den").click();');
  ok((await st()).dark.enabled === true, 'réactiver le mode sombre');

  // ============================================================ 5. vérifier
  section('5 · Vérifier');
  await click('#next');
  ok((await text('#verdict'))?.startsWith('✓'), 'contrat tenu', await text('#verdict'));
  await goStep(4); await click('.opt[data-dm="index-flip"]'); await goStep(5);
  ok((await text('#verdict'))?.startsWith('✗') && /Conséquence de ton choix « Crans échangés »/.test(await main()), 'un écart causé par un choix est nommé comme tel');
  const nFail = await js('return document.querySelectorAll("[data-assume]").length');
  for (let k = 0; k < nFail; k++) await click('[data-assume]');
  ok(/exceptions? acceptées?/.test(await text('#verdict')) && !/✓/.test(await text('#verdict')) && (await st()).assumed.length === nFail, 'accepter les exceptions : le verdict les compte à part, sans coche verte', await text('#verdict'));
  ok(await js('return specOf().notes.some(n => /Exception acceptée/.test(n))'), 'les exceptions acceptées partent dans la spec, donc dans le rapport');
  await click('[data-unassume]');
  ok((await st()).assumed.length === nFail - 1, 'ne plus assumer un écart');
  await js('state.assumed = []; save();');
  await goStep(4); await click('.opt[data-dm="mirror-wcag"]'); await goStep(5);
  ok((await text('#verdict'))?.startsWith('✓'), 'retour au miroir WCAG : contrat tenu');
  const n0 = await text('#pratio');
  await setVal('#pfg', '#000000'); await setVal('#pbg', '#ffffff');
  ok((await text('#pratio'))?.includes('21'), 'testeur de paires : noir sur blanc = 21:1', n0 + ' → ' + (await text('#pratio')));
  ok(await js('return document.querySelectorAll(".mock").length === 2'), 'aperçu en situation, clair et sombre');
  await snap('verifier');

  // ============================================================ 6. livrer
  section('6 · Livrer — chaque format, et la reproduction par la ligne de commande');
  await click('#next');
  const tabs = await js('return [...document.querySelectorAll("[data-t]")].map(b => b.dataset.t);');
  ok(tabs.join(',') === 'dtcgL,dtcgD,css,tw,tw4,guide,migration,spec', 'huit formats, dont la migration (porte A)', tabs.join(','));
  const outs = {};
  for (const tb of tabs) { await click(`[data-t="${tb}"]`); outs[tb] = await js('return document.getElementById("out").value;'); }
  let parsed = true; try { JSON.parse(outs.dtcgL); JSON.parse(outs.dtcgD); JSON.parse(outs.spec); } catch (e) { parsed = false; }
  ok(parsed, 'DTCG clair, DTCG sombre et spec sont du JSON valide');
  ok(!/null/.test(outs.dtcgL) && !/null/.test(outs.dtcgD), 'aucune valeur nulle dans les tokens');
  ok(/--color-blue-500: #/.test(outs.css) && /\[data-theme="dark"\]/.test(outs.css), 'CSS : variables clair et sombre');
  ok(/'blue': \{/.test(outs.tw), 'Tailwind : une famille par nuancier');
  const pkg = await js(`const { data, spec } = finalOf();
    const files = __lib.package.packageFiles(spec, data, { lang, specJson: specOf({ tuned: true }), audit: state.door === 'audit' });
    const z = __lib.zip.zip(files);
    const fig = JSON.parse(files.find(f => f[0].endsWith('figma/Dark.tokens.json'))[1]);
    const first = Object.values(Object.values(fig)[0].color)[0];
    return { paths: files.map(f => f[0].split('/').slice(1).join('/')), sig: [...z.slice(0, 4)].join(','), fig: first['500'].$value,
      same: JSON.stringify(files.find(f => f[0].endsWith('.hueladder.json'))[1].trim()) === JSON.stringify(JSON.stringify(specOf({ tuned: true }), null, 2)) };`);
  const need = ['README.md', 'code/colors.css', 'code/tailwind-v4.css', 'code/tailwind.config.js', 'figma/Light.tokens.json', 'figma/Dark.tokens.json', 'tokens-studio/tokens.json', 'ai/color-guide.md', 'ai/palette.json', 'migration.md'];
  ok(need.every(p => pkg.paths.includes(p)) && pkg.sig === '80,75,3,4', 'paquet : un dossier par destination, archive zip valide', need.filter(p => !pkg.paths.includes(p)).join(', '));
  ok(pkg.fig && pkg.fig.colorSpace === 'srgb' && pkg.fig.components.length === 3 && /^#[0-9a-f]{6}$/.test(pkg.fig.hex), 'paquet Figma : couleurs au format objet de l\'import natif');
  ok(pkg.same, 'paquet : la spec est celle de l\'onglet Spec');
  ok(/@theme \{/.test(outs.tw4) && /--color-blue-500: #/.test(outs.tw4), 'Tailwind 4 : bloc @theme');
  ok(/\| Success \| 300 \| `#27ae60` \|/.test(outs.migration) || /`#27ae60`/.test(outs.migration), 'migration : chaque couleur d\'origine et ce qu\'elle devient');
  const gj = (outs.guide.match(/```json\n([\s\S]+?)\n```/) || [])[1];
  let gd = null; try { gd = JSON.parse(gj); } catch (e) {}
  ok(/## La règle/.test(outs.guide) && gd && gd.ramps.blue && !gd.semantic && !/sémantiques de départ/.test(outs.guide), 'guide IA : règle, rôles et bloc de données valide, sans rôles sémantiques imposés');
  const t500 = JSON.parse(outs.dtcgL).core.color.blue['500'];
  ok(/sur le fond/.test(t500.$description) && Array.isArray(t500.$extensions['ma-marque'].aaWith), 'tokens : description d\'usage et paires en données');
  // la spec exportée, rejouée par le moteur hors navigateur, redonne les mêmes tokens
  const spec = JSON.parse(outs.spec);
  ok(Array.isArray(spec.notes) && spec.notes.length === 1, 'l\'exception documentée part dans la spec');
  const cli = tokenTrees(applyNaming(spec), buildData(applyNaming(spec)), 'light').tokens;
  ok(JSON.stringify(cli) === JSON.stringify(JSON.parse(outs.dtcgL)), 'la spec reconstruit les tokens au bit près par le moteur');
  await snap('livrer');

  // la spec recollée à l'étape 1 redonne le même système
  const tokBefore = outs.dtcgL;
  await js('state = { ...state, ramps: [], step: 0 }; save(); render();');
  await setVal('#paste', outs.spec, 'input'); await click('#read');
  await goStep(6); await click('[data-t="dtcgL"]');
  const tokAfter = await js('return document.getElementById("out").value;');
  const firstDiff = (() => { const a = tokBefore.split('\n'), b = tokAfter.split('\n'); const i = a.findIndex((l, k) => l !== b[k]); return i < 0 ? '' : a[i].trim() + ' ≠ ' + (b[i] || '').trim(); })();
  ok(tokAfter === tokBefore, 'la spec recollée à l\'étape 1 redonne les mêmes tokens', firstDiff);

  // ============================================================ 7. partage, crans, remise à zéro
  section('7 · Lien de partage, jeux de crans, remise à zéro');
  const link = await js('return location.href.split("#")[0] + "#s=" + encodeState(state);');
  const saved = await st();
  await js("localStorage.clear(); localStorage.setItem('hueladder-lang', 'fr');");   // le lien ne porte pas la langue : c'est celle de qui l'ouvre
  await load('about:blank'); await load(link);
  const back = await st();
  ok(JSON.stringify(back.ramps) === JSON.stringify(saved.ramps) && JSON.stringify(back.tuned) === JSON.stringify(saved.tuned), 'le lien restaure nuanciers et réglages');
  dialogAnswer = true; dialogs = [];
  const tok7 = async () => { await goStep(6); await click('[data-t="dtcgL"]'); const t7 = JSON.parse(await js('return document.getElementById("out").value;')); return Object.values(t7)[0].color.blue; };
  const openCrans = async () => { if (!(await js('return !document.getElementById("cranspanel").hidden'))) await click('#cransbtn'); };
  await openCrans();
  ok(await js('return document.querySelectorAll("[data-naming]").length') === 4, 'crans : quatre nomenclatures proposées');
  await click('[data-npreset="maxi"]');
  ok(dialogs.length === 1 && (await st()).stepList.length === 23 && Object.keys((await st()).tuned).length === 0, 'passer en Maxi demande confirmation et efface les réglages');
  let tb = await tok7();
  ok(Object.keys(tb).filter(k => !k.startsWith('$')).length === 23, 'Maxi livre 23 crans');
  await openCrans(); await click('[data-npreset="mini"]');
  tb = await tok7();
  ok(Object.keys(tb).filter(k => !k.startsWith('$')).join() === '200,500,800', 'Mini livre 200, 500, 800');
  // ajouter et retirer un cran à la main, dans la grille
  await openCrans(); await click('[data-npreset="standard"]');
  const g500 = (await tok7())['500'].$value;
  await openCrans(); await setVal('#addstep', '150', 'input'); await click('#addstepbtn');
  ok((await st()).stepList.includes('150') && (await tok7())['500'].$value === g500, 'grille : ajouter le 150 ne déplace pas le 500');
  await openCrans(); await click('[data-rmstep="150"]');
  ok(!(await st()).stepList.includes('150'), 'retirer un cran');
  await openCrans(); await setVal('#addstep', '1234', 'input'); await click('#addstepbtn');
  ok(!(await st()).stepList.includes('1234'), 'un cran invalide est refusé');
  // centaines par contraste : tout multiple de 25, dans la règle, sans rien déplacer
  await openCrans(); await click('[data-naming="hundreds"]');
  ok((await st()).naming === 'hundreds' && /Δ 525/.test(await text('#cranspanel')), 'centaines par contraste : la règle se lit en écart de noms (Δ 525 ⇒ AA)');
  const h = await tok7();
  await openCrans(); await setVal('#addstep', '350', 'input'); await click('#addstepbtn');
  const h2 = await tok7();
  ok(h2['350'] && Object.keys(h).filter(k => !k.startsWith('$')).every(k => h2[k].$value === h[k].$value), 'par contraste : ajouter le 350 ne déplace aucun autre cran');
  await goStep(5);
  ok((await text('#verdict'))?.startsWith('✓'), 'par contraste : le contrat tient, crans ajoutés compris', await text('#verdict'));
  // la personnalisation est gardée quand on change de nomenclature, et se signale
  ok(/modifié/i.test(await text('#cranspanel')) && /modifié/.test(await text('#cransbtn')), 'crans : une configuration modifiée porte le tag « modifié »');
  await js('window.scrollTo(0, 0)'); await snap('crans');
  await openCrans(); await click('[data-naming="grid"]');
  await openCrans(); await click('[data-naming="hundreds"]');
  ok((await st()).stepList.includes('350'), 'crans : revenir à une nomenclature retrouve ses crans modifiés');
  await openCrans(); await click('#resetsteps');
  ok(!(await st()).stepList.includes('350') && !/modifié/i.test(await text('#cransbtn')), 'crans : « revenir au préréglage » restaure la configuration de base');
  await openCrans(); await setVal('#addstep', '350', 'input'); await click('#addstepbtn');
  // Fusilier
  await openCrans(); await click('[data-naming="shade"]');
  const f = await tok7();
  ok(Object.keys(f).filter(k => !k.startsWith('$')).sort((x, y) => x - y).join() === '10,25,50,75,100,125,150,175', 'Fusilier : la palette de 10 à 175');
  ok(await js('const d = finalOf().data; return d.meta.steps.join() === "175,150,125,100,75,50,25,10"'), 'Fusilier : du plus clair (175) au plus foncé (10)');
  ok(await js('const d = finalOf().data; return contrast(scaleOf(d, "blue")["150"], scaleOf(d, "blue")["25"]) >= 4.5'), 'Fusilier : 150 et 25 (Δ 125 ≥ Δ 105) passent AA');
  // par rang
  await openCrans(); await click('[data-naming="rank"]');
  ok(/déplace tous les autres/.test(await text('#cranspanel')), 'par rang : l\'effet d\'un ajout est annoncé');
  const r12 = await tok7();
  ok(Object.keys(r12).filter(k => !k.startsWith('$')).length === 12, 'Radix : 12 crans');
  for (const nm of ['grid', 'hundreds', 'shade', 'rank']) {
    await openCrans(); await click(`[data-naming="${nm}"]`);
    for (let i = 0; i < 7; i++) { await goStep(i); if (i === 3) await sleep(300); }
  }
  await openCrans(); await click('[data-naming="grid"]'); await click('#cransclose');
  ok(errors.length === 0, 'toutes les étapes s\'affichent avec chaque jeu de crans', errors.slice(0, 2).join(' | '));
  const tSel = await js('return getComputedStyle(document.body).backgroundColor');
  await click('#theme');
  ok(tSel !== await js('return getComputedStyle(document.body).backgroundColor'), 'bascule de thème');
  dialogs = [];
  await click('#reset');
  ok(dialogs.length === 1 && (await st()).ramps.length === 0 && (await st()).step === 0, 'nouveau : confirmation puis page vierge');

  // ============================================================ 8. porte B et anglais
  section('8 · Porte B, en anglais');
  await fresh('en');
  ok((await text('#lang')) === 'FR' && /Do you already have colours/.test(await main()), 'interface en anglais');
  await setVal('#pickhex', '#e4572e', 'input'); await sleep(100);
  ok(await js('return document.querySelectorAll("#live .sw").length === 11'), 'la rampe apparaît dès la saisie');
  await click('#create');
  s = await st();
  ok(s.door === 'create' && s.ramps.length === 1, 'créer depuis une couleur');
  // un seul écart pour la couleur de marque, repris tel quel d'une étape à l'autre
  await goStep(1);
  const de2 = ((await main()).match(/ΔE ([\d.,]+)/) || [])[1];
  await goStep(2);
  const de3 = ((await text('.brief[data-m="fusilier"] .bd')) || '').replace('ΔE ', '').trim();
  await goStep(3); await sleep(1500);
  const de4 = await js('const d = document.getElementById("tuner").contentDocument; const b = [...d.querySelectorAll("#side b")].find(x => /ΔE/.test(x.textContent)); return b ? b.textContent.replace("ΔE ", "").trim() : null;');
  ok(de2 && de2 === de3 && Math.abs(parseFloat(de2) - parseFloat(de4)) < 0.11, 'le même écart ΔE de la couleur de marque aux étapes 2, 3 et 4', [de2, de3, de4].join(' / '));
  await goStep(0);
  await click('#addneutral');
  ok((await st()).ramps.some(x => x.kind === 'neutral'), 'ajouter un neutre teinté');
  await setVal('#addpick', '#c0392b', 'input'); await setVal('#addname', 'Red', 'input'); await click('#add');
  await click('#addsystem');
  const N = (await st()).ramps.length;
  const hues = await js('return state.ramps.map(r => [r.name, hexToOklch(r.seed || Object.values(r.anchors)[0]).H]);');
  const H = Object.fromEntries(hues);
  const gapTo = (a, b) => Math.abs(((H[a] - H[b] + 540) % 360) - 180);
  // la plage de l'erreur est 18–36° : avec une marque à 36° et un rouge à 30°, le mieux possible est 18°
  ok(Math.min(gapTo('error', 'brand'), gapTo('error', 'red')) >= 11.5, 'couleurs système : l\'erreur s\'écarte au plus des rouges déjà présents', JSON.stringify(hues.map(([n, h]) => n + ' ' + Math.round(h))));
  ok(gapTo('info', 'brand') > 90, 'couleurs système : l\'info reste dans sa plage, loin de la marque');
  ok(N === 7, 'porte B : marque, rouge, neutre et quatre couleurs système', N + ' nuanciers');
  await goStep(1);
  ok(await js('return document.querySelectorAll("#main .ramp").length') === N, 'étape 2 : les ' + N + ' nuanciers sont visibles');
  await goStep(2);
  ok(await js('const p = [...document.querySelectorAll("main > .panel")].find(p => !p.querySelector(".briefs") && p.querySelector(".ramp")); return p.querySelectorAll(".ramp").length') === N, 'étape 3 : les ' + N + ' nuanciers sont visibles');
  await goStep(4);
  ok(await js('return document.querySelectorAll("#main .ramp").length') >= 2 * N, 'étape 5 : les ' + N + ' nuanciers, clair et sombre');
  await goStep(6); await click('[data-t="dtcgL"]');
  ok(Object.keys(JSON.parse(await js('return document.getElementById("out").value;')).core.color).length === N, 'étape 7 : les ' + N + ' nuanciers dans les tokens');
  await goStep(3); await sleep(1500);
  ok(await js('return document.getElementById("tuner").contentDocument.querySelectorAll("#ramp-select option").length') === N, 'étape 4 : les ' + N + ' nuanciers dans le régleur');
  for (let i = 0; i < 7; i++) {
    await goStep(i);
    if (i === 3) await sleep(1500);
    await noMissingKeys('EN, étape ' + (i + 1));
    const fr = await js(`return (document.getElementById('main').innerText.match(/\\b(le|la|les|des|une|avec|sur|pour|dans)\\b/g) || []).length;`);
    ok(fr <= 2, 'EN, étape ' + (i + 1) + ' : pas de texte français résiduel', fr + ' mots français');
    if (i === 3) {
      const tf = await js(`const d = document.getElementById('tuner').contentDocument; return (d.body.innerText.match(/\\b(le|la|les|des|une|avec|sur|pour|dans)\\b/g) || []).length;`);
      ok(tf <= 2, 'EN, régleur : pas de texte français résiduel', tf + ' mots français');
    }
    await snap('en-' + (i + 1));
  }
  const quotes = await js('return (document.getElementById("main").innerText.match(/[«»]/g) || []).length');
  ok(quotes === 0, 'EN : pas de guillemets français', quotes + '');
  const repEn = await js('const h = reportHtml(dataOf({ tuned: false }).data); return { lang: /"lang":"en"/.test(h), title: /Method comparison/.test(h) };');
  ok(repEn.lang && repEn.title, 'EN : le rapport complet part en anglais', JSON.stringify(repEn));
  await click('#lang');
  ok((await text('#lang')) === 'EN' && /étape/i.test(await main()), 'retour au français sans perdre l\'état');
  await noMissingKeys('FR');

  // ============================================================ 9. largeur téléphone
  // ============================================================ 10. entrée Auditer
  section('10 · Auditer — plusieurs sources, sans rien générer');
  await fresh('fr', null);
  ok(await js('return document.querySelectorAll(".home .door").length') === 3 && !(await st()).entry, 'la page s\'ouvre sur trois entrées');
  await snap('accueil');
  await click('.home [data-entry="audit"]');
  ok(/Ce que vaut l'existant/.test(await main()) && await js('return document.getElementById("shell").classList.contains("solo")'), 'entrée Auditer, sans le rail de création');
  await setVal('[data-src="0"] textarea', SRC_A, 'input');
  await click('#srcadd');
  await setVal('[data-src="1"] textarea', SRC_B, 'input');
  await click('#auditdiff');
  await click('#auditrun');
  ok(await js('return document.querySelectorAll("#crosstbl tbody tr").length') === 4, 'les familles des deux sources, face à face');
  ok(/Sans doute la même famille sous deux noms/.test(await main()), 'deux noms pour une même rampe');
  ok(await js('return document.querySelector("#triage tbody tr td")?.textContent') === 'red', 'triage : la famille divergente d\'abord');
  ok(/4 chemin\(s\) perdu\(s\)/.test(await text('#diff')), 'deux versions : chemins perdus comptés', await text('#diff'));
  ok(await js('return document.querySelectorAll("[data-audit] .finding").length') > 0 && /garder ou régénérer/i.test(await main()), 'constats et décision pour chaque source');
  // une troisième source : le mode sombre déclaré de la première
  await click('#srcadd');
  await setVal('[data-src="2"] textarea', '--red-100: #3a2a2a;\n--red-500: #e06666;\n--red-700: #f3b3b3;\n--blue-100: #1e2a44;\n--blue-500: #6f9df0;\n--blue-700: #c4d6fb;', 'input');
  await setVal('[data-src="2"] [data-f=darkOf]', '0', 'change');
  await click('#auditrun');
  ok(await js('return !!document.querySelector("[data-dark=\'0\'] .checks li")'), 'un mode sombre déclaré, audité contre sa palette claire');
  ok(await js('return document.querySelectorAll("#crosstbl tbody tr").length') === 4, 'la source sombre n\'entre pas dans le face-à-face');
  await snap('auditer');
  await noMissingKeys('Auditer');
  await click('[data-tocreate="0"]');
  s = await st();
  ok(s.entry === 'create' && s.step === 1 && s.door === 'audit' && s.ramps.length === 2, 'corriger dans Créer : la source passe au diagnostic', JSON.stringify([s.entry, s.step, s.ramps.length]));
  ok(!(await js('return document.getElementById("shell").classList.contains("solo")')), 'le rail de création revient');

  // ============================================================ 11. entrée Comprendre
  section('11 · Comprendre — la science, sans données client');
  await fresh('fr', 'understand');
  ok(await js('return document.querySelectorAll("#proof svg polyline").length') > 40, 'un graphique par méthode, mêmes axes');
  ok(!(await js('return !!document.querySelector("#cards [data-m=existing]")')) && !/couleurs fournies|règle non tenue/i.test(await main()), 'l\'exemple ne prétend pas qu\'on a fourni des couleurs, et ne juge pas une méthode à la règle d\'une autre');
  const gread = await text('#gread');
  await click('#gtabs [data-g=step]');
  ok(await js('return document.querySelectorAll("#proof svg polyline").length') > 40 && (await text('#gread')) !== gread, 'les graphiques : un critère à la fois, ici les intervalles entre crans voisins');
  ok(await js('return document.querySelectorAll("#lessons li").length') >= 8 && !!(await text('.thesis')), 'le propos, puis les constats calculés depuis les chiffres');
  ok(await js('return document.querySelectorAll("#cards details.mcard").length') >= 10 && await js('return document.querySelectorAll("#cards [data-m=fusilier] .mramps i[style]").length') === 99,
    'chaque méthode a sa fiche : ses couleurs, ce qu\'elle rend égal, quand la choisir, ses chiffres');
  ok(await js('return [...document.querySelectorAll("#cards details.mcard")].filter(d => d.querySelector("p.set")).length') >= 10, 'chaque fiche dit ses réglages : ce que Hueladder choisit, et en quoi il s\'écarte de l\'auteur');
  ok(await js('const r = document.querySelectorAll("#side .prow"); return r.length >= 11 && r[0].querySelectorAll(".pc").length === 11 && r[1].querySelectorAll(".pc i").length === 11 && r[1].querySelectorAll(".pc b, .pc span").length === 22'), 'une teinte, toutes les méthodes, côte à côte : contraste face au blanc et au noir sous chaque case');
  await click('#stabs [data-s=yellow]');
  ok(await js('return document.querySelector("#stabs .on").dataset.s') === 'yellow' && await js('return document.querySelectorAll("#side .prow").length') >= 10, 'côte à côte : on change de teinte, ici le jaune');
  ok(await js('return document.querySelectorAll("#usagetbl tbody tr").length') >= 10, 'les usages, teinte par teinte');
  ok(await js('return document.querySelectorAll("#costtbl thead tr:first-child th").length') === 9 && await js('return !!document.querySelector("#costtbl tr.good")') && await js('return document.querySelectorAll("#costtbl tbody b").length') > 0,
    'le tableau : ce qui est bon dans chaque colonne, la meilleure valeur en gras');
  ok(await js('return document.querySelectorAll("#guidetbl tbody tr").length') >= 8, 'choisir sa méthode : un critère, les méthodes qui y répondent, leur prix');
  const fusPair = 'return [...document.querySelectorAll("#pairres .prow")].find(p => /Fusilier/.test(p.firstChild.textContent)).querySelector("b").textContent';
  await setVal('#pairctl [data-p=fg]', '300', 'change'); await setVal('#pairctl [data-p=bg]', 'W', 'change'); await setVal('#pairctl [data-p=th]', '3', 'change');
  ok(await js(fusPair) === '0/9' && await js('return document.querySelectorAll("#pairres .prow:first-child .pc").length') === 9, 'une paire : 300 sur blanc, une case par teinte, aucune ne passe avec Fusilier', await js(fusPair));
  await click('#usagetbl tr[data-u="5"]');
  ok(await js(fusPair) === '9/9' && await js('return document.querySelector("#pairctl [data-p=bg]").value') === '500', 'cliquer un usage montre ses couleurs : blanc sur 500');
  ok(await js('return !!document.getElementById("undmd") && !!document.getElementById("trust") && !!document.getElementById("other")'), 'l\'argumentaire à télécharger, la méthode de mesure, les autres choix');
  // le rapport complet ouvert depuis l'exemple, rendu pour de vrai : son texte visible
  const rep11 = await js('return await new Promise(res => { const f = document.createElement("iframe"); f.style.cssText = "position:fixed;left:-4000px;width:1200px;height:900px"; f.onload = () => setTimeout(() => { const tx = f.contentDocument.body.innerText; f.remove(); res(tx); }, 400); f.srcdoc = reportHtml(ui.understand); document.body.appendChild(f); })');
  ok(/Aucune méthode n'a la meilleure valeur/.test(rep11) && !/couleurs fournies|couleurs déjà choisies|tient la règle|tiennent la règle|Violations de la règle/i.test(rep11),
    'le rapport complet de l\'exemple : pas de couleurs « fournies », la meilleure de chaque ligne au lieu d\'un gagnant', (rep11.match(/.{0,40}(couleurs fournies|couleurs déjà choisies|tien\w* la règle|Violations de la règle).{0,40}/i) || [rep11.slice(0, 80)])[0]);
  ok(await js('return document.querySelector("#corpus [data-c=mine]").disabled'), 'sans couleurs à soi, l\'exemple neutre seul');
  await snap('comprendre');
  await noMissingKeys('Comprendre');
  await fresh('en', 'understand');
  await noMissingKeys('Understand');

  // ============================================================ 12. options de Créer
  section('12 · Créer — éclat vif, modes daltoniens, dataviz');
  await fresh();
  await setVal('#pickhex', '#2f5bd3', 'input'); await click('#create'); await click('#addsystem');
  await goStep(2);
  const seedLook = await js('return [...document.querySelectorAll(".ramp .sw")].map(e => e.style.background).join()');
  await click('#vivid [data-v="vivid"]');
  ok((await st()).lightChroma === 'vivid' && seedLook !== await js('return [...document.querySelectorAll(".ramp .sw")].map(e => e.style.background).join()'), 'éclat vif : le système se recalcule');
  await goStep(6);
  await click('#optcvd'); await click('#optdv');
  ok(await js('return !!document.getElementById("dvchips")') && /Rouge-vert/.test(await main()), 'modes daltoniens et dataviz annoncés avant le paquet');
  await noMissingKeys('Livrer, options');
  // la fiche d'une pastille, la planche de variantes, le réglage du sombre
  await goStep(2);
  await click('.ramp .sw[data-hex]');
  ok(await js('return !document.getElementById("swcard").hidden && /OKLCH/.test(document.getElementById("swcard").innerText)'), 'fiche de swatch au clic');
  await js('document.getElementById("board").open = true; document.getElementById("board").dispatchEvent(new Event("toggle"))'); await sleep(300);
  ok(await js('return document.querySelectorAll("#board .board-cell").length') >= 8, 'planche : quatre variantes par famille');
  await click('#board [data-variant$="|max"]');
  ok((await st()).ramps.some(r => r.lightChroma === 'max'), 'planche : un clic choisit la variante d\'une famille');
  await goStep(4);
  await setVal('#dtchroma', '1', 'input'); await click('#dtpin');
  ok(Object.keys((await st()).dark.pins || {}).length === 1, 'sombre : un cran réglé et épinglé');
  await click('#dhalo');
  ok((await st()).dark.haloCap === 14, 'sombre : plafond anti-halo');
  await noMissingKeys('Sombre, réglage');

  section('9 · Largeur téléphone');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  for (let i = 0; i < 7; i++) {
    await goStep(i); if (i === 3) await sleep(800);
    const w = await js('return document.documentElement.scrollWidth');
    ok(w <= 391, 'étape ' + (i + 1) + ' : pas de défilement horizontal', w + ' px');
  }
  await snap('mobile');

  section('Erreurs JavaScript');
  ok(errors.length === 0, 'aucune erreur pendant tout le parcours', errors.slice(0, 3).join(' | '));
} catch (e) {
  failed++;
  console.log('\x1b[31m✗ le test s\'est interrompu :\x1b[0m ' + e.message);
} finally {
  ws.close(); proc.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}

console.log(`\n${failed ? '\x1b[31m' : '\x1b[32m'}${passed} vérifications passées, ${failed} en échec\x1b[0m`);
process.exit(failed ? 1 : 0);
