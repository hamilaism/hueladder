// Le paquet de livraison : un dossier par destination (code, Figma, Tokens Studio, IA), tous
// tirés des mêmes tokens. Le studio le télécharge en zip, la ligne de commande l'écrit en
// dossier (`hueladder export --format package`). Formats et sources : references/benchmark.md (partie livraison).

import { hexToRgb } from './color.mjs';
import { tokenTrees, usageGuide, guideData, migrationTable, cssVariables, tailwindConfig, tailwindTheme } from './outputs.mjs';
import { decisionFor, decisionMarkdown } from './audit.mjs';
import { datavizCss } from './dataviz.mjs';
import { gradientOutputs } from './gradient.mjs';
import { p3Css } from './p3.mjs';

const json = x => JSON.stringify(x, null, 2) + '\n';
const mapTokens = (node, f) => (node && typeof node === 'object' && !Array.isArray(node)
  ? ('$value' in node ? f(node) : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, k.startsWith('$') ? v : mapTokens(v, f)])))
  : node);

// L'import natif de Figma (DTCG 2025.10) n'accepte pas un hex en texte : il veut l'objet couleur.
const figmaColor = hex => {
  const { r, g, b } = hexToRgb(hex);
  return { colorSpace: 'srgb', components: [r, g, b].map(v => Math.round(v * 10000) / 10000), alpha: 1, hex };
};
const toFigma = tree => mapTokens(tree, t => ({ ...t, $value: t.$type === 'color' ? figmaColor(t.$value) : t.$value }));

/**
 * Les fichiers du paquet, [[chemin, contenu]]. `spec` : la spec telle qu'on la rejoue
 * (`specJson`, avant dépliage des crans) ; `audit` : ajoute la table de migration.
 */
export function packageFiles(spec, data, { lang = spec.lang || 'fr', specJson = spec, audit = data.anchorMap.length > 0 } = {}) {
  const fr = lang !== 'en', id = spec.id || 'brand', dark = !!data.meta.dark;
  const light = tokenTrees(spec, data, 'light', { lang }), night = dark ? tokenTrees(spec, data, 'dark', { lang }) : null;
  const files = [];
  const add = (p, c) => files.push([`${id}-colors/${p}`, c]);

  const rd = readme({ id, brand: spec.brand, dark, audit, fr, variants: !!light.variantTokens, cvd: !!(data.cvd && data.cvd.length) });
  add('README.md', spec.caveat ? rd.replace('\n', `\n\n> **${fr ? 'À lire avant les chiffres' : 'Read before the numbers'}** — ${spec.caveat}\n`) : rd);
  add(`${id}.hueladder.json`, json(specJson));

  add('code/colors.css', cssVariables(spec, data));
  add('code/tailwind-v4.css', tailwindTheme(spec, data));
  add('code/tailwind.config.js', tailwindConfig(spec, data, { lang }));
  if (data.dataviz) add('code/dataviz.css', datavizCss(spec, data.dataviz));
  // P3 : l'éclat que sRGB a coupé, rendu aux écrans qui le tiennent — même luminance, même contraste
  if (spec.p3) {
    const l = p3Css(spec, data, 'light'), d = dark ? p3Css(spec, data, 'dark') : [];
    if (l.length || d.length) add('code/colors-p3.css', '@media (color-gamut: p3) {\n' + (l.length ? '  :root {\n' + l.join('\n') + '\n  }\n' : '') + (d.length ? '  [data-theme="dark"] {\n' + d.join('\n') + '\n  }\n' : '') + '}\n');
  }
  if (data.gradients) { const g = gradientOutputs(data.gradients); add('code/gradients.css', g.css); add(`code/tokens/${id}.gradients.tokens.json`, json(g.tokens)); }
  add(`code/tokens/${id}.light.tokens.json`, json(light.tokens));
  if (dark) add(`code/tokens/${id}.dark.tokens.json`, json(night.tokens));
  if (light.variantTokens) add(`code/tokens/${id}-hue-variants.light.tokens.json`, json(light.variantTokens));
  if (night && night.variantTokens) add(`code/tokens/${id}-hue-variants.dark.tokens.json`, json(night.variantTokens));

  // Figma : un fichier par mode, mêmes noms — glissés ensemble, ils font une collection à deux modes
  add('figma/Light.tokens.json', json(toFigma(light.tokens)));
  if (dark) add('figma/Dark.tokens.json', json(toFigma(night.tokens)));

  // les modes daltoniens et le contraste élevé : la même structure, d'autres valeurs
  const MODE = { 'protan-deutan': 'Protanopia-Deuteranopia', tritan: 'Tritanopia', 'high-contrast': 'HighContrast' };
  if (data.highContrast) {
    const core = data.meta.coreMethod, h = data.highContrast;
    const alt = { ...data, ramps: data.ramps.map(r => ({ ...r, colors: { ...r.colors, [core]: h.light[r.name] || r.colors[core] },
      ...(h.dark && r.darkColors ? { darkColors: { ...r.darkColors, [core]: h.dark[r.name] || r.darkColors[core] } } : {}) })) };
    // à charger après colors.css : les mêmes variables, sous la préférence de l'utilisateur
    add('code/colors-high-contrast.css', '@media (prefers-contrast: more) {\n' + cssVariables(spec, alt).replace(/^(?=.)/gm, '  ') + '}\n');
  }
  for (const m of [...(data.cvd || []), ...(data.highContrast ? [data.highContrast] : [])]) {
    const core = data.meta.coreMethod;
    const alt = { ...data, ramps: data.ramps.map(r => ({ ...r, colors: { ...r.colors, [core]: m.light[r.name] || r.colors[core] },
      ...(m.dark && r.darkColors ? { darkColors: { ...r.darkColors, [core]: m.dark[r.name] || r.darkColors[core] } } : {}) })) };
    const l = tokenTrees(spec, alt, 'light', { lang }).tokens;
    add(`code/tokens/${id}.light-${m.key}.tokens.json`, json(l));
    add(`figma/Light-${MODE[m.key]}.tokens.json`, json(toFigma(l)));
    if (dark && m.dark) {
      const d = tokenTrees(spec, alt, 'dark', { lang }).tokens;
      add(`code/tokens/${id}.dark-${m.key}.tokens.json`, json(d));
      add(`figma/Dark-${MODE[m.key]}.tokens.json`, json(toFigma(d)));
    }
  }

  // Tokens Studio : un seul fichier, un jeu par mode ; les thèmes pour qui a la version Pro
  const sets = { light: light.tokens, ...(dark ? { dark: night.tokens } : {}) };
  add('tokens-studio/tokens.json', json({
    ...sets,
    $themes: Object.keys(sets).map(k => ({ id: k, name: k === 'light' ? 'Light' : 'Dark', selectedTokenSets: { [k]: 'enabled' } })),
    $metadata: { tokenSetOrder: Object.keys(sets) },
  }));

  add('ai/color-guide.md', usageGuide(spec, data, { lang }));
  add('ai/palette.json', json(guideData(spec, data)));
  if (audit) add('migration.md', migrationTable(spec, data, { lang }));
  if (audit) add('decision.md', decisionMarkdown(decisionFor(data, spec.ramps.filter(r => !r.derived), { lang, accepted: (spec.accepted || []).map(a => a.key) }), { lang, brand: spec.brand }));
  return files;
}

function readme({ id, brand, dark, audit, fr, variants, cvd }) {
  const T = (a, b) => (fr ? a : b);
  return [
    `# ${brand} — ${T('couleurs', 'colours')}`, '',
    T(`Généré par Hueladder. Tous les fichiers viennent de la même spec (\`${id}.hueladder.json\`) : pour changer une couleur, rejouer la spec, ne pas retoucher un fichier.`,
      `Generated by Hueladder. Every file comes from the same spec (\`${id}.hueladder.json\`): to change a colour, replay the spec, do not edit a file.`), '',
    `## ${T('Code', 'Code')}`, '',
    `- \`code/colors.css\` — ${T('variables CSS', 'CSS variables')}${dark ? T(', le sombre sous `[data-theme="dark"]`', ', dark under `[data-theme="dark"]`') : ''}.`,
    `- \`code/tailwind-v4.css\` — ${T('Tailwind 4 : à importer à la place de `@import "tailwindcss"`', 'Tailwind 4: import it instead of `@import "tailwindcss"`')}.`,
    `- \`code/tailwind.config.js\` — ${T('Tailwind 3, mode clair', 'Tailwind 3, light mode')}.`,
    `- \`code/tokens/\` — ${T('tokens DTCG (couleurs en hex), pour Style Dictionary ou tout outil DTCG', 'DTCG tokens (hex colours), for Style Dictionary or any DTCG tool')}.`,
    ...(variants ? [`- \`code/tokens/${id}-hue-variants.*\` — ${T('déclinaisons de teinte : hypothèses de travail, à ne pas importer sans arbitrage', 'hue variants: working hypotheses, do not import without a decision')}.`] : []),
    '', '## Figma', '',
    T('1. Panneau Variables → Importer.', '1. Variables panel → Import.'),
    T(`2. Glisser ${dark ? '`figma/Light.tokens.json` et `figma/Dark.tokens.json` ensemble : un fichier par mode' : '`figma/Light.tokens.json`'}.`,
      `2. Drop ${dark ? '`figma/Light.tokens.json` and `figma/Dark.tokens.json` together: one file per mode' : '`figma/Light.tokens.json`'}.`),
    T('3. Vérifier les noms des modes, puis publier la bibliothèque.', '3. Check the mode names, then publish the library.'), '',
    '## Tokens Studio', '',
    T('Charger `tokens-studio/tokens.json` (Paramètres → Synchronisation → fichier local ou dépôt, en mode fichier unique). Un jeu par mode ; les thèmes `Light` et `Dark` servent avec la version Pro.',
      'Load `tokens-studio/tokens.json` (Settings → Sync → local file or repository, single-file mode). One set per mode; the `Light` and `Dark` themes work with the Pro version.'), '',
    `## ${T('IA', 'AI')}`, '',
    T('`ai/color-guide.md` explique la règle et le rôle de chaque cran ; `ai/palette.json` donne les mêmes informations en données. À joindre au contexte d\'un agent qui produit des interfaces.',
      '`ai/color-guide.md` explains the rule and each step\'s role; `ai/palette.json` holds the same as data. Add both to the context of an agent that builds interfaces.'), '',
    ...(cvd ? [`## ${T('Modes daltoniens', 'Colour-blind modes')}`, '', T('Les fichiers `*-protan-deutan` et `*-tritan` gardent la luminance de chaque couleur : contrastes et règle du nom identiques ; seules les teintes des couleurs de statut tournent pour rester distinguables.', 'The `*-protan-deutan` and `*-tritan` files keep every colour\'s luminance: contrasts and the naming rule are identical; only status hues turn to stay distinguishable.'), ''] : []),
    ...(audit ? [`## ${T('Migration', 'Migration')}`, '', T('`migration.md` : chaque couleur d\'aujourd\'hui, ce qu\'elle devient, de combien elle bouge. `decision.md` : garder ou régénérer, en trois minutes de lecture.', '`migration.md`: each current colour, what it becomes, how far it moves. `decision.md`: keep or regenerate, a three-minute read.'), ''] : []),
  ].join('\n');
}
