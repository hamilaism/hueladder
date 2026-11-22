# Dériver un mode sombre : les méthodes documentées, la désaturation, le fond

Recherche pour **Hueladder**, septembre 2026.

Conventions de lecture :
- **[S]** : sourcé. L'URL est donnée et le fait a été lu dans la source (doc, code, papier).
- **[C]** : calcul fait pour ce rapport (scripts dans `references/mode-sombre/` : `pairs.mjs`, `radix.mjs`, `apcasym.mjs`, `cam16bg.py`). Il utilise les fonctions du moteur Hueladder (`engine/lib/color.mjs`, `apca.mjs`) et un CAM16 écrit en Python pur d'après Li et al. 2017.
- **[I]** : mon inférence ou mon avis. Rien ne le démontre directement.

---

## 0. Ce qu'il faut retenir

1. **[C] Le miroir WCAG actuel de cran conserve exactement tous les contrastes entre crans, quel que soit le fond.** On a (Y+0,05)_sombre,i = C_i·(Y_fond+0,05) et (Y+0,05)_clair,i = 1,05/C_i. Le rapport entre deux crans a et b vaut donc C_b/C_a dans les deux modes. La garantie « N rangs d'écart ⇒ AA » passe telle quelle en sombre. Le fond n'intervient que comme **facteur d'échelle commun** k = Y_fond + 0,05. Tous les crans sombres montent ou descendent ensemble quand on change le fond, et k fixe le budget 1,05/k, c'est-à-dire le plus fort contraste possible face à ce fond.
2. **[C] Les systèmes professionnels ne désaturent pas « de x % » leurs couleurs d'accent et de texte en sombre.** J'ai mesuré 16 paires clair/sombre de même rôle (Apple, Material 2, Primer, Fluent, Carbon, Spectrum 2, Tailwind, Radix). La couleur sombre utilise **90 à 100 % de la chroma que le gamut sRGB permet** à sa luminosité et à sa teinte. La baisse de chroma OKLCH qu'on observe (rapport de 0,56 à 1,10) vient **entièrement du gamut**. Un bleu à L 0,74 ne peut pas porter 0,24 de chroma.
3. **[S] La désaturation a un appui empirique, mais aucune valeur chiffrée qui fasse autorité.**
   - Material 2 recommande des tons 200–50 « désaturés » parce que les couleurs saturées « vibrent ».
   - Une étude psychophysique (Kim, Lee, Suk, *PLoS One* 2026) confirme que des designers réduisent la chroma sur fond noir, d'autant plus que la chroma de départ est élevée.
   - Les « 20 % » ou « 20–40 % » qui circulent viennent de billets de blog, pas de sources primaires.
4. **[S+C] CAM16 sait calculer une chroma « correspondante » d'un fond blanc à un fond sombre, via Yb.** Pour #121212, il prédit qu'il faudrait garder **45 à 62 %** de la chroma. Mais le modèle diverge quand Yb tend vers 0 (N_bb = 0,725·n^−0,2 → ∞). Il n'a pas été validé pour des fonds aussi sombres, il ne modélise pas l'effet Helmholtz–Kohlrausch, et ses propres auteurs publient en 2025 qu'il décrit mal le contraste simultané. C'est une piste, pas une vérité.
5. **[C] APCA : les crans sombres obtenus par miroir WCAG sont perceptivement bien plus faibles.** Un gris à 4,5:1 sur blanc vaut Lc 71. Son miroir à 4,5:1 sur #121212 vaut Lc −32. Pour atteindre |Lc| 71 en sombre, il faut **10,9:1** en WCAG. Radix, qui vise APCA, livre bien ses crans de texte sombres à environ 8,4:1, contre environ 4,6:1 en clair.

---

## 1. Les méthodologies

### 1.1 Material Design 2 : surface #121212, tons 200 désaturés, surcouches d'élévation

**Principe [S]**
- Le fond de base est un gris foncé **#121212**, pas du noir.
- La couleur de marque est remplacée par un **ton plus clair de la même palette (200–50)** au lieu des tons 900–500.
- L'élévation se lit par une **surcouche blanche semi-transparente** : plus la surface est haute, plus elle est claire.
- Le texte « on-surface » est un blanc à opacité 87 % (texte principal), 60 % (secondaire) ou 38 % (désactivé).

**Algorithme [S]**
- Opacité de la surcouche : α = (4,5·ln(élévation_dp + 1) + 2) / 100. Constantes `FORMULA_MULTIPLIER = 4.5f` et `FORMULA_OFFSET = 2f` dans `ElevationOverlayProvider.java`. Cela donne 0 % à 0 dp, 5 % à 1 dp et 16 % à 24 dp.
- Le fond doit tenir au moins **15,8:1** avec le blanc, pour que du texte blanc reste à 4,5:1 sur la surface la plus élevée.
- Exemple de référence : primary #6200EE (Purple 500) en clair, #BB86FC (Purple 200) en sombre.

**Justification donnée [S]** : « More saturated colors tend to visually "vibrate" against darker backgrounds, making them harder to read. » Le blanc pur est lui aussi évité, parce que sa lumière « appears to bleed or blur ». Le gris foncé « increases visibility for shadows and also reduces eye strain for light text ».

**Qui** : Material 2, MDC Android et Web (encore très copié).

**Sources**
- https://m2.material.io/design/color/dark-theme.html
- https://codelabs.developers.google.com/codelabs/design-material-darktheme
- https://github.com/material-components/material-components-android/blob/master/docs/theming/Dark.md
- https://github.com/material-components/material-components-android/blob/master/lib/java/com/google/android/material/elevation/ElevationOverlayProvider.java

**Mesure [C]** : #6200EE a une chroma OKLCH de 0,278 et atteint 7,63:1 sur blanc. #BB86FC a une chroma de 0,172 et atteint 7,07:1 sur #121212, soit un rapport de chroma de 0,62. Mais #BB86FC occupe **97 % du gamut disponible** à sa luminosité. La « désaturation » vient donc du passage à un ton plus clair, et non d'une réduction délibérée à luminosité égale. Au passage, la teinte bouge de 287° à 303°.

**Forces**
- C'est la seule source de premier rang qui justifie explicitement la désaturation et le choix du fond.
- Elle donne une règle chiffrée : 15,8:1 et 4,5:1 sur toutes les élévations.

**Limites**
- « Desaturated » n'est pas quantifié : c'est « prenez le 200 ».
- Rien ne relie le ton sombre au ton clair par une règle de contraste.
- Aucune étude n'est citée pour l'effet de vibration.

### 1.2 Material Design 3 / HCT : même palette tonale, rôles remappés

**Principe [S]** : chaque couleur source produit une **palette tonale HCT** (tons 0–100 à chroma fixe). Un schéma assigne à chaque **rôle** un ton différent en clair et en sombre, à partir de la **même palette** : même teinte et même chroma demandées. Le ton HCT est le L* de CIELAB. Les docs MCU précisent qu'un écart de ton de 40 garantit au moins 3:1 et qu'un écart de 50 garantit au moins 4,5:1.

**Algorithme [S]** (`color_spec_2021.ts`) :

| Rôle | Clair | Sombre |
|---|---|---|
| surface / background | 98 | 6 |
| onSurface | 10 | 90 |
| primary | 40 | 80 |
| onPrimary | 100 | 20 |
| primaryContainer | 90 | 30 |
| onPrimaryContainer | 30 | 90 |
| outline | 50 | 60 |
| surfaceContainerLowest→Highest | 100 / 96 / 94 / 92 / 90 | 4 / 10 / 12 / 17 / 22 |

- En clair, primary est à 58 tons de la surface. En sombre, l'écart est de 74 tons.
- La spec 2025 (`color_spec_2025.ts`) introduit `tMaxC` / `tMinC`, qui cherchent le ton de chroma maximale dans une plage, et des **multiplicateurs de chroma qui dépendent du mode**. Pour onSurface en variante Expressive, sur les teintes jaunes, le code écrit `s.isDark ? 3.0 : 2.3`. En sombre, la surface passe au ton 4.
- Point clé : **la chroma n'est pas réduite en sombre**. HCT calcule la chroma dans des conditions de vision **fixes**, avec un fond à L* 50, et ignore donc le fond réel.

**Qui** : Android 12+, Material 3 Web et Flutter, et tout générateur fondé sur `material-color-utilities`.

**Sources**
- https://github.com/material-foundation/material-color-utilities/blob/main/typescript/dynamiccolor/color_spec_2021.ts
- https://github.com/material-foundation/material-color-utilities/blob/main/typescript/dynamiccolor/color_spec_2025.ts
- https://github.com/material-foundation/material-color-utilities/blob/main/concepts/contrast_for_accessibility.md
- https://m3.material.io/styles/color/roles

**Forces**
- Le modèle est explicite : un rôle vaut un ton par mode.
- Le contraste est garanti par des écarts de ton.
- Il est open source et testé à très grande échelle.

**Limites**
- Il est pensé pour des **rôles** (une vingtaine de tokens), pas pour une échelle 50→950 entière.
- Le mapping clair→sombre est une table écrite à la main, pas une loi.
- Pas de compensation perceptive du fond.

### 1.3 Adobe Leonardo / Spectrum : thèmes générés par contraste cible contre un fond

**Principe [S]** : chaque couleur est une **échelle continue**, interpolée entre des couleurs clés et le blanc ou le noir. Chaque swatch est défini par un **ratio de contraste cible contre le fond**. Pour obtenir le thème sombre, on change la luminosité du fond (`Theme.lightness`) : « Leonardo recalculates all colors to maintain their target contrast ratios ».

**Algorithme [S]** (`packages/contrast-colors/lib/theme.js`, `color.js`)
- `searchColors(color, bg, lightness, ratios, formula)` cherche, le long de l'échelle de la couleur, le point qui atteint le ratio visé. La formule est `wcag2` ou `wcag3` (APCA).
- `contrast` est un multiplicateur global des ratios.
- `saturation` (défaut **100**) multiplie la chroma **OKLCH** des couleurs clés : `newSaturation = currentSaturation * (saturation/100)`. C'est exactement le curseur « désaturation » de Hueladder, avec la même mise en œuvre, mais il n'est **pas** propre au mode sombre et vaut 0 % de réduction par défaut.

**Retour d'expérience Spectrum [S]** (« Reinventing Adobe Spectrum's colors »)
- Les anciens thèmes sombres étaient « an inversion of the light theme with a slight increase in contrast ».
- L'équipe a constaté que le ratio WCAG et le contraste perçu divergent : le même gris à 4,5:1 paraît différent sur blanc et sur noir, par contraste simultané de luminosité.
- Solution : exprimer les contrastes cibles **en pourcentage du contraste disponible de chaque thème**, puis générer les thèmes clair, sombre et « darkest » à partir d'un seul thème adaptatif.

**Mesure sur Spectrum 2 [C]** (`spectrum-design-data/.../color-palette.json`)
- Le fond sombre gray-25 vaut **#111111**.
- blue-900 tient 4,81:1 sur blanc et **5,38:1** sur #111. blue-1000 tient 6,30 puis 6,59.
- Spectrum **augmente légèrement** le contraste en sombre.
- Les couleurs sombres occupent 97 à 100 % du gamut, donc aucune désaturation délibérée.

**Qui** : Adobe Spectrum. Leonardo est aussi utilisé par d'autres équipes, open source.

**Sources**
- https://github.com/adobe/leonardo/blob/main/packages/contrast-colors/README.md
- https://github.com/adobe/leonardo/blob/main/packages/contrast-colors/lib/theme.js
- https://adobe.design/stories/design-for-scale/reinventing-adobe-spectrum-s-colors
- https://uxdesign.cc/creating-contrast-based-themes-with-leonardo-32b6219a090f
- https://github.com/adobe/spectrum-design-data/blob/main/packages/tokens/src/color-palette.json

**Forces**
- C'est la méthode la plus proche de celle de Hueladder. Le fond est un paramètre de premier rang et les contrastes sont garantis par construction.
- APCA est disponible.

**Limites**
- La chroma en sombre est celle de l'échelle interpolée à cette luminosité, ce qui dépend des couleurs clés.
- L'échelle « % du contraste disponible » ne conserve plus exactement les ratios entre crans.
- **[C]** Avec l'échelle log « % du budget » sur #121212 (budget 18,73), 4,5:1 devient **4,25:1**. La garantie AA écrite dans le nom tomberait.

### 1.4 Radix Colors : échelles sombres dessinées séparément, sémantique à 12 crans

**Principe [S]**
- Chaque couleur a deux échelles de 12 crans (`blue` / `blueDark`), avec la **même sémantique** : 1–2 fonds, 3–5 fonds de composants, 6–8 bordures, 9–10 aplats, 11–12 texte.
- Garantie publiée : les crans 11 et 12 atteignent **APCA Lc 60 et Lc 90** sur le cran 2 de la même échelle.
- Le cran 9 est **identique** en clair et en sombre : c'est la couleur de marque.
- Le générateur de palettes personnalisées (`generate-radix-colors.tsx`) cherche dans les échelles sombres existantes les deux plus proches de la couleur source, en ΔE OK. Il les mélange, cale teinte et chroma sur la source, puis recale la luminosité sur le fond choisi avec une courbe de Bézier (`darkModeEasing`). La chroma des crans 11 et 12 est plafonnée au maximum de celle des crans 8 et 9.

**Mesure [C]** (bleu et rouge, contraste vs cran 1)
- Les crans de texte sombres portent **1,6 à 1,9 fois le ratio WCAG** du clair. blue11 vaut 4,67:1 en clair et 8,72:1 en sombre ; en APCA, Lc 68,9 en clair et −60,1 en sombre. Radix cale donc le sombre sur APCA, pas sur WCAG.
- Les crans 3 à 8 sombres ont **plus** de chroma OKLCH que les crans clairs (×1,15 à ×3,3). Ce sont des fonds et bordures sombres teintés.
- Les crans de texte en ont moins (×0,5 à ×0,8), à cause du gamut : ils occupent 100 % de ce qui est tenable.

**Qui** : Radix UI et Radix Themes, repris par de nombreux design systems (shadcn et d'autres).

**Sources**
- https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- https://www.radix-ui.com/colors/docs/overview/custom-palettes
- https://github.com/radix-ui/website/blob/main/components/generate-radix-colors.tsx

**Forces**
- La sémantique par usage transpose directement au sombre.
- Le calage est perceptif (APCA).
- Les échelles ont été éprouvées en production.

**Limites**
- L'échelle sombre est dessinée à la main : on ne peut pas la reproduire à partir d'une couleur arbitraire, sauf en interpolant parmi les échelles Radix.
- Aucune garantie WCAG 2 n'est publiée pour les crans intermédiaires.

### 1.5 IBM Carbon : une seule palette, tokens remappés par thème

**Principe [S]**
- Quatre thèmes : white, g10, g90 et g100.
- Les **mêmes** rampes (blue 10–100, etc.) servent à tous. Chaque token pointe vers un cran différent selon le thème.
- Les fonds sont gray 90 (#262626) et gray 100 (#161616).

**Algorithme [S]** (`packages/themes/src/dtcg/themes.json`)

| Token | white | g90 | g100 |
|---|---|---|---|
| background | white | gray.90 | gray.100 |
| layer.01 | gray.10 | gray.80 | gray.90 |
| interactive | blue.60 | blue.50 | blue.50 |
| link.primary | blue.60 | blue.40 | blue.40 |
| text.error | red.60 | **red.30** | **red.40** |
| support.error | red.60 | red.40 | red.50 |
| focus | blue.60 | white | white |
| background.brand | blue.60 | blue.60 | blue.60 |

Le cran choisi **dépend du fond** : text.error est plus clair sur g90, qui est plus clair que g100. On voit donc une sélection de cran pilotée par le contraste.

**Mesure [C]**
- link blue.60 (#0f62fe) atteint 5,00:1 sur blanc. blue.40 (#78a9ff) atteint **7,68:1** sur #161616.
- La chroma baisse (rapport 0,56), mais l'occupation du gamut reste à **100 %**.

**Qui** : IBM.

**Sources**
- https://carbondesignsystem.com/elements/color/overview/
- https://carbondesignsystem.com/elements/themes/overview/
- https://github.com/carbon-design-system/carbon/tree/main/packages/themes/tokens

**Forces**
- Aucune nouvelle couleur : une seule palette à maintenir.
- Le mode sombre se réduit à une table de correspondance.

**Limites**
- Il faut une palette assez dense pour trouver le bon cran.
- Le remappage est fait à la main et n'obéit à aucune loi générale.
- C'est une méthode d'**attribution de rôles**, pas de **génération d'échelle**.

### 1.6 Apple HIG : couleurs dynamiques, variantes sombres légèrement éclaircies

**Principe [S]**
- Chaque couleur système a quatre variantes : clair, sombre, contraste augmenté clair, contraste augmenté sombre.
- « These colors aren't necessarily inversions of their light counterparts: while many colors are inverted, some are not. »
- Les fonds sont de deux familles : **base** (plus sombre) et **elevated** (plus clair), pour signaler la profondeur. En iOS, systemBackground vaut #000 en base et secondarySystemBackground #1C1C1E ; ces deux valeurs sont connues de la doc UIKit, sans avoir été relues ici.
- Contraste minimum 4,5:1, et **7:1 visé** pour les couleurs personnalisées, surtout en petit texte.
- Sur les images : « In dark environments, colors appear bright and saturated. » Il faut adoucir les images à fond blanc « to prevent the background from glowing ».

**Mesure [C]** (valeurs iOS 26 relevées dans le JSON du HIG)

| Couleur | Clair | Sombre |
|---|---|---|
| systemBlue | (0,136,255), 3,52:1 sur blanc | (0,145,255), 6,49:1 sur noir |
| systemRed | (255,56,60) | (255,66,69) |
| systemGreen | (52,199,89) | (48,209,88) |

- Rapport de chroma de 0,95 à 1,07, occupation 91 à 100 % : **aucune désaturation**. La variante sombre est un pas plus claire.
- Le « contraste augmenté » est le levier explicite (systemBlue IC sombre : 92,184,255).

**Sources**
- https://developer.apple.com/design/human-interface-guidelines/dark-mode
- https://developer.apple.com/design/human-interface-guidelines/color

**Forces** : le système est pensé de bout en bout (vibrancy, base/elevated, contraste augmenté).

**Limites**
- Les valeurs sont dessinées à la main et l'algorithme n'est pas public.
- Le fond noir pur est un choix OLED assumé.

### 1.7 Atlassian : symétrie de rampe (700 clair ⇒ 400 sombre) et rampe neutre sombre dédiée

**Principe [S]**
- Les rampes de couleur sont communes. Les neutres ont une rampe claire et une rampe **DarkNeutral** distincte.
- « If the swatches are divided in half, each half becomes a mirror. » Un bouton en 700 en clair passe en 400 en sombre.
- Les nouveaux crans 250 et 850 ont été ajoutés en partie pour « reduce saturation for subtle backgrounds in dark mode ». La désaturation est donc ciblée sur les **fonds subtils**, pas sur les accents.
- Exigences : 4,5:1 pour le texte, 3:1 pour l'UI essentielle.

**Sources**
- https://atlassian.design/foundations/color/color-palette
- https://atlassian.design/foundations/color
- https://community.developer.atlassian.com/t/introducing-design-tokens-new-colour-foundations-and-dark-mode/62258
- https://atlaskit.atlassian.com/packages/design-system/tokens/changelog

**Forces** : c'est simple et ça couvre « most use cases » selon la doc.

**Limites** : aucune garantie de contraste entre crans n'est publiée, et la symétrie d'index ne dit rien du contraste face au fond.

### 1.8 GitHub Primer : primitives sombres distinctes, tokens fonctionnels surchargés

**Principe [S]**
- `base/color/dark/dark.json5` définit des rampes **différentes** de `light.json5`. Par exemple blue-5 vaut #0969da en clair et #1f6feb en sombre, blue-3 vaut #54aeff puis #58a6ff.
- Les rampes neutres sont inversées (neutral-0 = #0D1117 en sombre).
- Il existe plusieurs thèmes sombres : dark, dark-dimmed, dark-high-contrast et des variantes daltonisme.
- Les tokens fonctionnels portent des surcharges par thème : `fgColor.accent` vaut blue.5 en clair, **#4493F8** en dark et #74B9FF en dark-high-contrast.

**Mesure [C]** : fg.accent atteint 5,19:1 sur blanc et 6,10:1 sur #0d1117, avec un rapport de chroma de 0,89 et une occupation du gamut de 93 %.

**Sources**
- https://github.com/primer/primitives/tree/main/src/tokens/base/color
- https://github.com/primer/primitives/blob/main/src/tokens/functional/color/fgColor.json5

**Forces** : c'est très complet (dimmed, contraste élevé, daltonisme).

**Limites** : tout est dessiné à la main. Primer montre ce qu'il faut couvrir, pas comment le calculer.

### 1.9 Tailwind : même palette, choix manuel via `dark:`

**Principe [S]** : il n'existe pas de palette sombre. Le développeur écrit `dark:bg-gray-800`, `dark:text-white`, etc. L'« inversion 50↔950 » est une convention d'usage, pas une règle de la doc.

**Mesure [C]** : pour les liens, on passe souvent de blue-600 à blue-400. On obtient 5,25:1 sur blanc et 6,73:1 sur gray-900 (#101828), avec une occupation du gamut de 100 %.

**Source** : https://tailwindcss.com/docs/dark-mode

**Forces** : zéro couleur de plus, et un contrôle total.

**Limites** : aucune garantie, et chaque paire se décide à la main.

### 1.10 Fluent 2 (Microsoft) : rampe de marque à 16 crans, alias remappés

**Principe [S]** : une rampe de marque de 16 crans (10→160) et des alias par thème.

| Alias | Clair | Sombre |
|---|---|---|
| colorBrandForeground1 | brand[80] (#0f6cbd) | brand[100] (#479ef5) |
| colorBrandBackground | brand[80] | brand[70] |
| colorNeutralBackground1 | #ffffff | grey[16] (#292929) |

**Mesure [C]** : 5,38:1 en clair, 5,18:1 sur #292929, rapport de chroma de 1,03.

**Sources**
- https://github.com/microsoft/fluentui/blob/master/packages/tokens/src/alias/darkColor.ts
- https://github.com/microsoft/fluentui/blob/master/packages/tokens/src/alias/lightColor.ts
- https://fluent2.microsoft.design/color

**Forces et limites** : les mêmes que Carbon. Le fond est nettement plus clair (#292929), ce qui réduit le budget à environ 12,6:1.

### 1.11 Inversion simple (L*, OKLCH L ou RGB)

**Principe [I, pratique courante]** : L_sombre = 1 − L_clair, ou `filter: invert(1) hue-rotate(180deg)`.

**Limites**
- **[S]** Spectrum a abandonné l'inversion parce que le contraste perçu diverge.
- **[C]** WCAG n'est pas symétrique en L* : le gris médian WCAG est environ #777 (4,5:1 contre le blanc comme contre le noir), et non #808080. APCA situe son pivot vers #a0a0a0 selon Somers.
- Une inversion en L* décale donc tous les contrastes.
- Elle ne sert qu'en témoin.

### 1.12 APCA « sensible à la polarité » : miroir autour du centre de contraste

**Principe [S]** (Andrew Somers, discussion #74 du dépôt SAPC-APCA)
- On mesure le Lc clair, on le reporte en négatif en sombre, en pivotant autour d'un « centre de contraste » d'environ **#a0a0a0**.
- Exemple : texte #3a sur #db (Lc 75) en clair correspond à texte #d6 sur #36 (Lc −75) en sombre.
- Somers conseille de **plafonner** le contraste en sombre vers Lc 85–90 à cause de la halation, en ajoutant que cela « depends on the display's brightness ».
- Les exposants diffèrent : 0,56/0,57 en polarité normale, 0,62/0,65 en inverse. Somers l'attribue à l'adaptation locale et à la fréquence spatiale (discussion #86).

**Sources**
- https://github.com/Myndex/SAPC-APCA/discussions/74
- https://github.com/Myndex/SAPC-APCA/discussions/86
- https://git.apcacontrast.com/documentation/README.html

**Forces** : c'est le seul modèle de contraste qui traite explicitement le mode sombre comme différent. Radix l'utilise.

**Limites**
- APCA n'est pas normatif : WCAG 3 est encore un brouillon.
- Il ne se compose pas : les Lc entre crans ne se déduisent pas les uns des autres, contrairement aux ratios WCAG.

### 1.13 Modèles d'apparence (CIECAM02 / CAM16) : couleurs correspondantes sous un autre fond

**Principe [S]** : CIECAM02 et CAM16 prennent la luminance relative du fond Yb en entrée, via n = Yb/Yw.
- z = 1,48 + √n pilote l'exposant de J.
- N_bb = N_cb = 0,725·n^−0,2 est le facteur d'induction du fond.
- La chroma vaut C = t^0,9·√(J/100)·(1,64 − 0,29^n)^0,73.

On peut donc calculer, pour une couleur vue sur blanc, le stimulus qui a les **mêmes J, C, h** sur un fond sombre : c'est une « couleur correspondante ».

**Calcul [C]** (`cam16bg.py`)
- Paramètres : CAM16 standard, D65, entourage moyen. Clair sur Yb = 100 (blanc), sombre sur le Yb du fond. La luminance sombre est imposée par le miroir WCAG de Hueladder.
- On cherche la chroma OKLCH qui garde la chroma CAM16 C (ou M, qui donne le même résultat).
- Résultat à 4,5:1, en rapport chroma sombre / chroma claire :

| Fond | Yb (%) | h 30 (rouge) | h 145 (vert) | h 260 (bleu) | h 300 (violet) |
|---|---|---|---|---|---|
| #010101 | 0,03 | 0,36 | 0,28 | 0,22 | 0,25 |
| #0a0a0a | 0,30 | 0,55 | 0,46 | 0,38 | 0,41 |
| **#121212** | 0,61 | **0,62** | **0,53** | **0,45** | **0,48** |
| #1f1f1f | 1,37 | 0,72 | 0,63 | 0,55 | 0,58 |
| #262626 | 1,94 | 0,76 | 0,67 | 0,60 | 0,63 |
| #333333 | 3,31 | 0,83 | 0,75 | 0,68 | 0,71 |
| #666666 | 13,3 | 1,01 | 0,95 | 0,87 | 0,91 |

- Contre-épreuve : avec le même Yb = 20 des deux côtés, le rapport vaut environ 1,00. **Tout l'effet vient du fond**, et non du changement de luminance de la couleur.
- La saturation CAM16 s ne peut souvent pas être conservée du tout (hors gamut).

**Lecture [I]**
- Le modèle va **dans le même sens** que Material 2 et que Kim et al. 2026 : plus le fond est sombre, plus il faut retirer de chroma.
- Mais l'amplitude est **extrapolée** : n ≈ 0,006, et le facteur N_bb diverge quand Yb tend vers 0, ce qui rend le noir pur incalculable.
- **[S]** CAM16 ne modélise pas l'effet Helmholtz–Kohlrausch (Hellwig & Fairchild 2022).
- **[S]** Pei, Farnand et Fairchild (2025) écrivent que les modèles d'apparence actuels « are inadequate in fully capturing » le contraste simultané, et proposent une extension de CIECAM16.
- **[C]** Les systèmes livrés, eux, restent à 90–100 % du gamut.

**Sources**
- https://en.wikipedia.org/wiki/CIECAM02
- Li et al. 2017, « Comprehensive color solutions: CAM16, CAT16, and CAM16-UCS », *Color Res. Appl.*
- https://onlinelibrary.wiley.com/doi/10.1002/col.22793 (Hellwig & Fairchild 2022, HK)
- https://onlinelibrary.wiley.com/doi/abs/10.1002/col.22980 (Pei et al. 2025)

**Forces** : c'est la seule approche qui **calcule** une désaturation dépendant du fond à partir d'un modèle publié. Elle répondrait exactement à « pourquoi et de combien ».

**Limites**
- Elle est hors du domaine validé et très sensible à Yb.
- Aucun système en production ne l'utilise, à ma connaissance.

### 1.14 Données empiriques : Kim, Lee et Suk (KAIST), *PLoS One* 2026

**Principe [S]**
- 31 designers ont ajusté 18 logos sur **fond noir**, dans une pièce à moins de 1 lx, en HSB (Figma), pour garder l'identité tout en optimisant visibilité et confort.
- La validation porte sur 89 observateurs.

**Résultats [S]**
- Les couleurs claires perdent en moyenne 7,74 de L*, les sombres en gagnent 11,65.
- La réduction de C* est **d'autant plus forte que la chroma initiale est élevée** (ρ = −0,88).
- La teinte reste stable, à moins de 4° près, sauf pour le rouge et le bleu.
- Conclusion des auteurs : « adjusted colors for the dark mode became more grayish and less saturated. »
- Le modèle est une surface de convergence par krigeage dans CIELAB. Il n'utilise pas CAM16 et ne donne pas de pourcentage moyen de réduction de chroma dans le texte lu.

**Source** : https://pmc.ncbi.nlm.nih.gov/articles/PMC12822999/

**Portée [I]**
- Il s'agit de logos (aplats de marque) sur noir pur, dans l'obscurité : c'est le cas le plus favorable à la désaturation.
- Ce n'est pas une garantie d'accessibilité, mais c'est la seule mesure humaine directe trouvée.

---

## 2. La désaturation est-elle justifiée ?

### Les effets perceptifs

- **Helmholtz–Kohlrausch [S]** : à luminance égale, une couleur saturée paraît plus lumineuse qu'un gris. L'effet est plus marqué en environnement sombre. CIECAM02 et CAM16 ne le prédisent pas, et des extensions existent (Hellwig & Fairchild 2022).
  - https://en.wikipedia.org/wiki/Helmholtz%E2%80%93Kohlrausch_effect
  - https://onlinelibrary.wiley.com/doi/10.1002/col.22793
- **Effet Hunt [S]** : la colorfulness augmente avec la luminance d'adaptation. En mode sombre, l'adaptation globale baisse, ce qui va plutôt dans le sens inverse. Apple dit pourtant que « in dark environments, colors appear bright and saturated ».
  - **[I]** Ce qui domine en pratique, c'est le **contraste simultané** (fond sombre ⇒ la couleur paraît plus claire et plus colorée) et l'effet H-K, pas l'effet Hunt.
- **Contraste simultané [S]** : c'est la raison invoquée par Spectrum, et c'est ce que CAM16 tente de modéliser via N_bb et z (imparfaitement selon Pei et al. 2025).
- **« Vibration » [S, faible]** : Material 2 l'affirme sans citer d'étude. Le phénomène apparenté documenté est la chromostéréopsis : rouge et bleu saturés côte à côte.
- **Halation, irradiation, astigmatisme [S, niveau de preuve modéré]**
  - Le texte clair sur fond sombre « bave » optiquement, et c'est plus prononcé en cas d'astigmatisme.
  - Prévalence de l'astigmatisme : **40,4 % des adultes** et 14,9 % des enfants (méta-analyse de Hashemi et al., *J. Curr. Ophthalmol.* 2018 : https://pubmed.ncbi.nlm.nih.gov/29564404/).
  - La polarité positive (sombre sur clair) donne de meilleures performances de lecture, surtout en petit corps (Piepenbrock et al. 2013 et Buchner et al., résumés par NN/g : https://www.nngroup.com/articles/dark-mode/).
  - **[I]** La halation concerne surtout la **luminance** du texte clair (blanc pur). C'est un argument pour plafonner le cran le plus clair (blanc à 87 % chez Material 2, Lc 85–90 chez Somers) plus que pour désaturer.

### Existe-t-il des valeurs sourcées ?

- **Aucune valeur de désaturation en % dans une source primaire.** Material 2 dit « tons 200–50 ». Leonardo expose `saturation` avec 100 % par défaut. Atlassian désature les « subtle backgrounds » sans chiffre.
- Les « 20–40 % » ou « 20 points de saturation » viennent de blogs (atmos.style, Medium). Ce ne sont pas des sources.
- **[C] Les données de production** (16 paires) : pour les accents et le texte, la chroma sombre est à 90–100 % du maximum tenable. La baisse apparente est **due au gamut**. Pour les fonds teintés sombres (Radix 3–8), la chroma absolue **augmente** par rapport au clair, avec une occupation de 65 à 100 %.
- **[S+C] Modèle** : CAM16 prédit 45 à 62 % de chroma conservée sur #121212, mais par extrapolation.

**Conclusion [I]**
- La désaturation est **qualitativement justifiée** : H-K, contraste simultané, données de Kim et al., consensus de Material.
- Elle n'est **pas quantifiée par une norme**.
- La plus grosse part de la désaturation « que l'on voit » dans les systèmes réels est un **effet mécanique du gamut** quand on éclaircit.
- Une réduction supplémentaire fixe de 20 % n'est pas ce que font Apple, Primer, Carbon, Spectrum ou Radix sur leurs accents.

---

## 3. Le fond

### Pourquoi le fond change toutes les couleurs dans une méthode par contraste relatif [C]

WCAG : ratio = (Y₁ + 0,05)/(Y₂ + 0,05). Si le cran i doit tenir le ratio C_i face au fond, alors Y_i = C_i·(Y_fond + 0,05) − 0,05. Toute la rampe est donc **proportionnelle** (en Y + 0,05) à Y_fond + 0,05.

| Fond | Y_fond + 0,05 | Budget max (1,05 / …) |
|---|---|---|
| #000 | 0,0500 | 21:1 |
| #121212 | 0,0560 | 18,7:1 |
| #1f1f1f | 0,0637 | 16,5:1 |
| #262626 | 0,0694 | 15,1:1 |
| #292929 | 0,0718 | 14,6:1 |

- Éclaircir le fond de #121212 à #262626 éclaircit **chaque** cran de 24 % en (Y + 0,05). Sinon, aucun cran ne tiendrait plus son contraste.
- Les contrastes **entre crans** ne bougent pas : C_b/C_a dans les deux modes.
- Le fond ne change donc pas la **structure**. Il change le **calage absolu** et le **plafond**.

### Ce que recommandent les systèmes [S]

| Système | Fond sombre |
|---|---|
| Material 2 | #121212 (plancher de 15,8:1 avec le blanc) |
| Material 3 | ton 6, ou 4 dans la spec 2025 |
| Carbon | #262626 (g90) et #161616 (g100) |
| Spectrum 2 | #111111, avec un thème « darkest » aligné sur le noir des OS |
| Primer | #0d1117 |
| Fluent | #292929 / #1f1f1f |
| Radix | #111111 (gray1) ou teinté (blue1 #0d1520) |
| Apple | #000 en base, #1c1c1e en elevated |

Consensus : **Y_fond entre 0,4 % et 2,3 %**, en gris légèrement teinté ou neutre.

### Pourquoi pas le noir pur

- **[S]** Material : visibilité des ombres, fatigue moindre pour le texte clair, et marge pour les surcouches d'élévation.
- **[S, faible]** « Smearing » OLED : les pixels éteints mettent du temps à se rallumer, ce qui crée des traînées au défilement. C'est surtout documenté par des retours d'utilisateurs, pas par un fabricant.
- **[I]** L'élévation se fait par éclaircissement : il faut que le fond ait de la marge au-dessus du noir.
- **[C]** CAM16 diverge à Yb = 0, un argument de modèle de plus contre le noir absolu.

---

## 4. WCAG 2 contre APCA en sombre

**WCAG 2 [C]** : la formule est symétrique et **multiplicative**. Le miroir de cran conserve donc exactement tous les ratios entre crans, ce qui est la propriété la plus précieuse pour une garantie écrite dans le nom.

**APCA [S+C]**
- Il n'est ni symétrique ni composable.
- La polarité en elle-même pèse peu : #777 sur #fff vaut Lc 71,1, et #fff sur #777 vaut Lc −76,6.
- **Ce qui pèse, c'est le niveau de luminance** : APCA considère que les différences entre couleurs sombres valent beaucoup moins.

Gris en miroir WCAG, clair sur blanc et sombre sur #121212 :

| Ratio WCAG | Lc clair | Lc miroir sombre | Ratio WCAG nécessaire en sombre pour le même \|Lc\| |
|---|---|---|---|
| 1,5 | 23,3 | 0 (sous le seuil) | 3,39 |
| 3 | 56,6 | −20,0 | 8,21 |
| 4,5 | 71,1 | −32,3 | 10,9 |
| 7 | 84,3 | −49,2 | 13,6 |

Sur #000, il faut respectivement 3,68, 9,09, 12,1 et 15,1.

**Implications [I]**
1. En WCAG pur, le miroir de cran est **correct et conforme**. Mais les crans sombres de 100 à 400 paraîtront plus « plats » que leurs équivalents clairs. C'est exactement ce que Spectrum a constaté.
2. Un miroir APCA (même |Lc| face au fond) donne des crans sombres bien plus espacés en bas de rampe. Il **consomme le budget** plus vite, car les crans de texte saturent vers le blanc. Il reste conforme WCAG, puisque les ratios obtenus sont plus élevés, mais **les garanties « N rangs ⇒ AA » ne sont plus exactes par construction** : il faut les revérifier.
3. Les systèmes réels se situent **entre les deux** :
   - Spectrum 2 : ×1,05 à ×1,12 sur le ratio WCAG.
   - Primer et Carbon : ×1,2 à ×1,5 sur les liens.
   - Radix : ×1,8 sur le texte.

---

## 5. Recommandation pour Hueladder [I]

### Méthode par défaut : `mirror-wcag` (l'actuelle), avec la désaturation par défaut à 0 %

- **Luminance** : on garde Y_sombre,i = C_i·(Y_fond + 0,05) − 0,05. C'est la seule méthode qui transporte **exactement** la promesse du nom (N rangs ⇒ AA), et c'est la logique de Leonardo, première méthode documentée « par contraste contre le fond ».
- **Chroma** : « alignée », c'est-à-dire la chroma OKLCH du clair plafonnée à 96 % du gamut. Les accents et le texte gardent l'intensité de la marque, et le gamut fait automatiquement la « désaturation » des crans clairs sombres, comme chez tous les systèmes mesurés.
- **Désaturation** : **0 % par défaut** au lieu de 20 %. Aucune source primaire ne justifie 20 %, et les systèmes de référence ne le font pas.
- On la garde comme curseur nommé « atténuation », 0–40 %, avec une explication en une phrase : « compense l'effet Helmholtz–Kohlrausch et le contraste simultané ; Material 2 et Kim et al. 2026 vont dans ce sens, sans valeur normative ».
- **Si l'on tient à un défaut non nul**, mieux vaut le **cibler** que le rendre uniforme :
  - l'appliquer aux crans « surface » (50–300 sombres, les fonds teintés, là où Atlassian désature) ;
  - et rester à 0 % sur les crans d'accent et de texte (500–950) ;
  - c'est cohérent avec le profil en cloche déjà présent.
- **Fond par défaut : #121212.**
  - C'est la seule valeur accompagnée d'une justification publiée (Material 2 : 15,8:1).
  - Elle est au centre du consensus (#0d–#1f).
  - Budget de 18,7:1.
  - Afficher en permanence : « le fond fixe le budget 1,05/(Y_fond + 0,05) et décale toute la rampe ; les écarts entre crans ne changent pas ».

### Alternatives comparables, comme pour le clair

| Clé | Rend constant | Garantie dans le nom | Source |
|---|---|---|---|
| `mirror-wcag` (défaut) | le ratio WCAG face au fond, par cran | **exacte** | Leonardo, Hueladder |
| `mirror-apca` | le \|Lc\| APCA face au fond, par cran de texte (plafond Lc 90 : non implémenté, en feuille de route) | à revérifier (plus fort en WCAG) | Radix, Somers |
| `budget-share` | la part log du contraste disponible | **affaiblie** (4,5 → 4,25 sur #121212) | Spectrum |
| `tone-flip` (HCT) | le ton L*, T_sombre = 100 − T_clair, même chroma de palette | par écarts de ton (40 ⇒ 3:1, 50 ⇒ 4,5:1) | Material 3 |
| `index-flip` | réutilise les crans clairs, i ↔ n−1−i | aucune | Tailwind, Atlassian |
| `cam16-compensated` (expérimental, non implémenté) | luminance de `mirror-wcag`, chroma qui conserve la chroma CAM16 avec le Yb réel | celle du miroir | CAM16 (Li 2017), calcul dans ce rapport |
| `drawn` (témoin, non implémenté) | échelles sombres Radix ou Primer | aucune | Radix, Primer |

### Paramètres à exposer

| Paramètre | Défaut | Pourquoi |
|---|---|---|
| Fond sombre | #121212 | Material 2, consensus des systèmes |
| Norme de contraste | WCAG 2 | normative ; APCA en option |
| Atténuation de chroma | 0 % (0–40 %) | pas de valeur sourcée ; les systèmes de production n'en appliquent pas sur les accents |
| Profil de chroma | aligné ; cloche en option | Radix : fonds teintés sombres plus chromatiques |
| Plafond de gamut | 96 % | déjà en place, marge d'arrondi |
| Plafond du cran le plus clair | aucun ; option Lc −90 ou environ 14:1 | halation (Somers) ; texte blanc à 87 % chez Material 2 |

### Ce qu'il faudrait mesurer avant de choisir un autre défaut

- Faire tourner les 7 variantes sur les marques de test.
- Mesurer pour chacune : le respect des garanties, l'occupation du gamut, et l'écart APCA clair/sombre par cran.
- Idéalement, organiser un petit test perceptif de préférence, sur le modèle de Kim et al.

---

## Sources (récapitulatif)

**Material**
- https://m2.material.io/design/color/dark-theme.html
- https://codelabs.developers.google.com/codelabs/design-material-darktheme
- https://github.com/material-components/material-components-android/blob/master/docs/theming/Dark.md
- https://github.com/material-components/material-components-android/blob/master/lib/java/com/google/android/material/elevation/ElevationOverlayProvider.java
- https://m3.material.io/styles/color/roles
- https://github.com/material-foundation/material-color-utilities (`typescript/dynamiccolor/color_spec_2021.ts`, `color_spec_2025.ts`, `concepts/contrast_for_accessibility.md`)

**Adobe (Leonardo, Spectrum)**
- https://github.com/adobe/leonardo/blob/main/packages/contrast-colors/README.md
- https://github.com/adobe/leonardo (`lib/theme.js`, `lib/color.js`)
- https://adobe.design/stories/design-for-scale/reinventing-adobe-spectrum-s-colors
- https://uxdesign.cc/creating-contrast-based-themes-with-leonardo-32b6219a090f
- https://github.com/adobe/spectrum-design-data/blob/main/packages/tokens/src/color-palette.json

**Radix**
- https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- https://www.radix-ui.com/colors/docs/overview/custom-palettes
- https://github.com/radix-ui/website/blob/main/components/generate-radix-colors.tsx

**Carbon**
- https://carbondesignsystem.com/elements/color/overview/
- https://github.com/carbon-design-system/carbon/tree/main/packages/themes/tokens

**Apple**
- https://developer.apple.com/design/human-interface-guidelines/dark-mode
- https://developer.apple.com/design/human-interface-guidelines/color

**Atlassian**
- https://atlassian.design/foundations/color/color-palette
- https://community.developer.atlassian.com/t/introducing-design-tokens-new-colour-foundations-and-dark-mode/62258

**Primer**
- https://github.com/primer/primitives/tree/main/src/tokens/base/color
- https://github.com/primer/primitives/blob/main/src/tokens/functional/color/fgColor.json5

**Tailwind**
- https://tailwindcss.com/docs/dark-mode

**Fluent**
- https://github.com/microsoft/fluentui/tree/master/packages/tokens/src/alias
- https://fluent2.microsoft.design/color

**APCA**
- https://github.com/Myndex/SAPC-APCA/discussions/74
- https://github.com/Myndex/SAPC-APCA/discussions/86
- https://git.apcacontrast.com/documentation/README.html

**Modèles d'apparence**
- https://en.wikipedia.org/wiki/CIECAM02
- Li et al. 2017 (CAM16)
- https://onlinelibrary.wiley.com/doi/10.1002/col.22793
- https://onlinelibrary.wiley.com/doi/abs/10.1002/col.22980

**Perception et lecture**
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12822999/ (Kim, Lee, Suk 2026)
- https://en.wikipedia.org/wiki/Helmholtz%E2%80%93Kohlrausch_effect
- https://www.nngroup.com/articles/dark-mode/
- https://pubmed.ncbi.nlm.nih.gov/29564404/
