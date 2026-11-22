// L'audit d'un fichier Figma, à partir d'un relevé (`engine/figma-scan.js`, à exécuter dans
// Figma) : ce que le fichier fait vraiment de ses couleurs, au-delà de ce que ses variables
// déclarent. Les quatre constats qui reviennent à chaque mission :
// - les couleurs **en dur** les plus employées, hors de toute variable, avec le rang que leur
//   contraste leur donne (une couleur très employée calée sur un niveau peut révéler un cran
//   manquant) ;
// - le **taux de liaison** : la part des remplissages et des textes liés à une variable ;
// - les **libellés qui mentent** : le hex écrit à côté d'une pastille n'est pas sa couleur ;
// - les **doublons** : la même variable, le même style, sous plusieurs clés ou bibliothèques.

import { normHex, naturalStep } from './import.mjs';
import { deltaE2000Hex } from './deltae.mjs';
import { relativeLuminance } from './color.mjs';

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
export const isFigmaScan = json => !!(json && json.hueladderFigmaScan);

export function figmaAudit(scan) {
  const vars = scan.variables || [];
  const values = vars.flatMap(v => Object.values(v.values || {}).map(h => normHex(h)?.hex).filter(Boolean));
  const nearest = hex => values.reduce((b, h) => { const d = deltaE2000Hex(hex, h); return d < b.d ? { d, hex: h } : b; }, { d: Infinity, hex: null });

  const fills = scan.fills || [];
  const total = fills.reduce((n, f) => n + f.count, 0), bound = fills.filter(f => f.bound).reduce((n, f) => n + f.count, 0);
  const texts = scan.texts || { total: 0, bound: 0 };
  const hard = fills.filter(f => !f.bound).map(f => {
    const hex = normHex(f.hex)?.hex; if (!hex) return null;
    const near = nearest(hex);
    return { hex, count: f.count, y: round(relativeLuminance(hex), 4), rank: naturalStep(hex), nearest: near.hex ? { hex: near.hex, deltaE: round(near.d) } : null };
  }).filter(Boolean).sort((a, b) => b.count - a.count);

  const lies = (scan.labels || []).map(l => {
    const said = normHex(l.label)?.hex, is = normHex(l.fill)?.hex;
    return said && is && deltaE2000Hex(said, is) > 1 ? { node: l.node, said, is, deltaE: round(deltaE2000Hex(said, is)) } : null;
  }).filter(Boolean);

  const byName = new Map();
  for (const x of [...(scan.styles || []).map(s => ({ name: s.name, key: s.key, kind: 'style' })), ...vars.map(v => ({ name: v.name, key: v.key || v.collection, kind: 'variable' }))]) {
    if (!byName.has(x.name)) byName.set(x.name, new Set());
    byName.get(x.name).add(x.key);
  }
  const duplicates = [...byName].filter(([, keys]) => keys.size > 1).map(([name, keys]) => ({ name, copies: keys.size }));

  const allScopes = vars.filter(v => (v.scopes || []).includes('ALL_SCOPES')).length;
  const noSyntax = vars.filter(v => !v.codeSyntax || !Object.keys(v.codeSyntax).length).length;
  return {
    file: scan.file || '', date: scan.date || '',
    variables: vars.length, collections: [...new Set(vars.map(v => v.collection))].length,
    binding: { fills: total ? round(bound / total * 100) : null, texts: texts.total ? round(texts.bound / texts.total * 100) : null },
    hard: hard.slice(0, 15), hardTotal: hard.reduce((n, h) => n + h.count, 0),
    lies, duplicates, allScopes, noSyntax,
  };
}

export function figmaMarkdown(a, { lang = 'en' } = {}) {
  const en = lang === 'en', T = (f, e) => (en ? e : f), n = x => (x === null ? '—' : en ? String(x) : String(x).replace('.', ','));
  const L = [`## Figma${a.file ? ' — ' + a.file : ''}${a.date ? ' (' + a.date + ')' : ''}`, '',
    T(`${a.variables} variables couleur dans ${a.collections} collection(s). Remplissages liés à une variable : ${n(a.binding.fills)} % ; textes : ${n(a.binding.texts)} %.`,
      `${a.variables} colour variables in ${a.collections} collection(s). Fills bound to a variable: ${n(a.binding.fills)}%; texts: ${n(a.binding.texts)}%.`),
    T(`${a.allScopes} variable(s) ouvertes à tous les usages (\`ALL_SCOPES\`), ${a.noSyntax} sans nom pour le code (\`codeSyntax\`).`, `${a.allScopes} variable(s) open to every use (\`ALL_SCOPES\`), ${a.noSyntax} without a code name (\`codeSyntax\`).`), ''];
  if (a.hard.length) {
    L.push(`### ${T('Couleurs en dur les plus employées', 'Most used hard-coded colours')}`, '', `| hex | ${T('emplois', 'uses')} | Y | ${T('rang mérité', 'earned step')} | ${T('variable la plus proche', 'closest variable')} |`, '|---|---|---|---|---|');
    for (const h of a.hard) L.push(`| \`${h.hex}\` | ${h.count} | ${n(h.y)} | ${h.rank} | ${h.nearest ? `\`${h.nearest.hex}\` (ΔE ${n(h.nearest.deltaE)})` : '—'} |`);
    L.push('');
  }
  if (a.lies.length) L.push(`### ${T('Libellés qui mentent', 'Labels that lie')}`, '', ...a.lies.map(l => `- ${l.node} : ${T('écrit', 'says')} \`${l.said}\`, ${T('rempli', 'filled')} \`${l.is}\` (ΔE ${n(l.deltaE)})`), '');
  if (a.duplicates.length) L.push(`### ${T('Doublons', 'Duplicates')}`, '', ...a.duplicates.map(d => `- ${d.name} : ${d.copies} ${T('copies', 'copies')}`), '');
  return L.join('\n');
}
