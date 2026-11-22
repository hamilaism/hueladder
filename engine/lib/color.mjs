// Conversions colorimétriques et métriques de contraste.
// Espaces : sRGB <-> linéaire <-> XYZ(D65) <-> CIE Lab <-> CIE LCh, et sRGB <-> OKLab <-> OKLCH.
// Les modules durs (CIEDE2000, APCA, CAM16/HCT) vivent dans leurs propres fichiers, validés
// contre les vecteurs de test publiés.

// ---------------------------------------------------------------- sRGB de base

export function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

export function rgbToHex({ r, g, b }) {
  const c = v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export const rgbToLinear = ({ r, g, b }) => ({ r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) });
export const linearToRgb = ({ r, g, b }) => ({ r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) });

/** Vrai si la couleur linéaire tient dans le cube sRGB (tolérance pour l'arrondi flottant). */
export function inGamut({ r, g, b }, eps = 1e-4) {
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
}

// ---------------------------------------------------------------- OKLab / OKLCH (Björn Ottosson)

export function linearToOklab({ r, g, b }) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

export function oklabToLinear({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

export function labToLch({ L, a, b }) {
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

export function lchToLab({ L, C, H }) {
  const rad = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

export const hexToOklch = hex => labToLch(linearToOklab(rgbToLinear(hexToRgb(hex))));

/**
 * Chroma maximale tenable dans le gamut sRGB à L et H OKLCH constants.
 * C'est la réduction de gamut « propre » : on sacrifie la saturation, jamais la
 * luminosité ni la teinte — ce qui est exactement la promesse des méthodes générées.
 */
export function clipChromaOk(L, C, H) {
  if (C <= 0) return 0;
  const fits = c => inGamut(oklabToLinear(lchToLab({ L, C: c, H })));
  if (fits(C)) return C;
  let lo = 0, hi = C;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

/** OKLCH -> hex, avec réduction de chroma au gamut sRGB (L et H préservés). */
export function oklchToHex(L, C, H) {
  const Lc = clamp01(L);
  return rgbToHex(linearToRgb(oklabToLinear(lchToLab({ L: Lc, C: clipChromaOk(Lc, C, H), H }))));
}

// ---------------------------------------------------------------- HSL
// Pas un espace perceptuel — c'est une simple reprojection du cube RGB. Mais c'est celui
// des sélecteurs de couleur, donc celui dans lequel « tourner la teinte de 30° » correspond
// au geste que ferait un designer à la main.

export function rgbToHsl({ r, g, b }) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0)
        : mx === g ? (b - r) / d + 2
        : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }) {
  if (!s) return { r: l, g: l, b: l };
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hh) % 6];
  return { r: r + m, g: g + m, b: b + m };
}

export const hexToHsl = hex => rgbToHsl(hexToRgb(hex));
export const hslToHex = hsl => rgbToHex(hslToRgb(hsl));

// ---------------------------------------------------------------- CIE XYZ / Lab (D65)

const D65 = { x: 0.95047, y: 1, z: 1.08883 };

export const linearToXyz = ({ r, g, b }) => ({
  x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
  y: 0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
  z: 0.0193339 * r + 0.1191920 * g + 0.9503041 * b,
});

export const xyzToLinear = ({ x, y, z }) => ({
  r: 3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
  g: -0.9692660 * x + 1.8760108 * y + 0.0415560 * z,
  b: 0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
});

const DELTA = 6 / 29;
const fLab = t => (t > DELTA ** 3 ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29);
const fLabInv = t => (t > DELTA ? t ** 3 : 3 * DELTA * DELTA * (t - 4 / 29));

export function xyzToLab({ x, y, z }) {
  const fx = fLab(x / D65.x), fy = fLab(y / D65.y), fz = fLab(z / D65.z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToXyz({ L, a, b }) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  return { x: D65.x * fLabInv(fx), y: D65.y * fLabInv(fy), z: D65.z * fLabInv(fz) };
}

export const hexToLab = hex => xyzToLab(linearToXyz(rgbToLinear(hexToRgb(hex))));
export const labToHex = lab => rgbToHex(linearToRgb(xyzToLinear(labToXyz(lab))));

/** L* CIELAB d'une couleur (= « tone » au sens Material). */
export const hexToLstar = hex => hexToLab(hex).L;

export function inGamutLab(lab) {
  return inGamut(xyzToLinear(labToXyz(lab)));
}

/** Chroma maximale tenable dans le gamut sRGB à L* et h CIELCh constants. */
export function clipChromaLab(L, C, H) {
  if (C <= 0) return 0;
  const fits = c => inGamutLab(lchToLab({ L, C: c, H }));
  if (fits(C)) return C;
  let lo = 0, hi = C;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

// ---------------------------------------------------------------- contraste WCAG 2

// Coefficients sRGB→Y haute précision, normalisés pour sommer exactement à 1.
// Les valeurs brutes (0.2126729 / 0.7151522 / 0.0721750) somment à 1.0000001, ce qui
// donnerait au blanc une luminance de 1.0000001 et casserait les identités exactes dont
// dépend l'édition à luminance verrouillée (notamment C_blanc × C_noir = 21).
const LUMA_SUM = 0.2126729 + 0.7151522 + 0.0721750;
const LUMA_R = 0.2126729 / LUMA_SUM, LUMA_G = 0.7151522 / LUMA_SUM, LUMA_B = 0.0721750 / LUMA_SUM;

export function relativeLuminance(hex) {
  const { r, g, b } = rgbToLinear(hexToRgb(hex));
  return LUMA_R * r + LUMA_G * g + LUMA_B * b;
}

export function contrast(hexA, hexB) {
  const a = relativeLuminance(hexA) + 0.05;
  const b = relativeLuminance(hexB) + 0.05;
  return a > b ? a / b : b / a;
}

export const WHITE = '#ffffff';
export const BLACK = '#000000';
export const contrastVsWhite = hex => contrast(hex, WHITE);
export const contrastVsBlack = hex => contrast(hex, BLACK);

/**
 * Contraste face à un fond quelconque, exprimé à partir de la luminance du fond plutôt
 * que d'une couleur — le fond d'un mode sombre n'est jamais le noir pur, et le supposer
 * fausse tout le calcul en aval : sur `#0e0d0d` (Y = 0,0041) l'amplitude totale n'est plus
 * de 21 mais de 1,05 / 0,0541 = 19,41.
 */
export const contrastY = (y, bgY) => {
  const a = y + 0.05, b = bgY + 0.05;
  return a > b ? a / b : b / a;
};
export const contrastVsBackgroundY = (hex, bgY) => contrastY(relativeLuminance(hex), bgY);

/**
 * Troncature et non arrondi : convention des outils de contraste — on n'affiche
 * jamais « 3.00 » pour un ratio réel de 2.998, qui échoue au seuil.
 */
export const fmtRatio = x => (Math.floor(x * 100) / 100).toFixed(2);

/**
 * Couleur de label lisible sur un fond donné. 0.179 est le point d'équi-contraste
 * de la formule WCAG : en dessous, le blanc gagne ; au-dessus, le noir. Garantit
 * toujours au moins 3:1 (et en pratique ~4.5:1 sauf au point de bascule exact).
 */
export const readableOn = hex => (relativeLuminance(hex) < 0.179 ? '#ffffff' : '#000000');

// ---------------------------------------------------------------- recherche

/**
 * Recherche binaire d'une luminosité OKLCH atteignant une valeur cible.
 * `increasing` décrit le sens de variation de `evalFn` quand L croît — s'il est
 * faux, la dichotomie est simplement inversée. Le mauvais sens produit une
 * convergence vers une borne (noir ou blanc pur) : c'est le symptôme à guetter.
 */
export function bisectLightness(target, evalFn, { lo = 0, hi = 1, iters = 40, increasing = true } = {}) {
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    const below = evalFn(mid) < target;
    if (below === increasing) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Écart de teinte le plus court entre deux angles, signé, dans [-180, 180]. */
export function hueDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}

/** Interpolation d'angle de teinte par le chemin le plus court. */
export function lerpHue(from, to, t) {
  return (from + hueDelta(from, to) * t + 360) % 360;
}

export const lerp = (a, b, t) => a + (b - a) * t;
