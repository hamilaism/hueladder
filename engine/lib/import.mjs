// Lire ce que l'utilisateur a sous la main (liste de hex, variables CSS ou SCSS, config
// Tailwind, tokens DTCG ou Tokens Studio, spec Hueladder) et le regrouper en nuanciers. Partagé par
// le studio (étape Entrer) et la ligne de commande (`hueladder import`).

import { hexToOklch, contrastVsBlack } from './color.mjs';
import { REFERENCE_STEPS } from './crans.mjs';

export const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand';

const GENERIC = new Set(['color', 'colors', 'colour', 'colours', 'core', 'global', 'primitive', 'primitives', 'palette', 'ref', 'tokens', 'theme', 'extend', 'value', 'values', 'sys']);
const ROLE_WORDS = new Set(['default', 'base', 'main', 'primary', 'light', 'lighter', 'lightest', 'dark', 'darker', 'darkest', 'subtle', 'muted', 'strong', 'emphasis', 'background', 'bg', 'surface', 'ink', 'text', 'contrast', 'hover', 'active', 'pressed', 'disabled', 'border', 'foreground', 'fg', 'weak', 'soft']);
const SEED_ROLES = ['500', 'default', 'base', 'main', 'primary', 'DEFAULT'];
const isRole = s => /^\d{1,4}$/.test(s) || ROLE_WORDS.has(s);

export function normHex(v) {
  const m = String(v).trim().match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 5 || h.length === 7) return null;
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
  if (h.length === 8) return h.slice(6) === 'ff' ? { hex: '#' + h.slice(0, 6) } : { alpha: true };
  return { hex: '#' + h };
}

/**
 * Accepte ce que l'utilisateur a sous la main : liste de hex, variables CSS ou SCSS, config
 * Tailwind, tokens DTCG ou Tokens Studio, spec Hueladder. Rend chaque couleur avec le chemin de
 * noms qui la désigne, et la liste exacte de ce qui a été écarté — un import dont on ne
 * sait pas ce qu'il a perdu n'est pas un import fidèle. Les raisons sont des clés, traduites
 * à l'affichage.
 */
export function parseInput(text) {
  const items = [], dropped = [];
  let seen = 0;
  const leaf = (path, value) => {
    seen++;
    const v = String(value).trim();
    if (/^\{.+\}$/.test(v)) return dropped.push({ path, value: v, why: 'alias' });
    const h = normHex(v);
    if (!h) return dropped.push({ path, value: v, why: 'format' });
    if (h.alpha) return dropped.push({ path, value: v, why: 'alpha' });
    items.push({ path, hex: h.hex });
  };

  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  if (json && Array.isArray(json.ramps)) return { spec: json };
  if (json && typeof json === 'object') {
    const walk = (node, path) => {
      if (typeof node === 'string') { if (/^#|^\{|^rgb|^hsl|^oklch/i.test(node.trim())) leaf(path, node); return; }
      if (!node || typeof node !== 'object') return;
      const v = node.$value ?? node.value;
      if (typeof v === 'string' && (node.$type || node.type || /^#|^\{/.test(v))) {
        if ((node.$type || node.type || 'color') === 'color') leaf(path, v);
        return;
      }
      for (const [k, child] of Object.entries(node)) if (!k.startsWith('$')) walk(child, [...path, k]);
    };
    walk(json, []);
  } else {
    // texte : une ligne peut ouvrir un bloc nommé (config Tailwind, SCSS map), qu'on suit
    const stack = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\/\/.*$|\/\*.*?\*\//g, '');
      const open = line.match(/^\s*['"]?([\w\-. ]+?)['"]?\s*[:=]\s*[\[{(]\s*$/);
      const hexes = [...line.matchAll(/#[0-9a-f]{3,8}\b/gi)];
      const funcs = line.match(/\b(?:rgba?|hsla?|oklch)\(/gi);
      if (funcs && !hexes.length) {
        const name = (line.split(/[:=]/)[0] || '').replace(/[-$@'"]/g, ' ').trim();
        funcs.forEach(() => { seen++; dropped.push({ path: [...stack, name].filter(Boolean), value: line.trim(), why: 'format' }); });
      }
      for (const m of hexes) {
        const before = line.slice(0, m.index).replace(/["'`]/g, '');
        const nm = before.match(/([\w\-. /]+?)\s*[:=]\s*$/);
        const name = nm ? nm[1].trim().replace(/^-+|^\$|^@/, '') : '';
        leaf([...stack, name].filter(Boolean), m[0]);
      }
      if (open) stack.push(open[1].trim());
      const closes = (line.match(/[}\])]/g) || []).length - (open ? 0 : (line.match(/[{\[(]/g) || []).length);
      for (let i = 0; i < closes && stack.length; i++) stack.pop();
    }
  }
  // doublons exacts : même chemin, même valeur — on n'en garde qu'un, et on le dit
  const uniq = new Map();
  for (const it of items) {
    const k = it.path.join('/') + '|' + it.hex;
    if (uniq.has(k)) { dropped.push({ path: it.path, value: it.hex, why: 'dup' }); continue; }
    uniq.set(k, it);
  }
  return { items: [...uniq.values()], dropped, seen };
}

const HUE_NAMES = [[25, 'red'], [60, 'orange'], [95, 'yellow'], [125, 'lime'], [150, 'green'], [185, 'teal'],
  [215, 'cyan'], [255, 'blue'], [278, 'indigo'], [298, 'violet'], [325, 'magenta'], [352, 'pink']];
export function hueName(H) {
  let best = HUE_NAMES[0][1], bd = 999;
  for (const [c, n] of HUE_NAMES) { const d = Math.abs(((H - c + 540) % 360) - 180); if (d < bd) { bd = d; best = n; } }
  return best;
}
/** Le cran que le contraste d'une couleur lui donne sur la grille de référence. */
export function naturalStep(hex) {
  const n = REFERENCE_STEPS.length, shade = 200 * Math.log(contrastVsBlack(hex)) / Math.log(21);
  return REFERENCE_STEPS[Math.max(0, Math.min(n - 1, Math.round((1 - shade / 200) * n - 0.5)))];
}
export function guessKind(name, chroma) {
  if (/error|danger|critical|negative|success|positive|valid|warning|caution|attention|info|notice/.test(name)) return 'system';
  if (chroma < 0.035 || /neutral|gr[ae]y|slate|zinc|stone|sand|mono|ink/.test(name)) return 'neutral';
  return 'product';
}

/** Des couleurs à plat → des nuanciers, par le nom d'abord, par la teinte à défaut. */
export function groupItems(items) {
  const fams = new Map();
  const loose = [];
  for (const it of items) {
    const segs = it.path.join('-').split(/[-_./\s]+/).filter(Boolean).map(s => s.toLowerCase()).filter(s => !GENERIC.has(s));
    const last = segs[segs.length - 1];
    const role = last && isRole(last) ? last : null;
    const fam = (role ? segs.slice(0, -1) : segs).join('-');
    if (!fam) { loose.push({ ...it, role }); continue; }
    if (!fams.has(fam)) fams.set(fam, []);
    fams.get(fam).push({ ...it, role: role || 'default' });
  }
  // sans nom de famille : regroupées par teinte, les quasi-gris à part
  const byHue = [];
  for (const it of loose) {
    const { C, H } = hexToOklch(it.hex);
    if (C < 0.035) { (fams.get('neutral') || fams.set('neutral', []).get('neutral')).push({ ...it, role: it.role || naturalStep(it.hex) }); continue; }
    byHue.push({ ...it, H });
  }
  byHue.sort((a, b) => a.H - b.H);
  let cluster = [];
  const flush = () => {
    if (!cluster.length) return;
    const H = cluster[Math.floor(cluster.length / 2)].H;
    let name = hueName(H), k = 2;
    while (fams.has(name)) name = hueName(H) + '-' + k++;
    fams.set(name, cluster.map(c => ({ ...c, role: c.role || naturalStep(c.hex) })));
    cluster = [];
  };
  for (const it of byHue) {
    if (cluster.length && it.H - cluster[cluster.length - 1].H > 28) flush();
    cluster.push(it);
  }
  flush();

  const ramps = [];
  let brandSet = false;
  for (const [fam, list] of fams) {
    const anchors = {};
    for (const it of list) {
      let role = it.role, k = 2;
      while (anchors[role] && anchors[role] !== it.hex) role = it.role + '-' + k++;
      anchors[role] = it.hex;
    }
    const chroma = Math.max(...list.map(it => hexToOklch(it.hex).C));
    let kind = guessKind(fam, chroma);
    if (kind === 'product' && !brandSet) { kind = 'brand'; brandSet = true; }
    let name = slug(fam), k = 2;
    while (ramps.some(r => r.name === name)) name = slug(fam) + '-' + k++;
    ramps.push({ name, label: fam.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()), kind, anchors, seed: seedFor(anchors) });
  }
  return ramps;
}
/** La couleur qui porte l'identité d'un nuancier importé. */
export function seedFor(anchors) {
  for (const r of SEED_ROLES) if (anchors[r]) return anchors[r];
  const list = Object.values(anchors);
  if (list.length === 1) return list[0];
  // à défaut, la plus proche du milieu de l'échelle
  return list.slice().sort((a, b) => Math.abs(REFERENCE_STEPS.indexOf(naturalStep(a)) - 5) - Math.abs(REFERENCE_STEPS.indexOf(naturalStep(b)) - 5))[0];
}
