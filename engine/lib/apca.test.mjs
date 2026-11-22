/**
 * Tests for ./apca.mjs — APCA 0.0.98G-4g.
 *
 * Run:  node lib/apca.test.mjs
 *
 * Covers the apca-w3 reference vectors, the polarity branches, the loClip
 * dead zone, the deltaYmin guard, the black soft clamp, and the band helpers.
 */

import assert from 'node:assert/strict';
import {
  apcaLc,
  apcaBand,
  apcaMinFontSize,
  sRGBtoY,
  parseHex,
  APCAcontrast,
} from './apca.mjs';

const TOL = 0.1; // Lc

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  FAIL ${name}\n       ${err.message.split('\n')[0]}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/* ====================================================================== *
 * 1. apca-w3 reference vectors
 * ====================================================================== */

// format: [textHex, bgHex, expectedLc]
const REFERENCE_VECTORS = [
  ['#888888', '#ffffff', 63.056],
  ['#ffffff', '#888888', -68.545],
  ['#000000', '#aaaaaa', 58.146],
  ['#aaaaaa', '#000000', -56.245],
  ['#123456', '#abcdef', 68.849], // <- see DISPUTED section below
  ['#abcdef', '#123456', -68.117],
  ['#000000', '#ffffff', 106.041],
  ['#ffffff', '#000000', -107.883],
];

/**
 * One vector in the list above is not reachable by ANY implementation of
 * 0.0.98G-4g: it contradicts its own sibling vector (proof in section 2).
 * It is tracked here so the suite reports it loudly instead of hiding it,
 * without asserting something known to be unsatisfiable.
 */
const DISPUTED = new Set(['#123456|#abcdef']);

section('1. apca-w3 reference vectors (tolerance 0.1 Lc)');

let maxDeviation = 0;
let maxDeviationAt = '';
const deviations = [];

for (const [txt, bg, expected] of REFERENCE_VECTORS) {
  const key = `${txt}|${bg}`;
  const got = apcaLc(txt, bg);
  const dev = Math.abs(got - expected);
  deviations.push({ txt, bg, expected, got, dev, disputed: DISPUTED.has(key) });

  if (!DISPUTED.has(key)) {
    if (dev > maxDeviation) {
      maxDeviation = dev;
      maxDeviationAt = `${txt} on ${bg}`;
    }
    test(`apcaLc('${txt}', '${bg}') = ${expected} (got ${got.toFixed(4)}, dev ${dev.toFixed(4)})`, () => {
      assert.ok(dev <= TOL, `expected ${expected} +/- ${TOL}, got ${got} (deviation ${dev})`);
    });
  }
}

/* ====================================================================== *
 * 2. The disputed vector — proof, not adjustment
 * ====================================================================== */

section('2. DISPUTED vector #123456 / #abcdef');

/*
 * The vector list asserts BOTH:
 *     apcaLc('#123456', '#abcdef') =  68.849   (BoW branch)
 *     apcaLc('#abcdef', '#123456') = -68.117   (WoB branch)
 *
 * Both branches consume the same two luminances, so the pair over-determines
 * them. Inverting each equation:
 *
 *   from  68.849, holding Y(#abcdef): Y(#123456) must be 0.017622
 *   from -68.117, holding Y(#abcdef): Y(#123456) must be 0.021372
 *
 * Those disagree. The actual sRGB luminance of #123456 is 0.0214256
 * (0.0214518 after the black soft clamp), i.e. it matches the REVERSE
 * expectation to 5 decimal places and refutes the forward one. So the
 * implementation is right and the 68.849 figure is a bad reference value;
 * the true 0.0.98G-4g result is 67.4958.
 */

const BLK_THRS = 0.022;
const BLK_CLMP = 1.414;
const softClamp = (y) => (y > BLK_THRS ? y : y + Math.pow(BLK_THRS - y, BLK_CLMP));

const yDark = softClamp(sRGBtoY(parseHex('#123456')));
const yLight = softClamp(sRGBtoY(parseHex('#abcdef')));

test('Y(#123456) sits just below blackThreshold, so the soft clamp applies', () => {
  assert.ok(sRGBtoY(parseHex('#123456')) < BLK_THRS, 'expected raw Y < 0.022');
  assert.ok(Math.abs(sRGBtoY(parseHex('#123456')) - 0.0214256) < 1e-6);
  assert.ok(Math.abs(yDark - 0.0214518) < 1e-6);
});

test('forward 68.849 requires Y(#123456) = 0.017622, reverse -68.117 requires 0.021372', () => {
  const impliedByForward = Math.pow(Math.pow(yLight, 0.56) - (0.68849 + 0.027) / 1.14, 1 / 0.57);
  const impliedByReverse = Math.pow((-0.68117 - 0.027) / 1.14 + Math.pow(yLight, 0.62), 1 / 0.65);
  assert.ok(Math.abs(impliedByForward - 0.017622) < 1e-5, `forward implies ${impliedByForward}`);
  assert.ok(Math.abs(impliedByReverse - 0.021372) < 1e-5, `reverse implies ${impliedByReverse}`);
  // They are irreconcilable: no single colour satisfies both.
  assert.ok(Math.abs(impliedByForward - impliedByReverse) > 0.003);
  // And the real luminance is the one the reverse vector implies.
  assert.ok(Math.abs(yDark - impliedByReverse) < 1e-4);
  assert.ok(Math.abs(yDark - impliedByForward) > 0.003);
});

test('any colour pair matching the reverse vector forces forward Lc into [67.4, 67.6]', () => {
  // Sweep the dark colour; keep the light one at #abcdef.
  let lo = Infinity;
  let hi = -Infinity;
  for (let r = 0; r < 256; r += 1) {
    for (let g = 0; g < 256; g += 5) {
      for (let b = 0; b < 256; b += 5) {
        const hex =
          '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
        if (Math.abs(apcaLc('#abcdef', hex) + 68.117) < 0.05) {
          const fwd = apcaLc(hex, '#abcdef');
          if (fwd < lo) lo = fwd;
          if (fwd > hi) hi = fwd;
        }
      }
    }
  }
  assert.ok(lo > 67.4 && hi < 67.6, `forced range was [${lo}, ${hi}]`);
  assert.ok(!(68.849 >= lo && 68.849 <= hi), '68.849 must be outside the forced range');
});

test("apcaLc('#123456', '#abcdef') is 67.4958 per the algorithm", () => {
  const got = apcaLc('#123456', '#abcdef');
  assert.ok(Math.abs(got - 67.4958) < 0.01, `got ${got}`);
});

/* ====================================================================== *
 * 3. Polarity
 * ====================================================================== */

section('3. Polarity (sign) and asymmetry');

test('dark text on light bg is positive', () => {
  assert.ok(apcaLc('#000000', '#ffffff') > 0);
  assert.ok(apcaLc('#222222', '#dddddd') > 0);
  assert.ok(apcaLc('#123456', '#abcdef') > 0);
});

test('light text on dark bg is negative', () => {
  assert.ok(apcaLc('#ffffff', '#000000') < 0);
  assert.ok(apcaLc('#dddddd', '#222222') < 0);
  assert.ok(apcaLc('#abcdef', '#123456') < 0);
});

test('polarity is asymmetric: |Lc| differs when swapped', () => {
  const bow = Math.abs(apcaLc('#000000', '#ffffff'));
  const wob = Math.abs(apcaLc('#ffffff', '#000000'));
  assert.ok(Math.abs(bow - wob) > 1, `expected asymmetry, got ${bow} vs ${wob}`);
});

/* ====================================================================== *
 * 4. Identity -> exactly 0
 * ====================================================================== */

section('4. Identical colours');

for (const hex of ['#000000', '#ffffff', '#888888', '#123456', '#abcdef', '#7f3ac1']) {
  test(`apcaLc('${hex}', '${hex}') === 0`, () => {
    const v = apcaLc(hex, hex);
    assert.strictEqual(v, 0);
    assert.ok(Object.is(v, 0), 'must be +0, not -0');
  });
}

test('case and shorthand forms are equivalent', () => {
  assert.strictEqual(apcaLc('#FFF', '#000'), apcaLc('#ffffff', '#000000'));
  assert.strictEqual(apcaLc('FFFFFF', '000000'), apcaLc('#ffffff', '#000000'));
  assert.strictEqual(apcaLc('#ABCDEF', '#123456'), apcaLc('#abcdef', '#123456'));
});

/* ====================================================================== *
 * 5. loClip dead zone -> exactly 0
 * ====================================================================== */

section('5. loClip dead zone (|SAPC| < 0.1 clips to exactly 0)');

// Each of these has clamped |deltaY| far above deltaYmin (0.0005), so it is
// genuinely the loClip branch firing, not the deltaYmin guard.
const DEAD_ZONE = [
  ['#3d3d3d', '#555555'], // SAPC  0.09931 / -0.09989 : right at the clip edge
  ['#767676', '#7a7a7a'],
  ['#c0c0c0', '#c8c8c8'],
  ['#334455', '#374a5c'],
  ['#e8e8e8', '#eeeeee'],
  ['#556677', '#5a6d80'],
  ['#fefefe', '#ffffff'],
];

for (const [dark, light] of DEAD_ZONE) {
  test(`dead zone ${dark} / ${light} clips to 0 in both polarities`, () => {
    const dY = Math.abs(softClamp(sRGBtoY(parseHex(dark))) - softClamp(sRGBtoY(parseHex(light))));
    assert.ok(dY >= 0.0005, `deltaY ${dY} must clear deltaYmin so this is the loClip branch`);
    assert.strictEqual(apcaLc(dark, light), 0);
    assert.strictEqual(apcaLc(light, dark), 0);
  });
}

test('loClip creates a discontinuity: no output lands in (0, 7.29)', () => {
  // Minimum representable non-zero output is (loClip - offset) * 100 = 7.3 Lc.
  let violations = 0;
  let smallestNonZero = Infinity;
  for (let a = 0; a < 256; a += 1) {
    for (let b = 0; b < 256; b += 1) {
      const hx = (v) => '#' + v.toString(16).padStart(2, '0').repeat(3);
      for (const v of [apcaLc(hx(a), hx(b)), apcaLc(hx(b), hx(a))]) {
        const abs = Math.abs(v);
        if (abs > 0 && abs < 7.29) violations++;
        if (abs > 0 && abs < smallestNonZero) smallestNonZero = abs;
      }
    }
  }
  assert.strictEqual(violations, 0, `${violations} outputs fell inside the dead zone`);
  assert.ok(smallestNonZero >= 7.29 && smallestNonZero < 8, `smallest non-zero Lc was ${smallestNonZero}`);
});

/* ====================================================================== *
 * 6. deltaYmin guard and black soft clamp
 * ====================================================================== */

section('6. deltaYmin guard and black soft clamp');

test('near-identical luminances hit the deltaYmin guard and return 0', () => {
  for (const [a, b] of [['#000000', '#010101'], ['#000000', '#040404'], ['#020202', '#030303']]) {
    const dY = Math.abs(sRGBtoY(parseHex(a)) - sRGBtoY(parseHex(b)));
    assert.ok(dY < 0.0005, `${a}/${b} deltaY ${dY} should be under deltaYmin`);
    assert.strictEqual(apcaLc(a, b), 0);
    assert.strictEqual(apcaLc(b, a), 0);
  }
});

// Added by adversarial audit: the guard above only pins deltaYmin from BELOW,
// and loClip zeroes those pairs anyway, so it cannot detect a deltaYmin that is
// far too LARGE. These pairs have a small clamped deltaY (0.025-0.032, i.e. well
// inside a mistakenly-inflated guard) yet a genuinely non-zero Lc, so they pin
// deltaYmin from above. Without this, deltaYmin = 0.05 passes the whole suite.
test('deltaYmin does not swallow small-but-real luminance differences', () => {
  const cases = [
    ['#000000', '#3b3b3b', 7.9826],
    ['#000000', '#404040', 9.8243],
    ['#3d3d3d', '#000000', -7.4536],
  ];
  for (const [txt, bg, expected] of cases) {
    const dY = Math.abs(softClamp(sRGBtoY(parseHex(txt))) - softClamp(sRGBtoY(parseHex(bg))));
    assert.ok(dY < 0.04, `${txt}/${bg} clamped deltaY ${dY} should be small`);
    const got = apcaLc(txt, bg);
    assert.notStrictEqual(got, 0, `${txt} on ${bg} was zeroed; deltaYmin is too large`);
    assert.ok(Math.abs(got - expected) < 0.01, `${txt} on ${bg}: expected ~${expected}, got ${got}`);
  }
});

test('black soft clamp lifts sub-threshold luminance', () => {
  // Y = 0 -> 0.022^1.414 = 0.00452...
  assert.ok(Math.abs(softClamp(0) - Math.pow(0.022, 1.414)) < 1e-12);
  assert.ok(Math.abs(softClamp(0) - 0.0045309) < 1e-6);
  // Above the threshold nothing changes.
  assert.strictEqual(softClamp(0.5), 0.5);
});

test('APCAcontrast rejects out-of-range luminance', () => {
  assert.strictEqual(APCAcontrast(-0.1, 1.0), 0);
  assert.strictEqual(APCAcontrast(0.0, 1.5), 0);
  assert.strictEqual(APCAcontrast(NaN, 1.0), 0);
});

test('sRGBtoY matches hand-computed values', () => {
  assert.ok(Math.abs(sRGBtoY([255, 255, 255]) - 1.0) < 1e-6);
  assert.strictEqual(sRGBtoY([0, 0, 0]), 0);
  assert.ok(Math.abs(sRGBtoY([136, 136, 136]) - 0.2212060) < 1e-6);
});

test('parseHex handles 3/6/8-digit and rejects rubbish', () => {
  assert.deepStrictEqual(parseHex('#abcdef'), [171, 205, 239]);
  assert.deepStrictEqual(parseHex('#abc'), [170, 187, 204]);
  assert.deepStrictEqual(parseHex('#abcdef80'), [171, 205, 239]);
  assert.throws(() => parseHex('#xyz'), TypeError);
  assert.throws(() => parseHex('#12345'), TypeError);
  assert.throws(() => parseHex(null), TypeError);
});

/* ====================================================================== *
 * 7. Bands
 * ====================================================================== */

section('7. apcaBand / apcaMinFontSize');

test('band thresholds are inclusive at the boundary', () => {
  assert.strictEqual(apcaBand(90), 'corps de texte optimal (jusqu’à 14 px)');
  assert.strictEqual(apcaBand(75), 'minimum corps de texte (>= 16 px, ou 12 px bold)');
  assert.strictEqual(apcaBand(60), 'minimum texte fluide (>= 24 px, ou 16 px semi-bold)');
  assert.strictEqual(apcaBand(45), 'titres larges (>= 36 px, ou >= 24 px bold)');
  assert.strictEqual(apcaBand(30), 'texte non essentiel / placeholders');
  assert.strictEqual(apcaBand(15), 'éléments non textuels discernables uniquement');
  assert.strictEqual(apcaBand(14.999), 'insuffisant pour tout usage');
  assert.strictEqual(apcaBand(0), 'insuffisant pour tout usage');
});

test('band just below each boundary falls to the next band down', () => {
  assert.strictEqual(apcaBand(89.999), 'minimum corps de texte (>= 16 px, ou 12 px bold)');
  assert.strictEqual(apcaBand(74.999), 'minimum texte fluide (>= 24 px, ou 16 px semi-bold)');
  assert.strictEqual(apcaBand(59.999), 'titres larges (>= 36 px, ou >= 24 px bold)');
  assert.strictEqual(apcaBand(44.999), 'texte non essentiel / placeholders');
  assert.strictEqual(apcaBand(29.999), 'éléments non textuels discernables uniquement');
});

test('band ignores polarity (uses |Lc|)', () => {
  assert.strictEqual(apcaBand(-106.04), apcaBand(106.04));
  assert.strictEqual(apcaBand(-63.06), apcaBand(63.06));
  assert.strictEqual(apcaBand(apcaLc('#ffffff', '#000000')), 'corps de texte optimal (jusqu’à 14 px)');
});

test('bands carry French accents', () => {
  assert.ok(apcaBand(95).includes('jusqu’à'));
  assert.ok(apcaBand(20).startsWith('éléments'));
});

test('apcaMinFontSize', () => {
  assert.strictEqual(apcaMinFontSize(106.04), '14 px');
  assert.strictEqual(apcaMinFontSize(90), '14 px');
  assert.strictEqual(apcaMinFontSize(-75), '16 px');
  assert.strictEqual(apcaMinFontSize(60.1), '24 px');
  assert.strictEqual(apcaMinFontSize(45), '36 px');
  assert.strictEqual(apcaMinFontSize(44.9), null);
  assert.strictEqual(apcaMinFontSize(0), null);
  assert.strictEqual(apcaMinFontSize(NaN), null);
});

/* ====================================================================== *
 * Report
 * ====================================================================== */

console.log('\n--- reference vector deviations ---');
for (const d of deviations) {
  const flag = d.disputed ? '  <-- DISPUTED, see section 2' : '';
  console.log(
    `  ${d.txt} on ${d.bg}  expected ${String(d.expected).padStart(8)}  got ${d.got
      .toFixed(4)
      .padStart(9)}  dev ${d.dev.toFixed(4)}${flag}`
  );
}
console.log(
  `\nmax deviation across satisfiable vectors: ${maxDeviation.toFixed(4)} Lc (at ${maxDeviationAt})`
);

const disputedRow = deviations.find((d) => d.disputed);
if (disputedRow) {
  console.log(
    '\nWARNING: the reference value ' +
      `${disputedRow.expected} for ${disputedRow.txt} on ${disputedRow.bg} is unsatisfiable.\n` +
      `  This implementation returns ${disputedRow.got.toFixed(4)} (deviation ${disputedRow.dev.toFixed(4)}).\n` +
      '  Section 2 proves no 0.0.98G-4g implementation can produce both it and the\n' +
      `  sibling vector ${disputedRow.bg} on ${disputedRow.txt} = -68.117, which this code matches to 0.0227.`
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ${f.name}\n    ${f.err.message}`);
  process.exit(1);
}
