// Relevé couleur d'un fichier Figma, pour `hueladder audit` (ou `hueladder figma`). Lecture seule : rien
// n'est modifié dans le fichier.
//
// À exécuter dans Figma : console d'un plugin de développement, ou `figma_execute` du serveur
// MCP figma-console. Le résultat est un JSON à enregistrer (ex. `figma-scan.json`) puis à
// passer à Hueladder : `node engine/hueladder.mjs figma figma-scan.json`, ou à coller comme source dans
// l'entrée Auditer du studio.
//
// Ce qu'il relève : les variables couleur (valeur par mode, portées, nom pour le code), les
// styles de peinture, chaque remplissage plein des nœuds (lié à une variable ou en dur), les
// textes liés ou non, et les libellés hex posés à côté d'une pastille.

(async () => {
  const toHex = ({ r, g, b }) => '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const modeName = Object.fromEntries(collections.flatMap(c => c.modes.map(m => [m.modeId, m.name])));
  const colName = Object.fromEntries(collections.map(c => [c.id, c.name]));
  const vars = (await figma.variables.getLocalVariablesAsync('COLOR')).map(v => ({
    name: v.name, key: v.key, collection: colName[v.variableCollectionId], scopes: v.scopes, codeSyntax: v.codeSyntax,
    values: Object.fromEntries(Object.entries(v.valuesByMode).filter(([, x]) => x && typeof x === 'object' && 'r' in x).map(([m, x]) => [modeName[m] || m, toHex(x)])),
  }));
  const styles = (await figma.getLocalPaintStylesAsync()).map(s => ({ name: s.name, key: s.key, hex: s.paints[0] && s.paints[0].type === 'SOLID' ? toHex(s.paints[0].color) : null }));

  await figma.loadAllPagesAsync();
  const fills = new Map(), labels = [];
  let textTotal = 0, textBound = 0;
  for (const node of figma.root.findAll(() => true)) {
    if ('fills' in node && Array.isArray(node.fills)) {
      node.fills.forEach((p, i) => {
        if (p.type !== 'SOLID' || p.visible === false) return;
        const hex = toHex(p.color), bound = !!(node.boundVariables && node.boundVariables.fills && node.boundVariables.fills[i]);
        const k = hex + '|' + bound;
        fills.set(k, { hex, bound, count: (fills.get(k)?.count || 0) + 1 });
        if (node.type === 'TEXT') { textTotal++; if (bound) textBound++; }
      });
    }
    // un libellé hex : un texte dont le contenu est un hex, voisin d'une pastille pleine
    if (node.type === 'TEXT' && /^#?[0-9a-f]{6}$/i.test((node.characters || '').trim()) && node.parent && 'children' in node.parent) {
      const sw = node.parent.children.find(c => c !== node && 'fills' in c && Array.isArray(c.fills) && c.fills[0] && c.fills[0].type === 'SOLID');
      if (sw) labels.push({ node: node.parent.name, label: node.characters.trim(), fill: toHex(sw.fills[0].color) });
    }
  }
  return JSON.stringify({ hueladderFigmaScan: 1, file: figma.root.name, date: new Date().toISOString().slice(0, 10),
    variables: vars, styles, fills: [...fills.values()], texts: { total: textTotal, bound: textBound }, labels });
})();
