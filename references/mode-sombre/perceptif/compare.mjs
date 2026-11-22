// Compare des barreaux sombres (perceptifs et hybrides) face à #121212.
// node compare.mjs [fond]
import fs from 'node:fs';
const E = decodeURI(new URL('../../../engine', import.meta.url).pathname);
const { buildData } = await import(`${E}/lib/build.mjs`);
const { relativeLuminance, contrast, linearToSrgb, hexToLab } = await import(`${E}/lib/color.mjs`);
const { apcaLc, APCAcontrast } = await import(`${E}/lib/apca.mjs`);
const { darkLadder } = await import(`${E}/lib/dark.mjs`);
const { deriveDarkScale, luminanceLadder, contrastBudget } = await import(`${E}/lib/tune.mjs`);
const C16 = await import('./cam16x.mjs');

const BG = process.argv[2] || '#121212';
const bgY = relativeLuminance(BG);
const k = bgY + 0.05;
const spec = JSON.parse(fs.readFileSync(`${E}/brands/_template.json`));
const data = buildData(spec);
const steps = data.meta.steps;
const ramps = Object.values(data.ramps).map(r => ({ name: r.name, light: r.colors[data.meta.coreMethod] }));

const yToL = y => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y);
const lToY = L => (L > 8 ? ((L + 16) / 116) ** 3 : L / (24389 / 27));
const bisect = (f, target, lo = 0, hi = 1) => { for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m; } return (lo + hi) / 2; };
const greyHex = y => { const v = Math.round(linearToSrgb(Math.min(1, Math.max(0, y))) * 255).toString(16).padStart(2, '0'); return `#${v}${v}${v}`; };

// CAM16 J d'un gris de luminance Y sous un fond de clarté Lb
const vcCache = {};
const J = (y, Lb) => { const vc = (vcCache[Lb] ||= C16.makeViewingConditions({ backgroundLstar: Lb })); return C16.cam16FromXyz(95.047 * y, 100 * y, 108.883 * y, vc).j; };
const Jp = j => (1.7 * j) / (1 + 0.007 * j); // CAM16-UCS J'
const LbDark = yToL(bgY);

const RANK_RULES = [[5, 3], [6, 4.5], [8, 7]]; // rankForUI / AA / AAA du moteur
const MARGIN = 1.01, ADJ = Number(process.env.ADJ || 1.2);

function ladders(light) {
  const Yl = luminanceLadder(light);
  const mirror = darkLadder('mirror-wcag', light, BG);
  const apca = darkLadder('mirror-apca', light, BG);
  // 1. ΔL* : même écart de clarté CIELAB au fond
  const dLstar = Yl.map(y => lToY(Math.min(100, LbDark + (100 - yToL(y)))));
  // 2. ΔL OKLab (gris : L = Y^1/3)
  const Lbo = Math.cbrt(bgY);
  const dOk = Yl.map(y => Math.min(1, (Lbo + (1 - Math.cbrt(y))) ** 3));
  // 3. ΔJ' CAM16-UCS, fond réel (Yb) dans chaque mode
  const Jw = Jp(J(1, 100)), Jb = Jp(J(bgY, LbDark));
  const dJ = Yl.map(y => { const d = Jw - Jp(J(y, 100)); return Jp(J(1, LbDark)) - Jb < d ? 1 : bisect(t => Jp(J(t, LbDark)) - Jb, d); });
  // 4. APCA pur sans plancher WCAG (même |Lc|, y compris sous Lc 30)
  const apcaPure = light.map(h => { const lc = Math.abs(apcaLc(h, '#ffffff')); if (lc === 0) return mirror[light.indexOf(h)]; return bisect(t => Math.abs(APCAcontrast(t, bgY)) * (t > bgY ? 1 : -1), lc, bgY, 1); });
  // 5. hybride : cible APCA (≥ miroir), projetée pour tenir la règle du nom (4→3, 6→4,5, 8→7)
  const hybrid = hybridLadder(mirror, apca);
  return { 'mirror-wcag': mirror, 'mirror-apca': apca, 'apca-pur': apcaPure, 'ΔL*': dLstar, 'ΔL OKLab': dOk, "ΔJ' CAM16": dJ, hybride: hybrid, 'hybride t=.5': hybridLadder(mirror, mirror.map((m, i) => Math.exp(Math.log(m + 0.05) * 0.5 + Math.log(Math.min(1, apca[i]) + 0.05) * 0.5) - 0.05)) };
}

// x = ln(Y + 0,05) ; contraste entre crans = exp(Δx). On part du haut, chaque cran est
// plafonné par ceux qui le dominent de 4, 6 et 8 rangs ; jamais sous le miroir.
export function hybridLadder(mirror, target) {
  const n = mirror.length, xm = mirror.map(y => Math.log(y + 0.05)), xt = target.map(y => Math.log(Math.min(1, y) + 0.05));
  const xmax = Math.log(1.05) - 1e-3, x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let v = Math.min(xt[i], xmax);
    for (const [d, r] of RANK_RULES) if (i + d < n) v = Math.min(v, x[i + d] - Math.log(r * MARGIN));
    if (i + 1 < n) v = Math.min(v, x[i + 1] - Math.log(ADJ));
    x[i] = Math.min(Math.max(v, xm[i]), xmax); // jamais sous le miroir, jamais au-delà du blanc
  }
  return x.map(v => Math.exp(v) - 0.05);
}

function rulesOk(scale) {
  const Y = scale.map(relativeLuminance); const bad = []; let min6 = Infinity;
  for (const [d, r] of RANK_RULES) for (let i = 0; i + d < Y.length; i++) {
    const c = (Y[i + d] + 0.05) / (Y[i] + 0.05);
    if (d === 6) min6 = Math.min(min6, c);
    if (c < r - 1e-9) bad.push(`${steps[i]}↔${steps[i + d]} ${c.toFixed(2)}<${r}`);
  }
  return { bad, min6 };
}

const out = { bg: BG, budget: contrastBudget(BG), LbDark, ramps: {} };
const fmt = (x, d = 1) => (x == null ? '—' : x.toFixed(d));
for (const r of [...ramps, { name: 'gris', light: ramps[0].light.map(h => greyHex(relativeLuminance(h))) }]) {
  console.log(`\n### ${r.name}  fond ${BG}  (budget ${contrastBudget(BG).toFixed(2)}:1)`);
  console.log('clair   ', r.light.map(h => `${h} ${contrast(h, '#fff').toFixed(2)} Lc${fmt(apcaLc(h, '#ffffff'), 0)}`).join(' | '));
  const L = ladders(r.light); out.ramps[r.name] = {};
  for (const [m, lad] of Object.entries(L)) {
    const scale = deriveDarkScale(r.light, lad).map(s => s.hex);
    const ok = rulesOk(scale);
    const row = scale.map(h => ({ hex: h, wcag: contrast(h, BG), lc: apcaLc(h, BG), L: hexToLab(h).L }));
    out.ramps[r.name][m] = { row, ...ok };
    console.log(m.padEnd(11), row.map(c => `${c.wcag.toFixed(2)}/${fmt(c.lc, 0)}`).join(' '), `| min Δ6 ${ok.min6.toFixed(2)} | ${ok.bad.length ? 'KO ' + ok.bad.join(', ') : 'règle OK'}`);
  }
}
fs.writeFileSync(new URL('./compare.json', import.meta.url), JSON.stringify(out, null, 1));
