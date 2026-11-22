# Le régleur — éditer la couleur sans toucher au contraste

`tuner.html`, généré par le même `node build.mjs`. À utiliser **après** avoir arbitré une
méthode dans l'artefact de comparaison : celui-ci répond à « quelle méthode », le régleur
répond à « et maintenant, comment rendre ça beau ».

## Pourquoi c'est possible

Le contraste d'une couleur face au blanc et face au noir ne dépend que de sa luminance
relative Y, et les deux sont liés :

```
C_noir  = (Y + 0.05) / 0.05
C_blanc = 1.05 / (Y + 0.05)
          →  C_blanc × C_noir = 21, toujours
```

Verrouiller « le contraste » revient donc à verrouiller **un seul nombre**. C'est vrai quelle
que soit la métrique : le Lc APCA sur blanc et sous blanc sont eux aussi des fonctions
monotones de Y seul.

Sur les trois degrés de liberté d'une couleur, Y en consomme un. Il en reste **deux**,
entièrement libres : la teinte et la chroma. Le régleur les rend éditables et re-résout la
luminosité OKLCH à chaque mouvement.

C'est ce qui manque aux méthodes formelles : elles gèlent la teinte et subissent la chroma.
Ici la machine garantit l'accessibilité et l'interchangeabilité entre nuanciers — un step 400
a exactement le même contraste sur toutes les rampes — et le designer récupère tout le reste.

Les couleurs déjà en place chez le client servent de **repère perceptif**, pas de cible de
renommage : elles disent le rendu voulu, on regarde de combien on s'en éloigne.

## Utilisation

1. Choisir un nuancier dans la liste.
2. Lire les **trois lignes** du haut, qui sont tout l'outil :
   *Aujourd'hui* (ce qui existe dans le fichier client, avec des trous hachurés là où rien
   n'existe), *Proposition* (ce qui sera exporté), et l'*écart* ΔE entre les deux.
3. Cliquer un step, puis choisir sa couleur dans le **pavé** : chaque point du rectangle est
   une couleur possible **à contraste identique**. Horizontalement la teinte, verticalement
   l'éclat. Le fond du pavé montre les couleurs réellement disponibles — on choisit ce qu'on
   voit. `←` et `→` changent de step.
4. Le cercle creux est la couleur d'aujourd'hui. Si elle sort du cadre, un chevron l'indique
   au bord avec l'écart de teinte : c'est le signe que cette couleur dérive de sa famille.
5. Exporter, coller dans la spec.

L'amplitude de teinte du pavé est volontairement étroite (±18°) : l'enjeu est de rester dans
la même famille de couleur. Au-delà on ne règle plus, on change de teinte — et ça se décide
dans la spec, pas dans le régleur.

Les réglages sont conservés dans le navigateur (localStorage), par marque et par nuancier.

## Comparer, et voir le système entier

Sous la comparaison, deux sélecteurs affichent **une rampe au-dessus et une en dessous** de
celle qu'on travaille, telles qu'elles seront livrées. C'est la façon la plus directe de
vérifier qu'un step se comporte pareil d'un nuancier à l'autre — l'interchangeabilité se
constate à l'œil, pas seulement dans un tableau.

Plus bas, un bloc repliable montre **le système complet** : toutes les rampes, réglages
compris, sans les couleurs d'origine. C'est la palette telle qu'elle sera livrée. Cliquer une
case y saute directement pour la régler.

Trois tris : l'ordre de la spécification (chaque déclinaison sous son parent), le nom, et la
**teinte**. Le tri par teinte est le plus révélateur — il montre d'un coup où la roue est
encombrée et où elle est vide, les quasi-gris étant renvoyés en fin de liste.

Chaque rampe se masque d'un clic sur sa pastille. C'est un outil de comparaison à part
entière : le neutre, plus long et visuellement dominant, écrase la lecture dès qu'on veut
comparer les teintes entre elles. **Les colonnes que plus aucune rampe visible n'utilise
disparaissent** — masquer le neutre resserre donc la grille de 15 à 11 crans. Deux raccourcis :
« tout » et « réels seulement » (qui masque les déclinaisons).

## Ajuster l'écart d'une déclinaison

Un écart de ±30° est un point de départ, pas une vérité : selon la teinte de base, il peut
laisser la déclinaison collée à son parent ou la faire tomber sur un autre nuancier. Une
déclinaison porte donc un curseur d'**écart de teinte**, réglable de −90° à +90°.

La rampe est régénérée en direct : le barreau de luminance ne bouge pas — c'est lui qui porte
l'interchangeabilité — seule la teinte du seed change et chaque cran est re-résolu à la même
luminance. Le curseur affiche l'écart réellement **perçu** (souvent très différent de l'écart
HSL demandé) et alerte quand la déclinaison passe à moins de 12° de son parent ou d'un autre
nuancier. L'écart réglé est repris dans l'export.

## Épingler une valeur exacte

Il y a un cas où le verrou et l'existant s'opposent : vouloir qu'un step soit **exactement**
une couleur déjà validée. Cette couleur a sa propre luminance, qui n'est en général pas
celle du barreau. Les deux sont incompatibles.

Le bouton « épingler cette valeur exacte » rompt donc volontairement le verrou pour ce
step-là, et l'écart de contraste est affiché en rouge partout — pastille d'en-tête, swatch,
tableau de vérification. C'est explicite et réversible.

Le tableau « couleurs déjà arbitrées » de l'inspecteur propose d'épingler chaque couleur
existante sur le step dont elle est perceptuellement la plus proche (ΔE2000).

## Ce que dit le contrôle

Une dérive **relative** par step, pas absolue : 0,05 d'écart sur un contraste de 18:1 n'a
aucune portée pratique, le même écart sur 3:1 en aurait une.

Le résidu observé est de l'ordre de **0,3 à 0,5 %** même après une dérive de teinte complète
et un arc d'éclat. Il n'est pas réductible : c'est le pas de la grille hex. Le solveur
encadre la marche d'escalier et retient celle des deux couleurs voisines qui est la plus
proche de la cible — aucune couleur sRGB ne ferait mieux. C'est vérifié sur 2 376 solveurs
couvrant toute la roue et toute la plage de luminance (`node lib/tune.test.mjs`).

Un step épinglé apparaît en rouge : c'est normal, le verrou a été rompu exprès.

## Les déclinaisons de teinte sont réglables, et adoptables

Si la spec déclare des `hueVariants`, elles apparaissent dans le sélecteur du régleur, en
retrait de leur parent. Leur ligne « Aujourd'hui » est vide — c'est exact, elles n'existent
encore nulle part — et l'outil le dit explicitement plutôt que de laisser croire à un bug.

Un bouton **« adopter cette couleur »** les promeut en couleur à part entière. L'export ne
produit alors pas un bloc `tuned` (qui ne correspondrait à aucun nuancier de la spec, puisque
la déclinaison est fabriquée au build) mais un **nuancier complet** prêt à ajouter :

```jsonc
{ "name": "coral-moins", "label": "Coral −30°", "kind": "product",
  "note": "Déclinaison HSL −30° de « Coral », adoptée comme couleur à part entière.",
  "anchors": { "default": "#0cfffb" },
  "tuned": { "50": "#d5f6f1", … },
  "tunedFrom": { "method": "fusilier", "lockedY": true, "pinned": [] } }
```

À coller dans `ramps`, puis retirer le parent de `hueVariants.appliesTo` si l'hypothèse n'a
plus lieu d'être affichée. L'export sépare les deux sorties : `reglages` pour les nuanciers
existants, `nouveauxNuanciers` pour les adoptions.

## Récupérer le résultat

La carte d'export est **toujours remplie** : elle contient le système tel qu'il sera livré,
qu'on ait réglé quelque chose ou non. Trois formats :

**Palette finale** — toutes les couleurs, tous les nuanciers, prêtes à consommer. C'est ce
qu'on veut dans neuf cas sur dix.

```jsonc
{ "marque": "MaCorp", "steps": ["50","100",…], "base": "fusilier",
  "nuanciers": { "brand": { "50": "#…", "100": "#…", … }, … } }
```

**Tokens DTCG** — le même contenu au format `$type`/`$value`, à importer via
`figma_import_tokens`.

**À coller dans la spécification** — les blocs `tuned` des nuanciers réglés et les nuanciers
adoptés, pour que `node build.mjs` régénère exactement le même résultat. C'est le format qui
rend le travail **reproductible** : sans lui, un réglage manuel n'existe que dans le
navigateur. S'il n'y a eu aucun réglage, il le dit plutôt que de rendre un objet vide.

Sont livrés les nuanciers réels **et les déclinaisons adoptées** ; les déclinaisons non
adoptées restent des hypothèses et n'y figurent pas. Le bouton « télécharger » écrit un
fichier nommé d'après la marque et le format.

## Réinjecter dans la spec

L'export produit un bloc par nuancier réglé :

```jsonc
{
  "brand": {
    "tuned": { "50": "#f4eded", "100": "#eccac9", … },
    "tunedFrom": { "method": "fusilier", "lockedY": true, "pinned": [] }
  }
}
```

À reporter dans `brands/<client>.json` sur le nuancier correspondant. Au build suivant :

- une méthode **`Réglé à la main`** apparaît dans l'artefact, en tête de liste, et entre dans
  toutes les comparaisons — métriques, matrices, usages ;
- un step non réglé retombe sur la méthode de base, on peut donc n'ajuster qu'une partie
  d'une rampe ;
- pour que les **tokens** sortent des valeurs réglées, mettre `"coreMethod": "tuned"` dans la
  spec. Sans ça, le réglage est visible dans l'artefact mais les tokens restent générés.

`tunedBase` (défaut `fusilier`) désigne la méthode qui fournit le barreau de luminance.

## L'éclat se règle en fraction du plafond, pas en multiplicateur

Mesure faite sur un cas réel : les 8 palettes dessinées à la main **et** la génération Fusilier étaient déjà
collées au plafond du gamut (marge 0,000–0,001 sur 27 couleurs). Un multiplicateur au-dessus
de ×1 ne ferait donc strictement rien — la moitié de la course serait morte.

Le réglage est donc « **% du plafond** » : 100 % = aussi vif que le sRGB le permet à cette
luminance, 0 % = gris. Toute la course est utile, et c'est le même geste à tous les steps.
Le levier réel est de **retirer** de l'éclat, pas d'en ajouter.

### Le point de départ raisonnable : la cloche

Une fraction **constante** sur toute la rampe est presque toujours fausse, et pour une raison
physique : le gamut sRGB est très large aux luminances extrêmes. Régler 85 % partout donne
donc énormément de chroma au cran le plus clair et au plus foncé — précisément ceux qui
doivent rester des **fonds** et des **encres**, pas des aplats. Mesuré sur un cas réel, une
re-saturation sans profil faisait gagner **+1065 %** de chroma au cran 50.

Le profil de référence est exporté par le moteur sous le nom `BELL_CHROMA` (`lib/tune.mjs`),
rééchantillonnable sur n crans par `chromaProfile(n)` :

    50: 0,25 · 100: 0,40 · 200: 0,60 · 300: 0,75 · 400-600: 0,85 · 700: 0,75 · 800: 0,60 · 900: 0,40 · 950: 0,25

C'est un point de départ, pas une loi — mais commencer par une constante fait perdre une
séance à comprendre pourquoi les extrémités sonnent faux.

### Deux variantes à arbitrer ? La moyenne se fait sur la chroma

Quand le client entoure deux propositions pour la même famille, la moyenne se fait **sur la
chroma en OKLCh**, à luminance et teinte constantes (`blendVariants` dans `lib/tune.mjs`).
Moyenner les composantes RGB déplacerait Y, donc le contraste, donc le sens de l'échelon —
mesuré, jusqu'à **9 % d'erreur sur Y**, et tout serait à re-tester.

## Le contraste est verrouillé, la clarté perçue ne l'est pas

À luminance égale — donc à contraste rigoureusement identique — une couleur saturée paraît
plus claire qu'un gris (effet Helmholtz-Kohlrausch). Mesuré : jusqu'à **0,032 de clarté
perçue**, soit 42 % d'un cran entier.

Conséquence : un magenta vif au step 400 et un gris au step 400 ont le même contraste mesuré,
mais le magenta paraît plus clair. L'interchangeabilité est parfaite au sens WCAG,
approximative au sens perceptif. L'outil ne peut pas corriger ça sans casser la garantie,
mais il **l'affiche** : chaque step indique son décalage de clarté perçue, et alerte au-delà
de 0,02. À surveiller quand on pousse un nuancier loin de ses voisins.

## Pourquoi OKLCH et pas HSL

Les deux atteignent le même ensemble de couleurs — verrouiller la luminance laisse une
surface 2D, et tout système de coordonnées la couvre. Ce sont les **curseurs** qui diffèrent.
Mesuré à luminance verrouillée, en tournant la teinte sur 360° : la saturation perçue varie
de **×1,3 en OKLCH contre ×2,8 en HSL**, et la clarté perçue de 0,031 contre 0,048. « S = 70 % »
en HSL ne veut pas dire la même chose selon la teinte ; la chroma OKLCH, si.

Il n'existe pas de troisième levier : la luminance consomme un degré de liberté sur trois,
il en reste exactement deux.

## Limites

- Le régleur travaille en **OKLCH**. Les valeurs HSL sont affichées en lecture seule, pour
  faire le lien avec le picker Figma. Passer les curseurs en HSL supprimerait le mur de
  gamut (tout triplet HSL est valide) mais rendrait la chroma inopérante dans les clairs.
- Un seul nuancier à la fois. Pour une dérive cohérente sur toute la palette, régler chaque
  nuancier séparément avec la même forme de courbe.
- Le barreau de luminance n'est pas éditable : c'est la prémisse de l'outil. Pour le changer,
  changer `tunedBase` ou l'échelle de shades dans la spec.
