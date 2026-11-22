import fs from 'node:fs';
const E = decodeURI(new URL('../../../engine', import.meta.url).pathname);
const { buildData } = await import(`${E}/lib/build.mjs`);
const { hexToRgb, rgbToLinear, linearToOklab } = await import(`${E}/lib/color.mjs`);
const { deltaE2000Hex } = await import(`${E}/lib/deltae.mjs`);
const { deriveDark } = await import(`${E}/lib/dark.mjs`);
const d = buildData(JSON.parse(fs.readFileSync(`${E}/brands/_template.json`)));
const ok = h => linearToOklab(rgbToLinear(hexToRgb(h)));
const dEok = (a, b) => { const A = ok(a), B = ok(b); return 100 * Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b); };
for (const r of Object.values(d.ramps)) {
  const L = r.colors[d.meta.coreMethod], D = deriveDark(L, { background: '#121212' }).map(s => s.hex);
  console.log(r.name, L.map((h, i) => `${d.meta.steps[i]} ΔEok ${dEok(h, '#ffffff').toFixed(0)}/${dEok(D[i], '#121212').toFixed(0)} ΔE00 ${deltaE2000Hex(h, '#ffffff').toFixed(0)}/${deltaE2000Hex(D[i], '#121212').toFixed(0)}`).filter((_, i) => [2, 5, 7, 9].includes(i)).join(' | '));
}
