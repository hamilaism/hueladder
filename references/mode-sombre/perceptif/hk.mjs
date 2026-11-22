// Effet Helmholtz–Kohlrausch (Hellwig, Stolitzka, Fairchild 2022) sur les rampes claire et sombre (miroir WCAG).
// J_HK = J + f(h)·C^0,587 ; f(h) = −0,160 cos h + 0,132 cos 2h − 0,405 sin h + 0,080 sin 2h + 0,792
// Approximation : J, C du CAM16 de cran (et non du modèle Hellwig–Fairchild 2022 complet).
import fs from 'node:fs';
const E = decodeURI(new URL('../../../engine', import.meta.url).pathname);
const { buildData } = await import(`${E}/lib/build.mjs`);
const { relativeLuminance, hexToLab } = await import(`${E}/lib/color.mjs`);
const { deriveDark } = await import(`${E}/lib/dark.mjs`);
const C16 = await import('./cam16x.mjs');
const BG = process.argv[2] || '#121212';
const d = buildData(JSON.parse(fs.readFileSync(`${E}/brands/_template.json`)));
const f = h => { const r = h * Math.PI / 180; return -0.160 * Math.cos(r) + 0.132 * Math.cos(2 * r) - 0.405 * Math.sin(r) + 0.080 * Math.sin(2 * r) + 0.792; };
const Lb = hexToLab(BG).L;
const vcL = C16.makeViewingConditions({ backgroundLstar: 100 }), vcD = C16.makeViewingConditions({ backgroundLstar: Lb });
const cam = (hex, vc) => { const [r, g, b] = C16.rgbFromHex(hex); const [x, y, z] = C16.xyzFromRgb255(r, g, b); const c = C16.cam16FromXyz(x, y, z, vc); return { J: c.j, hk: f(c.hue) * Math.pow(c.chroma, 0.587) }; };
for (const r of Object.values(d.ramps)) {
  const light = r.colors[d.meta.coreMethod];
  const dark = deriveDark(light, { background: BG }).map(s => s.hex);
  const Jw = cam('#ffffff', vcL).J, Jb = cam(BG, vcD).J;
  console.log(`\n${r.name}  (ΔJ au fond : gris équivalent → avec H-K ; lift H-K)`);
  light.forEach((h, i) => {
    const a = cam(h, vcL), b = cam(dark[i], vcD);
    const dl = Jw - a.J, dlhk = Jw - (a.J + a.hk), dd = b.J - Jb, ddhk = b.J + b.hk - Jb;
    console.log(d.meta.steps[i].padStart(4), `clair ${h} ΔJ ${dl.toFixed(1)}→${dlhk.toFixed(1)} (HK +${a.hk.toFixed(1)})`, `| sombre ${dark[i]} ΔJ ${dd.toFixed(1)}→${ddhk.toFixed(1)} (HK +${b.hk.toFixed(1)})`);
  });
}
