// leonardoColors face à @adobe/leonardo-contrast-colors 1.1.0 : sorties relevées sur la librairie
// (engine/conformance compare tout le corpus ; ce test tient sans dépendance)
import assert from 'node:assert/strict';
import { leonardoColors } from './leonardo.mjs';

const ratios = [1.11, 1.33, 1.65, 2.09, 2.68, 3.48, 4.56, 6.04, 8.06, 10.84, 14.65];
const REF = [
  ['#2f5bd3', 'OKLCH', ['#edf2fd', '#d2dff9', '#b5caf5', '#97b3ef', '#7b9de8', '#5f87e1', '#4670da', '#2e59d1', '#1d45bb', '#0d2ea4', '#030c8b']],
  ['#d63e38', 'OKLCH', ['#fef0ee', '#fcd7d2', '#f7bab3', '#f19d93', '#e98075', '#e06157', '#d63e38', '#bf2424', '#a50008', '#820000', '#590000']],
  ['#ffd400', 'OKLCH', ['#fff3ca', '#ffdc5b', '#efc500', '#d9ae00', '#c39800', '#ad8300', '#986f00', '#845b00', '#714700', '#5c3300', '#461c00']],
  ['#2f5bd3', 'RGB', ['#eef2fc', '#d7dff7', '#bbc9f1', '#9db2ea', '#829ce5', '#6686df', '#4970d9', '#2e5ad0', '#2649a8', '#1d3881', '#132557']],
];
for (const [seed, colorSpace, want] of REF) assert.deepEqual(leonardoColors(seed, ratios, { colorSpace }), want, `${seed} ${colorSpace}`);
assert.throws(() => leonardoColors('#2f5bd3', ratios, { colorSpace: 'CAM02' }));
console.log('leonardo : ok');
