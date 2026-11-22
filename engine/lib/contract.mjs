// Le contrat du système : ce que la palette produite promet, dans les deux modes.
// Rendu sous forme de liste de verdicts, pour que check.mjs l'imprime et que le studio
// l'affiche — un seul jugement, deux lecteurs.

import { relativeLuminance, contrast, hexToOklch } from './color.mjs';
import { luminanceForContrastVsBlack, solveAtLuminance, luminanceGap } from './tune.mjs';
import { apcaLc } from './apca.mjs';

/**
 * Les contrôles qui portent sur le *résultat*, pas sur le moteur.
 *
 * §2 vérifie que le moteur reste générique ; ici on vérifie que la palette produite tient
 * ses promesses — celles qu'un lead design system écrit dans sa documentation et qu'une
 * équipe applique sans re-tester. Un build vert en §2 avec une spec fausse reste faux : ces
 * contrôles sont donc appliqués à **toutes** les specs présentes dans `brands/`, y compris
 * celle du client une fois le moteur copié chez lui.
 */
export function contractChecks(data, label = '', { lang = 'fr' } = {}) {
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const md = m => L(m, { clair: 'light', sombre: 'dark' }[m] || m);
  const out = [];
  // `area` dit où se répare un contrôle rouge : la méthode, le réglage, ou le mode sombre
  let area = 'method';
  // un contrôle qui porte sur le mode sombre se répare à l'étape du sombre, quelle que soit sa famille
  let darkMode = false;
  const ok = (label, detail = '') => out.push({ pass: true, label, detail, area: darkMode ? 'dark' : area });
  const ko = (label, detail = '') => out.push({ pass: false, label, detail, area: darkMode ? 'dark' : area });
  const fm = m => L({ light: 'clair', dark: 'sombre' }[m] || m, m);
  const core = data.meta.coreMethod;
  const M = data.metrics[core];
  const C = data.contract || { maxHueDrift: 25, maxRelativeSpread: 0.02, thresholds: [3, 4.5, 7] };
  const real = data.ramps.filter(r => !r.derived);
  const tag = s => (label ? `${label} · ${s}` : s);

  // --- interchangeabilité, mode par mode ---
  for (const [mode, I] of Object.entries(M.interchangeability)) {
    if (!I) continue;
    darkMode = mode === 'dark';
    // Le seul chiffre qui engage : zéro paire à rang égal ne doit répondre différemment à
    // « est-ce que ça passe 3 / 4,5 / 7 ». C'est atteignable, contrairement à « écart nul ».
    I.crossingPairs === 0
      ? ok(tag(L(`interchangeabilité ${fm(mode)}`, `interchangeability ${md(mode)}`)), L(`${I.totalPairs} paires à rang égal, aucun franchissement de seuil`, `${I.totalPairs} same-rank pairs, no threshold crossed`))
      : ko(tag(L(`interchangeabilité ${fm(mode)}`, `interchangeability ${md(mode)}`)), L(`${I.crossingPairs} franchissement(s) : `, `${I.crossingPairs} crossing(s): `)
        + I.crossings.slice(0, 3).map(c => `${c.step} @${c.threshold} (${c.fail} ${L('échouent', 'fail')})`).join(', '));

    // L'écart résiduel, lui, ne peut jamais valoir zéro : la grille hex est discrète. On le
    // borne en relatif, contre le contraste du cran — 0,07 point sur 6:1 n'a pas le même sens
    // que 0,07 point sur 1,2:1. Le budget : 3 %, ce qu'une palette verrouillée atteint en sRGB
    // 8 bits — ou, s'il est plus grand, le **plancher sRGB de ce cran** doublé (le pas entre deux
    // luminances atteignables à cette teinte et cette chroma ; deux couleurs qui manquent chacune
    // leur cible d'un pas, en sens opposés). Le plancher n'assouplit que là où la physique
    // l'impose : près du bord du gamut. Un budget déclaré dans la spec remplace les deux.
    const fixed = typeof C.maxRelativeSpread === 'number';
    let worstRatio = 0, worstAt = null, worstRel = 0, worstBudget = 0;
    for (const [s, v] of Object.entries(I.perStep)) {
      if (!v) continue;
      const rel = v.spread / v.min, i = data.meta.steps.indexOf(s);
      const budget = fixed ? C.maxRelativeSpread : Math.max(0.03, 2 * Math.max(0, ...real.map(r => {
        const h = (mode === 'dark' ? r.darkColors : r.colors)?.[core]?.[i];
        return h ? luminanceGap(h) / (relativeLuminance(h) + 0.05) : 0;
      })));
      if (rel / budget > worstRatio) { worstRatio = rel / budget; worstAt = s; worstRel = rel; worstBudget = budget; }
    }
    const what = fixed ? L(`budget ${(C.maxRelativeSpread * 100).toFixed(1)} %`, `budget ${(C.maxRelativeSpread * 100).toFixed(1)}%`)
      : worstBudget > 0.0300001 ? L(`plancher sRGB ×2 au cran ${worstAt} : ${(worstBudget * 100).toFixed(2)} %, au-delà des 3 %`, `sRGB floor ×2 at step ${worstAt}: ${(worstBudget * 100).toFixed(2)}%, above 3%`)
        : L('budget 3 %, au-dessus du plancher sRGB', 'budget 3%, above the sRGB floor');
    worstRatio <= 1
      ? ok(tag(L(`dispersion ${fm(mode)}`, `spread ${md(mode)}`)), I.worstStep == null ? L('une seule famille : rien à comparer', 'a single family: nothing to compare') : L(`écart max ${I.maxSpread} au cran ${I.worstStep} — au plus ${(worstRel * 100).toFixed(2)} % relatif (${what})`, `max gap ${I.maxSpread} at step ${I.worstStep} — at most ${(worstRel * 100).toFixed(2)}% relative (${what})`))
      : ko(tag(L(`dispersion ${fm(mode)}`, `spread ${md(mode)}`)), L(`${(worstRel * 100).toFixed(2)} % relatif au cran ${worstAt}, ${what}`, `${(worstRel * 100).toFixed(2)}% relative at step ${worstAt}, ${what}`));
  }

  // --- le cran où chaque seuil tombe doit être le même pour toutes les familles ---
  // C'est la phrase que le design system écrit noir sur blanc : « du 500 sur blanc passe AA,
  // quelle que soit la teinte ». Elle se vérifie, elle ne se décrète pas.
  const thresholdLines = {};
  for (const [mode, bg] of [['clair', data.meta.lightBackground], ['sombre', data.meta.dark?.background]]) {
    if (!bg) continue;
    darkMode = mode === 'sombre';
    const key = mode === 'sombre' ? 'darkColors' : 'colors';
    // le neutre compte : remplacer une teinte par le neutre est la substitution la plus courante
    const chrom = real;
    if (!chrom.length) continue;
    const lines = [];
    let disagree = 0;
    for (const t of C.thresholds) {
      const firsts = chrom.map(r => {
        const i = (r[key][core] || []).findIndex((hex, k) => hex && data.meta.isCore[k] && contrast(hex, bg) >= t);
        return i < 0 ? null : data.meta.steps[i];
      });
      const uniq = [...new Set(firsts)];
      if (uniq.length !== 1) disagree++;
      lines.push(`${t} → ${uniq.join('/')}`);
    }
    disagree === 0
      ? ok(tag(L(`seuils ${mode}`, `thresholds ${md(mode)}`)), lines.join(' · ') + L(' — même cran pour toutes les familles', ' — same step for every family'))
      : ko(tag(L(`seuils ${mode}`, `thresholds ${md(mode)}`)), lines.join(' · ') + L(` — ${disagree} seuil(s) dépendent de la teinte`, ` — ${disagree} threshold(s) depend on the hue`));
    thresholdLines[mode] = lines;
  }
  // l'autre moitié de la promesse : chaque seuil tombe au même cran dans les deux modes
  if (thresholdLines.sombre) {
    area = 'dark';
    const same = thresholdLines.clair.join() === thresholdLines.sombre.join();
    same ? ok(tag(L('seuils identiques entre modes', 'same thresholds in both modes')), thresholdLines.clair.join(' · '))
      : ko(tag(L('seuils identiques entre modes', 'same thresholds in both modes')), L('clair ', 'light ') + thresholdLines.clair.join(' · ') + L(' ; sombre ', '; dark ') + thresholdLines.sombre.join(' · '));
    area = 'method';
  }

  // --- la règle écrite dans le nom, paire par paire, dans chaque nuancier ---
  // C'est la promesse du système : « deux crans séparés de N rangs tiennent AA ». Elle se
  // vérifie sur les couleurs livrées, pas sur le barreau théorique.
  const R = data.rules;
  const coreIdx = data.meta.steps.map((_, i) => i).filter(i => data.meta.isCore[i]);
  for (const [mode, key] of [['clair', 'colors'], ['sombre', 'darkColors']]) {
    if (key === 'darkColors' && !data.meta.dark) continue;
    darkMode = mode === 'sombre';
    const broken = [];
    for (const r of real) {
      const S = r[key][core] || [];
      // l'écart se lit sur les rangs de la nomenclature (virtuels pour une nomenclature par contraste)
      const rk = data.meta.rankOf || coreIdx.map((_, a) => a);
      coreIdx.forEach((i, a) => coreIdx.forEach((j, b) => {
        if (b <= a || !S[i] || !S[j]) return;
        const gap = Math.abs((data.meta.rankOf ? rk[j] - rk[i] : b - a)), c = contrast(S[i], S[j]);
        for (const [rank, th] of [[R.rankForAA, 4.5], [R.rankForUI, 3], [R.rankForAAA, 7]]) {
          if (rank && gap >= rank && c < th) broken.push(`${r.name} ${data.meta.steps[i]}/${data.meta.steps[j]} ${c.toFixed(2)} < ${th}`);
        }
      }));
    }
    broken.length === 0
      ? ok(tag(L(`règle du nom ${mode}`, `naming rule ${md(mode)}`)), L(`${R.rankForUI} rangs ⇒ 3:1, ${R.rankForAA} ⇒ 4,5:1, ${R.rankForAAA} ⇒ 7:1, dans chaque nuancier`, `${R.rankForUI} ranks ⇒ 3:1, ${R.rankForAA} ⇒ 4.5:1, ${R.rankForAAA} ⇒ 7:1, in every ramp`))
      : ko(tag(L(`règle du nom ${mode}`, `naming rule ${md(mode)}`)), L(`${broken.length} paire(s) sous leur seuil : `, `${broken.length} pair(s) below their threshold: `) + broken.slice(0, 3).join(', '));
  }

  area = 'tuning';
  // --- monotonie ---
  // Rien dans le moteur ne la garantit : une valeur épinglée ou une cible hors budget peut
  // très bien produire deux crans consécutifs dans le désordre, et c'est invisible sur un
  // nuancier tant qu'on ne compare pas les luminances.
  for (const [mode, key, dir] of [['clair', 'colors', -1], ['sombre', 'darkColors', 1]]) {
    if (key === 'darkColors' && !data.meta.dark) continue;
    darkMode = mode === 'sombre';
    const broken = [];
    for (const r of real) {
      // on garde l'indice de chaque cran présent : une rampe creuse ne doit pas décaler les libellés
      const ys = (r[key][core] || []).map((h, i) => (h ? { y: relativeLuminance(h), i } : null)).filter(Boolean);
      for (let k = 1; k < ys.length; k++) {
        if ((ys[k].y - ys[k - 1].y) * dir <= 0) broken.push(`${r.name} ${data.meta.steps[ys[k - 1].i]}→${data.meta.steps[ys[k].i]}`);
      }
    }
    broken.length === 0
      ? ok(tag(L(`monotonie ${mode}`, `monotonicity ${md(mode)}`)), L(`Y ${dir < 0 ? 'décroît' : 'croît'} strictement sur les ${real.length} nuanciers`, `Y strictly ${dir < 0 ? 'decreases' : 'increases'} on all ${real.length} ramps`))
      : ko(tag(L(`monotonie ${mode}`, `monotonicity ${md(mode)}`)), L(`${broken.length} inversion(s) : `, `${broken.length} inversion(s): `) + broken.slice(0, 3).join(', '));
  }

  // --- dérive de teinte intra-rampe ---
  for (const [mode, D] of Object.entries(M.hueDrift)) {
    if (!D) continue;
    darkMode = mode === 'dark';
    D.maxDrift <= C.maxHueDrift
      ? ok(tag(L(`dérive de teinte ${fm(mode)}`, `hue drift ${md(mode)}`)), `${D.maxDrift}° max (budget ${C.maxHueDrift}°)`
        + (D.worst ? ` — ${D.worst.ramp}/${D.worst.step}` : ''))
      : ko(tag(L(`dérive de teinte ${fm(mode)}`, `hue drift ${md(mode)}`)), L(`${D.maxDrift}° au ${D.worst?.ramp}/${D.worst?.step}, budget ${C.maxHueDrift}°`, `${D.maxDrift}° at ${D.worst?.ramp}/${D.worst?.step}, budget ${C.maxHueDrift}°`));
  }

  darkMode = false;
  area = 'dark';
  // --- non-régression de chroma et plafond de gamut, en sombre ---
  if (data.meta.dark) {
    const regressions = [], overCeiling = [];
    for (const r of real) {
      for (const d of (r.darkDetail?.[core] || [])) {
        if (!d) continue;
        if (d.pinned || d.outOfBudget) continue;
        // Une chroma en retrait n'est acceptable que si le gamut l'a imposée — sinon c'est
        // du contraste gagné en éteignant la marque, et c'est le contraire de l'objectif.
        // Le critère est absolu : sur un quasi-gris, perdre 4 % d'une chroma de 0,005 est un
        // arrondi hex, pas une régression, et le rapport le ferait passer pour une faute.
        // une désaturation déclarée fixe la chroma attendue : c'est l'écart à celle-ci qui compte
        // même définition de la surface que le moteur (lib/dark.mjs) : le contraste du cran clair face au blanc
        const lightHex = (r.colors[core] || [])[data.meta.steps.indexOf(d.step)];
        const scoped = data.meta.dark.desaturateScope !== 'all' ? (lightHex && contrast(lightHex, '#ffffff') < 3) : true;
        const expected = d.lightChroma * (1 - (scoped ? data.meta.dark.desaturate || 0 : 0));
        const got = d.lightChroma + d.chromaDelta;
        // Deux sens : moins que prévu sans raison de gamut, c'est éteindre la marque ; plus que
        // prévu hors profil vif, c'est une désaturation déclarée qui n'a pas eu lieu.
        const vivid = data.meta.dark.profile === 'bell' || data.meta.dark.profile === 'custom' || data.meta.dark.profile === 'constant';
        if ((got < expected - 0.005 && !d.clamped) || (!vivid && got > expected + 0.005)) {
          regressions.push(`${r.name}/${d.step} ${got.toFixed(3)} (${L('attendu', 'expected')} ${expected.toFixed(3)})`);
        }
        const gotC = hexToOklch(d.hex).C;
        if (gotC > d.maxChroma + 0.005) overCeiling.push(`${r.name}/${d.step} ${gotC.toFixed(3)} > ${d.maxChroma}`);
      }
    }
    regressions.length === 0
      ? ok(tag(L('non-régression de chroma', 'no chroma regression')), data.meta.dark.desaturate > 0
        ? L(`chaque cran sombre garde la chroma du clair moins ${Math.round(data.meta.dark.desaturate * 100)} %, sauf contrainte de gamut`, `every dark step keeps the light chroma minus ${Math.round(data.meta.dark.desaturate * 100)}%, except where the gamut forbids it`)
        : L('aucun cran sombre moins chromatique que son cran clair sans raison de gamut', 'no dark step is less chromatic than its light step without a gamut reason'))
      : ko(tag(L('non-régression de chroma', 'no chroma regression')), `${regressions.length} : ` + regressions.slice(0, 3).join(', '));
    overCeiling.length === 0
      ? ok(tag(L('plafond de gamut', 'gamut ceiling')), L(`aucune couleur au-delà de ${(data.meta.dark.gamutCeiling * 100).toFixed(0)} % du maximum tenable`, `no colour beyond ${(data.meta.dark.gamutCeiling * 100).toFixed(0)}% of the reachable maximum`))
      : ko(tag(L('plafond de gamut', 'gamut ceiling')), `${overCeiling.length} : ` + overCeiling.slice(0, 3).join(', '));

    // Un cran hors budget n'est pas une erreur mais il doit être connu : sur ce fond, aucune
    // couleur sRGB ne peut tenir ce contraste, et le cran sort en blanc pur.
    const oob = data.meta.dark.outOfBudget;
    oob.length === 0
      ? ok(tag(L('budget de contraste', 'contrast budget')), L(`${data.meta.dark.contrastBudget}:1 sur ${data.meta.dark.background} — tous les crans réguliers tiennent`, `${data.meta.dark.contrastBudget}:1 on ${data.meta.dark.background} — every regular step fits`))
      : ko(tag(L('budget de contraste', 'contrast budget')), L(`crans hors d'atteinte sur ce fond : ${oob.join(', ')}`, `steps out of reach on this background: ${oob.join(', ')}`));
  }

  darkMode = false;
  area = 'method';
  // --- précision de la méthode core ---
  // La cible est un Y, et la grille hex ne permet pas de l'atteindre exactement : « erreur
  // nulle » n'est pas un critère. Le critère qui engage est la **conséquence** de l'erreur —
  // de combien le contraste réel s'écarte du contraste promis. En deçà de quelques centièmes
  // de point, aucune décision de design ne change, et l'erreur est du bruit d'arrondi.
  //
  // Le rapport au meilleur hex atteignable (ce que rendrait `solveAtLuminance`, qui encadre
  // la marche d'escalier au lieu de s'arrêter dessus) est reporté à côté : il ne déclenche
  // rien mais il dit d'où vient l'erreur — de la grille, ou de la méthode.
  // Seules les méthodes qui visent le barreau de contraste (Fusilier, et les réglages faits
  // dessus) ont une cible à atteindre ; pour les autres, l'écart est leur nature, pas une faute.
  if (!['fusilier', 'tuned'].includes(core)) {
    ok(tag(L('précision de la méthode core', 'core method precision')), L(`sans objet : « ${core} » ne vise pas le barreau de contraste`, `not applicable: « ${core} » does not target the contrast ladder`));
  } else {
    let worstRel = 0, worstLabel = '', worstAbs = 0, floorRel = 0, floorLabel = '';
    for (const r of real) {
      (r.colors[core] || []).forEach((hex, i) => {
        if (!hex || !data.meta.isCore[i]) return;
        const targetY = luminanceForContrastVsBlack(Math.pow(21, data.ladders.shade[i] / 200));
        const wantC = 1.05 / (targetY + 0.05);
        const rel = Math.abs(1.05 / (relativeLuminance(hex) + 0.05) - wantC) / wantC;
        if (rel > worstRel) {
          worstRel = rel;
          worstAbs = Math.abs(1.05 / (relativeLuminance(hex) + 0.05) - wantC);
          worstLabel = `${r.name}/${data.meta.steps[i]}`;
        }
        // Le plancher physique, mesuré sur cette palette et pas supposé : le meilleur hex que
        // sRGB offre à cette teinte et à cette chroma. Une couleur très saturée près du bord
        // du gamut a des voisins hex très espacés en luminance — sur la fixture, ce plancher
        // vaut déjà 0,5 % de contraste. Un seuil fixe plus bas serait rouge à vie.
        const { C: c, H } = hexToOklch(hex);
        const relBest = Math.abs(1.05 / (solveAtLuminance(targetY, c, H).y + 0.05) - wantC) / wantC;
        if (relBest > floorRel) { floorRel = relBest; floorLabel = `${r.name}/${data.meta.steps[i]}`; }
      });
    }
    const ratio = floorRel > 0 ? worstRel / floorRel : 1;
    const detail = L(`écart de contraste max ${worstAbs.toFixed(4)} point (${(worstRel * 100).toFixed(3)} %) au ${worstLabel}`, `max contrast error ${worstAbs.toFixed(4)} point (${(worstRel * 100).toFixed(3)}%) at ${worstLabel}`)
      + L(` — plancher sRGB ${(floorRel * 100).toFixed(3)} % (${floorLabel}), soit ×${ratio.toFixed(2)}`, ` — sRGB floor ${(floorRel * 100).toFixed(3)}% (${floorLabel}), i.e. ×${ratio.toFixed(2)}`);
    ratio <= 2.5
      ? ok(tag(L('précision de la méthode core', 'core method precision')), detail)
      : ko(tag(L('précision de la méthode core', 'core method precision')), detail + L(' : la méthode vise mal, ce n\'est pas la faute de la grille', ': the method aims badly, the hex grid is not to blame'));
  }

  // la norme APCA pour tout le système (`contract.norm: "apca"`) : la règle du nom relue en Lc,
  // dans les deux polarités et les deux modes. APCA juge un texte clair sur fond sombre moins
  // lisible à ratio WCAG égal : la règle peut demander plus de rangs en sombre. Les niveaux sont
  // ceux des tables APCA : 90 (corps de texte), 75 (texte courant), 60 (texte fluide), 45 (titres).
  if ((data.contract || {}).norm === 'apca') {
    area = 'method';
    for (const mode of ['light', ...(data.meta.dark ? ['dark'] : [])]) {
      darkMode = mode === 'dark';
      const flat = real.flatMap(r => ((mode === 'dark' ? r.darkColors : r.colors)?.[core] || []).map((h, i) => ({ h, r: data.meta.rankOf[i] })).filter(x => x.h && x.r !== null));
      const need = lc => {
        let worst = 0;
        for (let a = 0; a < flat.length; a++) for (let b = a + 1; b < flat.length; b++) {
          const d = Math.abs(flat[a].r - flat[b].r);
          if (d && Math.min(Math.abs(apcaLc(flat[a].h, flat[b].h)), Math.abs(apcaLc(flat[b].h, flat[a].h))) < lc) worst = Math.max(worst, d);
        }
        return worst + 1;
      };
      const [l45, l60, l75, l90] = [45, 60, 75, 90].map(need);
      ok(tag(L(`règle du nom APCA ${fm(mode)}`, `APCA naming rule ${md(mode)}`)), L(`${l45} rangs ⇒ Lc 45, ${l60} ⇒ Lc 60, ${l75} ⇒ Lc 75, ${l90} ⇒ Lc 90, dans les deux polarités`, `${l45} ranks ⇒ Lc 45, ${l60} ⇒ Lc 60, ${l75} ⇒ Lc 75, ${l90} ⇒ Lc 90, both polarities`));
    }
    darkMode = false;
  }

  // les surfaces déclarées : un texte posé sur un fond teinté n'a pas le contraste qu'il a sur
  // blanc. Le contrôle dit, pour chaque surface, le cran où l'AA commence, famille par famille ;
  // il passe si ce cran est le même pour toutes (la règle reste écrivable sur cette surface).
  area = 'method'; darkMode = false;
  for (const [name, bg] of Object.entries(data.meta.surfaces || {})) {
    const first = real.map(r => {
      const i = r.colors[core].findIndex((h, k) => h && data.meta.isCore[k] && contrast(h, bg) >= 4.5 && relativeLuminance(h) < relativeLuminance(bg));
      return [r.name, i < 0 ? null : data.meta.steps[i]];
    });
    const steps = [...new Set(first.map(f => f[1]))];
    const onWhite = (() => { const r = real[0], i = r ? r.colors[core].findIndex((h, k) => h && data.meta.isCore[k] && contrast(h, '#ffffff') >= 4.5) : -1; return i < 0 ? null : data.meta.steps[i]; })();
    const shift = steps.length === 1 && steps[0] && onWhite && steps[0] !== onWhite ? L(` (au ${onWhite} sur blanc : une règle écrite sur blanc ne vaut pas ici)`, ` (${onWhite} on white: a rule written on white does not hold here)`) : '';
    const on = first.map(([n, s]) => `${n} ${s ?? '—'}`).join(', ');
    steps.length === 1
      ? ok(tag(L(`surface ${name}`, `surface ${name}`)), L(`sur ${bg}, le texte AA commence au ${steps[0] ?? '—'} pour toutes les familles`, `on ${bg}, AA text starts at ${steps[0] ?? '—'} for every family`) + shift)
      : ko(tag(L(`surface ${name}`, `surface ${name}`)), L(`sur ${bg}, le texte AA ne commence pas au même cran : ${on}`, `on ${bg}, AA text does not start at the same step: ${on}`));
  }
  return out;
}
