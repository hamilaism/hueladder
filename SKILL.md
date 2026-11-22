---
name: hueladder
description: >
  TRIGGER on: hueladder, studio Hueladder, cran (ancien nom), nuancier, color scale, échelle de couleur, color ramp, palette de marque,
  extrapoler des couleurs, générer une échelle 50-950 / 100-900, steps de couleur,
  primitives couleur, tokens couleur d'un design system, "quelle méthode de génération",
  OKLCH, Fusilier, color-shades, Leonardo, HCT / Material tone, APCA, courbe de contraste,
  réparer une palette, palette pas homogène, interchangeabilité des nuanciers, mode sombre
  d'une palette, exporter des couleurs vers Figma / Tokens Studio / Tailwind.
  Compare 10 méthodes de génération d'échelles, plus l'existant comme témoin, sur les vraies couleurs d'une
  marque, produit un artefact d'arbitrage, un régleur à contraste verrouillé, et des tokens
  DTCG prêts pour Figma. Utiliser dès qu'il faut transformer quelques couleurs choisies à la
  main en échelles complètes défendables, ou réparer une palette existante qui n'est pas juste.
---

# Hueladder — des échelles de couleur défendables

Une marque arrive avec quelques couleurs arbitrées à la main. Un design system a besoin
d'échelles complètes, cohérentes entre elles, et défendables en réunion. Cet outil fait le
pont, et surtout il **mesure** ce que chaque option coûte.

Le moteur est du code figé et validé — **ne jamais réécrire la colorimétrie**. Le travail
consiste à extraire les bonnes couleurs, écrire la spec, lancer le build, puis **lire les
résultats et recommander**. C'est cette dernière partie qui a de la valeur pour le client.

## Trois entrées

Demander d'abord ce que la personne vient faire. Le studio ouvre sur les mêmes trois entrées,
qui partagent la spec : on passe de l'une à l'autre sans rien perdre.

- **Auditer** — elle a une palette, ou plusieurs (marques, produits, versions), et veut savoir
  ce qu'elle vaut, sans rien changer. `$C audit a.json b.css --names Marque,Produit` rend, par
  source, la lecture (ce qui a été écarté et pourquoi), la méthode la plus proche, les
  franchissements de seuil, les constats et la décision « garder ou régénérer » ; entre
  sources, les familles alignées, divergentes ou exclusives, les noms différents pour une même
  couleur, la table de triage. `--diff` compare deux versions (chemins perdus, valeurs
  changées, alias) ; `--format decision` écrit la page qui se lit en trois minutes. Présenter
  la lecture **avant** les chiffres. Pour corriger : `$C import` puis le parcours ci-dessous.
- **Comprendre** — elle veut comprendre les méthodes et choisir la sienne. `$C explain`
  (exemple synthétique : neuf couleurs de départ, rien d'autre de fourni) ou `$C explain <spec>` :
  le propos et les constats titrés, chacun calculé depuis les chiffres ; le cadre (espace ≠
  méthode ≠ outil), les cinq familles, une fiche par méthode (ce qu'elle rend égal entre
  teintes, comment elle répartit les crans, quand la choisir, ce qu'il faut savoir), le tableau
  des critères (même verdict à cran égal, écart entre teintes, écart de crans pour 3 · 4,5 ·
  7:1, intervalles, paires, éclat, couleur de départ déplacée : ce qui est bon, le meilleur de
  chaque critère), le contraste de chaque cran face au blanc, méthode par méthode, les usages, le guide de choix, un déroulé de présentation, le protocole et
  ses limites, les autres choix (mode sombre, nomenclature, norme). Ne pas plaider : chaque
  méthode a ses points forts, Fusilier est le défaut de Hueladder pour un critère (des intervalles
  réguliers), pas un classement. Les cibles de chaque méthode (contrastes, Lc, tons, clartés)
  viennent du nombre de crans choisi, jamais de la méthode : on compare à crans égaux. Pour des
  parties prenantes : partir du guide de choix.
- **Créer** — le parcours en sept décisions ci-dessous.

## Créer : le parcours, en conversation

Le studio (`hueladder.html`) pose sept décisions dans un ordre précis ; un agent pose les mêmes,
dans le même ordre, avec `engine/hueladder.mjs`. **Une décision à la fois** : montrer
l'information qui permet de décider (les chiffres, pas un avis), recommander, attendre la
réponse, puis l'écrire dans la spec. Proposer le studio dès que l'interlocuteur est designer et
préfère voir ; la spec passe de l'un à l'autre sans perte.

```bash
C="node <dossier de ce skill>/engine/hueladder.mjs"   # le dossier où se trouve ce SKILL.md
$C help
```

Seule dépendance : Node.js. Toutes les commandes acceptent `--json` (sortie en données, à lire
plutôt que le texte) et `--lang en`. La spec est le seul état : chaque commande la lit, `new`,
`import`, `suggest --write` et `fix` la réécrivent.

**Langue.** Ce skill est écrit en français, mais il sert tout le monde : répondre dans la langue
de la personne, et si elle n'écrit pas en français, passer `--lang en` à `new` et `import` (la
spec garde la langue, les commandes suivantes la suivent) et à `explain` et `audit`.

### 0. Les crans

Demander comment l'équipe nomme ses crans, et combien elle en veut. Par défaut, la grille
50 → 950 (`naming: "grid"`). Si elle veut pouvoir **ajouter un cran plus tard sans rien
déplacer**, proposer `hundreds` (centaines par contraste) ou `shade` (le nom est le contraste,
David Fusilier) ; si elle a déjà des rangs (Radix 1–12, Carbon 10–100), `rank`. Écrire
`naming` et `stepList`. Détails : `references/nomenclatures.md`.

### 1. Entrer

- Une palette existante : `$C import <fichier> --brand Nom --out <id>.json`. Le fichier peut
  être une liste de hex, du CSS/SCSS, une config Tailwind, des tokens DTCG ou Tokens Studio.
  **Répéter à l'utilisateur ce qui a été écarté** (alias, rgba, doublons) : rien ne doit
  disparaître en silence.
- Une seule couleur : `$C new "#2f5bd3" --brand Nom --out <id>.json`.
- Depuis Figma : `references/extracting-colors.md`. Lire le texte affiché, pas le nom du
  calque, et balayer tout le fichier avant de conclure qu'une marque n'a qu'une couleur.

### 2. Diagnostic

`$C diagnose <id>.json` rend les constats, du plus grave au moins grave, chacun avec ses
actions numérotées (renommer, remplacer, retirer, écarter la teinte, régénérer, garder et
documenter). Les présenter **un par un**, avec la phrase et les chiffres du constat, et
demander laquelle appliquer : `$C fix <id>.json <constat> <action>`. Une exception gardée
part dans la spec (`accepted`, `notes`) et ne revient plus.

`$C suggest <id>.json` dit ce qui manque (un neutre teinté de la marque, les quatre couleurs
système placées hors des teintes déjà prises) ; `--write` les ajoute, après accord.

Partie d'une palette existante : `$C suggest <id>.json --ladder` donne le **barreau médian**
(la médiane des luminances fournies, cran par cran) et son écart au barreau par défaut ; un
écart faible veut dire que la palette suivait déjà une règle. `--write` l'adopte, après accord.
Une couleur système trop proche d'une couleur d'identité reçoit trois options chiffrées
(assombrir, tirer la teinte, valeur éprouvée) : la marque ne bouge pas, c'est le système qui
s'écarte.

### 3. Générer

`$C compare <id>.json` : chaque méthode, si elle tiendra le contrat, son écart moyen aux
couleurs d'origine (ΔE) et ses croisements de seuil. Le contrat, ce sont les contrôles de
l'étape Vérifier, dont la règle du nom (un même écart de crans garantit le même contraste sur
toutes les teintes). Fusilier est le défaut de Hueladder, en tête de la liste : une préférence pour
des intervalles réguliers, pas un classement. Choisir sur ces chiffres et sur le critère qui
compte pour l'équipe (`$C explain` les compare critère par critère). Écrire `coreMethod`. Lire les résultats :
`references/reading-results.md`, `references/methods.md`.

Éclat : `"lightChroma": "vivid"` re-sature en clair, à luminance constante (donc sans toucher
un seul contraste), en cloche, jamais sous la chroma d'avant ni au-delà de 96 % du gamut. À
proposer quand l'équipe trouve la rampe terne ; le neutre n'y touche pas.

### 4. Régler (facultatif)

Le régleur (`tuner.html`, produit par `build`) verrouille le contraste et laisse la teinte et
l'éclat libres. Sans lui : écrire les valeurs dans `ramps[].tuned` (`{ "500": "#…" }`),
`"coreMethod": "tuned"`, `"tunedBase": <méthode>`, puis `$C check` : une valeur hors du
barreau de luminance casse la garantie, et le contrôle le dira. `references/tuner.md`.

### 5. Mode sombre

Trois décisions, dans cet ordre :

1. **Le fond.** Il fixe le contraste maximal possible (`#121212` : 18,73:1). Trop clair, les
   derniers crans n'atteignent plus leur contraste.
2. **La méthode.** `$C compare <id>.json --dark --bg "#121212"` juge chacune sous WCAG 2 (la
   règle du nom survit-elle ?) et sous APCA (le texte reste-t-il aussi lisible qu'en clair ?).
   `mirror-wcag` par défaut : la seule qui transporte exactement la règle. `mirror-bridge` si
   l'équipe juge aussi en APCA : la règle tient, le texte gagne 7 à 17 Lc au milieu de
   l'échelle, au prix de seuils atteints un cran plus tôt qu'en clair. Les autres servent de
   témoins.
3. **L'éclat.** Garder la chroma du clair (les systèmes mesurés gardent 90 à 100 % de la
   chroma permise) ; `chromaProfile: "bell"` ou `desaturate` (surfaces seulement) sont des
   options à justifier.

Écrire `darkMode`. Ajouter `staticTokens` pour ce qui ne s'inverse pas (un blanc qui doit
rester blanc). Sources et mesures : `references/mode-sombre/recherche.md` et
`references/mode-sombre/perceptif.md`.

### 6. Vérifier

`$C check <id>.json` : le contrat du système (interchangeabilité, règle du nom paire par paire
dans les deux modes, monotonie, teinte, chroma, gamut, budget). Code de sortie 1 s'il y a du
rouge. Chaque rouge renvoie à une décision précédente : y retourner plutôt que de livrer. Un
écart voulu s'accepte dans le studio (étape Vérifier) et se documente (`assumed`).

`node engine/check.mjs` vérifie l'outil lui-même (colorimétrie, rendu, déterminisme, studio) :
le lancer après toute modification du moteur. Sans Chrome, les sections de rendu sont sautées :
le dire plutôt que de conclure « tout est vert ».

`$C verify <tokens.json> [--dark <tokens.json> --bg #hex] [--rule N]` vérifie des fichiers
**livrés** (retouchés, exportés, recopiés), pas la sortie du moteur : validité (aucun `null`,
un type), monotonie, seuils au même cran pour toutes les familles, règle du nom relue dans
les fichiers. Des fonds teintés à tenir se déclarent dans `surfaces` : le contrat dit où le
texte AA commence sur chacun.

### 7. Livrer

`$C export <id>.json --format package --out livraison` écrit un dossier par destination :

- `code/` : variables CSS (sombre sous `[data-theme="dark"]`), Tailwind 4 (`@theme`),
  Tailwind 3, tokens DTCG ;
- `figma/` : un fichier par mode, à glisser ensemble dans le panneau Variables (couleurs au
  format objet de l'import natif) ;
- `tokens-studio/tokens.json` : un jeu par mode, thèmes pour la version Pro ;
- `ai/` : `color-guide.md` (la règle, le rôle de chaque cran) et `palette.json` (les mêmes
  informations en données), à joindre au contexte d'un agent qui construit des interfaces ;
- la spec, la migration (palette importée) et un README.

Un seul format : `--format css | tailwind | tailwind4 | dtcg | dtcg-dark | guide | palette |
migration`. Le rapport d'arbitrage (`index.html`) et le régleur : `$C build <id>.json --out
<dossier>` (identique à `node engine/build.mjs`). Le studio produit les mêmes fichiers au bit
près.

**Hueladder propose une échelle, pas un système sémantique.** Les tokens et le guide décrivent
l'usage de chaque cran (fond, bordure, texte, avec quels crans il tient AA) ; ils n'attribuent
pas de rôles (`action.primary`, `surface.default`…). Ce mapping reste une décision de l'équipe.

Pour une mission client, copier le moteur dans le dossier du client
(`cp -R engine clients/<client>/hueladder`) : le livrable reste reproductible sans
dépendre d'une version future de l'outil.

Options du paquet, à proposer selon le produit : `"cvdModes": true` (modes daltoniens à
luminance verrouillée : les teintes de statut tournent pour rester distinguables, rien d'autre
ne change), `"dataviz": true` (palettes de dataviz en alias de crans ; au-delà de quatre
séries, un second codage), `gradients` (dégradés mesurés et normalisés, tokens d'arrêt).
Partie d'une palette, le paquet contient aussi `decision.md`, la page « garder ou régénérer ».

## Ce qu'il ne faut pas faire

- **Ne pas réimplémenter ΔE2000, APCA ou CAM16.** Ils sont dans `lib/`, validés contre les
  vecteurs publiés. Une réimplémentation à la volée sera fausse.
- **Ne pas amputer l'artefact.** Les 5 groupes de graphiques, le testeur de paires, les usages
  conventionnels, les matrices et l'annexe font partie du livrable.
- **Ne pas choisir la méthode avant d'avoir lu les chiffres.** `fusilier` est un défaut
  raisonnable, pas une conclusion.
- **Ne pas prendre Tailwind pour référence esthétique.** Son interchangeabilité est mauvaise
  (mesurable dans l'artefact). Il sert de témoin « palette dessinée à la main », rien de plus.
  La référence perceptive, ce sont les couleurs du client.
- **Ne pas inventer de couleurs.** Tout ce qui est dans `anchors` vient d'une source vérifiable.
- **Ne pas promettre un écart de contraste nul entre teintes.** La grille hex est discrète : le
  meilleur atteignable sur 20 familles est de l'ordre de 0,04 point, soit ~1 % en relatif. Le
  chiffre qui s'écrit dans la doc du design system, c'est **zéro franchissement de seuil**.
- **Ne jamais moyenner deux couleurs sur leurs composantes RGB.** La moyenne déplace la
  luminance, donc le contraste, donc le sens de l'échelon. Quand un client hésite entre deux
  variantes, la moyenne se fait **sur la chroma en OKLCh**, à luminance et teinte constantes
  (`blendVariants` dans `lib/tune.mjs`) — mesuré, la moyenne RGB se trompe de 9 % sur Y.
- **Ne pas re-saturer un mode sombre uniformément.** Sans profil en cloche, les crans extrêmes
  deviennent des aplats au lieu de rester des fonds : mesuré, +1065 % de chroma sur un cran 50.

## Références

| Fichier | Quand l'ouvrir |
|---|---|
| `references/audit.md` | auditer : quoi donner, dans quel ordre lire et présenter, les seuils et pourquoi |
| `references/brand-spec.md` | écrire la spec : toutes les clés et leurs effets |
| `references/reading-results.md` | interpréter l'artefact et formuler la recommandation |
| `references/extracting-colors.md` | sortir les couleurs de Figma proprement |
| `references/methods.md` | le cadre (espace ≠ méthode ≠ outil), les cinq familles, chaque méthode, la conformité aux librairies |
| `references/tuner.md` | le régleur à contraste verrouillé |
| `references/studio.md` | le studio Hueladder : parcours, lecture des imports, diagnostic, exports |
| `references/lecons.md` | ce que les missions ont appris — à relire avant de recommander |
| `references/feuille-de-route.md` | ce qui manque encore, avant de promettre une fonction |
| `references/nomenclatures.md` | les façons de nommer les crans (rang, luminosité, contraste) et leurs règles |
| `references/mode-sombre/recherche.md` | les méthodes de mode sombre documentées, sources et mesures |
| `references/mode-sombre/perceptif.md` | méthodes « perceptives » évaluées, et pourquoi `mirror-bridge` |
| `references/benchmark.md` | les autres outils, ce que Hueladder fait de plus, et les formats de livraison (Figma, Tokens Studio, code) |
