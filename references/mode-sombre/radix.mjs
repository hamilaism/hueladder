import { hexToOklch, contrast, clipChromaOk } from '../../engine/lib/color.mjs';
import { apcaLc } from '../../engine/lib/apca.mjs';
const S = {
 blue: ['#fbfdff #f4faff #e6f4fe #d5efff #c2e5ff #acd8fc #8ec8f6 #5eb1ef #0090ff #0588f0 #0d74ce #113264','#0d1520 #111927 #0d2847 #003362 #004074 #104d87 #205d9e #2870bd #0090ff #3b9eff #70b8ff #c2e6ff'],
 red: ['#fffcfc #fff7f7 #feebec #ffdbdc #ffcdce #fdbdbe #f4a9aa #eb8e90 #e5484d #dc3e42 #ce2c31 #641723','#191111 #201314 #3b1219 #500f1c #611623 #72232d #8c333a #b54548 #e5484d #ec5d5e #ff9592 #ffd1d9'],
};
for (const [n,[l,d]] of Object.entries(S)) {
  const L=l.split(' '), D=d.split(' ');
  console.log(n, 'step | light C (occ) CR vs step1 | dark C (occ) CR vs step1 | Cdark/Clight');
  L.forEach((h,i)=>{ const a=hexToOklch(h), b=hexToOklch(D[i]);
    const occ=o=>o.C/Math.max(1e-6,clipChromaOk(o.L,0.5,o.H));
    console.log(`${String(i+1).padStart(2)} | ${h} C${a.C.toFixed(3)} (${occ(a).toFixed(2)}) ${contrast(h,L[0]).toFixed(2)} | ${D[i]} C${b.C.toFixed(3)} (${occ(b).toFixed(2)}) ${contrast(D[i],D[0]).toFixed(2)} | ${(b.C/a.C).toFixed(2)}`);});
}
