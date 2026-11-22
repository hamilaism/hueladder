# Format de la spécification de marque

Un fichier JSON dans `brands/`. Point de départ : `brands/_template.json` (il build tel quel).

## Clés de premier niveau

| Clé | Requis | Effet |
|---|---|---|
| `id` | oui | préfixe des fichiers de sortie et clé de namespace dans `$extensions` |
| `brand` | oui | nom affiché, sert aussi de clé de persistance des filtres dans le navigateur |
| `naming` | non | la nomenclature : `grid` (centaines sur la grille 50 → 950), `hundreds` (centaines par contraste, multiples de 25), `shade` (le nom est le contraste, 0–200, David Fusilier), `rank` (répartis dans l'ordre donné). Voir `nomenclatures.md` |
| `stepList` | avec `naming` | les crans livrés, dans n'importe quel ordre sauf pour `rank` (ordre de clarté). Remplace `steps`, `seedStep`, `crans` |
| `crans` | non | jeu de crans prêt à l'emploi (`maxi`, `standard`, `centaines`, `impairs`, `mini`) ; remplace `steps`, `seedStep` et `extraSteps`. Voir plus bas |
| `steps` | oui, sans `crans` | les crans, du plus clair au plus foncé. Nombre libre |
| `seedStep` | oui, sans `crans` | le cran où se pose la couleur `defaultRole`. Doit figurer dans `steps` |
| `extraSteps` | non | crans hors grille (`0`, `25`, `975`, `1000`…), utilisés par les nuanciers qui les déclarent. Voir plus bas |
| `ramps` | oui | les nuanciers (voir plus bas) |
| `title` | non | titre de la page. Défaut : « Comparaison des méthodes de génération — scales core {brand} » |
| `subtitle` | non | phrase de contexte sous le titre, HTML simple accepté |
| `source` | non | d'où viennent les couleurs |
| `accent` | non | couleur d'accent de l'artefact. Défaut `#2f5bd3`. Y mettre la couleur de la marque |
| `coreMethod` | non | méthode alimentant les tokens. Défaut `fusilier` (le Fusilier adapté ; `colorshades` pour l'original, color-shades au hex près) ; `tuned` pour livrer les valeurs réglées (`ramps[].tuned`) |
| `tunedBase` | non | méthode sur laquelle les réglages ont été faits. Défaut `fusilier` |
| `pinDefault` | non | `true` (défaut) : la couleur `defaultRole` est posée sur `seedStep`. `false` : elle prend son rang naturel — à mettre quand la marque fournit une palette complète |
| `hueVariants` | non | déclinaisons de teinte à explorer (voir plus bas) |
| `defaultRole` | non | nom du rôle épinglé sur `seedStep`. Défaut `default` |
| `tokenRoot` | non | racine de l'arbre DTCG. Défaut `core` → `core.color.<nuancier>.<step>` |
| `anchorRoles` | non | libellés des rôles |
| `ladders` | non | réglages fins des échelles cibles |
| `darkMode` | non | dérive une seconde rampe : `background`, `method` (`mirror-wcag` par défaut, `mirror-bridge`, `mirror-apca`, `budget-share`, `tone-flip`, `index-flip`), `chromaProfile` (`bell`), `desaturate` (0 → 0,9) et `desaturateScope` (`surfaces` par défaut, ou `all`). Voir `mode-sombre/recherche.md` et `mode-sombre/perceptif.md` |
| `lang` | non | `fr` (défaut) ou `en` : langue des descriptions de tokens, du guide d'usage, de la table de migration et du rapport `index.html` |
| `lightBackground` | non | fond de référence du mode clair. Défaut `#ffffff` |
| `staticTokens` | non | couleurs littérales, identiques dans tous les modes |
| `contract` | non | les budgets que `check.mjs` fait respecter |
| `usagePatterns` | non | remplace les 14 patterns d'usage par défaut |
| `notes` | non | un **objet** (paragraphes libres, `figmaTarget` lu par le manifeste) : affiché dans l'annexe du rapport. Un **tableau** de phrases (ce qu'écrit le studio : exceptions documentées, écarts assumés) : repris aussi dans le guide d'usage et la table de migration |
| `accepted` | non | constats du diagnostic acceptés, `[{ key, note }]` : un constat dont la clé y figure ne revient pas (studio, `hueladder diagnose`, `hueladder fix`) |
| `assumed` | non | contrôles du contrat acceptés à l'étape Vérifier, `[{ label, detail, note }]` |
| `figmaIntent`, `nextSteps` | non | reportés tels quels dans le manifeste |

## Le nombre de steps change les garanties

Le barreau de shades est `200 · (1 − (i+0.5)/n)`, et le contraste entre deux crans vaut
`21^(Δshade/200)`. Donc **le nombre de crans détermine la règle**, et elle est recalculée
automatiquement :

| Steps | shades/cran | Δrang ⇒ 3.0 | Δrang ⇒ AA (4.5) | Δrang ⇒ AAA (7) |
|---|---|---|---|---|
| 9 | 22.2 | 4 | 5 | 6 |
| 11 | 18.2 | 5 | 6 | 8 |
| 13 | 15.4 | 5 | 7 | 9 |

Une règle n'est retenue que si elle tient avec 1,5 % de marge (`RULE_MARGIN`) : l'arrondi hex
fait rater chaque cran d'un demi-point au plus, et une paire cumule deux erreurs. Sur 11 crans,
4 rangs visent 3,02:1 et sortent parfois à 2,99:1 ; la règle écrite est donc 5 rangs pour 3:1.
Le contrat (`règle du nom`) la vérifie paire par paire dans chaque nuancier, dans les deux modes.

Une échelle plus fine ne donne pas plus de contraste — le budget noir→blanc reste 21:1.
Elle donne plus de nuances, et un écart de rang plus grand pour la même garantie.

## naming — ce que le nom d'un cran encode

```jsonc
"naming": "hundreds", "stepList": ["50", "100", "200", "350", "500", "700", "900", "950"]
```

| `naming` | Le nom encode | Règle (AA) | Ajouter un cran… |
|---|---|---|---|
| `grid` (défaut) | un rang sur la grille 50 → 950 | 6 rangs | ne déplace rien, mais reste hors règle s'il est hors grille |
| `hundreds` | le contraste : shade = 200 · (1 − nom/1000) | Δ 525 entre les noms | ne déplace rien, et entre dans la règle |
| `shade` | le contraste : le nom est le shade (0 noir → 200 blanc) | Δ 105 | ne déplace rien, et entre dans la règle |
| `rank` | une position dans la liste | selon le nombre de crans | déplace tous les autres |

Les règles sont calculées avec la marge de 4 % (`RULE_MARGIN`), d'où Δ 105 plutôt que le
Δ 100 du README de color-shades : 100 d'écart donne 4,58:1, 1,8 % de marge seulement, ce que
l'arrondi hex peut manger. Pour une nomenclature par contraste, le moteur calcule seulement les
crans demandés et situe chacun sur une grille virtuelle d'un rang par grain de nom (25 ou 5) :
la règle y est une règle de rangs comme les autres, écrite en écart de noms. Recherche et
sources : `nomenclatures.md`.

## crans — les jeux de crans prêts à l'emploi

```jsonc
"crans": "maxi"   // maxi | standard | centaines | impairs | mini
```

Plutôt que d'écrire `steps`, `seedStep` et `extraSteps` à la main, on choisit un jeu :

| Jeu | Crans livrés |
|---|---|
| `maxi` | 25, 50, 75, 100, 150, 200, 250 … 850, 900, 925, 950, 975 (23 crans) |
| `standard` | 50, 100 → 900, 950 (11 crans) |
| `centaines` | 100 → 900 |
| `impairs` | 100, 300, 500, 700, 900 |
| `mini` | 200, 500, 800 |

Tous reposent sur **la même grille de référence**, 50 → 950 ancrée à 500 (`lib/crans.mjs`).
Un jeu ne fait qu'ajouter des crans intermédiaires, interpolés par leur nom entre leurs
voisins, ou ne livrer qu'une partie de la grille (`emitSteps`). Un 300 est donc la même
couleur quel que soit le jeu : passer de `standard` à `maxi` ne déplace aucune couleur déjà
livrée. `lib/crans.test.mjs` le vérifie.

Deux conséquences à connaître :

- la règle de contraste se lit sur la grille de référence : « Δrang ≥ 6 ⇒ AA » compte les
  rangs de 50 → 950. Avec `mini`, 200 sur 800 fait 6 rangs et passe donc AA ;
- les cinquantaines et les extrêmes de `maxi` sont **hors de la règle**, comme tout cran hors
  grille (voir plus bas). Ils servent à la finesse, pas à la garantie.

Une spec sans `crans` garde ses `steps` : les specs écrites à la main gardent la main.

## extraSteps — les crans hors grille

```jsonc
"extraSteps": ["0", "25", "975", "1000"],   // au niveau de la spec
…
{ "name": "neutral", "extraSteps": true, … }  // au niveau du nuancier qui les utilise
```

Une rampe neutre a besoin de finesse là où l'échelle logarithmique n'en donne pas : tout près
du blanc, pour les surfaces d'interface, et tout près du noir pour le mode sombre. Ces crans
s'ajoutent **sans toucher aux crans réguliers**.

- **`0` est le blanc pur et `1000` le noir pur**, quelle que soit la méthode : ce sont les
  bornes de l'échelle, pas des couleurs à générer (elles n'ont ni teinte ni saturation).
- Les autres crans supplémentaires prennent la cible de contraste qu'une interpolation entre
  leurs voisins leur donne — les noms de crans n'étant pas régulièrement espacés, cette
  interpolation se fait par morceaux, pas par régression.
- **Ils sont hors de la règle de contraste.** Δrang ⇒ AA ne vaut que sur la grille régulière ;
  une paire touchant un cran supplémentaire n'a pas de rang et n'est donc ni conforme ni
  fautive. Les métriques en tiennent compte.
- Un nuancier qui ne les déclare pas laisse simplement ces rangs vides.

## Les nuanciers

```jsonc
{
  "name": "error",          // identifiant technique, sert de clé de token
  "label": "Error",         // nom affiché
  "kind": "system",         // brand | product | system | neutral — classement visuel
  "source": "Colors / system / Error",   // chemin dans le fichier d'origine
  "note": "…",              // contexte affiché sous l'en-tête
  "anchors": {              // AUTANT de couleurs que la marque en a déjà
    "background": "#ffeeed",
    "light": "#f1584c",
    "default": "#d92d20",
    "dark": "#a60b00"
  },
  "darkChroma": 0,          // OPTIONNEL — écrase le chromaProfile de la spec pour ce nuancier
  "extraSteps": true,       // OPTIONNEL — ce nuancier utilise les crans hors grille
  "seed": "#…",             // OPTIONNEL — la couleur qui porte l'identité, si ce n'est pas le `defaultRole`
  "tuned": { "500": "…" },  // OPTIONNEL — valeurs réglées à la main
  "hueVariants": false      // OPTIONNEL — ce nuancier accepte ou refuse les déclinaisons
}
```

`darkChroma` sert quand une famille doit rester sobre alors que le reste de la palette
s'anime : `0` la garde en variante « alignée », une fraction la place entre les deux. Un
nuancier `kind: "neutral"` est déjà aligné d'office.

### anchors — le point important

Les noms de rôles sont **libres**. Le moteur n'en connaît qu'un seul : celui déclaré dans
`defaultRole`, qu'il épingle sur `seedStep`. Tous les autres sont placés au rang que leur
donne leur propre contraste face au noir :

```
shade = 200 · ln(contraste vs noir) / ln(21)
rang  = (1 − shade/200) · n − 0.5
```

Ce placement ne dépend d'aucune méthode de génération — c'est une mesure de la couleur,
pas une opinion. C'est ce qui permet à l'artefact d'affirmer « cette couleur s'appelle 500
mais c'est un 200 ».

En cas de collision (deux couleurs qui méritent le même rang), la moins bien ajustée glisse
d'un cran, et l'ordre de clarté est toujours préservé — une couleur plus claire ne peut
jamais se retrouver à un rang plus foncé qu'une couleur plus sombre.

### Nuancier sans couleur par défaut

Légitime : une rampe neutre où l'on ne connaît que le blanc et l'encre, par exemple.
Le seed du `seedStep` est alors synthétisé — teinte moyenne des ancres pondérée par leur
chroma, chroma la plus marquée d'entre elles, luminosité visant la cible de contraste du
cran. L'artefact l'affiche en clair (« seed synthétique ») et la dérive d'identité n'est
pas mesurée pour ce nuancier, puisqu'il n'y a pas d'identité d'origine à trahir.

## ladders — réglages fins

```jsonc
"ladders": {
  "leonardoReference": "slate",  // rampe Tailwind dont Leonardo copie la signature
  "shadeLadder": [...],          // imposer les cibles de contraste (voir plus bas)
  "oklchLMax": 0.965, "oklchLMin": 0.205,
  "toneMax": 95, "toneMin": 5,
  "easingLMax": 95, "easingLMin": 5
}
```

`leonardoReference` mérite un choix conscient : Leonardo n'invente pas ses ratios, il
rejoue la distribution d'une rampe dessinée à la main. Prendre la famille Tailwind la plus
proche de la rampe neutre du client rend la comparaison plus juste.

### shadeLadder — imposer ses propres cibles de contraste

C'est le seul moyen de faire dire à l'échelle autre chose que le barreau par défaut, et il
sert dans un cas précis et fréquent : **le client a déjà une palette, et on ne veut pas la
déplacer plus que nécessaire.**

La recette qui marche : relever le Y de chaque famille à chaque cran, prendre la **médiane**
par cran, et poser ces médianes comme cibles. Chaque famille se recale alors sur le
consensus de la palette existante, et seules les déviantes bougent — l'inverse d'un barreau
théorique, qui déplace tout le monde.

Un shade se déduit d'un contraste par `shade = 200 · ln(C_noir) / ln(21)` :

```js
const shadeOf = Cnoir => 200 * Math.log(Cnoir) / Math.log(21);
// Y médian → contraste face au noir → shade
const shade = shadeOf((Ymedian + 0.05) / 0.05);
```

Fait mesuré, utile à savoir avant de se lancer : sur une palette de 20 familles réelle, les
médianes converties en shades tombaient à **moins de 0,4 shade** du barreau par défaut
`200 · (1 − (i+0,5)/n)` sur les 11 crans. Une palette dessinée à la main par des designers
compétents retombe d'elle-même sur la loi. Vérifier l'écart **avant** d'écrire un
`shadeLadder` : s'il est faible, le défaut est plus simple et plus défendable.

## darkMode — la seconde rampe, par égalité de contraste

```jsonc
"darkMode": {
  "background": "#0e0d0d",       // le fond sombre de référence. Obligatoire
  "chromaProfile": "bell",       // absent = variante « alignée » · "bell" · [n fractions] · nombre
  "gamutCeiling": 0.96,          // retrait du bord du gamut. Défaut 0,96
  "pins": { "neutral": { "25": "#151515" } }   // valeurs imposées, cran par cran
}
```

**Le principe.** Un mode sombre n'est pas une seconde palette à dessiner : c'est le même
barreau de contraste relu contre un autre fond. Pour chaque cran, on prend le contraste que
la couleur claire tient face au blanc et on cherche la couleur qui tient **le même**
contraste face au fond sombre :

    Y_sombre = C_clair × (Y_fond + 0,05) − 0,05

C'est ce qui garantit qu'un échelon **porte le même sens dans les deux modes** : le seuil AA
tombe au même cran des deux côtés, et une règle écrite une fois survit à l'inversion du
thème. Sans cette égalité, chaque usage doit être re-testé en sombre — mesuré sur un cas
réel, l'écart de contraste à cran égal passait de 1,84 point en clair à **4,10 en sombre**,
et jusqu'à 7,37 au cran 700.

**Le budget.** Un fond sombre non noir ne porte pas 21:1. `#0e0d0d` (Y = 0,0041) plafonne à
`1,05 / 0,0541 = 19,41:1`. Les crans dont la cible dépasse ce budget sortent en blanc pur et
sont listés dans `meta.dark.outOfBudget` ; `check.mjs` les signale. C'est structurel : le
haut d'une rampe sombre est plus resserré que le bas d'une rampe claire, et l'œil discrimine
mal les hautes luminances de toute façon. **Choisir le fond avant les cibles**, pas l'inverse.

**Les bornes s'échangent.** Le cran qui vaut le blanc pur en clair devient le fond lui-même
en sombre ; celui qui vaut le noir pur devient le blanc pur.

**La dérivation part de la couleur claire réellement obtenue**, pas de la cible. La nuance
compte : avec une méthode qui privilégie les couleurs de marque sur la régularité
(`anchored`), dériver de la cible produirait un mode sombre impeccable au-dessus d'un mode
clair approximatif — la parité serait rompue sans que rien ne le signale. Ici, un mode clair
irrégulier donne un mode sombre irrégulier, et les deux métriques le disent.

### chromaProfile — combien d'éclat reprendre

Une fois la luminance imposée, il reste à choisir la chroma. Deux variantes, et le profil
fait passer de l'une à l'autre cran par cran :

- **alignée** (`chromaProfile` absent) : le cran sombre reprend la **chroma absolue** du cran
  clair, plafonnée au maximum tenable. Les deux modes ont la même intensité chromatique, la
  correction est minimale. C'est le défaut, et c'est le bon défaut : un mode sombre n'est pas
  une occasion de redessiner la marque.
- **vive** (`"bell"` ou un tableau) : on parcourt en plus cette fraction du chemin restant
  vers le maximum tenable.

**Toujours un profil, jamais une constante.** Le gamut sRGB laisse énormément de place aux
luminances extrêmes — précisément là où la couleur ne doit pas en prendre : ces crans sont
des **fonds** et des **encres**, pas des aplats. Mesuré : sans profil, le cran 50 sombre d'un
bleu gagnait **+1065 %** de chroma et cessait d'être une surface. D'où la cloche, qui rend la
marge au milieu de la rampe et la refuse aux bouts :

    50: 0,25 · 100: 0,40 · 200: 0,60 · 300: 0,75 · 400-600: 0,85 · 700: 0,75 · 800: 0,60 · 900: 0,40 · 950: 0,25

Un tableau de longueur quelconque est rééchantillonné sur l'échelle. Un nuancier peut
trancher pour lui-même avec `"darkChroma": 0` (aligné) ou une fraction. **Les nuanciers
`kind: "neutral"` sont d'office alignés** : le neutre doit rester neutre.

Deux règles non négociables, appliquées et vérifiées : jamais de régression de chroma par
rapport au mode clair (sauf gamut, et c'est alors signalé), et plafond à `gamutCeiling` du
maximum tenable — une couleur posée au bord exact devient fragile au moindre arrondi, et
c'est la chroma qui paie, donc la teinte perçue qui bouge.

### Ce que darkMode change en sortie

Les fichiers de tokens sont alors suffixés — `<id>-core-colors.light.tokens.json` et
`<id>-core-colors.dark.tokens.json`. Sans `darkMode`, le nom reste `<id>-core-colors.tokens.json`.
Le manifeste porte `modes`, avec le fond, son budget et la formule de dérivation : sans eux,
personne ne pourra recalculer un cran ajouté six mois plus tard.

## staticTokens — les couleurs qui ne s'inversent jamais

```jsonc
"staticTokens": { "white": "#ffffff", "black": "#000000" }
```

Une rampe sombre étant inversée, **aucun cran ne garde sa valeur d'un mode à l'autre**. Il
n'existe donc, par construction, aucun moyen d'exprimer une couleur qui doit rester
littérale : le blanc d'un logo, l'encre sur une photo, un aplat de marque dans une
illustration. Sans ce groupe, les équipes se rabattent sur le cran extrême de la rampe neutre
— qui est un **rôle**, et qui s'inverse — et découvrent le bug une fois le thème sombre livré.

Les valeurs sont écrites à l'identique dans les deux fichiers de tokens et marquées
`$extensions.<id>.static = true`, pour qu'un import Figma puisse les créer comme variables
littérales plutôt que comme alias. `check.mjs` vérifie qu'elles ne bougent pas d'un mode à
l'autre — et que tout le reste, si.

Un littéral peut porter un **alpha** (hex à 8 chiffres : une ombre, un voile) et une **valeur
par mode** quand il ne doit pas s'inverser mais changer quand même :

```jsonc
"staticTokens": {
  "white": "#ffffff",
  "shadow-direct": { "light": "#0f172a1f", "dark": "#00000066", "note": "ombre portée" }
}
```

Avec un alpha, les tokens disent la couleur obtenue sur le fond du mode (composition en sRGB
non linéarisé, comme Figma et les navigateurs), son contraste, et si elle **éclaircit** le
fond : une ombre marine sur un fond presque noir l'éclaircit, seul le noir reste soustractif.
Un littéral par mode est marqué `perMode` ; le contrôle des littéraux l'accepte.

## Les options de la 1.1

| Clé | Ce qu'elle fait |
|---|---|
| `lightChroma` | `"vivid"` (ou une fraction de 0 à 1) : re-saturation en clair. Chaque cran garde sa luminance, donc tous ses contrastes, et prend en cloche une part du chemin jusqu'à la chroma maximale tenable ; jamais sous sa chroma d'avant, jamais au-delà de 96 % du gamut, jamais sur le neutre. Un nuancier s'y soustrait avec `"lightChroma": "seed"`. |
| `cvdModes` | `true` ou `["protan-deutan", "tritan"]` : des modes daltoniens à luminance verrouillée. Seules les teintes des couleurs de statut (`kind: "system"`) tournent, de ±60° au plus, pour rester distinguables (Machado 2009) ; contrastes et règle du nom identiques. Livrés en fichiers de tokens et en modes Figma (`Light-Tritanopia`…). |
| `dataviz` | `true` : palettes de dataviz tirées de l'échelle, en alias de crans (catégorielle, séquentielle, divergente), 3:1 sur les deux fonds, au plus deux crans par famille, sans couleur de statut. `code/dataviz.css` et `ai/palette.json`. |
| `gradients` | `[{ "name": "offre", "stops": [départ, milieu, arrivée], "normalize": true, "target": 0.11 }]` : chaque dégradé mesuré (longueur perceptuelle de chaque moitié, asymétrie) et, avec `normalize`, égalisé en gardant la direction de chaque extrémité. Tokens d'arrêt DTCG et `code/gradients.css`. |
| `surfaces` | `{ "carte": "#f4f6fa" }` : les fonds teintés vérifiés au contrat — le cran où le texte AA commence, famille par famille, et s'il diffère de celui sur blanc. |
| `ramps[].primitives` | les usages que sert une famille (chemins fonctionnels) : dans le guide, la palette JSON et le manifeste, pour fusionner sans perdre d'usage. |
| `caveat` | ce qu'il faut savoir des couleurs avant de lire les chiffres (d'où elles viennent, ce qui n'est pas attesté) : en tête du rapport, du guide et du README du paquet. |
| `ladders.shadeLadder` | un barreau imposé ; `hueladder suggest <spec> --ladder` calcule le **barreau médian** d'une palette fournie (la médiane des luminances, cran par cran) et `--write` l'adopte. |

## contract — rendre les promesses vérifiables

```jsonc
"contract": {
  "maxHueDrift": 25,           // dérive de teinte intra-rampe tolérée, en degrés
  "maxRelativeSpread": 0.03,   // facultatif ; sans lui : 3 %, ou deux fois le plancher sRGB du cran s'il est plus grand
  "thresholds": [3, 4.5, 7]    // les seuils dont aucune famille ne doit désaccorder
}
```

Ces valeurs ne changent **aucun calcul** : elles déplacent le contrat d'une note de réunion
vers `check.mjs`, section 6. Ce qui y est vérifié, dans les deux modes :

| Contrôle | Ce qu'il attrape |
|---|---|
| interchangeabilité | une paire de familles qui, au même cran, ne donne pas la même réponse à « ça passe AA ? » |
| dispersion | l'écart de contraste à rang égal, en relatif |
| seuils | le cran où 3 / 4,5 / 7 tombe doit être le même pour toutes les familles |
| monotonie | Y strictement décroissant en clair, croissant en sombre, famille par famille |
| dérive de teinte | la teinte qui tourne le long d'une rampe, contre son cran d'ancrage |
| non-régression de chroma | un cran sombre moins vif que son cran clair sans raison de gamut |
| plafond de gamut | une couleur au-delà de `gamutCeiling` du maximum tenable |
| budget de contraste | un cran hors d'atteinte sur le fond sombre choisi |
| précision de la méthode | l'écart à la cible comparé au **plancher physique** de sRGB |

**Sur les seuils, une mise en garde qui a déjà coûté cher.** L'écart de contraste à rang égal
ne peut **jamais** valoir zéro : la grille hex est discrète. Le meilleur atteignable mesuré
sur 20 familles est de l'ordre de **0,04 point de contraste**, soit environ 1 % en relatif.
Un contrat qui exigerait « écart < 0,001 » serait rouge à vie. Ce qui est atteignable, et ce
qui compte réellement, c'est **zéro franchissement de seuil** — c'est cette formulation-là
qu'il faut écrire dans la documentation du design system.

De même, la précision de la méthode n'est pas jugée dans l'absolu mais contre le meilleur hex
que sRGB offre à cette teinte et à cette chroma : près du bord du gamut, ce plancher vaut
déjà 0,5 % de contraste. Un seuil fixe plus bas serait un faux positif permanent.

## Déclinaisons de teinte : déclarer d'abord, calculer en dernier recours

Avant d'utiliser `hueVariants`, poser la question : **ces couleurs existent-elles déjà ?**

Une marque qui a des dégradés d'offre a presque toujours des paires de couleurs déjà
dessinées, quelque part dans son fichier — et elles ne suivent aucune règle. Mesuré sur un
cas réel : les écarts de teinte entre une offre et ses extrémités allaient de 6° à 63°, les
amplitudes de 0,039 à 0,190. Ce sont des choix de designer, pas une formule.

Les remplacer par du calcul, c'est substituer notre jugement à celui de la marque sur un
actif de marque. **Les déclarer comme nuanciers à part entière** est plus juste, plus simple,
et donne au passage 12 rampes de vraies couleurs pour la couche primitive.

Ce que l'outil apporte alors n'est pas la génération mais la **mesure** : l'asymétrie entre
les deux moitiés d'un dégradé (une était 3,5× plus longue que l'autre), et la possibilité de
normaliser l'amplitude en conservant la direction d'origine — donc l'intention.

`hueVariants` reste utile pour un cas précis : **proposer** les extrémités d'une offre qui
n'existe pas encore. Le calibrer alors sur les régularités des paires existantes plutôt que
sur un ±30° arbitraire.

## hueVariants — les déclinaisons de teinte

```jsonc
"hueVariants": {
  "space": "hsl",                                // "hsl" (défaut) ou "oklch"
  "offsets": [-30, 30],
  "appliesTo": ["coral", "lagoon", "moss"]    // facultatif : tous si absent
}
```

### L'espace de rotation change beaucoup de choses

**`hsl`** — le geste du sélecteur de couleur : on tire le curseur de teinte de 30°, saturation
et luminosité HSL inchangées. C'est ce qu'un designer ferait à la main dans Figma, et la
rotation ne peut jamais sortir du gamut. Mais HSL n'est pas perceptuel : **30° de roue HSL ne
valent pas 30° de teinte perçue**. Mesuré sur un cas réel (13 nuanciers), le facteur va de ×0,36 à ×2,17 selon la
teinte de départ, et il est asymétrique — le −30° et le +30° d'un même nuancier ne sont donc
pas à égale distance de lui. L'artefact affiche la rotation réellement perçue sous chaque
déclinaison.

**`oklch`** — la rotation perceptuelle : l'écart demandé est celui qu'on voit, et les deux
voisines sont symétriques. En contrepartie le gamut sRGB peut ne pas tenir la même saturation
à la nouvelle teinte, et la chroma est alors réduite (le montant est affiché).

Choisir selon l'intention : `hsl` pour reproduire un geste d'outil, `oklch` pour un écart
perceptif contrôlé.

Pour chaque nuancier concerné, deux nuanciers **complets** de plus, générés depuis la couleur
d'ancrage tournée de −30° et +30°. Ils sont affichés en retrait, de part et d'autre de leur
parent : `Coral −30°` · `Coral` · `Coral +30°`.

À quoi ça sert : répondre à « la teinte retenue est-elle la bonne, et que reste-t-il de
libre autour ? ». C'est la question à traiter avant d'ajouter une ligne produit ou une
série de catégories de data-viz.

**N'appliquer qu'aux nuanciers dont la teinte est un choix ouvert.** Une couleur système
ne peut pas tourner de 30° sans cesser de signifier ce qu'elle signifie — un rouge d'erreur
doit rester rouge — et une couleur de marque n'est pas négociable. En pratique : les lignes
produit, rarement autre chose. D'où `appliesTo`. Un nuancier peut aussi trancher lui-même
avec `"hueVariants": true` ou `false`.

Trois garde-fous côté moteur :

- Les déclinaisons sont marquées `derived` et **exclues de toutes les métriques
  comparatives**. Ce sont des hypothèses ; les compter reviendrait à mesurer plusieurs fois
  la même propriété structurelle et à diluer le signal des vraies couleurs.
- Elles sortent dans un **fichier de tokens séparé** (`<id>-hue-variants[.light|.dark].tokens.json`),
  jamais dans le core qui part en production.
- Elles n'ont aucune couleur existante : leur ligne « Existant » est entièrement hachurée,
  ce qui est exact.

En `oklch`, la **perte de chroma** affichée n'est pas un défaut de calcul : le gamut sRGB
n'est pas isotrope. À luminosité égale, un jaune tient beaucoup moins de saturation qu'un
bleu, donc tourner vers l'orange coûte de l'éclat — le chiffre indique combien.

## usagePatterns

```jsonc
{ "label": "Bouton primaire : blanc sur <code>500</code>",
  "fg": "W", "bg": "500", "threshold": 4.5, "ref": "AA · 1.4.3" }
```

`fg`/`bg` : un nom de step, ou `W` (blanc) / `B` (noir). Les 14 patterns par défaut
couvrent le texte courant, les surfaces teintées, les boutons, les bordures et le mode
sombre. Les remplacer quand le client a des patterns propres qui méritent d'être vérifiés.

## Échec du build

Le moteur échoue bruyamment, jamais en silence :

- `seedStep "X" absent de steps`
- `nuancier "Y" : aucune couleur fournie`
- `Invalid hex colour: Z`

Un build qui passe ne garantit pas que la spec est juste — il garantit qu'elle est valide.
Relire les couleurs contre la source.
