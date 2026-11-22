// Le test perceptif : avant de changer un défaut (la méthode du sombre, l'éclat), le montrer à
// des personnes. Une page autonome présente des paires de variantes sur une même petite
// interface ; la personne choisit au clavier (← ou →) laquelle se lit le mieux, ou lui paraît la
// plus juste. L'ordre et les côtés sont tirés au hasard ; chaque réponse garde son temps. À la
// fin, les réponses s'exportent en JSON — à agréger sur plusieurs personnes et plusieurs marques.

import { buildData } from './build.mjs';
import { applyNaming } from './naming.mjs';

const pick = (data, ramp, mode, i) => {
  const r = data.ramps.find(x => x.name === ramp) || data.ramps[0], core = data.meta.coreMethod;
  return (mode === 'dark' ? r.darkColors[core] : r.colors[core])[Math.max(0, Math.min(i, data.meta.steps.length - 1))];
};
// une interface minimale, ses couleurs prises dans le système : fond, surface, titre, texte,
// texte secondaire, bouton, lien, erreur
function mock(data, mode) {
  const n = data.meta.steps.length, neutral = (data.ramps.find(r => r.kind === 'neutral') || data.ramps[0]).name;
  const brand = (data.ramps.find(r => r.kind === 'brand') || data.ramps[0]).name, err = (data.ramps.find(r => r.kind === 'system') || data.ramps[0]).name;
  const at = f => Math.round(f * (n - 1));
  return mode === 'dark'
    ? { bg: data.meta.dark.background, surface: pick(data, neutral, 'dark', at(0.1)), title: pick(data, neutral, 'dark', at(0.95)), text: pick(data, neutral, 'dark', at(0.85)), muted: pick(data, neutral, 'dark', at(0.6)), button: pick(data, brand, 'dark', at(0.5)), link: pick(data, brand, 'dark', at(0.7)), error: pick(data, err, 'dark', at(0.65)) }
    : { bg: '#ffffff', surface: pick(data, neutral, 'light', at(0.1)), title: pick(data, neutral, 'light', at(0.9)), text: pick(data, neutral, 'light', at(0.8)), muted: pick(data, neutral, 'light', at(0.6)), button: pick(data, brand, 'light', at(0.5)), link: pick(data, brand, 'light', at(0.6)), error: pick(data, err, 'light', at(0.6)) };
}

/** Les essais : chaque paire est une décision de cran qu'on veut confronter à des yeux. */
export function perceptualTrials(spec, { background = '#121212' } = {}) {
  const base = applyNaming({ ...spec, darkMode: { ...(spec.darkMode || {}), background: spec.darkMode?.background || background } });
  const build = patch => buildData(applyNaming({ ...base, ...patch, darkMode: { ...base.darkMode, ...(patch.darkMode || {}) } }));
  const pairs = [
    ['dark-method', 'dark', { darkMode: { method: 'mirror-wcag' } }, { darkMode: { method: 'mirror-bridge' } }, 'mirror-wcag', 'mirror-bridge'],
    ['dark-profile', 'dark', { darkMode: { chromaProfile: null } }, { darkMode: { chromaProfile: 'bell' } }, 'aligned', 'bell'],
    ['light-vivid', 'light', { lightChroma: 'seed' }, { lightChroma: 'vivid' }, 'seed', 'vivid'],
    ['dark-halo', 'dark', {}, { darkMode: { haloCap: 14 } }, 'no-cap', 'halo-14'],
  ];
  return pairs.map(([id, mode, pa, pb, la, lb]) => ({ id, mode, a: { label: la, ui: mock(build(pa), mode) }, b: { label: lb, ui: mock(build(pb), mode) } }));
}

/** La page du test, autonome : aucune ressource externe, les réponses gardées dans la page. */
export function perceptualPage(trials, { lang = 'fr', title = 'Hueladder' } = {}) {
  const en = lang === 'en';
  const T = {
    title: en ? 'Which one reads better?' : 'Laquelle se lit le mieux ?',
    lead: en ? 'Two versions of the same screen. Press ← or → for the one that reads better; if both feel the same, pick the one that looks more right. Trust your first impression.'
      : 'Deux versions du même écran. Appuie sur ← ou → pour celle qui se lit le mieux ; si les deux se valent, celle qui te paraît la plus juste. Fie-toi à ta première impression.',
    start: en ? 'Start' : 'Commencer', done: en ? 'Thank you. Export your answers:' : 'Merci. Exporte tes réponses :', exp: en ? 'Download answers (JSON)' : 'Télécharger les réponses (JSON)',
    name: en ? 'Your initials (optional)' : 'Tes initiales (facultatif)',
  };
  const W = en ? ['Dashboard', 'Your order is on its way: delivery expected Thursday.', 'Updated 3 min ago', 'Track parcel', 'Payment declined', 'Continue']
    : ['Tableau de bord', 'Votre commande est en route : livraison prévue jeudi.', 'Mise à jour il y a 3 min', 'Suivre le colis', 'Paiement refusé', 'Continuer'];
  const card = 'function card(u){return `<div class="ui" style="background:${u.bg}"><div class="sf" style="background:${u.surface}"><h3 style="color:${u.title}">' + W[0] + '</h3><p style="color:${u.text}">' + W[1] + '</p><p style="color:${u.muted}">' + W[2] + '</p><p><a style="color:${u.link}">' + W[3] + '</a> · <span style="color:${u.error}">' + W[4] + '</span></p><button style="background:${u.button};color:${u.bg}">' + W[5] + '</button></div></div>`}';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — test perceptif</title>
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#eeede9;color:#1c1b18}main{max-width:980px;margin:0 auto;padding:24px 16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.ui{border-radius:14px;padding:22px;min-height:260px}.sf{border-radius:10px;padding:18px}.sf h3{margin:0 0 8px}.sf button{border:0;border-radius:8px;padding:10px 16px;font-weight:600}.k{font:600 13px system-ui;opacity:.7;text-align:center}@media (max-width:640px){.pair{grid-template-columns:1fr}}</style></head>
<body><main><h1>${T.title}</h1><p>${T.lead}</p><div id="app"><label>${T.name} <input id="who" size="6"></label> <button id="go">${T.start}</button></div></main>
<script>
const TRIALS=${JSON.stringify(trials)};${card}
const order=TRIALS.map((t,i)=>({i,flip:Math.random()<.5})).sort(()=>Math.random()-.5);let k=0,t0=0;const out=[];
function show(){if(k>=order.length)return end();const o=order[k],t=TRIALS[o.i],L=o.flip?t.b:t.a,R=o.flip?t.a:t.b;
document.getElementById('app').innerHTML='<div class="pair"><div>'+card(L.ui)+'<p class="k">←</p></div><div>'+card(R.ui)+'<p class="k">→</p></div></div><p class="k">'+(k+1)+' / '+order.length+'</p>';t0=performance.now();}
function answer(side){const o=order[k],t=TRIALS[o.i],L=o.flip?t.b:t.a,R=o.flip?t.a:t.b;out.push({trial:t.id,mode:t.mode,chosen:(side==='left'?L:R).label,other:(side==='left'?R:L).label,side,ms:Math.round(performance.now()-t0)});k++;show();}
function end(){const data={who:document.getElementById('who')?.value||window.__who||'',date:new Date().toISOString(),answers:out};try{localStorage.setItem('hueladder-perceptual',JSON.stringify(data))}catch(e){}
document.getElementById('app').innerHTML='<p>${T.done}</p><button id="dl">${T.exp}</button>';document.getElementById('dl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='hueladder-test-perceptif.json';a.click();};}
document.getElementById('go').onclick=()=>{window.__who=document.getElementById('who').value;show();};
addEventListener('keydown',e=>{if(!t0||k>=order.length)return;if(e.key==='ArrowLeft')answer('left');if(e.key==='ArrowRight')answer('right');});
</script></body></html>`;
}

/** Agréger plusieurs fichiers de réponses : pour chaque essai, la part qui choisit chaque variante. */
export function perceptualSummary(files) {
  const by = {};
  for (const f of files) for (const a of f.answers || []) {
    const b = by[a.trial] = by[a.trial] || { n: 0, votes: {} };
    b.n++; b.votes[a.chosen] = (b.votes[a.chosen] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.n, share: Object.fromEntries(Object.entries(v.votes).map(([l, c]) => [l, Math.round((c / v.n) * 100)])) }]));
}
