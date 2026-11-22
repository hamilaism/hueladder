# Benchmark des générateurs d'échelles de couleur, et formats de livraison pour Hueladder

Recherche web faite le 1er octobre 2026. Légende : **[S]** = affirmation sourcée (URL donnée dans la ligne ou la section). **[I]** = inférence de ma part (déduction, souvenir non revérifié ou lecture d'une page incomplète). Quand une page ne disait rien sur un point, j'écris « non documenté ». Ça ne veut pas dire que la fonction n'existe pas.

Le plugin parfois appelé « Subpalette » s'appelle **Supa Palette** (Angelo Libero, https://www.supa-palette.com/) [S].

---

## 1. Fiches outils

### 1.1 Supa Palette (plugin Figma)
- **Qui / URL** : Angelo Libero, product designer. https://www.supa-palette.com/ , https://www.producthunt.com/products/supa-palette-figma-plugin [S]
- **Modèle** : payant, achat unique (Personal 59 $, Team 139 $, Business 279 $ avant remise), essai d'une semaine. Code fermé [S].
- **Espace / algorithme** : 5 espaces d'interpolation, dont LCH et OKLCH. Un « Easing Editor » donne des courbes de clarté et de saturation. Un « color shift » fait varier teinte, saturation et clarté sur la rampe [S]. Une ancienne version annonçait 8 modes (RGB, LRGB, HSL, HSV, HSI, LAB, OKLAB, LCH) [S].
- **Crans** : nombre, padding et noms réglables [S]. Le détail des nomenclatures n'est pas documenté.
- **Contraste** : grille et table de contraste, « smart contrast suggestions », choix APCA ou WCAG 2.1 [S]. Aucune garantie portée par le nom [I].
- **Mode sombre** : « theme-compatible palettes » pour clair et sombre [S]. La méthode de dérivation n'est pas documentée.
- **Import** : 14 systèmes intégrés (Tailwind, Material, Radix, Chakra, Bootstrap, Untitled UI, Ant…), génération depuis une couleur, un style local ou la sélection [S].
- **Édition** : forte (courbes, couleurs, noms) [S].
- **Exports** : variables Figma, « Figma Tokens » (Tokens Studio), Chakra UI, Material UI, Tailwind [S].
- **Intégration** : plugin Figma uniquement.
- **Ce qui le distingue** : gestionnaire de palettes et de variables dans Figma, planches de documentation générées (Blocks, Tiles, Cards, Circles), tokens sémantiques générés par IA (bêta, OpenAI) [S].

### 1.2 UI Colors (uicolors.app)
- **Qui / URL** : Erik de Vries. https://uicolors.app/ , https://uicolors.app/upgrade [S]
- **Modèle** : freemium. Pro à 4,95 $/mois ou 30 $/an [S]. Code fermé.
- **Espace / algorithme** : algorithme propriétaire calé sur l'allure des échelles Tailwind (teinte 500 et décalage de teinte) [I]. Réglage HSL par crans en Pro [S].
- **Crans** : 50 à 950, nomenclature Tailwind [S/I].
- **Contraste** : matrice de contraste et réglage « APCA setting » en Pro [S]. Le site renvoie aussi à sitecontrast.com [S].
- **Mode sombre** : aperçus de composants en sombre [S]. Pas de dérivation d'échelle sombre documentée.
- **Import** : couleur de base. L'option Pro « lock input color to specific shade » permet de fixer la couleur saisie sur un cran précis [S].
- **Exports** : Tailwind (OKLCH pour la v4) [S], HEX/HSL/OKLCH/RGB (Pro) [S], thème shadcn/ui [S]. Le plugin Figma exporte en variables (Pro) [S].
- **Intégrations** : plugin Figma, API [S].
- **Ce qui le distingue** : aperçus en contexte (cartes, dashboards, sites, logos, graphiques, thème shadcn) et palette complète primaire, secondaire et statuts [S].

### 1.3 Accessible Palette (accessiblepalette.com)
- **Qui / URL** : Eugene Fedorenko (https://efedorenko.com/), https://accessiblepalette.com/ [S]
- **Modèle** : gratuit [I], code fermé [I].
- **Espace / algorithme** : CIELAB/LCh via chroma.js. Clarté identique entre teintes à chaque niveau, calcul en RGB ou CIELAB [S].
- **Crans** : 10 niveaux, de 50 à 900 [S].
- **Contraste** : WCAG 2.1 et « WCAG 3.0 » (APCA). Un clic sur une pastille la prend comme fond de référence [S]. Pas de règle portée par le nom [S].
- **Mode sombre** : non documenté.
- **Import** : on colle ses couleurs de marque [S].
- **Édition** : chroma, teinte, clarté, décalage de teinte le long de la rampe [S].
- **Exports** : pas de format code documenté. Le site évoque la sauvegarde dans des bibliothèques Figma [S].
- **Ce qui le distingue** : chaque palette a une URL unique, ce qui sert au partage et au versionnage [S]. C'est le premier outil grand public à aligner la clarté entre teintes.

### 1.4 InclusiveColors (inclusivecolors.com)
- **Qui / URL** : Sean Wilson (seanw.org). https://www.inclusivecolors.com/ [S]
- **Modèle** : gratuit (bêta). Aucune licence open source affichée [S].
- **Espace / algorithme** : sélecteur HSLuv. Changer teinte ou saturation ne change pas la luminance, donc le contraste WCAG reste le même [S]. **Aucune couleur générée automatiquement** : tout se fait à la main avec des courbes T/S/L [S].
- **Crans** : à la façon Tailwind, nombre libre [S/I].
- **Contraste** : WCAG 2 et APCA au choix. On déclare quelles paires doivent contraster et le résultat s'affiche en direct [S]. Le site signale que WCAG 2 donne des faux positifs en sombre [S].
- **Mode sombre** : pas de dérivation, seulement l'avertissement APCA [S].
- **Import** : non documenté [S].
- **Exports** : Tailwind `.config.js`, CSS variables, DTCG, Adobe `.ase`, SVG/PNG. Pour Figma, l'outil exporte en DTCG puis passe par un plugin d'import tiers [S].
- **Ce qui le distingue** : on prévoit les paires texte/fond qui doivent passer, puis on règle chaque cran à la main sous ce contrôle.

### 1.5 Adobe Leonardo
- **Qui / URL** : Nate Baldwin (Adobe Spectrum). https://leonardocolor.io/ , https://github.com/adobe/leonardo , npm `@adobe/leonardo-contrast-colors` [S]
- **Modèle** : open source, Apache 2.0 [S].
- **Espace / algorithme** : on donne des couleurs clés, Leonardo interpole (LCH, LAB, CAM02, HSL, HSLuv, HSV, RGB, lissage bézier en option), puis cherche la couleur qui atteint **un ratio de contraste cible** contre un fond [S].
- **Crans** : définis par des ratios. Les noms sont auto-numérotés (`color100`, `color200`…) ou fournis par une clé d'objet [S]. Le nom porte donc le contraste par rapport au fond.
- **Contraste** : `formula: 'wcag2' | 'wcag3'` (APCA) [S]. Contraste garanti par construction contre le fond.
- **Mode sombre** : le paramètre `lightness` du thème déplace le fond, et toutes les couleurs sont recalculées pour garder les mêmes ratios [S]. Il y a aussi des multiplicateurs `contrast` et `saturation` [S]. C'est le modèle de thème « adaptatif ».
- **Import** : couleurs clés. Pas d'audit d'une palette existante [I].
- **Exports** : paramètres JS, variables CSS, design tokens « W3C working spec », kit d'UI en SVG, URL partageable [S].
- **Intégrations** : librairie JS. Un serveur `@adobe/leonardo-mcp` existe sur npm pour les agents IA [S, extrait de recherche, page npm inaccessible].
- **Ce qui le distingue** : génération par ratio cible, thème adaptatif (fond, contraste global), simulation des daltonismes, ΔE minimal entre couleurs [S].

### 1.6 Radix Colors, générateur de palette personnalisée
- **Qui / URL** : WorkOS/Radix. https://www.radix-ui.com/colors/custom , doc https://www.radix-ui.com/colors/docs/overview/custom-palettes [S]
- **Modèle** : gratuit, open source (dépôt du site Radix) [S/I].
- **Espace / algorithme** : on part de la couleur d'accent, on trouve l'échelle Radix la plus proche, puis on transpose l'écart sur le reste de la palette [S, d'après la description du clone https://github.com/maxschulmeister/radix-custom-color]. Le code officiel travaille en OKLCH [I].
- **Crans** : 12 étapes **par rôle d'usage** (1–2 fonds, 3–5 composants, 6–8 bordures, 9–10 aplats, 11–12 texte), plus les variantes alpha [S].
- **Contraste** : « contrast ratios will be similar to what Radix Colors provide » [S]. C'est une garantie d'usage, pas un calcul déclaré par cran.
- **Mode sombre** : échelles claire et sombre générées ensemble [S].
- **Import** : trois entrées seulement : accent, gris et fond [S].
- **Exports** : CSS à coller, sRGB plus P3 (wide gamut), alpha, couleurs Radix Themes (surface, indicator, track) [S].
- **Ce qui le distingue** : alpha et P3 calculés pour le fond choisi, sémantique d'usage par numéro de cran.

### 1.7 Huetone
- **Qui / URL** : Alexey Ardov. https://huetone.ardov.me/ , https://github.com/ardov/huetone , licence MIT [S]
- **Espace / algorithme** : édition **manuelle** sur des graphes L, C et H (CIELAB/LCH) d'une grille teintes × crans [S].
- **Crans** : grille libre, noms libres [S/I].
- **Contraste** : APCA (et WCAG) affiché en direct [S].
- **Mode sombre** : non documenté.
- **Import/Export** : JSON et tokens, plugin Figma [S].
- **Ce qui le distingue** : une vue « graphes » où chaque courbe montre la palette entière d'un coup, plus des raccourcis clavier. Il s'inspire de l'article de Stripe de 2019 [S].

### 1.8 ColorBox (Lyft)
- **Qui / URL** : Kevyn Arnott (Lyft). https://colorbox.io/ , algorithme https://github.com/lyft/coloralgorithm (Apache 2.0) [S]
- **Espace / algorithme** : HSV. Courbes d'easing séparées pour teinte, saturation et luminosité (26 fonctions), sens de rotation de teinte [S]. Vue OKLCH ajoutée [S].
- **Crans** : nombre réglable [S].
- **Contraste** : badges 3:1 et 4,5:1 contre le blanc [S].
- **Édition** : verrouillage de couleurs (« lock ») dans l'app [S].
- **Exports** : Tailwind CSS, OKLCH, Swift [S]. Un plugin Figma existe [S].
- **Ce qui le distingue** : contrôle fin par courbes d'easing. Il a servi pour Lyft Spectrum.

### 1.9 tints.dev
- **Qui / URL** : Simeon Griggs. https://tints.dev/ , https://github.com/SimeonGriggs/tints.dev (≈1,3 k étoiles) [S]
- **Modèle** : gratuit. Le dépôt est public mais la licence est à documenter selon son propre TODO [S].
- **Algorithme** : on place la valeur hex sur un cran, puis on règle décalage de teinte, de saturation, et clarté min et max. Mode de clarté « linéaire » ou « perçue » [S].
- **Crans** : 11, de 50 à 950 [S].
- **Contraste** : non mis en avant.
- **Exports** : Tailwind v3 et v4, en hex, HSL, OKLCH ou P3, et variables CSS [S]. API qui renvoie une palette 50–950 depuis un hex [S].
- **Ce qui le distingue** : API simple, palette multi-couleurs partageable par URL [S/I].

### 1.10 Material Theme Builder (Google)
- **Qui / URL** : Google Material. https://m3.material.io/theme-builder , plugin Figma, https://github.com/material-foundation/material-theme-builder (dépôt **archivé le 23/07/2026**) [S]
- **Espace / algorithme** : HCT (CAM16 et L*). Une couleur source donne 5 couleurs clés, chacune donne une palette tonale de 0 à 100, et des tons précis sont affectés à des **rôles** (primary, on-primary, container, surface…) [S].
- **Crans** : tons 0–100 (13 tons standard plus les tons de surface) [S/I]. Le numéro de ton est la luminance L*, ce qui donne un contraste prévisible : un écart de 40 tons vaut ≥ 3:1 et un écart de 50 tons vaut ≥ 4,5:1 [I, règle connue de la doc M3].
- **Contraste** : niveaux de contraste standard, moyen et élevé [S].
- **Mode sombre** : natif, schémas clair et sombre [S].
- **Import** : couleur, image ou papier peint, import JSON [S].
- **Exports** : DSP, Jetpack Compose, Android Views, Web/CSS, variables Figma, JSON [S].
- **Ce qui le distingue** : couche de rôles sémantiques complète et niveaux de contraste multiples.

### 1.11 Atmos (atmos.style)
- **Qui / URL** : https://atmos.style/ [S]
- **Modèle** : freemium, détail des offres non documenté [S]. Fermé.
- **Espace / algorithme** : LCH et OKLCH, courbes d'easing, transitions de teinte, gamut sRGB ou P3 [S]. Génère marque, sémantiques (statuts) et neutres [S].
- **Contraste** : WCAG 2 et APCA, simulateur de daltonisme [S].
- **Mode sombre** : non documenté [I].
- **Import** : HEX, RGB et HSL extraits de CSS, de design tokens, de JSON ou de **tout texte**. Les noms sont conservés quand on réimporte un export Atmos [S] (https://atmos.style/docs/color-import).
- **Exports** : SVG nommé, CSS, JS, JSON, Tailwind, Style Dictionary, DTCG, raw. Formats de couleur HEX, HSL, RGB, CMYK, LCH ou OKLCH [S] (https://atmos.style/docs/export).
- **Intégrations** : plugin Figma de synchronisation [S].
- **Ce qui le distingue** : outil collaboratif avec historique de versions [S].

### 1.12 Palettte App (devenu BairesDev Color Palette App)
- **Qui / URL** : Gabriel Adorf (https://gabrieladorf.com/palettteapp/). palettte.app redirige maintenant vers https://www.bairesdev.com/tools/color-palette-app/ [S]
- **Modèle** : gratuit [S].
- **Algorithme** : courbes T/S/V éditables par poignées, interpolation entre deux poignées [S].
- **Import** : JSON en lot ou couleur par couleur [S].
- **Contraste** : contrôle contre un texte clair et un texte foncé [S].
- **Exports** : JSON, CSS, hex [S].
- **Ce qui le distingue** : **mode « legacy »**. L'outil associe automatiquement les anciennes couleurs du code aux plus proches de la nouvelle palette [S]. C'est l'idée la plus proche de la table de migration de Hueladder.

### 1.13 Scale (hihayk)
- **Qui / URL** : Hayk An. https://hihayk.github.io/scale/ , https://github.com/hihayk/scale (≈1,7 k étoiles) [S]
- **Algorithme** : depuis une couleur, on règle le nombre de tons clairs et foncés, le % de clarté et d'obscurité, l'angle de teinte et la saturation des extrémités [S]. Mélange en RGB/HSL [I].
- **Contraste / sombre / exports** : rien d'avancé. Aperçu sur plusieurs fonds et liste des hex [I].
- **Ce qui le distingue** : simplicité, outil historique (2018).

### 1.14 Colorffy
- **URL** : https://colorffy.com/ (shades/CSS generator, dark-theme generator) [S]
- **Algorithme** : mélange en Oklab, avec P3 et repli sRGB automatique [S].
- **Exports** : CSS, SCSS, Tailwind v3 (`.js`) et v4 (`.css`), PNG, PDF [S]. Un générateur de thème sombre séparé existe [S].
- **Ce qui le distingue** : générateur gratuit grand public, sans garantie de contraste [I].

### 1.15 Outils récents pertinents (2024–2026)
- **Harmonizer (Evil Martians, 2025)** : https://github.com/evilmartians/harmonizer , web et plugin Figma [S]. OKLCH plus APCA (WCAG en option). On définit des **niveaux** (clarté et contraste par niveau), des teintes nommées et un fond. Le résultat a une chroma constante entre teintes et un **contraste identique à niveau égal**, donc les teintes sont interchangeables. P3 ou sRGB. Le **sombre est obtenu par miroir** des niveaux [S]. Exports Tailwind, variables CSS, JSON et variables Figma, configuration partageable [S]. *C'est le concurrent le plus proche de Hueladder sur le fond.*
- **Reasonable Colors (Matthew Howell)** : https://www.reasonable.work/colors/ , MIT [S]. 24 teintes × 6 crans en LCH. **Règle dans le nom : un écart de 2 crans vaut ≥ 3:1, 3 crans ≥ 4,5:1, 4 crans ≥ 7:1, valable entre toutes les teintes, gris compris** [S]. C'est un système figé, pas un générateur. C'est l'antécédent public le plus direct de la règle de nom de Hueladder.
- **Ultimate Tokens (Kim Granlund)** : https://github.com/kimgranlund/ultimate-tokens , MIT [S]. Rampes HCT/OKHSL de 050 à 950, 53 rôles sémantiques clair et sombre. Exports CSS, Tailwind v4, shadcn, Panda, Radix, variables Figma, DTCG. **Serveur MCP « Brand-Kit » pour agents IA** [S].
- **Plugins Figma OKLCH 2025–26** : « OKLCH Color Scale » sort une collection de variables avec les modes Light et Dark en une passe [S, extrait de la fiche Figma]. « OKLCH Palette Generator » affiche des badges WCAG/APCA en direct [S]. Autres : PencilColor (https://www.pencilcolor.com/), RatioDS (https://ratiods.vercel.app/) [S].
- **Référence de système, pas un outil** : le « magic number » de l'USWDS (grades 0–100, un écart de 50 vaut AA) est de la même famille que la règle de nom de Hueladder [I, non revérifié ici].

---

## 2. Matrice de fonctionnalités

Légende : ● oui · ◐ partiel · ○ non ou non documenté. Plusieurs cases ○ veulent dire « non documenté ».

| Outil | Open source | Espace perceptuel | Contraste cible (génération) | WCAG2 | APCA | Règle de contraste dans le nom | Teintes interchangeables | Mode sombre dérivé | Import / audit d'existant | Édition manuelle | Plusieurs nomenclatures | DTCG | Var. Figma | Tokens Studio | Tailwind v4 | API/CLI/IA | Migration |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Hueladder** | ● | ● (OKLCH, HCT, CAM16) | ● | ● | ● | ● (vérifiée) | ● (diagnostic) | ● (5 méthodes) | ● (hex, CSS, TW, DTCG, TS) | ● (teinte/éclat verrouillés) | ● | ● | ◐ (via DTCG) | ◐ | ◐ [I] | ● CLI + skill | ● |
| Supa Palette | ○ | ● | ◐ (suggestions) | ● | ● | ○ | ○ | ◐ | ● (14 systèmes) | ● | ◐ | ○ | ● | ● | ● | ○ | ○ |
| UI Colors | ○ | ○ | ○ | ● | ◐ Pro | ○ | ○ | ○ | ○ | ● Pro | ○ | ○ | ● Pro | ○ | ● | ● API | ○ |
| Accessible Palette | ○ | ● LAB | ◐ (clarté alignée) | ● | ● | ○ | ● | ○ | ◐ (coller) | ● | ○ | ○ | ◐ | ○ | ○ | ○ | ○ |
| InclusiveColors | ○ | ● HSLuv | ○ (manuel) | ● | ● | ○ | ◐ | ○ | ○ | ●● | ○ | ● | ◐ (via DTCG) | ○ | ◐ v3 | ○ | ○ |
| Leonardo | ● | ● | ●● | ● | ● | ● (ratio = nom) | ● | ● (adaptatif) | ○ | ◐ | ◐ | ● | ○ | ○ | ○ | ● JS + MCP | ○ |
| Radix custom | ● | ● | ○ | ○ | ◐ | ◐ (rôle par n°) | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Huetone | ● | ● LCH | ○ | ● | ● | ○ | ◐ | ○ | ● JSON | ●● graphes | ○ | ◐ | ● plugin | ○ | ○ | ○ | ○ |
| ColorBox | ● (algo) | ○ HSV | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ● courbes, lock | ○ | ○ | ◐ | ○ | ◐ | ● JS | ○ |
| tints.dev | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | ○ | ● | ● API | ○ |
| Material TB | ◐ (archivé) | ● HCT | ◐ (tons L*) | ● | ○ | ◐ (tons) | ● | ●● rôles | ◐ JSON | ◐ | ○ | ◐ | ● | ○ | ○ | ● lib | ○ |
| Atmos | ○ | ● | ○ | ● | ● | ○ | ○ | ○ | ●● (tout texte) | ● | ○ | ● | ● plugin | ○ | ● | ○ | ○ |
| Palettte | ○ | ○ HSV | ○ | ◐ | ○ | ○ | ○ | ○ | ● JSON | ● courbes | ○ | ○ | ○ | ○ | ○ | ○ | ● legacy |
| Scale | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Colorffy | ○ | ● Oklab | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ◐ | ○ | ○ | ○ | ○ | ● | ○ | ○ |
| Harmonizer | ● | ● OKLCH | ● (par niveau) | ● | ●● | ◐ (niveau = contraste) | ●● | ● miroir | ○ | ● | ○ | ◐ JSON | ● | ○ | ● | ○ | ○ |
| Reasonable Colors | ● | ● LCH | figé | ● | ○ | ●● | ●● | ○ | ○ | ○ | ○ | ◐ JSON | ◐ | ○ | ● | ○ | ○ |
| Ultimate Tokens | ● | ● HCT | ◐ | ● | ? | ○ | ◐ | ● 53 rôles | ○ | ● | ○ | ● | ● | ○ | ● | ● MCP | ○ |

[I] Les cases ◐/○ de Hueladder sur Figma, Tokens Studio et Tailwind v4 viennent de l'examen du dépôt : `engine/build.mjs` écrit `<id>-core-colors[-dark].tokens.json`, le guide `.md` et la migration `.md`, et `engine/lib/outputs.mjs` émet `$value` en **chaîne hex**. Voir §3a : l'import natif de Figma exige un objet couleur.

### 2.1 Ce que Hueladder fait déjà mieux que tous les autres
1. **Audit d'une palette existante** (crans mal nommés, crans non interchangeables, doublons) : aucun concurrent ne diagnostique. Atmos et Supa importent seulement, Palettte associe des couleurs [S/I].
2. **Règle de contraste portée par le nom et vérifiée sur toutes les teintes, pour une palette générée** : Reasonable Colors le fait sur une palette figée, Leonardo et Harmonizer le font par niveau. Personne ne combine import, règle choisie, vérification et rapport [I].
3. **Comparaison de 10 méthodes côte à côte** : aucun outil ne montre plusieurs algorithmes en parallèle [I].
4. **Mode sombre jugé sous deux normes et avec plusieurs méthodes**, écarts annoncés : Harmonizer fait un miroir, Leonardo est adaptatif, Material passe par les tons. Aucun n'affiche les écarts [I].
5. **Table de migration, guide d'usage pour IA, skill pour agents, CLI** : seuls Leonardo (MCP) et Ultimate Tokens (MCP) jouent sur le terrain des agents [S].
6. **Open source avec moteur local** : seuls Leonardo, Harmonizer, Huetone et Ultimate Tokens sont comparables.

### 2.2 Ce qui manque à Hueladder, à répliquer ou améliorer (classé par valeur pour l'utilisateur)
1. **Paquet Figma importable nativement** (DTCG 2025.10 avec `$value` objet, un fichier par mode, alias de la collection sémantique vers la primitive). C'est le premier geste du designer après la génération. Inspirations : Harmonizer, UI Colors Pro, Supa Palette [S].
2. **Export Tailwind v4 `@theme` plus sombre via variables, et Tailwind v3** : c'est l'attente par défaut côté dev (UI Colors, tints.dev, Colorffy, Atmos) [S].
3. **Couche de rôles sémantiques clair/sombre** (bg, surface, border, text, text-muted, on-accent…) aliasée vers les crans. Material, Radix (rôles par n°) et Ultimate Tokens la donnent, et c'est ce qu'on branche dans les composants. Hueladder a déjà le guide d'usage, il faut en faire des tokens [S/I].
4. **Aperçus en contexte** (composants, carte, formulaire, graphiques en clair et en sombre) : c'est l'argument n° 1 d'UI Colors. Ça permet de juger « est-ce que ça marche » mieux qu'une grille [S].
5. **Lien partageable ou fichier de config réimportable** (état complet dans l'URL ou en JSON), comme Accessible Palette, Leonardo et Harmonizer : utile pour relire et versionner entre designer et dev [S].
6. **Paquet Tokens Studio** (`$themes.json` et `$metadata.json`, sets primitives, light, dark) pour les équipes déjà outillées [S].
7. **Sorties P3 et alpha** à la Radix (alpha calculés pour le fond, `color(display-p3 …)` avec repli sRGB). C'est apprécié sur Apple et pour les overlays [S].
8. **Fixer la couleur de marque sur un Hueladder choisi** (« lock input to shade », UI Colors, tints.dev, ColorBox) et vue « graphes L/C/H » de toute la grille (Huetone). À vérifier : le réglage verrouillé de Hueladder couvre peut-être déjà ce besoin [S/I].
9. (Ensuite) Simulation des daltonismes et ΔE minimal entre teintes (Leonardo, Atmos) ; API HTTP (tints.dev, UI Colors) ; serveur MCP (Leonardo, Ultimate Tokens) au-dessus de la CLI existante.

### 2.3 À ne pas copier
- **Génération « IA » des tokens sémantiques** (Supa Palette, bêta OpenAI) : ce n'est pas déterministe, pas vérifiable, et ça contredit la promesse « vérifié » de Hueladder [I].
- **Bibliothèques de milliers de palettes, harmonies de roue chromatique, couleurs aléatoires à la barre d'espace** (Supa, Atmos, UI Colors) : du gadget hors du cœur « échelles de design system » [I].
- **Échelles en HSV/HSL avec easing** (ColorBox, Scale, Palettte) : jolies mais sans contrôle de contraste. Hueladder a dépassé ce stade [I].
- **Abonnement ou licence pour l'export** (UI Colors, Supa, multi-file Tokens Studio Pro) : l'avantage de cran est d'être ouvert [S/I].
- **Formats propriétaires sans DTCG** et exports « figés » qui perdent les alias [I].
- **Miroir pur pour le sombre** (Harmonizer) comme seule méthode : Hueladder montre déjà qu'il faut juger les écarts [I].

---

## 3. Formats de livraison

### 3a. Figma
**Import natif des variables** : annoncé à Schema 2025 et livré en novembre 2025. Figma l'a attendu pour l'aligner sur le **DTCG 1.0** (rapport final du 28/10/2025) [S] (https://www.figma.com/blog/schema-2025-design-systems-recap/ , https://figma.obra.studio/design-tokens-community-group-w3c-release/). Doc : https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables [S].
- **Nouvelle collection** : on crée une collection vide, puis on glisse **un ou plusieurs fichiers JSON**. **Chaque fichier crée un mode**. Une variable n'est créée que si elle existe dans **tous** les fichiers, avec le même type [S]. Le nom du mode vient probablement du nom de fichier [I, non documenté]. Il faut donc nommer les fichiers `Light.tokens.json` et `Dark.tokens.json`.
- **Mode existant** : clic droit sur le mode, « Import mode ». Les variables de même nom et de même type sont mises à jour [S].
- **Types acceptés** : color, dimension (px), fontFamily, duration (s), number (booléen via `com.figma.type`), string [S].
- **Couleur** : objet DTCG 2025.10 `{ "colorSpace": "srgb", "components": [0.89,0.16,0.16], "alpha": 1, "hex": "#E32828" }`. Espaces acceptés : **srgb et hsl seulement** (pas d'oklch ni de display-p3) [S]. **Conséquence pour Hueladder : le `$value` en chaîne hex actuel ne suffit pas pour l'import natif** [I, d'après la doc et le code de `outputs.mjs`].
- **Alias inter-collections** : extension `$extensions["com.figma.aliasData"]` (`targetVariableSetName`, `targetVariableName`, ID…) [S]. Les alias dans une même collection utilisent la syntaxe DTCG `{group.token}` [I].
- **Export** : par mode, ou toute la collection en zip avec un JSON par mode [S].
- **Plugins courants** : Tokens Studio (Pro pour thèmes et multi-fichiers) ; « Variables Import », « Variables JSON Import » (DTCG vers variables) ; Design Tokens Manager (un JSON par mode plus `Manifest.json`) ; tokenhaus ; HaKa ; Design Tokens (W3C) Export (zip par collection et par mode) [S] (pages Figma Community citées dans la recherche).

**Paquet recommandé `figma/`** [I] :
```
figma/
  README.md                        # 3 gestes : créer collection « Primitives », glisser primitives ; créer « Theme », glisser Light+Dark
  primitives/Value.tokens.json     # 1 mode, toutes les échelles (brand/50…950), $value objet srgb + hex
  theme/Light.tokens.json          # rôles sémantiques -> alias vers Primitives (com.figma.aliasData)
  theme/Dark.tokens.json           # mêmes noms, mêmes types que Light (sinon variable non créée)
```
Exemple de token primitive :
```json
{ "brand": { "$type": "color",
  "500": { "$value": { "colorSpace": "srgb", "components": [0.24, 0.39, 0.93], "alpha": 1, "hex": "#3d63ed" },
           "$description": "AA sur 0–100 ; 4,6:1 sur blanc",
           "$extensions": { "com.figma.scopes": ["ALL_FILLS","STROKE_COLOR"] } } } }
```
(`com.figma.scopes` et `codeSyntax` : je ne les ai pas vus dans la doc consultée [I]. À tester avant de les promettre.)
Variante plus simple : une seule collection `Colors` avec les modes Light et Dark. Dans ce cas chaque échelle porte une valeur différente par mode. C'est le modèle de Harmonizer et du plugin « OKLCH Color Scale » [S]. Ça va bien si Hueladder livre l'échelle sombre sous les **mêmes noms de crans**.

### 3b. Tokens Studio
- **Sets** : chaque set est un objet JSON. En **single file**, les sets sont des clés de premier niveau d'un seul `tokens.json`, avec deux clés spéciales, `$themes` (tableau) et `$metadata` [S/I] (issues https://github.com/tokens-studio/figma-plugin/issues/1162 , /1164). En **multi-file** (Pro), chaque set est un fichier (le chemin devient le nom du set, les sous-dossiers sont permis), plus `$themes.json` et `$metadata.json` à la racine [S] (https://docs.tokens.studio/token-storage/remote-multi-file-sync).
- **`$metadata.json`** : `{ "tokenSetOrder": ["primitives", "theme/light", "theme/dark"] }`, l'ordre d'application des sets [S].
- **`$themes.json`** : tableau de thèmes `{ id, name, group, selectedTokenSets: { "<set>": "enabled" | "source" | "disabled" }, $figmaCollectionId?, $figmaModeId?, $figmaVariableReferences? }` [S pour selectedTokenSets, statuts et IDs Figma ; I pour `group`]. **Thèmes = fonction Pro** [S] (https://docs.tokens.studio/manage-themes/themes-overview). `source` veut dire que le set sert à résoudre les alias sans être exporté. Les primitives sont donc en `source` dans les thèmes Light et Dark, et le thème « Primitives » les met en `enabled` [I, pratique courante].
- **Format** : « legacy » (`value`/`type`) par défaut, ou W3C DTCG (`$value`/`$type`) au choix, réglé par fournisseur de stockage [S] (https://docs.tokens.studio/manage-settings/token-format). Les couleurs restent des **chaînes** (`"#3d63ed"`, `rgba()`). Le support de l'objet couleur 2025.10 n'est pas confirmé [I]. Il faut donc livrer des hex en chaîne pour Tokens Studio, et non l'objet du paquet Figma.
- **Code** : `@tokens-studio/sd-transforms` lit `$themes.json`, `permutateThemes()` produit une config Style Dictionary par thème (ex. `vars-light.css`, `vars-dark.css`) [S] (https://github.com/tokens-studio/sd-transforms).

**Paquet recommandé `tokens-studio/`** [I] :
```
tokens-studio/
  tokens/primitives.json          # { "brand": { "500": { "$type":"color", "$value":"#3d63ed" } } }
  tokens/theme/light.json         # { "bg": { "accent": { "$type":"color", "$value":"{brand.500}" } } }
  tokens/theme/dark.json
  tokens/$metadata.json           # { "tokenSetOrder": ["primitives","theme/light","theme/dark"] }
  tokens/$themes.json             # [ {"id":"light","name":"Light","group":"Mode","selectedTokenSets":{"primitives":"source","theme/light":"enabled"}}, {…dark…} ]
  tokens.single-file.json         # même contenu fusionné, pour les licences gratuites / URL sync
```

### 3c. Code
- **CSS custom properties** [I, pratique standard] : `:root { --brand-500: #3d63ed; }`, puis la couche sémantique `:root, [data-theme=light] { --bg-accent: var(--brand-500); }` et `[data-theme=dark] { … }`, avec repli `@media (prefers-color-scheme: dark)`. On peut aussi utiliser `light-dark()` avec `color-scheme: light dark` [I]. On peut ajouter un bloc `@supports (color: oklch(0 0 0))` ou `@media (color-gamut: p3)` pour OKLCH/P3 avec repli hex (méthode Radix) [S pour Radix].
- **Tailwind v4** [S] (https://tailwindcss.com/docs/theme , /dark-mode) : les couleurs vont dans `@theme { --color-brand-500: oklch(…); }` (espace de noms `--color-*`, génère `bg-brand-500`). `--color-*: initial;` remplace toute la palette par défaut. `@theme inline` sert quand la valeur référence une autre variable, ce qui est le cas des tokens sémantiques qui basculent en sombre. Le sombre se règle avec `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`.
  ```css
  @import "tailwindcss";
  @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
  @theme { --color-brand-50: #f0f4ff; /* … */ --color-brand-950: #0b1638; }
  @theme inline { --color-bg-accent: var(--bg-accent); --color-fg-on-accent: var(--fg-on-accent); }
  :root { --bg-accent: var(--color-brand-600); } [data-theme=dark] { --bg-accent: var(--color-brand-400); }
  ```
- **Tailwind v3** [I, format connu] : `tailwind.config.js`, `theme.extend.colors.brand = { 50: '#…', …, 950: '#…' }`. Pour le sombre, on passe par des couleurs `'rgb(var(--bg-accent) / <alpha-value>)'` et `darkMode: ['class']` ou `['selector', '[data-theme=dark]']`.
- **Style Dictionary (DTCG)** [S] (https://styledictionary.com/info/dtcg/) : la v4 prend en charge `$value`/`$type`. La doc précise que « le format 2025.10 n'a pas encore de support complet », prévu pour la v5. **Pour Style Dictionary, il faut donc livrer des `$value` en chaîne hex** (ou tester l'objet couleur avec la version visée) [S/I]. Les modes se font en builds multiples, une source par thème (`primitives` plus `light` ou `dark`), avec les formats `css/variables` et `javascript/es6` [S/I].
- **JS/TS** [I] : `colors.ts`, `export const brand = { 50: '#…', … } as const; export type BrandStep = keyof typeof brand;`, et `themes.ts` pour la map sémantique light/dark. Un `colors.json` brut sert aux outils.

**Paquet recommandé `code/`** [I] :
```
code/
  css/primitives.css        # :root { --brand-50…950 } (hex) + @supports oklch
  css/theme.css             # :root/[data-theme=light] et [data-theme=dark] -> rôles sémantiques
  tailwind/v4.css           # @theme + @theme inline + @custom-variant dark
  tailwind/v3.config.js     # theme.extend.colors + darkMode selector
  tokens/*.tokens.json      # DTCG ($value hex chaîne) — source Style Dictionary
  style-dictionary.config.mjs  # 2 builds light/dark -> css + js
  js/colors.ts              # const typées + types des crans
  README.md / color-guide.md / migration.md   # déjà produits par Hueladder
```

---

## 4. Sources principales
- Supa Palette : https://www.supa-palette.com/ · https://www.producthunt.com/products/supa-palette-figma-plugin
- UI Colors : https://uicolors.app/ · https://uicolors.app/upgrade
- Accessible Palette : https://accessiblepalette.com/
- InclusiveColors : https://www.inclusivecolors.com/
- Leonardo : https://leonardocolor.io/theme.html · https://github.com/adobe/leonardo · https://github.com/adobe/leonardo/blob/main/packages/contrast-colors/README.md · https://www.npmjs.com/package/@adobe/leonardo-mcp
- Radix : https://www.radix-ui.com/colors/docs/overview/custom-palettes · https://github.com/maxschulmeister/radix-custom-color
- Huetone : https://huetone.ardov.me/ · https://github.com/ardov/huetone
- ColorBox : https://colorbox.io/ · https://github.com/lyft/coloralgorithm
- tints.dev : https://tints.dev/ · https://github.com/SimeonGriggs/tints.dev
- Material Theme Builder : https://github.com/material-foundation/material-theme-builder · https://m3.material.io/styles/color/system/how-the-system-works
- Atmos : https://atmos.style/ · https://atmos.style/docs/export · https://atmos.style/docs/color-import
- Palettte : https://gabrieladorf.com/palettteapp/ · https://www.bairesdev.com/tools/color-palette-app/
- Scale : https://hihayk.github.io/scale/ · https://github.com/hihayk/scale
- Colorffy : https://colorffy.com/css-generator
- Harmonizer : https://github.com/evilmartians/harmonizer · https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools
- Reasonable Colors : https://www.reasonable.work/colors/
- Ultimate Tokens : https://github.com/kimgranlund/ultimate-tokens
- Figma : https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables · https://www.figma.com/blog/schema-2025-design-systems-recap/ · https://figma.obra.studio/design-tokens-community-group-w3c-release/
- DTCG couleur 2025.10 : https://www.designtokens.org/tr/2025.10/color/
- Tokens Studio : https://docs.tokens.studio/manage-themes/themes-overview · https://docs.tokens.studio/token-storage/remote-multi-file-sync · https://docs.tokens.studio/manage-settings/token-format · https://github.com/tokens-studio/sd-transforms
- Tailwind : https://tailwindcss.com/docs/theme · https://tailwindcss.com/docs/dark-mode
- Style Dictionary : https://styledictionary.com/info/dtcg/

## 5. Limites de cette recherche
- Je n'ai pas lu le code des outils fermés (Supa, UI Colors, Atmos). Leurs algorithmes sont décrits d'après leur marketing.
- Pages inaccessibles : Figma Community (403), npm leonardo-mcp (403), release notes Atmos (404). David Fusilier (color-shades, https://github.com/dfusilier/color-shades) n'est pas benchmarké ici : Hueladder reprend déjà sa méthode et sa nomenclature.
- Nom du mode à l'import natif Figma, prise en charge de `com.figma.scopes`/`codeSyntax` à l'import, objet couleur 2025.10 dans Tokens Studio et Style Dictionary : à vérifier par un essai réel avant de livrer.
