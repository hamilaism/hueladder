// Les couleurs de dataviz tirées de l'échelle, sans valeur nouvelle : chaque couleur est un
// cran d'une rampe existante, donc un alias. Trois palettes, trois besoins :
// - catégorielle (des catégories sans ordre) : des crans de plusieurs rampes, au plus deux par
//   famille, en cherchant l'écart le plus grand, en vision normale et sous trois daltonismes ;
// - séquentielle (de peu à beaucoup) : une rampe, du clair au foncé ;
// - divergente (un écart autour d'un centre) : deux familles opposées autour du neutre.
//
// Le verrou de luminance est fait pour l'interface, pas pour des catégories : au même cran,
// toutes les familles ont la même luminance et se confondent en gris et sous un daltonisme.
// Une palette catégorielle doit donc changer de cran, pas seulement de famille.
// Les couleurs de statut (kind: system) en sont exclues : une couleur à sens ne colore que des
// données qui ont ce sens.

import { contrast, hexToOklch } from './color.mjs';
import { distance, VISIONS } from './cvd.mjs';

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const worst = (a, b) => Math.min(...VISIONS.map(v => distance(a, b, v)));

/**
 * `count` séries (8 par défaut, la huitième pour « autre » reste au gris) ; chaque couleur
 * tient 3:1 sur le fond clair et, s'il existe, sur le fond sombre (WCAG 1.4.11).
 */
export function datavizPalettes(data, { count = 8, method = data.meta.coreMethod } = {}) {
  const steps = data.meta.steps, core = data.meta.coreSteps;
  const lightBg = data.meta.lightBackground || '#ffffff', dark = data.meta.dark;
  const real = data.ramps.filter(r => !r.derived);
  const pool = [];
  for (const r of real.filter(x => x.kind !== 'system' && x.kind !== 'neutral')) {
    steps.forEach((st, i) => {
      if (!core.includes(st)) return;
      const hex = r.colors[method][i], night = dark && r.darkColors ? r.darkColors[method][i] : null;
      if (!hex || contrast(hex, lightBg) < 3 || (dark && (!night || contrast(night, dark.background) < 3))) return;
      pool.push({ family: r.name, step: st, hex, dark: night });
    });
  }
  // la plus éloignée de tout ce qui est déjà choisi, au plus deux crans par famille
  const pick = [];
  const per = f => pick.filter(p => p.family === f).length;
  const gap = c => (pick.length ? Math.min(...pick.map(p => Math.min(worst(p.hex, c.hex), c.dark && p.dark ? worst(p.dark, c.dark) : Infinity))) : 0);
  const n = Math.min(count - 1, pool.length);
  // on part de la couleur la plus chromatique : la plus reconnaissable
  if (pool.length) pick.push([...pool].sort((a, b) => hexToOklch(b.hex).C - hexToOklch(a.hex).C)[0]);
  while (pick.length < n) {
    const cands = pool.filter(c => !pick.includes(c) && per(c.family) < 2);
    if (!cands.length) break;
    pick.push(cands.sort((a, b) => gap(b) - gap(a))[0]);
  }
  const minGap = (list, key) => {
    let m = Infinity;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i][key] && list[j][key]) m = Math.min(m, worst(list[i][key], list[j][key]));
    return list.length > 1 ? round(m) : null;
  };
  const neutral = real.find(r => r.kind === 'neutral');
  const other = neutral ? (() => { const i = steps.indexOf(data.meta.seedStep) >= 0 ? steps.indexOf(data.meta.seedStep) : Math.floor(steps.length / 2); return { family: neutral.name, step: steps[i], hex: neutral.colors[method][i], dark: neutral.darkColors ? neutral.darkColors[method][i] : null, other: true }; })() : null;

  // séquentielle : la rampe de marque, des crans réguliers du clair au foncé
  const brand = real.find(r => r.kind === 'brand') || real.find(r => r.kind !== 'neutral');
  const seqSteps = core.filter((_, i) => i % Math.max(1, Math.round(core.length / 6)) === 0).slice(0, 7);
  const sequential = brand ? seqSteps.map(st => ({ family: brand.name, step: st, hex: brand.colors[method][steps.indexOf(st)] })) : [];

  // divergente : les deux familles les plus opposées en teinte, autour du neutre
  const chroma = real.filter(r => r.kind !== 'neutral' && r.kind !== 'system');
  let pair = null, best = -1;
  for (let i = 0; i < chroma.length; i++) for (let j = i + 1; j < chroma.length; j++) {
    const h = Math.abs(((hexToOklch(chroma[i].seed).H - hexToOklch(chroma[j].seed).H + 540) % 360) - 180);
    if (h > best) { best = h; pair = [chroma[i], chroma[j]]; }
  }
  const side = core.filter(st => Number(st) >= 300).filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 3)) === 0).slice(0, 3);
  const center = neutral ? core[Math.floor(core.length * 0.2)] : null;
  const diverging = pair ? [...[...side].reverse().map(st => ({ family: pair[0].name, step: st, hex: pair[0].colors[method][steps.indexOf(st)] })),
    ...(center ? [{ family: neutral.name, step: center, hex: neutral.colors[method][steps.indexOf(center)] }] : []),
    ...side.map(st => ({ family: pair[1].name, step: st, hex: pair[1].colors[method][steps.indexOf(st)] }))] : [];

  return {
    categorical: [...pick, ...(other ? [other] : [])],
    minGap: { light: minGap(pick, 'hex'), dark: dark ? minGap(pick, 'dark') : null },
    // au-delà de quatre séries, la couleur ne suffit plus : étiquettes directes, formes, hachures
    secondEncodingFrom: 5,
    sequential, diverging, hueGap: pair ? round(best, 0) : null,
  };
}

/** Les alias CSS : chaque couleur de dataviz pointe vers son cran, rien n'est dupliqué. */
export function datavizCss(spec, dv) {
  const v = c => `var(--color-${c.family}-${c.step})`;
  const L = [':root {'];
  dv.categorical.forEach((c, i) => L.push(`  --dataviz-${c.other ? 'other' : i + 1}: ${v(c)};`));
  dv.sequential.forEach((c, i) => L.push(`  --dataviz-seq-${i + 1}: ${v(c)};`));
  dv.diverging.forEach((c, i) => L.push(`  --dataviz-div-${i + 1}: ${v(c)};`));
  L.push('}');
  return L.join('\n') + '\n';
}
