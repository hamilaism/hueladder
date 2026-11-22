// L'audit : ce que vaut une palette existante, ou plusieurs à la fois (marques, produits,
// versions), sans rien générer. Partagé par le studio (entrée Auditer) et la ligne de commande
// (`hueladder audit`).
//
// Comme le diagnostic, chaque phrase est écrite à partir des chiffres, jamais à la main.

import { parseInput, groupItems, slug, normHex } from './import.mjs';
import { applyNaming, NAMINGS } from './naming.mjs';
import { buildData } from './build.mjs';
import { diagnose, describe } from './diagnose.mjs';
import { compareMethods } from './compare.mjs';
import { deltaE2000Hex } from './deltae.mjs';
import { hexToHsl, hexToOklch } from './color.mjs';
import { distinguishability } from './cvd.mjs';
import { extractPairs, auditPairs, pairsMarkdown } from './pairs.mjs';
import { isFigmaScan, figmaAudit, figmaMarkdown } from './figma.mjs';

const GENERATIVE = ['oklch', 'fusilier', 'mix', 'hct', 'leonardo', 'apca', 'easing', 'tailwind'];
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const byStep = (a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b));
// l'étendue d'un ensemble de teintes, sur le cercle : 360° moins le plus grand trou
const hueSpan = hs => {
  if (hs.length < 2) return 0;
  const s = [...hs].sort((a, b) => a - b);
  let gap = 360 - s[s.length - 1] + s[0];
  for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i] - s[i - 1]);
  return 360 - gap;
};

// ---------------------------------------------------------------- lire une source

/**
 * Une source telle qu'on la colle ou la charge : le texte, son nom (marque, produit, version),
 * et d'où elle vient. Rien n'est jeté en silence : `dropped` dit ce qui n'a pas été lu et
 * pourquoi, `paths` garde chaque chemin (couleurs et alias) pour comparer deux versions.
 */
export function readSource(text, { name = 'source', origin = '', date = '', lang = 'en', naming = 'grid', stepList } = {}) {
  // un relevé Figma (engine/figma-scan.js) : ses variables, au premier mode (ou « Light »), font la palette
  let figma = null;
  try {
    const j = JSON.parse(text);
    if (isFigmaScan(j)) {
      figma = figmaAudit(j);
      const tree = {};
      for (const v of j.variables || []) {
        const modes = Object.keys(v.values || {}), m = modes.find(x => /light|clair/i.test(x)) || modes[0];
        if (!m) continue;
        let node = tree; const segs = v.name.split('/');
        segs.slice(0, -1).forEach(s => { node = node[s] = node[s] || {}; });
        node[segs[segs.length - 1]] = { $type: 'color', $value: v.values[m] };
      }
      text = JSON.stringify(tree);
      if (!date) date = j.date || '';
      if (!origin) origin = 'Figma' + (j.file ? ' — ' + j.file : '');
    }
  } catch (e) {}
  const res = parseInput(text);
  const paths = new Map();
  for (const it of res.items || []) paths.set(it.path.join('.'), it.hex);
  for (const d of res.dropped || []) if (d.why === 'alias' || d.why === 'dup') paths.set(d.path.join('.'), d.value);
  const spec = res.spec || {
    id: slug(name), brand: name, naming, stepList: stepList || NAMINGS[naming].presets.standard.slice(), lang,
    source: 'Hueladder', pinDefault: false, ramps: groupItems(res.items || []),
  };
  return { name, origin, date, spec, text, figma, read: res.items ? res.items.length : null, seen: res.seen ?? null,
    dropped: res.dropped || [], aliases: (res.dropped || []).filter(d => d.why === 'alias'), paths };
}

// ---------------------------------------------------------------- une source

/**
 * De quelle méthode la palette se rapproche-t-elle ? L'écart moyen (ΔE2000) entre les couleurs
 * fournies et ce que chaque méthode donnerait au même cran. Plus l'hypothèse « HSL à teinte et
 * saturation constantes », le geste de la plupart des palettes faites dans un sélecteur.
 */
export function methodResemblance(data) {
  const per = {};
  for (const a of data.anchorMap) {
    for (const m of GENERATIVE) {
      const pm = a.perMethod[m];
      if (pm && pm.hex) (per[m] = per[m] || []).push(pm.deltaE);
    }
  }
  const ranking = Object.entries(per).map(([method, ds]) => ({ method, label: data.methods[method]?.label || method, meanDE: round(mean(ds)), n: ds.length }))
    .sort((x, y) => x.meanDE - y.meanDE);
  const hsl = data.ramps.filter(r => !r.derived && r.kind !== 'neutral').map(r => {
    const hexes = Object.values(r.anchors || {}).filter(Boolean);
    if (hexes.length < 3) return null;
    const v = hexes.map(hexToHsl);
    return { ramp: r.name, hueRange: round(hueSpan(v.map(x => x.h))), satRange: round((Math.max(...v.map(x => x.s)) - Math.min(...v.map(x => x.s))) * 100) };
  }).filter(Boolean);
  // une rampe « HSL » garde sa teinte à 2° et sa saturation à 5 points près
  const hslLike = hsl.filter(h => h.hueRange <= 2 && h.satRange <= 5).length;
  return { ranking, closest: ranking[0] || null, hsl, hslLike };
}

/** L'audit d'une source : le diagnostic, la ressemblance, et ce que chaque méthode en ferait. */
export function auditSource(src, { lang = 'en' } = {}) {
  const spec = applyNaming(src.spec);
  const data = buildData(spec);
  const findings = diagnose(data, src.spec.ramps, { accepted: (src.spec.accepted || []).map(a => a.key) })
    .map(f => ({ ...f, ...describe(f, data, lang) }));
  const ex = data.metrics.existing || {};
  return {
    name: src.name, origin: src.origin, date: src.date, read: src.read, seen: src.seen,
    dropped: src.dropped, aliases: src.aliases.length,
    rampCount: data.meta.rampCount, colorCount: data.anchorMap.length,
    crossings: ex.interchangeability?.light?.crossingPairs ?? null,
    findings, resemblance: methodResemblance(data), checks: verifyRamps(src.spec.ramps, { lang }),
    // ce que voient les personnes daltoniennes, sur les couleurs telles qu'elles sont (pas régénérées)
    cvd: distinguishability(data, { method: 'existing' }),
    ladder: ['grid', 'rank'].includes(spec.naming) ? medianLadder(src.spec, data) : null,
    // la couche qui se sert des couleurs, quand la source la contient : les paires par état
    pairs: (() => { const p = src.text ? extractPairs(src.text) : []; return p.length ? auditPairs(p) : null; })(),
    figma: src.figma || null,
    methods: compareMethods(data, { lang }).map(({ fails, ...r }) => ({ ...r, fails: fails.length })),
    spec: src.spec, data,
  };
}

// ---------------------------------------------------------------- plusieurs sources

/**
 * Plusieurs sources face à face : chaque famille, cran par cran, est alignée (même couleur
 * partout), divergente (des couleurs différentes sous le même nom) ou exclusive (une seule
 * source l'a). Puis les familles qui changent de nom d'une source à l'autre, les grilles de
 * crans, et la table de triage qui dit par où commencer.
 *
 * Seuils (ΔE2000) : sous 0,5 deux valeurs sont la même ; à partir de 10, un même nom désigne
 * deux couleurs ; sous 5 en moyenne, deux noms désignent sans doute la même famille.
 */
export function compareSources(audits, { aligned = 0.5, sameName = 10, rename = 5 } = {}) {
  const names = audits.map(a => a.name);
  const fam = new Map();
  for (const a of audits) {
    for (const r of a.spec.ramps) {
      if (!fam.has(r.name)) fam.set(r.name, { name: r.name, label: r.label || r.name, kind: r.kind, by: {} });
      fam.get(r.name).by[a.name] = r.anchors || {};
    }
  }
  const families = [...fam.values()].map(f => {
    const srcs = names.filter(n => f.by[n]);
    const steps = [...new Set(srcs.flatMap(s => Object.keys(f.by[s])))].sort(byStep);
    const cells = steps.map(st => {
      const vals = srcs.filter(s => f.by[s][st]).map(s => [s, f.by[s][st]]);
      if (vals.length < 2) return { step: st, status: 'exclusive', values: Object.fromEntries(vals) };
      let maxDE = 0;
      for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) maxDE = Math.max(maxDE, deltaE2000Hex(vals[i][1], vals[j][1]));
      return { step: st, status: maxDE < aligned ? 'aligned' : 'divergent', maxDE: round(maxDE), values: Object.fromEntries(vals) };
    });
    const shared = cells.filter(c => c.status !== 'exclusive');
    const divergent = cells.filter(c => c.status === 'divergent').length;
    const status = srcs.length === 1 ? 'exclusive' : divergent ? 'divergent' : srcs.length === names.length ? 'aligned' : 'shared';
    return { name: f.name, label: f.label, kind: f.kind, sources: srcs, steps: steps.length, divergent,
      meanDE: shared.length ? round(mean(shared.map(c => c.maxDE))) : null, status, cells };
  });

  // un même nom pour deux couleurs : le piège qui coûte le plus quand on passe d'une marque à l'autre
  const sameNameDifferent = families.filter(f => f.status === 'divergent' && f.meanDE >= sameName)
    .map(f => ({ name: f.name, meanDE: f.meanDE, sources: f.sources }));

  // deux noms pour une couleur : chaque famille propre à une source, contre celles propres à l'autre
  const renames = [];
  for (let i = 0; i < audits.length; i++) {
    for (let j = i + 1; j < audits.length; j++) {
      const A = audits[i], B = audits[j];
      const onlyA = A.spec.ramps.filter(r => !B.spec.ramps.some(x => x.name === r.name));
      const onlyB = B.spec.ramps.filter(r => !A.spec.ramps.some(x => x.name === r.name));
      for (const ra of onlyA) {
        for (const rb of onlyB) {
          const common = Object.keys(ra.anchors || {}).filter(st => rb.anchors?.[st]);
          if (common.length < 2) continue;
          const de = round(mean(common.map(st => deltaE2000Hex(ra.anchors[st], rb.anchors[st]))));
          if (de < rename) renames.push({ a: { source: A.name, family: ra.name }, b: { source: B.name, family: rb.name }, meanDE: de, steps: common.length });
        }
      }
    }
  }
  renames.sort((x, y) => x.meanDE - y.meanDE);

  // les grilles : quels crans chaque source utilise, et les familles trop courtes pour être des rampes
  const numeric = s => /^\d+$/.test(s);
  const grids = audits.map(a => ({
    source: a.name,
    steps: [...new Set(a.spec.ramps.flatMap(r => Object.keys(r.anchors || {}).filter(numeric)))].sort(byStep),
    partial: a.spec.ramps.filter(r => Object.keys(r.anchors || {}).length < 3).map(r => r.name),
  }));
  const commonGrid = grids.every(g => g.steps.join() === grids[0].steps.join());

  // le triage : par où commencer — les divergences d'abord, puis ce que la régénération bougerait
  const toCore = {};
  for (const a of audits) {
    const core = a.data.meta.coreMethod, per = {};
    for (const x of a.data.anchorMap) { const pm = x.perMethod[core]; if (pm && pm.hex) (per[x.ramp] = per[x.ramp] || []).push(pm.deltaE); }
    toCore[a.name] = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, round(mean(v))]));
  }
  const triage = families.map(f => ({
    name: f.name, status: f.status, coverage: f.sources.length + '/' + names.length, steps: f.steps, divergent: f.divergent, meanDE: f.meanDE,
    regenDE: round(Math.max(...f.sources.map(s => toCore[s]?.[f.name] ?? 0))),
  })).sort((x, y) => (y.divergent - x.divergent) || ((y.meanDE ?? -1) - (x.meanDE ?? -1)) || (y.regenDE - x.regenDE));

  const count = st => families.filter(f => f.status === st).length;
  return { sources: names, families, totals: { aligned: count('aligned'), shared: count('shared'), divergent: count('divergent'), exclusive: count('exclusive') },
    sameNameDifferent, renames, grids, commonGrid, triage };
}

/**
 * Deux versions d'une même palette (avant, après) : les chemins perdus — ce qu'un code qui
 * s'appuyait sur l'ancienne version ne trouvera plus —, les ajouts, les valeurs qui changent,
 * et la dette d'alias de chaque côté.
 */
export function diffVersions(before, after) {
  const lost = [], added = [], changed = [];
  let same = 0;
  for (const [p, v] of before.paths) {
    if (!after.paths.has(p)) { lost.push({ path: p, value: v }); continue; }
    const w = after.paths.get(p), hv = normHex(v)?.hex, hw = normHex(w)?.hex;
    if (hv && hw) {
      const de = deltaE2000Hex(hv, hw);
      if (de >= 0.5) changed.push({ path: p, from: hv, to: hw, deltaE: round(de) }); else same++;
    } else if (v !== w) changed.push({ path: p, from: v, to: w, deltaE: null });
    else same++;
  }
  for (const [p, v] of after.paths) if (!before.paths.has(p)) added.push({ path: p, value: v });
  return { before: before.name, after: after.name, lost, added, changed, same, aliases: { before: before.aliases.length, after: after.aliases.length } };
}

// ---------------------------------------------------------------- la décision

/**
 * Ce qu'un décideur a besoin de lire : garder ou régénérer, avec quelle méthode, la méthode de
 * repli, ce que la régénération bougerait famille par famille (même ΔE que la migration), et
 * ce qui ne dépend pas de la méthode.
 *
 * Bandes d'impact (ΔE2000 moyen d'une famille) : sous 7 un lifting quasi invisible, de 7 à 15
 * un changement perceptible, au-delà un changement visible, à présenter avant de basculer.
 */
export function decision(audit) {
  const data = audit.data, core = data.meta.coreMethod;
  const ex = data.metrics.existing || {}, co = data.metrics[core] || {};
  const rows = audit.methods;
  const chosen = rows.find(r => r.method === core) || null;
  const fallback = rows.filter(r => r.holds && r.method !== core).sort((a, b) => a.deltaE - b.deltaE)[0] || null;
  const per = {};
  for (const a of data.anchorMap) { const pm = a.perMethod[core]; if (pm && pm.hex) (per[a.ramp] = per[a.ramp] || []).push(pm.deltaE); }
  const impact = Object.entries(per).map(([ramp, ds]) => ({ ramp, label: data.ramps.find(r => r.name === ramp)?.label || ramp, meanDE: round(mean(ds)) }))
    .sort((x, y) => x.meanDE - y.meanDE);
  const bands = {
    invisible: impact.filter(i => i.meanDE < 7),
    perceptible: impact.filter(i => i.meanDE >= 7 && i.meanDE < 15),
    visible: impact.filter(i => i.meanDE >= 15),
  };
  const before = { crossings: ex.interchangeability?.light?.crossingPairs ?? null, violations: ex.violationCount ?? null };
  const after = { crossings: co.interchangeability?.light?.crossingPairs ?? null, violations: co.violationCount ?? null };
  // garder l'existant se défend s'il ne franchit déjà aucun seuil
  const keep = before.crossings === 0;
  return { core, label: data.methods[core]?.label || core, keep, chosen, fallback, before, after, impact, bands,
    findings: audit.findings.length, structural: audit.findings.filter(f => ['far', 'pair', 'crowd'].includes(f.type)).length };
}

// ---------------------------------------------------------------- en mots

const T = lang => (fr, en) => (lang === 'en' ? en : fr);
const n = (x, lang, d = 1) => (x === null || x === undefined ? '—' : (Math.round(x * 10 ** d) / 10 ** d).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR'));

/** La distinguabilité en une phrase : sous 5 (OKLab × 100), deux aplats se confondent. */
export function cvdLine(c, lang = 'en') {
  const t = T(lang), V = { normal: t('vision normale', 'normal vision'), protan: t('protanopie', 'protanopia'), deutan: t('deutéranopie', 'deuteranopia'), tritan: t('tritanopie', 'tritanopia') };
  return t('Distinguabilité au cran d\'ancrage (OKLab × 100, sous 5 deux aplats se confondent) : ', 'Distinguishability at the anchor step (OKLab × 100, under 5 two fills merge): ')
    + Object.entries(c).map(([v, x]) => `${V[v]} ${n(x.min, lang)}${x.pair ? ' (' + x.pair.join(' ↔ ') + ')' : ''}`).join(' · ') + '.';
}

/** Le rapport d'audit en Markdown : une source ou plusieurs, et le diff si on compare deux versions. */
export function auditMarkdown(result, { lang = 'en' } = {}) {
  const t = T(lang), L = [];
  const { audits, cross, diff, dark } = result;
  L.push(`# ${t('Audit des couleurs', 'Colour audit')}`, '');
  L.push(`## ${t('À lire avant les chiffres', 'Read before the numbers')}`, '');
  for (const a of audits) {
    const dropped = a.dropped.length ? t(`, ${a.dropped.length} écartée(s) : `, `, ${a.dropped.length} left out: `) + Object.entries(a.dropped.reduce((m, d) => ((m[d.why] = (m[d.why] || 0) + 1), m), {})).map(([k, v]) => `${v} ${k}`).join(', ') : '';
    L.push(`- **${a.name}**${a.origin ? ' — ' + a.origin : ''}${a.date ? ' (' + a.date + ')' : ''} : ${a.read ?? '—'} ${t('couleurs lues', 'colours read')}${a.seen ? t(' sur ', ' of ') + a.seen : ''}${dropped}, ${a.rampCount} ${t('nuanciers', 'ramps')}.`);
  }
  for (const a of audits) {
    L.push('', `## ${a.name}`, '');
    const r = a.resemblance;
    if (r.closest) L.push(t(`Méthode la plus proche : **${r.closest.label}** (écart moyen ΔE ${n(r.closest.meanDE, lang)}).`, `Closest method: **${r.closest.label}** (mean gap ΔE ${n(r.closest.meanDE, lang)}).`)
      + (!r.hsl.length ? '' : r.hslLike * 2 >= r.hsl.length
        ? t(` ${r.hslLike} nuancier(s) sur ${r.hsl.length} gardent teinte et saturation HSL constantes : la palette a été faite en ne faisant varier que la clarté HSL.`, ` ${r.hslLike} of ${r.hsl.length} ramp(s) keep HSL hue and saturation constant: the palette was made by varying HSL lightness only.`)
        : t(` Ce n'est pas une palette HSL : ${r.hslLike} nuancier(s) sur ${r.hsl.length} seulement gardent teinte et saturation constantes.`, ` Not an HSL palette: only ${r.hslLike} of ${r.hsl.length} ramp(s) keep hue and saturation constant.`)), '');
    if (a.crossings !== null) L.push(t(`Franchissements de seuil à cran égal : **${a.crossings}** (une règle écrite une fois pour toutes les teintes tient à zéro).`, `Threshold crossings at equal step: **${a.crossings}** (a rule written once for every hue holds at zero).`), '');
    if (a.checks) L.push(...a.checks.map(c => `- ${c.pass ? '✓' : '✗'} ${c.label} — ${c.detail}`), '');
    if (a.cvd && a.cvd.normal.min !== null) L.push(cvdLine(a.cvd, lang), '');
    if (a.ladder && a.ladder.monotone) L.push(t(`Barreau médian (la médiane des luminances fournies, cran par cran) : à ${n(a.ladder.maxGap, lang, 2)} shade au plus du barreau par défaut.`, `Median ladder (the median of the provided luminances, step by step): at most ${n(a.ladder.maxGap, lang, 2)} shade from the default ladder.`), '');
    if (a.pairs) L.push(pairsMarkdown(a.pairs, { lang }));
    if (a.figma) L.push(figmaMarkdown(a.figma, { lang }));
    if (!a.findings.length) L.push(t('Aucun constat.', 'No finding.'));
    a.findings.forEach((f, i) => L.push(`${i + 1}. **${f.kind}** — ${f.title} ${f.text}`));
  }
  if (cross) {
    L.push('', `## ${t('Les sources face à face', 'Sources side by side')}`, '');
    L.push(t(`${cross.totals.aligned} famille(s) alignées, ${cross.totals.divergent} divergentes, ${cross.totals.shared} partagées par une partie des sources, ${cross.totals.exclusive} exclusives.`,
      `${cross.totals.aligned} family(ies) aligned, ${cross.totals.divergent} divergent, ${cross.totals.shared} shared by some sources, ${cross.totals.exclusive} exclusive.`), '');
    if (cross.sameNameDifferent.length) L.push(`**${t('Même nom, couleur différente', 'Same name, different colour')}** : ` + cross.sameNameDifferent.map(s => `${s.name} (ΔE ${n(s.meanDE, lang)})`).join(', '), '');
    if (cross.renames.length) L.push(`**${t('Sans doute la même famille sous deux noms', 'Probably the same family under two names')}** : ` + cross.renames.map(r => `${r.a.source}·${r.a.family} ≈ ${r.b.source}·${r.b.family} (ΔE ${n(r.meanDE, lang)})`).join(', '), '');
    if (!cross.commonGrid) L.push(`**${t('Grilles de crans différentes', 'Different step grids')}** : ` + cross.grids.map(g => `${g.source} [${g.steps.join(', ')}]`).join(' ; '), '');
    L.push(`### ${t('Triage', 'Triage')}`, '', `| ${t('Famille', 'Family')} | ${t('Statut', 'Status')} | ${t('Couverture', 'Coverage')} | ${t('Crans', 'Steps')} | ${t('Divergents', 'Divergent')} | ΔE ${t('entre sources', 'between sources')} | ΔE ${t('si régénérée', 'if regenerated')} |`, '|---|---|---|---|---|---|---|');
    for (const r of cross.triage) L.push(`| ${r.name} | ${r.status} | ${r.coverage} | ${r.steps} | ${r.divergent} | ${n(r.meanDE, lang)} | ${n(r.regenDE, lang)} |`);
  }
  for (const d of dark || []) {
    L.push('', `## ${t('Mode sombre déclaré', 'Declared dark mode')} : ${d.of} (${t('fond', 'background')} ${d.background})`, '');
    L.push(t(`${d.pinned} valeur(s) sombres relues sur la palette claire.`, `${d.pinned} dark value(s) read onto the light palette.`) + (d.note ? ' ' + d.note + '.' : ''), '');
    L.push(...d.checks.map(c => `- ${c.info ? '·' : c.pass ? '✓' : '✗'} ${c.label} — ${c.detail}`));
  }
  if (diff) {
    L.push('', `## ${t('Deux versions', 'Two versions')} : ${diff.before} → ${diff.after}`, '');
    L.push(t(`${diff.lost.length} chemin(s) perdu(s), ${diff.added.length} ajouté(s), ${diff.changed.length} valeur(s) changée(s), ${diff.same} inchangé(s). Alias : ${diff.aliases.before} → ${diff.aliases.after}.`,
      `${diff.lost.length} path(s) lost, ${diff.added.length} added, ${diff.changed.length} value(s) changed, ${diff.same} unchanged. Aliases: ${diff.aliases.before} → ${diff.aliases.after}.`));
    if (diff.lost.length) L.push('', `**${t('Perdus', 'Lost')}** : ` + diff.lost.slice(0, 40).map(x => '`' + x.path + '`').join(', ') + (diff.lost.length > 40 ? ' …' : ''));
    if (diff.changed.length) L.push('', `**${t('Changés', 'Changed')}** : ` + diff.changed.slice(0, 40).map(x => '`' + x.path + '` ' + (x.deltaE === null ? '' : 'ΔE ' + n(x.deltaE, lang))).join(', ') + (diff.changed.length > 40 ? ' …' : ''));
  }
  return L.join('\n') + '\n';
}

/** La décision pour une spec qu'on recrée à partir d'une palette (Créer, depuis l'existant). */
export function decisionFor(data, ramps, { lang = 'en', accepted = [] } = {}) {
  const findings = diagnose(data, ramps, { accepted }).map(f => ({ ...f, ...describe(f, data, lang) }));
  return decision({ data, findings, methods: compareMethods(data, { lang }).map(({ fails, ...r }) => ({ ...r, fails: fails.length })) });
}

/** La page de décision en Markdown : se lit en trois minutes. */
export function decisionMarkdown(d, { lang = 'en', brand = '' } = {}) {
  const t = T(lang);
  const band = (k, title, text) => (d.bands[k].length ? [`### ${title} — ${d.bands[k].length}`, text, d.bands[k].map(i => `${i.label} ${n(i.meanDE, lang)}`).join(' · '), ''] : []);
  const L = [`# ${brand ? brand + ' — ' : ''}${t('garder ou régénérer ?', 'keep or regenerate?')}`, '',
    `## ${t('Verdict', 'Verdict')}`, '',
    d.keep
      ? t(`La palette actuelle ne franchit aucun seuil à cran égal : la garder se défend. Régénérer avec ${d.label} apporterait la règle écrite dans le nom.`,
        `The current palette crosses no threshold at equal step: keeping it is defensible. Regenerating with ${d.label} would bring the rule written in the name.`)
      : t(`Régénérer avec **${d.label}** : ${d.before.crossings ?? '—'} franchissement(s) de seuil aujourd'hui, ${d.after.crossings ?? '—'} après.`,
        `Regenerate with **${d.label}**: ${d.before.crossings ?? '—'} threshold crossing(s) today, ${d.after.crossings ?? '—'} after.`),
    d.fallback ? t(`Méthode de repli : ${d.fallback.label} (tient aussi le contrat, écart moyen ΔE ${n(d.fallback.deltaE, lang)}).`, `Fallback method: ${d.fallback.label} (also holds the contract, mean gap ΔE ${n(d.fallback.deltaE, lang)}).`)
      : t('Aucune autre méthode ne tient le contrat : pas de repli sans renoncer à la règle.', 'No other method holds the contract: no fallback without giving up the rule.'),
    '', `## ${t('Ce que ça bouge, famille par famille', 'What it moves, family by family')}`, '',
    ...band('invisible', t('Lifting quasi invisible', 'Near-invisible lift'), t('ΔE moyen sous 7 : bascule sans risque pour la perception de la marque.', 'Mean ΔE under 7: switch with no risk to brand perception.')),
    ...band('perceptible', t('Changement perceptible', 'Noticeable change'), t('ΔE de 7 à 15 : visible à l\'œil averti, le prix normal de la garantie.', 'ΔE 7 to 15: visible to a trained eye, the normal price of the guarantee.')),
    ...band('visible', t('Changement visible', 'Visible change'), t('ΔE au-delà de 15 : à montrer explicitement avant de basculer, pas à traiter en catimini.', 'ΔE above 15: show it explicitly before switching, never slip it in.')),
    `## ${t('Ce qui ne dépend pas de la méthode', 'What does not depend on the method')}`, '',
    t(`${d.findings} constat(s) au diagnostic, dont ${d.structural} de structure (couleurs hors famille, familles en doublon, doublons de rang) : ils restent à trancher quelle que soit la méthode.`,
      `${d.findings} finding(s), ${d.structural} of them structural (colours outside their family, duplicate families, rank collisions): they remain to be decided whatever the method.`),
    ''];
  return L.join('\n');
}

// ---------------------------------------------------------------- vérifier des fichiers livrés

/**
 * Le contrat vérifié sur des couleurs livrées, pas sur la sortie du moteur : ce qu'un fichier
 * de tokens promet vraiment une fois retouché, exporté, recopié. Trois garanties :
 * - la monotonie (la luminance décroît avec le numéro du cran en clair, croît en sombre) ;
 * - les seuils au même cran : à chaque cran, toutes les familles passent ou échouent ensemble
 *   les seuils 3, 4,5 et 7 sur le fond ;
 * - la règle du nom : le plus petit écart de rangs à partir duquel toutes les paires, toutes
 *   familles confondues, tiennent 3, 4,5 et 7.
 * Le contraste est recalculé ici, indépendamment du moteur qui a produit les couleurs.
 */
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

export function verifyRamps(ramps, { mode = 'light', background = mode === 'dark' ? '#121212' : '#ffffff', lang = 'en', expect = null } = {}) {
  const t = T(lang), out = [];
  const numeric = s => /^\d+$/.test(s);
  const fams = ramps.map(r => ({ name: r.name, kind: r.kind, steps: Object.keys(r.anchors || {}).filter(numeric).sort(byStep).map(s => [s, r.anchors[s]]) }))
    .filter(f => f.steps.length >= 2);

  // monotonie
  const bad = [];
  for (const f of fams) for (let i = 1; i < f.steps.length; i++) {
    const a = lum(f.steps[i - 1][1]), b = lum(f.steps[i][1]);
    if (mode === 'dark' ? b <= a : b >= a) bad.push(`${f.name}/${f.steps[i - 1][0]}→${f.steps[i][0]}`);
  }
  out.push({ key: 'mono', pass: !bad.length, label: t(`monotonie ${mode === 'dark' ? 'sombre' : 'clair'}`, `${mode} monotonicity`),
    detail: bad.length ? t(`ordre inversé : ${bad.slice(0, 6).join(', ')}`, `order inverted: ${bad.slice(0, 6).join(', ')}`) : t(`${fams.length} familles en ordre`, `${fams.length} families in order`) });

  // seuils au même cran
  const steps = [...new Set(fams.flatMap(f => f.steps.map(s => s[0])))].sort(byStep);
  const split = [];
  for (const st of steps) {
    // le neutre compris : remplacer une teinte par le neutre est la substitution la plus courante
    const vals = fams.map(f => [f.name, f.steps.find(s => s[0] === st)?.[1]]).filter(x => x[1]).map(([n, h]) => [n, ratio(h, background)]);
    if (vals.length < 2) continue;
    for (const th of [3, 4.5, 7]) {
      const pass = vals.filter(v => v[1] >= th), fail = vals.filter(v => v[1] < th);
      if (pass.length && fail.length) split.push(`${st} @${th}:1 (${fail.map(f => f[0]).slice(0, 3).join(', ')})`);
    }
  }
  out.push({ key: 'same', pass: !split.length, label: t('seuils au même cran', 'thresholds at the same step'),
    detail: split.length ? t(`une partie des familles seulement : ${split.slice(0, 5).join(' ; ')}`, `only some families: ${split.slice(0, 5).join('; ')}`) : t(`sur ${background}, chaque seuil tombe au même cran pour toutes les familles`, `on ${background}, each threshold falls at the same step for every family`) });

  // la règle du nom, paire par paire, rangs pris dans la grille commune : les crans portés par
  // la majorité des familles. Les crans hors grille (0, 25, 975… sur le seul neutre) n'ont pas de rang.
  const grid = steps.filter(s => fams.filter(f => f.steps.some(x => x[0] === s)).length * 2 > fams.length);
  const extra = steps.filter(s => !grid.includes(s));
  const rank = Object.fromEntries(grid.map((s, i) => [s, i]));
  const flat = fams.flatMap(f => f.steps.filter(([s]) => s in rank).map(([s, h]) => ({ r: rank[s], h })));
  const safe = th => {
    let worst = 0;
    for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) {
      const d = Math.abs(flat[i].r - flat[j].r);
      if (d && ratio(flat[i].h, flat[j].h) < th) worst = Math.max(worst, d);
    }
    return worst + 1;
  };
  const [ui, aa, aaa] = [3, 4.5, 7].map(safe);
  // sans règle attendue (`expect`, en rangs pour l'AA), la règle se constate sans se juger
  out.push({ key: 'rule', pass: expect ? aa <= expect : true, info: !expect, label: t('règle du nom', 'naming rule'),
    detail: t(`${ui} rangs ⇒ 3:1, ${aa} ⇒ 4,5:1, ${aaa} ⇒ 7:1, toutes familles confondues`, `${ui} ranks ⇒ 3:1, ${aa} ⇒ 4.5:1, ${aaa} ⇒ 7:1, across all families`)
      + (extra.length ? t(` (hors grille : ${extra.join(', ')})`, ` (off-grid: ${extra.join(', ')})`) : ''), rule: { ui, aa, aaa }, grid, extra });
  return out;
}

/**
 * Un fichier de tokens tel qu'il est livré : sa validité (chaque couleur a une valeur lisible,
 * aucun `null`, un type déclaré ou hérité), puis le contrat sur ses couleurs. Accepte les
 * couleurs DTCG en chaîne ou en objet (`{ colorSpace, components, hex }`, l'import natif de Figma).
 */
export function verifyTokens(text, { mode = 'light', background, lang = 'en', expect = null } = {}) {
  const t = T(lang);
  let json;
  try { json = JSON.parse(text); } catch (e) {
    // pas du JSON : une feuille CSS, du SCSS, une liste — on vérifie les couleurs qu'on y lit
    const src = readSource(text, { name: 'tokens', lang });
    return verifyRamps(src.spec.ramps, { mode, background, lang, expect });
  }
  let nulls = 0, untyped = 0, count = 0;
  const walk = (node, type) => {
    if (!node || typeof node !== 'object') return;
    const ty = node.$type || type;
    if ('$value' in node) {
      count++;
      if (node.$value === null || node.$value === undefined) nulls++;
      if (!ty) untyped++;
      if (node.$value && typeof node.$value === 'object' && typeof node.$value.hex === 'string') node.$value = node.$value.hex;
      return;
    }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, ty);
  };
  walk(json, null);
  const src = readSource(JSON.stringify(json), { name: 'tokens', lang });
  const valid = { key: 'valid', pass: !nulls && !untyped && !src.dropped.some(d => d.why === 'format'), label: t('tokens valides', 'valid tokens'),
    detail: t(`${count} tokens, ${nulls} null, ${untyped} sans type, ${src.dropped.filter(d => d.why === 'format').length} valeur(s) illisible(s), ${src.aliases.length} alias`,
      `${count} tokens, ${nulls} null, ${untyped} untyped, ${src.dropped.filter(d => d.why === 'format').length} unreadable value(s), ${src.aliases.length} alias(es)`) };
  return [valid, ...verifyRamps(src.spec.ramps, { mode, background, lang, expect })];
}

// ---------------------------------------------------------------- le barreau médian

/**
 * Le barreau qui déplace le moins une palette existante : à chaque cran, la médiane des
 * luminances des couleurs fournies sous ce nom, convertie en shade (le contraste face au noir
 * sur l'échelle de Fusilier). Les crans sans couleur sont interpolés entre leurs voisins. À
 * proposer, avec son écart au barreau par défaut : quand il est faible, la palette était déjà
 * sur une règle sans le savoir.
 *
 * Seulement pour les nomenclatures où le nom ne porte pas le contraste (grille, rang) : avec
 * une nomenclature par contraste, le nom est le barreau.
 */
export function medianLadder(spec, data) {
  const steps = data.meta.coreSteps, def = steps.map(st => data.ladders.shade[data.meta.steps.indexOf(st)]);
  const shadeOfY = y => (200 * Math.log((y + 0.05) / 0.05)) / Math.log(21);
  const known = steps.map(st => {
    const ys = spec.ramps.map(r => r.anchors && r.anchors[st]).filter(Boolean).map(lum).sort((a, b) => a - b);
    if (!ys.length) return null;
    const m = ys.length % 2 ? ys[(ys.length - 1) / 2] : (ys[ys.length / 2 - 1] + ys[ys.length / 2]) / 2;
    return { n: ys.length, shade: shadeOfY(m) };
  });
  if (known.filter(Boolean).length < 2) return null;
  // interpolation sur l'indice entre crans connus, bornes prises sur le barreau par défaut
  const shades = steps.map((_, i) => {
    if (known[i]) return known[i].shade;
    let a = i - 1; while (a >= 0 && !known[a]) a--;
    let b = i + 1; while (b < steps.length && !known[b]) b++;
    if (a < 0 || b >= steps.length) return def[i] + ((a >= 0 ? known[a].shade - def[a] : b < steps.length ? known[b].shade - def[b] : 0));
    return known[a].shade + ((known[b].shade - known[a].shade) * (i - a)) / (b - a);
  });
  // un barreau doit descendre : à défaut, la médiane n'est pas une règle
  const monotone = shades.every((s, i) => !i || s < shades[i - 1]);
  const gaps = steps.map((st, i) => ({ step: st, median: round(shades[i], 2), default: round(def[i], 2), gap: round(Math.abs(shades[i] - def[i]), 2), n: known[i] ? known[i].n : 0 }));
  return { shadeLadder: shades.map(s => round(s, 3)), monotone, maxGap: round(Math.max(...gaps.map(g => g.gap)), 2), steps: gaps };
}

// ---------------------------------------------------------------- un mode sombre déclaré

/**
 * L'audit d'un mode sombre qui existe déjà, sur les valeurs déclarées seules (rien n'est
 * régénéré) : les contrôles des fichiers livrés en sombre, face à son fond, puis la question
 * qui décide si une règle écrite en clair vaut en sombre — chaque seuil (3, 4,5, 7) tombe-t-il
 * au même cran dans les deux modes ? Ce qui ne s'apparie pas (une famille sans équivalent
 * clair) est dit. Le re-calage, ensuite, se fait dans Créer.
 */
export function auditDark(light, dark, { background = '#121212', lang = 'en' } = {}) {
  const t = T(lang);
  const unmatched = dark.spec.ramps.filter(r => !light.spec.ramps.some(x => x.name === r.name)).map(r => r.name);
  const firstStep = (ramps, bg, th) => Object.fromEntries(ramps.map(r => {
    const st = Object.keys(r.anchors || {}).filter(x => /^\d+$/.test(x)).sort(byStep).find(x => ratio(r.anchors[x], bg) >= th);
    return [r.name, st || null];
  }));
  const moved = [];
  for (const th of [3, 4.5, 7]) {
    const l = firstStep(light.spec.ramps, '#ffffff', th), d = firstStep(dark.spec.ramps, background, th);
    for (const name of Object.keys(d)) if (name in l && l[name] !== d[name]) moved.push(`${name} @${th}:1 ${l[name] ?? '—'} → ${d[name] ?? '—'}`);
  }
  const between = { key: 'modes', pass: !moved.length, label: t('seuils identiques entre modes', 'same thresholds in both modes'),
    detail: moved.length ? t(`le cran change d'un mode à l'autre : ${moved.slice(0, 6).join(' ; ')}`, `the step changes between modes: ${moved.slice(0, 6).join('; ')}`) : t('chaque seuil tombe au même cran en clair et en sombre', 'each threshold falls at the same step in light and dark') };
  return { background, unmatched, pinned: dark.spec.ramps.reduce((n, r) => n + Object.keys(r.anchors || {}).length, 0),
    checks: [...verifyRamps(dark.spec.ramps, { mode: 'dark', background, lang }), between],
    note: unmatched.length ? t(`sans équivalent clair : ${unmatched.join(', ')}`, `no light equivalent: ${unmatched.join(', ')}`) : '' };
}
