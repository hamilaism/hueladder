/**
 * cam16.mjs — Google Material's HCT colour space in pure JS (no dependencies).
 *
 * Portions derived from material-color-utilities, Copyright 2021 Google LLC, Apache License 2.0
 * (LICENSES/Apache-2.0.txt). Changes: ported to plain JavaScript, own gamut solver.
 * See THIRD_PARTY_NOTICES.md.
 *
 * HCT = CAM16 Hue + CAM16 Chroma + CIELAB L* (called "tone").
 *
 * Reference implementation: material-color-utilities (Cam16, Hct, HctSolver,
 * ViewingConditions). Viewing conditions match `ViewingConditions.DEFAULT`:
 *   - white point D65 = [95.047, 100.0, 108.883]
 *   - adaptingLuminance = 200/PI * yFromLstar(50) / 100  (~11.726)
 *   - backgroundLstar = 50  ->  Yb = yFromLstar(50) = 18.418
 *   - surround = 2 ("average")  ->  F = 1.0, c = 0.69, Nc = 1.0
 *   - discountingIlluminant = false
 *
 * Exports:
 *   hctFromHex(hex)      -> { h, c, t }
 *   hctToHex(h, c, t)    -> '#rrggbb'   (chroma reduced until in sRGB gamut)
 */

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------

const WHITE_POINT_D65 = [95.047, 100.0, 108.883];

function clampDouble(min, max, v) {
  return v < min ? min : v > max ? max : v;
}

function signum(v) {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

function sanitizeDegrees(degrees) {
  let d = degrees % 360.0;
  if (d < 0) d += 360.0;
  return d;
}

/** Signed angular difference a - b, in (-180, 180]. */
function differenceDegrees(a, b) {
  let d = (a - b) % 360.0;
  if (d > 180.0) d -= 360.0;
  if (d <= -180.0) d += 360.0;
  return d;
}

function lerp(start, stop, amount) {
  return (1.0 - amount) * start + amount * stop;
}

// ---------------------------------------------------------------------------
// sRGB <-> XYZ <-> L*  (all XYZ / linear-RGB values on a 0..100 scale)
// ---------------------------------------------------------------------------

const SRGB_TO_XYZ = [
  [0.41233895, 0.35762064, 0.18051042],
  [0.2126, 0.7152, 0.0722],
  [0.01932141, 0.11916382, 0.95034478],
];

const XYZ_TO_SRGB = [
  [3.2413774792388685, -1.5376652402851851, -0.49885366846268053],
  [-0.9691452513005321, 1.8758853451067872, 0.04156585616912061],
  [0.05562093689691305, -0.20395524564742123, 1.0571799111220335],
];

/** 8-bit sRGB component (0..255) -> linear component (0..100). */
function linearized(rgbComponent) {
  const normalized = rgbComponent / 255.0;
  if (normalized <= 0.040449936) {
    return (normalized / 12.92) * 100.0;
  }
  return Math.pow((normalized + 0.055) / 1.055, 2.4) * 100.0;
}

/** Linear component (0..100) -> sRGB component as a *float* in 0..255.
 *  Deliberately un-clamped so callers can gamut-test the raw value. */
function delinearizedFloat(rgbComponent) {
  const normalized = rgbComponent / 100.0;
  if (normalized <= 0.0031308) {
    // Also the branch taken for negative values (keeps them negative, no NaN).
    return normalized * 12.92 * 255.0;
  }
  return (1.055 * Math.pow(normalized, 1.0 / 2.4) - 0.055) * 255.0;
}

const LAB_E = 216.0 / 24389.0;
const LAB_KAPPA = 24389.0 / 27.0;

function labF(t) {
  if (t > LAB_E) return Math.cbrt(t);
  return (LAB_KAPPA * t + 16.0) / 116.0;
}

function labInvf(ft) {
  const ft3 = ft * ft * ft;
  if (ft3 > LAB_E) return ft3;
  return (116.0 * ft - 16.0) / LAB_KAPPA;
}

/** Y (0..100) -> L* (0..100). */
function lstarFromY(y) {
  return labF(y / 100.0) * 116.0 - 16.0;
}

/** L* (0..100) -> Y (0..100). */
function yFromLstar(lstar) {
  return 100.0 * labInvf((lstar + 16.0) / 116.0);
}

function xyzFromRgb255(r, g, b) {
  const rL = linearized(r);
  const gL = linearized(g);
  const bL = linearized(b);
  return [
    SRGB_TO_XYZ[0][0] * rL + SRGB_TO_XYZ[0][1] * gL + SRGB_TO_XYZ[0][2] * bL,
    SRGB_TO_XYZ[1][0] * rL + SRGB_TO_XYZ[1][1] * gL + SRGB_TO_XYZ[1][2] * bL,
    SRGB_TO_XYZ[2][0] * rL + SRGB_TO_XYZ[2][1] * gL + SRGB_TO_XYZ[2][2] * bL,
  ];
}

function linearRgbFromXyz(x, y, z) {
  return [
    XYZ_TO_SRGB[0][0] * x + XYZ_TO_SRGB[0][1] * y + XYZ_TO_SRGB[0][2] * z,
    XYZ_TO_SRGB[1][0] * x + XYZ_TO_SRGB[1][1] * y + XYZ_TO_SRGB[1][2] * z,
    XYZ_TO_SRGB[2][0] * x + XYZ_TO_SRGB[2][1] * y + XYZ_TO_SRGB[2][2] * z,
  ];
}

/** CIELAB (D65) -> XYZ (0..100). */
function xyzFromLab(l, a, b) {
  const fy = (l + 16.0) / 116.0;
  const fx = a / 500.0 + fy;
  const fz = fy - b / 200.0;
  return [
    labInvf(fx) * WHITE_POINT_D65[0],
    labInvf(fy) * WHITE_POINT_D65[1],
    labInvf(fz) * WHITE_POINT_D65[2],
  ];
}

// ---------------------------------------------------------------------------
// Hex parsing / formatting
// ---------------------------------------------------------------------------

function rgbFromHex(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError(`hctFromHex: expected a string, got ${typeof hex}`);
  }
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length === 8) h = h.slice(0, 6); // #rrggbbaa -> drop alpha
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function hexFromRgb(r, g, b) {
  // Note: clampDouble() passes NaN straight through (both comparisons are
  // false), and (NaN).toString(16) is the literal string 'NaN' — which would
  // render as '#NaNNaNNaN'. Guard here so the return type is always '#rrggbb'.
  const p = (v) => {
    const n = Number.isFinite(v) ? Math.round(v) : 0;
    return clampDouble(0, 255, n).toString(16).padStart(2, '0');
  };
  return `#${p(r)}${p(g)}${p(b)}`;
}

// ---------------------------------------------------------------------------
// CAM16 viewing conditions
// ---------------------------------------------------------------------------

function makeViewingConditions({
  whitePoint = WHITE_POINT_D65,
  adaptingLuminance = (200.0 / Math.PI) * (yFromLstar(50.0) / 100.0),
  backgroundLstar = 50.0,
  surround = 2.0,
  discountingIlluminant = false,
} = {}) {
  const [xw, yw, zw] = whitePoint;

  // XYZ -> cone responses (CAT16 / M16 matrix)
  const rW = xw * 0.401288 + yw * 0.650173 + zw * -0.051461;
  const gW = xw * -0.250268 + yw * 1.204414 + zw * 0.045854;
  const bW = xw * -0.002079 + yw * 0.048952 + zw * 0.953127;

  const f = 0.8 + surround / 10.0;
  const c =
    f >= 0.9
      ? lerp(0.59, 0.69, (f - 0.9) * 10.0)
      : lerp(0.525, 0.59, (f - 0.8) * 10.0);

  let d = discountingIlluminant
    ? 1.0
    : f * (1.0 - (1.0 / 3.6) * Math.exp((-adaptingLuminance - 42.0) / 92.0));
  d = clampDouble(0.0, 1.0, d);

  const nc = f;
  const rgbD = [
    d * (100.0 / rW) + 1.0 - d,
    d * (100.0 / gW) + 1.0 - d,
    d * (100.0 / bW) + 1.0 - d,
  ];

  const k = 1.0 / (5.0 * adaptingLuminance + 1.0);
  const k4 = k * k * k * k;
  const k4F = 1.0 - k4;
  const fl =
    k4 * adaptingLuminance +
    0.1 * k4F * k4F * Math.cbrt(5.0 * adaptingLuminance);

  const n = yFromLstar(backgroundLstar) / whitePoint[1];
  const z = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / Math.pow(n, 0.2);
  const ncb = nbb;

  const rgbAFactors = [
    Math.pow((fl * rgbD[0] * rW) / 100.0, 0.42),
    Math.pow((fl * rgbD[1] * gW) / 100.0, 0.42),
    Math.pow((fl * rgbD[2] * bW) / 100.0, 0.42),
  ];
  const rgbA = [
    (400.0 * rgbAFactors[0]) / (rgbAFactors[0] + 27.13),
    (400.0 * rgbAFactors[1]) / (rgbAFactors[1] + 27.13),
    (400.0 * rgbAFactors[2]) / (rgbAFactors[2] + 27.13),
  ];
  const aw = (2.0 * rgbA[0] + rgbA[1] + 0.05 * rgbA[2]) * nbb;

  return { n, aw, nbb, ncb, c, nc, rgbD, fl, fLRoot: Math.pow(fl, 0.25), z };
}

/** ViewingConditions.DEFAULT from material-color-utilities. */
const VC = makeViewingConditions();

// ---------------------------------------------------------------------------
// CAM16 forward transform
// ---------------------------------------------------------------------------

/**
 * XYZ (0..100, D65) -> CAM16 { hue, chroma, j, m, s, q }.
 */
function cam16FromXyz(x, y, z, vc = VC) {
  // XYZ -> cone responses
  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * z;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * z;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * z;

  // Discount illuminant
  const rD = vc.rgbD[0] * rC;
  const gD = vc.rgbD[1] * gC;
  const bD = vc.rgbD[2] * bC;

  // Chromatic adaptation
  const rAF = Math.pow((vc.fl * Math.abs(rD)) / 100.0, 0.42);
  const gAF = Math.pow((vc.fl * Math.abs(gD)) / 100.0, 0.42);
  const bAF = Math.pow((vc.fl * Math.abs(bD)) / 100.0, 0.42);
  const rA = (signum(rD) * 400.0 * rAF) / (rAF + 27.13);
  const gA = (signum(gD) * 400.0 * gAF) / (gAF + 27.13);
  const bA = (signum(bD) * 400.0 * bAF) / (bAF + 27.13);

  // Redness-greenness / yellowness-blueness
  const a = (11.0 * rA + -12.0 * gA + bA) / 11.0;
  const b = (rA + gA - 2.0 * bA) / 9.0;

  // Auxiliary components
  const u = (20.0 * rA + 20.0 * gA + 21.0 * bA) / 20.0;
  const p2 = (40.0 * rA + 20.0 * gA + bA) / 20.0;

  // Hue
  const atanDegrees = (Math.atan2(b, a) * 180.0) / Math.PI;
  const hue = sanitizeDegrees(atanDegrees);

  // Achromatic response
  const ac = p2 * vc.nbb;

  // CAM16 lightness / brightness
  const j = 100.0 * Math.pow(ac / vc.aw, vc.c * vc.z);
  const q =
    (4.0 / vc.c) * Math.sqrt(j / 100.0) * (vc.aw + 4.0) * vc.fLRoot;

  // CAM16 chroma / colorfulness / saturation
  const huePrime = hue < 20.14 ? hue + 360.0 : hue;
  const eHue = 0.25 * (Math.cos((huePrime * Math.PI) / 180.0 + 2.0) + 3.8);
  const p1 = ((50000.0 / 13.0) * eHue * vc.nc) * vc.ncb;
  const t = (p1 * Math.sqrt(a * a + b * b)) / (u + 0.305);
  const alpha =
    Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, vc.n), 0.73);
  const chroma = alpha * Math.sqrt(j / 100.0);
  const m = chroma * vc.fLRoot;
  const s = 50.0 * Math.sqrt((alpha * vc.c) / (vc.aw + 4.0));

  return { hue, chroma, j, q, m, s };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param {string} hex '#rrggbb' (also accepts '#rgb', '#rrggbbaa', no '#').
 * @returns {{h: number, c: number, t: number}} CAM16 hue in degrees [0,360),
 *   CAM16 chroma, and tone (CIE L*, 0..100).
 */
export function hctFromHex(hex) {
  const [r, g, b] = rgbFromHex(hex);
  const [x, y, z] = xyzFromRgb255(r, g, b);
  const cam = cam16FromXyz(x, y, z);
  return { h: cam.hue, c: cam.chroma, t: lstarFromY(y) };
}

/**
 * Evaluate one point of the fixed-L* plane: given a CIELAB chroma and hue,
 * return the CAM16 readings and the (unclamped, float) sRGB triple.
 */
function evaluateLab(lstar, labChroma, labHueDeg) {
  const rad = (labHueDeg * Math.PI) / 180.0;
  const a = labChroma * Math.cos(rad);
  const b = labChroma * Math.sin(rad);
  const [x, y, z] = xyzFromLab(lstar, a, b);
  const [rL, gL, bL] = linearRgbFromXyz(x, y, z);
  const rgb = [
    delinearizedFloat(rL),
    delinearizedFloat(gL),
    delinearizedFloat(bL),
  ];
  const cam = cam16FromXyz(x, y, z);
  return { cam, rgb };
}

const GAMUT_EPS = 1e-9;

function inGamut(rgb) {
  for (const v of rgb) {
    if (!Number.isFinite(v) || v < -GAMUT_EPS || v > 255.0 + GAMUT_EPS) {
      return false;
    }
  }
  return true;
}

/**
 * At fixed L*, find the CIELAB hue angle whose CAM16 hue equals targetHue for
 * the given CIELAB chroma. CAM16 hue is monotonically increasing in CIELAB hue,
 * so plain bisection on the signed angular error converges.
 */
function solveLabHue(lstar, labChroma, targetHue) {
  let lo = targetHue - 90.0;
  let hi = targetHue + 90.0;

  const err = (labHue) =>
    differenceDegrees(evaluateLab(lstar, labChroma, labHue).cam.hue, targetHue);

  let eLo = err(lo);
  let eHi = err(hi);

  // Widen if the CAM16/CIELAB hue offset is larger than expected.
  let guard = 0;
  while (!(eLo <= 0 && eHi >= 0) && guard < 6) {
    lo -= 30.0;
    hi += 30.0;
    eLo = err(lo);
    eHi = err(hi);
    guard++;
  }
  if (!(eLo <= 0 && eHi >= 0)) {
    // Should not happen; fall back to the identity guess.
    return targetHue;
  }

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2.0;
    if (hi - lo < 1e-9) break;
    const eMid = err(mid);
    if (eMid < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2.0;
}

/** Full evaluation at a CIELAB chroma: hue-corrected so CAM16 hue == target. */
function solveAtLabChroma(lstar, labChroma, targetHue) {
  const labHue = solveLabHue(lstar, labChroma, targetHue);
  const res = evaluateLab(lstar, labChroma, labHue);
  return { labHue, labChroma, ...res, ok: inGamut(res.rgb) };
}

const MAX_LAB_CHROMA = 200.0;

/**
 * Find the sRGB colour with the requested CAM16 hue and chroma at the requested
 * tone. Tone (CIE L*) and hue are held fixed; when (h, c, t) falls outside the
 * sRGB gamut the chroma is reduced (binary search downward) until the colour is
 * representable, returning the most chromatic in-gamut result.
 *
 * @param {number} h CAM16 hue in degrees.
 * @param {number} c CAM16 chroma (>= 0).
 * @param {number} t Tone, i.e. CIE L*, 0..100.
 * @returns {string} '#rrggbb'
 */
export function hctToHex(h, c, t) {
  // Sanitise first: clampDouble()/sanitizeDegrees() both propagate NaN, which
  // would otherwise slip past the tone guards below and poison every downstream
  // computation (the old code returned the invalid string '#NaNNaNNaN').
  // +/-Infinity is meaningful and is left to clamp normally.
  // (clampDouble already maps +/-Infinity onto 100 / 0 correctly.)
  const toneRaw = Number(t);
  const tone = Number.isNaN(toneRaw) ? 0.0 : clampDouble(0.0, 100.0, toneRaw);
  const hueRaw = Number(h);
  const targetHue = Number.isFinite(hueRaw) ? sanitizeDegrees(hueRaw) : 0.0;
  const targetChroma = Math.max(0, Number(c) || 0);

  if (tone <= 0.0) return '#000000';
  if (tone >= 100.0) return '#ffffff';

  const grayHex = () => {
    const y = yFromLstar(tone);
    const v = delinearizedFloat(y); // neutral: linear R=G=B=Y
    return hexFromRgb(v, v, v);
  };

  if (targetChroma < 1e-4) return grayHex();

  // 1. Largest CIELAB chroma that stays inside the sRGB gamut at this tone.
  //    (The sRGB solid is star-shaped about the neutral axis in each L* slice,
  //    so in-gamut-ness is monotone along the hue-corrected ray.)
  let gLo = 0.0;
  let gHi = MAX_LAB_CHROMA;
  if (solveAtLabChroma(tone, gHi, targetHue).ok) {
    gLo = gHi;
  } else {
    for (let i = 0; i < 40; i++) {
      if (gHi - gLo < 1e-7) break;
      const mid = (gLo + gHi) / 2.0;
      if (solveAtLabChroma(tone, mid, targetHue).ok) gLo = mid;
      else gHi = mid;
    }
  }
  const maxInGamutLabChroma = gLo;

  // 2. CIELAB chroma that produces the requested CAM16 chroma (CAM16 chroma is
  //    monotonically increasing in CIELAB chroma along the ray).
  let cLo = 0.0;
  let cHi = MAX_LAB_CHROMA;
  let needed = MAX_LAB_CHROMA;
  if (solveAtLabChroma(tone, cHi, targetHue).cam.chroma <= targetChroma) {
    needed = cHi;
  } else {
    for (let i = 0; i < 40; i++) {
      if (cHi - cLo < 1e-7) break;
      const mid = (cLo + cHi) / 2.0;
      if (solveAtLabChroma(tone, mid, targetHue).cam.chroma < targetChroma) {
        cLo = mid;
      } else {
        cHi = mid;
      }
    }
    needed = (cLo + cHi) / 2.0;
  }

  const labChroma = Math.min(maxInGamutLabChroma, needed);
  if (labChroma <= 1e-6) return grayHex();

  const best = solveAtLabChroma(tone, labChroma, targetHue);

  // 3. Quantise to 8 bits. Plain rounding can shift tone/hue slightly, so pick
  //    the best of the 8 floor/ceil neighbours, prioritising tone fidelity.
  return quantise(best.rgb, tone, targetHue);
}

/**
 * Choose the 8-bit triple nearest `rgb` that best preserves tone, then hue.
 */
function quantise(rgb, targetTone, targetHue) {
  const floors = rgb.map((v) => Math.floor(clampDouble(0, 255, v)));
  let bestHex = null;
  let bestCost = Infinity;

  for (let i = 0; i < 8; i++) {
    const r = clampDouble(0, 255, floors[0] + ((i >> 2) & 1));
    const g = clampDouble(0, 255, floors[1] + ((i >> 1) & 1));
    const b = clampDouble(0, 255, floors[2] + (i & 1));
    const [x, y, z] = xyzFromRgb255(r, g, b);
    const tone = lstarFromY(y);
    const cam = cam16FromXyz(x, y, z);
    const dTone = tone - targetTone;
    // Hue only matters when the colour actually has chroma.
    const hueWeight = Math.min(1.0, cam.chroma / 10.0);
    const dHue = differenceDegrees(cam.hue, targetHue) * hueWeight;
    const cost = dTone * dTone * 100.0 + dHue * dHue;
    if (cost < bestCost) {
      bestCost = cost;
      bestHex = hexFromRgb(r, g, b);
    }
  }
  return bestHex;
}
