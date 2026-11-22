/**
 * APCA 0.0.98G-4g — Accessible Perceptual Contrast Algorithm (WCAG 3 draft).
 *
 * License: NOT covered by Hueladder's MIT license. Port of apca-w3, copyright © 2019-2023
 * Andrew Somers / Myndex Research, under its "W3 License for Compliant Code Only" (web-based
 * content, in support of WCAG). APCA™ is a trademark of Myndex; Hueladder is not affiliated
 * with or endorsed by Myndex. See THIRD_PARTY_NOTICES.md.
 *
 * Port of the `apca-w3` reference implementation (constants of the 0.0.98G-4g
 * lookup, "G" series, 4g exponents). Pure JS, no dependencies.
 *
 * The returned value is `Lc` (lightness contrast), signed:
 *   - positive  => dark text on a light background (BoW, "black on white")
 *   - negative  => light text on a dark background (WoB, "white on black")
 * The magnitude is what matters for readability thresholds; the sign only
 * carries the polarity, which APCA weights asymmetrically.
 *
 * Reference: https://github.com/Myndex/apca-w3 (SAPC/APCA, Andrew Somers)
 */

/* ---------------------------------------------------------------------- *
 * 0.0.98G-4g constants
 * ---------------------------------------------------------------------- */

// sRGB transfer curve + luminance coefficients (APCA uses a simple 2.4 power
// curve, NOT the piecewise IEC 61966-2-1 curve used by WCAG 2).
const MAIN_TRC = 2.4;
const S_RCO = 0.2126729;
const S_GCO = 0.7151522;
const S_BCO = 0.0721750;

// Power-curve exponents per polarity.
const NORM_BG = 0.56; // background, dark text on light bg
const NORM_TXT = 0.57; // text,       dark text on light bg
const REV_TXT = 0.62; // text,       light text on dark bg
const REV_BG = 0.65; // background, light text on dark bg

// Soft clamp for very dark colours (flare / near-black perceptual compression).
const BLK_THRS = 0.022;
const BLK_CLMP = 1.414;

// Output scaling and the low-contrast dead zone.
const SCALE_BOW = 1.14;
const SCALE_WOB = 1.14;
const LO_BOW_OFFSET = 0.027;
const LO_WOB_OFFSET = 0.027;
const LO_CLIP = 0.1;
const DELTA_Y_MIN = 0.0005;

// Valid luminance domain (allows a little headroom above 1.0 for HDR-ish input).
const Y_CLAMP_MIN = 0.0;
const Y_CLAMP_MAX = 1.1;

/* ---------------------------------------------------------------------- *
 * Colour parsing
 * ---------------------------------------------------------------------- */

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Parse '#rrggbb' (also accepts '#rgb', '#rgba', '#rrggbbaa' — alpha ignored,
 * APCA requires already-composited opaque colours) into [r, g, b] 0..255.
 *
 * @param {string} hex
 * @returns {[number, number, number]}
 */
export function parseHex(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError(`apca: expected a hex colour string, got ${typeof hex}`);
  }
  const m = HEX_RE.exec(hex.trim());
  if (!m) throw new TypeError(`apca: invalid hex colour '${hex}'`);

  let h = m[1];
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  } else {
    h = h.slice(0, 6);
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * sRGB (0..255 per channel) -> APCA screen luminance Y.
 *
 * @param {[number, number, number]|number[]} rgb
 * @returns {number} Y, nominally 0..1
 */
export function sRGBtoY(rgb) {
  const simpleExp = (chan) => Math.pow(chan / 255.0, MAIN_TRC);
  return S_RCO * simpleExp(rgb[0]) + S_GCO * simpleExp(rgb[1]) + S_BCO * simpleExp(rgb[2]);
}

/* ---------------------------------------------------------------------- *
 * Core contrast
 * ---------------------------------------------------------------------- */

/**
 * APCA contrast from two screen luminances. This is the 0.0.98G-4g core:
 * soft black clamp, deltaYmin guard, polarity branch, low-contrast clip.
 *
 * @param {number} txtY luminance of the text colour
 * @param {number} bgY  luminance of the background colour
 * @returns {number} Lc, signed, roughly -108..+106 for sRGB
 */
export function APCAcontrast(txtY, bgY) {
  // Sanity: NaN or out-of-gamut luminance yields 0 (per reference).
  if (
    !Number.isFinite(txtY) ||
    !Number.isFinite(bgY) ||
    Math.min(txtY, bgY) < Y_CLAMP_MIN ||
    Math.max(txtY, bgY) > Y_CLAMP_MAX
  ) {
    return 0.0;
  }

  // Soft clamp near black (applies to whichever colour is below the threshold).
  const txt = txtY > BLK_THRS ? txtY : txtY + Math.pow(BLK_THRS - txtY, BLK_CLMP);
  const bg = bgY > BLK_THRS ? bgY : bgY + Math.pow(BLK_THRS - bgY, BLK_CLMP);

  // Luminances too close to distinguish: hard zero, avoids float noise.
  if (Math.abs(bg - txt) < DELTA_Y_MIN) return 0.0;

  let sapc = 0.0;
  let outputContrast = 0.0;

  if (bg > txt) {
    // BoW: dark text on a light background -> positive Lc.
    sapc = (Math.pow(bg, NORM_BG) - Math.pow(txt, NORM_TXT)) * SCALE_BOW;
    // Below the clip the result is not merely small, it is meaningless: zero it.
    outputContrast = sapc < LO_CLIP ? 0.0 : sapc - LO_BOW_OFFSET;
  } else {
    // WoB: light text on a dark background -> negative Lc.
    sapc = (Math.pow(bg, REV_BG) - Math.pow(txt, REV_TXT)) * SCALE_WOB;
    outputContrast = sapc > -LO_CLIP ? 0.0 : sapc + LO_WOB_OFFSET;
  }

  return outputContrast * 100;
}

/**
 * APCA Lc for a text/background hex pair.
 *
 * @param {string} textHex '#rrggbb' of the text (foreground)
 * @param {string} bgHex   '#rrggbb' of the background
 * @returns {number} signed Lc (positive = dark text on light bg)
 */
export function apcaLc(textHex, bgHex) {
  const lc = APCAcontrast(sRGBtoY(parseHex(textHex)), sRGBtoY(parseHex(bgHex)));
  // Normalise -0 to 0 so `=== 0` and `Object.is` both behave.
  return lc === 0 ? 0 : lc;
}

/* ---------------------------------------------------------------------- *
 * Human-readable bands (French)
 * ---------------------------------------------------------------------- */

/** Band thresholds, descending; first match wins. @type {[number, string][]} */
const BANDS = [
  [90, 'corps de texte optimal (jusqu’à 14 px)'],
  [75, 'minimum corps de texte (>= 16 px, ou 12 px bold)'],
  [60, 'minimum texte fluide (>= 24 px, ou 16 px semi-bold)'],
  [45, 'titres larges (>= 36 px, ou >= 24 px bold)'],
  [30, 'texte non essentiel / placeholders'],
  [15, 'éléments non textuels discernables uniquement'],
];

const BAND_INSUFFICIENT = 'insuffisant pour tout usage';

/**
 * Short French description of what a given Lc is usable for.
 * The sign is ignored: only |Lc| drives the band.
 *
 * @param {number} lc signed or absolute Lc
 * @returns {string}
 */
export function apcaBand(lc) {
  const abs = Math.abs(Number(lc));
  if (!Number.isFinite(abs)) return BAND_INSUFFICIENT;
  for (const [threshold, label] of BANDS) {
    if (abs >= threshold) return label;
  }
  return BAND_INSUFFICIENT;
}

/** Smallest usable font size per band. @type {[number, string][]} */
const MIN_FONT_SIZES = [
  [90, '14 px'],
  [75, '16 px'],
  [60, '24 px'],
  [45, '36 px'],
];

/**
 * Smallest font size usable for readable body/fluid text at this Lc.
 * Returns null below Lc 45, where no size is considered readable text.
 *
 * @param {number} lc signed or absolute Lc
 * @returns {string|null} e.g. '16 px'
 */
export function apcaMinFontSize(lc) {
  const abs = Math.abs(Number(lc));
  if (!Number.isFinite(abs)) return null;
  for (const [threshold, size] of MIN_FONT_SIZES) {
    if (abs >= threshold) return size;
  }
  return null;
}
