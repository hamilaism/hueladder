# Les méthodes : 10 de génération, plus l'existant comme témoin

Toutes partent du même principe : la couleur d'ancrage (`default`) donne la **teinte** et la
**saturation**, la méthode décide de la **luminosité** de chaque cran. Ce qui les distingue,
c'est ce qu'elles cherchent à rendre constant.

Quand une couleur sort du gamut sRGB, la réduction se fait toujours par recherche binaire
sur la chroma, à luminosité et teinte constantes : on sacrifie la saturation, jamais la
place dans l'échelle ni la teinte.

| Clé | Rend égal d'une teinte à l'autre, au même cran | Même luminance pour toutes les teintes | Conserve la teinte |
|---|---|---|---|
| `existing` | — (les couleurs fournies, telles quelles ; absent de l'exemple, qui n'en fournit pas) | non | oui, par définition |
| `anchored` | passe exactement par toutes les ancres | non | oui |
| `oklch` | la luminosité OKLCH par cran | non | oui |
| `fusilier` | le contraste vs noir, en progression log | oui | oui |
| `mix` | rien | non | non |
| `hct` | le tone (L*) par cran | oui (le tone est fonction de la luminance) | oui (CAM16) |
| `leonardo` | le ratio WCAG face au fond (les ratios qu'on lui donne) | oui | oui |
| `apca` | le Lc APCA vs blanc | oui, au sens d'APCA | oui |
| `easing` | la luminosité L* par cran | oui | approximativement |
| `curves` | rien d'une teinte à l'autre : chaque canal (L, C, H) suit sa courbe, le seed garde sa place | non | non : elle tourne de 12° au plus aux extrêmes, à dessein |
| `tailwind` | — (palette dessinée à la main) | non | non |

## Le cadre : espace, méthode, outil

Trois mots qu'on confond, et toute comparaison qui les mélange est fausse :

- **l'espace** est la géométrie du calcul (HSL, OKLCH, CIELAB, CAM16) ; il ne décide rien ;
- **la méthode** est la règle qui décide la couleur de chaque cran (une clarté fixe, un
  contraste visé, un mélange, des courbes) ;
- **l'outil** l'exécute (accessiblepalette, Leonardo, chroma.js, Material) ; un outil peut
  porter une méthode, ou aucune.

Une méthode complète est un **quadruplet** : la règle de distribution, l'espace de calcul, la
gestion du gamut, la politique de seed. Deux outils qui revendiquent « la même méthode »
peuvent différer sur les trois derniers et donner des rampes différentes (mesuré : le gamut
CSS 4 par défaut fait tourner la teinte jusqu'à 14°, là où la réduction de chroma à teinte
constante ne la touche pas).

Cinq familles, selon ce qu'elles rendent égal d'une teinte à l'autre :

| Famille | Méthodes | Ce qu'elle promet |
|---|---|---|
| Espace machine | `existing` (souvent HSL), `mix` | rien : à cran égal, chaque teinte a son propre contraste |
| Clarté perçue | `oklch`, `hct`, `easing` | la même clarté perçue à cran égal ; avec L* (HCT, Lab) c'est aussi la même luminance, avec OKLCH non ; l'échelle de clarté ne vise pas les seuils, un cran peut tomber juste sous l'un d'eux |
| Courbes par canal | `curves` | une rampe belle et régulière ; d'une teinte à l'autre, rien d'aligné |
| Contraste visé | `fusilier`, `leonardo`, `apca` | chaque cran vise un contraste, donc une luminance égale entre teintes ; Leonardo prend les ratios qu'on lui donne, Fusilier les fixe en progression logarithmique (l'écart de noms donne le contraste), APCA vise une autre mesure |
| Dessin manuel | `tailwind` | le jugement optimisé teinte par teinte, pas le système |

Ce que les mesures montrent, et que `hueladder explain` recalcule sur n'importe quelles couleurs, sans
désigner de gagnant : aucune échelle n'offre plus de trois niveaux mutuellement AA (4,5³ dépasse
21) ; donner la même luminance à toutes les teintes d'un cran les rend interchangeables, à
condition qu'aucun cran ne tombe sur un seuil ; OKLCH égalise la clarté perçue, pas la
luminance ; des intervalles réguliers font lire le contraste dans l'écart de noms (le critère
du défaut de Hueladder, Fusilier) ; plus de paires et des paires connues à l'avance sont deux
qualités différentes ; aligner les contrastes déplace la couleur de départ, la garder laisse
chaque teinte avec son contraste. Chaque critère a sa meilleure méthode, en gras au tableau.

## Détail

Chaque fiche de Comprendre (et `hueladder explain`) porte une ligne **Réglages** : ce que Hueladder a
choisi pour la méthode, et en quoi il s'écarte de l'auteur quand elle vient d'ailleurs
(`SETTINGS` dans `lib/explain.mjs`). Les cibles viennent toujours du nombre de crans choisi,
jamais de la méthode : Material a ses tons, APCA ses niveaux d'usage, mais ici toutes les
méthodes lisent le même barreau, pour comparer à crans égaux. Leonardo : interpolation OKLCH, alors que la librairie
interpole en RGB par défaut. APCA : une mesure dont Hueladder fait un générateur. Courbes : la
démarche de ColorBox mise en formule, pas son algorithme. HCT : 11 tons réguliers de 95 à 5,
là où Material a ses propres tons.

**`existing`** — les couleurs fournies, posées au rang que leur donne leur contraste face au
noir. Absente de l'exemple (`demo: true`), qui ne fournit rien. Méthode **creuse** : elle ne remplit que les crans pour lesquels une couleur existe.
Les trous hachurés dans l'artefact sont exactement ce que le core doit combler. Ses totaux
ne sont pas comparables à ceux des méthodes complètes, et elle ne concourt pas au meilleur
score dans la synthèse.

**`anchored`** — la colonne vertébrale Fusilier, corrigée pour passer exactement par chaque
ancre. L'écart ancre ↔ colonne vertébrale est mesuré en OKLCH (ΔL, ΔC, ΔH) puis interpolé
entre ancres ; au-delà de l'ancre la plus extrême, la correction de teinte et de saturation
est maintenue tandis que celle de luminosité s'éteint, pour que les crans extrêmes tiennent
quand même leur cible. C'est l'option « on ne jette rien » : fidélité parfaite, garanties
perdues.

**`oklch`** — luminosité OKLCH identique pour toutes les teintes à un cran donné
(accessiblepalette.com). Uniformité perceptuelle parfaite, mais aucune promesse de contraste :
à luminosité OKLCH égale, un jaune et un bleu n'ont pas le même contraste WCAG.

**`fusilier`** — chaque cran vise `21^(shade/200)` face au noir, avec
`shade = 200·(1 − (i+0.5)/n)`. Le demi-pas d'inset évite que les crans extrêmes touchent le
blanc et le noir purs, qui n'ont plus de teinte. Conséquence : l'écart de rang **détermine**
le contraste, la garantie est lisible dans le nom du step. Symétrique clair/sombre par
construction : c'est la raison du choix par défaut, une préférence de prévisibilité, pas un
classement. **Écart à l'outil d'origine** : color-shades fait varier la luminosité HSL en gardant
la teinte et la saturation HSL ; Hueladder garde la teinte et l'éclat OKLCH de la couleur de
départ. Mêmes cibles de contraste, couleurs un peu différentes.

**`mix`** — mélange linéaire en sRGB avec du blanc ou du noir (Sass `mix()`, Bootstrap).
Aucune notion perceptuelle. Seule méthode à épingler la couleur d'identité exactement
(ΔE 0), et elle hérite en échange de tout le désordre cross-teintes. Utile comme témoin :
c'est ce que produit l'outil par défaut de beaucoup de projets.

**`hct`** — tone CAM16 identique pour toutes les teintes (Material You). Cousin de `oklch`
dans un modèle d'apparence couleur plus fin. Le bon choix quand la cible est Android /
Material.

**`leonardo`** (Nate Baldwin, Adobe) — comme la librairie : une échelle blanc → seed → noir
interpolée en OKLCH, et sur elle le point qui tient chaque ratio visé face au fond. Vers le
blanc l'éclat s'éteint ; vers le noir, chroma.js garde celui du seed. Les ratios sont un choix :
par défaut ceux du barreau de l'échelle, pour comparer à ratios égaux avec Fusilier (seul le
chemin de couleur diffère alors) ; `ladders.leonardoReference` rejoue ceux d'une rampe
Tailwind. Pensée pour plusieurs fonds : les mêmes ratios se recalculent contre le fond du thème.

**`apca`** — comme Fusilier mais avec la métrique APCA (brouillon WCAG 3), sensible à la
polarité et mieux corrélée à la lisibilité réelle. Ses « violations » de la règle WCAG 2
mesurent surtout le désaccord entre les deux référentiels, pas un défaut. Zone morte sous
Lc ≈ 7,3 côté clair. À montrer quand le client s'intéresse à l'avenir de WCAG.

**`easing`** — interpolation Lab entre blanc, seed et noir, avec correction de luminosité
(ColorBox / chroma.js `correctLightness()`). Régulière et sans surprise ; ne vise aucun seuil.

**`tailwind`** — la famille Tailwind perceptuellement la plus proche du seed (ΔE2000
minimal, affiché dans l'en-tête du nuancier). L'étalon du design manuel : aucune formule,
des courbes de chroma que seul un œil humain produit. Sert de référence pour juger les
autres — et de rappel que « prendre Tailwind » est une option réelle, dont le coût exact
est mesuré par la dérive au step d'ancrage.

## Ajouter une méthode

Dans `lib/methods.mjs` : écrire `function mMaMethode(ctx)` renvoyant un tableau de hex de
longueur `ctx.n`, l'enregistrer dans `METHOD_IMPL`, l'ajouter à `METHOD_COMPUTE_ORDER`
(après ses dépendances) et à `METHOD_DISPLAY_ORDER` dans `lib/build.mjs`, puis lui écrire
une entrée dans `methodCatalog()` — description comprise, elle est affichée telle quelle.

`ctx` fournit : `seed`, `anchors`, `steps`, `n`, `seedIndex`, `ladders`, `isNeutral`,
`anchorPlacement`, `scales` (les méthodes déjà calculées) et `meta` (pour publier des
métadonnées, comme le fait `tailwind` avec sa famille retenue).

## Conformité aux librairies d'origine

Le moteur réimplémente chaque méthode sans dépendance. `engine/conformance/run.mjs` les compare
aux librairies qui les portent (`npm install` dans ce dossier, hors du moteur), sur l'exemple
synthétique de `hueladder explain`. Mesuré le 21 octobre 2026, Leonardo remesuré le 29 :

| Méthode | Librairie | Résultat |
|---|---|---|
| `mix` | chroma.js 3.2 (`chroma.mix(…, 'rgb')`) | identique au hex près (80 couleurs sur 80) |
| `easing` | chroma.js 3.2 (`scale().mode('lab').correctLightness()`) | identique sur 82 couleurs sur 88 ; les autres à ΔE 1,7 au plus, au bord du gamut (chroma.js écrête en RGB, Hueladder réduit la chroma à teinte constante) |
| `hct` | material-color-utilities 0.4 (`Hct`) | fidèle : ΔE 0,61 au plus |
| `tailwind` | tailwindcss 4.3 (`theme.css`, OKLCH ramené en sRGB comme un navigateur) | identique au hex près (286 sur 286) |
| `leonardo` | @adobe/leonardo-contrast-colors 1.1 (`colorSpace: 'OKLCH'`) | même chemin, mêmes ratios : là où la couleur tient dans l'écran, les deux coïncident. Les écarts (ΔE jusqu'à 19, 17 couleurs identiques sur 88) viennent tous du gamut : la librairie écrête en RGB, ce qui fait tourner la teinte des jaunes et orangés foncés ; Hueladder réduit la chroma à teinte constante, comme pour toutes les méthodes. Ratios tenus à 0,13 près (librairie : 0,10) |

Trois corrections en sont sorties : `easing` suit désormais le chemin de chroma.js (paramétré
par la clarté, plus par le rang), la table Tailwind est celle de la 4.3, plus celle de la 3, et
`leonardo` suit le chemin de la librairie, avec par défaut les ratios du barreau au lieu de
ceux de Tailwind slate, qui serraient les crans clairs (1,04 puis 1,09:1) jusqu'à les confondre.
