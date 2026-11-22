// Les méthodes de dérivation du mode sombre.
//
// Comme pour le clair, il en existe plusieurs, documentées et comparables. Toutes partent de
// la rampe claire déjà générée et rendent, cran par cran, la couleur sombre et ce qu'elle a
// coûté. Les sources et les mesures qui les fondent sont dans references/mode-sombre/recherche.md.

import { relativeLuminance, contrast, hexToOklch, srgbToLinear } from './color.mjs';
import { deriveDarkScale, darkLadderFromLight, luminanceLadder, contrastBudget, luminanceToContrasts, maxChromaAtLuminance, solveAtLuminance } from './tune.mjs';
import { APCAcontrast, sRGBtoY, apcaLc } from './apca.mjs';
import { hctFromHex, hctToHex } from './cam16.mjs';

/**
 * - `mirror-wcag` (défaut) : chaque cran garde, face au fond sombre, le ratio WCAG qu'il a en
 *   clair face au blanc. Seule méthode qui transporte exactement la règle écrite dans le nom
 *   (N rangs ⇒ AA), parce que le ratio entre deux crans reste le même. Logique de Leonardo.
 * - `mirror-apca` : chaque cran de texte garde son |Lc| APCA face au fond, sans jamais tomber
 *   sous le miroir WCAG **face au fond**. Plus fort en sombre, parce qu'APCA juge le texte clair
 *   sur fond sombre moins lisible à ratio égal. Démarche de Radix. Prix connu : en éclaircissant
 *   les crans de texte, elle les resserre entre eux, et la règle du nom (contraste **entre**
 *   crans) ne tient plus. C'est le compromis WCAG 2 / APCA, montré tel quel dans le studio.
 * - `mirror-bridge` : le compromis résolu autant qu'il peut l'être. Chaque cran vise la cible
 *   APCA, mais reste plafonné par ceux qui le dominent (la règle du nom, avec 1 % de marge pour
 *   l'arrondi hex) et garde au moins les deux tiers de l'écart du miroir avec son voisin ; il
 *   ne descend jamais sous le miroir WCAG. La règle tient donc par récurrence, et le texte gagne
 *   7 à 17 Lc au milieu de l'échelle. Prix : les crans du haut se resserrent (×1,20 au lieu de
 *   ×1,32 entre voisins sur #121212). Recherche et mesures : references/mode-sombre/perceptif.md.
 * - `budget-share` : chaque cran garde la même part (logarithmique) du contraste disponible
 *   face au fond. Démarche de Spectrum ; affaiblit la règle sur un fond non noir.
 * - `tone-flip` : ton HCT inversé (T → 100 − T), même teinte et même chroma. Démarche de
 *   Material 3, qui ignore le fond réel.
 * - `index-flip` : le cran i reprend la couleur claire du cran symétrique (50 ↔ 950). Témoin
 *   de la pratique Tailwind et Atlassian : aucune garantie de contraste face au fond.
 */
export const DARK_METHODS = ['mirror-wcag', 'mirror-bridge', 'mirror-apca', 'budget-share', 'tone-flip', 'index-flip'];

const LOG21 = Math.log(21);
// Sous Lc 30, APCA ne juge plus un texte (le seuil de ses tables pour le texte non essentiel) :
// ces crans sont des fonds, et on les laisse au miroir WCAG.
const APCA_FLOOR = 30;

/** La luminance (WCAG) du gris clair dont le |Lc| face au fond vaut `target`. */
function yForApca(target, background) {
  const bgY = sRGBtoY(hexRgb(background));
  let lo = 0, hi = 255;
  for (let k = 0; k < 40; k++) {
    const v = (lo + hi) / 2;
    const lc = Math.abs(APCAcontrast(sRGBtoY([v, v, v]), bgY));
    if (lc < target) lo = v; else hi = v;
  }
  return srgbToLinear(hi / 255);
}
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// mirror-bridge : marge d'arrondi sur la règle, part de l'écart du miroir gardée entre voisins
const BRIDGE_MARGIN = 1.01, BRIDGE_STEP = 0.66;

/**
 * Le barreau `mirror-bridge`, du cran le plus clair (en sombre) au plus sombre. `rule.ranks`
 * donne le rang de chaque cran (null hors règle), `rule.ui/aa/aaa` les écarts de rangs.
 */
function bridgeLadder(mirror, target, rule) {
  const X = y => Math.log(Math.min(1, y) + 0.05), xmax = Math.log(1.05) - 1e-3;
  const need = g => (rule.aaa && g >= rule.aaa ? 7 : g >= rule.aa ? 4.5 : g >= rule.ui ? 3 : 0);
  const rk = rule.ranks || [], x = mirror.map(() => null);
  let above = null;
  for (let i = mirror.length - 1; i >= 0; i--) {
    if (mirror[i] == null) continue;
    const xm = X(mirror[i]);
    let v = Math.min(target[i] == null ? xm : X(target[i]), xmax);
    for (let j = i + 1; j < mirror.length; j++) {
      if (x[j] == null || rk[i] == null || rk[j] == null) continue;
      const r = need(Math.abs(rk[j] - rk[i]));
      if (r) v = Math.min(v, x[j] - Math.log(r * BRIDGE_MARGIN));
    }
    if (above !== null) v = Math.min(v, x[above] - BRIDGE_STEP * (X(mirror[above]) - xm));
    x[i] = Math.min(Math.max(v, xm), xmax); // jamais sous le miroir, jamais au-delà du blanc
    above = i;
  }
  return x.map(v => (v == null ? null : Math.exp(v) - 0.05));
}

/** Le barreau sombre (un Y par cran) des méthodes qui raisonnent en contraste face au fond. */
export function darkLadder(method, lightScale, background, rule) {
  const mirror = darkLadderFromLight(luminanceLadder(lightScale), background);
  if (method === 'mirror-wcag') return mirror;
  const k = relativeLuminance(background) + 0.05;
  if (method === 'budget-share') {
    const budget = contrastBudget(background);
    return lightScale.map(hex => {
      if (!hex) return null;
      const c = contrast(hex, '#ffffff');
      return Math.exp((Math.log(c) * Math.log(budget)) / LOG21) * k - 0.05;
    });
  }
  if (method === 'mirror-apca' || method === 'mirror-bridge') {
    const apca = lightScale.map((hex, i) => {
      if (!hex) return null;
      const lc = Math.abs(apcaLc(hex, '#ffffff'));
      if (lc < APCA_FLOOR) return mirror[i];
      // jamais plus faible que le miroir WCAG face au fond (entre deux crans, rien n'est garanti)
      return Math.min(1, Math.max(mirror[i], yForApca(lc, background)));
    });
    if (method === 'mirror-apca') return apca;
    if (!rule) throw new Error('mirror-bridge : la règle du nom (rule) est nécessaire');
    return bridgeLadder(mirror, apca, rule);
  }
  return null;
}

/**
 * Le haut d'un barreau sombre, redistribué. Sur un fond non noir, le budget de contraste est
 * plus court que 21:1 : les crans les plus clairs visent au-delà et s'entassent contre le blanc
 * (et deviennent indistinguables), ou sortent en blanc pur. Avec un plafond anti-halo (un
 * texte blanc pur sur fond sombre « bave »), c'est pareil, plus bas.
 *
 * En deux morceaux : jusqu'à `split` (7:1, le dernier seuil de texte), l'égalité de contraste
 * avec le clair reste exacte — toutes les règles écrites en clair tiennent ; au-delà, les crans
 * se répartissent en progression logarithmique jusqu'au plafond (le budget, ou `cap`), dans le
 * même ordre. Ne fait rien si le haut tient déjà sous le plafond.
 */
export function spreadTop(ladder, background, { split = 7, cap = null } = {}) {
  const k = relativeLuminance(background) + 0.05;
  const top = Math.min((1.05 / k) * 0.985, cap || Infinity);
  const c = ladder.map(y => (y === null || y === undefined ? null : (y + 0.05) / k));
  const max = Math.max(...c.filter(x => x !== null));
  if (!(max > top) || top <= split) return ladder;
  return ladder.map((y, i) => {
    if (c[i] === null || c[i] <= split) return y;
    const t = (Math.log(c[i]) - Math.log(split)) / (Math.log(max) - Math.log(split));
    return split * Math.pow(top / split, t) * k - 0.05;
  });
}

/**
 * La rampe sombre d'une rampe claire, selon `method`. `desaturate` est une part de chroma
 * retirée ; `scope: 'surfaces'` ne l'applique qu'aux crans qui servent de fond (contraste
 * face au fond sous 3:1), là où Atlassian désature, en laissant accents et textes intacts.
 */
export function deriveDark(lightScale, {
  method = 'mirror-wcag', background, vividness = 0, gamutCeiling = 0.96, desaturate = 0, scope = 'surfaces', rule = null, top = null,
} = {}) {
  if (!DARK_METHODS.includes(method)) throw new Error(`darkMode.method "${method}" inconnue — attendu : ${DARK_METHODS.join(', ')}`);
  const perStep = lightScale.map(hex => {
    if (!hex || !desaturate) return 0;
    return scope === 'all' || luminanceToContrasts(relativeLuminance(hex)).vsWhite < 3 ? desaturate : 0;
  });
  const raw = darkLadder(method, lightScale, background, rule);
  const ladder = raw && top ? spreadTop(raw, background, top) : raw;
  if (ladder) return deriveDarkScale(lightScale, ladder, { vividness, gamutCeiling, desaturate: perStep });

  // méthodes qui produisent directement une couleur, sans passer par le fond
  const present = lightScale.map((h, i) => (h ? i : -1)).filter(i => i >= 0);
  return lightScale.map((lightHex, i) => {
    if (!lightHex) return null;
    let hex;
    if (method === 'index-flip') hex = lightScale[present[present.length - 1 - present.indexOf(i)]];
    else {
      const { h, c, t } = hctFromHex(lightHex);
      hex = hctToHex(h, c, 100 - t);
    }
    const light = hexToOklch(lightHex);
    let got = hexToOklch(hex);
    const y = relativeLuminance(hex);
    const ceiling = maxChromaAtLuminance(Math.min(1, y), got.H) * gamutCeiling;
    // les réglages d'éclat valent pour toutes les méthodes : atténuation des surfaces, profil vif
    const frac = Array.isArray(vividness) ? (vividness[i] ?? 0) : (vividness ?? 0);
    if (perStep[i] || frac) {
      const kept = Math.min(got.C * (1 - perStep[i]), ceiling);
      const wanted = kept + (ceiling - kept) * Math.max(0, Math.min(1, frac));
      hex = solveAtLuminance(y, wanted, got.H).hex;
      got = hexToOklch(hex);
    }
    return {
      hex, y, chroma: got.C, targetY: y, yDeviation: 0, outOfBudget: false,
      maxChroma: Math.round(ceiling * 10000) / 10000, clamped: false,
      chromaGain: light.C > 1e-4 ? Math.round((got.C / light.C) * 1000) / 1000 : null,
      lightHex, lightChroma: Math.round(light.C * 10000) / 10000,
    };
  });
}
