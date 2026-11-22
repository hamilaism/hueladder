// Édition à luminance verrouillée.
//
// Le contraste d'une couleur face au blanc et face au noir ne dépend que de sa luminance
// relative Y — et les deux sont liés : C_blanc × C_noir = 21, toujours. Verrouiller « le
// contraste » revient donc à verrouiller un seul nombre, Y, et il reste deux degrés de
// liberté entièrement libres : la teinte et la chroma.
//
// C'est tout le principe de ce module : on choisit H et C, on résout L.

import {
  hexToOklch, oklchToHex, clipChromaOk, relativeLuminance,
  bisectLightness, lerp, hueDelta,
} from './color.mjs';

/** Y ↔ contrastes. Une seule grandeur, deux lectures. */
export const luminanceToContrasts = Y => ({
  vsBlack: (Y + 0.05) / 0.05,
  vsWhite: 1.05 / (Y + 0.05),
});

/** Y visé par un contraste donné face au noir (l'inverse de la relation ci-dessus). */
export const luminanceForContrastVsBlack = c => c * 0.05 - 0.05;

/**
 * Y visé par un contraste donné face à un fond quelconque.
 *
 * Le 0,05 de la formule WCAG n'est pas une constante du fond, c'est le terme de voile
 * (flare) ajouté aux deux luminances. Le fond n'entre donc dans le calcul que par son
 * propre Y + 0,05 — d'où la généralisation directe de la fonction ci-dessus, dont le noir
 * pur (Y = 0) n'est que le cas particulier.
 */
export const luminanceForContrastVsBackground = (c, bgHex) =>
  c * (relativeLuminance(bgHex) + 0.05) - 0.05;

/**
 * Contraste maximal qu'un fond peut porter : celui du blanc pur posé dessus.
 *
 * Face au noir pur il vaut 21, et c'est de là que vient tout le vocabulaire des shades.
 * Face à un fond sombre mais non noir il est strictement plus petit — 19,41 sur `#0e0d0d`
 * — et c'est une limite dure : aucune couleur sRGB ne dépassera ce chiffre sur ce fond.
 * C'est ce qui rend le haut d'une rampe sombre structurellement plus resserré que le bas
 * d'une rampe claire, et c'est à vérifier **avant** de poser un barreau de cibles.
 */
export const contrastBudget = bgHex => 1.05 / (relativeLuminance(bgHex) + 0.05);

/**
 * Le barreau de luminance du mode sombre, déduit de celui du mode clair par **égalité de
 * contraste**.
 *
 * C'est la seule dérivation qui garantit qu'un échelon porte le même sens dans les deux
 * modes : si `500` vaut 4,59 sur le blanc en clair, il doit valoir 4,59 sur le fond sombre
 * en sombre — le seuil AA tombe alors au même cran des deux côtés, et une règle de design
 * system écrite une fois reste vraie une fois le thème inversé.
 *
 *     Y_sombre = C_clair × (Y_fond + 0,05) − 0,05,  avec C_clair = 1,05 / (Y_clair + 0,05)
 *
 * Le barreau reste **aligné sur les index** : l'entrée i du barreau clair donne l'entrée i
 * du barreau sombre. C'est bien une rampe inversée en clarté, mais ce n'est pas un miroir
 * d'index — inverser l'ordre des crans donnerait des contrastes faux, l'amplitude des deux
 * modes n'étant pas la même.
 *
 * Un Y sombre supérieur à 1 n'est pas une erreur de calcul : il dit que le fond est trop
 * clair pour porter le contraste demandé (voir `contrastBudget`). La valeur est renvoyée
 * telle quelle, à charge de l'appelant de la voir plutôt que de la découvrir en blanc.
 */
export function darkLadderFromLight(ladder, background = '#000000') {
  return ladder.map(Y => (Y === null || Y === undefined ? null
    // le contraste que ce cran tient en clair, transposé tel quel sur le fond sombre
    : luminanceForContrastVsBackground(luminanceToContrasts(Y).vsWhite, background)));
}

/**
 * La couleur de teinte H et de chroma C dont la luminance vaut exactement `targetY`.
 *
 * La chroma demandée peut sortir du gamut sRGB ; elle est alors réduite, ce qui modifie
 * la luminance — d'où une résolution sur la couleur *après* réduction, et non avant.
 * `relativeLuminance(oklchToHex(...))` croît avec L, la dichotomie est donc valide.
 */
export function solveAtLuminance(targetY, C, H, { iters = 60 } = {}) {
  // Y(L) est une fonction croissante *en escalier* : l'arrondi hex la fait progresser par
  // paliers. Une dichotomie classique converge vers la marche mais peut s'arrêter du
  // mauvais côté. On encadre donc la marche, puis on retient celui des deux hex voisins
  // qui est réellement le plus proche de la cible — la meilleure couleur sRGB possible.
  let lo = 0, hi = 1;
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (relativeLuminance(oklchToHex(mid, C, H)) < targetY) lo = mid; else hi = mid;
  }
  let L = lo, hex = oklchToHex(lo, C, H), bestErr = Math.abs(relativeLuminance(hex) - targetY);
  for (const l of [hi, (lo + hi) / 2]) {
    const cand = oklchToHex(l, C, H);
    const err = Math.abs(relativeLuminance(cand) - targetY);
    if (err < bestErr) { bestErr = err; hex = cand; L = l; }
  }
  const got = hexToOklch(hex);
  // La réduction de gamut se lit sur la géométrie, pas sur la couleur arrondie en hex :
  // l'arrondi décale la chroma mesurée de quelques millièmes même sans aucune réduction,
  // ce qui rendrait la détection instable au voisinage du plafond.
  const clippedC = clipChromaOk(L, C, H);
  return {
    hex,
    L: Math.round(L * 10000) / 10000,
    // chroma réellement présente dans la couleur finale (arrondi hex compris)
    chroma: Math.round(got.C * 10000) / 10000,
    requestedChroma: Math.round(C * 10000) / 10000,
    clipped: C - clippedC > 1e-4,
    hue: Math.round(got.H * 10) / 10,
    y: relativeLuminance(hex),
  };
}

/**
 * L'écart de luminance inévitable au voisinage d'une couleur : la grille hex est discrète,
 * toutes les valeurs de Y ne sont pas atteignables. Sert de tolérance honnête — en deçà,
 * aucune couleur sRGB ne fait mieux.
 */
export function luminanceQuantum(hex) {
  const { L, C, H } = hexToOklch(hex);
  const y = relativeLuminance(hex);
  const step = dir => {
    for (let d = 0.0002; d < 0.06; d += 0.0002) {
      const alt = oklchToHex(Math.max(0, Math.min(1, L + dir * d)), C, H);
      if (alt !== hex) return Math.abs(relativeLuminance(alt) - y);
    }
    return 0.01;
  };
  // On regarde des deux côtés : la cible peut tomber n'importe où entre les deux voisins,
  // c'est donc le plus large des deux intervalles qui borne l'erreur inévitable.
  return Math.max(step(1), step(-1));
}

/**
 * L'écart de luminance au **voisinage réel** d'une couleur : la distance à la valeur de Y
 * atteignable la plus proche de chaque côté, la plus large des deux étant retenue.
 *
 * À ne pas confondre avec `luminanceQuantum`, qui renvoie l'écart au premier hex *différent*
 * — souvent un voisin à un LSB sur un seul canal, donc quasi identique en luminance. Ce
 * nombre-là est une borne basse, et s'en servir comme tolérance produit des tests rouges sans
 * raison : sur `chartreuse/200` il vaut 6,5·10⁻⁵ alors que le vrai trou entre deux valeurs
 * atteignables vaut 5,1·10⁻³, soit 79 fois plus. C'est ce trou qui borne l'erreur inévitable,
 * puisqu'une cible peut tomber n'importe où dedans.
 */
export function luminanceGap(hex, { window = 0.03, step = 0.0005 } = {}) {
  const { L, C, H } = hexToOklch(hex);
  const y = relativeLuminance(hex);
  let below = -Infinity, above = Infinity;
  for (let d = -window; d <= window; d += step) {
    const v = relativeLuminance(oklchToHex(Math.max(0, Math.min(1, L + d)), C, H));
    if (v < y && v > below) below = v;
    if (v > y && v < above) above = v;
  }
  return Math.max(below === -Infinity ? 0 : y - below, above === Infinity ? 0 : above - y);
}

/**
 * Chroma maximale tenable à luminance et teinte données.
 *
 * Ce n'est pas la même chose que la chroma maximale à *luminosité* donnée : ici L est
 * lui-même fonction de C, puisqu'il est re-résolu à chaque essai. On cherche donc le plus
 * grand C pour lequel la résolution converge sans que le gamut n'ait mordu.
 */
export function maxChromaAtLuminance(targetY, H, { iters = 22, ceiling = 0.45 } = {}) {
  if (!solveAtLuminance(targetY, 0.001, H).hex) return 0;
  let lo = 0, hi = ceiling;
  if (!solveAtLuminance(targetY, hi, H).clipped) return hi;
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (solveAtLuminance(targetY, mid, H).clipped) hi = mid; else lo = mid;
  }
  return Math.round(lo * 10000) / 10000;
}

/**
 * Le profil de chroma en cloche : quelle fraction de la marge disponible on prend, cran
 * par cran.
 *
 * Sans profil, une rampe re-saturée uniformément devient fausse aux extrémités. Le gamut
 * sRGB laisse énormément de place à Y très bas et très haut — précisément là où la couleur
 * ne doit pas en prendre : les crans extrêmes sont des **fonds** et des **encres**, pas des
 * aplats. Mesuré sur un cas réel : sans cloche, le cran 50 sombre d'un bleu gagnait +1065 %
 * de chroma et cessait d'être une surface. La cloche rend la marge au milieu de la rampe,
 * là où vivent les couleurs d'accent, et la refuse aux bouts.
 *
 * Les valeurs sont des fractions de [0, 1] et se lisent comme un geste : « au cran 500 je
 * prends 85 % de ce que le gamut m'autorise, au cran 50 j'en prends 25 % ».
 */
export const BELL_CHROMA = [0.25, 0.40, 0.60, 0.75, 0.85, 0.85, 0.85, 0.75, 0.60, 0.40, 0.25];

/**
 * On ne colle jamais au bord du gamut : une couleur posée exactement dessus devient fragile
 * au moindre arrondi, et le moindre ajustement de teinte la fait sortir. 96 % laisse la marge
 * qu'il faut sans qu'on voie la différence.
 */
export const GAMUT_CEILING = 0.96;

/** Alias court de BELL_CHROMA — les deux noms circulent, ils désignent la même cloche. */
export const BELL = BELL_CHROMA;

/**
 * Le profil rééchantillonné sur n crans. Le profil de référence est écrit sur 11 crans —
 * l'échelle la plus courante — mais rien n'oblige une marque à en avoir 11 : les points de
 * contrôle sont donc étalés sur la longueur demandée puis lissés (cosinus), ce qui rend le
 * profil exact quand n vaut sa propre longueur et raisonnable partout ailleurs.
 */
export function chromaProfile(n, profile = BELL_CHROMA) {
  if (!Array.isArray(profile) || !profile.length) return new Array(n).fill(1);
  if (n <= 1) return new Array(n).fill(profile[Math.floor(profile.length / 2)]);
  const m = profile.length;
  if (m === 1) return new Array(n).fill(profile[0]);
  return sampleCurve(profile.map((value, k) => ({ index: (k * (n - 1)) / (m - 1), value })), n);
}

/**
 * Le profil lu à la position de chaque cran sur la grille régulière, et non à son rang dans
 * la liste : avec des crans hors grille, le 500 n'est plus le 6e de la liste, et il doit
 * pourtant recevoir la même valeur qu'en « standard ». `shades` : le barreau complet ;
 * `nCore` : le nombre de crans réguliers. Interpolation linéaire entre les points du profil.
 */
export function profileOnLadder(shades, nCore, profile = BELL_CHROMA) {
  const m = profile.length;
  return shades.map(s => {
    const p = Math.max(0, Math.min(1, ((1 - s / 200) * nCore - 0.5) / Math.max(1, nCore - 1)));
    const x = p * (m - 1), k = Math.min(m - 2, Math.floor(x)), f = x - k;
    return profile[k] + (profile[k + 1] - profile[k]) * f;
  });
}

/**
 * Le squelette de luminance d'une rampe : une valeur de Y par step, relevée sur une échelle
 * déjà générée. C'est ce qui sera verrouillé pendant toute l'édition.
 */
export function luminanceLadder(scale) {
  return scale.map(hex => (hex ? relativeLuminance(hex) : null));
}

/**
 * La rampe sombre d'une rampe claire : même teinte, luminance imposée par `darkLadder`,
 * chroma choisie entre deux bornes.
 *
 * Deux variantes, et le paramètre `vividness` fait passer continûment de l'une à l'autre :
 *
 * - **alignée** (`vividness = 0`) : on reprend la **chroma absolue** du cran clair. Les deux
 *   modes ont alors la même intensité chromatique, la correction est minimale, et c'est le
 *   défaut — un mode sombre n'est pas une occasion de redessiner la marque.
 * - **vive** (`vividness > 0`) : on parcourt en plus cette fraction du chemin qui reste vers
 *   le maximum tenable. À passer un profil en cloche (`chromaProfile`), jamais une constante.
 *
 * Le plafond est volontairement en retrait du bord du gamut (96 %) : une couleur posée
 * exactement à la frontière devient fragile — le moindre arrondi la fait sortir, et c'est la
 * réduction de chroma qui paie, donc la teinte perçue qui bouge.
 *
 * - **désaturée** (`desaturate > 0`) : on reprend la chroma du clair diminuée de cette part.
 *   C'est le défaut du studio : une couleur posée sur un fond sombre paraît plus vive qu'en
 *   clair à chroma égale, et les fonds sombres teintés deviennent vite criards.
 *
 * Hors désaturation voulue, la chroma ne régresse jamais par rapport au cran clair, sauf quand
 * le gamut l'interdit à cette luminance : c'est alors une contrainte physique, et elle est
 * signalée (`clamped`).
 */
export function deriveDarkScale(lightScale, darkLadder, {
  vividness = null, gamutCeiling = 0.96, desaturate = 0,
} = {}) {
  return lightScale.map((lightHex, i) => {
    const targetY = darkLadder[i];
    if (!lightHex || targetY === null || targetY === undefined) return null;

    const light = hexToOklch(lightHex);
    const ceiling = maxChromaAtLuminance(targetY, light.H) * gamutCeiling;
    // variante « alignée » : la chroma du clair, sauf si le gamut ne la tient pas ici.
    // `desaturate` en retire une part fixe : sur un fond sombre, une couleur à chroma égale
    // paraît plus saturée qu'en clair (effet Hunt, contraste simultané) et « vibre ».
    const ds = Array.isArray(desaturate) ? (desaturate[i] ?? 0) : desaturate;
    const kept = light.C * (1 - Math.max(0, Math.min(1, ds)));
    const aligned = Math.min(kept, ceiling);
    const frac = Array.isArray(vividness) ? (vividness[i] ?? 0) : (vividness ?? 0);
    const wanted = aligned + (ceiling - aligned) * Math.max(0, Math.min(1, frac));

    const solved = solveAtLuminance(targetY, wanted, light.H);
    return {
      ...solved,
      targetY,
      yDeviation: solved.y - targetY,
      // hors budget : le fond est trop clair pour le contraste demandé à ce cran
      outOfBudget: targetY > 1,
      maxChroma: Math.round(ceiling * 10000) / 10000,
      clamped: kept > ceiling + 1e-4,
      chromaGain: light.C > 1e-4 ? Math.round((solved.chroma / light.C) * 1000) / 1000 : null,
      lightHex,
      lightChroma: Math.round(light.C * 10000) / 10000,
    };
  });
}

/**
 * Applique les réglages d'une rampe et renvoie les couleurs résultantes.
 *
 * `tuning` décrit, pour chaque step : la teinte et la chroma voulues. Les valeurs sont
 * exprimées en écart par rapport à la rampe de référence (`hueShift`, `chromaScale`) pour
 * que les courbes restent lisibles et que changer la couleur source ne casse pas le réglage.
 * Un step peut aussi être épinglé à une valeur exacte, ce qui rompt volontairement le verrou.
 */
export function applyTuning(baseScale, ladder, tuning = {}) {
  const hueShift = tuning.hueShift || [];
  const chromaFraction = tuning.chromaFraction || [];
  const pins = tuning.pins || {};

  return baseScale.map((baseHex, i) => {
    const targetY = ladder[i];
    if (baseHex === null || targetY === null) return null;

    const pin = pins[i] || pins[String(i)];
    if (pin) {
      // épinglage : la valeur exacte l'emporte, le verrou saute pour ce step
      const y = relativeLuminance(pin);
      return {
        hex: pin, pinned: true,
        y, targetY,
        yDeviation: y - targetY,
        ...hexToOklch(pin),
        clipped: false,
      };
    }

    const base = hexToOklch(baseHex);
    const H = (base.H + (hueShift[i] || 0) + 360) % 360;
    const ceiling = maxChromaAtLuminance(targetY, H);

    // La chroma s'exprime en fraction de ce que le gamut autorise à cette luminance, et non
    // en multiple de la couleur de départ : au-dessus du plafond un multiplicateur ne fait
    // plus rien, alors que la fraction reste un réglage utile sur toute sa course — et c'est
    // le geste réel, « je me retire du maximum ».
    const baseCeiling = maxChromaAtLuminance(targetY, base.H);
    const baseFraction = baseCeiling > 1e-4 ? Math.min(1, base.C / baseCeiling) : 1;
    const frac = chromaFraction[i] ?? baseFraction;

    const solved = solveAtLuminance(targetY, ceiling * frac, H);

    // Le contraste WCAG est verrouillé, mais la clarté *perçue* ne l'est pas : à luminance
    // égale, une couleur saturée paraît plus claire qu'un gris (Helmholtz-Kohlrausch).
    // On mesure l'écart pour pouvoir l'afficher — c'est la limite honnête du procédé.
    const greyL = hexToOklch(solveAtLuminance(targetY, 0, H).hex).L;

    return {
      ...solved,
      pinned: false,
      targetY,
      yDeviation: solved.y - targetY,
      maxChroma: ceiling,
      fraction: ceiling > 1e-4 ? Math.min(1, solved.chroma / ceiling) : 1,
      baseFraction,
      perceivedShift: Math.round((hexToOklch(solved.hex).L - greyL) * 1000) / 1000,
      baseHex,
      baseHue: Math.round(base.H * 10) / 10,
      baseChroma: Math.round(base.C * 10000) / 10000,
    };
  });
}

/**
 * La moyenne de deux variantes d'une même rampe, faite **sur la chroma**, à luminance et
 * teinte constantes.
 *
 * Le cas est banal en atelier : le client entoure deux propositions pour une famille et
 * demande « entre les deux ». Le réflexe — moyenner les composantes RGB — est faux : le
 * mélange déplace Y, donc le contraste, donc l'échelon perd son sens et il faut tout
 * re-tester. Ici Y est imposé par le barreau et n'entre pas dans la moyenne ; seule la
 * grandeur qui portait le désaccord, l'éclat, est moyennée.
 *
 * La teinte est moyennée par le chemin le plus court, ce qui n'a de sens que si les deux
 * variantes sont bien deux vivacités de la même couleur : `hueSpread` remonte l'écart réel
 * pour qu'une moyenne entre deux teintes différentes se voie au lieu de passer.
 */
export function blendVariants(a, b, ladder) {
  return a.map((hexA, i) => {
    const hexB = b[i], targetY = ladder[i];
    if (!hexA || !hexB || targetY === null || targetY === undefined) return null;
    const A = hexToOklch(hexA), B = hexToOklch(hexB);
    const spread = hueDelta(A.H, B.H);
    const H = (A.H + spread / 2 + 360) % 360;
    const C = (A.C + B.C) / 2;
    const solved = solveAtLuminance(targetY, C, H);
    return {
      ...solved,
      targetY,
      yDeviation: solved.y - targetY,
      sources: [hexA, hexB],
      sourceChromas: [Math.round(A.C * 10000) / 10000, Math.round(B.C * 10000) / 10000],
      hueSpread: Math.round(Math.abs(spread) * 10) / 10,
    };
  });
}

/**
 * Vérifie qu'un réglage a bien tenu sa promesse : aucun step non épinglé ne doit avoir
 * bougé en contraste. Le seuil correspond à la quantification hex, en deçà de laquelle
 * aucune couleur sRGB ne peut être plus précise.
 */
export function verifyTuning(tuned, { maxRelative = 0.01 } = {}) {
  const drifted = [], pinned = [];
  let worst = 0;

  tuned.forEach((t, i) => {
    if (!t) return;
    const got = luminanceToContrasts(t.y), want = luminanceToContrasts(t.targetY);
    if (t.pinned) {
      pinned.push({
        index: i, hex: t.hex,
        vsBlack: got.vsBlack, vsWhite: got.vsWhite,
        expectedVsBlack: want.vsBlack, expectedVsWhite: want.vsWhite,
      });
      return;
    }
    // Le critère qui compte n'est pas l'écart de luminance en valeur absolue mais son effet
    // sur le contraste, et en relatif : 0,05 d'écart sur un contraste de 18:1 n'a aucun sens
    // pratique, alors que le même écart sur 3:1 en aurait un. Le résiduel est de toute façon
    // borné par la grille hex — aucune couleur sRGB ne ferait mieux.
    const rel = Math.max(
      Math.abs(got.vsBlack - want.vsBlack) / want.vsBlack,
      Math.abs(got.vsWhite - want.vsWhite) / want.vsWhite,
    );
    worst = Math.max(worst, rel);
    if (rel > maxRelative) {
      drifted.push({ index: i, hex: t.hex, deviation: t.yDeviation, relative: rel });
    }
  });

  return { ok: drifted.length === 0, drifted, pinned, maxRelativeDeviation: worst };
}

/** Une courbe lisse passant par des points de contrôle, pour dessiner dérive et arc. */
export function sampleCurve(points, n) {
  if (!points || !points.length) return new Array(n).fill(0);
  if (points.length === 1) return new Array(n).fill(points[0].value);
  const sorted = [...points].sort((a, b) => a.index - b.index);
  return Array.from({ length: n }, (_, i) => {
    if (i <= sorted[0].index) return sorted[0].value;
    if (i >= sorted[sorted.length - 1].index) return sorted[sorted.length - 1].value;
    const hi = sorted.findIndex(p => p.index >= i);
    const a = sorted[hi - 1], b = sorted[hi];
    if (a.index === b.index) return b.value;
    const t = (i - a.index) / (b.index - a.index);
    // lissage cosinus : évite les cassures visibles aux points de contrôle
    return lerp(a.value, b.value, (1 - Math.cos(t * Math.PI)) / 2);
  });
}
