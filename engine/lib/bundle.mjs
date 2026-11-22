// Assemble les modules de lib/ en un seul script classique, pour une page HTML qui doit
// s'ouvrir d'un double-clic : les modules ES ne se chargent pas depuis file://.
//
// Chaque module devient une fonction qui rend ses exports ; ses imports relatifs deviennent
// une lecture dans `__lib`. Les noms restent donc isolés par module — `parseHex` existe
// dans deux modules, et les deux coexistent.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ordre de dépendance : un module n'importe que des modules placés avant lui
export const BROWSER_MODULES = ['color', 'deltae', 'apca', 'cam16', 'leonardo', 'methods', 'analysis', 'tune', 'cvd', 'dataviz', 'gradient', 'hicontrast', 'p3', 'dark', 'build', 'crans', 'naming', 'import', 'suggest', 'diagnose', 'outputs', 'zip', 'contract', 'compare', 'pairs', 'figma', 'audit', 'explain', 'package'];

export function wrapModule(src, name) {
  const exported = [];
  const body = src
    .replace(/^[ \t]*import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/([\w-]+)\.mjs['"]\s*;?/gm,
      (_, names, from) => `const {${names.replace(/\s+as\s+/g, ': ')}} = __lib[${JSON.stringify(from)}];`)
    .replace(/^[ \t]*export\s+default\s+[^;\n]*;?[ \t]*$/gm, '')
    .replace(/^([ \t]*)export\s+(async\s+function\*?|function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm,
      (_, indent, kw, id) => { exported.push(id); return `${indent}${kw} ${id}`; });
  if (/^\s*import\s/m.test(body)) throw new Error(`lib/${name}.mjs : import non relatif, impossible à embarquer`);
  return `__lib[${JSON.stringify(name)}] = (function () {\n${body}\nreturn { ${exported.join(', ')} };\n})();`;
}

export function bundleLib(libDir, names = BROWSER_MODULES) {
  return 'const __lib = {};\n' + names.map(n => wrapModule(readFileSync(join(libDir, n + '.mjs'), 'utf8'), n)).join('\n');
}

// ---------------------------------------------------------------- pages historiques

/**
 * Rend un module ES exécutable tel quel dans une balise <script> classique.
 * Les imports sont retirés — y compris multi-lignes, qui laisseraient sinon leurs
 * accolades derrière eux — et le mot-clé `export` est effacé pour que les déclarations
 * atterrissent dans la portée partagée du script.
 */
export function inlineModule(path) {
  return readFileSync(path, 'utf8')
    .replace(/^[ \t]*import\s[\s\S]*?from\s*['"][^'"]*['"]\s*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*import\s+['"][^'"]*['"]\s*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*export\s+default\s+[^;\n]*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*export\s*\{[\s\S]*?\}\s*;?[ \t]*$/gm, '')
    .replace(/^([ \t]*)export\s+(function|const|let|var|class|async)/gm, '$1$2');
}

/**
 * Inline un module dans sa propre portée et n'en expose qu'un symbole.
 * Nécessaire dès qu'un module redéclare un nom déjà présent dans la portée partagée :
 * deltae.mjs a par exemple son propre `hexToLab`, que color.mjs définit déjà.
 */
export function inlineIsolated(path, exportName) {
  return `const ${exportName} = (function () {\n${inlineModule(path)}\nreturn ${exportName};\n})();`;
}
