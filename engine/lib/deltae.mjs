/**
 * CIEDE2000 colour-difference formula.
 *
 * Implemented from:
 *   G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference Formula:
 *   Implementation Notes, Supplementary Test Data, and Mathematical
 *   Observations", Color Research and Application, 30(1), 2005, pp. 21-30.
 *
 * Pure ESM, no dependencies.
 */

// ---------------------------------------------------------------------------
// Small trig helpers (the formula is specified in degrees).
// ---------------------------------------------------------------------------

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** cos of an angle given in degrees */
function cosd(deg) {
  return Math.cos(deg * DEG2RAD);
}

/** sin of an angle given in degrees */
function sind(deg) {
  return Math.sin(deg * DEG2RAD);
}

/** Normalise an angle in degrees into [0, 360). */
function normalizeDegrees(deg) {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/**
 * Hue angle h' in degrees, in [0, 360).
 * Sharma et al. eq. (7): h' is defined as 0 when both a' and b are zero
 * (atan2(0, 0) is 0 in IEEE-754 anyway, but the special case is explicit
 * so the intent is unambiguous).
 */
function huePrime(bComp, aPrime) {
  if (aPrime === 0 && bComp === 0) return 0;
  return normalizeDegrees(Math.atan2(bComp, aPrime) * RAD2DEG);
}

// 25^7, used by the G factor and by R_C.
const POW25_7 = 6103515625; // 25 ** 7

// ---------------------------------------------------------------------------
// CIEDE2000
// ---------------------------------------------------------------------------

/**
 * CIEDE2000 colour difference between two CIE L*a*b* colours (D65).
 *
 * Parametric weighting factors are fixed at kL = kC = kH = 1.
 *
 * @param {{L: number, a: number, b: number}} labA
 * @param {{L: number, a: number, b: number}} labB
 * @returns {number} deltaE 2000
 */
export function deltaE2000(labA, labB) {
  const L1 = labA.L;
  const a1 = labA.a;
  const b1 = labA.b;
  const L2 = labB.L;
  const a2 = labB.a;
  const b2 = labB.b;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  // --- Step 1: C', h' -------------------------------------------------------
  // (2) C*_ab
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);

  // (3) mean chroma of the pair
  const Cbar = (C1 + C2) / 2;

  // (4) G factor, boosting a* in the near-neutral region
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));

  // (5) a'
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  // (6) C'
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  // (7) h', in degrees, in [0, 360)
  const h1p = huePrime(b1, a1p);
  const h2p = huePrime(b2, a2p);

  // --- Step 2: dL', dC', dH' ------------------------------------------------
  // (8) dL'
  const dLp = L2 - L1;

  // (9) dC'
  const dCp = C2p - C1p;

  // (10) dh' — sign convention matters: the difference is taken as
  // (second - first) and wrapped into (-180, 180]. When either chroma is
  // zero the hue difference is defined to be 0.
  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) {
      dhp = diff;
    } else if (diff > 180) {
      dhp = diff - 360;
    } else {
      dhp = diff + 360;
    }
  }

  // (11) dH'
  const dHp = 2 * Math.sqrt(C1p * C2p) * sind(dhp / 2);

  // --- Step 3: the weighting functions and RT -------------------------------
  // (12) mean L'
  const Lbarp = (L1 + L2) / 2;

  // (13) mean C'
  const Cbarp = (C1p + C2p) / 2;

  // (14) mean h' — the wraparound case. When |h1' - h2'| > 180 the two hues
  // straddle the 0/360 discontinuity, so 360 is added or removed before
  // averaging; and when either chroma is zero the sum is used as-is (the
  // zero-chroma hue is meaningless and was set to 0).
  let hbarp;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  // (15) T
  const T =
    1 -
    0.17 * cosd(hbarp - 30) +
    0.24 * cosd(2 * hbarp) +
    0.32 * cosd(3 * hbarp + 6) -
    0.2 * cosd(4 * hbarp - 63);

  // (16) dTheta
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));

  // (17) R_C
  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW25_7));

  // (18) S_L
  const dL50 = (Lbarp - 50) * (Lbarp - 50);
  const SL = 1 + (0.015 * dL50) / Math.sqrt(20 + dL50);

  // (19) S_C
  const SC = 1 + 0.045 * Cbarp;

  // (20) S_H
  const SH = 1 + 0.015 * Cbarp * T;

  // (21) R_T
  const RT = -sind(2 * dTheta) * RC;

  // (22) dE00
  const termL = dLp / (kL * SL);
  const termC = dCp / (kC * SC);
  const termH = dHp / (kH * SH);

  return Math.sqrt(
    termL * termL + termC * termC + termH * termH + RT * termC * termH
  );
}

// ---------------------------------------------------------------------------
// sRGB -> Lab (D65)
// ---------------------------------------------------------------------------

/**
 * sRGB (IEC 61966-2-1) linear-light -> CIE XYZ, D65 adapted.
 * Row-major; rows are X, Y, Z.
 */
const SRGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];

/**
 * D65 reference white used for the Lab conversion.
 *
 * Derived as the row sums of SRGB_TO_XYZ rather than hard-coded, because the
 * reference white IS the XYZ of R=G=B=1 by definition. The published 7-digit
 * matrix does not sum exactly to (0.95047, 1, 1.08883) — its Y row sums to
 * 1.0000001 — so hard-coding the nominal white made pure white land at
 * L* = 100.0000039 and left greys with a*, b* of order 1e-5. Taking the white
 * from the matrix makes white exactly (100, 0, 0) and greys exactly neutral,
 * and it moves the primaries/secondaries *closer* to their published Lab
 * values (max deviation 4.82e-5 -> 3.65e-5).
 */
const D65 = {
  x: SRGB_TO_XYZ[0][0] + SRGB_TO_XYZ[0][1] + SRGB_TO_XYZ[0][2],
  y: SRGB_TO_XYZ[1][0] + SRGB_TO_XYZ[1][1] + SRGB_TO_XYZ[1][2],
  z: SRGB_TO_XYZ[2][0] + SRGB_TO_XYZ[2][1] + SRGB_TO_XYZ[2][2],
};

/**
 * Parse '#rrggbb' (also tolerates '#rgb' and a missing '#') into 0..255
 * integer channels.
 * @param {string} hex
 * @returns {{r: number, g: number, b: number}}
 */
export function parseHex(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError(`Expected a hex colour string, got ${typeof hex}`);
  }
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) {
    s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/** sRGB companding: 8-bit channel -> linear-light 0..1 */
function srgbToLinear(channel8) {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** CIE Lab f(t) */
function labF(t) {
  // (6/29)^3 = 216/24389
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27) * t / 116 + 16 / 116;
}

/**
 * Convert an '#rrggbb' sRGB colour to CIE L*a*b* (D65).
 * @param {string} hex
 * @returns {{L: number, a: number, b: number}}
 */
export function hexToLab(hex) {
  const { r, g, b } = parseHex(hex);

  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  // sRGB (IEC 61966-2-1) D65 primaries
  const X = SRGB_TO_XYZ[0][0] * R + SRGB_TO_XYZ[0][1] * G + SRGB_TO_XYZ[0][2] * B;
  const Y = SRGB_TO_XYZ[1][0] * R + SRGB_TO_XYZ[1][1] * G + SRGB_TO_XYZ[1][2] * B;
  const Z = SRGB_TO_XYZ[2][0] * R + SRGB_TO_XYZ[2][1] * G + SRGB_TO_XYZ[2][2] * B;

  const fx = labF(X / D65.x);
  const fy = labF(Y / D65.y);
  const fz = labF(Z / D65.z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * CIEDE2000 colour difference between two '#rrggbb' sRGB colours.
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number} deltaE 2000
 */
export function deltaE2000Hex(hexA, hexB) {
  return deltaE2000(hexToLab(hexA), hexToLab(hexB));
}

export default deltaE2000;
