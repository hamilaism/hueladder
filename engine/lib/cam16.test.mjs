/**
 * Tests for cam16.mjs — validated against material-color-utilities reference
 * values. Run with:  node lib/cam16.test.mjs
 */

import { hctFromHex, hctToHex } from './cam16.mjs';

let failures = 0;
let checks = 0;

function ok(condition, message) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  FAIL  ${message}`);
  }
}

function close(actual, expected, tol, label) {
  const delta = Math.abs(actual - expected);
  ok(
    delta <= tol,
    `${label}: got ${actual.toFixed(4)}, expected ${expected} (+/-${tol}), delta ${delta.toFixed(4)}`,
  );
  return delta;
}

function hueDelta(a, b) {
  let d = Math.abs(((a - b) % 360) + 360) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// ---------------------------------------------------------------------------
// 1. Forward transform vs material-color-utilities reference values
// ---------------------------------------------------------------------------

console.log('--- hctFromHex vs material-color-utilities ---');

const FORWARD = [
  ['#ff0000', 27.408, 113.357, 53.237],
  ['#00ff00', 142.139, 108.41, 87.737],
  ['#0000ff', 282.788, 87.23, 32.302],
];

let worstFwdHue = 0;
let worstFwdChroma = 0;
let worstFwdTone = 0;

for (const [hex, h, c, t] of FORWARD) {
  const got = hctFromHex(hex);
  console.log(
    `  ${hex}  h=${got.h.toFixed(3)} c=${got.c.toFixed(3)} t=${got.t.toFixed(3)}` +
      `   (ref h=${h} c=${c} t=${t})`,
  );
  worstFwdHue = Math.max(worstFwdHue, close(got.h, h, 0.5, `${hex} hue`));
  worstFwdChroma = Math.max(worstFwdChroma, close(got.c, c, 0.5, `${hex} chroma`));
  worstFwdTone = Math.max(worstFwdTone, close(got.t, t, 0.3, `${hex} tone`));
}

const white = hctFromHex('#ffffff');
console.log(
  `  #ffffff  h=${white.h.toFixed(3)} c=${white.c.toFixed(3)} t=${white.t.toFixed(3)}`,
);
worstFwdTone = Math.max(worstFwdTone, close(white.t, 100.0, 0.3, '#ffffff tone'));
ok(white.c < 3, `#ffffff chroma should be < 3, got ${white.c.toFixed(4)}`);

const black = hctFromHex('#000000');
console.log(
  `  #000000  h=${black.h.toFixed(3)} c=${black.c.toFixed(3)} t=${black.t.toFixed(3)}`,
);
worstFwdTone = Math.max(worstFwdTone, close(black.t, 0.0, 0.3, '#000000 tone'));

console.log(
  `  worst forward deviation: hue ${worstFwdHue.toFixed(4)} deg, ` +
    `chroma ${worstFwdChroma.toFixed(4)}, tone ${worstFwdTone.toFixed(4)} L*`,
);

// ---------------------------------------------------------------------------
// 2. Round trip + tone guarantee across the tonal-palette grid
// ---------------------------------------------------------------------------

console.log('\n--- round trip: hctToHex(h, c, tone) tone + hue guarantee ---');

const SEEDS = ['#ff0000', '#0000ff', '#12b76a', '#ff9e2a', '#553eff', '#0f172a'];
const TONES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];
const HEX_RE = /^#[0-9a-f]{6}$/;

let worstToneErr = 0;
let worstToneWhere = '';
let worstHueErr = 0;
let worstHueWhere = '';
let hueChecked = 0;
let hueSkipped = 0;

for (const seed of SEEDS) {
  const { h, c } = hctFromHex(seed);
  const row = [];
  for (const tone of TONES) {
    const out = hctToHex(h, c, tone);
    ok(HEX_RE.test(out), `${seed}@${tone}: '${out}' is not a valid 7-char hex`);

    const back = hctFromHex(out);
    const toneErr = Math.abs(back.t - tone);
    ok(
      toneErr <= 0.5,
      `${seed}@${tone}: tone error ${toneErr.toFixed(4)} > 0.5 (got ${back.t.toFixed(3)}) [${out}]`,
    );
    if (toneErr > worstToneErr) {
      worstToneErr = toneErr;
      worstToneWhere = `${seed} @ tone ${tone} -> ${out} (t=${back.t.toFixed(3)})`;
    }

    if (back.c > 5) {
      hueChecked++;
      const hErr = hueDelta(back.h, h);
      ok(
        hErr <= 4,
        `${seed}@${tone}: hue error ${hErr.toFixed(4)} deg > 4 (got ${back.h.toFixed(3)}, want ${h.toFixed(3)}) [${out}]`,
      );
      if (hErr > worstHueErr) {
        worstHueErr = hErr;
        worstHueWhere = `${seed} @ tone ${tone} -> ${out} (h=${back.h.toFixed(3)} vs ${h.toFixed(3)})`;
      }
    } else {
      hueSkipped++;
    }

    row.push(
      `${tone}:${out} t=${back.t.toFixed(2)} c=${back.c.toFixed(1)} h=${back.h.toFixed(1)}`,
    );
  }
  console.log(`  ${seed}  (h=${h.toFixed(2)} c=${c.toFixed(2)})`);
  for (const r of row) console.log(`     ${r}`);
}

console.log(
  `\n  worst tone error: ${worstToneErr.toFixed(4)} L*   [${worstToneWhere}]`,
);
console.log(
  `  worst hue error:  ${worstHueErr.toFixed(4)} deg  [${worstHueWhere || 'n/a'}]`,
);
console.log(
  `  hue checked on ${hueChecked} samples, skipped ${hueSkipped} (chroma <= 5)`,
);

// ---------------------------------------------------------------------------
// 3. Extra sanity: exact round trip of in-gamut colours, and edge tones
// ---------------------------------------------------------------------------

console.log('\n--- extra sanity ---');

ok(hctToHex(0, 50, 0) === '#000000', 'tone 0 -> #000000');
ok(hctToHex(0, 50, 100) === '#ffffff', 'tone 100 -> #ffffff');

let worstSelfHue = 0;
let worstSelfChroma = 0;
let worstSelfTone = 0;
for (const seed of [...SEEDS, '#808080', '#123456', '#fedcba', '#00ffff', '#ff00ff']) {
  const { h, c, t } = hctFromHex(seed);
  const out = hctToHex(h, c, t);
  const back = hctFromHex(out);
  worstSelfTone = Math.max(worstSelfTone, Math.abs(back.t - t));
  if (c > 5) {
    worstSelfHue = Math.max(worstSelfHue, hueDelta(back.h, h));
    worstSelfChroma = Math.max(worstSelfChroma, Math.abs(back.c - c));
  }
  ok(
    Math.abs(back.t - t) <= 0.5,
    `self round trip ${seed} -> ${out}: tone drift ${Math.abs(back.t - t).toFixed(4)}`,
  );
}
console.log(
  `  self round trip worst: tone ${worstSelfTone.toFixed(4)} L*, ` +
    `hue ${worstSelfHue.toFixed(4)} deg, chroma ${worstSelfChroma.toFixed(4)}`,
);

// Monotonic-ish: requesting more chroma than sRGB can hold must still be valid.
const huge = hctToHex(27.4, 200, 50);
ok(HEX_RE.test(huge), `over-saturated request returned invalid hex: ${huge}`);
const hugeBack = hctFromHex(huge);
ok(
  Math.abs(hugeBack.t - 50) <= 0.5,
  `over-saturated request tone drift ${Math.abs(hugeBack.t - 50).toFixed(4)}`,
);
console.log(
  `  hctToHex(27.4, 200, 50) = ${huge}  -> h=${hugeBack.h.toFixed(2)} c=${hugeBack.c.toFixed(2)} t=${hugeBack.t.toFixed(2)}`,
);

// ---------------------------------------------------------------------------

console.log(
  `\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks - failures}/${checks} assertions passed.`,
);
if (failures > 0) process.exit(1);
