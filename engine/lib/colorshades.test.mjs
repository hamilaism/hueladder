// colorShades face à color-shades (commit 1c944dc) sur colorjs.io 0.4.1 : sorties relevées sur ses
// propres fonctions (engine/conformance/color-shades ; engine/conformance compare tout le corpus ;
// ce test tient sans dépendance)
import assert from 'node:assert/strict';
import { colorShades, shadeToContrast } from './colorshades.mjs';

const shades = [190.9, 172.7, 154.5, 136.4, 118.2, 100, 81.8, 63.6, 45.5, 27.3, 9.1];
const REF = [
  ['#2f5bd3', ['#ebeffb', '#c5d2f3', '#a3b7ec', '#849ee5', '#6686df', '#4970d9', '#2d59d2', '#2549ad', '#1d3988', '#142961', '#0a142f']],
  ['#d63e38', ['#fbeceb', '#f3c8c6', '#eca5a3', '#e58581', '#de635e', '#d63d37', '#ba2c26', '#992420', '#791d19', '#571512', '#2b0a09']],
  ['#ffd400', ['#fff0a7', '#f8ce00', '#d9b400', '#bd9d00', '#a38700', '#8b7400', '#756100', '#605000', '#4b3f00', '#352c00', '#191500']],
  ['#808080', ['#efefef', '#d2d2d2', '#b7b7b7', '#9f9f9f', '#8a8a8a', '#757575', '#636363', '#515151', '#3f3f3f', '#2d2d2d', '#151515']],
];
for (const [seed, want] of REF) assert.deepEqual(colorShades(seed, shades), want, seed);
assert.equal(shadeToContrast(100), Math.sqrt(21));
assert.deepEqual(colorShades('#2f5bd3', [0, 200]), ['#000000', '#ffffff']);
console.log('colorshades : ok');
