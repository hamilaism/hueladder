/**
 * colorshades.mjs — David Fusilier's color-shades, without dependencies.
 *
 * A port of color-shades (https://github.com/dfusilier/color-shades; Copyright (c) 2022 David
 * Fusilier, MIT): what its "More shades" section does for a palette, that is
 * `createInterpolants(color).setLightness`, `suggestShades` and `suggestColor` (a binary search
 * on HSL lightness, keeping the starting colour's HSL hue and saturation, until the contrast
 * against black is between the target and the target + 0.005) and `shadeToContrast`; and of the
 * colorjs.io 0.4.1-patch.1 code it runs on (HSL ↔ sRGB, the sRGB transfer function, the
 * sRGB → XYZ matrix, `contrastWCAG21`, hex serialisation; Copyright (c) 2021 Lea Verou, Chris
 * Lilley, MIT). Changes: one file, no dependencies, 6-digit hex. With its default settings
 * (no hStart, hEnd, sStart, sEnd), color-shades' monotone spline interpolates three equal values,
 * so hue and saturation are constants here; for a black or white seed (HSL lightness 0 or 100)
 * its spline divides by zero, and this port keeps the constants. The output matches color-shades
 * to the hex (engine/conformance). See THIRD_PARTY_NOTICES.md.
 *
 * colorShades(seed, shades) → one hex per shade (0 = black … 200 = white).
 */

// colorjs.io 0.4.1: hsl.fromBase
function srgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = NaN, s = 0;
  const l = (min + max) / 2, d = max - min;
  if (d !== 0) {
    s = (l === 0 || l === 1) ? 0 : (max - l) / Math.min(l, 1 - l);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4;
    }
    h = h * 60;
  }
  return [h, s * 100, l * 100];
}

// colorjs.io 0.4.1: ColorSpace#to turns NaN into 0, then hsl.toBase
function hslToSrgb(hsl) {
  let [h, s, l] = hsl.map(c => (Number.isNaN(c) ? 0 : c));
  h = h % 360;
  if (h < 0) h += 360;
  s /= 100; l /= 100;
  const f = n => {
    const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

// colorjs.io 0.4.1: srgb.toBase, then srgb-linear's row of toXYZ_M, summed as multiplyMatrices does
const linear = val => {
  const sign = val < 0 ? -1 : 1, abs = val * sign;
  return abs < 0.04045 ? val / 12.92 : sign * (((abs + 0.055) / 1.055) ** 2.4);
};
const Y_ROW = [0.21263900587151027, 0.715168678767756, 0.07219231536073371];
function luminance(rgb) {
  let y = 0;
  for (let i = 0; i < 3; i++) y += Y_ROW[i] * (linear(rgb[i]) || 0);
  return y;
}

// colorjs.io 0.4.1: contrastWCAG21(black, colour); black's luminance is 0
const contrastWithBlack = rgb => {
  let Y1 = 0, Y2 = Math.max(luminance(rgb), 0);
  if (Y2 > Y1) [Y1, Y2] = [Y2, Y1];
  return (Y1 + 0.05) / (Y2 + 0.05);
};

// colorjs.io 0.4.1: srgb "hex" serialisation (in gamut by construction: an HSL colour is sRGB)
const toHex = rgb => '#' + rgb.map(c => Math.round((c || 0) * 255).toString(16).padStart(2, '0')).join('');

// color-shades: shadeToContrast
export const shadeToContrast = shade => Math.exp((shade / 200) * Math.log(21));

// color-shades: suggestColor, targetIsMin = false, recursion written as a loop
function suggestColor(manipulation, target, tolerance = 0.005) {
  const start = manipulation(0), initial = contrastWithBlack(start);
  if (initial === target) return start;
  const goalIsIncrease = initial < target;
  let low = 0, high = 100;
  for (let iteration = 0; ; iteration++) {
    const median = (low + high) / 2, color = manipulation(median), contrast = contrastWithBlack(color), loss = contrast - target;
    if (iteration >= 50) return undefined;
    if (loss >= 0 && loss <= tolerance) return color;
    if (contrast >= target) { if (goalIsIncrease) high = median; else low = median; }
    else if (goalIsIncrease) low = median; else high = median;
  }
}

/** The colours color-shades gives `seed` at each shade, by its "More shades" defaults. */
export function colorShades(seed, shades) {
  const rgb = [1, 3, 5].map(i => parseInt(seed.slice(i, i + 2), 16) / 255);
  let [hBase, sBase] = srgbToHsl(rgb);
  if (Number.isNaN(hBase)) hBase = 0;
  const setLightness = l => hslToSrgb([hBase, sBase, l]);
  return shades.map(shade => {
    const target = shadeToContrast(shade);
    if (target === 1) return '#000000';
    if (target === 21) return '#ffffff';
    const c = suggestColor(setLightness, target);
    return c ? toHex(c) : null;
  });
}
