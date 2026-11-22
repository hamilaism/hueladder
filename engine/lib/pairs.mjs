// Les paires par état : au-delà des primitives, ce que les composants font des couleurs. Un
// texte sur un fond, en survol, au focus, pressé, désactivé — chaque état est une paire, et
// c'est là que les défauts se cachent : un fond qui devient la couleur du texte au clavier, un
// texte « faible » sous le seuil, un survol qui fait perdre l'AA. Module optionnel : Hueladder livre
// des primitives, mais un audit lit aussi la couche qui s'en sert.
//
// Entrées acceptées : un fichier de tokens (DTCG, Tokens Studio) dont les chemins portent le
// rôle (fg / bg / text / background / border / icon…) et l'état (default / hover / focus /
// pressed / active / disabled), alias compris ; ou une liste explicite
// `{ "pairs": [{ "name": "button.primary", "state": "hover", "fg": "#…", "bg": "#…", "kind": "text" }] }`.

import { normHex } from './import.mjs';
import { contrast } from './color.mjs';

const FG = /^(fg|foreground|text|content|label|on|ink|icon|border|outline|stroke)$/i;
const BG = /^(bg|background|surface|fill|container|base)$/i;
const STATES = /^(default|rest|enabled|hover|hovered|focus|focused|focus-visible|pressed|active|selected|checked|disabled|visited)$/i;
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Toutes les valeurs d'un arbre de tokens, alias résolus (`{a.b.c}`), par chemin. */
export function resolveTokens(json) {
  const raw = new Map();
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    const v = node.$value ?? node.value;
    if (v !== undefined && (typeof v === 'string' || (v && typeof v === 'object' && typeof v.hex === 'string'))) { raw.set(path.join('.'), typeof v === 'string' ? v : v.hex); return; }
    for (const [k, c] of Object.entries(node)) if (!k.startsWith('$')) walk(c, [...path, k]);
  };
  walk(json, []);
  const out = new Map();
  const resolve = (p, seen = new Set()) => {
    if (out.has(p)) return out.get(p);
    const v = raw.get(p);
    if (v === undefined || seen.has(p)) return null;
    seen.add(p);
    const m = /^\{(.+)\}$/.exec(String(v).trim());
    const hex = m ? resolve(m[1], seen) : normHex(v)?.hex || null;
    out.set(p, hex);
    return hex;
  };
  for (const p of raw.keys()) resolve(p);
  return out;
}

/** Les paires d'un fichier : un composant, un état, une encre et un fond. */
export function extractPairs(text) {
  let json;
  try { json = JSON.parse(text); } catch (e) { return []; }
  if (Array.isArray(json.pairs)) return json.pairs.map(p => ({ name: p.name, state: p.state || 'default', kind: p.kind || 'text', fg: normHex(p.fg)?.hex, bg: normHex(p.bg)?.hex })).filter(p => p.fg && p.bg);
  const vals = resolveTokens(json), groups = new Map();
  for (const [path, hex] of vals) {
    if (!hex) continue;
    const segs = path.split('.');
    // le rôle est le dernier segment qui en porte un : dans `text.weak.fg`, c'est `fg`
    const ri = segs.findLastIndex(s => FG.test(s) || BG.test(s));
    if (ri < 0) continue;
    const role = FG.test(segs[ri]) ? 'fg' : 'bg';
    const kind = /border|outline|stroke/i.test(segs[ri]) ? 'border' : /icon/i.test(segs[ri]) ? 'icon' : 'text';
    const si = segs.findIndex((s, i) => i !== ri && STATES.test(s));
    const state = si >= 0 ? segs[si].toLowerCase() : 'default';
    const name = segs.filter((_, i) => i !== ri && i !== si).join('.');
    const key = name + '|' + state;
    if (!groups.has(key)) groups.set(key, { name, state, fg: {}, bg: null });
    const g = groups.get(key);
    if (role === 'bg') g.bg = hex; else g.fg[kind] = hex;
  }
  // un état qui ne redéclare que son fond (ou que son encre) hérite de l'autre à l'état par défaut
  const pairs = [];
  for (const g of groups.values()) {
    const base = groups.get(g.name + '|default');
    const bg = g.bg || base?.bg || null;
    const fg = Object.keys(g.fg).length ? g.fg : (base ? base.fg : {});
    for (const [kind, hex] of Object.entries(fg)) if (bg) pairs.push({ name: g.name, state: g.state, kind, fg: hex, bg });
  }
  return pairs;
}

/**
 * Le jugement de chaque paire : 4,5:1 pour un texte, 3:1 pour une bordure ou une icône (1.4.11),
 * aucun seuil pour un état désactivé (exempté par WCAG, mais signalé s'il est illisible). Un
 * fond égal au texte est le défaut le plus grave : le texte disparaît, souvent au seul clavier.
 */
export function auditPairs(pairs) {
  const rows = pairs.map(p => {
    const ratio = contrast(p.fg, p.bg), need = p.kind === 'text' ? 4.5 : 3;
    const disabled = /disabled/.test(p.state);
    const same = p.fg.toLowerCase() === p.bg.toLowerCase();
    const status = same ? 'invisible' : disabled ? 'exempt' : ratio >= need ? 'ok' : 'fail';
    return { ...p, ratio: round(ratio), need, status };
  });
  // un état qui fait perdre le seuil que l'état par défaut tenait
  const lost = rows.filter(r => r.state !== 'default' && r.status === 'fail' && rows.some(d => d.name === r.name && d.kind === r.kind && d.state === 'default' && d.status === 'ok'));
  const count = st => rows.filter(r => r.status === st).length;
  return { rows: rows.sort((a, b) => (a.status === 'invisible' ? -1 : 0) - (b.status === 'invisible' ? -1 : 0) || a.ratio - b.ratio),
    totals: { pairs: rows.length, invisible: count('invisible'), fail: count('fail'), ok: count('ok'), exempt: count('exempt'), lostOnState: lost.length }, lost };
}

/** Le rapport des paires en Markdown. */
export function pairsMarkdown(res, { lang = 'fr' } = {}) {
  const en = lang === 'en', T = (f, e) => (en ? e : f), n = x => (en ? String(x) : String(x).replace('.', ','));
  const t = res.totals;
  const L = [`## ${T('Paires par état', 'Pairs by state')}`, '',
    T(`${t.pairs} paire(s) : ${t.invisible} invisible(s) (texte = fond), ${t.fail} sous le seuil, ${t.ok} au seuil, ${t.exempt} désactivée(s) ; ${t.lostOnState} état(s) qui perdent le seuil de l'état par défaut.`,
      `${t.pairs} pair(s): ${t.invisible} invisible (text = background), ${t.fail} under threshold, ${t.ok} at threshold, ${t.exempt} disabled; ${t.lostOnState} state(s) losing the default state's threshold.`), '',
    `| ${T('Composant', 'Component')} | ${T('État', 'State')} | ${T('Rôle', 'Role')} | ${T('Encre', 'Ink')} | ${T('Fond', 'Background')} | ${T('Contraste', 'Contrast')} | ${T('Verdict', 'Verdict')} |`, '|---|---|---|---|---|---|---|'];
  const V = { invisible: T('✗ invisible', '✗ invisible'), fail: T('✗ sous le seuil', '✗ under threshold'), ok: '✓', exempt: T('· désactivé', '· disabled') };
  for (const r of res.rows.filter(x => x.status !== 'ok')) L.push(`| ${r.name} | ${r.state} | ${r.kind} | \`${r.fg}\` | \`${r.bg}\` | ${n(r.ratio)}:1 / ${n(r.need)} | ${V[r.status]} |`);
  return L.join('\n') + '\n';
}
