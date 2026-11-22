/**
 * Tests for ./deltae.mjs
 *
 * Reference data: Table 1 of
 *   G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference Formula:
 *   Implementation Notes, Supplementary Test Data, and Mathematical
 *   Observations", Color Research and Application, 30(1), 2005, pp. 21-30.
 *
 * Run with:  node deltae.test.mjs
 */

import { deltaE2000, deltaE2000Hex, hexToLab } from './deltae.mjs';

const TOL = 1e-4;

// [L1, a1, b1, L2, a2, b2, expected dE00]
const SHARMA_PAIRS = [
  [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
  [50, 3.1571, -77.2803, 50, 0, -82.7485, 2.8615],
  [50, 2.8361, -74.0200, 50, 0, -82.7485, 3.4412],
  [50, -1.3802, -84.2814, 50, 0, -82.7485, 1.0000],
  [50, -1.1848, -84.8006, 50, 0, -82.7485, 1.0000],
  [50, -0.9009, -85.5211, 50, 0, -82.7485, 1.0000],
  [50, 0, 0, 50, -1, 2, 2.3669],
  [50, -1, 2, 50, 0, 0, 2.3669],
  [50, 2.4900, -0.0010, 50, -2.4900, 0.0009, 7.1792],
  [50, 2.4900, -0.0010, 50, -2.4900, 0.0010, 7.1792],
  [50, 2.4900, -0.0010, 50, -2.4900, 0.0011, 7.2195],
  [50, 2.4900, -0.0010, 50, -2.4900, 0.0012, 7.2195],
  [50, -0.0010, 2.4900, 50, 0.0009, -2.4900, 4.8045],
  [50, 2.5, 0, 50, 0, -2.5, 4.3065],
  [50, 2.5, 0, 73, 25, -18, 27.1492],
  [50, 2.5, 0, 61, -5, 29, 22.8977],
  [50, 2.5, 0, 56, -27, -3, 31.9030],
  [50, 2.5, 0, 58, 24, 15, 19.4535],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.2630],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.2480, -4.9620, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.6940, 23.0331, 14.9730, -42.5619, 2.0373],
  [2.0776, 0.0795, -1.1350, 0.9033, -0.0636, -0.5514, 0.9082],
];

let failures = 0;
let checks = 0;
// Tracked only over the Sharma et al. reference vectors, so the reported
// number is "deviation from published dE00", not from any incidental check.
let maxDev = 0;
let maxDevLabel = '';
let trackingReference = false;

function assertClose(label, actual, expected, tol = TOL) {
  checks += 1;
  const dev = Math.abs(actual - expected);
  if (trackingReference && dev > maxDev) {
    maxDev = dev;
    maxDevLabel = label;
  }
  if (!(dev <= tol)) {
    failures += 1;
    console.error(
      `FAIL ${label}\n     expected ${expected}  got ${actual}  |dev| ${dev.toExponential(3)} > ${tol}`
    );
  }
  return dev;
}

function assertTrue(label, cond, detail = '') {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.error(`FAIL ${label} ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Sharma et al. reference pairs
// ---------------------------------------------------------------------------
for (const [L1, a1, b1, L2, a2, b2, expected] of SHARMA_PAIRS) {
  const A = { L: L1, a: a1, b: b1 };
  const B = { L: L2, a: a2, b: b2 };
  const label = `(${L1},${a1},${b1}) vs (${L2},${a2},${b2})`;

  trackingReference = true;
  const dev = assertClose(label, deltaE2000(A, B), expected);
  trackingReference = false;

  // Symmetry: dE00 is symmetric in its arguments.
  assertClose(`${label} [symmetry]`, deltaE2000(B, A), deltaE2000(A, B), 1e-12);

  if (process.env.VERBOSE) {
    console.log(
      `  ${label} -> ${deltaE2000(A, B).toFixed(6)} (expected ${expected}, dev ${dev.toExponential(2)})`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Identity / self-difference
// ---------------------------------------------------------------------------
assertClose('identity (50,2.5,0)', deltaE2000({ L: 50, a: 2.5, b: 0 }, { L: 50, a: 2.5, b: 0 }), 0, 0);
assertClose('identity (0,0,0)', deltaE2000({ L: 0, a: 0, b: 0 }, { L: 0, a: 0, b: 0 }), 0, 0);

// ---------------------------------------------------------------------------
// 3. Hex entry point
// ---------------------------------------------------------------------------
assertTrue(
  "deltaE2000Hex('#ffffff','#ffffff') === 0",
  deltaE2000Hex('#ffffff', '#ffffff') === 0,
  `got ${deltaE2000Hex('#ffffff', '#ffffff')}`
);
assertTrue(
  "deltaE2000Hex('#000000','#000000') === 0",
  deltaE2000Hex('#000000', '#000000') === 0,
  `got ${deltaE2000Hex('#000000', '#000000')}`
);

const redGreen = deltaE2000Hex('#ff0000', '#00ff00');
assertTrue(
  "deltaE2000Hex('#ff0000','#00ff00') > 50",
  redGreen > 50,
  `got ${redGreen}`
);

// Sanity checks on the sRGB -> Lab conversion itself.
const white = hexToLab('#ffffff');
assertClose('hexToLab(#ffffff).L', white.L, 100, 1e-3);
assertClose('hexToLab(#ffffff).a', white.a, 0, 1e-2);
assertClose('hexToLab(#ffffff).b', white.b, 0, 1e-2);

const black = hexToLab('#000000');
assertClose('hexToLab(#000000).L', black.L, 0, 1e-12);

// Mid grey #808080 -> L* ~ 53.585
assertClose('hexToLab(#808080).L', hexToLab('#808080').L, 53.5850, 1e-3);

// Hex parsing is case-insensitive and shorthand-tolerant.
assertClose(
  'hex case-insensitivity',
  deltaE2000Hex('#FF0000', '#ff0000'),
  0,
  0
);
assertClose('hex shorthand #f00 == #ff0000', deltaE2000Hex('#f00', '#ff0000'), 0, 0);

// A small, perceptible-but-close pair should land in a plausible range.
const nearPair = deltaE2000Hex('#3b82f6', '#3c83f7');
assertTrue(
  'near-identical hex pair yields small dE',
  nearPair > 0 && nearPair < 1,
  `got ${nearPair}`
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(
  `\n${checks - failures}/${checks} assertions passed ` +
    `(${SHARMA_PAIRS.length} Sharma et al. vectors, tolerance ${TOL})`
);
console.log(
  `max deviation vs reference: ${maxDev.toExponential(4)} dE units  [${maxDevLabel}]`
);
console.log(`deltaE2000Hex('#ff0000','#00ff00') = ${redGreen}`);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('ALL TESTS PASSED');
