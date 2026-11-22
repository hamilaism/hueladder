// Comparer avant de choisir : ce que chaque méthode de génération donnera au contrat, et ce
// que chaque option du mode sombre donnera sous WCAG 2 et sous APCA. Partagé par le studio
// (étapes Générer et Mode sombre) et la ligne de commande (`hueladder compare`).

import { contrast, relativeLuminance } from './color.mjs';
import { deltaE2000Hex } from './deltae.mjs';
import { apcaLc } from './apca.mjs';
import { deriveDark, DARK_METHODS } from './dark.mjs';
import { contrastBudget, profileOnLadder, BELL_CHROMA } from './tune.mjs';
import { contractChecks } from './contract.mjs';

const scaleOf = (data, ramp, m) => {
  const r = data.ramps.find(x => x.name === ramp);
  return Object.fromEntries(data.meta.steps.map((s, i) => [s, r.colors[m] ? r.colors[m][i] : null]));
};

/**
 * L'écart d'une méthode aux couleurs d'origine, mesuré partout de la même façon : ΔE2000 entre
 * chaque couleur fournie et la couleur générée au cran où elle est posée — celle que le régleur
 * met en face d'elle. Moyenne sur les couleurs d'une palette importée, valeur unique sinon.
 */
export function originGap(data, m = data.meta.coreMethod) {
  const gaps = data.anchorMap.filter(a => a.primary !== false && a.placedStep).map(a => {
    const h = scaleOf(data, a.ramp, m)[a.placedStep];
    return h ? deltaE2000Hex(a.hex, h) : null;
  }).filter(x => x !== null);
  return gaps.length ? gaps.reduce((x, y) => x + y, 0) / gaps.length : 0;
}

/**
 * Chaque méthode de génération, avec ce qu'elle donnera à la vérification (contrat du mode
 * clair : le sombre dépend d'un choix suivant). Ordre : Fusilier d'abord (le défaut de Hueladder, une
 * préférence pour des intervalles réguliers), puis celles qui tiennent le contrat, de la plus
 * fidèle à la moins fidèle, puis les autres.
 */
export function compareMethods(data, { lang = 'en' } = {}) {
  const rows = data.methodOrder.filter(m => !['existing', 'tuned'].includes(m) && data.metrics[m]).map(m => {
    const fails = contractChecks({ ...data, meta: { ...data.meta, coreMethod: m } }, '', { lang }).filter(c => !c.pass && c.area !== 'dark');
    return { method: m, label: data.methods[m].label, holds: fails.length === 0, fails,
      deltaE: originGap(data, m), crossings: data.metrics[m].interchangeability?.light?.crossingPairs ?? 0 };
  });
  return rows.sort((a, b) => (b.method === 'fusilier') - (a.method === 'fusilier') || b.holds - a.holds
    || (a.holds ? a.deltaE - b.deltaE : a.crossings - b.crossings || a.deltaE - b.deltaE));
}

/**
 * Le sombre d'une configuration (fond, méthode, éclat), calculé sans rebâtir le système :
 * c'est ce qui permet de montrer chaque option avant qu'on la choisisse. Même code que le
 * moteur (lib/dark.mjs).
 */
export function darkScales(data, cfg) {
  const core = data.meta.coreMethod;
  const bell = cfg.profile === 'bell' ? profileOnLadder(data.ladders.shade, data.meta.coreSteps.length, BELL_CHROMA) : 0;
  const R = data.rules, rule = { ranks: data.meta.rankOf, ui: R.rankForUI, aa: R.rankForAA, aaa: R.rankForAAA };
  const out = {};
  for (const r of data.ramps) {
    const light = r.colors[core];
    const d = deriveDark(light, { method: cfg.method, background: cfg.bg, vividness: r.kind === 'neutral' ? 0 : bell, desaturate: cfg.attenuate || 0, scope: 'surfaces', rule, top: cfg.top ?? data.meta.dark?.top ?? null });
    out[r.name] = light.map((h, i) => {
      if (!h) return null;
      if (data.ladders.shade[i] >= 199.99) return cfg.bg;
      if (data.ladders.shade[i] <= 0.01) return '#ffffff';
      return d[i] ? d[i].hex : null;
    });
  }
  return out;
}

/**
 * Ce qu'une configuration sombre donnera au contrat, sous les deux normes. WCAG 2 : la règle
 * du nom dans chaque nuancier, le seuil AA au même cran qu'en clair, l'ordre des crans, la
 * même réponse à cran égal d'un nuancier à l'autre, le budget du fond. APCA : chaque cran de
 * texte garde-t-il en sombre la lisibilité (Lc) qu'il a en clair ?
 */
export function darkVerdict(data, scales, bg) {
  const core = data.meta.coreMethod, R = data.rules, steps = data.meta.steps;
  const ci = steps.map((_, i) => i).filter(i => data.meta.isCore[i]);
  let rule = 0, thresh = 0, mono = 0, cross = 0, worst = 0, below = 0;
  for (const r of data.ramps) {
    const L = r.colors[core], D = scales[r.name];
    ci.forEach((i, a) => ci.forEach((j, b) => {
      if (b <= a || !D[i] || !D[j]) return;
      const rk = data.meta.rankOf;
      const c = contrast(D[i], D[j]), g = rk && rk[i] != null && rk[j] != null ? Math.abs(rk[j] - rk[i]) : b - a;
      if ((g >= R.rankForAA && c < 4.5) || (g >= R.rankForUI && c < 3) || (R.rankForAAA && g >= R.rankForAAA && c < 7)) rule++;
    }));
    const firstL = ci.find(i => L[i] && contrast(L[i], '#ffffff') >= 4.5), firstD = ci.find(i => D[i] && contrast(D[i], bg) >= 4.5);
    if (firstL !== firstD) thresh++;
    const ys = ci.map(i => (D[i] ? relativeLuminance(D[i]) : null)).filter(y => y !== null);
    for (let k = 1; k < ys.length; k++) if (ys[k] <= ys[k - 1]) mono++;
    for (const i of ci) {
      if (!L[i] || !D[i]) continue;
      const ll = Math.abs(apcaLc(L[i], '#ffffff'));
      if (ll < 30) continue;
      const dd = Math.abs(apcaLc(D[i], bg)) - ll;
      if (dd < -5) below++;
      worst = Math.min(worst, dd);
    }
  }
  for (const i of ci) {
    for (const th of [3, 4.5, 7]) {
      const ans = data.ramps.map(r => scales[r.name][i]).filter(Boolean).map(h => contrast(h, bg) >= th);
      if (ans.some(Boolean) && ans.some(x => !x)) cross++;
    }
  }
  const oob = (data.meta.dark?.outOfBudget || []).length && bg === data.meta.dark.background ? data.meta.dark.outOfBudget.length
    : ci.filter(i => data.ramps.some(r => r.colors[core][i] && contrast(r.colors[core][i], '#ffffff') > contrastBudget(bg) + 0.01)).length;
  const wcag = { rule, thresh, mono, cross, oob };
  return { wcag, wcagCount: rule + thresh + mono + cross + oob, apca: { worst: Math.round(worst), below } };
}

/** Chaque méthode sombre sur un fond donné, jugée sous les deux normes. */
export function compareDark(data, { background = data.meta.dark?.background || '#121212', profile = 'aligned', attenuate = 0 } = {}) {
  return DARK_METHODS.map(method => {
    const v = darkVerdict(data, darkScales(data, { method, bg: background, profile, attenuate }), background);
    return { method, ...v };
  });
}
