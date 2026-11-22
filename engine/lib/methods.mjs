// Les méthodes de génération d'échelles.
// Chaque méthode est une fonction pure (ctx) -> tableau de hex (ou de null pour les
// méthodes creuses), de la même longueur que ctx.steps.

import {
  hexToOklch, oklchToHex, hexToLab, labToLch, lchToLab, labToHex, clipChromaLab, clipChromaOk,
  hexToRgb, rgbToHex, hexToLstar, contrastVsWhite, contrastVsBlack,
  bisectLightness, hueDelta, lerpHue, lerp, hexToHsl, hslToHex,
} from './color.mjs';
import { deltaE2000Hex } from './deltae.mjs';
import { apcaLc } from './apca.mjs';
import { hctFromHex, hctToHex } from './cam16.mjs';
import { leonardoColors } from './leonardo.mjs';
import { colorShades } from './colorshades.mjs';

// ---------------------------------------------------------------- palette Tailwind (référence « dessinée à la main »)

// Tailwind 4.3 (theme.css, OKLCH), ramenée en sRGB par le gamut mapping CSS 4 — celui d'un
// navigateur : c'est ce qu'un écran sRGB affiche. Vérifiée au hex près par engine/conformance.
// Tailwind CSS palette: MIT, Copyright (c) Tailwind Labs, Inc. See THIRD_PARTY_NOTICES.md.
export const TAILWIND = {
  red: ['#fef2f2', '#ffe2e2', '#ffc9c9', '#ffa2a2', '#ff6467', '#fb2c36', '#e7000b', '#c10007', '#9f0712', '#82181a', '#460809'],
  orange: ['#fff7ed', '#ffedd4', '#ffd6a7', '#ffb86a', '#ff8904', '#ff6900', '#f54900', '#ca3500', '#9f2d00', '#7e2a0c', '#441306'],
  amber: ['#fffbeb', '#fef3c6', '#fee685', '#ffd230', '#ffba00', '#fd9a00', '#e17100', '#bb4d00', '#973c00', '#7b3306', '#461901'],
  yellow: ['#fefce8', '#fef9c2', '#fff085', '#ffdf20', '#fcc800', '#efb100', '#d08700', '#a65f00', '#894b00', '#733e0a', '#432004'],
  lime: ['#f7fee7', '#ecfcca', '#d8f999', '#bbf451', '#9ae600', '#7ccf00', '#5ea500', '#497d00', '#3c6300', '#35530e', '#192e03'],
  green: ['#f0fdf4', '#dcfce7', '#b9f8cf', '#7bf1a8', '#05df72', '#00c950', '#00a63e', '#008236', '#016630', '#0d542b', '#032e15'],
  emerald: ['#ecfdf5', '#d0fae5', '#a4f4cf', '#5ee9b5', '#00d492', '#00bc7d', '#096', '#007a55', '#006045', '#004f3b', '#002c22'],
  teal: ['#f0fdfa', '#cbfbf1', '#96f7e4', '#46ecd5', '#00d5be', '#00bba7', '#009689', '#00786f', '#005f5a', '#0b4f4a', '#022f2e'],
  cyan: ['#ecfeff', '#cefafe', '#a2f4fd', '#53eafd', '#00d3f2', '#00b8db', '#0092b8', '#007595', '#005f78', '#104e64', '#053345'],
  sky: ['#f0f9ff', '#dff2fe', '#b8e6fe', '#74d4ff', '#00bcff', '#00a6f4', '#0084d1', '#0069a8', '#00598a', '#024a70', '#052f4a'],
  blue: ['#eff6ff', '#dbeafe', '#bedbff', '#8ec5ff', '#51a2ff', '#2b7fff', '#155dfc', '#1447e6', '#193cb8', '#1c398e', '#162456'],
  indigo: ['#eef2ff', '#e0e7ff', '#c6d2ff', '#a3b3ff', '#7c86ff', '#615fff', '#4f39f6', '#432dd7', '#372aac', '#312c85', '#1e1a4d'],
  violet: ['#f5f3ff', '#ede9fe', '#ddd6ff', '#c4b4ff', '#a684ff', '#8e51ff', '#7f22fe', '#7008e7', '#5d0ec0', '#4d179a', '#2f0d68'],
  purple: ['#faf5ff', '#f3e8ff', '#e9d4ff', '#dab2ff', '#c27aff', '#ad46ff', '#9810fa', '#8200db', '#6e11b0', '#59168b', '#3c0366'],
  fuchsia: ['#fdf4ff', '#fae8ff', '#f6cfff', '#f4a8ff', '#ed6aff', '#e12afb', '#c800de', '#a800b7', '#8a0194', '#721378', '#4b004f'],
  pink: ['#fdf2f8', '#fce7f3', '#fccee8', '#fda5d5', '#fb64b6', '#f6339a', '#e60076', '#c6005c', '#a3004c', '#861043', '#510424'],
  rose: ['#fff1f2', '#ffe4e6', '#ffccd3', '#ffa1ad', '#ff637e', '#ff2056', '#ec003f', '#c70036', '#a50036', '#8b0836', '#4d0218'],
  slate: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cad5e2', '#90a1b9', '#62748e', '#45556c', '#314158', '#1d293d', '#0f172b', '#020618'],
  gray: ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5dc', '#99a1af', '#6a7282', '#4a5565', '#364153', '#1e2939', '#101828', '#030712'],
  zinc: ['#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#9f9fa9', '#71717b', '#52525c', '#3f3f46', '#27272a', '#18181b', '#09090b'],
  neutral: ['#fafafa', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a1a1a1', '#737373', '#525252', '#404040', '#262626', '#171717', '#0a0a0a'],
  stone: ['#fafaf9', '#f5f5f4', '#e7e5e4', '#d6d3d1', '#a6a09b', '#79716b', '#57534d', '#44403b', '#292524', '#1c1917', '#0c0a09'],
  mauve: ['#fafafa', '#f3f1f3', '#e7e4e7', '#d7d0d7', '#a89ea9', '#79697b', '#594c5b', '#463947', '#2a212c', '#1d161e', '#0c090c'],
  olive: ['#fbfbf9', '#f4f4f0', '#e8e8e3', '#d8d8d0', '#abab9c', '#7c7c67', '#5b5b4b', '#474739', '#2b2b22', '#1d1d16', '#0c0c09'],
  mist: ['#f9fbfb', '#f1f3f3', '#e3e7e8', '#d0d6d8', '#9ca8ab', '#67787c', '#4b585b', '#394447', '#22292b', '#161b1d', '#090b0c'],
  taupe: ['#fbfaf9', '#f3f1f1', '#e8e4e3', '#d8d2d0', '#aba09c', '#7c6d67', '#5b4f4b', '#473c39', '#2b2422', '#1d1816', '#0c0a09'],
};
const NEUTRAL_FAMILIES = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const CHROMATIC_FAMILIES = Object.keys(TAILWIND).filter(f => !NEUTRAL_FAMILIES.includes(f));

// ---------------------------------------------------------------- échelles cibles

const LOG21 = Math.log(21);

/**
 * L'échelle de shades Fusilier, avec un demi-pas d'inset aux extrémités.
 *
 * Fusilier raisonne sur des « shades » 0-200 où le contraste visé face au noir vaut
 * 21^(shade/200) : shade 200 = blanc pur, shade 0 = noir pur. Une échelle nommée
 * 50…950 ne doit toucher ni l'un ni l'autre (sinon les deux extrémités perdent leur
 * teinte), d'où l'inset : shade_i = 200 · (1 − (i+0.5)/n).
 *
 * Pour n = 11 : 191, 173, 155, 136, 118, 100, 82, 64, 45, 27, 9 — le step médian
 * tombe exactement sur shade 100, et chaque cran vaut 200/11 ≈ 18.2 shades.
 */
export function defaultShadeLadder(n) {
  return Array.from({ length: n }, (_, i) => 200 * (1 - (i + 0.5) / n));
}

/** Shade « naturel » d'une couleur : lu depuis son propre contraste face au noir. */
export const shadeOf = hex => (200 * Math.log(contrastVsBlack(hex))) / LOG21;

/** Position fractionnaire d'un shade sur une échelle de n crans (inverse de defaultShadeLadder). */
export const shadeToFractionalIndex = (shade, n) => (1 - shade / 200) * n - 0.5;

/**
 * Les garanties de contraste que l'échelle offre, exprimées en écart de rang.
 * Le contraste entre deux steps vaut ~21^(Δshade/200), donc Δrang ⇒ contraste est
 * connu par construction — c'est tout l'intérêt de la méthode.
 */
/**
 * Une règle ne s'écrit dans le nom que si elle tient avec une marge plus large que l'erreur
 * réelle : chaque cran rate sa cible de 0,9 % au plus (arrondi hex), une paire cumule deux
 * erreurs, et le mode sombre ajoute jusqu'à 1,2 % par paire. Mesuré par une relecture
 * adversariale : 1,5 % laissait passer 4,485:1 sur 10 crans et 6,90:1 en AAA sombre sur 17.
 * 4 % couvre le pire cas mesuré. Sur 11 crans, les règles restent 5 / 6 / 8 rangs.
 */
export const RULE_MARGIN = 0.04;

export function contrastRules(shadeLadder) {
  const perRank = (shadeLadder[0] - shadeLadder[shadeLadder.length - 1]) / (shadeLadder.length - 1);
  const ratioFor = d => Math.pow(21, (d * perRank) / 200);
  const firstRankAtLeast = threshold => {
    for (let d = 1; d < shadeLadder.length; d++) if (ratioFor(d) >= threshold * (1 + RULE_MARGIN)) return d;
    return null;
  };
  return {
    shadePerRank: perRank,
    ratioForRank: ratioFor,
    rankForAA: firstRankAtLeast(4.5),
    rankForAAA: firstRankAtLeast(7),
    rankForUI: firstRankAtLeast(3),
  };
}

// ---------------------------------------------------------------- placement des ancres

/**
 * Situe chaque couleur fournie sur l'échelle, à partir de son propre contraste face
 * au noir (donc sans dépendre d'aucune méthode de génération). Le rôle épinglé
 * — typiquement `default` — est placé d'office sur le step d'ancrage ; les autres
 * prennent leur rang naturel, et en cas de collision le mieux ajusté garde la place.
 */
export function placeAnchors(anchors, shadeLadder, { pinned = {} } = {}) {
  const n = shadeLadder.length;
  const isPinned = role => Object.prototype.hasOwnProperty.call(pinned, role);
  const clampIdx = i => Math.max(0, Math.min(n - 1, i));

  // Le rang se trouve en cherchant le cran dont la cible de contraste est la plus proche.
  // On ne peut pas le calculer par une formule : dès qu'une échelle reçoit des crans hors
  // grille (blanc et noir purs, demi-crans aux extrémités), elle n'est plus régulière.
  const rankOfShade = shade => {
    let best = 0, bd = Infinity;
    shadeLadder.forEach((s, i) => { const d = Math.abs(s - shade); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  // position fractionnaire, pour dire de combien la couleur tombe « entre deux crans »
  const fractionalOfShade = shade => {
    if (shade >= shadeLadder[0]) return 0;
    if (shade <= shadeLadder[n - 1]) return n - 1;
    for (let i = 1; i < n; i++) {
      if (shade >= shadeLadder[i]) {
        const a = shadeLadder[i - 1], b = shadeLadder[i];
        return i - 1 + (a - shade) / (a - b);
      }
    }
    return n - 1;
  };

  const raw = Object.entries(anchors)
    .filter(([, hex]) => !!hex)
    .map(([role, hex]) => {
      const shade = shadeOf(hex);
      return {
        role, hex, shade,
        naturalIndex: fractionalOfShade(shade),
        index: null, moved: false, pinned: isPinned(role),
      };
    });

  const sortKey = p => (p.pinned ? pinned[p.role] : p.naturalIndex);
  raw.sort((a, b) => sortKey(a) - sortKey(b));

  // Plusieurs ancres peuvent partager un rang : les décaler pour garantir l'unicité
  // déplacerait des couleurs loin de leur rang réel et finirait par en éjecter une. Une
  // collision est une information — « ces couleurs sont trop proches pour que cette échelle
  // les distingue » — et c'est justement ce qu'on veut voir.
  for (const p of raw) {
    p.index = p.pinned ? clampIdx(pinned[p.role]) : rankOfShade(p.shade);
  }

  const byIndex = new Map();
  for (const p of raw) {
    if (!byIndex.has(p.index)) byIndex.set(p.index, []);
    byIndex.get(p.index).push(p);
  }
  for (const group of byIndex.values()) {
    group.sort((a, b) => Math.abs(a.naturalIndex - a.index) - Math.abs(b.naturalIndex - b.index));
    group.forEach((p, k) => { p.crowded = group.length > 1; p.primary = k === 0; });
  }

  const placed = raw.sort((a, b) => a.index - b.index || (b.primary ? 1 : -1));
  return {
    placements: placed,
    byIndex: new Map([...byIndex].map(([i, g]) => [i, g[0]])),
    crowding: [...byIndex].filter(([, g]) => g.length > 1).map(([i, g]) => ({ index: i, roles: g.map(p => p.role) })),
  };
}

/** Step le plus proche d'une couleur dans une échelle donnée, au sens ΔE2000. */
export function nearestInScale(hex, scale) {
  let best = -1, bestD = Infinity;
  scale.forEach((c, i) => {
    if (!c) return;
    const d = deltaE2000Hex(hex, c);
    if (d < bestD) { bestD = d; best = i; }
  });
  return { index: best, deltaE: Math.round(bestD * 100) / 100 };
}

// ---------------------------------------------------------------- les méthodes

/** Existant : uniquement les couleurs réellement fournies, à leur rang naturel. */
function mExisting(ctx) {
  const out = new Array(ctx.n).fill(null);
  // plusieurs ancres peuvent partager un rang : on affiche la mieux ajustée
  for (const p of ctx.anchorPlacement.placements) if (p.primary !== false) out[p.index] = p.hex;
  return out;
}

/** OKLCH à luminosité fixe : même L pour toutes les teintes à un step donné. */
function mOklch(ctx) {
  const { C, H } = hexToOklch(ctx.seed);
  return ctx.ladders.oklchL.map(L => oklchToHex(L, C, H));
}

/** Fusilier : chaque step vise 21^(shade/200) face au noir. */
function mFusilier(ctx) {
  const { C, H } = hexToOklch(ctx.seed);
  return ctx.ladders.shade.map(shade => {
    const target = Math.pow(21, shade / 200);
    // le contraste face au noir croît avec L
    const L = bisectLightness(target, l => contrastVsBlack(oklchToHex(l, C, H)), { increasing: true });
    return oklchToHex(L, C, H);
  });
}

/**
 * Fusilier original : color-shades de David Fusilier, au hex près (colorshades.mjs). Mêmes cibles
 * que le Fusilier adapté ; la teinte et la saturation HSL de la couleur de départ sont gardées.
 */
function mColorshades(ctx) {
  return colorShades(ctx.seed, ctx.ladders.shade);
}

/** Mix blanc/noir en sRGB : la méthode naïve, sans notion perceptuelle. */
function mMix(ctx) {
  const seed = hexToRgb(ctx.seed);
  const { seedIndex, n } = ctx;
  return Array.from({ length: n }, (_, i) => {
    if (i === seedIndex) return rgbToHex(seed);
    const toward = i < seedIndex ? { r: 1, g: 1, b: 1 } : { r: 0, g: 0, b: 0 };
    const span = i < seedIndex ? seedIndex : n - 1 - seedIndex;
    const f = Math.abs(i - seedIndex) / span;
    return rgbToHex({ r: lerp(seed.r, toward.r, f), g: lerp(seed.g, toward.g, f), b: lerp(seed.b, toward.b, f) });
  });
}

/** HCT (Material) : tone fixe, hue et chroma CAM16 du seed, chroma ramenée au gamut. */
function mHct(ctx) {
  const { h, c } = hctFromHex(ctx.seed);
  return ctx.ladders.tone.map(t => hctToHex(h, c, t));
}

/**
 * Leonardo : la recherche de @adobe/leonardo-contrast-colors 1.1.0, portée à l'identique
 * (lib/leonardo.mjs) : une échelle blanc → seed → noir, le seed placé par sa clarté CIECAM02,
 * et sur elle, pour chaque ratio visé face au blanc (arrondi à deux décimales, comme la
 * librairie), le point que sa recherche retient. Interpolation OKLCH ; la librairie interpole
 * en RGB par défaut, l'autre réglage tient en un paramètre.
 */
function mLeonardo(ctx) {
  return leonardoColors(ctx.seed, ctx.ladders.leonardo, { colorSpace: 'OKLCH' });
}

/** APCA : chaque step vise un Lc pour du texte de cette couleur sur blanc. */
function mApca(ctx) {
  const { C, H } = hexToOklch(ctx.seed);
  return ctx.ladders.apca.map(target => {
    // Lc du texte sur blanc décroît quand L croît
    const L = bisectLightness(target, l => apcaLc(oklchToHex(l, C, H), '#ffffff'), { increasing: false });
    return oklchToHex(L, C, H);
  });
}

/** Interpolation Lab entre blanc, seed et noir, avec correction de luminosité. */
function mEasing(ctx) {
  // chroma.scale(['blanc', seed, 'noir']).mode('lab').correctLightness() : un chemin en deux
  // segments droits dans Lab, parcouru à clarté L* imposée. À la clarté du cran, on prend le
  // point du segment qui a cette clarté — c'est la clarté qui paramètre le chemin, pas le rang.
  const s = hexToLab(ctx.seed);
  return ctx.ladders.easingL.map(L => {
    const up = L >= s.L;
    const f = up ? (100 - L) / Math.max(1e-6, 100 - s.L) : (s.L - L) / Math.max(1e-6, s.L);
    const a = up ? s.a * f : s.a * (1 - f), b = up ? s.b * f : s.b * (1 - f);
    const { C, H } = labToLch({ L, a, b });
    return labToHex(lchToLab({ L, C: clipChromaLab(L, C, H), H }));
  });
}

/**
 * Courbes par canal (L, C, H) : la démarche de ColorBox et des palettes de Stripe, mise en
 * formule. Chaque canal suit sa propre courbe, ancrée sur le seed qui garde exactement sa
 * place : la clarté descend en douceur (sinus) du presque blanc au presque noir en passant par
 * celle du seed ; l'éclat culmine au seed et décroît vers les extrêmes ; la teinte tourne de
 * quelques degrés aux extrémités — vers la teinte lumineuse la plus proche (jaune, cyan,
 * magenta) en montant vers le clair, vers la plus sombre (rouge, vert, bleu) en descendant.
 * Belle à l'œil, régulière dans sa rampe ; mais d'une teinte à l'autre, rien n'aligne les
 * contrastes : aucune garantie au même cran.
 */
function mCurves(ctx) {
  const { n, seedIndex } = ctx;
  const s = hexToOklch(ctx.seed);
  const tS = seedIndex / (n - 1);
  const ease = u => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2;
  const toward = (H, targets, deg) => {
    const t = targets.reduce((b, x) => (Math.abs(hueDelta(H, x)) < Math.abs(hueDelta(H, b)) ? x : b));
    const d = hueDelta(H, t);
    return (H + Math.sign(d) * Math.min(Math.abs(d), deg) + 360) % 360;
  };
  return Array.from({ length: n }, (_, i) => {
    if (i === seedIndex) return ctx.seed;
    const t = i / (n - 1);
    const up = t < tS, u = up ? t / tS : (t - tS) / (1 - tS);
    const L = up ? 0.975 + (s.L - 0.975) * ease(u) : s.L + (0.2 - s.L) * ease(u);
    const C = s.C * (0.2 + 0.8 * Math.sin((Math.PI / 2) * (up ? u : 1 - u)));
    // jusqu'à 12° aux extrêmes, proportionnellement à la distance au seed
    const H = up ? toward(s.H, [60, 180, 300], 12 * (1 - u)) : toward(s.H, [0, 120, 240], 12 * u);
    return oklchToHex(L, clipChromaOk(L, C, H), H);
  });
}

/**
 * Tailwind : on adopte la famille dessinée la plus proche du seed.
 *
 * Chaque cran lit la famille au rang que sa cible de contraste lui donne sur la grille de
 * Tailwind (11 crans), pas à sa position dans la liste : avec des crans hors grille, le 500
 * n'est plus le 6e de la liste, et c'est au 500 de Tailwind qu'il doit se comparer.
 */
function mTailwind(ctx) {
  const families = ctx.isNeutral ? NEUTRAL_FAMILIES : CHROMATIC_FAMILIES;
  const twLen = TAILWIND.slate.length;
  const twIndex = i => Math.max(0, Math.min(twLen - 1, Math.round(shadeToFractionalIndex(ctx.ladders.shade[i], twLen))));
  const seedTw = twIndex(ctx.seedIndex);
  let best = families[0], bestD = Infinity;
  for (const fam of families) {
    const d = deltaE2000Hex(ctx.seed, TAILWIND[fam][seedTw]);
    if (d < bestD) { bestD = d; best = fam; }
  }
  const scale = TAILWIND[best];
  ctx.meta.tailwindFamily = best;
  ctx.meta.tailwindDeltaE = Math.round(bestD * 10) / 10;
  ctx.meta.tailwindHueShift = Math.round(hueDelta(hexToOklch(ctx.seed).H, hexToOklch(scale[seedTw]).H));
  return Array.from({ length: ctx.n }, (_, i) => scale[twIndex(i)]);
}

/**
 * Ancres + interpolation OKLCH : la colonne vertébrale Fusilier, corrigée pour passer
 * exactement par toutes les couleurs fournies.
 *
 * L'écart entre l'ancre et la colonne vertébrale est mesuré en OKLCH (ΔL, ΔC, ΔH) puis
 * interpolé linéairement entre ancres. Au-delà de l'ancre la plus extrême, la correction
 * de teinte et de saturation est maintenue (c'est l'identité de la marque) tandis que
 * celle de luminosité s'éteint progressivement (les extrémités doivent tenir leur cible
 * de contraste, sinon l'échelle perd ses garanties).
 */
function mAnchored(ctx) {
  const backbone = ctx.scales.fusilier;
  const pts = ctx.anchorPlacement.placements;
  if (!pts.length) return backbone.slice();

  const offsets = pts.map(p => {
    const a = hexToOklch(p.hex), b = hexToOklch(backbone[p.index]);
    return { index: p.index, dL: a.L - b.L, dC: a.C - b.C, dH: hueDelta(b.H, a.H) };
  }).sort((x, y) => x.index - y.index);

  const first = offsets[0], last = offsets[offsets.length - 1];
  return backbone.map((hex, i) => {
    let dL, dC, dH;
    if (i <= first.index) {
      const span = first.index || 1;
      dL = first.dL * (i / span); dC = first.dC; dH = first.dH;
    } else if (i >= last.index) {
      const span = (ctx.n - 1 - last.index) || 1;
      dL = last.dL * (1 - (i - last.index) / span); dC = last.dC; dH = last.dH;
    } else {
      const hi = offsets.findIndex(o => o.index >= i);
      const a = offsets[hi - 1], b = offsets[hi];
      const t = (i - a.index) / (b.index - a.index);
      dL = lerp(a.dL, b.dL, t); dC = lerp(a.dC, b.dC, t); dH = lerp(a.dH, b.dH, t);
    }
    const base = hexToOklch(hex);
    const exact = offsets.find(o => o.index === i);
    if (exact) return pts.find(p => p.index === i).hex; // l'ancre est reproduite telle quelle
    return oklchToHex(base.L + dL, Math.max(0, base.C + dC), (base.H + dH + 360) % 360);
  });
}

/**
 * Valeurs réglées à la main dans le régleur, à luminance verrouillée.
 * Un step non réglé retombe sur la méthode de base : on peut donc n'ajuster qu'une partie
 * d'une rampe et laisser le reste généré.
 */
function mTuned(ctx) {
  const base = ctx.scales[ctx.tunedBase] || ctx.scales.fusilier;
  if (!ctx.tuned) return base.slice();
  return ctx.steps.map((s, i) => ctx.tuned[s] || base[i]);
}

export const METHOD_IMPL = {
  existing: mExisting,
  anchored: mAnchored,
  tuned: mTuned,
  oklch: mOklch,
  fusilier: mFusilier,
  colorshades: mColorshades,
  mix: mMix,
  hct: mHct,
  leonardo: mLeonardo,
  apca: mApca,
  easing: mEasing,
  curves: mCurves,
  tailwind: mTailwind,
};

/** Ordre de calcul : `anchored` a besoin de `fusilier`, `existing` du placement des ancres. */
export const METHOD_COMPUTE_ORDER = [
  'oklch', 'fusilier', 'colorshades', 'mix', 'hct', 'leonardo', 'apca', 'easing', 'curves', 'tailwind', 'existing', 'anchored', 'tuned',
];

/** Méthodes creuses : elles n'ont pas de valeur à tous les steps. */
export const SPARSE_METHODS = new Set(['existing']);

// ---------------------------------------------------------------- échelles cibles dérivées

/**
 * Construit toutes les échelles cibles à partir du nombre de steps.
 * Leonardo prend les ratios qu'on lui donne : par défaut, les contrastes du barreau de
 * l'échelle (à ratios égaux avec Fusilier, pour comparer le reste) ; `leonardoReference`
 * rejoue ceux d'une rampe Tailwind (slate, zinc…).
 */
export function buildLadders(n, opts = {}) {
  const shade = opts.shadeLadder || defaultShadeLadder(n);
  const lin = (from, to) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));

  const refName = TAILWIND[opts.leonardoReference] ? opts.leonardoReference : null;
  const leonardo = refName
    ? Array.from({ length: n }, (_, i) => contrastVsWhite(TAILWIND[refName][Math.round((i / (n - 1)) * (TAILWIND[refName].length - 1))]))
    : shade.map(s => 21 ** ((200 - s) / 200));

  return {
    shade,
    // OKLCH à L fixe : bornes calées sur les extrémités « claires/foncées mais teintées »
    oklchL: opts.oklchL || lin(opts.oklchLMax ?? 0.965, opts.oklchLMin ?? 0.205),
    // HCT : tone = L*, même logique de bornes
    tone: opts.tone || lin(opts.toneMax ?? 95, opts.toneMin ?? 5),
    // Leonardo : ratios face au blanc, ceux du barreau ou d'une rampe de référence
    leonardo,
    leonardoReference: refName,
    // APCA : Lc cible, dérivé du même barreau de shades
    apca: shade.map(s => 106 * (1 - s / 200)),
    // interpolation Lab : luminosité linéaire de L*95 à L*5
    easingL: opts.easingL || lin(opts.easingLMax ?? 95, opts.easingLMin ?? 5),
  };
}

/**
 * Seed d'une déclinaison de teinte : le même couple luminosité/saturation, tourné de
 * `offset` degrés sur la roue OKLCH.
 *
 * Le gamut sRGB n'est pas isotrope : à luminosité égale, un jaune tient beaucoup moins de
 * chroma qu'un bleu. Une rotation de teinte peut donc coûter de la saturation, et c'est une
 * information utile en soi — on renvoie la chroma demandée et celle réellement obtenue.
 */
export function hueVariantSeed(seed, offset, space = 'hsl') {
  const before = hexToOklch(seed);
  let hex, hslHue = null, chromaLoss = 0;

  if (space === 'oklch') {
    // rotation perceptuelle : l'écart de teinte demandé est celui qu'on voit, mais le gamut
    // sRGB peut ne pas tenir la même saturation à la nouvelle teinte
    const hue = (before.H + offset + 360) % 360;
    const kept = clipChromaOk(before.L, before.C, hue);
    chromaLoss = Math.round((before.C - kept) * 1000) / 1000;
    hex = oklchToHex(before.L, before.C, hue);
  } else {
    // rotation HSL : le geste du sélecteur de couleur. Tout triplet HSL est un sRGB valide,
    // donc jamais de saturation sacrifiée — mais HSL n'est pas perceptuel, et 30° de roue
    // HSL ne valent pas 30° de teinte perçue. On mesure l'écart réel plutôt que de le taire.
    const hsl = hexToHsl(seed);
    hslHue = (hsl.h + offset + 360) % 360;
    hex = hslToHex({ ...hsl, h: hslHue });
  }

  const after = hexToOklch(hex);
  return {
    hex,
    space,
    hslHue: hslHue === null ? null : Math.round(hslHue * 10) / 10,
    hue: Math.round(after.H * 10) / 10,
    chroma: Math.round(after.C * 1000) / 1000,
    chromaLoss,
    chromaDelta: Math.round((after.C - before.C) * 1000) / 1000,
    lightnessDelta: Math.round((after.L - before.L) * 1000) / 1000,
    // ce que la rotation vaut réellement en teinte perçue
    perceivedRotation: Math.round((((after.H - before.H + 540) % 360) - 180) * 10) / 10,
  };
}

/** Métadonnées par couleur, telles que consommées par les graphiques et les swatches. */
export function swatchMeta(hex) {
  if (!hex) return null;
  const { L, C, H } = hexToOklch(hex);
  return {
    hex,
    oklch: [Math.round(L * 1000) / 1000, Math.round(C * 1000) / 1000, Math.round(H * 10) / 10],
    lstar: Math.round(hexToLstar(hex) * 10) / 10,
    cvw: Math.round(contrastVsWhite(hex) * 1000) / 1000,
    cvb: Math.round(contrastVsBlack(hex) * 1000) / 1000,
    shade: Math.round(shadeOf(hex) * 10) / 10,
    apcaOnWhite: Math.round(apcaLc(hex, '#ffffff') * 10) / 10,
    apcaWhiteOn: Math.round(apcaLc('#ffffff', hex) * 10) / 10,
  };
}
