// Orchestration : un fichier de spécification de marque -> l'objet DATA consommé par l'artefact.

import {
  METHOD_IMPL, METHOD_COMPUTE_ORDER, SPARSE_METHODS, buildLadders, contrastRules,
  placeAnchors, swatchMeta, nearestInScale, hueVariantSeed, shadeOf, TAILWIND,
} from './methods.mjs';
import { contrastMatrix, methodMetrics, usageScores, anchorConsistency, interchangeability, hueDrift, hueProximity } from './analysis.mjs';
import { contrastVsWhite, contrastVsBlack, fmtRatio, hexToOklch, oklchToHex, bisectLightness, relativeLuminance } from './color.mjs';
import { deriveDark, spreadTop } from './dark.mjs';
import { cvdModes, distinguishability, CVD_MODES } from './cvd.mjs';
import { datavizPalettes } from './dataviz.mjs';
import { gradients } from './gradient.mjs';
import { highContrastMode } from './hicontrast.mjs';
import {
  luminanceForContrastVsBlack, darkLadderFromLight, contrastBudget, luminanceLadder,
  deriveDarkScale, chromaProfile, BELL_CHROMA, profileOnLadder,
  maxChromaAtLuminance, solveAtLuminance, GAMUT_CEILING,
} from './tune.mjs';

/**
 * Seed synthétique, pour un nuancier qui n'a pas de couleur « par défaut » fournie
 * — typiquement une rampe neutre dont on ne connaît que l'encre et les fonds clairs.
 * On garde la teinte des couleurs existantes (moyenne circulaire pondérée par la chroma,
 * pour que les quasi-gris ne votent pas) et la chroma la plus marquée d'entre elles,
 * puis on vise la cible de contraste du step d'ancrage.
 */
function synthesizeSeed(anchors, ladders, seedIndex) {
  const cols = Object.values(anchors).filter(Boolean).map(hexToOklch);
  let x = 0, y = 0, maxC = 0;
  for (const c of cols) {
    const w = Math.max(c.C, 1e-4);
    x += Math.cos((c.H * Math.PI) / 180) * w;
    y += Math.sin((c.H * Math.PI) / 180) * w;
    maxC = Math.max(maxC, c.C);
  }
  const H = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const target = Math.pow(21, ladders.shade[seedIndex] / 200);
  const L = bisectLightness(target, l => contrastVsBlack(oklchToHex(l, maxC, H)), { increasing: true });
  return oklchToHex(L, maxC, H);
}

/** Ordre d'affichage : l'existant d'abord (le point de départ), le core mis en avant. */
export const METHOD_DISPLAY_ORDER = [
  'existing', 'tuned', 'anchored', 'oklch', 'fusilier', 'colorshades', 'mix', 'hct', 'leonardo', 'apca', 'easing', 'curves', 'tailwind',
];

const n1 = (x, lang) => {
  const s = (Math.round(x * 10) / 10).toString();
  return lang === 'en' ? s : s.replace('.', ',');
};

function methodCatalog(spec, ladders, rules, tunedBase) {
  const lang = spec.lang === 'fr' ? 'fr' : 'en';
  const t = (fr, en) => (lang === 'en' ? en() : fr());
  const n = spec.steps.length;
  const first = spec.steps[0], last = spec.steps[n - 1], seed = spec.seedStep;
  const roles = Object.keys(spec.anchorRoles || {}).join(', ');
  const anyTuned = spec.ramps.some(r => r.tuned);
  return {
    ...(anyTuned ? { tuned: {
      label: t(() => 'Réglé à la main (luminance verrouillée)', () => 'Hand-tuned (locked luminance)'),
      short: t(() => 'Réglé', () => 'Tuned'),
      generated: true,
      desc: t(() => `Les valeurs travaillées dans le régleur (<code>tuner.html</code>) : la luminance de chaque step `
        + `est celle de « ${tunedBase} », donc les contrastes face au blanc et au noir sont rigoureusement ceux `
        + `de la méthode de base, mais la teinte et la chroma ont été dessinées à la main. C'est la seule façon `
        + `d'obtenir les courbes d'une palette dessinée sans renoncer aux garanties de contraste. `
        + `Un step non réglé retombe sur la méthode de base.`,
      () => `The values worked out in the tuner (<code>tuner.html</code>): each step keeps the luminance of `
        + `“${tunedBase}”, so contrast against white and black is exactly that of the base method, `
        + `while hue and chroma were drawn by hand. It is the only way to get the curves of a hand-drawn palette `
        + `without giving up the contrast guarantees. An untuned step falls back to the base method.`),
    } } : {}),
    existing: {
      label: t(() => 'Existant (couleurs fournies)', () => 'Existing (supplied colours)'),
      short: t(() => 'Existant', () => 'Existing'),
      generated: false,
      desc: t(() => `Les couleurs déjà choisies à la main et fournies en entrée${roles ? ` (${roles})` : ''}, sans aucune génération. `
        + `Chacune est posée au rang que lui donne son propre contraste face au noir — shade = 200 · ln(contraste)/ln(21) — `
        + `donc indépendamment de toute méthode. Les cases hachurées sont les steps qu'aucune couleur existante n'occupe : `
        + `c'est très exactement le trou que les méthodes suivantes doivent combler.`,
      () => `The colours already chosen by hand and supplied as input${roles ? ` (${roles})` : ''}, with no generation at all. `
        + `Each one sits at the rank given by its own contrast against black — shade = 200 · ln(contrast)/ln(21) — `
        + `so independently of any method. Hatched cells are the steps no existing colour occupies: `
        + `exactly the gap the following methods have to fill.`),
    },
    anchored: {
      label: t(() => 'Ancres + interpolation OKLCH', () => 'Anchors + OKLCH interpolation'),
      short: t(() => 'Ancres', () => 'Anchored'),
      generated: true,
      desc: t(() => `La colonne vertébrale Fusilier, corrigée pour passer exactement par toutes les couleurs de départ. `
        + `L'écart ancre ↔ colonne vertébrale est mesuré en OKLCH (ΔL, ΔC, ΔH) puis interpolé linéairement entre ancres. `
        + `Au-delà de l'ancre la plus extrême, la correction de teinte et de saturation est maintenue (c'est l'identité de la marque) `
        + `tandis que celle de luminosité s'éteint progressivement, pour que ${first} et ${last} tiennent quand même leur cible de contraste. `
        + `C'est la méthode « on ne jette rien » : zéro rupture avec l'existant, au prix des garanties qui ne valent plus qu'approximativement.`,
      () => `The Fusilier backbone, corrected to pass exactly through every starting colour. `
        + `The anchor ↔ backbone offset is measured in OKLCH (ΔL, ΔC, ΔH), then interpolated linearly between anchors. `
        + `Beyond the outermost anchor, the hue and saturation correction is kept (it is the brand identity) `
        + `while the lightness correction fades out, so that ${first} and ${last} still meet their contrast target. `
        + `This is the “throw nothing away” method: no break with the existing colours, at the cost of guarantees that now hold only approximately.`),
    },
    oklch: {
      label: t(() => 'OKLCH — luminosité fixe', () => 'OKLCH — fixed lightness'),
      short: 'OKLCH',
      generated: true,
      desc: t(() => `Principe accessiblepalette.com : une luminosité OKLCH fixe par step, identique pour toutes les teintes `
        + `(L ${n1(ladders.oklchL[0])} → ${n1(ladders.oklchL[n - 1])}). La hue du seed est strictement conservée, la chroma réduite `
        + `à hue et luminosité constantes quand elle sort du gamut sRGB. Uniformité perceptuelle parfaite, mais aucune garantie de contraste explicite.`,
      () => `The accessiblepalette.com principle: one fixed OKLCH lightness per step, the same for every hue `
        + `(L ${n1(ladders.oklchL[0], 'en')} → ${n1(ladders.oklchL[n - 1], 'en')}). The seed hue is kept strictly; chroma is reduced `
        + `at constant hue and lightness when it falls outside the sRGB gamut. Perfect perceptual uniformity, but no explicit contrast guarantee.`),
    },
    fusilier: {
      label: t(() => 'Fusilier (adapté) — chemin OKLCH', () => 'Fusilier (adapted) — OKLCH path'),
      short: t(() => 'Fusilier (adapté)', () => 'Fusilier (adapted)'),
      generated: true,
      desc: t(() => `Chaque step vise un contraste précis face au noir : shade = 200 · (1 − (rang+0,5)/${n}), contraste cible = 21^(shade/200). `
        + `Recherche binaire sur la luminosité OKLCH, hue et chroma du seed conservés. Adapté par Hueladder : color-shades, l'outil de David Fusilier, garde la teinte et la saturation HSL ; ici, la teinte et la chroma OKLCH, l'espace où travaillent aussi le régleur, le mode sombre et les ancres. Mêmes contrastes, couleurs un peu différentes : l'original est la méthode suivante, « Fusilier original ». Le demi-pas d'inset évite que ${first} et ${last} `
        + `touchent le blanc et le noir purs, qui n'ont plus de teinte. Barreau de shades : ${ladders.shade.map(s => Math.round(s)).join(', ')} `
        + `— soit ${n1(rules.shadePerRank)} shades par cran, et donc les garanties lisibles dans les noms : `
        + (rules.grain ? `Δ nom ≥ ${rules.rankForAA * rules.grain} ⇒ AA (4.5), Δ nom ≥ ${rules.rankForUI * rules.grain} ⇒ 3.0, Δ nom ≥ ${rules.rankForAAA * rules.grain} ⇒ AAA (7) — le nom de chaque cran fixe son contraste.`
          : `Δrang ≥ ${rules.rankForAA} ⇒ AA (4.5), Δrang ≥ ${rules.rankForUI} ⇒ 3.0, Δrang ≥ ${rules.rankForAAA} ⇒ AAA (7).`),
      () => `Each step targets a precise contrast against black: shade = 200 · (1 − (rank+0.5)/${n}), target contrast = 21^(shade/200). `
        + `Binary search on OKLCH lightness, seed hue and chroma kept. Adapted by Hueladder: color-shades, David Fusilier's tool, keeps the HSL hue and saturation; here, the OKLCH hue and chroma, the space the tuner, dark mode and anchors also work in. Same contrasts, slightly different colours: the original is the next method, “Fusilier, original”. The half-step inset keeps ${first} and ${last} `
        + `away from pure white and pure black, which have no hue left. Shade ladder: ${ladders.shade.map(s => Math.round(s)).join(', ')} `
        + `— that is ${n1(rules.shadePerRank, 'en')} shades per step, hence guarantees you can read in the names: `
        + (rules.grain ? `Δ name ≥ ${rules.rankForAA * rules.grain} ⇒ AA (4.5), Δ name ≥ ${rules.rankForUI * rules.grain} ⇒ 3.0, Δ name ≥ ${rules.rankForAAA * rules.grain} ⇒ AAA (7) — each step's name sets its contrast.`
          : `Δrank ≥ ${rules.rankForAA} ⇒ AA (4.5), Δrank ≥ ${rules.rankForUI} ⇒ 3.0, Δrank ≥ ${rules.rankForAAA} ⇒ AAA (7).`)),
    },
    colorshades: {
      label: t(() => 'Fusilier (original) — color-shades en HSL', () => 'Fusilier (original) — color-shades in HSL'),
      short: t(() => 'Fusilier (original)', () => 'Fusilier (original)'),
      generated: true,
      desc: t(() => `color-shades de David Fusilier, reproduit au hex près : les mêmes cibles que le Fusilier adapté (shade = 200 · (1 − (rang+0,5)/${n}), contraste face au noir = 21^(shade/200)), `
        + `atteintes comme le fait son outil : recherche binaire sur la luminosité HSL, teinte et saturation HSL du seed conservées, arrêt dès que le contraste est entre la cible et la cible + 0,005. `
        + `Aucune réduction de gamut : une couleur HSL est toujours dans sRGB.`,
      () => `David Fusilier's color-shades, reproduced to the hex: the same targets as the adapted Fusilier (shade = 200 · (1 − (rank+0.5)/${n}), contrast against black = 21^(shade/200)), `
        + `reached the way his tool reaches them: a binary search on HSL lightness, the seed's HSL hue and saturation kept, stopping as soon as the contrast is between the target and the target + 0.005. `
        + `No gamut reduction: an HSL colour is always inside sRGB.`),
    },
    mix: {
      label: t(() => 'Mix blanc/noir (sRGB)', () => 'White/black mix (sRGB)'),
      short: 'Mix',
      generated: true,
      desc: t(() => `La méthode naïve type Sass mix()/Bootstrap : le seed, ancré au step ${seed}, mélangé linéairement en sRGB avec du blanc `
        + `(steps plus clairs) ou du noir (steps plus foncés), fraction = écart de rang / ${(n - 1) / 2}. Aucune notion perceptuelle ni de contraste : `
        + `elle épingle la couleur d'identité exactement, et hérite en échange de tout le désordre cross-teintes.`,
      () => `The naive Sass mix()/Bootstrap method: the seed, anchored at step ${seed}, mixed linearly in sRGB with white `
        + `(lighter steps) or black (darker steps), fraction = rank gap / ${(n - 1) / 2}. No notion of perception or contrast: `
        + `it pins the identity colour exactly, and in exchange inherits all the cross-hue disorder.`),
    },
    hct: {
      label: t(() => 'HCT — tone fixe (Material)', () => 'HCT — fixed tone (Material)'),
      short: 'HCT',
      generated: true,
      desc: t(() => `Material You : un tone cible identique pour toutes les teintes (${ladders.tone[0]} → ${ladders.tone[n - 1]}), où tone est le L* CIELAB `
        + `et où hue et chroma sont ceux de CAM16 — un modèle d'apparence couleur, pas un simple espace. La chroma est ramenée au gamut sRGB `
        + `par recherche binaire à tone et hue constants. C'est le cousin du « luminosité fixe » dans un modèle perceptuellement plus fin.`,
      () => `Material You: the same target tone for every hue (${ladders.tone[0]} → ${ladders.tone[n - 1]}), where tone is CIELAB L* `
        + `and hue and chroma come from CAM16 — a colour appearance model, not just a space. Chroma is brought back into the sRGB gamut `
        + `by binary search at constant tone and hue. It is the cousin of “fixed lightness” in a perceptually finer model.`),
    },
    leonardo: {
      label: t(() => 'Leonardo — contraste visé', () => 'Leonardo — target contrast'),
      short: 'Leonardo',
      generated: true,
      desc: t(() => `@adobe/leonardo-contrast-colors (Nate Baldwin, Adobe), reproduite au hex près : une échelle blanc → seed → noir interpolée en OKLCH (la librairie interpole en RGB par défaut), et sur elle, `
        + `le point que la recherche de la librairie retient pour chaque ratio visé face au fond (ici le blanc), ratios arrondis à deux décimales comme dans la librairie. L'éclat suit l'échelle : il culmine au seed et s'éteint vers les extrêmes. `
        + `Les ratios sont un choix : ${ladders.leonardoReference ? `ceux de la rampe Tailwind ${ladders.leonardoReference}` : 'ici, les contrastes du barreau de l\'échelle, pour comparer à ratios égaux'} `
        + `(${ladders.leonardo.map(v => fmtRatio(v)).join(', ')}).`,
      () => `@adobe/leonardo-contrast-colors (Nate Baldwin, Adobe), reproduced to the hex: a white → seed → black scale interpolated in OKLCH (the library interpolates in RGB by default), and on it, `
        + `the point the library's search keeps for each target ratio against the background (white here), ratios rounded to two decimals as in the library. Chroma follows the scale: it peaks at the seed and fades towards the ends. `
        + `The ratios are a choice: ${ladders.leonardoReference ? `those of the Tailwind ${ladders.leonardoReference} ramp` : 'here, the contrasts of the scale\'s ladder, to compare at equal ratios'} `
        + `(${ladders.leonardo.map(v => fmtRatio(v)).join(', ')}).`),
    },
    apca: {
      label: t(() => 'APCA — Lc cible (WCAG 3)', () => 'APCA — target Lc (WCAG 3)'),
      short: 'APCA',
      generated: true,
      desc: t(() => `Comme Fusilier, mais avec la métrique APCA (brouillon WCAG 3), qui est sensible à la polarité et bien mieux corrélée à la lisibilité réelle `
        + `que le ratio WCAG 2. Chaque step vise un Lc précis pour du texte de cette couleur sur blanc : Lc = 106 · (1 − shade/200), `
        + `soit ${ladders.apca.map(v => Math.round(v)).join(', ')}. Implémentation 0.0.98G-4g validée contre les vecteurs de test apca-w3. `
        + `Nota : APCA a une zone morte sous Lc ≈ 7,3 (clamp bas), la cible du step ${first} y atterrit donc par le bas.`,
      () => `Like Fusilier, but with the APCA metric (WCAG 3 draft), which is polarity-aware and far better correlated with real readability `
        + `than the WCAG 2 ratio. Each step targets a precise Lc for text in that colour on white: Lc = 106 · (1 − shade/200), `
        + `i.e. ${ladders.apca.map(v => Math.round(v)).join(', ')}. Implementation 0.0.98G-4g, validated against the apca-w3 test vectors. `
        + `Note: APCA has a dead zone below Lc ≈ 7.3 (low clamp), so the target for step ${first} lands there from below.`),
    },
    easing: {
      label: t(() => 'Interpolation Lab (chroma.js)', () => 'Lab interpolation (chroma.js)'),
      short: 'Lab',
      generated: true,
      desc: t(() => `L'approche ColorBox outillée par chroma.js : chroma.scale(['blanc', seed, 'noir']).mode('lab').correctLightness(), `
        + `échantillonnée à rang régulier. Interpolation perceptuelle entre trois ancres, puis luminosité corrigée pour décroître linéairement `
        + `(L* ${ladders.easingL[0]} → ${ladders.easingL[n - 1]}). Régulière et sans surprise, mais elle ne vise aucun seuil.`,
      () => `The ColorBox approach, tooled with chroma.js: chroma.scale(['white', seed, 'black']).mode('lab').correctLightness(), `
        + `sampled at regular ranks. Perceptual interpolation between three anchors, then lightness corrected to decrease linearly `
        + `(L* ${ladders.easingL[0]} → ${ladders.easingL[n - 1]}). Regular and predictable, but it targets no threshold.`),
    },
    curves: {
      label: t(() => 'Courbes par canal (L, C, H)', () => 'Per-channel curves (L, C, H)'),
      short: t(() => 'Courbes', () => 'Curves'),
      generated: true,
      desc: t(() => `La démarche de ColorBox et des palettes de Stripe : clarté, éclat et teinte suivent chacun leur courbe, ancrée sur le seed `
        + `qui garde sa place au ${seed}. La clarté descend en douceur, l'éclat culmine au seed, la teinte tourne de quelques degrés aux extrêmes `
        + `(vers le jaune, le cyan ou le magenta en montant, vers le rouge, le vert ou le bleu en descendant). Belle et régulière dans une rampe ; `
        + `d'une teinte à l'autre, rien n'aligne les contrastes.`,
      () => `The ColorBox and Stripe approach: lightness, chroma and hue each follow their own curve, anchored on the seed, which keeps its place at ${seed}. `
        + `Lightness eases down, chroma peaks at the seed, hue turns a few degrees at the ends (towards yellow, cyan or magenta going lighter, `
        + `towards red, green or blue going darker). Beautiful and regular within a ramp; from one hue to another, nothing aligns contrasts.`),
    },
    tailwind: {
      label: t(() => 'Tailwind — palette dessinée', () => 'Tailwind — hand-drawn palette'),
      short: 'Tailwind',
      generated: true,
      desc: t(() => `L'étalon du design manuel : la palette Tailwind, dessinée à la main, sans aucune formule (philosophie Refactoring UI). `
        + `Pour chaque nuancier on adopte la famille Tailwind perceptuellement la plus proche du seed (ΔE2000 minimal, affiché dans l'en-tête). `
        + `C'est le geste « on prend Tailwind » : zéro effort, résultat éprouvé — mais on renonce aux couleurs d'identité, `
        + `et la dérive au step ${seed} mesure exactement ce qu'on abandonne.`,
      () => `The benchmark for manual design: the Tailwind palette, drawn by hand without any formula (the Refactoring UI philosophy). `
        + `For each ramp we adopt the Tailwind family perceptually closest to the seed (minimal ΔE2000, shown in the header). `
        + `This is the “just use Tailwind” move: zero effort, proven result — but the identity colours are given up, `
        + `and the drift at step ${seed} measures exactly what is lost.`),
    },
  };
}

const DEFAULT_USAGE_PATTERNS = (steps, lang) => {
  const s = i => steps[i];
  const n = steps.length;
  const en = lang === 'en';
  const w = en ? 'white' : 'blanc';
  const on = en ? 'on' : 'sur';
  const ntx = en ? 'non-text · 1.4.11' : 'non-textuel · 1.4.11';
  const body = en ? 'Body text' : 'Texte courant';
  const tinted = en ? 'Text on tinted surface' : 'Texte sur surface teintée';
  const darkText = en ? 'Dark mode, text' : 'Dark mode, texte';
  const border = en ? 'Input border' : 'Bordure de champ';
  return [
    { label: `${body} : <code>${s(n - 2)}</code> ${on} ${w}`, fg: s(n - 2), bg: 'W', threshold: 4.5, ref: 'AA · 1.4.3' },
    { label: `${body} : <code>${s(n - 2)}</code> ${on} ${w}`, fg: s(n - 2), bg: 'W', threshold: 7, ref: 'AAA · 1.4.6' },
    { label: `${tinted} : <code>${s(n - 2)}</code> ${on} <code>${s(0)}</code>`, fg: s(n - 2), bg: s(0), threshold: 4.5, ref: 'AA · 1.4.3' },
    { label: `${tinted} : <code>${s(n - 3)}</code> ${on} <code>${s(1)}</code>`, fg: s(n - 3), bg: s(1), threshold: 4.5, ref: 'AA · 1.4.3' },
    { label: `${en ? 'Secondary text' : 'Texte secondaire'} : <code>${s(7)}</code> ${on} ${w}`, fg: s(7), bg: 'W', threshold: 4.5, ref: 'AA · 1.4.3' },
    { label: `${en ? 'Primary button: white on' : 'Bouton primaire : blanc sur'} <code>${s(5)}</code>`, fg: 'W', bg: s(5), threshold: 4.5, ref: 'AA · 1.4.3' },
    { label: `${en ? 'Dark primary button: white on' : 'Bouton primaire foncé : blanc sur'} <code>${s(6)}</code>`, fg: 'W', bg: s(6), threshold: 4.5, ref: 'AA · 1.4.3' },
    { label: `${en ? 'Large heading' : 'Gros titre'} : <code>${s(6)}</code> ${on} ${w}`, fg: s(6), bg: 'W', threshold: 3, ref: en ? 'AA large text · 1.4.3' : 'AA gros texte · 1.4.3' },
    { label: `${border} : <code>${s(3)}</code> ${on} ${w}`, fg: s(3), bg: 'W', threshold: 3, ref: ntx },
    { label: `${border} : <code>${s(4)}</code> ${on} ${w}`, fg: s(4), bg: 'W', threshold: 3, ref: ntx },
    { label: `${en ? 'Icon / component' : 'Icône / composant'} : <code>${s(5)}</code> ${on} ${w}`, fg: s(5), bg: 'W', threshold: 3, ref: ntx },
    { label: `${darkText} : <code>${s(2)}</code> ${on} <code>${s(n - 2)}</code>`, fg: s(2), bg: s(n - 2), threshold: 4.5, ref: 'AA · 1.4.3' },
    { label: `${darkText} : <code>${s(1)}</code> ${on} <code>${s(n - 1)}</code>`, fg: s(1), bg: s(n - 1), threshold: 4.5, ref: 'AA · 1.4.3' },
    { label: `Dark mode, UI : <code>${s(4)}</code> ${on} <code>${s(n - 2)}</code>`, fg: s(4), bg: s(n - 2), threshold: 3, ref: ntx },
    // un lien se distingue du texte qui l'entoure sans compter sur la couleur seule (G183) ; un
    // anneau de focus tranche sur ce qu'il entoure (2.4.13) : deux couleurs de rampe face à face
    { label: `${en ? 'Link told apart from body text' : 'Lien distinct du texte'} : <code>${s(6)}</code> ${en ? 'next to' : 'face à'} <code>${s(n - 2)}</code>`, fg: s(6), bg: s(n - 2), threshold: 3, ref: 'G183 · 1.4.1' },
    { label: `${en ? 'Focus ring' : 'Anneau de focus'} : <code>${s(n - 2)}</code> ${en ? 'around' : 'autour de'} <code>${s(5)}</code>`, fg: s(n - 2), bg: s(5), threshold: 3, ref: en ? 'focus appearance · 2.4.13' : 'apparence du focus · 2.4.13' },
  ].map(p => (en ? { ...p, label: p.label.replace(' : ', ': ') } : p));
};

export function buildData(spec) {
  const steps = spec.steps;
  const n = steps.length;
  const seedIndex = steps.indexOf(spec.seedStep);
  if (seedIndex < 0) throw new Error(`seedStep "${spec.seedStep}" absent de steps`);

  const coreLadders = buildLadders(n, spec.ladders || {});
  // Les garanties de contraste se lisent sur les crans **réguliers** : les crans
  // supplémentaires, eux, sont hors grille par construction et ne participent pas à la règle.
  // Une nomenclature par contraste pose sa règle sur sa grille virtuelle (un rang = un grain de
  // nom), et situe chaque cran sur cette grille : l'écart de rangs y est un écart de noms.
  const rules = contrastRules(spec.ruleLadder || coreLadders.shade);
  if (spec.rankUnit) rules.grain = spec.rankUnit.grain;
  // la fonction ne survivrait pas à la sérialisation : on la déplie en table
  rules.rankTable = Array.from({ length: n - 1 }, (_, k) => ({ rank: k + 1, ratio: rules.ratioForRank(k + 1) }));
  delete rules.ratioForRank;

  /**
   * Crans supplémentaires — typiquement le blanc et le noir purs, plus un cran très clair
   * et un cran très sombre, dont une rampe neutre a besoin pour les surfaces d'interface.
   *
   * Ils s'ajoutent à l'échelle sans toucher aux crans réguliers : leur shade est extrapolée
   * de la droite qui relie les crans existants à leur nom, puis bornée — un cran nommé « 0 »
   * atteint shade 200 (blanc pur) et « 1000 » shade 0 (noir pur). Les nuanciers qui ne les
   * déclarent pas laissent simplement le rang vide, comme n'importe quelle méthode creuse.
   */
  const extraNames = (spec.extraSteps || []).map(String);
  const fit = (() => {
    // Les noms de crans ne sont pas régulièrement espacés (50→100 vaut 50, 100→200 vaut 100) :
    // une régression linéaire sur le nom donnerait n'importe quoi. On interpole donc par
    // morceaux entre crans voisins, en ancrant les deux bouts sur ce qu'ils signifient
    // nécessairement — 0 est le blanc pur (shade 200) et 1000 le noir pur (shade 0).
    const known = [
      { x: 0, y: 200 },
      ...steps.map((name, i) => ({ x: Number(name), y: coreLadders.shade[i] })),
      { x: 1000, y: 0 },
    ].sort((a, b) => a.x - b.x);
    return name => {
      const x = Number(name);
      const exact = known.find(k => k.x === x);
      if (exact) return exact.y;
      const hi = known.findIndex(k => k.x > x);
      if (hi <= 0) return known[0].y;
      const a = known[hi - 1], b = known[hi];
      return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    };
  })();

  // fusion : tout est trié par shade décroissante, du plus clair au plus foncé
  const merged = [
    ...steps.map((name, i) => ({ name, shade: coreLadders.shade[i], core: true })),
    ...extraNames.map(name => ({ name, shade: fit(name), core: false })),
  ].sort((a, b) => b.shade - a.shade);

  const allSteps = merged.map(m => m.name);
  const isCore = merged.map(m => m.core);
  const nAll = allSteps.length;
  const coreIndex = merged.map((m, i) => (m.core ? i : -1)).filter(i => i >= 0);
  // rang de chaque position sur la grille régulière — null pour un cran hors grille
  const coreRank = merged.map((m, i) => (!m.core ? null
    : spec.rankPositions ? spec.rankPositions[steps.indexOf(m.name)] : coreIndex.indexOf(i)));

  // les échelles cibles de chaque méthode, ré-étalées sur l'échelle complète
  const ladders = buildLadders(nAll, { ...(spec.ladders || {}), shadeLadder: merged.map(m => m.shade) });
  for (const key of ['oklchL', 'tone', 'easingL', 'leonardo', 'apca']) {
    const src = coreLadders[key];
    if (!Array.isArray(src)) continue;
    // les crans réguliers gardent leur valeur exacte ; les extras sont interpolés
    const out = new Array(nAll);
    coreIndex.forEach((gi, k) => { out[gi] = src[k]; });
    for (let i = 0; i < nAll; i++) {
      if (out[i] !== undefined) continue;
      const before = coreIndex.filter(g => g < i).pop();
      const after = coreIndex.find(g => g > i);
      if (before === undefined) out[i] = src[0] + (src[0] - src[1]) * (coreIndex[0] - i);
      else if (after === undefined) out[i] = src[n - 1] + (src[n - 1] - src[n - 2]) * (i - coreIndex[n - 1]);
      else {
        const t = (i - before) / (after - before);
        out[i] = out[before] + (out[after] - out[before]) * t;
      }
    }
    ladders[key] = out;
  }
  ladders.shade = merged.map(m => m.shade);

  /**
   * Le mode sombre — opt-in par `spec.darkMode`.
   *
   * Le barreau de shades **est déjà** un barreau de luminance : shade s impose un contraste
   * `21^(s/200)` face au noir, donc un Y. Le mode sombre n'est alors pas une seconde palette
   * à dessiner, c'est le même barreau relu contre un autre fond — chaque cran garde son
   * contraste, donc son sens, et le seuil AA tombe au même endroit dans les deux modes.
   *
   * Ce barreau-ci sert de référence (budget, crans hors d'atteinte). Les couleurs sombres,
   * elles, sont dérivées plus bas de la luminance réellement obtenue en clair : c'est ce qui
   * garantit que chaque cran porte le même contraste dans les deux modes.
   */
  const darkCfg = spec.darkMode || null;
  const lightBackground = spec.lightBackground || '#ffffff';
  let dark = null;
  if (darkCfg) {
    const background = darkCfg.background;
    if (!/^#[0-9a-fA-F]{6}$/.test(background || '')) {
      throw new Error(`darkMode.background doit être un hex à 6 chiffres, reçu "${background}"`);
    }
    const lightY = ladders.shade.map(s => luminanceForContrastVsBlack(Math.pow(21, s / 200)));
    // le haut du barreau : en deux morceaux (`spreadTop: true`) et sous un plafond anti-halo
    // (`haloCap: 14`, ou `true` pour 14:1) — l'égalité reste exacte jusqu'au dernier seuil de texte
    const top = darkCfg.spreadTop || darkCfg.haloCap ? { split: 7, cap: darkCfg.haloCap === true ? 14 : Number(darkCfg.haloCap) || null } : null;
    const darkY = top ? spreadTop(darkLadderFromLight(lightY, background), background, top) : darkLadderFromLight(lightY, background);
    const budget = contrastBudget(background);

    // Le profil de chroma est posé sur l'échelle complète : c'est une courbe lisse, la
    // rééchantillonner sur nAll plutôt que sur la seule grille régulière ne change pas sa
    // forme, et les crans hors grille tombent aux extrémités, là où la cloche est basse.
    const raw = darkCfg.chromaProfile;
    // le profil se lit à la position de chaque cran sur la grille régulière : un cran garde
    // ainsi la même valeur, donc la même couleur sombre, d'un jeu de crans à l'autre
    const vividness = raw === undefined || raw === null ? 0
      : raw === 'bell' ? profileOnLadder(ladders.shade, n, BELL_CHROMA)
      : Array.isArray(raw) ? profileOnLadder(ladders.shade, n, raw)
      : Number(raw);

    dark = {
      background, top,
      backgroundY: Math.round(relativeLuminance(background) * 1e6) / 1e6,
      contrastBudget: Math.round(budget * 1e4) / 1e4,
      gamutCeiling: darkCfg.gamutCeiling ?? 0.96,
      chromaProfile: Array.isArray(vividness) ? vividness.map(v => Math.round(v * 1000) / 1000) : vividness,
      profileName: raw === 'bell' ? 'bell' : Array.isArray(raw) ? 'custom'
        : raw === undefined || raw === null ? (darkCfg.desaturate > 0 ? 'desaturated' : 'aligned') : 'constant',
      // la méthode de dérivation (lib/dark.mjs) ; le miroir WCAG est la seule qui transporte la règle
      method: darkCfg.method || 'mirror-wcag',
      // part de chroma retirée en sombre — 0 : le sombre garde l'éclat du clair. Par défaut, sur
      // les seuls crans de surface : les systèmes mesurés ne désaturent pas accents et textes
      desaturate: Math.max(0, Math.min(0.9, Number(darkCfg.desaturate) || 0)),
      desaturateScope: darkCfg.desaturateScope === 'all' ? 'all' : 'surfaces',
      ladder: darkY,
      // Un cran dont la cible dépasse Y = 1 est hors d'atteinte sur ce fond : le fond est
      // trop clair pour porter ce contraste. C'est structurel, on le nomme au lieu de le
      // laisser sortir en blanc sans explication.
      outOfBudget: allSteps.filter((_, i) => isCore[i] && darkY[i] > 1),
      vividness,
      pins: darkCfg.pins || {},
    };
  }

  const tunedBase = spec.tunedBase || 'fusilier';
  // `lightChroma: "vivid"` (ou une fraction de 0 à 1) : la re-saturation en clair, appliquée à la méthode de base
  const vivid = spec.lightChroma === 'vivid' ? 1 : typeof spec.lightChroma === 'number' ? Math.max(0, Math.min(1, spec.lightChroma)) : 0;
  const methods = methodCatalog({ ...spec, steps: allSteps }, ladders, rules, tunedBase);
  // l'exemple ne fournit aucune couleur : ses couleurs de départ ne font pas un « existant »
  if (spec.demo) delete methods.existing;
  const methodOrder = METHOD_DISPLAY_ORDER.filter(m => methods[m]);
  const coreMethod = spec.coreMethod || 'fusilier';
  // la méthode qui reçoit l'éclat vif : celle du core, ou celle sous les réglages
  const vividBase = coreMethod === 'tuned' ? tunedBase : ['existing', 'anchored'].includes(coreMethod) ? null : coreMethod;
  const vividBell = profileOnLadder(ladders.shade, n, BELL_CHROMA);

  // Déclinaisons de teinte : opt-in par la spec. Générées avec la méthode core, sauf si
  // celle-ci a besoin de couleurs existantes — une déclinaison n'en a par construction aucune.
  const hueCfg = spec.hueVariants || {};
  const hueOffsets = hueCfg.offsets || [];
  const hueSpace = hueCfg.space === 'oklch' ? 'oklch' : 'hsl';
  const variantMethod = ['existing', 'anchored'].includes(coreMethod) ? 'fusilier' : coreMethod;

  /**
   * Quels nuanciers méritent des déclinaisons.
   *
   * Rarement tous : une couleur système ne peut pas tourner de 30° sans cesser de vouloir
   * dire ce qu'elle dit (un rouge d'erreur doit rester rouge), et une couleur de marque
   * n'est pas négociable. La question a du sens pour les lignes produit, où la teinte est
   * un choix et où le voisinage indique la place disponible.
   *
   * `appliesTo` liste les nuanciers concernés ; en son absence, tous le sont. Un nuancier
   * peut trancher lui-même avec `hueVariants: true | false`.
   */
  const wantsVariants = rspec => {
    if (!hueOffsets.length) return false;
    if (typeof rspec.hueVariants === 'boolean') return rspec.hueVariants;
    if (Array.isArray(hueCfg.appliesTo)) return hueCfg.appliesTo.includes(rspec.name);
    return true;
  };

  // ---- nuanciers
  const defaultRole = spec.defaultRole || 'default';
  const seedIndexAll = allSteps.indexOf(spec.seedStep);

  function buildRamp(rspec) {
    const anchors = rspec.anchors || {};
    if (!Object.values(anchors).filter(Boolean).length && !rspec.seed) {
      throw new Error(`nuancier "${rspec.name}" : aucune couleur fournie`);
    }

    // Un nuancier sans couleur « par défaut » reste légitime (rampe neutre : on connaît
    // l'encre et les fonds, pas le milieu). On en fabrique une, en le signalant.
    const seedProvided = !!anchors[defaultRole] || !!rspec.seed;
    const seed = rspec.seed || (anchors[defaultRole] || synthesizeSeed(anchors, ladders, seedIndexAll));

    // Les ancres ne se placent que sur les crans que ce nuancier utilise réellement.
    const usesExtra = rspec.extraSteps === true;
    const activeIdx = ladders.shade.map((_, i) => i).filter(i => isCore[i] || usesExtra);
    const activeShades = activeIdx.map(i => ladders.shade[i]);
    const pinnedLocal = (anchors[defaultRole] && spec.pinDefault !== false)
      ? { pinned: { [defaultRole]: activeIdx.indexOf(seedIndexAll) } } : {};
    const local = placeAnchors(anchors, activeShades, pinnedLocal);
    // …puis on remappe vers les rangs de l'échelle complète
    const anchorPlacement = {
      ...local,
      placements: local.placements.map(p => ({
        ...p,
        index: activeIdx[p.index],
        // le rang « mérité » se remappe lui aussi vers l'échelle complète
        naturalIndex: activeIdx[Math.max(0, Math.min(activeIdx.length - 1, Math.round(p.naturalIndex)))],
      })),
      crowding: (local.crowding || []).map(c => ({ ...c, index: activeIdx[c.index] })),
    };

    const ctx = {
      seed, anchors, steps: allSteps, n: nAll, seedIndex: seedIndexAll, ladders,
      tuned: rspec.tuned || null,
      tunedBase,
      isNeutral: rspec.kind === 'neutral',
      anchorPlacement,
      scales: {},
      meta: {},
    };
    for (const m of METHOD_COMPUTE_ORDER) {
      if (!methods[m]) continue;
      ctx.scales[m] = METHOD_IMPL[m](ctx);
      // éclat vif en clair : la méthode de base garde sa luminance (donc tous ses contrastes)
      // et prend, en cloche, une part du chemin qui reste jusqu'à la chroma maximale tenable.
      // Jamais sous la chroma qu'elle avait, jamais au-delà de 96 % du gamut ; le neutre n'y touche pas.
      // une famille peut choisir son éclat (la planche de variantes) : « seed », « vivid »,
      // « max » (le plafond à chaque cran, sans cloche) ou une fraction du chemin
      const rc = rspec.lightChroma;
      const amount = rc === 'seed' ? 0 : rc === 'vivid' ? 1 : rc === 'max' ? 'max' : typeof rc === 'number' ? Math.max(0, Math.min(1, rc)) : vivid;
      if (m === vividBase && amount && rspec.kind !== 'neutral') ctx.scales[m] = ctx.scales[m].map((hex, i) => {
        if (!hex) return hex;
        const Y = relativeLuminance(hex), { C, H } = hexToOklch(hex);
        const ceiling = maxChromaAtLuminance(Y, H) * GAMUT_CEILING;
        if (C >= ceiling) return hex;
        return solveAtLuminance(Y, C + (ceiling - C) * (amount === 'max' ? 1 : (vividBell[i] || 0) * amount), H).hex;
      });
    }

    // Le panachage : un nuancier peut garder une autre méthode que le système (`method:
    // "anchored"` garde la marque telle qu'elle est, ses couleurs exactement, le reste comblé).
    // Le contrat juge ensuite le système mixte, tel qu'il sera livré : ce que la marque gardée
    // coûte en franchissements se lit au lieu de se deviner.
    if (rspec.method && rspec.method !== coreMethod && ctx.scales[rspec.method] && !SPARSE_METHODS.has(rspec.method)) {
      ctx.scales[coreMethod] = ctx.scales[rspec.method].slice();
    }

    // Un nuancier n'utilise les crans supplémentaires que s'il les demande : ailleurs le rang
    // reste vide, exactement comme un trou de méthode creuse.
    // Le blanc et le noir purs ne se génèrent pas : ils n'ont ni teinte ni saturation à
    // préserver, ce sont les bornes de l'échelle. Toute méthode les rend à l'identique.
    const mask = scale => scale.map((hex, i) => {
      if (!isCore[i] && !usesExtra) return null;
      if (ladders.shade[i] >= 199.99) return '#ffffff';
      if (ladders.shade[i] <= 0.01) return '#000000';
      return hex;
    });

    const colors = {}, meta = {}, matrix = {};
    for (const m of methodOrder) {
      ctx.scales[m] = mask(ctx.scales[m]);
      colors[m] = ctx.scales[m];
      meta[m] = ctx.scales[m].map(swatchMeta);
      matrix[m] = contrastMatrix(ctx.scales[m]);
    }

    // ---- mode sombre : la même rampe relue contre le fond sombre
    const darkColors = {}, darkMeta = {}, darkDetail = {};
    if (dark) {
      // Le neutre reste le neutre : il porte les fonds et les encres, une variante « vive »
      // n'y a aucun sens et le rendrait teinté. Un nuancier peut trancher lui-même.
      const vividness = rspec.darkChroma !== undefined ? rspec.darkChroma
        : (rspec.kind === 'neutral' ? 0 : dark.vividness);
      const pins = dark.pins[rspec.name] || {};

      const tokenMethod = methodOrder.includes(coreMethod) ? coreMethod : methodOrder[0];
      for (const m of methodOrder) {
        // Le barreau sombre est déduit de la luminance **réellement obtenue** en clair, et
        // non de la cible commune. La nuance est décisive : ce qui est promis, c'est qu'un
        // cran porte le même contraste dans les deux modes. Dériver de la cible produirait un
        // mode sombre impeccable au-dessus d'un mode clair approximatif — la parité serait
        // rompue sans que rien ne le signale, et c'est précisément le cas d'une méthode qui
        // privilégie les couleurs de marque (`anchored`) sur la régularité.
        const solved = deriveDark(colors[m], {
          method: dark.method, background: dark.background, top: dark.top,
          vividness, gamutCeiling: dark.gamutCeiling, desaturate: dark.desaturate, scope: dark.desaturateScope,
          rule: { ranks: coreRank, ui: rules.rankForUI, aa: rules.rankForAA, aaa: rules.rankForAAA },
        });
        darkColors[m] = solved.map((d, i) => {
          if (colors[m][i] === null) return null;
          // Les bornes du mode sombre sont les bornes du mode clair, échangées : le cran qui
          // valait le blanc pur devient le fond lui-même (contraste 1:1 des deux côtés), et
          // celui qui valait le noir pur devient le blanc pur.
          if (ladders.shade[i] >= 199.99) return dark.background;
          if (ladders.shade[i] <= 0.01) return '#ffffff';
          if (pins[allSteps[i]]) return pins[allSteps[i]];
          return d ? d.hex : null;
        });
        darkMeta[m] = darkColors[m].map(swatchMeta);
        // Le détail — écrêtage, gain d'éclat, hors budget — n'est conservé que pour la
        // méthode qui part en tokens : c'est la seule dont on aura à justifier les valeurs.
        if (m === tokenMethod) {
          darkDetail[m] = solved.map((d, i) => (d && colors[m][i] ? {
            step: allSteps[i], hex: darkColors[m][i],
            clamped: d.clamped, outOfBudget: d.outOfBudget,
            chromaGain: d.chromaGain, maxChroma: d.maxChroma,
            // L'écart absolu, en plus du rapport : sur un quasi-gris (C ≈ 0,005) le rapport
            // s'affole pour un écart d'arrondi hex parfaitement invisible. C'est l'absolu
            // qui dit s'il s'est réellement passé quelque chose.
            chromaDelta: Math.round((d.chroma - d.lightChroma) * 10000) / 10000,
            lightChroma: d.lightChroma,
            pinned: !!pins[allSteps[i]],
          } : null));
        }
      }
    }

    return {
      darkColors: dark ? darkColors : null,
      darkMeta: dark ? darkMeta : null,
      darkDetail: dark ? darkDetail : null,
      darkChroma: dark ? (rspec.darkChroma !== undefined ? rspec.darkChroma
        : (rspec.kind === 'neutral' ? 0 : dark.profileName)) : null,
      hue: Math.round(hexToOklch(seed).H * 10) / 10,
      chroma: Math.round(hexToOklch(seed).C * 1000) / 1000,
      derived: !!rspec.derived,
      derivedFrom: rspec.derivedFrom || null,
      hueOffset: rspec.hueOffset ?? null,
      chromaLoss: rspec.chromaLoss ?? null,
      chromaDelta: rspec.chromaDelta ?? null,
      lightnessDelta: rspec.lightnessDelta ?? null,
      hslHue: rspec.hslHue ?? null,
      perceivedRotation: rspec.perceivedRotation ?? null,
      hueSpace: rspec.hueSpace ?? null,
      name: rspec.name,
      label: rspec.label || rspec.name,
      kind: rspec.kind || 'product',
      // les usages que sert cette famille (chemins fonctionnels) : ce qui permet de fusionner sans perdre d'usage
      primitives: Array.isArray(rspec.primitives) ? rspec.primitives : [],
      methodOverride: rspec.method && rspec.method !== coreMethod && !SPARSE_METHODS.has(rspec.method) ? rspec.method : null,
      source: rspec.source || '',
      note: rspec.note || '',
      anchors,
      seed,
      seedProvided,
      seedIndex: seedIndexAll,
      steps: allSteps,
      usesExtra,
      colors,
      meta,
      matrix,
      anchorPlacement: {
        placements: anchorPlacement.placements.map(p => {
          const nat = Math.max(0, Math.min(nAll - 1, Math.round(p.naturalIndex)));
          return {
            role: p.role, hex: p.hex, index: p.index, step: allSteps[p.index],
            shade: Math.round(p.shade * 10) / 10,
            naturalIndex: Math.round(p.naturalIndex * 100) / 100,
            naturalStep: allSteps[nat],
            // écart entre le rang que la couleur mérite et celui qu'elle occupe :
            // c'est la mesure de « ce step est-il correctement nommé »
            rankGap: p.index - nat,
            moved: !!p.moved, pinned: !!p.pinned,
            crowded: !!p.crowded, primary: p.primary !== false,
          };
        }),
      },
      crowding: anchorPlacement.crowding || [],
      consistency: anchorConsistency(anchors),
      tailwindFamily: ctx.meta.tailwindFamily || null,
      tailwindDeltaE: ctx.meta.tailwindDeltaE ?? null,
      tailwindHueShift: ctx.meta.tailwindHueShift ?? null,
    };
  }

  /**
   * Nuanciers, avec les déclinaisons de teinte insérées de part et d'autre de leur parent :
   * Coral −30° · Coral · Coral +30°.
   *
   * Ce sont des nuanciers à part entière (toutes les méthodes, matrices comprises), mais
   * marqués `derived` : ce sont des hypothèses, pas des couleurs de la marque. Ils sont donc
   * exclus des métriques comparatives, qui répondent à « quelle méthode retenir pour les
   * couleurs réelles » — les y inclure reviendrait à compter plusieurs fois la même
   * propriété structurelle et à diluer le signal.
   */
  const ramps = [];
  for (const rspec of spec.ramps) {
    const base = buildRamp(rspec);
    const before = [], after = [];
    for (const offset of (wantsVariants(rspec) ? hueOffsets : [])) {
      const v = hueVariantSeed(base.seed, offset, hueSpace);
      const sign = offset > 0 ? '+' : '−';
      const derived = buildRamp({
        ...rspec,
        name: `${rspec.name}-${offset > 0 ? 'p' : 'm'}${Math.abs(offset)}`,
        label: `${rspec.label || rspec.name} ${sign}${Math.abs(offset)}°`,
        anchors: {},                 // une déclinaison n'a aucune couleur déjà arbitrée
        seed: v.hex,
        derived: true,
        derivedFrom: rspec.name,
        hueOffset: offset,
        chromaLoss: v.chromaLoss,
        chromaDelta: v.chromaDelta,
        perceivedRotation: v.perceivedRotation,
        hueSpace,
        lightnessDelta: v.lightnessDelta,
        hslHue: v.hslHue,
        source: '',
        note: spec.lang !== 'fr' ? (hueSpace === 'hsl'
          ? `Variant of “${rspec.label || rspec.name}”: hue rotated by ${sign}${Math.abs(offset)}° on the `
            + `HSL wheel — the one colour pickers use — HSL saturation and lightness unchanged (H ${v.hslHue}° in HSL). `
            + `Since HSL is not perceptual, these ${Math.abs(offset)}° actually amount to `
            + `${Math.abs(v.perceivedRotation)}° of perceived hue (×${(Math.abs(v.perceivedRotation) / Math.abs(offset)).toFixed(2)}).`
          : `Variant of “${rspec.label || rspec.name}”: hue rotated by ${sign}${Math.abs(offset)}° on the `
            + `OKLCH wheel, lightness and saturation kept (H ${v.hue}°)`
            + (v.chromaLoss > 0.005 ? `. The sRGB gamut cannot hold this saturation at this hue: chroma reduced by ${v.chromaLoss}.` : '.'))
        : hueSpace === 'hsl'
          ? `Déclinaison de « ${rspec.label || rspec.name} » : teinte tournée de ${sign}${Math.abs(offset)}° sur la roue `
            + `HSL — celle des sélecteurs de couleur — saturation et luminosité HSL inchangées (H ${v.hslHue}° en HSL). `
            + `HSL n'étant pas perceptuel, ces ${Math.abs(offset)}° valent en réalité `
            + `${Math.abs(v.perceivedRotation)}° de teinte perçue (×${(Math.abs(v.perceivedRotation) / Math.abs(offset)).toFixed(2)}).`
          : `Déclinaison de « ${rspec.label || rspec.name} » : teinte tournée de ${sign}${Math.abs(offset)}° sur la roue `
            + `OKLCH, luminosité et saturation conservées (H ${v.hue}°)`
            + (v.chromaLoss > 0.005 ? `. Le gamut sRGB ne tient pas cette saturation à cette teinte : chroma réduite de ${v.chromaLoss}.` : '.'),
      });
      (offset < 0 ? before : after).push({ offset, ramp: derived });
    }
    before.sort((a, b) => a.offset - b.offset);
    after.sort((a, b) => a.offset - b.offset);
    ramps.push(...before.map(x => x.ramp), base, ...after.map(x => x.ramp));
  }

  /** Les couleurs réellement arbitrées par la marque — la base de toute métrique. */
  const realRamps = ramps.filter(r => !r.derived);

  // ---- correspondance des couleurs existantes, méthode par méthode
  const anchorMap = [];
  for (const r of realRamps) {
    for (const [role, hex] of Object.entries(r.anchors)) {
      if (!hex) continue;
      const placed = r.anchorPlacement.placements.find(p => p.role === role);
      const perMethod = {};
      for (const m of methodOrder) {
        if (m === 'existing') continue;
        const { index, deltaE } = nearestInScale(hex, r.colors[m]);
        perMethod[m] = { step: r.steps[index], index, deltaE, hex: r.colors[m][index] };
      }
      // Un nuancier peut fournir plus de couleurs que l'échelle n'a de crans : la dernière
      // arrivée reste alors sans rang. Ce n'est pas une anomalie à masquer, c'est
      // l'information « votre palette est plus dense que l'échelle à cet endroit ».
      if (!placed) {
        anchorMap.push({
          ramp: r.name, rampLabel: r.label, kind: r.kind, role, hex,
          shade: Math.round(shadeOf(hex) * 10) / 10,
          placedStep: null, placedIndex: null, naturalStep: null, naturalIndex: null,
          rankGap: null, moved: false, pinned: false, unplaced: true,
          cvw: Math.round(contrastVsWhite(hex) * 100) / 100,
          cvb: Math.round(contrastVsBlack(hex) * 100) / 100,
          perMethod,
        });
        continue;
      }
      anchorMap.push({
        ramp: r.name, rampLabel: r.label, kind: r.kind, role, hex,
        shade: placed.shade,
        placedStep: placed.step, placedIndex: placed.index,
        naturalStep: placed.naturalStep, naturalIndex: placed.naturalIndex, rankGap: placed.rankGap,
        moved: placed.moved, pinned: placed.pinned, unplaced: false,
        cvw: Math.round(contrastVsWhite(hex) * 100) / 100,
        cvb: Math.round(contrastVsBlack(hex) * 100) / 100,
        perMethod,
      });
    }
  }

  // ---- métriques
  const metrics = {};
  for (const m of methodOrder) {
    metrics[m] = methodMetrics(realRamps, m, { ruleRank: rules.rankForAA, referenceMethod: 'existing', coreRank });
    // Le test formel d'interchangeabilité, dans chaque mode. Il ne remplace pas `stepSpread`
    // — il en donne la conséquence : combien de substitutions à rang égal changeraient la
    // réponse à « est-ce que ça passe AA ». Un mode qui n'existe pas ne se mesure pas.
    metrics[m].interchangeability = {
      light: interchangeability(realRamps, m, { background: lightBackground, coreRank }),
      dark: dark ? interchangeability(realRamps, m, { background: dark.background, coreRank, key: 'darkColors' }) : null,
    };
    metrics[m].hueDrift = {
      light: hueDrift(realRamps, m, { seedIndex: seedIndexAll }),
      dark: dark ? hueDrift(realRamps, m, { seedIndex: seedIndexAll, key: 'darkColors' }) : null,
    };
  }

  /**
   * Couleurs littérales — la même valeur dans tous les modes.
   *
   * Une rampe sombre étant inversée, **aucun cran ne garde sa valeur d'un mode à l'autre** :
   * il n'existe donc, par construction, aucun moyen d'exprimer une couleur qui ne doit
   * jamais s'inverser — le blanc d'un logo, l'encre sur une photo, un aplat de marque dans
   * une illustration. Sans ce groupe, les équipes réutilisent `neutre/0` (un **rôle**, qui
   * s'inverse) et découvrent le bug une fois le thème sombre livré.
   */
  // Un littéral est un hex (6 chiffres, ou 8 avec l'alpha : une ombre, un voile), identique dans
  // tous les modes ; ou une valeur par mode, `{ light, dark, note }`, quand la couleur ne doit pas
  // s'inverser mais changer quand même (une ombre marine en clair, noire en sombre).
  const staticTokens = spec.staticTokens || {};
  const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  for (const [name, v] of Object.entries(staticTokens)) {
    const vals = typeof v === 'string' ? [v] : v && typeof v === 'object' ? [v.light, ...(v.dark !== undefined ? [v.dark] : [])] : [v];
    if (!vals.every(x => typeof x === 'string' && HEX.test(x))) {
      throw new Error(`staticTokens.${name} : un hex à 6 ou 8 chiffres, ou { light, dark, note }, reçu ${JSON.stringify(v)}`);
    }
  }

  const patterns = spec.usagePatterns || DEFAULT_USAGE_PATTERNS(steps, spec.lang);  // sur les crans réguliers
  const usages = usageScores(realRamps, methodOrder, patterns);

  const out = {
    meta: {
      brand: spec.brand,
      // lang n'est écrit que s'il est fourni : le rapport lit 'fr' par défaut
      lang: spec.lang === 'fr' ? 'fr' : 'en',
      title: spec.title || (spec.lang !== 'fr'
        ? `Generation methods compared — ${spec.brand} core scales`
        : `Comparaison des méthodes de génération — scales core ${spec.brand}`),
      subtitle: spec.subtitle || '',
      // ce qu'il faut savoir des couleurs avant de lire les chiffres : d'où elles viennent, ce qui n'est pas attesté
      caveat: spec.caveat || '',
      lightChroma: vivid ? vivid : null,
      // les fonds teintés sur lesquels le texte se pose (`surfaces: { carte: "#f5f7fa" }`), vérifiés au contrat
      surfaces: spec.surfaces || null,
      source: spec.source || '',
      demo: !!spec.demo,
      rankOf: coreRank, naming: spec.naming || (spec.crans ? 'grid' : null),
      steps: allSteps, coreSteps: steps, isCore, seedStep: spec.seedStep, seedIndex: seedIndexAll, coreMethod,
      lightBackground,
      dark: dark ? {
        background: dark.background, backgroundY: dark.backgroundY,
        contrastBudget: dark.contrastBudget, gamutCeiling: dark.gamutCeiling,
        profile: dark.profileName, chromaProfile: dark.chromaProfile, desaturate: dark.desaturate,
        method: dark.method, desaturateScope: dark.desaturateScope,
        outOfBudget: dark.outOfBudget,
        top: dark.top,
      } : null,
      rampCount: realRamps.length,
      derivedCount: ramps.length - realRamps.length,
      colorCount: realRamps.length * n,
      anchorCount: anchorMap.length,
      hueOffsets,
      hueSpace,
      variantMethod,
    },
    methods, methodOrder, ladders, rules,
    darkLadder: dark ? dark.ladder : null,
    staticTokens,
    // Les budgets que la marque s'engage à tenir. Ils ne changent aucun calcul : ils rendent
    // le contrat vérifiable par `check.mjs` au lieu de vivre dans une note de réunion.
    //
    // Les défauts ne sont pas des vœux : 3 % d'écart relatif à rang égal est ce qu'une
    // palette réellement verrouillée atteint en sRGB 8 bits (mesuré 1 à 2 % sur des palettes
    // de 20 familles, contre 80 % et plus pour une méthode sans verrou). 25° de dérive de
    // teinte est large à dessein — c'est un défaut hérité fréquent, à resserrer famille par
    // famille une fois qu'on sait ce qu'on peut tenir.
    contract: {
      maxHueDrift: spec.contract?.maxHueDrift ?? 25,
      // sans budget déclaré, la dispersion se juge contre le plancher sRGB de chaque cran
      maxRelativeSpread: spec.contract?.maxRelativeSpread ?? null,
      thresholds: spec.contract?.thresholds ?? [3, 4.5, 7],
      // la norme qui écrit la règle : WCAG 2 par défaut ; `apca` ajoute la règle relue en Lc
      norm: spec.contract?.norm === 'apca' ? 'apca' : 'wcag2',
    },
    anchorRoles: spec.anchorRoles || {},
    // Familles à la même teinte, et ce qu'il en reste une fois régénérées par la méthode core.
    // L'existant est creux : la convergence se mesure sur une méthode qui remplit tous les crans.
    proximity: hueProximity(realRamps, { coreMethod: coreMethod === 'existing' ? 'fusilier' : coreMethod }),
    ramps, anchorMap, metrics, usages,
    notes: spec.notes || {},
  };
  // ce qui reste distinguable entre familles sous chaque vision, au cran d'ancrage
  out.distinguishability = distinguishability(out);
  // les modes daltoniens demandés : `cvdModes: true` (les deux) ou une liste (`["tritan"]`)
  if (spec.cvdModes) out.cvd = cvdModes(out, spec.cvdModes === true ? Object.keys(CVD_MODES) : spec.cvdModes);
  // les palettes de dataviz tirées de l'échelle (des alias, aucune valeur nouvelle), et les dégradés déclarés
  if (spec.dataviz) out.dataviz = datavizPalettes(out, typeof spec.dataviz === 'object' ? spec.dataviz : {});
  if (Array.isArray(spec.gradients) && spec.gradients.length) out.gradients = gradients(spec);
  // le mode contraste élevé : `highContrast: true` (ou `{ stretch: 1.3 }`)
  if (spec.highContrast) out.highContrast = highContrastMode(out, typeof spec.highContrast === 'object' ? spec.highContrast : {});
  return out;
}
