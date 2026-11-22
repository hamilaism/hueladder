// Les sorties dérivées de `buildData` que la ligne de commande écrit sur disque et que le
// studio calcule dans la page : un seul code, pour que les deux livrent exactement la même chose.

import { relativeLuminance, contrast } from './color.mjs';
import { ruleWords } from './naming.mjs';
import { maxChromaAtLuminance } from './tune.mjs';

export const GAMUT_HUE_STEPS = 72;   // frontière du gamut échantillonnée tous les 5°

/** Chroma maximale atteignable à chaque luminance du barreau, tout autour de la roue. */
export function gamutBoundary(ladder, hueSteps = GAMUT_HUE_STEPS) {
  return ladder.map(Y => (Y === null ? null
    : Array.from({ length: hueSteps }, (_, k) => Math.round(maxChromaAtLuminance(Y, (k * 360) / hueSteps, { iters: 14 }) * 1e4) / 1e4)));
}

// L'artefact de comparaison sert à arbitrer une méthode ; le régleur sert à travailler la
// couleur une fois la méthode choisie. Deux gestes distincts, deux pages distinctes.
export function tunerDataFrom(spec, data, { gamut = true } = {}) {
  const baseMethod = data.meta.coreMethod;
  const HUE_STEPS = GAMUT_HUE_STEPS;
  return {
    brand: spec.brand,
    id: spec.id,
    steps: data.meta.steps,
    seedIndex: data.meta.seedIndex,
    baseMethod,
    hueSteps: HUE_STEPS,
    // Les déclinaisons sont réglables elles aussi : ce sont des candidates, et une candidate
    // qu'on n'a pas pu travailler ne se juge pas. Elles n'ont simplement aucune couleur
    // « d'aujourd'hui » à afficher — elles n'existent encore nulle part.
    ramps: data.ramps.map(r => {
      const ladder = r.colors[baseMethod].map(hex => (hex ? relativeLuminance(hex) : null));
      return {
        name: r.name,
        label: r.label,
        seed: r.seed,
        anchors: r.anchors,
        derived: !!r.derived,
        derivedFrom: r.derivedFrom || null,
        hueOffset: r.hueOffset ?? null,
        kind: r.kind,
        base: r.colors[baseMethod],
        ladder,
        baseChroma: r.meta[baseMethod].map(m => (m ? m.oklch[1] : 0)),
        // La frontière du gamut ne dépend que de la luminance, qui est verrouillée : elle est
        // donc fixe par step et se calcule une fois pour toutes, plutôt qu'à chaque mouvement
        // de souris. Le studio la demande à la volée (`gamut: false`), rampe par rampe.
        gamut: gamut ? gamutBoundary(ladder, HUE_STEPS) : null,
        // la couleur déjà en place à ce rang, s'il y en a une : le repère à ne pas trop quitter
        reference: data.meta.steps.map((step, i) => {
          const hit = data.anchorMap.find(a => a.ramp === r.name && a.placedIndex === i && a.primary !== false);
          return hit ? { hex: hit.hex, role: hit.role } : null;
        }),
      };
    }),
  };
}

/**
 * Les couleurs littérales, identiques dans tous les modes.
 *
 * Une rampe sombre étant inversée, aucun cran ne garde sa valeur d'un mode à l'autre : sans
 * ce groupe, rien n'exprime « ce blanc doit rester blanc » (texte sur photo, logo, aplat de
 * marque) et les équipes se rabattent sur le cran extrême de la rampe neutre — qui est un
 * rôle, et qui s'inverse. Les mêmes valeurs sont donc écrites dans les deux fichiers : un
 * diff des deux modes doit montrer *tous* les tokens qui changent, sauf ceux-là.
 */
/** La valeur d'un littéral dans un mode : un hex unique, ou `{ light, dark }`. */
export const staticValue = (v, mode) => (typeof v === 'string' ? v : mode === 'dark' && v.dark ? v.dark : v.light);
// un alpha se compose sur le fond en sRGB non linéarisé, comme le font Figma et les navigateurs
const composite = (hex, bg) => {
  const a = parseInt(hex.slice(7, 9), 16) / 255, ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map(i => Math.round(a * ch(hex, i) + (1 - a) * ch(bg, i)).toString(16).padStart(2, '0')).join('');
};
function staticGroup(data, ns, mode = 'light') {
  const entries = Object.entries(data.staticTokens || {});
  if (!entries.length) return null;
  const bg = mode === 'dark' && data.meta.dark ? data.meta.dark.background : data.meta.lightBackground || '#ffffff';
  const group = { $description: 'Couleurs littérales — jamais un cran de rampe, jamais inversées par le thème.' };
  for (const [name, v] of entries) {
    const hex = staticValue(v, mode), perMode = typeof v === 'object' && v.dark && v.dark !== v.light;
    const ext = { static: true, ...(perMode ? { perMode: true } : {}) };
    // avec un alpha : la couleur obtenue sur le fond du mode, et ce qu'elle lui fait (une ombre
    // marine sur un fond presque noir l'éclaircit : seul le noir reste soustractif)
    if (hex.length === 9) { const c = composite(hex, bg); ext.alpha = Math.round((parseInt(hex.slice(7, 9), 16) / 255) * 100) / 100; ext.composited = c; ext.contrastOnBackground = Math.round(contrast(c, bg) * 1000) / 1000; ext.lightens = relativeLuminance(c) > relativeLuminance(bg); }
    group[name] = {
      $type: 'color', $value: hex,
      $description: (perMode ? 'Littéral par mode : cette valeur en ' + (mode === 'dark' ? 'sombre' : 'clair') + ', une autre dans l\'autre mode, sans passer par une rampe.' : 'Littéral : même valeur en clair et en sombre.')
        + (typeof v === 'object' && v.note ? ' ' + v.note : ''),
      $extensions: { [ns]: ext },
    };
  }
  return group;
}

// ---------------------------------------------------------------- usage d'un cran

/**
 * À quoi sert un cran, lu sur son seul contraste face au fond du mode. Les seuils sont ceux
 * de WCAG 2 : 3:1 pour un élément d'interface, 4,5:1 pour du texte, 7:1 pour AAA. En deçà
 * de 3:1, une couleur ne porte ni texte ni bordure fonctionnelle : c'est un fond ou un décor.
 */
const USAGE = [[1.25, 'surface'], [2, 'subtle'], [3, 'decorative'], [4.5, 'graphic'], [7, 'text'], [Infinity, 'strong']];
export const usageOf = ratio => USAGE.find(([max]) => ratio < max)[1];

const WORDS = {
  fr: {
    surface: 'Fond, surface', subtle: 'Fond d\'état, séparateur', decorative: 'Bordure décorative, jamais de texte',
    graphic: 'Icône, bordure de champ, graphique (3:1)', text: 'Texte, lien, bouton plein (AA)', strong: 'Texte principal, titre (AAA)',
    on: 'sur le fond', aa: 'Texte AA avec', ui: 'Élément 3:1 avec', none: 'aucun cran',
    pinned: 'Valeur imposée par la spec (épinglée)', oob: 'Contraste hors budget sur ce fond — ramené au blanc pur',
    clamped: c => `Chroma réduite par le gamut à cette luminance (plafond ${c})`, gain: g => `Éclat porté à ×${g} du mode clair`,
    seed: (h, src) => `Cran d'ancrage — dérivé de ${h}${src ? ` (${src})` : ''}`, synth: 'Cran d\'ancrage — seed synthétique (aucune couleur fournie à ce rang)',
    replaces: (r, h, d) => `Remplace « ${r} » ${h} (ΔE2000 ${d})`,
  },
  en: {
    surface: 'Background, surface', subtle: 'State background, divider', decorative: 'Decorative border, never text',
    graphic: 'Icon, input border, chart (3:1)', text: 'Text, link, solid button (AA)', strong: 'Primary text, heading (AAA)',
    on: 'on background', aa: 'AA text with', ui: '3:1 element with', none: 'no step',
    pinned: 'Value imposed by the spec (pinned)', oob: 'Contrast beyond this background\'s budget — clamped to pure white',
    clamped: c => `Chroma reduced by the gamut at this lightness (ceiling ${c})`, gain: g => `Vividness raised to ×${g} of light mode`,
    seed: (h, src) => `Anchor step — derived from ${h}${src ? ` (${src})` : ''}`, synth: 'Anchor step — synthetic seed (no colour provided at this rank)',
    replaces: (r, h, d) => `Replaces « ${r} » ${h} (ΔE2000 ${d})`,
  },
};
const r2 = x => Math.round(x * 100) / 100;

/** Une liste de crans, contractée en plages dans l'ordre de l'échelle : « 50–200, 900 ». */
function ranges(order, list) {
  const idx = list.map(s => order.indexOf(s)).sort((x, y) => x - y);
  const out = [];
  for (let k = 0; k < idx.length; k++) {
    let j = k;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    out.push(j > k ? order[idx[k]] + '–' + order[idx[j]] : order[idx[k]]);
    k = j;
  }
  return out.join(', ');
}

/**
 * Ce qu'un token doit dire, à deux lecteurs. La description est pour la personne qui le
 * survole dans Figma ou dans son éditeur : à quoi il sert, avec quoi il se combine. Les
 * `$extensions` sont pour la machine : les mêmes faits, chiffrés, pour qu'un outil ou une IA
 * choisisse une paire sans recalculer un contraste.
 */
export function usageFacts(scale, steps, i, background) {
  const hex = scale[i];
  const bg = contrast(hex, background);
  const shown = steps.map((s, k) => [s, scale[k]]).filter(([, h]) => h);
  const aaWith = shown.filter(([s, h]) => s !== steps[i] && contrast(hex, h) >= 4.5).map(([s]) => s);
  const uiWith = shown.filter(([s, h]) => s !== steps[i] && contrast(hex, h) >= 3).map(([s]) => s);
  return {
    usage: usageOf(bg),
    contrast: { background: r2(bg), white: r2(contrast(hex, '#ffffff')), black: r2(contrast(hex, '#000000')) },
    aaWith, uiWith,
  };
}

/**
 * L'arbre de tokens d'un mode. `mode` vaut `light` ou `dark` ; en l'absence de mode
 * sombre déclaré, seul le fichier clair est produit et il n'est pas suffixé — c'est le cas
 * mono-mode, et rien ne justifierait de renommer le livrable de tous les clients qui n'ont
 * pas de mode sombre.
 */
export function tokenTrees(spec, data, mode, { lang = spec.lang || 'fr' } = {}) {
  const W = WORDS[lang] || WORDS.fr;
  const core = data.meta.coreMethod;
  const root = spec.tokenRoot || 'core';
  const ns = spec.id || 'brand';
  const suffix = '-hue-variants';
  const background = mode === 'dark' ? data.meta.dark.background : data.meta.lightBackground;
  const tokens = { [root]: { color: {} } };
  // Les déclinaisons de teinte sortent dans un fichier séparé : ce sont des hypothèses de
  // travail, elles n'ont rien à faire dans la collection de primitives qui part en production.
  const variantTokens = { [root + suffix]: { color: {} } };
  const emitted = data.meta.steps.filter(st => !spec.emitSteps || spec.emitSteps.includes(st));

  for (const ramp of data.ramps) {
    const full = mode === 'dark' ? ramp.darkColors[core] : ramp.colors[core];
    // les paires se calculent sur les crans livrés : un cran absent ne peut pas être conseillé
    const scale = full.map((h, k) => (emitted.includes(data.meta.steps[k]) ? h : null));
    const detail = mode === 'dark' ? (ramp.darkDetail?.[core] || []) : [];
    const group = { $description: ramp.label + (ramp.note ? ' — ' + ramp.note : '') };
    data.meta.steps.forEach((step, i) => {
      // un préréglage de crans peut ne livrer qu'une partie de la grille calculée
      if (!scale[i]) return;
      const token = { $type: 'color', $value: scale[i] };
      const facts = usageFacts(scale, data.meta.steps, i, background);
      const lines = [
        `${W[facts.usage]} — ${lang === 'fr' ? String(facts.contrast.background).replace('.', ',') : facts.contrast.background}:1 ${W.on}.`,
        `${W.aa} : ${facts.aaWith.length ? ranges(data.meta.steps, facts.aaWith) : W.none}.`.replace(' :', lang === 'fr' ? ' :' : ':'),
        `${W.ui} : ${facts.uiWith.length ? ranges(data.meta.steps, facts.uiWith) : W.none}.`.replace(' :', lang === 'fr' ? ' :' : ':'),
      ];
      const ext = { ...facts };
      if (mode === 'dark') {
        const d = detail[i];
        // Ce qui a coûté quelque chose se dit dans le token, pas dans un rapport annexe :
        // c'est là que la question « pourquoi cette valeur » sera posée.
        if (d?.pinned) lines.push(W.pinned + '.');
        if (d?.outOfBudget) lines.push(W.oob + '.');
        else if (d?.clamped) lines.push(W.clamped(d.maxChroma) + '.');
        else if (d && d.chromaGain !== null && d.chromaGain > 1.01) lines.push(W.gain(d.chromaGain) + '.');
      } else {
        if (i === ramp.seedIndex) lines.push((ramp.seedProvided ? W.seed(ramp.seed, ramp.source) : W.synth) + '.');
        const hits = data.anchorMap.filter(a => a.ramp === ramp.name && a.perMethod[core].step === step);
        for (const a of hits) lines.push(W.replaces(a.role, a.hex, a.perMethod[core].deltaE) + '.');
        if (hits.length) ext.replaces = hits.map(a => ({ role: a.role, hex: a.hex, deltaE: a.perMethod[core].deltaE }));
      }
      token.$description = lines.join(' ');
      token.$extensions = { [ns]: ext };
      group[step] = token;
    });
    if (ramp.derived) variantTokens[root + suffix].color[ramp.name] = group;
    else tokens[root].color[ramp.name] = group;
  }

  const stat = staticGroup(data, ns, mode);
  if (stat) tokens[root].color.static = stat;

  const hasVariants = Object.keys(variantTokens[root + suffix].color).length > 0;
  return { tokens, variantTokens: hasVariants ? variantTokens : null };
}

// ---------------------------------------------------------------- guide d'usage

/**
 * Le guide d'usage du système, écrit pour deux lecteurs : la personne qui découvre la palette,
 * et l'IA qui va s'en servir pour produire une interface. Il dit la règle et le rôle de chaque
 * cran, et reprend tout sous forme de données dans un bloc JSON final (`guideData`), pour qu'un
 * agent n'ait rien à déduire du texte. Il n'attribue pas de rôles sémantiques : Hueladder propose
 * une échelle, le système sémantique reste la décision de l'équipe.
 */
export function usageGuide(spec, data, { lang = spec.lang || 'fr' } = {}) {
  const fr = lang !== 'en';
  const T = (a, b) => (fr ? a : b);
  const W = WORDS[fr ? 'fr' : 'en'];
  const core = data.meta.coreMethod;
  const steps = data.meta.steps.filter(st => !spec.emitSteps || spec.emitSteps.includes(st));
  const real = data.ramps.filter(r => !r.derived);
  const ns = spec.id || 'brand';
  const lightBg = data.meta.lightBackground, dark = data.meta.dark;
  const scaleOf = (r, mode) => {
    const src = mode === 'dark' ? r.darkColors[core] : r.colors[core];
    return steps.map(st => src[data.meta.steps.indexOf(st)]);
  };
  const rules = data.rules;
  const RW = ruleWords(rules, fr ? 'fr' : 'en');
  const ref = real.find(r => r.kind === 'brand') || real[0];
  const neutral = real.find(r => r.kind === 'neutral');
  const fmt = x => (fr ? x.toFixed(2).replace('.', ',') : x.toFixed(2));

  const L = [];
  L.push(`# ${spec.brand} — ${T('guide d\'usage des couleurs', 'colour usage guide')}`, '');
  if (spec.caveat) L.push(`> **${T('À lire avant les chiffres', 'Read before the numbers')}** — ${spec.caveat}`, '');
  const accessNotes = [];
  if (data.highContrast) accessNotes.push(T('**Contraste élevé** : `code/colors-high-contrast.css`, chargé après `colors.css`, redéfinit les mêmes variables sous `@media (prefers-contrast: more)` — encres plus franches, fonds inchangés, aucune règle écrite pour le mode normal ne casse.',
    '**High contrast**: `code/colors-high-contrast.css`, loaded after `colors.css`, redefines the same variables under `@media (prefers-contrast: more)` — firmer inks, unchanged backgrounds, no rule written for the normal mode breaks.'));
  if (data.highContrast || data.cvd) accessNotes.push(T('**Couleurs forcées** (`forced-colors: active`, le contraste élevé de Windows) : le système remplace ces couleurs par les siennes (`Canvas`, `CanvasText`, `LinkText`, `ButtonFace`…). Ne porter aucun sens par la seule couleur ; garder `forced-color-adjust: none` pour les seules pastilles qui *sont* l\'information (nuanciers, données).',
    '**Forced colours** (`forced-colors: active`, Windows high contrast): the system replaces these colours with its own (`Canvas`, `CanvasText`, `LinkText`, `ButtonFace`…). Never carry meaning by colour alone; keep `forced-color-adjust: none` only for swatches that *are* the information (palettes, data).'));
  if (data.cvd) accessNotes.push(T('**Modes daltoniens** : mêmes luminances, donc mêmes contrastes et même règle ; seules les teintes des couleurs de statut tournent. À proposer en réglage d\'affichage, pas à imposer.',
    '**Colour-blind modes**: same luminances, hence same contrasts and the same rule; only status hues turn. Offer them as a display setting, never impose them.'));
  if (accessNotes.length) L.push(`## ${T('Accessibilité au-delà du contraste', 'Accessibility beyond contrast')}`, '', ...accessNotes.map(x => '- ' + x), '');
  L.push(T(
    `Ce fichier s'adresse aux personnes et aux IA qui construisent des interfaces avec ce système. Il est généré par Hueladder à partir de la même spec que les tokens : il ne se modifie pas à la main.`,
    `This file is for people and AI agents building interfaces with this system. Hueladder generates it from the same spec as the tokens: do not edit it by hand.`), '');
  L.push(`- ${T('Nuanciers', 'Ramps')} : ${real.map(r => `\`${r.name}\``).join(', ')}`);
  for (const r of real.filter(x => x.primitives && x.primitives.length)) L.push(`  - \`${r.name}\` ${T('sert', 'serves')} : ${r.primitives.map(p => `\`${p}\``).join(', ')}`);
  L.push(`- ${T('Crans', 'Steps')} : ${steps.join(', ')}`);
  L.push(`- ${T('Modes', 'Modes')} : ${T('clair', 'light')} (${T('fond', 'background')} \`${lightBg}\`)${dark ? `, ${T('sombre', 'dark')} (${T('fond', 'background')} \`${dark.background}\`)` : ''}`);
  L.push(`- ${T('Tokens', 'Tokens')} : \`${spec.tokenRoot || 'core'}.color.<${T('nuancier', 'ramp')}>.<${T('cran', 'step')}>\``, '');

  L.push(`## ${T('La règle', 'The rule')}`, '');
  L.push(T(
    `Le nom d'un cran porte son contraste. Deux crans séparés de **${RW.aa}** passent AA (4,5:1, texte), de **${RW.ui}** le seuil des éléments d'interface (3:1), de **${RW.aaa}** AAA (7:1)${rules.grain ? ' — l\'écart se lit directement entre les noms' : ''}. La règle vaut pour **tous les nuanciers**, et deux nuanciers sont interchangeables à cran égal : un texte \`${neutral ? neutral.name : ref.name}.900\` sur \`${ref.name}.100\` se juge comme sur \`${neutral ? neutral.name : ref.name}.100\`.`,
    `A step's name carries its contrast. Two steps **${RW.aa}** apart pass AA (4.5:1, text), **${RW.ui}** the UI-component threshold (3:1), **${RW.aaa}** AAA (7:1)${rules.grain ? ' — the gap reads directly between names' : ''}. The rule holds for **every ramp**, and ramps are interchangeable at equal step: \`${neutral ? neutral.name : ref.name}.900\` text on \`${ref.name}.100\` behaves like it does on \`${neutral ? neutral.name : ref.name}.100\`.`), '');
  if (dark && (dark.method || 'mirror-wcag') === 'mirror-wcag') L.push(T(
    `En mode sombre, **les noms ne changent pas** : chaque cran garde, face au fond sombre, le contraste qu'il a en clair face au blanc, et les règles du nom (N rangs ⇒ seuil) tiennent dans les deux modes. Une paire tout juste au seuil (à 0,01 près) peut basculer d'un mode à l'autre : pour une garantie, raisonner en écart de rangs, pas en paire limite. On change de fichier de valeurs, jamais de token.`,
    `In dark mode, **names do not change**: each step keeps, against the dark background, the contrast it has against white in light mode, and the naming rules (N ranks ⇒ threshold) hold in both modes. A pair right at the threshold (within 0.01) can tip over from one mode to the other: for a guarantee, reason in rank distance, not in borderline pairs. Swap the value file, never the token.`), '');
  if (dark && dark.outOfBudget && dark.outOfBudget.length) L.push(T(
    `Attention : sur ce fond, les crans ${dark.outOfBudget.join(', ')} ne peuvent pas atteindre leur contraste (budget ${dark.contrastBudget}:1). Les paires qui les touchent sont plus faibles en sombre.`,
    `Caution: on this background, steps ${dark.outOfBudget.join(', ')} cannot reach their contrast (budget ${dark.contrastBudget}:1). Pairs involving them are weaker in dark mode.`), '');
  else if (dark) L.push(T(
    `En mode sombre, les noms ne changent pas, mais la méthode choisie (\`${dark.method}\`) ne transporte pas exactement la règle : **vérifier chaque paire en sombre** avec \`$extensions.${ns}.aaWith\` du fichier sombre.`,
    `In dark mode, names do not change, but the chosen method (\`${dark.method}\`) does not carry the rule over exactly: **check every pair in dark mode** with \`$extensions.${ns}.aaWith\` from the dark file.`), '');
  if (data.meta.naming === 'grid' || !data.meta.naming) L.push(T('Les rangs se comptent sur la grille 50 → 950. Les crans hors grille (25, 75, 150…) servent à la finesse et ne portent pas de garantie : vérifier leur contraste au cas par cas.', 'Ranks are counted on the 50 → 950 grid. Off-grid steps (25, 75, 150…) add finesse but carry no guarantee: check their contrast case by case.'), '');
  else if (rules.grain) L.push(T('Le nom de chaque cran fixe son contraste : on peut ajouter un cran à tout nom valide sans qu\'aucun autre ne bouge, et la règle vaut pour lui aussi.', 'Each step\'s name sets its contrast: a step can be added at any valid name without any other moving, and the rule covers it too.'), '');
  else L.push(T('Les crans sont répartis régulièrement dans l\'ordre de la liste : en ajouter ou en retirer répartit à nouveau tous les autres.', 'Steps are spread evenly in list order: adding or removing one spreads all the others again.'), '');

  L.push(`## ${T('Le rôle de chaque cran', 'What each step is for')}`, '');
  L.push(T(`Contrastes mesurés sur \`${ref.name}\` ; les autres nuanciers tiennent les mêmes à moins de 2 % près.`, `Contrasts measured on \`${ref.name}\`; other ramps match within 2%.`), '');
  L.push(`| ${T('Cran', 'Step')} | ${T('Usage', 'Use')} | ${T('sur blanc', 'on white')} |${dark ? ` ${T('sombre, sur', 'dark, on')} ${dark.background} |` : ''} ${T('Texte AA avec', 'AA text with')} |`);
  L.push(`|---|---|---|${dark ? '---|' : ''}---|`);
  const RL = scaleOf(ref, 'light'), RD = dark ? scaleOf(ref, 'dark') : null;
  steps.forEach((st, k) => {
    if (!RL[k]) return;
    const f = usageFacts(RL, steps, k, lightBg);
    L.push(`| ${st} | ${W[f.usage]} | ${fmt(f.contrast.background)}:1 |${RD ? ` ${RD[k] ? fmt(contrast(RD[k], dark.background)) + ':1' : '—'} |` : ''} ${f.aaWith.length ? ranges(steps, f.aaWith) : '—'} |`);
  });
  L.push('');

  L.push(`## ${T('Consignes pour une IA', 'Instructions for an AI')}`, '');
  for (const line of fr ? [
    'Toujours référencer un token, jamais une valeur hexadécimale.',
    `Choisir une paire par l'écart ${rules.grain ? 'entre les noms' : 'de rangs'} : ${RW.aa} pour du texte, ${RW.ui} pour une icône ou une bordure de champ. Pour vérifier, lire \`$extensions.${ns}.aaWith\` et \`uiWith\` dans les tokens.`,
    'Ne jamais mélanger les valeurs du clair et du sombre dans un même écran : les deux fichiers ont les mêmes noms.',
    'Un cran marqué « Bordure décorative » ou « Fond » ne porte jamais de texte.',
    'Pour un état (survol, pression), se décaler d\'un cran dans le sens qui augmente le contraste avec le fond.',
    'Ne pas créer de nouvelle couleur : si un besoin n\'est pas couvert, le signaler.',
  ] : [
    'Always reference a token, never a hex value.',
    `Pick a pair by ${rules.grain ? 'name gap' : 'rank distance'}: ${RW.aa} for text, ${RW.ui} for an icon or input border. To check, read \`$extensions.${ns}.aaWith\` and \`uiWith\` in the tokens.`,
    'Never mix light and dark values on one screen: both files use the same names.',
    'A step labelled « Decorative border » or « Background » never carries text.',
    'For a state (hover, pressed), move one step in the direction that increases contrast with the background.',
    'Do not create new colours: if a need is not covered, flag it.',
  ]) L.push(`- ${line}`);
  L.push('');
  if ((spec.notes || []).length) {
    L.push(`## ${T('Exceptions documentées', 'Documented exceptions')}`, '');
    for (const n of spec.notes) L.push(`- ${n}`);
    L.push('');
  }

  L.push(`## ${T('Données', 'Data')}`, '');
  L.push(T('Tout ce qui précède, sous forme de données.', 'Everything above, as data.'), '');
  const payload = guideData(spec, data);
  L.push('```json', JSON.stringify(payload, null, 2), '```', '');
  return L.join('\n');
}

/** Les données du guide, seules : ce qu'un agent lit sans passer par le texte. */
export function guideData(spec, data) {
  const core = data.meta.coreMethod, rules = data.rules, dark = data.meta.dark, lightBg = data.meta.lightBackground;
  const steps = data.meta.steps.filter(st => !spec.emitSteps || spec.emitSteps.includes(st));
  const real = data.ramps.filter(r => !r.derived);
  const scaleOf = (r, mode) => {
    const src = mode === 'dark' ? r.darkColors[core] : r.colors[core];
    return steps.map(st => src[data.meta.steps.indexOf(st)]);
  };
  const ref = real.find(r => r.kind === 'brand') || real[0];
  const RL = scaleOf(ref, 'light');
  return {
    system: spec.brand, generator: 'Hueladder', method: core,
    rule: rules.grain ? { unit: 'nameGap', aa: rules.rankForAA * rules.grain, ui: rules.rankForUI * rules.grain, aaa: rules.rankForAAA * rules.grain, naming: data.meta.naming }
      : { unit: 'ranks', aa: rules.rankForAA, ui: rules.rankForUI, aaa: rules.rankForAAA, grid: data.meta.coreSteps },
    steps, backgrounds: { light: lightBg, ...(dark ? { dark: dark.background } : {}) },
    ramps: Object.fromEntries(real.map(r => [r.name, {
      kind: r.kind, label: r.label, ...(r.primitives && r.primitives.length ? { primitives: r.primitives } : {}),
      light: Object.fromEntries(steps.map((st, k) => [st, scaleOf(r, 'light')[k]])),
      ...(dark ? { dark: Object.fromEntries(steps.map((st, k) => [st, scaleOf(r, 'dark')[k]])) } : {}),
    }])),
    usage: Object.fromEntries(steps.map((st, k) => [st, RL[k] ? usageFacts(RL, steps, k, lightBg).usage : null])),
    // pour un agent qui dessine des graphiques : les séries à prendre, dans l'ordre, en alias de crans
    ...(data.dataviz ? { dataviz: { categorical: data.dataviz.categorical.map(c => ({ family: c.family, step: c.step, other: !!c.other })), secondEncodingFrom: data.dataviz.secondEncodingFrom,
      sequential: data.dataviz.sequential.map(c => ({ family: c.family, step: c.step })), diverging: data.dataviz.diverging.map(c => ({ family: c.family, step: c.step })) } } : {}),
    ...(data.cvd ? { colourBlindModes: data.cvd.map(m => ({ mode: m.key, hueShift: m.shift, minDistance: { before: m.before, after: m.after } })) } : {}),
  };
}

// ---------------------------------------------------------------- table de migration

/**
 * Avant / après : chaque couleur existante, ce qu'elle devient, de combien elle bouge et
 * pourquoi. C'est le document qui sert à migrer une base de code et à le faire accepter.
 */
export function migrationTable(spec, data, { lang = spec.lang || 'fr' } = {}) {
  const fr = lang !== 'en';
  const T = (a, b) => (fr ? a : b);
  const core = data.meta.coreMethod;
  const d = x => (fr ? String(x).replace('.', ',') : String(x));
  const L = [`# ${spec.brand} — ${T('migration des couleurs', 'colour migration')}`, '',
    T('Chaque couleur d\'aujourd\'hui, le token qui la remplace, l\'écart perçu (ΔE2000 : sous 1, invisible ; sous 2, imperceptible hors comparaison directe ; au-delà de 5, visible) et la raison.',
      'Each colour in use today, the token that replaces it, the perceived gap (ΔE2000: under 1, invisible; under 2, unnoticeable outside direct comparison; above 5, visible) and the reason.'), '',
    `| ${T('Nuancier', 'Ramp')} | ${T('Nom actuel', 'Current name')} | ${T('Couleur actuelle', 'Current colour')} | ${T('Devient', 'Becomes')} | ${T('Nouvelle couleur', 'New colour')} | ΔE | ${T('Raison', 'Reason')} |`,
    '|---|---|---|---|---|---|---|'];
  let moved = 0, renamed = 0, far = 0;
  const gaps = [];
  for (const a of data.anchorMap) {
    const pm = a.perMethod[core];
    if (!pm || !pm.hex) continue;
    const numeric = /^\d+$/.test(a.role);
    let why;
    // l'écart d'abord : une couleur sans équivalent n'est ni renommée ni ajustée, elle change de nature
    if (pm.deltaE > 10) { far++; why = T('sans équivalent dans la rampe générée : la prendre dans le neutre, ou la garder comme couleur fixe', 'no equivalent in the generated ramp: take it from the neutral, or keep it as a fixed colour'); }
    else if (numeric && a.role !== pm.step) { renamed++; why = T(`son contraste est celui d'un ${pm.step}`, `its contrast is that of a ${pm.step}`); }
    else if (pm.deltaE < 1) why = T('inchangée', 'unchanged');
    else { moved++; why = T(`ajustée pour tenir la règle`, `adjusted to hold the rule`); }
    L.push(`| ${a.rampLabel} | ${a.role} | \`${a.hex}\` | \`${a.ramp}.${pm.step}\` | \`${pm.hex}\` | ${d(pm.deltaE)} | ${why} |`);
    gaps.push({ name: `${a.rampLabel} ${a.role}`, de: pm.deltaE });
  }
  L.push('', T(`${renamed} couleur(s) changent de nom, ${moved} sont ajustées, ${far} n'ont pas d'équivalent, les autres restent en place.`,
    `${renamed} colour(s) change name, ${moved} are adjusted, ${far} have no equivalent, the others stay put.`));
  const worst = gaps.filter(g => g.de >= 1).sort((x, y) => y.de - x.de).slice(0, 5);
  if (worst.length) L.push('', T('Les plus grands écarts : ', 'The largest gaps: ') + worst.map(g => `${g.name} (ΔE ${d(g.de)})`).join(', ') + '.');
  if ((spec.notes || []).length) L.push('', `## ${T('Exceptions documentées', 'Documented exceptions')}`, '', ...spec.notes.map(n => `- ${n}`));
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------- code

const codeScales = (spec, data, mode) => {
  const steps = data.meta.steps, core = data.meta.coreMethod;
  return data.ramps.filter(r => !r.derived).map(r => {
    const src = (mode === 'dark' ? r.darkColors : r.colors)[core];
    return { name: r.name, values: steps.map((s, i) => [s, src[i]]).filter(([s, h]) => h && (!spec.emitSteps || spec.emitSteps.includes(s))) };
  });
};
const cssVars = (spec, data, mode, indent = '  ') => codeScales(spec, data, mode)
  .map(r => r.values.map(([s, h]) => `${indent}--color-${r.name}-${s}: ${h};`).join('\n')).join('\n');

/** Variables CSS : `:root` pour le clair, `[data-theme="dark"]` pour le sombre. */
export function cssVariables(spec, data) {
  const st = mode => Object.entries(data.staticTokens || {}).map(([n, v]) => `  --color-static-${n}: ${staticValue(v, mode)};`);
  const darkSt = Object.entries(data.staticTokens || {}).filter(([, v]) => typeof v === 'object' && v.dark && v.dark !== v.light).map(([n, v]) => `  --color-static-${n}: ${v.dark};`);
  return ':root {\n' + [cssVars(spec, data, 'light'), ...st('light')].join('\n') + '\n}\n'
    + (data.meta.dark ? '\n[data-theme="dark"] {\n' + [cssVars(spec, data, 'dark'), ...darkSt].join('\n') + '\n}\n' : '');
}

/** Tailwind 3 : `tailwind.config.js`, valeurs du mode clair. */
export function tailwindConfig(spec, data, { lang = spec.lang || 'fr' } = {}) {
  const head = lang === 'en' ? '// tailwind.config.js — light-mode values; for dark, point to the CSS variables'
    : '// tailwind.config.js — valeurs du mode clair ; pour le sombre, pointer vers les variables CSS';
  return head + '\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n'
    + codeScales(spec, data, 'light').map(r => `        '${r.name}': {\n` + r.values.map(([s, h]) => `          ${s}: '${h}',`).join('\n') + '\n        },').join('\n')
    + '\n      },\n    },\n  },\n};\n';
}

/**
 * Tailwind 4 : un bloc `@theme` (les utilitaires `bg-brand-500`… lisent ces variables), et le
 * sombre en surcharge des mêmes variables : rien à changer dans les classes.
 */
export function tailwindTheme(spec, data) {
  return '@import "tailwindcss";\n\n@theme {\n' + cssVars(spec, data, 'light') + '\n}\n'
    + (data.meta.dark ? '\n[data-theme="dark"] {\n' + cssVars(spec, data, 'dark') + '\n}\n' : '');
}
