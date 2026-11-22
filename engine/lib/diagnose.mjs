// Le diagnostic d'une palette : des constats structurés (le fait, ses chiffres, les actions
// possibles), leur description en français ou en anglais, et l'application d'une action à la
// spec. Partagé par le studio (étape Comprendre) et la ligne de commande (`hueladder diagnose`).
//
// Chaque phrase est écrite à partir des chiffres du moteur, jamais à la main : une phrase qui
// contredit ses propres chiffres ruine tout le reste.

import { contrast, relativeLuminance, fmtRatio, hexToOklch } from './color.mjs';
import { deltaE2000Hex } from './deltae.mjs';
import { seedFor, hueName } from './import.mjs';
import { roleOf, moveSystemAway, systemOptions } from './suggest.mjs';

const scale = (data, ramp) => {
  const r = data.ramps.find(x => x.name === ramp), m = data.meta.coreMethod;
  return Object.fromEntries(data.meta.steps.map((s, i) => [s, r && r.colors[m] ? r.colors[m][i] : null]));
};

/**
 * Les constats, du plus grave au moins grave. `ramps` : les nuanciers de la spec (pour savoir
 * quelles actions sont possibles) ; `accepted` : les clés des constats déjà acceptés.
 */
export function diagnose(data, ramps, { accepted = [] } = {}) {
  const out = [];
  const steps = data.meta.steps, core = data.meta.coreMethod;
  const skip = key => accepted.includes(key);
  const R = name => ramps.find(r => r.name === name);

  for (const a of data.anchorMap) {
    if (!steps.includes(a.role) || !a.naturalStep || a.role === a.naturalStep) continue;
    const key = a.ramp + '|' + a.role;
    if (skip(key)) continue;
    const gap = steps.indexOf(a.naturalStep) - steps.indexOf(a.role);
    const replacement = scale(data, a.ramp)[a.role];
    const r = R(a.ramp);
    const actions = [];
    if (r && !r.anchors[a.naturalStep]) actions.push({ type: 'rename', to: a.naturalStep });
    else if (r) actions.push({ type: 'renameFamily' });
    if (r && replacement) actions.push({ type: 'replace', hex: replacement });
    actions.push({ type: 'accept' });
    out.push({ type: 'misnamed', key, sev: Math.abs(gap) >= 2 ? 'bad' : 'warn', weight: Math.abs(gap) * 10,
      ramp: a.ramp, role: a.role, hex: a.hex, natural: a.naturalStep, gap, white: contrast(a.hex, '#ffffff'), replacement,
      swatches: [a.hex, replacement].filter(Boolean), actions });
  }

  // une couleur sans équivalent dans sa rampe générée n'appartient pas à la famille
  for (const a of data.anchorMap) {
    const pm = a.perMethod[core];
    const key = 'far|' + a.ramp + '|' + a.role;
    if (!pm || pm.deltaE <= 10 || skip(key)) continue;
    const r = R(a.ramp), nr = ramps.find(x => x.kind === 'neutral' && x.name !== a.ramp);
    const actions = [];
    if (r && nr) actions.push({ type: 'toNeutral', neutral: nr.name });
    if (r && Object.keys(r.anchors).length > 1) actions.push({ type: 'dropRole', role: a.role });
    actions.push({ type: 'accept' });
    out.push({ type: 'far', key, sev: 'bad', weight: 25, ramp: a.ramp, role: a.role, hex: a.hex, closest: pm.hex, deltaE: pm.deltaE,
      swatches: [a.hex, pm.hex], actions });
  }

  const ex = data.metrics.existing?.interchangeability?.light;
  if (ex && ex.crossingPairs) {
    for (const c of ex.crossings.slice(0, 4)) {
      out.push({ type: 'cross', key: 'cross|' + c.step + '|' + c.threshold, sev: 'bad', weight: 30, step: c.step, threshold: c.threshold,
        pass: c.pass, fail: c.fail, worst: c.worstFail, actions: [{ type: 'regen' }] });
    }
  }

  for (const r of data.ramps) {
    const list = Object.entries(r.anchors).map(([role, hex]) => ({ role, hex, y: relativeLuminance(hex) })).sort((x, y) => y.y - x.y);
    if (list.length >= 3) {
      const gaps = list.slice(1).map((x, i) => ({ from: list[i].role, to: x.role, de: deltaE2000Hex(list[i].hex, x.hex) }));
      const max = gaps.reduce((x, y) => (y.de > x.de ? y : x)), min = gaps.reduce((x, y) => (y.de < x.de ? y : x));
      if (max.de > 2.5 * min.de && max.de > 8) {
        out.push({ type: 'gap', key: 'gap|' + r.name, sev: 'warn', weight: 12, ramp: r.name, min, max, factor: max.de / min.de,
          swatches: list.map(x => x.hex), actions: [{ type: 'regen' }] });
      }
    }
    for (const c of r.crowding || []) {
      const sr = R(r.name);
      out.push({ type: 'crowd', key: 'crowd|' + r.name + '|' + c.index, sev: 'warn', weight: 8, ramp: r.name, roles: c.roles || [],
        actions: (c.roles || []).filter(role => sr && sr.anchors[role]).map(role => ({ type: 'dropRole', role })) });
    }
    if (r.consistency && r.consistency.count >= 3 && r.consistency.hueRange > 15 && !skip('hue|' + r.name)) {
      out.push({ type: 'hue', key: 'hue|' + r.name, sev: 'warn', weight: 6, ramp: r.name, range: r.consistency.hueRange,
        actions: [{ type: 'regen' }, { type: 'accept' }] });
    }
  }

  for (const p of data.proximity?.pairs || []) {
    if (p.verdict === 'saturation') continue;
    const key = 'pair|' + p.a + '|' + p.b;
    if (skip(key)) continue;
    const dup = p.verdict === 'factorisable';
    // une couleur système ne se fusionne pas avec la marque : c'est elle qui s'écarte
    const sys = [p.a, p.b].find(n => { const r = R(n); return r && r.kind === 'system' && roleOf(r); });
    // l'écart cran par cran une fois régénérées : sous 1 indiscernable, sous 2,5 inexploitable en interface
    const ra = data.ramps.find(r => r.name === p.a), rb = data.ramps.find(r => r.name === p.b);
    const des = ra && rb ? ra.colors[core].map((h, i) => (h && rb.colors[core][i] ? deltaE2000Hex(h, rb.colors[core][i]) : null)).filter(x => x !== null) : [];
    const stepDE = des.length ? { mean: des.reduce((x, y) => x + y, 0) / des.length, max: Math.max(...des), under1: des.filter(x => x < 1).length, under25: des.filter(x => x < 2.5).length, n: des.length } : null;
    // la nature de la paire décide du geste : une couleur système ne se fusionne jamais avec une
    // couleur d'identité (marque, offre) — elle s'en écarte ; deux couleurs sans statut peuvent se fusionner
    const kinds = [ra, rb].map(r => (r ? r.kind : null));
    const nature = kinds.includes('system') ? (kinds.every(k => k === 'system') ? 'system' : 'identity-system') : 'free';
    out.push({ type: 'pair', key, sev: dup ? 'bad' : 'warn', weight: dup ? 20 : 5, a: p.a, b: p.b, dup, hueGap: p.hueGap, deltaE: p.coreDE ?? p.seedDE, stepDE, nature,
      // trois options chiffrées pour la couleur système, plutôt qu'un seul geste
      actions: sys ? [...systemOptions(ramps, sys, { deltaE: deltaE2000Hex, contrast }).map(o => ({ type: 'systemOption', ramp: sys, ...o })), { type: 'accept' }]
        : [{ type: 'dropRamp', ramp: p.b }, { type: 'accept' }] });
  }
  return out.sort((x, y) => y.weight - x.weight);
}

/**
 * Applique une action à des nuanciers, sans les modifier : rend les nouveaux nuanciers, et
 * selon l'action, la méthode à adopter ou l'exception à documenter.
 */
export function applyAction(ramps, f, action, data) {
  const clone = ramps.map(r => ({ ...r, anchors: { ...r.anchors } }));
  const r = clone.find(x => x.name === f.ramp);
  switch (action.type) {
    case 'rename':
      r.anchors[action.to] = r.anchors[f.role]; delete r.anchors[f.role];
      return { ramps: clone };
    case 'renameFamily': {
      // le cran visé est déjà pris, souvent par une autre couleur mal nommée : chaque couleur
      // prend le rang que le moteur lui a donné, collisions déjà résolues
      const next = {};
      for (const [role, hex] of Object.entries(r.anchors)) {
        const hit = data.anchorMap.find(x => x.ramp === f.ramp && x.role === role);
        let k = hit && hit.placedStep ? hit.placedStep : role, n = 2;
        while (next[k]) k = (hit ? hit.placedStep : role) + '-' + n++;
        next[k] = hex;
      }
      r.anchors = next;
      return { ramps: clone };
    }
    case 'replace':
      if (r.seed === r.anchors[f.role]) r.seed = action.hex;
      r.anchors[f.role] = action.hex;
      return { ramps: clone };
    case 'toNeutral': {
      const nr = clone.find(x => x.name === action.neutral);
      let k = f.role, n = 2; while (nr.anchors[k]) k = f.role + '-' + n++;
      nr.anchors[k] = r.anchors[f.role]; delete r.anchors[f.role];
      if (r.seed === f.hex) r.seed = seedFor(r.anchors);
      return { ramps: clone };
    }
    case 'dropRole': {
      const old = r.anchors[action.role];
      delete r.anchors[action.role];
      if (!r.seed || r.seed === old) r.seed = seedFor(r.anchors);
      return { ramps: clone };
    }
    case 'dropRamp': return { ramps: clone.filter(x => x.name !== action.ramp) };
    case 'moveAway': return { ramps: moveSystemAway(clone, action.ramp) };
    case 'systemOption': { const s = clone.find(x => x.name === action.ramp); s.anchors = { default: action.hex }; delete s.seed; return { ramps: clone }; }
    case 'regen': return { ramps: clone, method: 'fusilier' };
    case 'accept': return { ramps: clone, accept: { key: f.key } };
    default: throw new Error(`action inconnue : ${action.type}`);
  }
}

// ---------------------------------------------------------------- en mots

const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);
const W = {
  fr: {
    num: (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('fr-FR'),
    ratio: x => fmtRatio(x).replace('.', ',') + ':1',
    misnamed: ['Cran mal nommé', (r, f) => `« ${r} ${f.role} » a le contraste d'un ${f.natural}.`,
      (r, f, w) => `Son contraste la place ${plural(Math.abs(f.gap), 'cran', 'crans')} ${f.gap < 0 ? 'plus clair' : 'plus foncé'} que son nom.`
        + (Number(f.role) >= 500 && f.white < 4.5 ? ` Du texte blanc dessus tient ${w.ratio(f.white)}, sous le seuil AA de 4,5:1.` : '')],
    far: ['Couleur hors famille', (r, f) => `« ${r} ${f.role} » (${f.hex}) n'a pas d'équivalent dans sa rampe.`,
      (r, f, w) => `Une fois la famille régénérée, le cran le plus proche est ${f.closest}, à ΔE ${w.num(f.deltaE, 0)} : une autre couleur. Elle n'a sans doute rien à faire dans ce nuancier.`],
    cross: ['Crans non interchangeables', (r, f, w) => `Au ${f.step}, le seuil de ${w.num(f.threshold)}:1 sur blanc dépend de la famille.`,
      (r, f) => `${plural(f.pass, 'famille passe', 'familles passent')}, ${plural(f.fail, 'échoue', 'échouent')} (la plus faible : ${f.worst}). Une règle écrite une fois pour toutes les teintes est donc fausse aujourd'hui.`],
    gap: ['Pas irrégulier', (r, f) => `Dans « ${r} », les écarts entre couleurs vont du simple au ${f.factor >= 4 ? 'quadruple' : 'triple'}.`,
      (r, f, w) => `De ${f.min.from} à ${f.min.to} : ΔE ${w.num(f.min.de)}. De ${f.max.from} à ${f.max.to} : ΔE ${w.num(f.max.de)}. Il manque des crans là où l'écart est grand, ou deux couleurs font doublon là où il est petit.`],
    crowd: ['Doublon de rang', r => `Dans « ${r} », deux couleurs méritent le même cran.`, () => 'L\'une a dû glisser d\'un cran pour garder l\'ordre de clarté. L\'une des deux est probablement superflue.'],
    hue: ['Teinte qui tourne', (r, f, w) => `Dans « ${r} », la teinte tourne de ${w.num(f.range, 0)}° d'un bout à l'autre.`, () => 'Au-delà d\'une quinzaine de degrés, le clair et le foncé ne semblent plus de la même famille.'],
    pair: [f => (f.dup ? 'Familles en doublon' : 'Familles voisines'), (r, f, w, L) => (f.dup ? `« ${L(f.a)} » et « ${L(f.b)} » deviennent la même couleur une fois régénérées.` : `« ${L(f.a)} » et « ${L(f.b)} » sont très proches.`),
      (r, f, w) => `${w.num(f.hueGap)}° de teinte d'écart, ΔE moyen ${w.num(f.deltaE)} une fois régénérées. `
        + (f.stepDE ? `Cran par cran : ΔE moyen ${w.num(f.stepDE.mean)}, au plus ${w.num(f.stepDE.max)} ; ${f.stepDE.under25} cran(s) sur ${f.stepDE.n} sous 2,5, inexploitables en interface. ` : '')
        + (f.nature === 'identity-system' ? 'Une couleur de statut et une couleur d\'identité : à arbitrer, jamais à fusionner — c\'est la couleur système qui s\'écarte.'
          : f.dup ? 'Un seul nuancier suffit ; l\'autre nom devient un alias sémantique.' : 'À garder seulement si l\'écart a un sens pour l\'utilisateur.')],
    actions: {
      rename: a => 'renommer en ' + a.to, renameFamily: () => 'renommer toute la famille selon ses contrastes', replace: a => 'remplacer par ' + a.hex,
      toNeutral: (a, L) => 'la déplacer dans « ' + L(a.neutral) + ' »', dropRole: a => 'retirer « ' + a.role + ' »', dropRamp: (a, L) => 'retirer « ' + L(a.ramp) + ' »',
      moveAway: (a, L) => 'écarter la teinte de « ' + L(a.ramp) + ' »',
      systemOption: (a, L) => ({ darken: 'assombrir', shift: 'tirer la teinte', proven: 'valeur éprouvée' })[a.key] + ' : ' + a.hex + (a.nearest ? ' (ΔE ' + String(a.nearest.dE).replace('.', ',') + ' de « ' + L(a.nearest.name) + ' »' : ' (') + ', blanc dessus ' + String(a.white).replace('.', ',') + ':1)', regen: () => 'régénérer : le seuil tombe au même cran partout', accept: (a, L, f) => (f.type === 'pair' ? 'garder les deux' : f.type === 'hue' ? 'garder, c\'est voulu' : 'garder et documenter l\'exception'),
    },
    note: (f, L) => (f.type === 'misnamed' ? `Exception documentée : « ${L(f.ramp)} ${f.role} » garde ${f.hex}, qui a le contraste d'un ${f.natural}.`
      : f.type === 'far' ? `Exception documentée : « ${L(f.ramp)} ${f.role} » (${f.hex}) reste hors de sa rampe générée.`
      : f.type === 'hue' ? `Exception documentée : la teinte de « ${L(f.ramp)} » tourne volontairement.`
      : `Exception documentée : « ${L(f.a)} » et « ${L(f.b)} » restent deux nuanciers distincts.`),
  },
  en: {
    num: (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US'),
    ratio: x => fmtRatio(x) + ':1',
    misnamed: ['Misnamed step', (r, f) => `“${r} ${f.role}” has the contrast of a ${f.natural}.`,
      (r, f, w) => `Its contrast puts it ${plural(Math.abs(f.gap), 'step', 'steps')} ${f.gap < 0 ? 'lighter' : 'darker'} than its name.`
        + (Number(f.role) >= 500 && f.white < 4.5 ? ` White text on it holds ${w.ratio(f.white)}, below the AA threshold of 4.5:1.` : '')],
    far: ['Colour outside its family', (r, f) => `“${r} ${f.role}” (${f.hex}) has no equivalent in its ramp.`,
      (r, f, w) => `Once the family is regenerated, the closest step is ${f.closest}, at ΔE ${w.num(f.deltaE, 0)}: another colour. It probably does not belong in this ramp.`],
    cross: ['Steps not interchangeable', (r, f, w) => `At ${f.step}, the ${w.num(f.threshold)}:1 threshold on white depends on the family.`,
      (r, f) => `${plural(f.pass, 'family passes', 'families pass')}, ${f.fail} fail (weakest: ${f.worst}). A rule written once for every hue is wrong today.`],
    gap: ['Uneven spacing', (r, f) => `In “${r}”, the gaps between colours vary by a factor of ${f.factor >= 4 ? 'four' : 'three'}.`,
      (r, f, w) => `From ${f.min.from} to ${f.min.to}: ΔE ${w.num(f.min.de)}. From ${f.max.from} to ${f.max.to}: ΔE ${w.num(f.max.de)}. Steps are missing where the gap is large, or two colours overlap where it is small.`],
    crowd: ['Rank collision', r => `In “${r}”, two colours earn the same step.`, () => 'One had to slide by a step to keep the lightness order. One of the two is probably redundant.'],
    hue: ['Drifting hue', (r, f, w) => `In “${r}”, the hue turns by ${w.num(f.range, 0)}° from end to end.`, () => 'Beyond about fifteen degrees, light and dark no longer look like the same family.'],
    pair: [f => (f.dup ? 'Duplicate families' : 'Neighbouring families'), (r, f, w, L) => (f.dup ? `“${L(f.a)}” and “${L(f.b)}” become the same colour once regenerated.` : `“${L(f.a)}” and “${L(f.b)}” are very close.`),
      (r, f, w) => `${w.num(f.hueGap)}° apart in hue, mean ΔE ${w.num(f.deltaE)} once regenerated. `
        + (f.stepDE ? `Step by step: mean ΔE ${w.num(f.stepDE.mean)}, at most ${w.num(f.stepDE.max)}; ${f.stepDE.under25} step(s) of ${f.stepDE.n} under 2.5, unusable in an interface. ` : '')
        + (f.nature === 'identity-system' ? 'A status colour and an identity colour: to arbitrate, never to merge — the system colour moves away.'
          : f.dup ? 'One ramp is enough; the other name becomes a semantic alias.' : 'Keep both only if the difference means something to users.')],
    actions: {
      rename: a => 'rename to ' + a.to, renameFamily: () => 'rename the whole family by contrast', replace: a => 'replace with ' + a.hex,
      toNeutral: (a, L) => 'move it to “' + L(a.neutral) + '”', dropRole: a => 'remove “' + a.role + '”', dropRamp: (a, L) => 'remove “' + L(a.ramp) + '”',
      moveAway: (a, L) => 'move “' + L(a.ramp) + '” away in hue',
      systemOption: (a, L) => ({ darken: 'darken', shift: 'pull the hue', proven: 'proven value' })[a.key] + ': ' + a.hex + (a.nearest ? ' (ΔE ' + a.nearest.dE + ' from “' + L(a.nearest.name) + '”' : ' (') + ', white on it ' + a.white + ':1)', regen: () => 'regenerate: the threshold falls on the same step everywhere', accept: (a, L, f) => (f.type === 'pair' ? 'keep both' : f.type === 'hue' ? 'keep it, it is intended' : 'keep and document the exception'),
    },
    note: (f, L) => (f.type === 'misnamed' ? `Documented exception: “${L(f.ramp)} ${f.role}” keeps ${f.hex}, which has the contrast of a ${f.natural}.`
      : f.type === 'far' ? `Documented exception: “${L(f.ramp)} ${f.role}” (${f.hex}) stays outside its generated ramp.`
      : f.type === 'hue' ? `Documented exception: the hue of “${L(f.ramp)}” turns on purpose.`
      : `Documented exception: “${L(f.a)}” and “${L(f.b)}” stay two separate ramps.`),
  },
};

/** Un constat en mots : son genre, son titre, son explication, le libellé de chaque action. */
export function describe(f, data, lang = 'fr') {
  const w = W[lang] || W.fr;
  const L = n => (data.ramps.find(r => r.name === n) || {}).label || n;
  const [kind, title, text] = w[f.type];
  return {
    kind: typeof kind === 'function' ? kind(f) : kind,
    title: title(L(f.ramp), f, w, L),
    text: text(L(f.ramp), f, w, L),
    actions: f.actions.map(a => w.actions[a.type](a, L, f)),
    note: w.note(f, L),
  };
}

/**
 * Le regroupement proposé d'un coup, à relire puis à appliquer ensemble : les familles en
 * doublon fusionnées (l'ancien nom devient un alias sémantique), les couleurs hors famille
 * déplacées dans le neutre. Jamais une couleur système avec une couleur d'identité : celles-là
 * s'arbitrent, une par une. Les exceptions déjà acceptées ne reviennent pas.
 */
export function proposeGrouping(data, ramps, { accepted = [], lang = 'fr' } = {}) {
  const fs = diagnose(data, ramps, { accepted });
  let cur = ramps;
  const steps = [];
  for (const f of fs) {
    const has = n => cur.some(r => r.name === n);
    if (f.type === 'pair' && f.dup && f.nature !== 'identity-system') {
      const act = f.actions.find(a => a.type === 'dropRamp');
      if (act && has(act.ramp) && has(f.a)) { cur = applyAction(cur, f, act, data).ramps; steps.push({ kind: 'merge', from: f.b, into: f.a, deltaE: f.deltaE }); }
    } else if (f.type === 'far' && has(f.ramp)) {
      // une couleur quasi grise rejoint le neutre ; une couleur vive devient sa propre famille,
      // nommée par sa teinte — la mettre dans le gris serait une autre erreur
      const { C, H } = hexToOklch(f.hex);
      const act = f.actions.find(a => a.type === 'toNeutral');
      if (C < 0.04 && act) { cur = applyAction(cur, f, act, data).ramps; steps.push({ kind: 'move', ramp: f.ramp, role: f.role, hex: f.hex, to: act.neutral, deltaE: f.deltaE }); }
      else if (C >= 0.04) {
        let name = hueName(H), k = 2; while (cur.some(r => r.name === name)) name = hueName(H) + '-' + k++;
        cur = cur.map(r => (r.name === f.ramp ? { ...r, anchors: Object.fromEntries(Object.entries(r.anchors).filter(([role]) => role !== f.role)) } : r))
          .concat([{ name, label: name, kind: 'product', anchors: { default: f.hex } }]);
        steps.push({ kind: 'split', ramp: f.ramp, role: f.role, hex: f.hex, to: name, deltaE: f.deltaE });
      }
    }
  }
  const L = n => (data.ramps.find(r => r.name === n) || {}).label || n;
  const en = lang === 'en';
  const notes = steps.map(s => (s.kind === 'merge'
    ? (en ? `“${L(s.from)}” merged into “${L(s.into)}” (mean ΔE ${s.deltaE}): the old name becomes a semantic alias.` : `« ${L(s.from)} » fusionnée dans « ${L(s.into)} » (ΔE moyen ${s.deltaE}) : l'ancien nom devient un alias sémantique.`)
    : s.kind === 'split'
      ? (en ? `“${L(s.ramp)} ${s.role}” (${s.hex}) becomes its own family, “${s.to}”: another colour, not a step of this ramp.` : `« ${L(s.ramp)} ${s.role} » (${s.hex}) devient sa propre famille, « ${s.to} » : une autre couleur, pas un cran de cette rampe.`)
      : (en ? `“${L(s.ramp)} ${s.role}” (${s.hex}) moved to “${L(s.to)}”: no equivalent in its ramp.` : `« ${L(s.ramp)} ${s.role} » (${s.hex}) déplacée dans « ${L(s.to)} » : sans équivalent dans sa rampe.`)));
  return { ramps: cur, steps, notes };
}
