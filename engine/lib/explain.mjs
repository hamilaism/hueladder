// Comprendre : les méthodes de génération, comparées sans parti pris. Le cadre (espace,
// méthode, outil), les familles, chaque méthode avec ce qu'elle rend égal d'une teinte à
// l'autre et comment elle répartit les crans, ce que chacune donne sur des couleurs données,
// les constats qui en sortent, de quoi choisir et de quoi présenter — chaque phrase chiffrée
// calculée depuis les chiffres. Partagé par le studio (entrée Comprendre) et la CLI (`hueladder explain`).
//
// Le corpus d'exemple est synthétique : neuf couleurs de départ, aucune couleur de client.

import { oklchToHex, relativeLuminance } from './color.mjs';
import { NAMINGS, ruleWords } from './naming.mjs';

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const fmt = en => (x, d = 1) => round(x, d).toLocaleString(en ? 'en-US' : 'fr-FR');
// un ratio se tronque, il ne s'arrondit pas : pas de « 3,00:1 » pour un vrai 2,998
const ratioOf = en => x => { const s = (Math.floor(x * 100) / 100).toFixed(2); return (en ? s : s.replace('.', ',')) + ':1'; };
// le pluriel : « 0 changement », mais « 0 changes »
const plur = en => (n, one, many) => n + ' ' + ((en ? n !== 1 : n > 1) ? many : one);
const listOf = en => xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + (en ? ' and ' : ' et ') + xs[xs.length - 1]);
const strip = s => String(s).replace(/<[^>]+>/g, '');
const contrastY = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// ---------------------------------------------------------------- le corpus d'exemple

// Neuf couleurs de départ réparties sur le cercle, à des clartés de marque réalistes : un jaune
// très clair, des bleus et violets sombres, un neutre. Rien d'autre n'est fourni : chaque
// méthode part de ces neuf couleurs, et c'est tout.
const DEMO = [
  ['red', 'Rouge', 'Red', 0.58, 0.19, 27], ['orange', 'Orange', 'Orange', 0.7, 0.17, 55],
  ['yellow', 'Jaune', 'Yellow', 0.86, 0.17, 95], ['green', 'Vert', 'Green', 0.62, 0.15, 150],
  ['teal', 'Turquoise', 'Teal', 0.65, 0.11, 195], ['blue', 'Bleu', 'Blue', 0.55, 0.2, 262],
  ['violet', 'Violet', 'Violet', 0.52, 0.2, 300], ['pink', 'Rose', 'Pink', 0.64, 0.19, 350],
  ['neutral', 'Neutre', 'Neutral', 0.55, 0.01, 260],
];

export function demoSpec(lang = 'en') {
  const en = lang === 'en';
  return {
    id: 'demo', brand: en ? 'Example' : 'Exemple', lang, naming: 'grid', stepList: NAMINGS.grid.presets.standard.slice(),
    source: 'Hueladder', pinDefault: true, demo: true,
    title: en ? 'Generation methods compared — synthetic example' : 'Comparaison des méthodes — exemple synthétique',
    ramps: DEMO.map(([name, fr, enl, L, C, H]) => ({ name, label: en ? enl : fr, kind: name === 'neutral' ? 'neutral' : 'product', anchors: { default: oklchToHex(L, C, H) } })),
  };
}

// ---------------------------------------------------------------- le propos et le cadre

export const THESIS = {
  fr: 'Une méthode décide de deux choses : ce qui reste égal d\'une teinte à l\'autre au même cran (la luminance, la clarté perçue, la couleur de départ, ou rien), et la façon dont les crans se répartissent du clair au foncé. Chaque choix se paie ailleurs ; cette page mesure où, sur les mêmes couleurs.',
  en: 'A method decides two things: what stays equal from one hue to another at the same step (luminance, perceived lightness, the starting colour, or nothing), and how the steps spread from light to dark. Each choice is paid for somewhere else; this page measures where, on the same colours.',
};
export const DEFAULT_CHOICE = {
  fr: 'Hueladder propose Fusilier par défaut pour un critère : des intervalles réguliers, si bien que le contraste entre deux crans se lit dans l\'écart de leurs noms (ce que Hueladder appelle la « règle du nom »). C\'est une préférence de prévisibilité, pas un classement : sur d\'autres critères, d\'autres méthodes font mieux, et le tableau le montre.',
  en: 'Hueladder offers Fusilier by default for one criterion: even intervals, so that the contrast between two steps can be read from the gap between their names (what Hueladder calls the “naming rule”). It is a preference for predictability, not a ranking: on other criteria other methods do better, and the table shows it.',
};

export const FRAME = {
  fr: {
    title: 'Trois mots qu\'on confond',
    space: ['L\'espace', 'la géométrie dans laquelle on calcule : HSL, OKLCH, CIELAB, CAM16. Il ne décide rien.'],
    method: ['La méthode', 'la règle qui décide la couleur de chaque cran : une clarté fixe, un contraste visé, un mélange.'],
    tool: ['L\'outil', 'ce qui l\'exécute : accessiblepalette, Leonardo, chroma.js, Material. Un outil peut porter une méthode, ou aucune.'],
    quad: 'Une méthode complète est un quadruplet : la règle de distribution, l\'espace de calcul, la gestion du gamut, la politique de seed. Deux outils qui revendiquent « la même méthode » peuvent différer sur les trois derniers, et donner des rampes différentes.',
    proof: 'Mesuré : à règle identique, ramener une couleur dans l\'écran en écrêtant le RGB (ou avec la réduction par défaut de CSS Color 4) fait tourner la teinte, jusqu\'à des dizaines de degrés pour un jaune très foncé ; réduire la chroma à teinte et clarté constantes ne la touche pas. Ici, toutes les méthodes passent par cette même réduction, pour que seule leur règle diffère.',
  },
  en: {
    title: 'Three words people mix up',
    space: ['The space', 'the geometry you compute in: HSL, OKLCH, CIELAB, CAM16. It decides nothing.'],
    method: ['The method', 'the rule that decides each step\'s colour: a fixed lightness, a target contrast, a mix.'],
    tool: ['The tool', 'what runs it: accessiblepalette, Leonardo, chroma.js, Material. A tool can carry a method, or none.'],
    quad: 'A complete method is a quadruple: the distribution rule, the computation space, the gamut handling, the seed policy. Two tools claiming “the same method” can differ on the last three, and produce different ramps.',
    proof: 'Measured: with the same rule, bringing a colour back into the screen by clipping RGB (or with CSS Color 4\'s default mapping) turns the hue, by tens of degrees for a very dark yellow; reducing chroma at constant hue and lightness leaves it alone. Here every method goes through that same reduction, so that only its rule differs.',
  },
};

/** Les familles de méthodes, selon ce qu'elles rendent égal d'une teinte à l'autre. */
export const FAMILIES = [
  { key: 'device', methods: ['existing', 'mix'],
    fr: ['Espace machine', 'On mélange en sRGB, ou l\'on fait varier la clarté HSL. Rien n\'est égal d\'une teinte à l\'autre : à cran égal, chaque teinte a son propre contraste ; en échange, la couleur de départ reste exactement à sa place.'],
    en: ['Device space', 'Mix in sRGB, or vary HSL lightness. Nothing is equal from one hue to another: at equal step, each hue has its own contrast; in exchange, the starting colour stays exactly where it is.'] },
  { key: 'perceptual', methods: ['oklch', 'hct', 'easing'],
    fr: ['Clarté perçue', 'La même clarté perçue à cran égal, sur une échelle de clarté régulière. Avec L* (HCT, Lab), la clarté ne dépend que de la luminance : toutes les teintes ont le même contraste. Avec OKLCH, elle dépend aussi de la teinte : le contraste varie un peu. L\'échelle de clarté ne vise pas les seuils de contraste.'],
    en: ['Perceived lightness', 'The same perceived lightness at equal step, on an even lightness scale. With L* (HCT, Lab), lightness depends on luminance only: every hue has the same contrast. With OKLCH it also depends on the hue: contrast varies a little. The lightness scale does not aim at contrast thresholds.'] },
  { key: 'contrast', methods: ['fusilier', 'colorshades', 'leonardo', 'apca'],
    fr: ['Contraste visé', 'Chaque cran vise un contraste, donc une luminance, la même pour toutes les teintes. Leonardo prend les ratios qu\'on lui donne ; Fusilier les fixe en progression logarithmique, pour que l\'écart entre deux noms donne leur contraste (dans son outil, color-shades, et dans la version adaptée de Hueladder) ; APCA vise une autre mesure du contraste, celle du brouillon WCAG 3.'],
    en: ['Target contrast', 'Each step aims at a contrast, hence a luminance, the same for every hue. Leonardo takes the ratios you give it; Fusilier sets them on a logarithmic progression, so that the gap between two names gives their contrast (in his tool, color-shades, and in Hueladder\'s adapted version); APCA aims at another measure of contrast, the WCAG 3 draft\'s.'] },
  { key: 'curves', methods: ['curves'],
    fr: ['Courbes par canal', 'Clarté, éclat et teinte suivent chacun leur courbe autour de la couleur de départ (ColorBox, Stripe). Chaque rampe est régulière et soignée ; d\'une teinte à l\'autre, les clartés ne s\'alignent pas.'],
    en: ['Per-channel curves', 'Lightness, chroma and hue each follow their own curve around the starting colour (ColorBox, Stripe). Each ramp is even and polished; from one hue to another, lightness does not line up.'] },
  { key: 'manual', methods: ['tailwind'],
    fr: ['Dessin manuel', 'Pas de formule : l\'œil, teinte par teinte, sur une palette éprouvée. Le jugement porte sur chaque teinte, pas sur l\'alignement entre teintes.'],
    en: ['Hand-drawn', 'No formula: the eye, hue by hue, on a proven palette. Judgement is about each hue, not about lining hues up.'] },
];
export const familyOf = m => (FAMILIES.find(f => f.methods.includes(m)) || {}).key || null;
export const BEYOND = {
  fr: 'Hors de ce panorama : l\'optimisation sous contraintes, les colormaps scientifiques (viridis), et les couleurs relatives de CSS, qui exécutent une méthode au moment de l\'affichage sans en être une.',
  en: 'Outside this panorama: constrained optimisation, scientific colormaps (viridis), and CSS relative colours, which run a method at display time without being one.',
};

// ---------------------------------------------------------------- chaque méthode, à la main

// Ce qui ne se calcule pas : ce que la méthode rend égal entre teintes, comment elle répartit
// les crans, quand la choisir, ce qu'il faut savoir, qui la porte. Aucun chiffre : ils viennent
// des mesures. `lum` : la méthode donne la même luminance à toutes les teintes d'un même cran.
export const METHOD_NOTES = {
  existing: { tool: null,
    fr: { equal: 'rien de particulier : ce sont tes couleurs', spread: 'chaque couleur au cran que lui donne son contraste ; des crans peuvent rester vides', when: 'C\'est le point de départ : on mesure contre tes couleurs ce que chaque méthode change.', watch: 'Ses totaux portent sur moins de couleurs : ils ne se comparent pas à ceux d\'une méthode qui remplit tous les crans.' },
    en: { equal: 'nothing in particular: these are your colours', spread: 'each colour at the step its contrast gives it; some steps may stay empty', when: 'The starting point: what each method changes is measured against your colours.', watch: 'Its totals cover fewer colours: they do not compare with those of a method that fills every step.' } },
  anchored: { tool: null,
    fr: { equal: 'à peu près le contraste : la colonne de Fusilier, tordue pour passer exactement par les couleurs de départ', spread: 'celle de Fusilier, corrigée vers les couleurs de départ', when: 'Tu ne veux rien jeter de tes couleurs, et combler les crans manquants avec une logique.', watch: 'Près des couleurs de départ, le contraste suit ces couleurs plutôt que le barreau.' },
    en: { equal: 'roughly the contrast: Fusilier\'s backbone, bent to pass exactly through the starting colours', spread: 'Fusilier\'s, corrected towards the starting colours', when: 'You want to throw none of your colours away, and fill the missing steps with some logic.', watch: 'Near the starting colours, contrast follows those colours rather than the ladder.' } },
  oklch: { tool: ['accessiblepalette.com (Eugene Fedorenko)', 'https://accessiblepalette.com'],
    fr: { equal: 'la clarté perçue (L d\'OKLCH)', spread: 'une clarté qui descend régulièrement d\'un cran à l\'autre', when: 'Tu veux une règle qui se dit en une phrase et un calcul standard (CSS Color 4).', watch: 'La clarté OKLCH dépend aussi de la teinte : à cran égal, le contraste varie un peu d\'une teinte à l\'autre.' },
    en: { equal: 'perceived lightness (OKLCH L)', spread: 'a lightness that steps down evenly', when: 'You want a rule you can say in one sentence and a standard computation (CSS Color 4).', watch: 'OKLCH lightness also depends on the hue: at equal step, contrast varies a little from one hue to another.' } },
  fusilier: { tool: ['color-shades (David Fusilier)', 'https://github.com/dfusilier/color-shades'], lum: true,
    fr: { equal: 'le contraste, donc la luminance', spread: 'des contrastes en progression logarithmique : le même intervalle entre deux crans voisins, partout', when: 'Tu veux que l\'écart entre deux noms suffise à connaître leur contraste, pour toutes les teintes.', watch: 'La couleur de départ se déplace jusqu\'à la luminance de son Hueladder. La formule se dit moins facilement à l\'oral ; l\'outil d\'origine est un script communautaire, que Hueladder réimplémente.' },
    en: { equal: 'contrast, hence luminance', spread: 'contrasts on a logarithmic progression: the same interval between two neighbouring steps, everywhere', when: 'You want the gap between two names to be enough to know their contrast, for every hue.', watch: 'The starting colour moves to its step\'s luminance. The formula is harder to say out loud; the original tool is a community script, which Hueladder reimplements.' } },
  colorshades: { tool: ['color-shades (David Fusilier)', 'https://github.com/dfusilier/color-shades'], lum: true,
    fr: { equal: 'le contraste, donc la luminance', spread: 'les mêmes contrastes que le Fusilier adapté, en progression logarithmique', when: 'Tu veux exactement ce que donne l\'outil de David Fusilier, ou comparer ses couleurs à celles de la version adaptée.', watch: 'Teinte et saturation HSL gardées : la teinte perçue peut glisser vers les extrêmes, ce que la version adaptée évite en travaillant en OKLCH. Le régleur et le mode sombre de Hueladder, eux, travaillent toujours en OKLCH.' },
    en: { equal: 'contrast, hence luminance', spread: 'the same contrasts as the adapted Fusilier, on a logarithmic progression', when: 'You want exactly what David Fusilier\'s tool gives, or to compare its colours with the adapted version\'s.', watch: 'HSL hue and saturation kept: perceived hue can drift towards the ends, which the adapted version avoids by working in OKLCH. Hueladder\'s tuner and dark mode always work in OKLCH.' } },
  mix: { tool: ['Sass mix(), Bootstrap', 'https://sass-lang.com/documentation/modules/color/'],
    fr: { equal: 'rien : la couleur de départ reste exactement à son cran', spread: 'un mélange linéaire avec le blanc et le noir, en sRGB', when: 'Ta couleur de départ ne doit pas bouger d\'un iota.', watch: 'Chaque teinte garde son propre contraste à chaque cran : un usage se vérifie teinte par teinte. La teinte se délave vers les extrêmes.' },
    en: { equal: 'nothing: the starting colour stays exactly at its step', spread: 'a linear mix with white and black, in sRGB', when: 'Your starting colour must not move at all.', watch: 'Each hue keeps its own contrast at every step: a usage is checked hue by hue. The hue washes out towards the ends.' } },
  hct: { tool: ['material-color-utilities (Google)', 'https://github.com/material-foundation/material-color-utilities'], lum: true,
    fr: { equal: 'le ton HCT, c\'est-à-dire la clarté L*, donc la luminance', spread: 'des tons régulièrement espacés', when: 'Ta cible est Android ou Material You, ou tu veux le modèle d\'apparence de Material.', watch: 'Les tons ne visent pas les seuils de contraste : un cran peut tomber juste sous un seuil, pour toutes les teintes à la fois.' },
    en: { equal: 'HCT tone, that is L* lightness, hence luminance', spread: 'evenly spaced tones', when: 'You target Android or Material You, or want Material\'s appearance model.', watch: 'Tones do not aim at contrast thresholds: a step can fall just under a threshold, for every hue at once.' } },
  leonardo: { tool: ['Leonardo (Nate Baldwin, Adobe)', 'https://github.com/adobe/leonardo'], lum: true,
    fr: { equal: 'le contraste face au fond, donc la luminance', spread: 'les ratios qu\'on lui donne ; ici, les mêmes cibles que le barreau de l\'échelle, pour comparer à ratios égaux', when: 'Tu veux choisir toi-même le contraste de chaque cran, face à un fond clair ou sombre.', watch: 'La couleur est prise sur une échelle blanc → couleur → noir : vers le blanc, l\'éclat s\'éteint. Avec d\'autres ratios, la répartition change avec eux.' },
    en: { equal: 'contrast against the background, hence luminance', spread: 'the ratios you give it; here, the same targets as the scale\'s ladder, to compare at equal ratios', when: 'You want to choose the contrast of each step yourself, against a light or dark background.', watch: 'The colour is taken on a white → colour → black scale: towards white, chroma fades. With other ratios, the spread changes with them.' } },
  apca: { tool: ['APCA (Andrew Somers, Myndex)', 'https://github.com/Myndex/apca-w3'], lum: true,
    fr: { equal: 'le contraste APCA face au blanc, donc la luminance', spread: 'un contraste APCA (Lc) qui progresse régulièrement', when: 'Tu prépares l\'après-WCAG 2, ou tu veux juger la lisibilité selon APCA, qui tient compte du sens du contraste.', watch: 'APCA n\'est pas normatif aujourd\'hui. Jugée en WCAG 2, une rampe APCA demande plus d\'écart de crans pour les mêmes seuils.' },
    en: { equal: 'APCA contrast against white, hence luminance', spread: 'an APCA contrast (Lc) that rises evenly', when: 'You are preparing for after WCAG 2, or want to judge legibility with APCA, which accounts for contrast polarity.', watch: 'APCA is not normative today. Judged by WCAG 2, an APCA ramp needs a larger step gap for the same thresholds.' } },
  easing: { tool: ['chroma.js (Gregor Aisch)', 'https://gka.github.io/chroma.js/'], lum: true,
    fr: { equal: 'la clarté L*, donc la luminance', spread: 'une clarté L* qui descend régulièrement, sur une échelle blanc → couleur → noir en Lab', when: 'Tu veux des rampes douces, faciles à refaire avec chroma.js.', watch: 'Comme HCT, une clarté régulière ne vise pas les seuils de contraste.' },
    en: { equal: 'L* lightness, hence luminance', spread: 'an L* lightness that steps down evenly, on a white → colour → black scale in Lab', when: 'You want smooth ramps, easy to redo with chroma.js.', watch: 'Like HCT, an even lightness does not aim at contrast thresholds.' } },
  curves: { tool: ['ColorBox (Lyft)', 'https://colorbox.io'],
    fr: { equal: 'rien d\'une teinte à l\'autre ; dans une rampe, des courbes régulières', spread: 'une courbe de clarté, d\'éclat et de teinte autour de la couleur de départ', when: 'Tu veux des rampes soignées une à une, avec une teinte qui tourne vers les extrêmes.', watch: 'Chaque rampe a ses propres clartés : à cran égal, le contraste dépend de la teinte.' },
    en: { equal: 'nothing from one hue to another; within a ramp, even curves', spread: 'a curve of lightness, chroma and hue around the starting colour', when: 'You want ramps polished one by one, with a hue that turns towards the ends.', watch: 'Each ramp has its own lightness: at equal step, contrast depends on the hue.' } },
  tailwind: { tool: ['Tailwind CSS', 'https://tailwindcss.com/docs/colors'],
    fr: { equal: 'rien : chaque famille est dessinée à la main', spread: 'celle de la famille Tailwind la plus proche', when: 'Tu veux une palette éprouvée et connue des équipes, sans rien générer.', watch: 'Tes couleurs deviennent celles de Tailwind ; à cran égal, le contraste dépend de la famille.' },
    en: { equal: 'nothing: each family is drawn by hand', spread: 'that of the closest Tailwind family', when: 'You want a proven palette teams already know, without generating anything.', watch: 'Your colours become Tailwind\'s; at equal step, contrast depends on the family.' } },
};

// Les réglages : ce que Hueladder a choisi pour chaque méthode, et en quoi il s'écarte de l'auteur
// quand la méthode vient d'ailleurs. Une méthode tierce se règle comme son auteur la règle ; sinon on le dit.
export const SETTINGS = {
  fr: {
    anchored: 'Fusilier sert de colonne. À chaque couleur de départ, l\'écart en OKLCH (clarté, éclat, teinte) est mesuré, puis interpolé d\'une couleur à l\'autre ; au-delà de la dernière, teinte et éclat restent corrigés, la clarté revient vers Fusilier.',
    oklch: 'Clarté OKLCH de 0,965 au cran le plus clair à 0,205 au plus foncé, en ligne droite ; éclat et teinte de la couleur de départ, éclat réduit si la couleur sort de l\'écran. Réglable dans la spec : ladders.oklchLMax, ladders.oklchLMin.',
    fusilier: 'Contraste visé face au noir : 21^(shade/200), avec shade = 200 × (1 − (rang + 0,5) / nombre de crans) ; éclat et teinte OKLCH de la couleur de départ, éclat réduit à clarté et teinte constantes si besoin. Les cibles suivent la nomenclature choisie. Adapté par Hueladder : color-shades, l\'outil de David Fusilier, garde la teinte et la saturation HSL ; ici, la teinte et l\'éclat OKLCH, l\'espace où travaillent aussi le régleur, le mode sombre et les ancres. Mêmes contrastes, couleurs un peu différentes (ΔE2000 de 2,6 en moyenne sur l\'exemple, jusqu\'à 12,6) : la méthode « Fusilier original » donne celles de l\'outil, pour comparer.',
    colorshades: 'color-shades de David Fusilier (commit 1c944dc), reproduit au hex près avec colorjs.io 0.4.1, la version qu\'il utilise : les cibles du Fusilier adapté, atteintes par sa recherche binaire sur la luminosité HSL, teinte et saturation HSL de la couleur de départ gardées (ses réglages par défaut : aucune teinte ni saturation de départ ou d\'arrivée), arrêt dès que le contraste face au noir est entre la cible et la cible + 0,005. Aucun écart à l\'outil.',
    mix: 'Mélange en sRGB avec le blanc au-dessus de la couleur de départ et le noir en dessous, en parts égales d\'un cran à l\'autre ; la couleur de départ reste à son cran. Bootstrap, lui, mélange par pas de 20 %.',
    hct: 'Tons HCT de 95 au cran le plus clair à 5 au plus foncé, un par cran choisi, régulièrement espacés ; teinte et chroma HCT de la couleur de départ, chroma réduite au gamut comme le fait Material. Material fixe ses propres tons (0, 10, 20 … 90, 95, 99, 100) ; ici, comme pour toutes les méthodes, ce sont les crans choisis qui les fixent. Réglable dans la spec : ladders.toneMax, ladders.toneMin.',
    leonardo: 'Librairie @adobe/leonardo-contrast-colors 1.1, reproduite au hex près : même recherche, ratios arrondis à deux décimales, couleurs écrêtées en RGB comme chroma.js. Une seule couleur clé, sans lissage. Interpolation choisie par Hueladder : OKLCH (la librairie interpole en RGB par défaut). Ratios visés face au blanc : lus dans les crans choisis, comme pour Fusilier, pour comparer à ratios égaux. Réglable dans la spec : ladders.leonardoReference (les ratios d\'une rampe Tailwind).',
    apca: 'APCA est une mesure de contraste, pas un générateur : c\'est Hueladder qui en fait un. Chaque cran vise un Lc face au blanc, Lc = 106 × (1 − shade/200), shade lu dans les crans choisis comme pour Fusilier, soit de 5 à 101 sur l\'échelle standard, avec l\'éclat et la teinte de la couleur de départ. Ce réglage est celui de Hueladder, pas une recommandation d\'Andrew Somers.',
    easing: 'chroma.scale([blanc, couleur, noir]).mode(\'lab\').correctLightness() : clarté L* de 95 au cran le plus clair à 5 au plus foncé, en ligne droite. Réglable dans la spec : ladders.easingLMax, ladders.easingLMin.',
    curves: 'Ce n\'est pas l\'algorithme de ColorBox : Hueladder met sa démarche en formule. La clarté suit une courbe en sinus du presque blanc au presque noir en passant par la couleur de départ, l\'éclat culmine à la couleur de départ, la teinte tourne jusqu\'à 12° aux extrêmes.',
    tailwind: 'La famille Tailwind (v4) la plus proche de la couleur de départ, à son cran (ΔE2000), recopiée telle quelle : aucune couleur n\'est générée.',
  },
  en: {
    anchored: 'Fusilier is the backbone. At each starting colour, the OKLCH offset (lightness, chroma, hue) is measured, then interpolated from one colour to the next; beyond the last one, hue and chroma stay corrected and lightness returns to Fusilier.',
    oklch: 'OKLCH lightness from 0.965 at the lightest step to 0.205 at the darkest, in a straight line; chroma and hue of the starting colour, chroma reduced when the colour leaves the screen gamut. Adjustable in the spec: ladders.oklchLMax, ladders.oklchLMin.',
    fusilier: 'Target contrast against black: 21^(shade/200), with shade = 200 × (1 − (rank + 0.5) / number of steps); OKLCH chroma and hue of the starting colour, chroma reduced at constant lightness and hue when needed. The targets follow the chosen naming. Adapted by Hueladder: color-shades, David Fusilier\'s tool, keeps the HSL hue and saturation; here, the OKLCH hue and chroma, the space the tuner, dark mode and anchors also work in. Same contrasts, slightly different colours (ΔE2000 2.6 on average on the example, up to 12.6): the “Fusilier, original” method gives the tool\'s, for comparison.',
    colorshades: 'David Fusilier\'s color-shades (commit 1c944dc), reproduced to the hex with colorjs.io 0.4.1, the version it uses: the adapted Fusilier\'s targets, reached by its binary search on HSL lightness, the starting colour\'s HSL hue and saturation kept (its defaults: no start or end hue or saturation), stopping as soon as the contrast against black is between the target and the target + 0.005. No departure from the tool.',
    mix: 'sRGB mix with white above the starting colour and black below it, in equal parts from one step to the next; the starting colour stays at its step. Bootstrap mixes in 20% steps.',
    hct: 'HCT tones from 95 at the lightest step to 5 at the darkest, one per chosen step, evenly spaced; HCT hue and chroma of the starting colour, chroma reduced to the gamut the way Material does it. Material sets its own tones (0, 10, 20 … 90, 95, 99, 100); here, as for every method, the chosen steps set them. Adjustable in the spec: ladders.toneMax, ladders.toneMin.',
    leonardo: '@adobe/leonardo-contrast-colors 1.1 library, reproduced to the hex: the same search, ratios rounded to two decimals, colours clipped in RGB as chroma.js does. A single key colour, no smoothing. Interpolation chosen by Hueladder: OKLCH (the library interpolates in RGB by default). Target ratios against white: read from the chosen steps, as for Fusilier, to compare at equal ratios. Adjustable in the spec: ladders.leonardoReference (the ratios of a Tailwind ramp).',
    apca: 'APCA is a contrast measure, not a generator: Hueladder turns it into one. Each step targets an Lc against white, Lc = 106 × (1 − shade/200), shade read from the chosen steps as for Fusilier, from 5 to 101 on the standard scale, with the chroma and hue of the starting colour. This setting is Hueladder\'s, not a recommendation by Andrew Somers.',
    easing: 'chroma.scale([white, colour, black]).mode(\'lab\').correctLightness(): L* lightness from 95 at the lightest step to 5 at the darkest, in a straight line. Adjustable in the spec: ladders.easingLMax, ladders.easingLMin.',
    curves: 'This is not ColorBox\'s algorithm: Hueladder puts its approach into a formula. Lightness follows a sine curve from near white to near black through the starting colour, chroma peaks at the starting colour, hue turns up to 12° at the ends.',
    tailwind: 'The Tailwind (v4) family closest to the starting colour at its step (ΔE2000), copied as is: no colour is generated.',
  },
};

// Ce qu'aucun choix de méthode ne règle : à dire avant qu'une équipe en attende tout.
export const SAME = {
  fr: [
    'Les seuils : 3, 4,5 et 7:1 en WCAG 2 (ou les niveaux de Lc en APCA). Une méthode change les paires qui les atteignent, pas les seuils.',
    'Les noms et le nombre de crans : ils viennent de la nomenclature, choisie à part. C\'est le nombre de crans qui fixe les cibles de chaque méthode (contrastes de Fusilier et de Leonardo, Lc d\'APCA, tons de HCT, clartés d\'OKLCH et de chroma.js), pas la méthode.',
    'Le travail de fond : décider, famille par famille, ce qu\'on garde, ce qu\'on régénère et ce qu\'on fusionne. L\'effort de migration dépend de ce que couvre la palette, pas de la formule.',
  ],
  en: [
    'The thresholds: 3, 4.5 and 7:1 under WCAG 2 (or Lc levels under APCA). A method changes which pairs reach them, not the thresholds.',
    'The names and the number of steps: they come from the naming, chosen separately. The number of steps sets each method\'s targets (Fusilier\'s and Leonardo\'s contrasts, APCA\'s Lc, HCT\'s tones, OKLCH\'s and chroma.js\'s lightness), not the method.',
    'The groundwork: deciding, family by family, what to keep, what to regenerate and what to merge. Migration effort depends on what the palette covers, not on the formula.',
  ],
};

// ---------------------------------------------------------------- ce que chaque méthode donne

/** Les couleurs réelles d'une méthode, cran par cran, avec leur luminance et leur rang. */
function swatches(data, m) {
  const out = [];
  for (const r of data.ramps) {
    if (r.derived || !r.colors[m]) continue;
    r.colors[m].forEach((hex, i) => { if (hex && data.meta.isCore[i]) out.push({ ramp: r.label || r.name, step: data.meta.steps[i], i, rank: data.meta.rankOf[i], Y: relativeLuminance(hex) }); });
  }
  return out;
}

/**
 * Le plus petit écart de crans qui garantit un seuil pour **toutes** les paires, toutes teintes
 * confondues : la règle que chaque méthode offre, mesurée sur elle-même.
 */
function safeGaps(sw) {
  const minAt = [];
  for (let a = 0; a < sw.length; a++) for (let b = a + 1; b < sw.length; b++) {
    const g = Math.abs(sw[a].rank - sw[b].rank);
    if (!g) continue;
    const c = contrastY(sw[a].Y, sw[b].Y);
    if (minAt[g] === undefined || c < minAt[g]) minAt[g] = c;
  }
  const safe = th => { let d = null; for (let g = minAt.length - 1; g >= 1; g--) { if (minAt[g] === undefined) continue; if (minAt[g] < th) break; d = g; } return d; };
  return { 3: safe(3), 4.5: safe(4.5), 7: safe(7) };
}

/** Le contraste entre deux crans voisins, du plus serré au plus large. */
function intervals(sw) {
  let min = null, max = null;
  for (let k = 1; k < sw.length; k++) {
    const a = sw[k - 1], b = sw[k];
    if (a.ramp !== b.ramp || b.rank - a.rank !== 1) continue;
    const c = contrastY(a.Y, b.Y);
    if (!min || c < min.ratio) min = { ratio: c, ramp: a.ramp, a: a.step, b: b.step };
    if (!max || c > max.ratio) max = { ratio: c, ramp: a.ramp, a: a.step, b: b.step };
  }
  return { min, max };
}

const ROWS = new WeakMap();
/** Une méthode, mesurée : ce qu'elle donne, sans jugement. */
export function methodRow(data, m) {
  if (!ROWS.has(data)) ROWS.set(data, {});
  const cache = ROWS.get(data);
  if (cache[m]) return cache[m];
  const x = data.metrics[m], sw = swatches(data, m), iv = intervals(sw);
  return (cache[m] = {
    method: m, label: data.methods[m].label, family: familyOf(m), sparse: !!x.sparse,
    pairsAA: x.pairsAA, pairsAAA: x.pairsAAA, total: x.totalPairs,
    crossings: x.interchangeability?.light?.crossingPairs ?? null, spread: x.meanSpread,
    safe: safeGaps(sw), intervalMin: iv.min, intervalMax: iv.max,
    drift: x.drift ? x.drift.meanDE : null, kept: x.gamut ? x.gamut.meanKept : null,
  });
}

/** Les méthodes comparées. L'existant n'y entre que si des couleurs ont été fournies, au-delà d'une par teinte. */
export function methodTable(data) {
  const supplied = (data.anchorMap || []).length > data.meta.rampCount;
  return data.methodOrder.filter(m => data.metrics[m] && !['tuned', 'anchored'].includes(m) && (m !== 'existing' || supplied)).map(m => methodRow(data, m));
}

/** Sur combien de teintes une paire tient son seuil, avec une méthode, et les couleurs en jeu. */
export function pairScore(data, m, fg, bg, threshold) {
  const pick = (r, tok) => (tok === 'W' ? '#ffffff' : tok === 'B' ? '#000000' : r.colors[m][data.meta.steps.indexOf(tok)]);
  const cells = data.ramps.filter(r => !r.derived && r.colors[m]).map(r => {
    const a = pick(r, fg), b = pick(r, bg);
    return a && b ? { ramp: r.label || r.name, fg: a, bg: b, ratio: contrastY(relativeLuminance(a), relativeLuminance(b)) } : null;
  }).filter(Boolean);
  const rs = cells.map(c => c.ratio);
  return { cells, pass: rs.filter(x => x >= threshold).length, applicable: rs.length, min: rs.length ? Math.min(...rs) : null, max: rs.length ? Math.max(...rs) : null };
}

/** Les colonnes du tableau, avec ce qui est bon pour chacune et ce qu'elle veut dire. */
export function columns(lang = 'en') {
  return lang === 'en' ? [
    ['verdict', 'Same verdict at equal step', '0', 'Swapping one hue for another at the same step: does the answer to “does it pass 3, 4.5 or 7:1 against white?” change? The number of hue pairs where it does.'],
    ['spread', 'Gap between hues', 'close to 0', 'At equal step, the mean gap in contrast on white between hues. A small gap reassures; it is the verdict change that decides (4.48 and 4.52 are close, and fall on either side of 4.5).'],
    ['safe', 'Step gap for 3 · 4.5 · 7:1', 'small', 'The smallest gap between two steps that reaches the threshold for every pair, all hues together: the rule this method offers, measured on itself.'],
    ['intervals', 'Neighbour intervals', 'even (min ≈ max)', 'The contrast between two neighbouring steps, from the tightest to the widest. Even everywhere, contrast can be read from the gap between names; close to 1:1, two steps blur together.'],
    ['aa', 'Pairs ≥ 4.5:1', 'more', 'Every pair of colours reaching 4.5:1: the more there are, the more combinations to choose from.'],
    ['aaa', 'Pairs ≥ 7:1', 'more', 'The same for 7:1 (AAA).'],
    ['kept', 'Chroma kept', 'high', 'The share of the starting colour\'s chroma that the method keeps, on average.'],
    ['drift', 'Starting colour moved', 'low', 'ΔE2000 between the starting colour and the step that carries it: under 7 barely visible, 7 to 15 noticeable, beyond that visible.'],
  ] : [
    ['verdict', 'Même verdict à cran égal', '0', 'Remplacer une teinte par une autre au même cran : la réponse à « ça passe 3, 4,5 ou 7:1 sur blanc ? » change-t-elle ? Le nombre de paires de teintes où c\'est le cas.'],
    ['spread', 'Écart entre teintes', 'proche de 0', 'À cran égal, l\'écart moyen de contraste sur blanc entre teintes. Un écart faible rassure ; c\'est le changement de verdict qui décide (4,48 et 4,52 sont proches, et tombent de part et d\'autre de 4,5).'],
    ['safe', 'Écart de crans pour 3 · 4,5 · 7:1', 'petit', 'Le plus petit écart entre deux crans qui atteint le seuil pour toutes les paires, toutes teintes confondues : la règle que la méthode offre, mesurée sur elle-même.'],
    ['intervals', 'Intervalles voisins', 'réguliers (min ≈ max)', 'Le contraste entre deux crans voisins, du plus serré au plus large. Égal partout, le contraste se lit dans l\'écart entre les noms ; près de 1:1, deux crans se confondent.'],
    ['aa', 'Paires ≥ 4,5:1', 'plus', 'Toutes les paires de couleurs qui atteignent 4,5:1 : plus il y en a, plus il y a de combinaisons possibles.'],
    ['aaa', 'Paires ≥ 7:1', 'plus', 'La même chose à 7:1 (AAA).'],
    ['kept', 'Éclat gardé', 'élevé', 'La part de la chroma de la couleur de départ que la méthode garde, en moyenne.'],
    ['drift', 'Couleur de départ déplacée', 'faible', 'ΔE2000 entre la couleur de départ et le cran qui la porte : sous 7 à peine visible, de 7 à 15 perceptible, au-delà visible.'],
  ];
}

/** Pour chaque colonne, les méthodes qui font le mieux : en gras dans le tableau, sans autre verdict. */
export function bestOf(rows) {
  const ok = rows.filter(r => !r.sparse);
  const reg = r => (r.intervalMin && r.intervalMax ? r.intervalMax.ratio / r.intervalMin.ratio : Infinity);
  const pick = (f, dir) => { const vals = ok.map(f).filter(v => v !== null && v !== undefined && Number.isFinite(v)); if (!vals.length) return []; const b = dir < 0 ? Math.min(...vals) : Math.max(...vals); return ok.filter(r => { const v = f(r); return v !== null && Math.abs(v - b) <= Math.abs(b) * 0.02 + 1e-9; }).map(r => r.method); };
  return { verdict: pick(r => r.crossings, -1), spread: pick(r => r.spread, -1), safe: pick(r => r.safe[4.5], -1), intervals: pick(reg, -1),
    aa: pick(r => r.pairsAA, 1), aaa: pick(r => r.pairsAAA, 1), kept: pick(r => r.kept, 1), drift: pick(r => r.drift, -1) };
}

// ---------------------------------------------------------------- les constats

// où une méthode qui égalise la luminance pose un cran sur un seuil : l'arrondi y départage les teintes
function onThreshold(data, m) {
  for (const s of data.meta.coreSteps) {
    const sp = data.metrics[m].stepSpread[s];
    if (!sp) continue;
    for (const th of [3, 4.5, 7]) if (sp.min < th && sp.max >= th) return { step: s, th, min: sp.min, max: sp.max };
  }
  return null;
}

/**
 * Les constats, calculés : chacun ne s'écrit que si les chiffres le montrent sur ces couleurs.
 * Le titre dit le constat, le texte sa preuve : de quoi faire une diapositive par constat.
 */
export function lessons(data, { lang = 'en', label = null } = {}) {
  const en = lang === 'en', out = [], f = fmt(en), pl = plur(en), list = listOf(en), ratio = ratioOf(en);
  const T = (fr, eng) => (en ? eng : fr);
  const add = (key, title, text) => out.push({ key, title, text });
  const rows = methodTable(data).filter(r => !r.sparse);
  const L = label || (m => data.methods[m]?.short || data.methods[m]?.label || m);
  const by = m => rows.find(r => r.method === m);
  const names = rs => list(rs.map(r => L(r.method)));
  const verdictW = n => T(pl(n, 'changement de verdict', 'changements de verdict'), pl(n, 'verdict change', 'verdict changes'));
  const RW = ruleWords(data.rules, lang), gap = k => (k === null ? T('aucun écart', 'no gap') : RW.gap(k));

  // 1. le budget : combien de niveaux mutuellement AA tiennent entre le noir et le blanc
  const levels = Math.floor(Math.log(21) / Math.log(4.5)) + 1;
  add('budget', T(`${levels} niveaux AA, pas plus`, `${levels} AA levels, no more`),
    T(`Aucune échelle, quelle que soit la méthode, n'offre plus de ${levels} niveaux mutuellement AA : 4,5 × 4,5 × 4,5 dépasse 21:1, tout le budget du noir au blanc. Les méthodes ne créent pas de contraste : elles le répartissent.`,
      `No scale, whatever the method, can offer more than ${levels} mutually AA levels: 4.5 × 4.5 × 4.5 exceeds 21:1, the whole black-to-white budget. Methods do not create contrast: they spread it.`));

  // 2. égaliser la luminance rend les teintes interchangeables ; un cran posé sur un seuil les départage
  const lum = rows.filter(r => METHOD_NOTES[r.method]?.lum && r.crossings !== null);
  if (lum.length) {
    const zero = lum.filter(r => r.crossings === 0), split = lum.filter(r => r.crossings > 0);
    const why = split.map(r => ({ r, at: onThreshold(data, r.method) })).filter(x => x.at);
    add('luminance', T('Même luminance à cran égal : des teintes interchangeables', 'Same luminance at equal step: interchangeable hues'),
      T(`${names(lum)} donnent la même luminance à toutes les teintes d'un même cran, en visant un contraste ou une clarté L*. Une teinte en remplace alors une autre sans changer le contraste.${zero.length ? ` Sur ces couleurs, aucun changement de verdict au même cran avec ${names(zero)}.` : ''}${why.length ? ` ${why.map(({ r, at }) => `${L(r.method)} en compte ${r.crossings} : son ${at.step} est à ${ratio(at.min)}–${ratio(at.max)} face au blanc, juste autour de ${f(at.th)}:1`).join(' ; ')}. L'arrondi des couleurs suffit alors à faire passer une teinte et pas l'autre : ce n'est pas la teinte qui compte, c'est la place du cran.` : ''}`,
        `${names(lum)} give the same luminance to every hue at the same step, by aiming at a contrast or an L* lightness. One hue can then replace another without changing contrast.${zero.length ? ` On these colours, no verdict change at the same step with ${names(zero)}.` : ''}${why.length ? ` ${why.map(({ r, at }) => `${L(r.method)} has ${r.crossings}: its ${at.step} sits at ${ratio(at.min)}–${ratio(at.max)} against white, right around ${f(at.th)}:1`).join('; ')}. Colour rounding is then enough to let one hue pass and not another: it is not the hue that matters, it is where the step sits.` : ''}`));
  }

  // 3. OKLCH : la clarté perçue, pas la luminance
  const ok = by('oklch'), seed = data.meta.seedStep, sp = data.metrics.oklch?.stepSpread[seed], fsp = data.metrics.fusilier?.stepSpread[seed];
  if (ok && sp && sp.max - sp.min > 0.1) {
    add('oklch', T('OKLCH égalise la clarté perçue, pas la luminance', 'OKLCH equalises perceived lightness, not luminance'),
      T(`À cran égal, OKLCH donne la même clarté perçue à toutes les teintes, mais pas tout à fait le même contraste : au ${seed}, de ${ratio(sp.min)} à ${ratio(sp.max)} face au blanc selon la teinte${fsp ? ` (${ratio(fsp.min)} à ${ratio(fsp.max)} avec ${L('fusilier')})` : ''}. La clarté OKLab dépend aussi de la teinte et de l'éclat ; le contraste WCAG ne dépend que de la luminance. D'où ${verdictW(ok.crossings)} au même cran.`,
        `At equal step, OKLCH gives every hue the same perceived lightness, but not quite the same contrast: at ${seed}, from ${ratio(sp.min)} to ${ratio(sp.max)} against white depending on the hue${fsp ? ` (${ratio(fsp.min)} to ${ratio(fsp.max)} with ${L('fusilier')})` : ''}. OKLab lightness also depends on hue and chroma; WCAG contrast depends on luminance only. Hence ${verdictW(ok.crossings)} at the same step.`));
  }

  // 4. des intervalles réguliers : le contraste se lit dans l'écart de noms (le critère du défaut de Hueladder)
  const reg = rows.filter(r => r.intervalMin && r.intervalMax).map(r => ({ r, k: r.intervalMax.ratio / r.intervalMin.ratio })).sort((a, b) => a.k - b.k);
  if (reg.length > 2) {
    const even = reg.filter(x => x.k <= reg[0].k * 1.03).map(x => x.r), other = reg.filter(x => !even.includes(x.r)).slice(-3).map(x => x.r), r0 = even[0];
    add('intervals', T('Des intervalles réguliers : le contraste se lit dans l\'écart de noms', 'Even intervals: contrast reads from the name gap'),
      T(`Avec ${names(even)}, deux crans voisins sont toujours séparés du même contraste (de ${ratio(r0.intervalMin.ratio)} à ${ratio(r0.intervalMax.ratio)}) : le contraste entre deux crans ne dépend que de l'écart entre leurs noms (${gap(r0.safe[3])} ⇒ 3:1, ${gap(r0.safe[4.5])} ⇒ 4,5:1, ${gap(r0.safe[7])} ⇒ 7:1), où que soit la paire. Ailleurs, l'intervalle varie (${other.map(r => `${L(r.method)} de ${ratio(r.intervalMin.ratio)} à ${ratio(r.intervalMax.ratio)}`).join(', ')}) : chaque paire a son contraste, connu, mais à lire dans une table. C'est le critère pour lequel cran propose Fusilier par défaut.`,
        `With ${names(even)}, two neighbouring steps are always the same contrast apart (from ${ratio(r0.intervalMin.ratio)} to ${ratio(r0.intervalMax.ratio)}): the contrast between two steps depends only on the gap between their names (${gap(r0.safe[3])} ⇒ 3:1, ${gap(r0.safe[4.5])} ⇒ 4.5:1, ${gap(r0.safe[7])} ⇒ 7:1), wherever the pair is. Elsewhere the interval varies (${other.map(r => `${L(r.method)} from ${ratio(r.intervalMin.ratio)} to ${ratio(r.intervalMax.ratio)}`).join(', ')}): each pair has its contrast, known, but read from a table. That is the criterion behind Hueladder's default.`));
  }

  // 5. combien de paires, et lesquelles
  const most = [...rows].sort((a, b) => b.pairsAA - a.pairsAA)[0], known = rows.filter(r => r.crossings === 0).sort((a, b) => b.pairsAA - a.pairsAA)[0];
  if (most && known && most.method !== known.method) {
    add('quantity', T('Combien de paires, et lesquelles', 'How many pairs, and which'),
      T(`${L(most.method)} fait le plus de paires à 4,5:1 (${most.pairsAA}) ; ${L(known.method)}, ${known.pairsAA}.${most.crossings ? ` Celles de ${L(most.method)} dépendent de la teinte (${verdictW(most.crossings)} au même cran) ; celles de ${L(known.method)} sont les mêmes pour toutes les teintes.` : ''} Plus de paires, ou des paires connues à l'avance : deux qualités différentes, à peser selon l'usage.`,
        `${L(most.method)} makes the most 4.5:1 pairs (${most.pairsAA}); ${L(known.method)}, ${known.pairsAA}.${most.crossings ? ` ${L(most.method)}'s depend on the hue (${verdictW(most.crossings)} at the same step); ${L(known.method)}'s are the same for every hue.` : ''} More pairs, or pairs known in advance: two different qualities, to weigh against the use.`));
  }

  // 6. l'usage qui sépare le plus les méthodes, toutes nommées
  let best = null;
  for (const u of data.usages || []) {
    const xs = rows.map(r => ({ r, x: u.byMethod[r.method] })).filter(o => o.x && o.x.applicable);
    if (xs.length < 2) continue;
    const rates = xs.map(o => o.x.pass / o.x.applicable), spread = Math.max(...rates) - Math.min(...rates);
    if (!best || spread > best.spread) best = { u, xs, spread };
  }
  if (best && best.spread >= 0.5) {
    const groups = [];
    for (const o of [...best.xs].sort((a, b) => b.x.pass - a.x.pass)) {
      const g = groups.find(x => x.pass === o.x.pass);
      g ? g.rs.push(o.r) : groups.push({ pass: o.x.pass, n: o.x.applicable, rs: [o.r] });
    }
    add('usage', T('Un usage passe partout, ou teinte par teinte', 'A usage passes everywhere, or hue by hue'),
      T(`« ${strip(best.u.label)} » passe sur ${groups.map(g => `${pl(g.pass, 'teinte', 'teintes')} sur ${g.n} avec ${names(g.rs)}`).join(' ; ')}. Quand les teintes sont interchangeables, un usage se vérifie une fois pour toutes ; sinon, teinte par teinte.`,
        `“${strip(best.u.label)}” passes on ${groups.map(g => `${pl(g.pass, 'hue', 'hues')} out of ${g.n} with ${names(g.rs)}`).join('; ')}. When hues are interchangeable, a usage is checked once for all; otherwise, hue by hue.`));
  }

  // 7. garder sa couleur, ou aligner les contrastes
  const moved = rows.filter(r => METHOD_NOTES[r.method]?.lum && r.drift !== null), still = rows.filter(r => r.drift !== null && r.drift < 0.5);
  if (moved.length && still.length) {
    const lo = Math.min(...moved.map(r => r.drift)), hi = Math.max(...moved.map(r => r.drift));
    add('identity', T('Garder sa couleur, ou aligner les contrastes', 'Keep your colour, or line up contrasts'),
      T(`Les méthodes qui alignent la luminance déplacent la couleur de départ jusqu'à celle de son cran (ΔE de ${f(lo)} à ${f(hi)} ici) ; celles qui la gardent exactement (${names(still)}) laissent chaque teinte avec son propre contraste. On ne peut pas avoir les deux à la fois : c'est un arbitrage de gouvernance, pas une erreur.`,
        `Methods that line up luminance move the starting colour to its step's luminance (ΔE from ${f(lo)} to ${f(hi)} here); those that keep it exactly (${names(still)}) leave each hue with its own contrast. You cannot have both at once: it is a governance trade-off, not a mistake.`));
  }

  // 8. les paires à 7:1
  const aaa = [...rows].sort((a, b) => b.pairsAAA - a.pairsAAA)[0], fus = by('fusilier');
  if (aaa && fus && aaa.method !== 'fusilier') {
    add('aaa', T('Les paires à 7:1', 'The 7:1 pairs'),
      T(`Pour l'AAA (7:1), ${L(aaa.method)} fait le plus de paires (${aaa.pairsAAA}), ${L('fusilier')} ${fus.pairsAAA}. La façon de répartir les crans décide où va le contraste ; si l'AAA compte pour toi, c'est un critère à part entière.`,
        `For AAA (7:1), ${L(aaa.method)} makes the most pairs (${aaa.pairsAAA}), ${L('fusilier')} ${fus.pairsAAA}. How the steps are spread decides where contrast goes; if AAA matters to you, it is a criterion in its own right.`));
  }

  // 9 et 10. deux idées reçues, mesurées
  const tw = by('tailwind');
  if (tw && tw.crossings) {
    add('tailwind', T('Tailwind est dessinée à la main', 'Tailwind is drawn by hand'),
      T(`Pas de formule : chaque famille est dessinée à l'œil. Sur ces couleurs : un écart moyen de ${f(tw.spread, 2)} point de contraste entre teintes au même cran, ${verdictW(tw.crossings)}. Chaque famille est soignée ; d'une famille à l'autre, les contrastes ne s'alignent pas.`,
        `No formula: each family is drawn by eye. On these colours: a mean gap of ${f(tw.spread, 2)} contrast points between hues at the same step, ${verdictW(tw.crossings)}. Each family is polished; from one family to another, contrasts do not line up.`));
  }
  const ap = by('apca');
  if (ap && fus && ap.safe[4.5] !== fus.safe[4.5]) {
    add('norms', T('WCAG 2 et APCA ne mesurent pas la même chose', 'WCAG 2 and APCA do not measure the same thing'),
      T(`Calée sur APCA, une rampe demande ${gap(ap.safe[4.5])} d'écart pour garantir 4,5:1 en WCAG 2, contre ${gap(fus.safe[4.5])} avec ${L('fusilier')}${ap.crossings === 0 ? ', sans un seul changement de verdict au même Hueladder' : ''}. Ce n'est pas une erreur : APCA vise une autre mesure, qui tient compte du sens du contraste (texte foncé sur clair, ou clair sur foncé) et que ses auteurs disent plus proche de la lisibilité ; il n'est pas normatif aujourd'hui. Choisir sa norme est une décision ; le contrat de Hueladder peut relire la règle sous les deux.`,
        `Set on APCA, a ramp needs ${gap(ap.safe[4.5])} to guarantee 4.5:1 in WCAG 2, against ${gap(fus.safe[4.5])} with ${L('fusilier')}${ap.crossings === 0 ? ', without a single verdict change at the same step' : ''}. It is not a mistake: APCA targets another measure, which accounts for contrast polarity (dark text on light, or light on dark) and which its authors say is closer to legibility; it is not normative today. Choosing a norm is a decision; Hueladder's contract can read the rule under both.`));
  }
  return out;
}

// ---------------------------------------------------------------- choisir

/**
 * Partir de ce qui compte : chaque critère mesurable désigne les méthodes qui y répondent le
 * mieux sur ces couleurs (calculé), avec ce qu'elles paient ailleurs ; les autres enjeux sont
 * dits à la main, sans chiffre. Deux gestes du parcours complètent : régler sous luminance
 * verrouillée, garder la marque telle quelle.
 */
export function choose(data, { lang = 'en', label = null } = {}) {
  const en = lang === 'en', f = fmt(en), pl = plur(en), list = listOf(en), T = (fr, eng) => (en ? eng : fr);
  const L = label || (m => data.methods[m]?.label || m);
  const rows = methodTable(data).filter(r => !r.sparse), best = bestOf(rows), by = m => rows.find(r => r.method === m);
  const price = r => [T(pl(r.crossings ?? 0, 'changement de verdict', 'changements de verdict'), pl(r.crossings ?? 0, 'verdict change', 'verdict changes')),
    r.drift !== null ? T('couleur de départ à ΔE ', 'starting colour at ΔE ') + f(r.drift) : null,
    r.kept !== null ? Math.round(r.kept * 100) + T(' % d\'éclat gardé', '% of chroma kept') : null].filter(Boolean).join(' · ');
  const gen = T('Créer → Générer', 'Create → Generate');
  const row = (need, ms) => { const rs = ms.map(by).filter(Boolean); return rs.length && { need, methods: rs.map(r => r.method), label: list(rs.map(r => L(r.method))), price: rs.map(r => (rs.length > 1 ? L(r.method) + T(' : ', ': ') : '') + price(r)).join(T(' ; ', '; ')), where: gen }; };
  return [
    row(T('Des teintes interchangeables au même cran', 'Hues interchangeable at the same step'), best.verdict),
    row(T('Des intervalles réguliers : le contraste se lit dans l\'écart de noms', 'Even intervals: contrast reads from the name gap'), best.intervals),
    row(T('Le plus de paires à 4,5:1', 'The most 4.5:1 pairs'), best.aa),
    row(T('Le plus de paires à 7:1 (AAA)', 'The most 7:1 pairs (AAA)'), best.aaa),
    row(T('Ne pas déplacer la couleur de départ', 'Not moving the starting colour'), best.drift),
    row(T('Garder le plus d\'éclat', 'Keeping the most chroma'), best.kept),
    row(T('Choisir toi-même le contraste de chaque cran, sur fond clair ou sombre', 'Choosing each step\'s contrast yourself, on a light or dark background'), ['leonardo']),
    row(T('Une règle qui se dit en une phrase, un calcul standard', 'A rule you can say in one sentence, a standard computation'), ['oklch']),
    row(T('Android, Material You', 'Android, Material You'), ['hct']),
    row(T('Préparer l\'après-WCAG 2 (APCA)', 'Preparing for after WCAG 2 (APCA)'), ['apca']),
    row(T('Une palette déjà connue, sans rien générer', 'A palette people already know, generating nothing'), ['tailwind']),
    { need: T('Des courbes dessinées à la main, sans perdre la luminance', 'Hand-drawn curves, without losing luminance'), methods: ['tuned'], label: T('Réglé à la main, luminance verrouillée', 'Hand-tuned, locked luminance'),
      price: T('du temps de réglage ; les contrastes restent ceux de la méthode de base, par construction', 'tuning time; contrasts stay those of the base method, by construction'), where: T('Créer → Régler', 'Create → Tune') },
    { need: T('Garder ta marque telle quelle, régénérer le reste', 'Keeping your brand as is, regenerating the rest'), methods: ['keep'], label: T('Panachage', 'Mixed system'),
      price: T('ce que la marque gardée coûte en contraste, affiché à la vérification', 'what the kept brand costs in contrast, shown at the check'), where: T('Créer → Générer, « garder telle quelle »', 'Create → Generate, “keep as is”') },
  ].filter(Boolean);
}

// ---------------------------------------------------------------- les graphiques, présenter, d'où viennent les chiffres

/** Les graphiques : chacun avec sa lecture et ce qui y est bon. Même axe pour toutes les méthodes. */
export const GRAPHS = {
  fr: {
    cvb: ['Contraste face au noir', 'Échelle logarithmique. Chaque ligne est une teinte. Superposées : même contraste pour toutes les teintes. Une droite : des contrastes en progression régulière.'],
    step: ['Intervalles entre crans voisins', 'Le contraste entre un cran et le suivant. Une ligne plate : des intervalles réguliers, et le contraste se lit dans l\'écart de noms. Un point près de 1:1 : deux crans presque confondus.'],
    L: ['Clarté perçue (OKLCH L)', 'Superposées : même clarté perçue pour toutes les teintes. La pente dit comment la méthode répartit la clarté.'],
    C: ['Éclat (chroma OKLCH)', 'Où vit la couleur : l\'éclat culmine autour de la couleur de départ, l\'écran le réduit vers le blanc et le noir. Plus haut : plus vif.'],
    H: ['Teinte, écart à la couleur de départ', 'En degrés. Plate à 0 : la teinte ne tourne pas. Les gris, presque sans teinte, sont omis.'],
    apca: ['Contraste APCA sur blanc (Lc)', 'La même lecture avec APCA. Superposées : même Lc pour toutes les teintes ; la forme montre comment la méthode répartit le contraste au sens d\'APCA.'],
  },
  en: {
    cvb: ['Contrast against black', 'Logarithmic scale. Each line is a hue. Stacked: the same contrast for every hue. A straight line: contrasts on an even progression.'],
    step: ['Intervals between neighbouring steps', 'The contrast between a step and the next. A flat line: even intervals, and contrast reads from the name gap. A point near 1:1: two steps almost merged.'],
    L: ['Perceived lightness (OKLCH L)', 'Stacked: the same perceived lightness for every hue. The slope says how the method spreads lightness.'],
    C: ['Chroma (OKLCH)', 'Where the colour lives: chroma peaks around the starting colour, the screen cuts it towards white and black. Higher: more vivid.'],
    H: ['Hue, offset from the starting colour', 'In degrees. Flat at 0: the hue does not turn. Greys, nearly hueless, are left out.'],
    apca: ['APCA contrast on white (Lc)', 'The same reading with APCA. Stacked: the same Lc for every hue; the shape shows how the method spreads contrast in APCA terms.'],
  },
};

/** Un déroulé de présentation : chaque étape s'appuie sur un panneau de la page. */
export const DECK = {
  fr: [
    'Le problème : sans méthode, à cran égal, chaque teinte a son propre contraste ; chaque usage se vérifie teinte par teinte.',
    'Ce qu\'une méthode décide : ce qui reste égal entre teintes, et comment les crans se répartissent (le cadre, les familles).',
    'Les graphiques : des lignes superposées ou un faisceau, des intervalles réguliers ou non.',
    'Les usages : sur combien de teintes un usage courant passe, méthode par méthode, avec les couleurs sous les yeux.',
    'Le tableau : chaque critère, et la méthode qui fait le mieux sur ce critère, rejoué sur vos couleurs (« Mes couleurs »).',
    'Le choix et ce qu\'il coûte : partir de ce qui compte pour l\'équipe (« Choisir sa méthode »). L\'effort de migration se chiffre famille par famille dans Auditer.',
    'La façon de mesurer et ses limites : ce qui rend les chiffres défendables.',
  ],
  en: [
    'The problem: without a method, at equal step, each hue has its own contrast; every usage is checked hue by hue.',
    'What a method decides: what stays equal between hues, and how steps are spread (the frame, the families).',
    'The charts: stacked lines or a bundle, even intervals or not.',
    'The usages: on how many hues a common usage passes, method by method, with the colours in sight.',
    'The table: each criterion, and the method that does best on it, replayed on your colours (“My colours”).',
    'The choice and what it costs: start from what matters to the team (“Choosing a method”). Migration effort is counted family by family in Audit.',
    'How things are measured, and the limits: what makes the figures defensible.',
  ],
};

export const TRUST = {
  fr: {
    protocol: 'Toutes les méthodes passent par le même harnais : même couleur de départ pour chaque teinte, même réduction de gamut (la chroma baisse à teinte et clarté constantes, jamais la teinte ; sauf Leonardo et le Fusilier original, reproduits tels que leur outil les calcule : écrêtage RGB pour Leonardo, chemin HSL pour color-shades), même arrondi hex, mêmes mesures. On isole ainsi la règle de chaque méthode du bruit de chaque outil.',
    measures: 'Contraste WCAG 2.x ; un seul ΔE, le ΔE2000 ; APCA 0.0.98G-4g, vérifié sur les vecteurs de test d\'apca-w3.',
    corpus: (r, c, p) => `Ici : ${r} nuanciers, ${c} couleurs et ${p} paires par méthode.`,
    conformanceNote: 'Mesuré le 22 novembre 2026 par engine/conformance, sur l\'exemple.',
    conformance: [
      ['mix', 'chroma.js 3.2', 'identique au hex près'],
      ['easing', 'chroma.js 3.2', 'identique sur 82 couleurs sur 88, les autres à ΔE 1,7 au plus, au bord du gamut'],
      ['hct', 'material-color-utilities 0.4', 'fidèle, ΔE 0,61 au plus'],
      ['tailwind', 'tailwindcss 4.3', 'identique au hex près'],
      ['leonardo', '@adobe/leonardo-contrast-colors 1.1', 'identique au hex près'],
      ['colorshades', 'color-shades (1c944dc) sur colorjs.io 0.4.1', 'identique au hex près'],
    ],
    limits: [
      'Les seuils WCAG 2 sont critiqués : ils sous-estiment le contraste sur fond sombre. APCA corrige ce point mais n\'est pas normatif. Les deux lectures se montrent, aucune n\'est érigée en vérité.',
      'APCA a une zone morte sous Lc 7,3 : les crans les plus clairs n\'y atteignent pas leur cible.',
      'Les échelles de chaque méthode (bornes de clarté, tons, ratios) sont des réglages : d\'autres réglages donnent d\'autres chiffres. Ils sont écrits dans le détail de chaque méthode.',
      'Des chiffres sur un jeu de couleurs restent un cas d\'étude : rejouer sur les siennes avant de conclure.',
    ],
  },
  en: {
    protocol: 'Every method goes through the same harness: the same starting colour for each hue, the same gamut reduction (chroma drops at constant hue and lightness, never the hue; except Leonardo and the original Fusilier, reproduced as their tool computes them: RGB clipping for Leonardo, the HSL path for color-shades), the same hex rounding, the same measures. This isolates each method\'s rule from each tool\'s noise.',
    measures: 'WCAG 2.x contrast; a single ΔE, ΔE2000; APCA 0.0.98G-4g, checked against the apca-w3 test vectors.',
    corpus: (r, c, p) => `Here: ${r} ramps, ${c} colours and ${p} pairs per method.`,
    conformanceNote: 'Measured on 22 November 2026 by engine/conformance, on the example.',
    conformance: [
      ['mix', 'chroma.js 3.2', 'identical to the hex'],
      ['easing', 'chroma.js 3.2', 'identical on 82 colours out of 88, the others within ΔE 1.7, at the gamut edge'],
      ['hct', 'material-color-utilities 0.4', 'faithful, ΔE 0.61 at most'],
      ['tailwind', 'tailwindcss 4.3', 'identical to the hex'],
      ['leonardo', '@adobe/leonardo-contrast-colors 1.1', 'identical to the hex'],
      ['colorshades', 'color-shades (1c944dc) on colorjs.io 0.4.1', 'identical to the hex'],
    ],
    limits: [
      'WCAG 2 thresholds are criticised: they underestimate contrast on dark backgrounds. APCA fixes this but is not normative. Both readings are shown; neither is set up as the truth.',
      'APCA has a dead zone under Lc 7.3: the lightest steps do not reach their target there.',
      'Each method\'s scales (lightness bounds, tones, ratios) are settings: other settings give other figures. They are written in each method\'s detail.',
      'Figures on one set of colours remain a case study: replay them on your own before concluding.',
    ],
  },
};

export const SOURCES = [
  ['David Fusilier, color-shades', 'https://github.com/dfusilier/color-shades'],
  ['Eugene Fedorenko, accessiblepalette.com', 'https://accessiblepalette.com'],
  ['Nate Baldwin (Adobe), Leonardo', 'https://github.com/adobe/leonardo'],
  ['Google, material-color-utilities (HCT)', 'https://github.com/material-foundation/material-color-utilities'],
  ['Andrew Somers (Myndex), APCA', 'https://github.com/Myndex/apca-w3'],
  ['Gregor Aisch, chroma.js', 'https://gka.github.io/chroma.js/'],
  ['Lyft, ColorBox', 'https://colorbox.io'],
  ['Tailwind CSS', 'https://tailwindcss.com/docs/colors'],
  ['Adam Wathan & Steve Schoger, Refactoring UI', 'https://www.refactoringui.com'],
  ['W3C, WCAG 2.2', 'https://www.w3.org/TR/WCAG22/'],
];

// ---------------------------------------------------------------- les autres choix de méthode

// Les méthodes du mode sombre et les nomenclatures : expliquées ici, et reprises telles
// quelles par les étapes du studio qui les font choisir.
export const DARK_TEXT = {
  fr: {
    'mirror-wcag': ['Miroir WCAG', 'Chaque cran garde, face au fond, le ratio qu\'il a en clair face au blanc. La règle passe telle quelle. Logique d\'Adobe Leonardo.'],
    'mirror-bridge': ['Pont WCAG / APCA', 'Chaque cran de texte vise sa lisibilité APCA, autant que la règle du nom le permet, sans jamais descendre sous le miroir WCAG. Le texte gagne en sombre ; en échange, les crans du haut se resserrent et les seuils arrivent un cran plus tôt qu\'en clair.'],
    'mirror-apca': ['Miroir APCA', 'Chaque cran de texte garde son contraste APCA face au fond. Plus fort en sombre : APCA juge le texte clair sur fond sombre moins lisible. Démarche de Radix.'],
    'budget-share': ['Part du budget', 'Chaque cran garde la même part du contraste disponible sur ce fond. Démarche d\'Adobe Spectrum ; affaiblit la règle sur un fond non noir.'],
    'tone-flip': ['Ton inversé (HCT)', 'Le ton HCT s\'inverse (T → 100 − T), teinte et chroma gardées. Démarche de Material 3, qui ignore le fond réel.'],
    'index-flip': ['Crans échangés', 'Le 50 prend la couleur du 950, le 100 celle du 900… Pratique courante (Tailwind, Atlassian), aucune garantie face au fond.'],
  },
  en: {
    'mirror-wcag': ['WCAG mirror', 'Each step keeps, against the background, the ratio it has against white in light mode. The rule carries over as is. Adobe Leonardo\'s logic.'],
    'mirror-bridge': ['WCAG / APCA bridge', 'Each text step aims for its APCA readability, as far as the naming rule allows, never below the WCAG mirror. Text gains in dark mode; in exchange, the top steps get closer and thresholds arrive one step earlier than in light.'],
    'mirror-apca': ['APCA mirror', 'Each text step keeps its APCA contrast against the background. Stronger in dark mode: APCA rates light text on dark as less readable. Radix\'s approach.'],
    'budget-share': ['Budget share', 'Each step keeps the same share of the contrast available on this background. Adobe Spectrum\'s approach; weakens the rule on a non-black background.'],
    'tone-flip': ['Flipped tone (HCT)', 'The HCT tone flips (T → 100 − T), hue and chroma kept. Material 3\'s approach, which ignores the actual background.'],
    'index-flip': ['Swapped steps', '50 takes the colour of 950, 100 that of 900… Common practice (Tailwind, Atlassian), no guarantee against the background.'],
  },
};
export const NAMING_TEXT = {
  fr: {
    grid: ['Centaines, grille 50 → 950', 'Le défaut. Onze crans réguliers ; un cran ajouté entre deux (150, 25…) est interpolé par son nom et reste hors de la règle.', 'Centaines'],
    hundreds: ['Centaines, par contraste', 'Le nom fixe le contraste : tout multiple de 25 entre 0 et 1000 est un cran, et entre dans la règle.', 'Centaines par contraste'],
    shade: ['Contraste, façon Fusilier', 'Le nom est le contraste (color-shades de David Fusilier) : 200 = blanc, 0 = noir, multiples de 5.', 'Fusilier'],
    rank: ['Rang, réparti', 'Le nom n\'est qu\'une position, comme chez Radix (1–12), Carbon (10–100) ou Primer (0–9).', 'Rang'],
  },
  en: {
    grid: ['Hundreds, 50 → 950 grid', 'The default. Eleven regular steps; a step added in between (150, 25…) is interpolated by its name and stays outside the rule.', 'Hundreds'],
    hundreds: ['Hundreds, by contrast', 'The name sets the contrast: any multiple of 25 from 0 to 1000 is a step, and falls under the rule.', 'Hundreds by contrast'],
    shade: ['Contrast, Fusilier style', 'The name is the contrast (David Fusilier\'s color-shades): 200 = white, 0 = black, multiples of 5.', 'Fusilier'],
    rank: ['Rank, spread', 'The name is only a position, as in Radix (1–12), Carbon (10–100) or Primer (0–9).', 'Rank'],
  },
};
export const NORMS = {
  fr: 'WCAG 2 juge un rapport de luminances, le même dans les deux sens : c\'est la norme exigible aujourd\'hui. APCA (brouillon de WCAG 3) juge la lisibilité selon la polarité, la taille et la graisse, et ne note pas pareil un texte clair sur fond sombre. Hueladder écrit la règle en WCAG 2 par défaut ; avec la norme APCA, le contrat la relit en Lc et chaque option du mode sombre se montre sous les deux.',
  en: 'WCAG 2 judges a luminance ratio, the same both ways round: it is the enforceable norm today. APCA (the WCAG 3 draft) judges legibility by polarity, size and weight, and does not score light text on a dark background the same way. Hueladder writes the rule in WCAG 2 by default; with the APCA norm, the contract reads it in Lc and every dark-mode option is shown under both.',
};

// ---------------------------------------------------------------- l'argumentaire, en Markdown

/** Le tout en Markdown : pour la CLI, et pour qui veut en faire une présentation. */
export function explainMarkdown(data, { lang = 'en', label = null } = {}) {
  const en = lang === 'en', k = en ? 'en' : 'fr', F = FRAME[k], f = fmt(en), pl = plur(en), ratio = ratioOf(en), L = [];
  const T = (fr, eng) => (en ? eng : fr);
  const lab = label || (m => data.methods[m]?.label || m);
  const n = (x, d = 1) => (x === null || x === undefined ? '—' : f(x, d));
  const RW = ruleWords(data.rules, lang), gap = g => (g === null ? '—' : String(g));
  const rows = methodTable(data), cols = columns(lang);
  L.push(`# ${T('Comprendre les méthodes de génération', 'Understanding generation methods')}`, '', `> ${THESIS[k]}`, '', DEFAULT_CHOICE[k], '');
  L.push(`## ${T('Ce que montrent les chiffres', 'What the figures show')}`, '', ...lessons(data, { lang }).map((l, i) => `${i + 1}. **${l.title}.** ${l.text}`), '');
  L.push(`## ${F.title}`, '', `- **${F.space[0]}** : ${F.space[1]}`, `- **${F.method[0]}** : ${F.method[1]}`, `- **${F.tool[0]}** : ${F.tool[1]}`, '', F.quad, '', F.proof, '');
  L.push(`## ${T('Cinq familles de méthodes', 'Five families of methods')}`, '');
  for (const fam of FAMILIES) L.push(`- **${fam[k][0]}** (${fam.methods.filter(m => rows.some(r => r.method === m) || m !== 'existing').map(lab).join(', ')}) — ${fam[k][1]}`);
  L.push('', BEYOND[k], '');
  L.push(`## ${T('Les méthodes, une par une', 'The methods, one by one')}`, '');
  for (const m of [...rows.map(r => r.method), ...(data.metrics.anchored ? ['anchored'] : [])]) {
    const r = methodRow(data, m), N = METHOD_NOTES[m]?.[k];
    if (!N) continue;
    L.push(`### ${lab(m)}`, '', `- ${T('Ce qu\'elle rend égal entre teintes', 'What it keeps equal between hues')}${T(' :', ':')} ${N.equal}`, `- ${T('Comment elle répartit les crans', 'How it spreads the steps')}${T(' :', ':')} ${N.spread}`,
      `- ${T('La choisir si', 'Choose it if')}${T(' :', ':')} ${N.when}`, `- ${T('À savoir', 'Worth knowing')}${T(' :', ':')} ${N.watch}`);
    if (!r.sparse) L.push(`- ${T('Sur ces couleurs', 'On these colours')}${T(' :', ':')} ${pl(r.crossings ?? 0, T('changement de verdict', 'verdict change'), T('changements de verdict', 'verdict changes'))} ${T('au même cran', 'at the same step')} · ${T('écart de crans pour 3 · 4,5 · 7:1', 'step gap for 3 · 4.5 · 7:1')}${T(' :', ':')} ${gap(r.safe[3])} · ${gap(r.safe[4.5])} · ${gap(r.safe[7])}${r.intervalMin ? ` · ${T('intervalles', 'intervals')} ${ratio(r.intervalMin.ratio)}–${ratio(r.intervalMax.ratio)}` : ''}${r.kept !== null ? ` · ${Math.round(r.kept * 100)} % ${T('d\'éclat gardé', 'of chroma kept')}` : ''}${r.drift !== null ? ` · ${T('couleur de départ à', 'starting colour at')} ΔE ${n(r.drift)}` : ''}`);
    if (SETTINGS[k][m]) L.push(`- ${T('Réglages', 'Settings')}${T(' :', ':')} ${SETTINGS[k][m]}`);
    L.push(`- ${T('Le calcul', 'The computation')}${T(' :', ':')} ${strip(data.methods[m].desc || '')}`);
    if (METHOD_NOTES[m].tool) L.push(`- Source${T(' :', ':')} [${METHOD_NOTES[m].tool[0]}](${METHOD_NOTES[m].tool[1]})`);
    L.push('');
  }
  // le panneau « une teinte, toutes les méthodes », pour l'agent : le contraste de chaque cran, toutes teintes
  const steps = data.meta.steps.map((s, i) => [s, i]).filter(([, i]) => data.meta.isCore[i]), real = data.ramps.filter(r => !r.derived);
  const cut = x => ratio(x).slice(0, -2);
  L.push(`## ${T('Le contraste face au blanc, cran par cran', 'Contrast against white, step by step')}`, '',
    T('Le contraste WCAG 2 de chaque cran face au blanc, de la teinte qui en a le moins à celle qui en a le plus ; une seule valeur quand toutes les teintes ont la même. Face au noir : 21 divisé par ce chiffre. 4,5:1 est le seuil du texte courant.',
      'The WCAG 2 contrast of each step against white, from the hue with the least to the hue with the most; a single value when every hue has the same. Against black: 21 divided by this figure. 4.5:1 is the body-text threshold.'), '',
    `| ${T('Méthode', 'Method')} | ${steps.map(([s]) => s).join(' | ')} |`, `|---|${steps.map(() => '---').join('|')}|`);
  for (const m of [...rows.map(r => r.method), ...(data.metrics.anchored ? ['anchored'] : [])]) {
    L.push(`| ${lab(m)} | ${steps.map(([, i]) => {
      const v = real.map(r => r.colors[m]?.[i]).filter(Boolean).map(h => contrastY(relativeLuminance(h), 1));
      if (!v.length) return '—';
      const [lo, hi] = [cut(Math.min(...v)), cut(Math.max(...v))];
      return lo === hi ? lo : `${lo}–${hi}`;
    }).join(' | ')} |`);
  }
  L.push('');
  L.push(`## ${T('Ce que chaque méthode donne, sur ces couleurs', 'What each method gives, on these colours')}`, '');
  L.push(`| ${T('Méthode', 'Method')} | ${cols.map(c => c[1]).join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`, `| *${T('bon si', 'good if')}* | ${cols.map(c => '*' + c[2] + '*').join(' | ')} |`);
  for (const r of rows) {
    L.push(`| ${lab(r.method)}${r.sparse ? T(' (creuse)', ' (sparse)') : ''} | ${r.crossings ?? '—'} | ${n(r.spread, 2)} | ${gap(r.safe[3])} · ${gap(r.safe[4.5])} · ${gap(r.safe[7])} | ${r.intervalMin ? ratio(r.intervalMin.ratio) + '–' + ratio(r.intervalMax.ratio) : '—'} | ${r.pairsAA} | ${r.pairsAAA} | ${r.kept === null ? '—' : Math.round(r.kept * 100) + ' %'} | ${n(r.drift)} |`);
  }
  L.push('', T(`Les écarts de crans sont comptés en rangs (sur cette nomenclature, Fusilier atteint 4,5:1 dès un écart de ${RW.aa}).`, `Step gaps are counted in ranks (on this naming, Fusilier reaches 4.5:1 from a gap of ${RW.aa}).`), '', ...cols.map(c => `- **${c[1]}** — ${c[3]}`), '');
  const used = rows.filter(r => !r.sparse);
  L.push(`## ${T('Les usages, teinte par teinte', 'Usages, hue by hue')}`, '', T(`Chaque case dit sur combien de teintes, parmi les ${data.meta.rampCount}, la paire atteint son seuil.`, `Each cell says on how many hues, out of ${data.meta.rampCount}, the pair reaches its threshold.`), '',
    `| ${T('Usage', 'Usage')} | ${used.map(r => data.methods[r.method].short || lab(r.method)).join(' | ')} |`, `|---|${used.map(() => '---').join('|')}|`);
  for (const u of data.usages || []) L.push(`| ${strip(u.label)} (${u.ref}) | ${used.map(r => { const x = u.byMethod[r.method]; return x && x.applicable ? `${x.pass}/${x.applicable}` : '—'; }).join(' | ')} |`);
  L.push('', `## ${T('Choisir sa méthode', 'Choosing a method')}`, '', `| ${T('Ce qui compte pour toi', 'What matters to you')} | ${T('Méthode', 'Method')} | ${T('Ce qu\'elle paie ici', 'What it pays here')} | ${T('Où le faire', 'Where')} |`, '|---|---|---|---|');
  for (const g of choose(data, { lang, label: lab })) L.push(`| ${g.need} | ${g.label} | ${g.price} | ${g.where} |`);
  L.push('', `## ${T('Les graphiques (dans le studio)', 'The charts (in the studio)')}`, '', ...Object.values(GRAPHS[k]).map(([a, b]) => `- **${a}** — ${b}`), '');
  L.push(`## ${T('Pour présenter', 'To present it')}`, '', ...DECK[k].map((x, i) => `${i + 1}. ${x}`), '',
    `**${T('Ce qui ne change pas, quelle que soit la méthode', 'What does not change, whatever the method')}**`, '', ...SAME[k].map(x => `- ${x}`), '');
  const TR = TRUST[k], fus = data.metrics.fusilier;
  L.push(`## ${T('D\'où viennent ces chiffres', 'Where these figures come from')}`, '', TR.protocol, '', TR.measures, '',
    TR.corpus(data.meta.rampCount, fus ? fus.colorCount : '—', fus ? fus.totalPairs : '—'), '',
    `| ${T('Méthode', 'Method')} | ${T('Librairie', 'Library')} | ${T('Résultat', 'Result')} |`, '|---|---|---|',
    ...TR.conformance.map(([m, lib, res]) => `| ${lab(m)} | ${lib} | ${res} |`), '', TR.conformanceNote, '',
    `**${T('Les limites', 'The limits')}**`, '', ...TR.limits.map(x => `- ${x}`), '',
    `**${T('Les sources', 'Sources')}**`, '', ...SOURCES.map(([a, u]) => `- [${a}](${u})`), '');
  L.push(`## ${T('Les autres choix de méthode', 'The other method choices')}`, '',
    `**${T('Le mode sombre', 'Dark mode')}**`, '', ...Object.values(DARK_TEXT[k]).map(([a, b]) => `- **${a}** — ${b}`), '',
    `**${T('La nomenclature', 'Naming')}**`, '', ...Object.values(NAMING_TEXT[k]).map(([a, b]) => `- **${a}** — ${b}`), '',
    `**${T('La norme', 'The norm')}**`, '', NORMS[k], '');
  return L.join('\n');
}
