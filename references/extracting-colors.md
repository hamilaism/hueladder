# Sortir les couleurs proprement

## Depuis Figma (MCP figma-console)

### Vérifier d'abord ce qui existe déjà

```
figma_get_status              # quel fichier est connecté, quelle page, quelle sélection
figma_get_variables           # collections et variables déjà publiées
```

Deux choses à en tirer :

- **Une collection cible existe peut-être déjà**, vide, en attente. La réutiliser plutôt
  que d'en créer une seconde.
- **Certaines couleurs sont peut-être déjà des variables.** Une couleur liée à une variable
  est un choix arbitré et assumé ; une couleur en dur est souvent un reste de maquette.
  La distinction mérite d'être notée dans `note`.

### Parcourir la sélection

`figma_get_selection` donne le nœud racine. Ensuite `figma_execute` avec un parcours
récursif. Le piège principal :

> **Lire le texte affiché, pas le nom du calque.**

Les noms de calques sont presque toujours périmés — un cadre nommé `primary/400` peut
contenir la couleur `#d92d20` et afficher le texte « Default ». Ce sont le **texte** et la
**couleur de remplissage** qui font foi, jamais le nom.

```javascript
const root = await figma.getNodeByIdAsync('<id de la sélection>');
const hex = c => '#' + [c.r, c.g, c.b]
  .map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

const out = [];
async function walk(node, path) {
  const e = { path, type: node.type };
  if ('fills' in node && Array.isArray(node.fills)) {
    const f = node.fills.find(x => x.type === 'SOLID' && x.visible !== false);
    if (f) {
      e.fill = hex(f.color);
      const bv = node.boundVariables?.fills?.[0];
      if (bv?.id) {
        const v = await figma.variables.getVariableByIdAsync(bv.id);
        e.variable = v?.name ?? null;      // déjà une variable = choix assumé
      }
    }
  }
  if (node.type === 'TEXT') e.text = node.characters;   // c'est ça qui nomme le rôle
  if (e.fill || e.text) out.push(e);
  if ('children' in node) for (const c of node.children) await walk(c, path + ' / ' + c.name);
}
await walk(root, root.name);
return out;
```

### Reconstituer les rôles

Le texte affiché donne les rôles réels (« Default », « Background », « Light », « Dark »,
« Subtle »…). Les rapprocher de la couleur de remplissage du cadre qui les contient.

Attention aux fautes de frappe dans les noms de composants (`Primray` pour `Primary`) :
les recopier telles quelles dans `source`, mais utiliser l'orthographe correcte dans
`name` et `label`.

## Ce qui n'est pas une couleur de palette

Ne pas transformer en nuancier :

- les couleurs de la **maquette elle-même** — encre des libellés, fond des cartouches,
  bordures des exemples. Elles apparaissent partout dans l'extraction et ne font pas
  partie de la palette ;
- le blanc pur d'un cadre de contenu ;
- une couleur qui n'apparaît qu'une fois, dans une illustration.

En revanche, l'encre d'un texte est souvent **aussi** la couleur `dark` du nuancier neutre.
Dans ce cas elle a sa place — comme ancre du nuancier neutre, pas comme nuancier propre.
Consigner ces arbitrages dans `notes.excluded` : c'est ce que le client relira.

## Depuis une autre source

Le format d'entrée est du JSON — n'importe quelle source convient. Pour du CSS ou du SCSS,
extraire les custom properties. Pour une capture d'écran, échantillonner puis **faire
valider les valeurs** avant de construire : une couleur relevée à l'œil sur un JPEG est
décalée par la compression.

Dans tous les cas, `source` doit permettre à quelqu'un d'autre de retrouver la couleur
d'origine. Une spec sans traçabilité est invérifiable.
