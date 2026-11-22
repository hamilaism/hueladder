# Le studio Hueladder

`hueladder.html`, à la racine du dépôt, est une page unique. Un double-clic l'ouvre, sans serveur
ni installation. Elle embarque le moteur complet (`engine/lib/`), le régleur et l'artefact de
comparaison. On la régénère avec :

```bash
node engine/studio.mjs            # → hueladder.html
```

Les deux pages historiques restent là où elles étaient (`engine/template.html`,
`engine/tuner.template.html`). Le studio les intègre telles quelles et ne les remplace pas.

## Trois entrées

La page s'ouvre sur trois entrées, toujours visibles en onglets dans l'en-tête. Elles
travaillent sur la même spec : on passe de l'une à l'autre sans rien perdre.

| Entrée | Pour qui, pour quoi | Ce qu'elle livre |
|---|---|---|
| **Créer** | partir d'une couleur, ou d'une palette à refaire, et livrer un système | les sept étapes ci-dessous, le paquet de livraison |
| **Auditer** | mesurer une palette, ou plusieurs (marques, produits, versions), sans rien changer | la lecture de chaque source, la méthode la plus proche, les constats, les sources face à face, le triage, le diff de deux versions, la décision « garder ou régénérer » (rapport et page de décision en Markdown) |
| **Comprendre** | comprendre ce que chaque méthode rend égal et ce qu'elle coûte, choisir la sienne, et pouvoir le présenter, sur un exemple ou sur ses couleurs | le propos et les constats calculés, le cadre, les familles, une fiche par méthode (avec ses couleurs), six graphiques aux mêmes axes, l'écart entre teintes au cran d'ancrage, les usages en couleurs, le tableau des critères (ce qui est bon, le meilleur en gras), le guide de choix, un déroulé de présentation et l'argumentaire en Markdown, le protocole et ses limites, les autres choix (mode sombre, nomenclature, norme) |

Les passages : « Corriger dans Créer » emporte une source auditée au diagnostic ; « Créer
avec ces couleurs » et « Auditer mes couleurs » relient Comprendre aux deux autres.
L'exemple de Comprendre est synthétique : neuf couleurs de départ, rien d'autre de fourni.
Il se montre partout, sans donnée de client. Le moteur le sait (`demo: true`) : il n'y fabrique
pas de méthode « Existant », et le rapport complet ouvert depuis l'exemple n'a pas de section
« couleurs déjà choisies ». Chaque fiche dit ses réglages ; un panneau montre une teinte
passée par toutes les méthodes, côte à côte, avec sous chaque case son contraste face au blanc
et face au noir, en gras dès 4,5:1 (le même tableau, toutes teintes, dans `hueladder explain`).

Dans Auditer, une source peut être déclarée **mode sombre d'une autre** (avec son fond) : elle
n'entre pas dans le face-à-face, elle se lit contre sa palette claire (monotonie, seuils au
même cran, seuils identiques entre modes). Chaque source reçoit aussi les contrôles des
fichiers livrés (ceux de `hueladder verify`) et sa distinguabilité sous trois daltonismes.

Ce que Créer gagne en 1.1 : le **barreau médian** et les **trois options de couleur système**
à l'étape Diagnostic, l'**éclat vif en clair** à l'étape Générer, les **modes daltoniens** et
les **palettes dataviz** en options du paquet à l'étape Livrer. Les clés de spec sans écran
(`surfaces`, `gradients`, `staticTokens`, `contract`) traversent le studio sans se perdre.

Le moteur est le même que la CLI : `lib/audit.mjs` (`hueladder audit`, `hueladder verify`) et
`lib/explain.mjs` (`hueladder explain`) ; `lib/cvd.mjs`, `lib/dataviz.mjs`, `lib/gradient.mjs` pour
les modes daltoniens, la dataviz et les dégradés. Les seuils de l'audit sont écrits dans le code et dans le rapport : sous
ΔE 0,5 deux valeurs sont la même, à partir de 10 un même nom désigne deux couleurs, sous 5
en moyenne deux noms désignent sans doute la même famille ; bandes d'impact sous 7 (quasi
invisible), de 7 à 15 (perceptible), au-delà (visible).

## Le principe : la spec est l'état

Le studio ne fait qu'éditer une spec de marque (format : `brand-spec.md`). Chaque étape en
modifie une partie, et le moteur la reconstruit à chaque fois. L'onglet « Spec » de l'étape
Livrer exporte cette spec, et `node engine/build.mjs <spec>.json` en redonne **exactement**
les mêmes tokens. `check.mjs` le vérifie : il exécute le moteur tel qu'il est embarqué et
compare le résultat à celui de la ligne de commande.

Conséquence pour un agent : **tout ce que fait le studio se fait aussi sans lui**. Il suffit
d'écrire la spec et de lancer le build. Le studio sert aux humains, la spec sert aux deux.

## La chaîne de décisions

Chaque étape pose une décision et donne l'information utile avant de la demander. L'ordre des
étapes suit les dépendances : on ne règle pas une rampe avant d'avoir choisi la méthode qui
la calcule, et le sombre se déduit du clair réglé.

| Étape | Décision | Ce que l'utilisateur sait avant de décider | Dépend de |
|---|---|---|---|
| 1 · Entrer | quelles couleurs forment le système, et la base de chaque nuancier | ce que le studio a lu, et ce qu'il a écarté | — |
| 2 · Diagnostic | corriger, garder, compléter | chaque constat chiffré, avec ses actions | 1 |
| 3 · Générer | la méthode | un verdict et le résumé des dix méthodes sur ses couleurs | 1, 2 |
| 4 · Régler | l'ajustement de chaque cran | le pavé à contraste verrouillé, l'écart à la couleur d'origine | 3 |
| 5 · Mode sombre | le fond, puis la méthode, puis l'éclat | chaque option comparée sur sa marque, avec sa source | 4 |
| 6 · Vérifier | livrer, ou revenir corriger | le contrat, et l'étape qui répare chaque point rouge | 1 à 5 |
| 7 · Livrer | les formats | ce que contient chaque fichier et à qui il sert | 6 |

Le jeu de crans, dans l'en-tête, reste modifiable à tout moment : il ne change aucune couleur
déjà livrée, seulement celles qu'on livre.

## Créer : les sept étapes

| Étape | Ce que fait l'utilisateur | Ce que ça écrit dans la spec |
|---|---|---|
| 1 · Entrer | colle une palette (porte A) ou choisit une couleur (porte B), renomme, change le rôle, retire, ajoute | `ramps[].anchors`, `seed`, `kind` ; `pinDefault: false` en porte A |
| 2 · Diagnostic | lit le diagnostic, ajoute sur place le neutre ou les couleurs système manquantes | `ramps` si ajout |
| 3 · Générer | choisit un parti pris : tout régénérer (`fusilier`, le Fusilier adapté, le défaut ; `colorshades`, l'original, juste après ; de même `leonardo`, l'original, et `leonardoAdapted`), tout conserver (`anchored`), ou une autre méthode dans la comparaison | `coreMethod` / `tunedBase` |
| 4 · Régler | règle teinte et éclat cran par cran, à contraste verrouillé | `ramps[].tuned`, `coreMethod: "tuned"` |
| 5 · Mode sombre | lit comment le sombre est calculé, choisit le fond et le profil d'éclat | `darkMode` |
| 6 · Vérifier | lit le contrat, teste des paires, voit l'aperçu | rien |
| 7 · Livrer | copie ou télécharge les fichiers | rien |

Le bouton **Crans** de l'en-tête ouvre le panneau des nomenclatures : grille 50 → 950 (défaut),
centaines par contraste, contraste façon Fusilier (0–200), ou rang réparti (Radix, Carbon,
Primer…). Chaque nomenclature dit ce qu'un ajout de cran provoque ; on choisit un préréglage,
on retire un cran d'un clic, on en ajoute un par son nom, et la règle s'affiche dans l'unité de
la nomenclature. Le studio écrit `naming` et `stepList` dans la spec (voir `brand-spec.md`).
Chaque nomenclature garde sa configuration : passer à une autre puis revenir retrouve ses crans.
Une configuration qui s'écarte de son préréglage porte le tag « modifié », dans le panneau et
dans le bouton de l'en-tête, avec un bouton pour revenir au préréglage.
Les rôles de l'aperçu (texte, bordure, bouton) sont choisis par le seuil qu'ils doivent tenir,
pas par un nom de cran : « 600 » ne veut pas dire la même chose d'une nomenclature à l'autre.

### Lecture de ce qu'on colle (porte A)

Formats reconnus : liste de hex, variables CSS/SCSS, config Tailwind (blocs imbriqués), tokens
DTCG (`$value`) ou Tokens Studio (`value`), et spec Hueladder complète, qui est rechargée telle
quelle.

- Les couleurs sont regroupées **par le nom d'abord** : `--color-blue-500` donne le nuancier
  `blue` et le rôle `500`. Les mots génériques (`color`, `core`, `palette`…) sont ignorés.
- **À défaut de nom**, elles sont regroupées par teinte OKLCH. Les quasi-gris (C < 0,035) vont
  dans `neutral`, et chaque groupe prend le nom de sa teinte (`blue`, `teal`…). Le rôle est
  alors le cran que le contraste de la couleur lui donne.
- Tout ce qui est écarté est listé avec sa raison : alias `{…}`, couleur transparente (un alpha
  se pose sur une couleur pleine), format non hexadécimal, doublon exact. Un import dont on ne
  sait pas ce qu'il a perdu n'est pas un import fidèle.

Quand un nuancier a plusieurs couleurs, l'une porte la marque « base » : c'est elle qui donne
sa teinte et son éclat à tout le nuancier généré. Un clic sur une autre couleur la désigne.

Le regroupement se corrige en renommant, en changeant le rôle ou en retirant un nuancier.
Déplacer des couleurs d'un nuancier à l'autre, ou fusionner deux nuanciers, n'est **pas** dans
l'interface : c'est un geste d'expert, qui se fait en éditant la spec (à la main ou par un
agent). L'interface le proposait en V1, et le résultat n'était pas lisible ensuite : les
couleurs déplacées étaient régénérées depuis l'identité du nuancier d'accueil.

### Le diagnostic (étape 2)

Chaque constat est une phrase générée à partir des chiffres du moteur, jamais écrite à la
main. Dans l'ordre de gravité :

- **cran mal nommé** : le rôle numérique diffère du rang que mérite le contraste (`anchorMap`,
  `naturalStep`). On ajoute le contraste du texte blanc quand il échoue en AA.
- **crans non interchangeables** : franchissements de seuil à cran égal dans l'existant
  (`metrics.existing.interchangeability`).
- **familles en doublon ou voisines** (`proximity`).
- **pas irrégulier** : ΔE2000 entre couleurs existantes consécutives, alerte au-delà d'un
  rapport 2,5.
- **doublon de rang** et **teinte qui tourne** (> 15° dans un nuancier).

Chaque constat porte ses actions, qui modifient le système d'un clic et relancent le
diagnostic : renommer la couleur (ou toute la famille quand le cran visé est déjà pris),
la remplacer par la valeur générée, retirer une couleur en doublon de rang ou un nuancier en
doublon, régénérer, ou garder et documenter l'exception. Les exceptions documentées partent
dans la spec (`notes`), donc dans le rapport et le guide d'usage.

Une couleur système trop proche de la marque ne se fusionne jamais avec elle : l'action
proposée écarte la teinte de la couleur système, dans la plage où son rôle reste reconnaissable.
Une couleur qui n'a pas d'équivalent dans sa rampe régénérée (ΔE > 10, typiquement un
quasi-blanc rangé dans une famille colorée) est signalée « hors famille », avec l'action de la
déplacer dans le neutre.

S'il manque un neutre ou l'un des quatre rôles système (erreur, succès, alerte, info,
reconnus aussi sous leurs noms courants : `danger`, `positive`, `caution`…), la dernière carte
propose de les ajouter sur place. Seuls les rôles manquants sont ajoutés, et chacun prend,
dans sa plage de teinte (erreur 18–36°, succès 135–165°, alerte 50–78°, info 205–262° en
OKLCH), la teinte la plus proche de sa référence qui reste à 30° des couleurs déjà présentes ;
à défaut, la plus éloignée possible.

### Générer (étape 3)

L'étape pose une seule décision, la méthode, et donne l'information avant de la demander :

1. **un verdict** calculé sur ces couleurs : combien de méthodes tiennent le contrat (les
   contrôles de l'étape Vérifier, règle du nom comprise, définie à l'écran), ce que Fusilier,
   la méthode par défaut, coûte (ΔE), et, pour une palette importée, ce que coûterait de garder les
   couleurs exactes ;
2. **le résumé comparatif**, où l'on choisit : les dix méthodes, Fusilier en tête (marqué « par
   défaut », pas « recommandé »), puis celles qui tiennent le contrat de la plus fidèle à la
   moins fidèle, puis les autres ; pour chacune, la rampe de marque, « contrat tenu » ou ce qui
   casse, et le ΔE. Le rapport complet
   s'ouvre de là ;
3. **le résultat** : tout le système avec la méthode choisie ;
4. **le détail**, replié : toutes les méthodes sur un même nuancier.

Le détail : les dix méthodes de génération du moteur, sur un nuancier au choix, Fusilier en tête : la
rampe produite, les paires hors règle (leur écart de crans promet un seuil sans l'atteindre),
les franchissements (les seuils qui tombent à un cran différent selon la teinte) et l'écart ΔE
avec les couleurs d'origine. Un clic sur une ligne la
choisit. Le rapport complet (graphiques, matrices, testeur) s'ouvre depuis le même panneau.

### Le régleur intégré (étape 4)

C'est `tuner.template.html`, chargé dans une iframe avec `embedded: true` dans ses données.
Trois différences seulement avec la page autonome : le titre et l'export sont masqués, la
frontière du gamut est calculée à l'ouverture de chaque rampe (≈ 250 ms, au lieu de tout
précalculer), et chaque réglage prévient le studio par `postMessage`. Le studio relit alors
l'export « spec » du régleur, par la même route que la ligne de commande.

Changer de méthode ou de jeu de crans efface les réglages : ils ont été faits sur une base
qui n'existe plus.

## Le mode sombre (étape 5)

Le sombre se calcule à partir du clair. L'étape pose trois décisions, dans l'ordre où elles
dépendent l'une de l'autre, et chacune est comparée avant d'être prise. Les méthodes, les
sources et les mesures sont dans `mode-sombre/recherche.md`.

1. **Le fond.** Il agit comme un facteur d'échelle commun : en changer décale toute la rampe
   sombre d'un bloc, sans changer les écarts entre crans, et fixe le budget
   `1,05 / (Y_fond + 0,05)`, le plus fort contraste possible face à lui. Les fonds proposés
   sont comparés avec leur budget, la rampe de marque obtenue et le contraste du 500. Défaut
   `#121212`, seule valeur accompagnée d'une justification publiée (Material 2 : le blanc y
   tient 15,8:1). Le noir pur donne le budget maximal mais accentue le halo du texte clair.
2. **La méthode.** Six méthodes documentées, comparées sur la rampe de marque :

   | Méthode | Principe | Source | Règle du nom |
   |---|---|---|---|
   | Miroir WCAG (défaut) | chaque cran garde, face au fond, son ratio clair face au blanc | Adobe Leonardo | transportée exactement |
   | Pont WCAG / APCA | chaque cran de texte vise son Lc APCA, plafonné par la règle du nom, jamais sous le miroir WCAG | `mode-sombre/perceptif.md` | tenue ; seuils atteints un cran plus tôt qu'en clair |
   | Miroir APCA | chaque cran de texte garde son Lc APCA face au fond | Radix, Somers | texte plus lisible, crans hauts resserrés |
   | Part du budget | chaque cran garde sa part du contraste disponible | Adobe Spectrum | affaiblie (4,5 → 4,25 sur #121212) |
   | Ton inversé | ton HCT T → 100 − T, fond ignoré | Material 3 | seuils déplacés |
   | Crans échangés | 50 ↔ 950, 100 ↔ 900… | Tailwind, Atlassian | seuils déplacés |

   Le verdict de chaque ligne vérifie les deux moitiés de la promesse : dans chaque nuancier,
   les paires séparées de N rangs tiennent leur seuil, et le texte courant devient lisible sur
   le fond au même cran qu'en clair.
3. **L'éclat.** Par défaut, la chroma du clair, dans la limite de ce que l'écran affiche à
   cette clarté. Mesuré sur 16 paires clair/sombre de 8 systèmes (Apple, Material, Primer,
   Fluent, Carbon, Spectrum, Tailwind, Radix) : accents et textes gardent 90 à 100 % de la
   chroma que le gamut permet ; la baisse de vivacité visible vient du gamut. Options :
   « vif, en cloche » (plus de chroma au milieu, comme les fonds teintés de Radix) et
   « atténuer les surfaces » (0 à 40 %, sur les seuls crans sous 3:1 face au fond, comme
   Atlassian ; aucune source ne fixe de pourcentage, d'où 0 % par défaut).

La première version du studio désaturait uniformément de 20 % par défaut : aucune source
primaire ne justifiait ce chiffre, il a été retiré.

## Langues

L'interface, le régleur intégré, le contrat, les descriptions des tokens et le guide d'usage
existent en français et en anglais (bouton
FR / EN de l'en-tête, mémorisé dans le navigateur ; par défaut, la langue du navigateur). Tous
les textes sont dans l'objet `I18N` de `studio.template.html`. La langue part dans la spec
(`lang`), pour que la ligne de commande écrive les mêmes descriptions, et le rapport complet
(`template.html`) la suit.

## Vérification

`node engine/studio.test.mjs` ouvre le studio dans Chrome en `file://`, comme un double-clic,
et exerce chaque fonctionnalité par un geste d'utilisateur : sept formats d'import, les deux
portes, chaque bouton de chaque étape, un glisser dans le régleur, les cinq jeux de crans, le
lien de partage, les deux langues, la largeur téléphone. Il vérifie aussi que la spec exportée
redonne les mêmes tokens par le moteur. `check.mjs` le lance ; `--shots <dossier>` enregistre
une capture par étape.

## Vérifier (étape 6)

Chaque contrôle rouge porte un bouton vers l'étape qui le répare : la méthode (étape 3) pour
l'interchangeabilité, la dispersion, les seuils et la précision ; le réglage (étape 4) pour la
monotonie et la dérive de teinte ; le mode sombre (étape 5) pour la chroma, le gamut et le
budget du fond.

## Ce que livre l'étape 7

**Le paquet** (bouton « Télécharger le paquet », ou `hueladder export --format package`) : une
archive rangée par destination, `code/`, `figma/`, `tokens-studio/`, `ai/`, plus la spec, la
migration et un README (`lib/package.mjs`). Les onglets donnent chaque fichier à l'unité :

- tokens DTCG clair et sombre (`lib/outputs.mjs` → `tokenTrees`, le même code que le CLI).
  Chaque token dit à quoi il sert et avec quoi il se combine, pour deux lecteurs :
  - `$description`, pour la personne qui le survole dans Figma ou son éditeur : « Texte, lien,
    bouton plein (AA) — 4,61:1 sur le fond. Texte AA avec : 50–100. Élément 3:1 avec : 50–300. » ;
  - `$extensions.<id>`, pour la machine : `usage`, `contrast` (fond, blanc, noir), `aaWith`,
    `uiWith`, `replaces` ;
- pour une palette importée, la **table de migration** (`<id>-migration.md`) : chaque couleur
  d'aujourd'hui, le token qui la remplace, l'écart ΔE et la raison (renommée, ajustée, sans
  équivalent, inchangée). La ligne de commande l'écrit aussi ;
- le **guide d'usage** (`<id>-color-guide.md`), écrit pour une IA autant que pour une personne :
  la règle, le rôle de chaque cran, des consignes, les exceptions documentées et un bloc JSON qui reprend tout. La ligne de commande l'écrit aussi ;
- variables CSS, avec le sombre sous `[data-theme="dark"]` ; Tailwind 3 (`tailwind.config.js`) et Tailwind 4 (bloc `@theme`) ;
- la spec, qui rejoue le tout ;
- le rapport complet : l'artefact de comparaison des méthodes, généré sur ces couleurs.

Le lien de partage (« Copier le lien ») encode tout le système dans l'adresse. Rien ne passe
par un serveur.
