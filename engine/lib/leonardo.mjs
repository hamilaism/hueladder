/**
 * leonardo.mjs — Adobe Leonardo's contrast-color search, without dependencies.
 *
 * A port of @adobe/leonardo-contrast-colors 1.1.0 (createScale, searchColors, multiplyRatios;
 * Copyright 2024 Adobe, Apache License 2.0), of the chroma.js 3.2.0 code it runs on (OKLab and
 * OKLCH conversions, `_hsx` hue interpolation, `scale()` with its colour cache, clipping and hex
 * rounding; Copyright (c) 2011-2025 Gregor Aisch, BSD 3-Clause), and of the CIECAM02 J that
 * places the key colour on the scale (ciecam02 0.4.6 and ciebase 0.1.1; Copyright (c) 2014
 * Bastien Dejean, BSD 2-Clause). Changes: one file, no dependencies, a single key colour on a
 * white background. The arithmetic follows the originals operation for operation, so the output
 * matches the library to the hex (engine/conformance). See THIRD_PARTY_NOTICES.md and LICENSES/.
 *
 * leonardoColors(seed, ratios, { colorSpace }) → one hex per ratio, against a white background,
 * exactly as `new Theme({ colors: [new Color({ colorKeys: [seed], ratios, colorSpace })],
 * backgroundColor: white, lightness: 100 })` returns them.
 *
 * `{ gamut: 'chroma' }` is Hueladder's adapted Leonardo, not the library: an OKLCH colour of the
 * scale that falls outside sRGB loses chroma at the same lightness and hue, instead of having
 * each RGB channel clipped (which turns its hue). Everything else is unchanged.
 */

const { PI, round, floor, min, max, sqrt, atan2, cos, sin, cbrt, pow, abs, sign, exp } = Math;
const DEG2RAD = PI / 180, RAD2DEG = 180 / PI;

// ---------------------------------------------------------------- chroma.js 3.2.0, as written

const LAB = {
  Xn: 0.95047, Yn: 1, Zn: 1.08883,
  RefWhiteRGB: { X: 0.95047, Y: 1, Z: 1.08883 },
  MtxRGB2XYZ: { m00: 0.4124564390896922, m01: 0.21267285140562253, m02: 0.0193338955823293, m10: 0.357576077643909, m11: 0.715152155287818, m12: 0.11919202588130297, m20: 0.18043748326639894, m21: 0.07217499330655958, m22: 0.9503040785363679 },
  MtxXYZ2RGB: { m00: 3.2404541621141045, m01: -0.9692660305051868, m02: 0.055643430959114726, m10: -1.5371385127977166, m11: 1.8760108454466942, m12: -0.2040259135167538, m20: -0.498531409556016, m21: 0.041556017530349834, m22: 1.0572251882231791 },
  As: 0.9414285350000001, Bs: 1.040417467, Cs: 1.089532651,
  MtxAdaptMa: { m00: 0.8951, m01: -0.7502, m02: 0.0389, m10: 0.2664, m11: 1.7135, m12: -0.0685, m20: -0.1614, m21: 0.0367, m22: 1.0296 },
  MtxAdaptMaI: { m00: 0.9869929054667123, m01: 0.43230526972339456, m02: -0.008528664575177328, m10: -0.14705425642099013, m11: 0.5183602715367776, m12: 0.04004282165408487, m20: 0.15996265166373125, m21: 0.0492912282128556, m22: 0.9684866957875502 },
};

const mul = (A, v) => A.map(row => row.reduce((a, c, i) => a + c * (v[i] || 0), 0));

const gammaAdjustSRGB = companded => {
  const s = sign(companded);
  companded = abs(companded);
  return (companded <= 0.04045 ? companded / 12.92 : pow((companded + 0.055) / 1.055, 2.4)) * s;
};
const compand = linear => {
  const s = sign(linear);
  linear = abs(linear);
  return (linear <= 0.0031308 ? linear * 12.92 : 1.055 * pow(linear, 1.0 / 2.4) - 0.055) * s;
};

function rgb2xyz(r, g, b) {
  r = gammaAdjustSRGB(r / 255); g = gammaAdjustSRGB(g / 255); b = gammaAdjustSRGB(b / 255);
  const { MtxRGB2XYZ: M, MtxAdaptMa: A, MtxAdaptMaI: I, Xn, Yn, Zn, As, Bs, Cs } = LAB;
  let x = r * M.m00 + g * M.m10 + b * M.m20;
  let y = r * M.m01 + g * M.m11 + b * M.m21;
  let z = r * M.m02 + g * M.m12 + b * M.m22;
  const Ad = Xn * A.m00 + Yn * A.m10 + Zn * A.m20;
  const Bd = Xn * A.m01 + Yn * A.m11 + Zn * A.m21;
  const Cd = Xn * A.m02 + Yn * A.m12 + Zn * A.m22;
  let X = x * A.m00 + y * A.m10 + z * A.m20;
  let Y = x * A.m01 + y * A.m11 + z * A.m21;
  let Z = x * A.m02 + y * A.m12 + z * A.m22;
  X *= Ad / As; Y *= Bd / Bs; Z *= Cd / Cs;
  x = X * I.m00 + Y * I.m10 + Z * I.m20;
  y = X * I.m01 + Y * I.m11 + Z * I.m21;
  z = X * I.m02 + Y * I.m12 + Z * I.m22;
  return [x, y, z];
}

function xyz2rgb(x, y, z) {
  const { MtxAdaptMa: A, MtxAdaptMaI: I, MtxXYZ2RGB: M, RefWhiteRGB: W, Xn, Yn, Zn } = LAB;
  const As = Xn * A.m00 + Yn * A.m10 + Zn * A.m20;
  const Bs = Xn * A.m01 + Yn * A.m11 + Zn * A.m21;
  const Cs = Xn * A.m02 + Yn * A.m12 + Zn * A.m22;
  const Ad = W.X * A.m00 + W.Y * A.m10 + W.Z * A.m20;
  const Bd = W.X * A.m01 + W.Y * A.m11 + W.Z * A.m21;
  const Cd = W.X * A.m02 + W.Y * A.m12 + W.Z * A.m22;
  const X1 = (x * A.m00 + y * A.m10 + z * A.m20) * (Ad / As);
  const Y1 = (x * A.m01 + y * A.m11 + z * A.m21) * (Bd / Bs);
  const Z1 = (x * A.m02 + y * A.m12 + z * A.m22) * (Cd / Cs);
  const X2 = X1 * I.m00 + Y1 * I.m10 + Z1 * I.m20;
  const Y2 = X1 * I.m01 + Y1 * I.m11 + Z1 * I.m21;
  const Z2 = X1 * I.m02 + Y1 * I.m12 + Z1 * I.m22;
  const r = compand(X2 * M.m00 + Y2 * M.m10 + Z2 * M.m20);
  const g = compand(X2 * M.m01 + Y2 * M.m11 + Z2 * M.m21);
  const b = compand(X2 * M.m02 + Y2 * M.m12 + Z2 * M.m22);
  return [r * 255, g * 255, b * 255];
}

const XYZtoLMS = [[0.819022437996703, 0.3619062600528904, -0.1288737815209879], [0.0329836539323885, 0.9292868615863434, 0.0361446663506424], [0.0481771893596242, 0.2642395317527308, 0.6335478284694309]];
const LMStoOKLab = [[0.210454268309314, 0.7936177747023054, -0.0040720430116193], [1.9779985324311684, -2.4285922420485799, 0.450593709617411], [0.0259040424655478, 0.7827717124575296, -0.8086757549230774]];
const LMStoXYZ = [[1.2268798758459243, -0.5578149944602171, 0.2813910456659647], [-0.0405757452148008, 1.112286803280317, -0.0717110580655164], [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816]];
const OKLabtoLMS = [[1.0, 0.3963377773761749, 0.2158037573099136], [1.0, -0.1055613458156586, -0.0638541728258133], [1.0, -0.0894841775298119, -1.2914855480194092]];

function rgb2oklch([r, g, b]) {
  const [l, a, b_] = mul(LMStoOKLab, mul(XYZtoLMS, rgb2xyz(r, g, b)).map(c => cbrt(c)));
  const c = sqrt(a * a + b_ * b_);
  let h = (atan2(b_, a) * RAD2DEG + 360) % 360;
  if (round(c * 10000) === 0) h = Number.NaN;
  return [l, c, h];
}

function oklch2rgb(l, c, h) {
  if (isNaN(h)) h = 0;
  h = h * DEG2RAD;
  const [X, Y, Z] = mul(LMStoXYZ, mul(OKLabtoLMS, [l, cos(h) * c, sin(h) * c]).map(v => v ** 3));
  return xyz2rgb(X, Y, Z);
}

// a chroma.js Color keeps its channels clipped to [0, 255], unrounded
const clip = rgb => rgb.map(v => min(max(0, v), 255));
const parseHex = hex => { const u = parseInt(hex.replace('#', ''), 16); return [(u >> 16) & 0xff, (u >> 8) & 0xff, u & 0xff]; };
const toHex = rgb => { const u = (round(rgb[0]) << 16) | (round(rgb[1]) << 8) | round(rgb[2]); const s = '000000' + u.toString(16); return '#' + s.substr(s.length - 6); };

// how an OKLCH colour becomes RGB: chroma.js clips each channel, which turns the hue of what
// falls outside sRGB; Hueladder's adaptation lowers its chroma instead, at the same OKLCH
// lightness and hue (bisection on chroma, then the clip of chroma.js for the rounding residue)
const OUT = {
  clip: (l, c, h) => clip(oklch2rgb(l, c, h)),
  chroma(l, c, h) {
    const inside = rgb => rgb.every(v => v >= 0 && v <= 255);
    if (inside(oklch2rgb(l, c, h))) return clip(oklch2rgb(l, c, h));
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (inside(oklch2rgb(l, m, h))) lo = m; else hi = m; }
    return clip(oklch2rgb(l, lo, h));
  },
};

// interpolators, by Leonardo colour-space name
const INTERPOLATE = {
  // chroma.js `_hsx`, mode 'oklch'
  OKLCH(c1, c2, f, out) {
    const [lbv0, sat0, hue0] = rgb2oklch(c1), [lbv1, sat1, hue1] = rgb2oklch(c2);
    let sat, hue;
    if (!isNaN(hue0) && !isNaN(hue1)) {
      let dh;
      if (hue1 > hue0 && hue1 - hue0 > 180) dh = hue1 - (hue0 + 360);
      else if (hue1 < hue0 && hue0 - hue1 > 180) dh = hue1 + 360 - hue0;
      else dh = hue1 - hue0;
      hue = hue0 + f * dh;
    } else if (!isNaN(hue0)) {
      hue = hue0;
      if (lbv1 == 1 || lbv1 == 0) sat = sat0;
    } else if (!isNaN(hue1)) {
      hue = hue1;
      if (lbv0 == 1 || lbv0 == 0) sat = sat1;
    } else hue = Number.NaN;
    if (sat === undefined) sat = sat0 + f * (sat1 - sat0);
    const lbv = lbv0 + f * (lbv1 - lbv0);
    return out(lbv, sat, hue);
  },
  // chroma.js 'rgb': channel by channel
  RGB(c1, c2, f) {
    return clip([0, 1, 2].map(i => c1[i] + f * (c2[i] - c1[i])));
  },
};

// ---------------------------------------------------------------- CIECAM02 J (ciecam02 0.4.6)

// ciebase: D65 from CIE 15 chromaticities, sRGB matrix from its primaries
const xyY = (x, y) => [100 * (x / y), 100, (100 * (1 - x - y)) / y];
const D65 = xyY(0.31272, 0.32903);
const inv3 = m => {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
};
const mm = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const RGB_XYZ = (() => {
  const P = [[0.64, 0.33], [0.30, 0.60], [0.15, 0.06]].map(([x, y]) => [x / y, 1, (1 - x - y) / y]);
  const MP = [0, 1, 2].map(r => P.map(p => p[r]));
  const S = mul(inv3(MP), D65);
  return MP.map(row => row.map((v, j) => v * S[j]));
})();
const CAT02 = [[0.7328, 0.4296, -0.1624], [-0.7036, 1.6975, 0.0061], [0.0030, 0.0136, 0.9834]];
const HPE = [[0.38971, 0.68898, -0.07868], [-0.22981, 1.18340, 0.04641], [0, 0, 1]];
const CAT02_HPE = mm(HPE, inv3(CAT02));
const CAM = (() => {
  const LA = 40, Yb = 20, F = 1.0, c = 0.69, Yw = D65[1];
  const k = 1 / (5 * LA + 1);
  const FL = 0.2 * pow(k, 4) * 5 * LA + 0.1 * pow(1 - pow(k, 4), 2) * pow(5 * LA, 1 / 3);
  const n = Yb / Yw, Nbb = 0.725 * pow(1 / n, 0.2), z = 1.48 + sqrt(n);
  const D = F * (1 - (1 / 3.6) * exp(-(LA + 42) / 92));
  const DR = mul(CAT02, D65).map(v => (D * Yw) / v + 1 - D);
  const A = XYZ => {
    const rgbA = mul(CAT02_HPE, mul(CAT02, XYZ).map((v, i) => DR[i] * v)).map(v => {
      const x = pow((FL * abs(v)) / 100, 0.42);
      return (sign(v) * 400 * x) / (27.13 + x) + 0.1;
    });
    return (rgbA[0] * 2 + rgbA[1] + rgbA[2] / 20 - 0.305) * Nbb;
  };
  return { Aw: A(D65), A, cz: c * z };
})();
const camJ = rgb255 => {
  const XYZ = mul(RGB_XYZ, rgb255.map(v => v / 255).map(v => (v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4))));
  return 100 * pow(CAM.A(XYZ) / CAM.Aw, CAM.cz);
};

// ---------------------------------------------------------------- Leonardo 1.1.0

const roundTo = (x, n = 0) => { const ten = 10 ** n; return Math.round(x * ten) / ten; };
const multiplyRatios = (ratio, m) => roundTo(ratio > 1 ? (ratio - 1) * m + 1 : ratio < -1 ? (ratio + 1) * m - 1 : 1, 2);
const lum = ([r, g, b]) => {
  const a = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];

/** Leonardo's `getContrast`, wcag2, light theme (baseV ≥ 0.5). */
function contrastOnWhite(rgb) {
  const colorLum = lum(rgb), baseLum = lum(WHITE);
  const cr1 = (colorLum + 0.05) / (baseLum + 0.05), cr2 = (baseLum + 0.05) / (colorLum + 0.05);
  if (cr1 < 1) return cr2;
  if (cr1 === 1) return cr1;
  return -cr1;
}

/**
 * One hex per ratio, on a white background: Leonardo's Theme with a single key colour.
 * The colour space is the key's interpolation space, as in `new Color({ colorSpace })`.
 */
export function leonardoColors(seedHex, ratios, { colorSpace = 'OKLCH', gamut = 'clip' } = {}) {
  const interpolate = INTERPOLATE[colorSpace], out = OUT[gamut];
  if (!interpolate) throw new Error(`Leonardo colour space “${colorSpace}” not supported`);
  if (!out) throw new Error(`gamut “${gamut}” not supported`);
  const lerp = (a, b, f) => interpolate(a, b, f, out);
  // Color._updateColorSaturation (saturation 100): the key goes through OKLCH and back
  const key = parseHex(toHex(clip(oklch2rgb(...rgb2oklch(parseHex(seedHex))))));
  // createScale: white, key, black on a 3000-swatch domain, the key placed by its CIECAM02 J
  const swatches = 3000;
  const pos = [0, (swatches - swatches * (camJ(key) / 100)) / swatches, 1];
  const stops = [WHITE, key, BLACK];
  // chroma.scale(...).domain(...).mode(...): t quantised by its cache, one colour per 1/10000
  const cache = {};
  const scale = v => {
    const t = min(max(0, v / swatches), 1);
    const k = floor(t * 10000);
    if (cache[k]) return cache[k];
    let col;
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i];
      if (t <= p) { col = stops[i]; break; }
      if (t >= p && i === pos.length - 1) { col = stops[i]; break; }
      if (t > p && t < pos[i + 1]) { col = lerp(stops[i], stops[i + 1], (t - p) / (pos[i + 1] - p)); break; }
    }
    return (cache[k] = col);
  };
  // searchColors
  const ccache = {};
  const contrastAt = i => ccache[i] || (ccache[i] = contrastOnWhite(scale(i).map(round)));
  const search = x => {
    const first = contrastAt(0), last = contrastAt(swatches), dir = first < last ? 1 : -1, eps = 0.01;
    x += 0.005 * sign(x);
    let step = swatches / 2, dot = step, val = contrastAt(dot), counter = 100;
    while (abs(val - x) > eps && counter) {
      counter--;
      step /= 2;
      if (val < x) dot += step * dir; else dot -= step * dir;
      val = contrastAt(dot);
    }
    return roundTo(dot, 3);
  };
  return ratios.map(r => toHex(scale(search(multiplyRatios(+r, 1)))));
}
