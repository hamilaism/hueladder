// Le verrou de luminance tient-il ? C'est la seule promesse de l'outil, elle doit être
// vérifiée sur tout le domaine, pas sur trois exemples.

import {
  solveAtLuminance, maxChromaAtLuminance, luminanceToContrasts, luminanceForContrastVsBlack,
  luminanceForContrastVsBackground, contrastBudget, darkLadderFromLight,
  BELL_CHROMA, chromaProfile, deriveDarkScale, blendVariants,
  luminanceLadder, applyTuning, verifyTuning, sampleCurve, luminanceQuantum, luminanceGap,
  GAMUT_CEILING, BELL,
} from './tune.mjs';
import { relativeLuminance, contrastVsWhite, contrastVsBlack, contrast, hexToOklch, oklchToHex, hexToRgb, rgbToHex,
  contrastY, contrastVsBackgroundY } from './color.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg, detail) => {
  if (cond) { pass++; return; }
  fail++;
  console.log('  ✗', msg, detail === undefined ? '' : '→ ' + detail);
};
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, msg, `${a} vs ${b} (écart ${Math.abs(a - b).toExponential(2)})`);

console.log('1 · la relation contraste ↔ luminance');
for (let i = 0; i <= 100; i++) {
  const Y = i / 100;
  const c = luminanceToContrasts(Y);
  near(c.vsBlack * c.vsWhite, 21, 1e-9, `C_blanc × C_noir = 21 à Y=${Y}`);
  near(luminanceForContrastVsBlack(c.vsBlack), Y, 1e-9, `aller-retour Y↔contraste à Y=${Y}`);
}
// et sur de vraies couleurs
for (const hex of ['#000000', '#ffffff', '#d63e38', '#12b76a', '#0067f0', '#ff9e2a', '#7f7f7f']) {
  const Y = relativeLuminance(hex);
  const c = luminanceToContrasts(Y);
  near(c.vsBlack, contrastVsBlack(hex), 1e-9, `C_noir prédit = mesuré (${hex})`);
  near(c.vsWhite, contrastVsWhite(hex), 1e-9, `C_blanc prédit = mesuré (${hex})`);
}

console.log('2 · solveAtLuminance atteint sa cible, sur tout le domaine');
let worstY = 0, worstAt = '';
for (let hi = 0; hi < 36; hi++) {
  const H = hi * 10;
  for (const targetY of [0.005, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 0.97]) {
    for (const C of [0, 0.02, 0.08, 0.15, 0.25, 0.4]) {
      const r = solveAtLuminance(targetY, C, H);
      const d = Math.abs(r.y - targetY);
      if (d > worstY) { worstY = d; worstAt = `H${H} Y${targetY} C${C}`; }
      ok(/^#[0-9a-f]{6}$/.test(r.hex), `hex valide (H${H} Y${targetY} C${C})`, r.hex);
      ok(Number.isFinite(r.L) && r.L >= 0 && r.L <= 1, `L dans [0,1] (H${H} Y${targetY} C${C})`, r.L);
      // le vrai critère : aucune autre luminosité ne donne une couleur plus proche de la cible
      let best = d;
      for (let k = -40; k <= 40; k++) {
        const alt = solveAtLuminance.length && oklchToHex(Math.max(0, Math.min(1, r.L + k * 0.0015)), C, H);
        best = Math.min(best, Math.abs(relativeLuminance(alt) - targetY));
      }
      ok(d <= best + 1e-12, `solution optimale sur la grille hex (H${H} Y${targetY} C${C})`,
        `obtenu ${d.toExponential(2)}, meilleur atteignable ${best.toExponential(2)}`);
    }
  }
}
console.log(`   écart max sur ${36 * 11 * 6} solveurs : ${worstY.toExponential(2)} (${worstAt}) — optimal sur la grille hex dans tous les cas`);

console.log('3 · le contraste est bien invariant quand on tourne la teinte');
for (const targetY of [0.05, 0.18, 0.45, 0.75, 0.93]) {
  const ref = luminanceToContrasts(targetY);
  let relB = 0, relW = 0, absB = 0;
  for (let H = 0; H < 360; H += 5) {
    const r = solveAtLuminance(targetY, 0.2, H);
    const dB = Math.abs(contrastVsBlack(r.hex) - ref.vsBlack);
    const dW = Math.abs(contrastVsWhite(r.hex) - ref.vsWhite);
    absB = Math.max(absB, dB);
    relB = Math.max(relB, dB / ref.vsBlack);
    relW = Math.max(relW, dW / ref.vsWhite);
  }
  const rel = Math.max(relB, relW);
  ok(rel < 0.01, `contraste stable sur 360° de teinte à Y=${targetY}`, `dérive relative ${(rel * 100).toFixed(3)} %`);
  console.log(`   Y=${targetY} : noir ${ref.vsBlack.toFixed(2)}:1 / blanc ${ref.vsWhite.toFixed(2)}:1 — dérive relative max sur la roue ${(rel * 100).toFixed(3)} %`);
}

console.log('4 · maxChromaAtLuminance');
for (let H = 0; H < 360; H += 15) {
  for (const Y of [0.03, 0.12, 0.3, 0.6, 0.88]) {
    const mx = maxChromaAtLuminance(Y, H);
    ok(mx >= 0 && mx <= 0.45, `plafond dans les bornes (H${H} Y${Y})`, mx);
    // juste en dessous du plafond : pas de réduction
    if (mx > 0.01) {
      ok(!solveAtLuminance(Y, mx * 0.97, H).clipped, `pas de réduction sous le plafond (H${H} Y${Y})`, `plafond ${mx}`);
      // juste au-dessus : réduction
      ok(solveAtLuminance(Y, mx * 1.05 + 0.002, H).clipped, `réduction au-dessus du plafond (H${H} Y${Y})`, `plafond ${mx}`);
    }
  }
}
// la chroma tenable s'effondre aux extrémités : c'est physique, on le vérifie
const midMax = maxChromaAtLuminance(0.3, 30), lightMax = maxChromaAtLuminance(0.93, 30);
ok(lightMax < midMax, 'moins de chroma tenable dans les clairs que au milieu', `${lightMax} < ${midMax}`);

console.log('5 · applyTuning conserve la luminance de bout en bout');
// le rouge Fusilier de l'exemple synthétique (`hueladder explain`), 50 → 950 : aucune couleur de client
const base = ['#ffebe8', '#ffc4bc', '#ff9d93', '#ff7569', '#ee554d', '#d63e38', '#bf2424', '#a60010', '#85000a', '#620005', '#350001'];
const ladder = luminanceLadder(base);
const scenarios = [
  { name: 'sans réglage', tuning: {} },
  { name: 'dérive de teinte ±20°', tuning: { hueShift: [-20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20] } },
  { name: 'arc de chroma', tuning: { chromaScale: [0.3, 0.5, 0.7, 0.9, 1, 1, 0.95, 0.85, 0.7, 0.5, 0.3] } },
  { name: 'chroma poussée hors gamut', tuning: { chromaScale: base.map(() => 3) } },
  { name: 'teinte tournée à 180°', tuning: { hueShift: base.map(() => 180) } },
  { name: 'désaturation totale', tuning: { chromaFraction: base.map(() => 0) } },
];
for (const s of scenarios) {
  const tuned = applyTuning(base, ladder, s.tuning);
  const v = verifyTuning(tuned);
  ok(v.ok, `contraste conservé — ${s.name}`,
    v.drifted.map(d => `step ${d.index} ${(d.relative * 100).toFixed(2)} %`).join(', '));
  let worstRel = 0, worstAbs = 0;
  tuned.forEach((t, i) => {
    ok(/^#[0-9a-f]{6}$/.test(t.hex), `hex valide — ${s.name} step ${i}`, t.hex);
    const want = luminanceToContrasts(ladder[i]);
    const dB = Math.abs(contrastVsBlack(t.hex) - want.vsBlack);
    const dW = Math.abs(contrastVsWhite(t.hex) - want.vsWhite);
    worstAbs = Math.max(worstAbs, dB, dW);
    worstRel = Math.max(worstRel, dB / want.vsBlack, dW / want.vsWhite);
  });
  ok(worstRel < 0.01, `contrastes inchangés — ${s.name}`, `dérive relative ${(worstRel * 100).toFixed(3)} %`);
  console.log(`   ${s.name.padEnd(28)} dérive de contraste max ${worstAbs.toFixed(4)} = ${(worstRel * 100).toFixed(3)} % relatif`);
}

console.log('6 · épinglage : le verrou saute, et c\'est signalé');
const pinned = applyTuning(base, ladder, { pins: { 4: '#2e90fa' } });
ok(pinned[4].hex === '#2e90fa', 'la valeur épinglée est reproduite exactement', pinned[4].hex);
ok(pinned[4].pinned === true, 'le step est marqué comme épinglé');
const vp = verifyTuning(pinned);
ok(vp.ok, 'les steps non épinglés restent verrouillés');
ok(vp.pinned.length === 1, 'l\'épinglage est remonté dans le rapport', vp.pinned.length);
ok(Math.abs(vp.pinned[0].vsBlack - vp.pinned[0].expectedVsBlack) > 0.1,
  'la déviation de contraste de l\'épinglage est réelle et mesurée',
  `${vp.pinned[0].vsBlack.toFixed(2)} vs attendu ${vp.pinned[0].expectedVsBlack.toFixed(2)}`);
console.log(`   #2e90fa épinglé au step 4 : contraste ${vp.pinned[0].vsBlack.toFixed(2)}:1 au lieu de ${vp.pinned[0].expectedVsBlack.toFixed(2)}:1`);

console.log('6b · la fraction de plafond se comporte-t-elle bien ?');
{
  const full = applyTuning(base, ladder, { chromaFraction: base.map(() => 1) });
  const half = applyTuning(base, ladder, { chromaFraction: base.map(() => 0.5) });
  const none = applyTuning(base, ladder, { chromaFraction: base.map(() => 0) });
  full.forEach((t, i) => {
    ok(t.fraction > 0.97, `100 % atteint bien le plafond au step ${i}`, t.fraction);
    ok(Math.abs(half[i].chroma - t.maxChroma * 0.5) < 0.01, `50 % donne bien la moitié au step ${i}`,
      `${half[i].chroma} vs ${(t.maxChroma * 0.5).toFixed(3)}`);
    ok(none[i].chroma < 0.01, `0 % donne bien un gris au step ${i}`, none[i].chroma);
    // toute la course est utile : les trois réglages donnent des couleurs distinctes
    if (t.maxChroma > 0.03) {
      ok(t.hex !== half[i].hex && half[i].hex !== none[i].hex,
        `les trois niveaux sont distincts au step ${i}`, `${t.hex} ${half[i].hex} ${none[i].hex}`);
    }
  });
  // et le contraste tient dans les trois cas
  for (const [n, set] of [['100 %', full], ['50 %', half], ['0 %', none]]) {
    const v = verifyTuning(set);
    ok(v.ok, `contraste conservé à ${n} de plafond`, (v.maxRelativeDeviation * 100).toFixed(2) + ' %');
  }
  console.log('   décalage de clarté perçue au plafond :',
    full.map(t => (t.perceivedShift > 0 ? '+' : '') + t.perceivedShift.toFixed(3)).join(' '));
}

console.log('7 · sampleCurve');
ok(sampleCurve([], 5).every(v => v === 0), 'courbe vide = zéros');
ok(sampleCurve([{ index: 0, value: 7 }], 5).every(v => v === 7), 'point unique = constante');
const c2 = sampleCurve([{ index: 0, value: 0 }, { index: 10, value: 10 }], 11);
near(c2[0], 0, 1e-9, 'courbe : extrémité basse');
near(c2[10], 10, 1e-9, 'courbe : extrémité haute');
near(c2[5], 5, 1e-9, 'courbe : milieu symétrique');
ok(c2.every((v, i) => i === 0 || v >= c2[i - 1] - 1e-9), 'courbe monotone entre deux points croissants');
ok(sampleCurve([{ index: 3, value: 2 }, { index: 7, value: 5 }], 11).slice(0, 4).every(v => v === 2),
  'avant le premier point, la courbe est plate');

console.log('8 · robustesse');
for (const [Y, C, H] of [[0, 0.2, 0], [1, 0.2, 0], [0.5, 0, 0], [0.5, 0.2, 359.9], [0.5, 0.2, 0]]) {
  const r = solveAtLuminance(Y, C, H);
  ok(/^#[0-9a-f]{6}$/.test(r.hex) && Number.isFinite(r.y), `cas limite Y=${Y} C=${C} H=${H}`, JSON.stringify(r));
}
const sparse = applyTuning(['#ffffff', null, '#000000'], [1, null, 0], {});
ok(sparse[1] === null, 'un trou dans la rampe reste un trou');

console.log('9 · le barreau sombre : égalité de contraste contre un fond arbitraire');
{
  // Le cas particulier doit rester le cas particulier : sur fond noir, la formule
  // généralisée est mot pour mot celle qu'elle généralise.
  for (const c of [1.1, 2, 4.5, 7, 12, 21]) {
    near(luminanceForContrastVsBackground(c, '#000000'), luminanceForContrastVsBlack(c), 1e-12,
      `fond noir = cas particulier (C=${c})`);
  }
  near(contrastBudget('#000000'), 21, 1e-9, 'budget du noir pur = 21');
  near(contrastBudget('#ffffff'), 1, 1e-9, 'budget du blanc pur = 1');

  // Une table de référence calculée à part, reproduite chiffre par chiffre. Les Y
  // clairs y sont arrondis à 4 décimales : la tolérance est celle de l'arrondi, pas celle
  // de la formule — l'identité exacte est vérifiée juste après.
  const BG = '#0e0d0d';
  const Ylight = [0.8638, 0.6428, 0.4742, 0.3472, 0.2517, 0.1788, 0.1237, 0.0811, 0.0496, 0.0253, 0.0074];
  const Ydark = [0.0122, 0.0320, 0.0584, 0.0930, 0.1383, 0.1983, 0.2770, 0.3832, 0.5203, 0.7044, 0.9398];
  const got = darkLadderFromLight(Ylight, BG);
  Ydark.forEach((want, i) => near(got[i], want, 2e-4, `barreau sombre publié, cran ${i}`));
  near(contrastBudget(BG), 19.4074, 1e-3, 'amplitude sombre plafonnée sous 21 (fond #0e0d0d)');
  console.log(`   fond ${BG} : Y ${relativeLuminance(BG).toFixed(6)}, budget ${contrastBudget(BG).toFixed(4)}:1 contre 21:1 en clair`);

  // L'identité qui porte tout le procédé : à cran égal, le contraste réellement mesuré est
  // le même dans les deux modes. C'est elle qui fait qu'une règle de design system survit à
  // l'inversion du thème, et elle se vérifie sur des couleurs, pas sur des cibles.
  for (const bg of ['#000000', '#0e0d0d', '#141414', '#1c1c1c']) {
    let worst = 0;
    for (let hi = 0; hi < 12; hi++) {
      const H = hi * 30;
      const light = [0.86, 0.64, 0.47, 0.35, 0.25, 0.18, 0.12, 0.08, 0.05, 0.025];
      const darkL = darkLadderFromLight(light, bg);
      light.forEach((Y, i) => {
        if (darkL[i] > 1) return;   // hors budget : aucune couleur ne peut tenir ce contraste
        const a = solveAtLuminance(Y, 0.05, H).hex;
        const b = solveAtLuminance(darkL[i], 0.05, H).hex;
        const rel = Math.abs(contrast(a, '#ffffff') - contrast(b, bg)) / contrast(a, '#ffffff');
        worst = Math.max(worst, rel);
      });
    }
    ok(worst < 0.01, `contraste identique dans les deux modes (fond ${bg})`, `${(worst * 100).toFixed(3)} %`);
    console.log(`   fond ${bg} : écart de contraste clair↔sombre max ${(worst * 100).toFixed(3)} % relatif`);
  }

  // Un fond trop clair ne peut pas porter les crans les plus contrastés : la fonction le dit
  // en renvoyant un Y hors [0,1] plutôt qu'en rendant un blanc silencieux.
  const tooLight = darkLadderFromLight([0.0074], '#333333');
  ok(tooLight[0] > 1, 'un fond trop clair rend la cible inatteignable, visiblement', tooLight[0].toFixed(3));
  ok(darkLadderFromLight([null, 0.5], '#000000')[0] === null, 'un trou reste un trou');
}

console.log('10 · le profil de chroma en cloche');
{
  ok(BELL_CHROMA.length === 11, 'le profil de référence est écrit sur 11 crans', BELL_CHROMA.length);
  ok(BELL_CHROMA.every(v => v > 0 && v <= 1), 'toutes les fractions sont dans ]0, 1]');
  BELL_CHROMA.forEach((v, i) => near(v, BELL_CHROMA[BELL_CHROMA.length - 1 - i], 1e-12, `cloche symétrique au cran ${i}`));
  const mid = BELL_CHROMA[5];
  ok(BELL_CHROMA.every(v => v <= mid), 'le maximum est au milieu', mid);
  ok(BELL_CHROMA[0] < mid / 2, 'les extrémités prennent moins de la moitié du milieu', `${BELL_CHROMA[0]} vs ${mid}`);

  const exact = chromaProfile(11);
  exact.forEach((v, i) => near(v, BELL_CHROMA[i], 1e-12, `à 11 crans le profil est rendu exactement (cran ${i})`));
  for (const n of [5, 9, 13, 17, 24]) {
    const p = chromaProfile(n);
    ok(p.length === n, `rééchantillonné sur ${n} crans`, p.length);
    ok(p.every(v => v >= 0 && v <= 1), `fractions valides sur ${n} crans`);
    near(p[0], BELL_CHROMA[0], 1e-9, `extrémité basse conservée sur ${n} crans`);
    near(p[n - 1], BELL_CHROMA[10], 1e-9, `extrémité haute conservée sur ${n} crans`);
    ok(Math.max(...p) <= Math.max(...BELL_CHROMA) + 1e-9, `pas de dépassement du sommet sur ${n} crans`);
  }
  ok(chromaProfile(11, []).every(v => v === 1), 'profil vide = aucune retenue');
  ok(chromaProfile(11, [0.5]).every(v => v === 0.5), 'profil à un point = constante');

  // La raison d'être, mesurée : sans cloche, les crans extrêmes deviennent des aplats.
  // Le gamut est très large aux luminances extrêmes — c'est justement là qu'il ne faut pas
  // se servir, puisque ces crans sont des fonds et des encres.
  const H = 264;
  const ladder = darkLadderFromLight([0.86, 0.18, 0.025], '#0e0d0d');
  const flat = ladder.map(Y => solveAtLuminance(Y, maxChromaAtLuminance(Y, H) * 0.96, H).chroma);
  const bell = ladder.map((Y, i) => solveAtLuminance(Y, maxChromaAtLuminance(Y, H) * 0.96 * [0.25, 0.85, 0.4][i], H).chroma);
  ok(bell[0] < flat[0] * 0.4, 'la cloche retient le cran clair', `${bell[0]} vs ${flat[0]} sans profil`);
  ok(bell[1] > flat[1] * 0.8, 'et laisse le milieu vivre', `${bell[1]} vs ${flat[1]}`);
  console.log(`   H${H}° : chroma sans profil ${flat.map(v => v.toFixed(3)).join(' / ')} — avec cloche ${bell.map(v => v.toFixed(3)).join(' / ')}`);
}

console.log('11 · deriveDarkScale');
{
  const BG = '#0e0d0d';
  const light = ['#ede9ff', '#b19bff', '#8a4dff', '#6000c8', '#220050'];
  const Ylight = luminanceLadder(light);
  const darkY = darkLadderFromLight(Ylight, BG);
  const profile = [0.25, 0.6, 0.85, 0.6, 0.25];

  for (const [name, vivid] of [['alignée', 0], ['cloche', profile], ['max', 1]]) {
    const out = deriveDarkScale(light, darkY, { vividness: vivid });
    out.forEach((d, i) => {
      ok(/^#[0-9a-f]{6}$/.test(d.hex), `hex valide — ${name} cran ${i}`, d.hex);
      // la promesse : le cran sombre tient exactement le contraste que le cran clair tenait
      const rel = Math.abs(contrast(d.hex, BG) - contrastVsWhite(light[i])) / contrastVsWhite(light[i]);
      ok(rel < 0.01, `contraste transposé — ${name} cran ${i}`, `${(rel * 100).toFixed(3)} %`);
      // la teinte est le seul invariant qu'on n'ait pas le droit de perdre
      ok(Math.abs(((hexToOklch(d.hex).H - hexToOklch(light[i]).H + 540) % 360) - 180) < 2.5,
        `teinte conservée — ${name} cran ${i}`, `${hexToOklch(light[i]).H.toFixed(1)}° → ${hexToOklch(d.hex).H.toFixed(1)}°`);
      // jamais de régression d'éclat, sauf quand le gamut l'interdit — et alors c'est signalé
      ok(d.chroma >= d.lightChroma - 0.002 || d.clamped,
        `pas de régression de chroma non signalée — ${name} cran ${i}`,
        `${d.chroma} vs ${d.lightChroma}, clamped=${d.clamped}`);
      ok(d.chroma <= d.maxChroma + 0.003, `plafond de gamut respecté — ${name} cran ${i}`, `${d.chroma} vs ${d.maxChroma}`);
    });
    console.log(`   ${name.padEnd(8)} ${out.map(d => d.hex).join(' ')}  chroma ${out.map(d => d.chroma.toFixed(3)).join(' ')}`);
  }

  // la vivacité est bien monotone : plus on en demande, plus on en a
  const a = deriveDarkScale(light, darkY, { vividness: 0 });
  const b = deriveDarkScale(light, darkY, { vividness: 0.5 });
  const c = deriveDarkScale(light, darkY, { vividness: 1 });
  a.forEach((_, i) => {
    ok(b[i].chroma >= a[i].chroma - 0.002 && c[i].chroma >= b[i].chroma - 0.002,
      `vivacité monotone au cran ${i}`, `${a[i].chroma} ≤ ${b[i].chroma} ≤ ${c[i].chroma}`);
  });
  // le plafond de gamut est un retrait volontaire du bord, pas une décoration
  const wide = deriveDarkScale(light, darkY, { vividness: 1, gamutCeiling: 1 });
  ok(wide.some((w, i) => w.chroma > c[i].chroma + 0.002), 'le plafond à 96 % retient réellement quelque chose',
    wide.map((w, i) => (w.chroma - c[i].chroma).toFixed(3)).join(' '));
  ok(deriveDarkScale([null, '#8a4dff'], [null, 0.2], {})[0] === null, 'un trou reste un trou');
}

console.log('12 · blendVariants — la moyenne se fait sur la chroma, jamais sur le RGB');
{
  const ladder = [0.6428, 0.2517, 0.1788, 0.0811, 0.0253];
  const H = 292;
  const sober = ladder.map(Y => solveAtLuminance(Y, maxChromaAtLuminance(Y, H) * 0.25, H).hex);
  const vivid = ladder.map(Y => solveAtLuminance(Y, maxChromaAtLuminance(Y, H) * 0.90, H).hex);
  const mixed = blendVariants(sober, vivid, ladder);

  mixed.forEach((m, i) => {
    ok(/^#[0-9a-f]{6}$/.test(m.hex), `hex valide au cran ${i}`, m.hex);
    // ce qui est verrouillé le reste : la moyenne ne touche pas au contraste
    const rel = Math.abs(contrastVsWhite(m.hex) - luminanceToContrasts(ladder[i]).vsWhite) / luminanceToContrasts(ladder[i]).vsWhite;
    ok(rel < 0.01, `contraste inchangé par la moyenne au cran ${i}`, `${(rel * 100).toFixed(3)} %`);
    const want = (m.sourceChromas[0] + m.sourceChromas[1]) / 2;
    ok(Math.abs(m.chroma - want) < 0.01, `la chroma est bien la moyenne au cran ${i}`, `${m.chroma} vs ${want.toFixed(4)}`);
    // Quelques degrés d'écart sont attendus et ne veulent rien dire : aux crans peu
    // chromatiques, l'angle de teinte lu sur un hex est bruité par l'arrondi. Le seuil est
    // donc là pour séparer « deux vivacités d'une même couleur » de « deux couleurs »,
    // pas pour prétendre à une précision que la grille sRGB ne donne pas.
    ok(m.hueSpread < 6, `les deux sources partagent bien la teinte au cran ${i}`, m.hueSpread);
  });

  // Le contre-exemple, chiffré : la moyenne RGB déplace Y, donc le contraste, donc le sens
  // de l'échelon. C'est exactement l'erreur que cette fonction existe pour éviter.
  let worstRgb = 0;
  sober.forEach((a, i) => {
    const A = hexToRgb(a), B = hexToRgb(vivid[i]);
    const naive = rgbToHex({ r: (A.r + B.r) / 2, g: (A.g + B.g) / 2, b: (A.b + B.b) / 2 });
    worstRgb = Math.max(worstRgb, Math.abs(relativeLuminance(naive) - ladder[i]) / ladder[i]);
  });
  ok(worstRgb > 0.02, 'la moyenne RGB, elle, déplace bien la luminance', `${(worstRgb * 100).toFixed(2)} %`);
  console.log(`   moyenne OKLCh : contraste inchangé — moyenne RGB : jusqu'à ${(worstRgb * 100).toFixed(2)} % d'erreur de luminance`);

  // deux teintes franchement différentes doivent se voir, pas passer inaperçues
  const other = ladder.map(Y => solveAtLuminance(Y, 0.08, 40).hex);
  const cross = blendVariants(sober, other, ladder);
  ok(cross.every(m => m.hueSpread > 100), 'une moyenne entre deux teintes distinctes est signalée',
    cross.map(m => m.hueSpread).join(' '));
  ok(blendVariants(['#ffffff', null], ['#000000', '#123456'], [1, 0.2])[1] === null, 'un trou reste un trou');
}

console.log('\n13 · le trou de grille — luminanceGap borne l\'erreur inévitable');
{
  // luminanceQuantum renvoie l'écart au premier hex DIFFÉRENT, souvent un voisin à un LSB sur un
  // seul canal : un nombre bien plus petit que le vrai trou entre deux luminances atteignables.
  // S'en servir comme tolérance de test produit des rouges sans raison. luminanceGap mesure le
  // trou réel — c'est lui qui borne l'erreur, une cible pouvant tomber n'importe où dedans.
  let worstRatio = 0, worstHex = null;
  // Couleurs de l'exemple synthétique. La propriété n'est pas vraie partout : sur ses 99 couleurs,
  // le trou est plus étroit que le quantum pour 31 d'entre elles (la tolérance est alors plus
  // stricte, jamais plus lâche). Ces six-là illustrent le cas qui a motivé luminanceGap.
  for (const hex of ['#0446c0', '#12161a', '#8b7300', '#bf2424', '#b32779', '#663100']) {
    const q = luminanceQuantum(hex), g = luminanceGap(hex);
    ok(g >= q, `le trou est au moins aussi large que le quantum — ${hex}`, `${g.toExponential(2)} ≥ ${q.toExponential(2)}`);
    if (q > 0 && g / q > worstRatio) { worstRatio = g / q; worstHex = hex; }
  }
  ok(worstRatio > 2, 'et il est franchement plus large sur au moins une couleur',
    `×${worstRatio.toFixed(0)} sur ${worstHex}`);
  console.log(`   écart entre les deux mesures : jusqu'à ×${worstRatio.toFixed(0)} (${worstHex})`);

  // une cible tirée au hasard dans le trou reste atteignable à la moitié du trou près
  const hex = '#bf2424', g = luminanceGap(hex), { C, H } = hexToOklch(hex);
  const target = relativeLuminance(hex) + g / 3;
  const got = relativeLuminance(solveAtLuminance(target, C, H).hex);
  ok(Math.abs(got - target) <= g, 'une cible dans le trou est approchée à moins d\'un trou',
    `${Math.abs(got - target).toExponential(2)} ≤ ${g.toExponential(2)}`);
}

console.log('\n14 · contraste sur un fond quelconque');
{
  // Le fond d'un mode sombre n'est jamais le noir pur. Le supposer fausse toute l'amplitude.
  const bgY = relativeLuminance('#0e0d0d');
  near(contrastBudget('#0e0d0d'), 1.05 / (bgY + 0.05), 1e-12, 'le budget est bien 1,05 / (Y_fond + 0,05)');
  ok(contrastBudget('#0e0d0d') < 21, 'un fond non noir ne porte pas 21:1', contrastBudget('#0e0d0d').toFixed(4));
  near(contrastY(1, 0), 21, 1e-9, 'blanc sur noir vaut toujours 21');
  near(contrastVsBackgroundY('#ffffff', bgY), contrastBudget('#0e0d0d'), 1e-9,
    'le blanc sur le fond sombre atteint exactement le budget');
  // symétrie : l'ordre des deux termes ne change pas le résultat
  near(contrastY(0.3, 0.02), contrastY(0.02, 0.3), 1e-12, 'la mesure est symétrique');
}

console.log('\n15 · les constantes partagées');
{
  ok(BELL === BELL_CHROMA, 'BELL est bien un alias de BELL_CHROMA');
  ok(GAMUT_CEILING > 0.9 && GAMUT_CEILING < 1, 'le plafond de gamut laisse une marge sans être timide',
    String(GAMUT_CEILING));
  const prof = chromaProfile(11);
  ok(prof.length === 11 && prof[0] < prof[5] && prof[10] < prof[5],
    'la cloche est bien une cloche : creuse aux extrémités, pleine au milieu', prof.join(' '));
}

console.log(`\n${fail === 0 ? '✓' : '✗'} ${pass} assertions passées, ${fail} échec(s)`);
process.exit(fail === 0 ? 0 : 1);
