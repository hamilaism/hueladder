# Nomenclatures de crans : état de l'art et recommandation pour Hueladder

Recherche du 24/09/2026. Convention : **[S]** = sourcé (lien, citation ou code lu) ; **[I]** = inférence ou calcul de ma part (méthode indiquée).
Les calculs WCAG 2 ont été faits en Python sur les valeurs hexadécimales extraites des dépôts (luminance relative sRGB, L* CIE).

---

## 1. David Fusilier — `color-shades`

- **Compte GitHub** : https://github.com/dfusilier (David Fusilier, Brooklyn, « Product Designer working on design systems @ Spotify ») [S, API GitHub]
- **Dépôt** : https://github.com/dfusilier/color-shades — description : « Determine color contrast at a glance from the names of colors. » [S]
- **Application en ligne** : https://dfusilier.github.io/color-shades (champ `homepage` du `package.json`) [S]
- **Licence** : MIT, « Copyright (c) 2022 David Fusilier » (fichier `LICENSE`) [S]
- **État** : dernier commit le 25/12/2022 (« update link to personal site ») ; application React, calculs avec `colorjs.io` [S]

### Ce que dit le README (texte intégral de la partie utile) [S]

> Use shades to determine accessible color contrast at a glance.
> - Use to generate a numerical shade from 0 to 200 based on a color's luminance.
> - Use shades when naming colors (for example, "green105").
> - Two colors with a difference of 100 or more have ≥ 4.5 contrast.
> - Two colors with a difference of 75 or more have ≥ 3.0 contrast.

### La formule (code : `src/utils/shadeFromContrast.js`, `src/utils/shadeToContrast.js`) [S]

```js
// Use a color's contrast with black to generate a numerical shade
// on a scale from 0 (black) to 200 (white).
const shadeFromContrast = contrast => Math.log(contrast) / Math.log(21) * 200;
const shadeToContrast  = shade    => Math.exp((shade / 200) * Math.log(21));
```

Soit **shade = 200 · ln(C_noir) / ln(21)** et **C_noir = 21^(shade/200)**, où C_noir est le ratio WCAG 2.1 de la couleur face au noir.
Dans `App.jsx`, le shade affiché est `Math.round(shadeFromContrast(color.contrastWCAG21(black)))` : **un entier** [S].

### Nomenclature exacte

- **Plage** : 0 (noir) → 200 (blanc). **Sens** : le nombre croît avec la clarté (inverse de Tailwind) [S].
- **Pas** : aucun pas imposé. Tout entier de 0 à 200 est un nom valide (l'exemple du README est `green105`) [S]. La palette proposée par défaut dans l'onglet « More shades » est **10, 25, 50, 75, 100, 125, 150, 175** plus le shade de la couleur saisie (`MoreShadesSection.jsx`), soit en pratique un **pas de 25** [S]. L'utilisateur ajoute ou retire des shades à volonté (« Add shade », « Remove shade » dans `EditShadesDialog.jsx`), et la liste est gardée dans l'URL (`?shades=10-25-50…`) [S].
- **Génération** : pour chaque shade visé, recherche binaire sur la **luminosité HSL** (teinte et saturation interpolées entre des bornes réglables) jusqu'à atteindre `21^(shade/200)` face au noir, avec une tolérance de +0,005 (`suggestColor.js`, `createInterpolants.js`) [S].
- Mode « increments » (sans cibles) : n crans répartis en progression géométrique du contraste, `ratio = 21^(1/n)` (`suggestShades.js`) [S].

### Pourquoi la règle est exacte (et non approchée) [I, démonstration]

Le ratio WCAG entre deux couleurs a et b (Ya > Yb) vaut (Ya+0,05)/(Yb+0,05). Leur contraste face au noir vaut (Y+0,05)/0,05. Donc **C(a,b) = C_noir(a) / C_noir(b)** exactement, et **C(a,b) = 21^((shade_a − shade_b)/200)**. Un écart de nom se convertit donc sans perte en ratio, sur toute la plage et pour toutes les teintes. C'est la seule reparamétrisation de la luminance où « écart de nom ⇒ ratio » est une identité et non une borne.

Seuils exacts (calcul) : 3:1 ⇒ Δ ≥ 72,2 · 4,5:1 ⇒ Δ ≥ 98,8 · 7:1 ⇒ Δ ≥ 127,8.
Les règles du README ont donc de la marge : Δ100 donne 4,58:1, Δ75 donne 3,13:1. Même avec l'arrondi à l'entier (erreur ≤ 1 sur l'écart), Δ99 donne encore 4,51:1 et Δ74 donne 3,08:1 [I, calcul]. Règle AAA qu'on peut en tirer : **Δ ≥ 128 ⇒ 7:1** [I].

---

## 2. Nomenclatures des design systems majeurs

Légende de la colonne « encode » : **rang** = position dans la liste ; **L\*** = luminosité perceptuelle CIE ; **bande de luminance** = plage de Y imposée ; **contraste** = ratio ou Lc ; **rôle** = usage.

| Système | Noms exacts des crans | Nb | Pas | Le nom encode | Insérer sans renommer ? |
|---|---|---|---|---|---|
| **Tailwind v4** | 50, 100, 200 … 900, 950 | 11 | 100 (50 aux bouts) | rang (valeurs OKLCH dessinées) | oui par convention (950 ajouté en v3.3) ; rien ne garantit la valeur d'un 250 |
| **Material 3 (HCT)** | tone 0–100 continu ; palette usuelle 0, 10 … 90, 95, 99, 100 + tons de surface (4, 6, 12, 17, 22, 24, 87, 92, 94, 96, 98) | libre | libre | **L\*** (tone = L\* CIELAB) | **oui** : tout tone est un nom valide |
| **Atlassian (@atlaskit/tokens 20)** | couleurs : 100, 200, 250, 300 … 800, 850, 900, 1000 ; Neutral 0, 100 … 1100, 1200 ; alpha 100A–500A ; DarkNeutral ajoute 250, 350 | 12 (teintes), 13 (neutres) | 100, avec 250/850 | rang | oui : 250/850 insérés en v7.1.0, Neutral1200 en v13.1.1 |
| **Adobe Spectrum 2** | teintes 100 … 1600 (pas 100) ; gray et transparents 25, 50, 75, 100 … 1000 | 16 / 13 | 100 (25 près du blanc) | rang ; couleurs calées sur des ratios cibles (Leonardo) | oui côté clair (25/50/75) ; le reste renommerait |
| **IBM Carbon** | 10, 20 … 100 (+ `…Hover`, black, white) | 10 (+2) | 10 | rang ; **même L\* à même grade pour toutes les teintes** | non (pas de 15/25 prévus) |
| **Radix Colors** | 1 … 12 (+ variantes alpha A1–A12, P3) | 12 | 1 | **rôle** (chaque cran a un usage) + contraste APCA garanti sur 11 et 12 | non |
| **GitHub Primer** | teintes 0 … 9 ; neutral 0 … 13 | 10 / 14 | 1 | rang | non (entiers) |
| **Microsoft Fluent 2** | marque 10 … 160 (pas 10, 10 = foncé) ; grey 2 … 98 pas 2, + 99 ; statut : shade50…shade10, primary, tint10…tint60 | 16 / 50 / 12 | 10 / 2 | marque : rang ; **grey : % de la valeur sRGB** (grey50 = #808080) ; statut : distance au primaire | grey : oui (numérotation en valeur) ; marque : non |
| **Open Color** | 0 … 9 (tableau JSON) | 10 | 1 | rang | non |
| **Ant Design** | 1 … 10 (`blue-1`…`blue-10`), 6 = couleur primaire | 10 | 1 | rang + rôle (6 = primaire) ; générés en HSV depuis le primaire | non |
| **Salesforce SLDS** | 10, 15, 20, 30, 40, 50, 60, 65, 70, 80, 90, 95 (+100 pour neutral) | 12–13 | 10 (avec 15/65/95) | **L\*** (≈ ±1) | oui : 15, 65, 95 insérés |
| **USWDS** | grades 5, 10, 20 … 90, variantes « v » (vivid, ex. `indigo-warm-60v`) ; 0 = blanc, 100 = noir | 10 | 10 | **bande de luminance relative** | seulement si une bande libre existe |
| **Reasonable Colors** | 1 … 6 | 6 | 1 | bande de luminance (LCH) | non |
| **Fusilier color-shades** | 0 … 200 libre (défaut 10, 25, 50 … 175) | libre | libre (25 par défaut) | **contraste face au noir (log)** | **oui**, par construction |
| **Adobe Leonardo** | ratios en tableau → `blue100`, `blue200`… ; ratios négatifs → `25/50/75` ; ou noms libres via objet | libre | 100 | rang (tableau) ou nom libre (objet) ; le ratio est une donnée, pas le nom | selon le nommage choisi |
| **Evil Martians Harmonizer** | niveaux définis par l'utilisateur (ex. 100–900) | libre | libre | rang ; contraste (APCA par défaut, ou WCAG) réglé **par niveau** | oui (niveaux paramétrables) |

### Détails et sources, système par système

**Tailwind** — `packages/tailwindcss/theme.css` : `--color-blue-50` … `--color-blue-950`, valeurs en `oklch(...)` [S] https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/theme.css. « in Tailwind CSS v3.3 we've added a new `950` shade for every single color » [S] https://tailwindcss.com/blog/tailwindcss-v3-3. Aucune règle de contraste documentée [S par absence ; I]. Les valeurs sont dessinées : un même cran n'a pas le même contraste d'une teinte à l'autre [I, bien connu, non recalculé ici].

**Material 3 / HCT** — `material-color-utilities`, `typescript/hct/hct.ts` : « Unlike contrast ratio, measuring contrast in L* is linear, and simple to calculate. A difference of 40 in HCT tone guarantees a contrast ratio >= 3.0, and a difference of 50 guarantees a contrast ratio >= 4.5. » [S] https://github.com/material-foundation/material-color-utilities/blob/main/typescript/hct/hct.ts. `contrast/contrast.ts` : « Tone is equivalent to L* in the L*a*b* color space » [S]. Tons utilisés par les schémas (`color_spec_2021.ts`) : 0, 4, 6, 10, 12, 17, 20, 22, 24, 25, 30, 40, 49, 50, 60, 80, 85, 87, 90, 92, 94, 95, 96, 98, 100…, avec des `ContrastCurve(3, 4.5, 7, 11)` qui ajustent les tons au runtime selon le niveau de contraste [S]. Doc : https://m3.material.io/styles/color/system/how-the-system-works.
**Nuance vérifiée** [I, calcul] : la règle « Δ50 ⇒ 4,5 » est **fausse d'un cheveu en haut de l'échelle** : tone 50 contre tone 100 donne 4,48:1 ; elle échoue dès que le ton clair dépasse ~99,7. Seuils exacts sur toute la plage : 3:1 ⇒ ΔL\* ≥ 38,4 ; 4,5:1 ⇒ ΔL\* ≥ 50,2 ; 7:1 ⇒ ΔL\* ≥ 62,2. En pratique, « Δ51 ⇒ AA » est une règle sûre.

**Atlassian** — paquet npm `@atlaskit/tokens` v20.0.0, `dist/es2019/artifacts/palettes-raw/palette.js` : Blue100, 200, 250, 300 … 800, 850, 900, 1000 ; Neutral0, 100 … 1100, 1200 ; Neutral100A–500A ; DarkNeutral0 … 1200 avec 250 et 350 (et leurs versions A) [S]. `palette-brand-refresh.js` (même paquet) n'a ni 250/850 ni 1200 : Neutral 0–1100 [S]. CHANGELOG v7.1.0 : « Introduced new color stops across our base color ramps, namely 250 and 850, to support better hover/pressed state contrast » [S] ; v13.1.1 : « Add `Neutral1200` and `DarkNeutral1200` base palette tokens » [S]. https://atlaskit.atlassian.com/packages/design-system/tokens/changelog · https://atlassian.design/foundations/color-new/color-palette-new (page rendue en JS, non lisible par l'outil).
Réponses à vos questions : **oui** 100–1000 ; **oui** 250 et 850 ajoutés ; neutres **0–1100, et désormais 0–1200** ; **pas de 25** [S]. Pas de règle chiffrée « écart de N ⇒ AA » trouvée dans la doc [S par absence, recherche limitée].

**Adobe Spectrum 2** — `adobe/spectrum-design-data`, `packages/tokens/src/color-palette.json` : `blue-100` … `blue-1600` (16 crans, pas 100) ; `gray-25, 50, 75, 100 … 1000` (13) ; idem `transparent-black-*` et `transparent-white-*` [S] https://github.com/adobe/spectrum-design-data/blob/main/packages/tokens/src/color-palette.json. Donc **25/50/75 n'existent que pour gray et les transparents**, pas pour les teintes, et les teintes vont **jusqu'à 1600**, pas 1000. Leonardo (Adobe) explique ce motif de nommage : « Colors with a positive contrast ratio with the base … will be named in increments of 100 … Colors with a negative contrast ratio … will be named in increments less than 100 … such as `gray25`, `gray50`, and `gray75` » [S] https://github.com/adobe/leonardo/blob/main/packages/contrast-colors/README.md. Que Spectrum 2 soit généré par Leonardo est une inférence (la doc https://spectrum.adobe.com/page/color-system/ n'a pas pu être lue) [I].

**IBM Carbon** — `packages/colors/src/dtcg/colors.json` : grades 10 … 100, plus `10Hover` … `100Hover`, `black`, `white` [S] https://github.com/carbon-design-system/carbon/tree/main/packages/colors. Doc (`carbon-website`, `elements/color/overview.mdx`) : « The IBM palette is comprised of twelve color grades—Black, White and ten values for each hue. The following table indicates the minimum number of steps required to achieve commonly used contrast ratios » ; le tableau n'est **pas uniforme** (ex. 90 → 50 : 4 crans pour 4,5:1 ; 10 → 60 : 5 crans ; Black → 50 : 6 crans) [S] https://carbondesignsystem.com/elements/color/overview/. Calcul : L\* identique à ±0,6 entre gray, blue et yellow à grade égal (10 ≈ 96, 50 ≈ 58,5, 100 ≈ 7,1), mais le grade n'est **pas** égal à L\* (grade 50 ↔ L\* 58,5) [I, calcul].

**Radix Colors** — `radix-ui/colors`, `src/light.ts` : `gray1` … `gray12`, `grayA1` … `grayA12`, variantes P3 [S] https://github.com/radix-ui/colors. Rôles [S] https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale : 1 fond d'app · 2 fond discret · 3 fond d'élément · 4 fond survolé · 5 fond actif/sélectionné · 6 bordures et séparateurs discrets · 7 bordure d'élément et focus · 8 bordure survolée · 9 fonds pleins · 10 fonds pleins survolés · 11 texte peu contrasté · 12 texte très contrasté. Garanties : 11 = « Lc 60 APCA contrast on step 2 », 12 = « Lc 90 » [S].

**GitHub Primer** — `primer/primitives`, `src/tokens/base/color/light/light.json5` : `neutral.0` … `neutral.13` ; `blue.0` … `blue.9` (idem green, yellow, orange, red, purple, pink, coral) [S] https://github.com/primer/primitives/blob/main/src/tokens/base/color/light/light.json5. Donc 0–9 pour les teintes, **0–13 pour les neutres**.

**Microsoft Fluent 2** — `microsoft/fluentui`, `packages/tokens/src/types.ts` : `type Brands = 10 | 20 | … | 160` ; `ColorVariants = { shade50 … shade10, primary, tint10 … tint60 }` ; `AlphaColors = 5 | 10 | 20 … 90` [S] ; `global/brandColors.ts` : `brandWeb[10] = #061724` (foncé) … `[160] = #ebf3fc` (clair) [S] ; `global/colors.ts` : `grey['2'] = #050505` … `grey['50'] = #808080` … `grey['98'] = #fafafa`, `grey['99']` [S] https://github.com/microsoft/fluentui/tree/master/packages/tokens/src. Le numéro de grey est le pourcentage de la valeur sRGB encodée (50 → 128/255) [I, lecture des valeurs].

**Open Color** — `open-color.json` : tableaux de 10 valeurs, indices 0–9 (`gray[0] = #f8f9fa` … `gray[9] = #212529`) [S] https://github.com/yeun/open-color.

**Ant Design** — `ant-design-colors`, `src/generate.ts` : `lightColorCount = 5`, `darkColorCount = 4` autour du primaire ⇒ 10 crans, générés en HSV (pas de teinte 2, pas de saturation 0,16/0,05, pas de luminosité 0,05/0,15) [S] https://github.com/ant-design/ant-design-colors. Doc : 10 crans par couleur, le 6e est la couleur principale (`#1677ff`), noms `blue-1` … `blue-10` [S] https://ant.design/docs/spec/colors.

**Salesforce SLDS** — paquet npm `@salesforce-ux/design-system` 2.264.1 : `palette-blue-10, 15, 20, 30, 40, 50, 60, 65, 70, 80, 90, 95` ; neutral a aussi `100` (#ffffff) [S]. Calcul du L\* de chaque cran : blue-10 → 7,9 · 20 → 19,0 · 50 → 49,1 · 65 → 66,0 · 90 → 90,9 · 95 → 96,0 ; neutral-50 → 49,2 ; tous à ±1 de leur numéro [I, calcul]. **Le numéro SLDS est donc un L\*** (même logique que Material, sens identique : 0 = noir). Les articles de l'équipe parlent du modèle HCL et du fait que « the color system uses numerical values, which gives users a quick way to know what the color contrast ratios are » (résumé de recherche, article Medium non lisible directement) [S partiel] https://medium.com/salesforce-ux/the-salesforce-color-system-c7c6b5b9c577. Pas de règle « écart de N » trouvée dans un texte primaire [S par absence].

**USWDS** (le « magic number ») — « a 100-point scale to communicate a color token's grade, where 0 is pure white and 100 is pure black » ; grades 5, 10, 20 … 90 ; bandes de luminance (ex. grade 50 : 0,175–0,183 ; grade 90 : 0,005–0,015) ; « 40+ … AA Large Text », « 50+ … AA », « 70+ … AAA » [S] https://designsystem.digital.gov/design-tokens/color/overview/. Le **sens est inversé** (0 = blanc). Explication de la technique : https://darekkay.com/blog/accessible-color-palette/.

**Reasonable Colors** — 6 crans par couleur ; « difference of 2 » ⇒ ≥ 3:1, « 3 » ⇒ ≥ 4,5:1, « 4 » ⇒ ≥ 7:1, parce que « the relative luminance for each shade is pinned within certain ranges » ; MIT [S] https://reasonable.work/colors/.

**Adobe Leonardo** — `ratios` en tableau ⇒ noms par incréments de 100 (voir plus haut), ou en objet ⇒ « you define what name will be output » ; Apache 2.0 [S] https://github.com/adobe/leonardo.

**Evil Martians Harmonizer** — « Define levels (e.g., 100–900) as lightness steps. Adjust contrast per level (calculated against your background) » ; « Consistent contrast calculation using APCA (default) or WCAG » ; OKLCH [S] https://github.com/evilmartians/harmonizer.

### Nommage par APCA Lc

Aucun système trouvé ne met le Lc **dans le nom** [S par absence]. Radix et Harmonizer attachent un Lc à un cran, **contre un fond fixé** [S]. Raison de fond [I] : APCA n'est ni symétrique (texte clair sur foncé ≠ l'inverse) ni multiplicatif, donc aucune reparamétrisation ne transforme « écart de nom » en « Lc garanti » pour toutes les paires. Un nom en Lc ne garantit quelque chose que contre le fond de référence.

---

## 3. Les familles

Constat de départ [I] : L\*, les bandes USWDS et le shade Fusilier sont tous **des fonctions monotones de la seule luminance relative Y**. Ce sont trois graduations de la même règle. Ce qui les distingue, c'est la façon dont l'écart de nom se traduit en ratio.

### A. Par rang (ordinal) — Tailwind, Carbon, Primer, Open Color, Ant, Fluent (marque), Spectrum, Atlassian, Leonardo (tableau), Hueladder actuel
- **Le nom dit** : « je suis le k-ième ».
- **Ajouter ou retirer un Hueladder** : si les couleurs sont réparties sur n positions (comme dans Hueladder : `shade = 200·(1 − (rang+0,5)/n)`), **toutes les couleurs bougent**. Sinon il faut des noms intercalaires (Atlassian 250/850, Tailwind 950, Spectrum 25/50/75), dont la valeur n'est pas définie par le nom : c'est une décision au cas par cas. Avec des entiers consécutifs (Radix, Primer, Open Color, Ant), insérer oblige à renommer.
- **Garantie** : « Δrang ≥ k ⇒ AA ». Elle ne tient que si les crans sont calibrés en contraste (Hueladder, Carbon). Et k dépend de n (Hueladder : 11 crans ⇒ 6, 9 crans ⇒ 5), ou n'est même pas uniforme (tableau Carbon : 4 à 6 crans selon le point de départ).

### B. Par luminosité perceptuelle (L\*) — Material/HCT, Salesforce SLDS ; variantes non perceptuelles : Fluent grey (% sRGB)
- **Le nom dit** : « ma clarté vaut X ».
- **Ajouter ou retirer un cran** : **rien ne bouge**. Tout nombre de 0 à 100 est un nom valide (SLDS a ajouté 15, 65, 95 ; Material utilise 4, 6, 12, 17, 87…).
- **Garantie** : « ΔL\* ≥ 40 ⇒ 3:1, ΔL\* ≥ 50 ⇒ 4,5:1 » (Material). Elle est **approchée**, parce que la relation L\* → ratio n'est pas linéaire. Seuils corrects sur toute la plage : 38,4 / 50,2 / 62,2 ⇒ règle sûre « Δ40 ⇒ 3:1, Δ51 ⇒ AA, Δ63 ⇒ AAA » [I, calcul]. La garantie ne tient que si le L\* réel est celui du nom (vrai chez Material, à ±1 chez SLDS).

### C. Par bande de luminance (« magic number ») — USWDS, Reasonable Colors
- **Le nom dit** : « ma luminance est comprise entre a et b ».
- **Ajouter ou retirer un cran** : les autres ne bougent pas, mais on ne peut ajouter un cran que si une bande libre compatible existe (USWDS a dû créer des variantes « v » plutôt que des grades intermédiaires). Les bandes sont larges, donc deux couleurs de même grade n'ont pas le même contraste.
- **Garantie** : « Δgrade ≥ 50 ⇒ AA » (USWDS) ou « Δ3 ⇒ AA » (Reasonable). Elle est vraie par construction des bandes, **avec de la marge perdue** en échange de la liberté laissée au dessin.

### D. Par contraste (logarithmique) — Fusilier color-shades
- **Le nom dit** : « mon contraste face au noir vaut 21^(nom/200) ».
- **Ajouter ou retirer un cran** : **rien ne bouge**. N'importe quel entier de 0 à 200 est un nom.
- **Garantie** : « Δ100 ⇒ AA (4,58:1), Δ75 ⇒ 3:1, Δ128 ⇒ AAA ». Elle est **exacte**, c'est une identité (voir §1). C'est la seule famille où la règle est uniforme sur toute l'échelle sans perte de marge.

### E. Par rôle (sémantique) — Radix 1–12, Fluent shade/primary/tint, Ant (6 = primaire)
- **Le nom dit** : « je sers à X ».
- **Ajouter ou retirer un cran** : c'est ajouter ou retirer un usage, donc ça touche tout le système. Radix fige les 12.
- **Garantie** : attachée à un **couple de rôles** (Radix : texte 11 sur fond 2 ⇒ Lc 60). Elle ne s'écrit pas en écart de nom.
- En pratique, cette famille est **une couche d'alias** posée sur une échelle d'une des familles A à D.

---

## 4. Recommandation pour Hueladder

### Principe : séparer la valeur de l'étiquette

1. **Coordonnée interne unique : le shade Fusilier s ∈ [0, 200]**, continu (ou, ce qui revient au même, le contraste cible face au noir). Le moteur calcule une couleur à partir de **son s seul** : on cherche la clarté qui donne `21^(s/200)`, ce que Hueladder fait déjà (`build.mjs`, `bisectLightness`). [I]
2. **Une nomenclature = une fonction monotone fixe `étiquette → s`**, qui ne dépend **pas** du nombre de crans. C'est ce qui donne la propriété demandée : **un cran garde sa couleur quand on en ajoute ou retire d'autres**, puisque sa couleur ne dépend que de son nom. [I]
3. **La liste des crans devient une donnée libre** (`"crans": ["50","100","250",…]`). Tout nom valide pour la nomenclature choisie est accepté. Les préréglages actuels (Maxi, Standard, Centaines, Impairs, Mini) deviennent de simples listes. [I]
4. **La règle affichée se calcule à partir de la fonction**, pas à la main : écart minimal d'étiquette garantissant 3:1 / 4,5:1 / 7:1 sur toute la plage (pire cas). Si la fonction est linéaire en s, on obtient **un seul nombre**. Sinon, on imprime un tableau façon Carbon. [I]

### Nomenclatures à proposer

| Choix | Étiquette → s | Règle lisible (calculée) | Remarques |
|---|---|---|---|
| **Centaines** (défaut) | s = 200 · (1 − nom/1000), 0 = blanc, 1000 = noir | **Δ500 ⇒ AA** (4,58:1), Δ375 ⇒ 3:1, Δ640 ⇒ AAA | 25, 50, 150, 250, 975… sont tous définis par le nom, sans interpolation entre voisins. 500 ↔ s = 100, comme aujourd'hui. Les autres crans bougent un peu par rapport à la répartition actuelle en 11 crans (100 : s = 180 au lieu de 172,7) : **changement cassant à annoncer**. Autre option : garder l'ancienne carte comme « Centaines (v1) ». |
| **Contraste** (Fusilier) | s = nom, 0 = noir, 200 = blanc | **Δ100 ⇒ AA**, Δ75 ⇒ 3:1, Δ128 ⇒ AAA | Pas au choix (25, 10, 5), crans libres. C'est la forme la plus honnête de la promesse de Hueladder. |
| **Luminosité** (Material / SLDS) | nom = L\* visé, converti en s par Y | **Δ51 ⇒ AA**, Δ40 ⇒ 3:1, Δ63 ⇒ AAA | Parle aux équipes Material/Salesforce. Afficher « Δ50 ⇒ AA » serait faux à l'extrémité claire (50/100 = 4,48). |
| **Grades 0–100** (USWDS, sens inversé) | s = 200 · (1 − grade/100) | **Δ50 ⇒ AA**, Δ38 ⇒ 3:1, Δ64 ⇒ AAA | Même logique que Centaines, à l'échelle 100, avec le vocabulaire « magic number » que les équipes publiques connaissent. |
| **Rang / gabarits d'import-export** (Radix 1–12, Primer 0–9, Carbon 10–100, Ant 1–10, Open Color 0–9, Fluent 10–160, Atlassian 100–1000 + 250/850, Spectrum) | table fixe `nom → s` par gabarit | règle en tableau, ou « Δk rangs » | Pour **s'aligner** sur un système existant. Avertir : dans ces nomenclatures, insérer un cran oblige à renommer, ou à utiliser un intercalaire dont le nom ne dit plus rien. |

Vérification rapide des règles « Centaines » et « Grades » [I] : Δs = 200 · Δnom/1000, donc Δnom = 500 ⇔ Δs = 100 ⇔ 4,58:1. Pour 3:1, il faut Δs ≥ 72,2 ⇔ Δnom ≥ 361, arrondi à la règle ronde 375 (Δs = 75, 3,13:1). Pour 7:1, Δs ≥ 127,8 ⇔ Δnom ≥ 639, donc 640.

### Autres points

- **Garder l'ancien mode « réparti »** (s réparti selon n, `Δrang ≥ 6` pour 11 crans) derrière une option explicite, en disant clairement que **les couleurs bougent quand n change**. Il sert quand on veut n crans à égale distance perceptive sans se soucier des noms. [I]
- **Direction** : un seul réglage `sens: "clair→foncé" | "foncé→clair"`. Tailwind, Atlassian et USWDS montent vers le foncé ; Material, SLDS et Fusilier montent vers le clair. Fluent marque va de 10 foncé à 160 clair. [S pour chaque sens cité]
- **Crans hors règle** (`0` blanc pur, `1000` noir pur) : en Centaines ils tombent naturellement à s = 200 et s = 0, donc **ils rentrent dans la règle** et ne sont plus une exception. [I]
- **Rôles** (Radix, Fluent primary) : les traiter comme une couche d'alias (`bg-subtle → 100`, `text → 900`) exportée à côté, jamais comme la nomenclature elle-même. [I]
- **Mode sombre** : la même carte `nom → s` peut s'appliquer au contraste **face au fond sombre** au lieu du noir, ce qui garde « Δ500 ⇒ AA » dans les deux modes. C'est à vérifier contre la dérivation actuelle de cran (`dark.mjs`) avant de le promettre. [I]
- **APCA** : ne pas promettre de règle d'écart de nom en Lc (non symétrique). Afficher le Lc contre le fond de référence, comme Radix. [I]
- **Arrondi** : si l'étiquette est l'arrondi d'une valeur mesurée (couleurs importées), garder la marge. En Contraste, Δ100 arrondi donne encore ≥ 4,51. En Luminosité, Δ51 couvre l'arrondi. [I, calcul]

---

## Sources

- Fusilier : https://github.com/dfusilier · https://github.com/dfusilier/color-shades · https://dfusilier.github.io/color-shades
- Tailwind : https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/theme.css · https://tailwindcss.com/blog/tailwindcss-v3-3
- Material : https://github.com/material-foundation/material-color-utilities (hct/hct.ts, contrast/contrast.ts, dynamiccolor/color_spec_2021.ts) · https://m3.material.io/styles/color/system/how-the-system-works
- Atlassian : https://www.npmjs.com/package/@atlaskit/tokens · https://atlaskit.atlassian.com/packages/design-system/tokens/changelog · https://atlassian.design/foundations/color-new/color-palette-new
- Spectrum 2 : https://github.com/adobe/spectrum-design-data/blob/main/packages/tokens/src/color-palette.json · https://spectrum.adobe.com/page/color-system/
- Leonardo : https://github.com/adobe/leonardo/blob/main/packages/contrast-colors/README.md
- Carbon : https://github.com/carbon-design-system/carbon/tree/main/packages/colors · https://github.com/carbon-design-system/carbon-website/blob/main/src/pages/elements/color/overview.mdx · https://carbondesignsystem.com/elements/color/overview/
- Radix : https://github.com/radix-ui/colors · https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- Primer : https://github.com/primer/primitives/blob/main/src/tokens/base/color/light/light.json5
- Fluent 2 : https://github.com/microsoft/fluentui/tree/master/packages/tokens/src (types.ts, global/brandColors.ts, global/colors.ts)
- Open Color : https://github.com/yeun/open-color
- Ant Design : https://github.com/ant-design/ant-design-colors · https://ant.design/docs/spec/colors
- Salesforce : https://www.npmjs.com/package/@salesforce-ux/design-system · https://medium.com/salesforce-ux/the-salesforce-color-system-c7c6b5b9c577 · https://www.lightningdesignsystem.com/2e1ef8501/p/655b28-color
- USWDS : https://designsystem.digital.gov/design-tokens/color/overview/
- Magic numbers : https://darekkay.com/blog/accessible-color-palette/
- Reasonable Colors : https://reasonable.work/colors/
- Harmonizer : https://github.com/evilmartians/harmonizer
