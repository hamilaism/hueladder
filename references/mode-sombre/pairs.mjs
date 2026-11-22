import { hexToOklch, contrast, rgbToHex } from '../../engine/lib/color.mjs';
import { apcaLc } from '../../engine/lib/apca.mjs';
const rgb = s => { const [r,g,b] = s.match(/\d+/g).map(Number); return rgbToHex({r:r/255,g:g/255,b:b/255}); };
const rows = [
 ['Spectrum blue-900', rgb('59,99,251'), '#ffffff', rgb('86,129,255'), rgb('17,17,17')],
 ['Spectrum blue-1000', rgb('39,77,234'), '#ffffff', rgb('105,149,254'), rgb('17,17,17')],
 ['Spectrum red-900', rgb('215,50,32'), '#ffffff', rgb('252,67,46'), rgb('17,17,17')],
 ['Spectrum blue-800', rgb('75,117,255'), '#ffffff', rgb('64,105,253'), rgb('17,17,17')],
 ['Apple systemBlue (iOS 26)', rgb('0,136,255'), '#ffffff', rgb('0,145,255'), '#000000'],
 ['Apple systemRed', rgb('255,56,60'), '#ffffff', rgb('255,66,69'), '#000000'],
 ['Apple systemGreen', rgb('52,199,89'), '#ffffff', rgb('48,209,88'), '#000000'],
 ['Apple blue (iOS ≤18)', '#007aff', '#ffffff', '#0a84ff', '#000000'],
 ['M2 baseline primary 500→200', '#6200ee', '#ffffff', '#bb86fc', '#121212'],
 ['Primer fg.accent', '#0969da', '#ffffff', '#4493f8', '#0d1117'],
 ['Fluent brandForeground1 80→100', '#0f6cbd', '#ffffff', '#479ef5', '#292929'],
 ['Carbon link blue60→blue40 (g100)', '#0f62fe', '#ffffff', '#78a9ff', '#161616'],
 ['Carbon interactive blue60→blue50', '#0f62fe', '#ffffff', '#4589ff', '#161616'],
 ['Tailwind blue-600↔blue-400', '#155dfc', '#ffffff', '#51a2ff', '#101828'],
 ['Radix blue11 light/dark', '#0d74ce', '#fbfdff', '#70b8ff', '#0d1520'],
 ['Radix blue9 light/dark', '#0090ff', '#fbfdff', '#0090ff', '#0d1520'],
];
const f = h => { const o = hexToOklch(h); return `L${o.L.toFixed(3)} C${o.C.toFixed(3)} h${(o.H??0).toFixed(0)}`; };
for (const [n, l, lb, d, db] of rows) {
  const cl = hexToOklch(l).C, cd = hexToOklch(d).C;
  console.log(`${n.padEnd(34)} light ${l} ${f(l)} CR ${contrast(l,lb).toFixed(2)} Lc ${apcaLc(l,lb).toFixed(0)} | dark ${d} ${f(d)} CR ${contrast(d,db).toFixed(2)} Lc ${apcaLc(d,db).toFixed(0)} | C ratio ${(cd/cl).toFixed(2)}`);
}
import { clipChromaOk } from '../../engine/lib/color.mjs';
console.log('--- gamut occupancy (C / Cmax at same L,h in sRGB)');
for (const [n, l, , d] of rows) {
  const occ = h => { const o = hexToOklch(h); const m = clipChromaOk(o.L, 0.5, o.H); const cm = (m.C ?? m[1] ?? m); return (o.C / cm); };
  console.log(`${n.padEnd(34)} light ${occ(l).toFixed(2)}  dark ${occ(d).toFixed(2)}`);
}
