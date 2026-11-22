// Ce qu'il manque à un système, et la couleur à proposer : un neutre teinté de la marque, et
// les quatre rôles système placés hors de la teinte des couleurs déjà présentes. Partagé par
// le studio (étapes Entrer et Comprendre) et la ligne de commande (`hueladder suggest`).

import { hexToOklch, oklchToHex } from './color.mjs';
import { slug } from './import.mjs';

// Chaque rôle a une plage de teinte OKLCH où il reste reconnaissable (un rouge d'erreur reste
// rouge) ; dans cette plage, on prend la teinte la plus proche de la référence qui reste à 30°
// des couleurs déjà présentes, et à défaut la plus éloignée possible.
export const SYSTEM_ROLES = [
  ['error', '#d92d20', /error|danger|critical|negative/, [18, 36]],
  ['success', '#079455', /success|positive|valid/, [135, 165]],
  ['warning', '#dc6803', /warning|caution|attention/, [50, 78]],
  ['info', '#1570ef', /info|notice/, [205, 262]],
];
export const SYSTEM_LABELS = {
  fr: { error: 'Erreur', success: 'Succès', warning: 'Alerte', info: 'Info' },
  en: { error: 'Error', success: 'Success', warning: 'Warning', info: 'Info' },
};
const ENOUGH = 30;
const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

export const roleOf = r => SYSTEM_ROLES.find(([, , re]) => re.test(r.name) || re.test(slug(r.label)));
export const missingSystem = ramps => SYSTEM_ROLES.filter(([, , re]) => !ramps.some(r => re.test(r.name) || re.test(slug(r.label))));

/** La couleur proposée pour un rôle système, compte tenu des nuanciers déjà présents. */
export function systemSeed([, hex, , [lo, hi]], ramps) {
  const taken = ramps.map(r => hexToOklch(r.seed || Object.values(r.anchors)[0])).filter(c => c.C > 0.04).map(c => c.H);
  const { L, C, H } = hexToOklch(hex);
  if (!taken.length) return { hex, gap: null };
  let best = null, bestGap = -1, far = H, farGap = -1;
  for (let h = lo; h <= hi; h += 1) {
    const g = Math.min(...taken.map(x => hueGap(h, x)));
    if (g >= ENOUGH && (best === null || hueGap(h, H) < hueGap(best, H))) { best = h; bestGap = g; }
    if (g > farGap) { far = h; farGap = g; }
  }
  return best === null ? { hex: oklchToHex(L, C, far), gap: farGap } : { hex: oklchToHex(L, C, best), gap: bestGap };
}

const unique = (ramps, base) => { let n = base, i = 2; while (ramps.some(r => r.name === n)) n = base + '-' + i++; return n; };

/** Les nuanciers système manquants, prêts à ajouter à la spec. */
export function suggestSystem(ramps, lang = 'fr') {
  const out = [];
  for (const role of missingSystem(ramps)) {
    const seed = systemSeed(role, [...ramps, ...out]).hex;
    out.push({ name: unique([...ramps, ...out], role[0]), label: SYSTEM_LABELS[lang][role[0]], kind: 'system', anchors: { default: seed } });
  }
  return out;
}

/** Un neutre qui prend la teinte de la marque, à peine : assez pour ne pas être un gris d'usine. */
export function suggestNeutral(ramps, lang = 'fr') {
  if (ramps.some(r => r.kind === 'neutral')) return null;
  const brand = ramps.find(r => r.kind === 'brand') || ramps[0];
  const a = brand ? brand.anchors : {};
  const H = brand ? hexToOklch(a.default || a['500'] || brand.seed || Object.values(a)[0]).H : hexToOklch('#2f5bd3').H;
  return { name: unique(ramps, 'neutral'), label: lang === 'en' ? 'Neutral' : 'Neutre', kind: 'neutral', anchors: { default: oklchToHex(0.55, 0.012, H) } };
}

/** Écarte la teinte d'une couleur système trop proche d'une autre famille. */
export function moveSystemAway(ramps, name) {
  const r = ramps.find(x => x.name === name);
  const role = r && roleOf(r);
  if (!role) return ramps;
  const others = ramps.filter(x => x !== r);
  const next = systemSeed([role[0], r.seed || Object.values(r.anchors)[0], role[2], role[3]], others).hex;
  return ramps.map(x => (x === r ? { ...x, anchors: { default: next }, seed: undefined } : x));
}

// des valeurs éprouvées, largement utilisées pour ces rôles (Tailwind, licence MIT) : un repère,
// pas une obligation
const PROVEN = { error: '#b91c1c', success: '#15803d', warning: '#b45309', info: '#1d4ed8' };

/**
 * Trois options pour une couleur système trop proche d'une couleur d'identité : la marque est
 * intouchable, c'est la couleur système qui s'écarte, sans jamais cesser d'être lisible comme
 * son rôle (un rouge d'erreur reste rouge).
 * - **assombrir** : même teinte, deux crans plus sombre ;
 * - **tirer la teinte** : vers la plage de son rôle la plus éloignée des teintes déjà prises ;
 * - **valeur éprouvée** : un repère largement utilisé pour ce rôle.
 * Chacune avec son écart à la couleur la plus proche et le contraste d'un texte blanc dessus.
 */
export function systemOptions(ramps, name, { deltaE, contrast }) {
  const r = ramps.find(x => x.name === name), role = r && roleOf(r);
  if (!role) return [];
  const seed = r.seed || r.anchors.default || Object.values(r.anchors)[0];
  const { L, C, H } = hexToOklch(seed);
  const others = ramps.filter(x => x !== r);
  const opts = [
    ['darken', oklchToHex(Math.max(0.2, L - 0.12), C, H)],
    ['shift', systemSeed([role[0], seed, role[2], role[3]], others).hex],
    ['proven', PROVEN[role[0]]],
  ];
  return opts.map(([key, hex]) => {
    const near = others.map(o => ({ name: o.name, dE: deltaE(hex, o.seed || o.anchors.default || Object.values(o.anchors)[0]) })).sort((a, b) => a.dE - b.dE)[0];
    return { key, hex, nearest: near ? { name: near.name, dE: Math.round(near.dE * 10) / 10 } : null, white: Math.round(contrast('#ffffff', hex) * 100) / 100 };
  }).filter((o, i, a) => a.findIndex(x => x.hex === o.hex) === i);
}
