# Hueladder — des échelles de couleur défendables

**[Essayer le studio en ligne](https://hamilaism.github.io/hueladder/)**, sans rien installer. *English version: [README.md](README.md).*

Transformer les quelques couleurs qu'une marque a arbitrées à la main en **échelles complètes
défendables**, et pouvoir justifier chaque arbitrage avec des chiffres plutôt qu'avec du goût.

Zéro dépendance. Node seul. Deux pages HTML autonomes en sortie, plus des tokens DTCG.

## Hueladder, le studio

**Ouvrir `hueladder.html` d'un double-clic.** Trois entrées, sur la même spec :

- **Créer** — un système complet à partir d'une couleur, ou d'une palette à refaire ;
- **Auditer** — ce que vaut l'existant, une palette ou plusieurs (marques, produits, versions),
  sans rien changer : constats chiffrés, sources face à face, versions comparées, page de
  décision ;
- **Comprendre** — ce que chaque méthode rend égal d'une teinte à l'autre, ce qu'elle coûte,
  laquelle choisir et de quoi le présenter : le cadre, les familles, une fiche par méthode, six
  graphiques, les usages en couleurs, le tableau des critères, le guide de choix, l'argumentaire
  en Markdown, sur un exemple ou sur tes couleurs.

Créer est le parcours complet dans une seule page, sans terminal : partir d'une palette
existante ou d'une seule couleur, puis
générer, régler chaque nuance à contraste verrouillé, dériver le mode sombre, vérifier le
contrat du système et télécharger le paquet de livraison : un dossier pour le code (CSS,
Tailwind 3 et 4, DTCG), un pour Figma (un fichier par mode, import natif des variables), un
pour Tokens Studio, un pour les IA (guide et données JSON), la spec et la migration.

Le studio n'édite qu'une spec : celle qu'il exporte se reconstruit à l'identique avec
`node engine/build.mjs`, et `check.mjs` le vérifie. Les humains passent par la page, les
agents par la spec, et les deux obtiennent le même résultat. Détail dans
[`references/studio.md`](references/studio.md), suite prévue dans
[`references/feuille-de-route.md`](references/feuille-de-route.md).

Pour le régénérer après une modification du moteur : `node engine/studio.mjs`.

## Hueladder, la ligne de commande

`node engine/hueladder.mjs` fait les mêmes gestes, pour une personne au terminal ou pour un agent :
`audit` (une ou plusieurs palettes, `--diff` pour deux versions, `--dark` pour un sombre
déclaré, `--format decision`), `verify` (des tokens livrés), `pairs` (les paires par état),
`figma` (un fichier Figma relevé par `engine/figma-scan.js`), `explain` (la science des
méthodes, sur un exemple neutre ou une spec), `group` (le regroupement proposé),
`perceptual` (la page d'un test perceptif),
`new`, `import`, `suggest`, `diagnose`, `fix`, `compare` (et `--dark`), `check`, `export`
(`--format package` pour le paquet complet), `build`. Chaque commande lit la spec, certaines la
réécrivent, toutes acceptent `--json`. `SKILL.md` en fait un parcours en conversation.
`llms.txt` est le point d'entrée d'un agent ou d'un LLM : les commandes, et la doc dans l'ordre où la lire
(`references/audit.md` pour auditer, `references/methods.md` pour la science).

---

## Le problème

Un client arrive avec huit couleurs produit et quatre couleurs système. Le design system en
demande onze nuances chacune, cohérentes entre elles, accessibles, et qui ressemblent encore
à la marque. Trois questions se posent, et on ne sait en général répondre à aucune :

1. **Quelle méthode de génération ?** Il y en a une dizaine, elles donnent des résultats très
   différents, et le débat tourne vite au goût personnel.
2. **Que valent les couleurs actuelles ?** Sont-elles régulières ? Bien nommées ? Est-ce que
   `500` veut dire la même chose sur toutes les rampes ?
3. **Comment rendre le résultat beau sans casser l'accessibilité ?**

Cet outil répond aux trois, en mesurant.

## Ce qu'il produit

| | |
|---|---|
| **`index.html`** | l'artefact d'arbitrage : 12 méthodes de génération comparées, plus l'existant comme témoin, sur les vraies couleurs du client, 8 métriques, 5 groupes de graphiques, testeur de paires, usages conventionnels, matrices de contraste. À ouvrir en réunion. |
| **`tuner.html`** | le régleur : ajuster teinte et éclat pendant que le contraste reste **verrouillé**, comparer les nuanciers entre eux, et récupérer le système complet. |
| **`<client>-core-colors.tokens.json`** | les tokens DTCG, prêts pour `figma_import_tokens`. Avec un mode sombre déclaré, deux fichiers : `.light.` et `.dark.` |
| **`<client>-color-guide.md`** | le guide d'usage, pour les personnes et les IA : la règle, le rôle de chaque cran, un bloc de données (pas de rôles sémantiques imposés). |
| **`<client>-migration.md`** | avant / après : chaque couleur existante, ce qu'elle devient, de combien elle bouge et pourquoi. |
| **`<client>-hue-variants[.light\|.dark].tokens.json`** | les déclinaisons de teinte, si la spec en demande : des hypothèses, hors de la collection de production. |
| **`data.json`** | toutes les mesures, lisibles par programme : c'est la source la plus directe pour un agent. |
| **`<client>-core-colors.manifest.json`** | le contexte pour créer les variables Figma : la méthode, la règle de contraste, et — s'il y a un mode sombre — le fond, son budget et la formule de dérivation. |

Les deux pages sont autonomes : aucun réseau, aucun serveur, elles s'envoient par mail et
s'ouvrent d'un double-clic. Mode clair et sombre.

---

## Démarrer

```bash
git clone https://github.com/hamilaism/hueladder.git && cd hueladder
./install.sh                    # installe le skill pour Claude Code (optionnel)
cd engine && node check.mjs     # tout doit être vert
```

### Sur un nouveau client

```bash
mkdir -p clients/macorp && cp -R engine clients/macorp/hueladder
cd clients/macorp/hueladder
cp brands/_template.json brands/macorp.json   # puis remplir
node build.mjs brands/macorp.json
node check.mjs
open index.html
```

**Toujours copier `engine/` chez le client.** Le livrable doit rester reproductible sans
dépendre de ce dépôt ni d'une version future de l'outil. Le dossier `clients/` est ignoré par
git : rien du travail client n'est versionné ici.

---

## Ce qu'il faut fournir

Un seul fichier JSON. Les couleurs, et rien d'autre.

```jsonc
{
  "id": "macorp",
  "brand": "MaCorp",
  "accent": "#2f5bd3",
  "steps": ["50","100","200","300","400","500","600","700","800","900","950"],
  "seedStep": "500",
  "ramps": [
    { "name": "brand", "label": "Bleu MaCorp", "kind": "brand",
      "anchors": { "default": "#2f5bd3" } },

    { "name": "error", "label": "Error", "kind": "system",
      "anchors": { "background": "#ffeeed", "light": "#f1584c",
                   "default": "#d92d20", "dark": "#a60b00" } }
  ]
}
```

Un nuancier accepte **autant de couleurs que la marque en a déjà** — c'est le cœur du
dispositif. Le moteur place chacune sur l'échelle à partir de son seul contraste face au noir,
indépendamment de toute méthode, et signale celles dont le nom ne correspond pas à la clarté
réelle : *« cette couleur s'appelle 500, mais c'est un 200, et du texte blanc dessus échoue »*.

Les noms de rôles sont libres. Le nombre de crans aussi — les garanties de contraste se
recalculent (11 crans → Δrang ≥ 6 ⇒ AA ; 9 crans → Δ ≥ 5).

### Les options qui servent souvent

```jsonc
"extraSteps": ["0", "25", "975", "1000"],   // crans hors grille, pour la rampe neutre
"hueVariants": { "space": "hsl", "offsets": [-30, 30], "appliesTo": ["coral", "lagoon"] },
"pinDefault": false,                         // le Default prend son rang naturel
"darkMode": { "background": "#121212" },
"staticTokens": { "white": "#ffffff", "black": "#000000" }
```

**`extraSteps`** — une rampe neutre a besoin de finesse près du blanc (surfaces d'interface)
et près du noir (mode sombre), là où l'échelle logarithmique n'en donne pas. `0` est le blanc
pur et `1000` le noir pur, quelle que soit la méthode. Ces crans restent **hors de la règle de
contraste** : seuls les nuanciers qui les déclarent les utilisent.

**`hueVariants`** — ajoute, autour des nuanciers désignés, deux nuanciers complets à ±30° de
teinte, pour explorer le voisinage avant d'ajouter une ligne produit. Rotation en HSL (le geste
du sélecteur de couleur) ou en OKLCH (écart perceptif contrôlé). Ce sont des hypothèses :
exclues des métriques et livrées dans un fichier de tokens séparé.

**`darkMode`** — dérive une seconde rampe complète par égalité de contraste contre le fond
choisi. Voir plus bas : c'est la partie qui décide si le design system tiendra ou non une fois
le thème inversé.

**`staticTokens`** — les couleurs qui ne s'inversent **jamais** : le blanc d'un logo, l'encre
sur une photo. Une rampe sombre étant inversée, aucun cran ne garde sa valeur d'un mode à
l'autre ; sans ce groupe, rien ne peut exprimer « ce blanc doit rester blanc ».

Format complet : [`references/brand-spec.md`](references/brand-spec.md).
Gabarit prêt à remplir : [`engine/brands/_template.json`](engine/brands/_template.json).

---

## La méthode, en bref

### L'interchangeabilité est le vrai enjeu

Une échelle où le step `400` a le même contraste sur **toutes** les rampes permet d'écrire une
règle une fois pour toutes : *« du texte 900 sur un fond 100 passe AA, quelle que soit la
teinte »*. Sans ça, chaque usage doit être vérifié teinte par teinte et les exceptions
mémorisées — c'est ce qui rend un design system pénible à vivre.

La méthode **Fusilier** (color-shades) l'obtient par construction : chaque cran vise un
contraste précis face au noir, `21^(shade/200)`. L'écart de rang détermine donc le contraste,
et la garantie se lit dans le nom du step. C'est un défaut raisonnable, pas une conclusion :
l'artefact compare et laisse arbitrer.

### Verrouiller le contraste ne coûte qu'un degré de liberté

Le contraste face au blanc et face au noir ne dépendent que de la luminance relative Y, et
ils sont liés : `C_blanc × C_noir = 21`, toujours. Verrouiller « le contraste » revient donc à
verrouiller **un seul nombre**.

Sur les trois degrés de liberté d'une couleur, il en reste **deux** entièrement libres : la
teinte et l'éclat. C'est là-dessus que travaille le régleur — la machine garantit
l'accessibilité, le designer récupère tout le reste.

### Le mode sombre n'est pas une seconde palette

C'est le **même barreau de contraste relu contre un autre fond**. Pour chaque cran, on prend le
contraste que la couleur claire tient face au blanc, et on cherche celle qui tient le même
face au fond sombre :

    Y_sombre = C_clair × (Y_fond + 0,05) − 0,05

C'est ce qui garantit qu'un échelon **porte le même sens dans les deux modes** : le seuil AA
tombe au même cran des deux côtés. Sans cette égalité, chaque usage doit être re-testé teinte
par teinte en sombre — mesuré sur un design system réel, l'écart de contraste à cran égal
passait de 1,84 point en clair à **4,10 en sombre**, et jusqu'à 7,37 au cran 700.

Deux conséquences qu'on découvre tard si on ne les anticipe pas :

- **Un fond sombre non noir ne porte pas 21:1.** `#0e0d0d` plafonne à **19,41:1**. Les crans
  au-delà sortent en blanc pur, et l'outil les nomme au lieu de les laisser passer.
- **L'éclat ne se reprend pas uniformément.** Le gamut est très large aux luminances extrêmes,
  précisément là où la couleur ne doit pas s'en servir : ces crans sont des fonds et des
  encres. Sans profil en cloche, le cran 50 d'un bleu gagnait **+1065 %** de chroma et cessait
  d'être une surface.

### Ce que l'outil sait mesurer

- **Le rang mérité** de chaque couleur existante, contre le rang qu'elle occupe.
- **La régularité** d'une palette : l'écart entre crans consécutifs, souvent du simple au
  quintuple sur une palette dessinée à la main.
- **L'interchangeabilité, formellement** : toutes les paires de familles à rang égal, dans les
  deux modes, avec le nombre de **franchissements de seuil** — combien de substitutions
  changeraient la réponse à « est-ce que ça passe 3 / 4,5 / 7 ». C'est le chiffre qui dit si
  l'on peut échanger une teinte contre une autre au même cran sans revérifier.
- **La marge de gamut** réellement disponible — souvent nulle, ce qui invalide l'intuition
  « il suffit de saturer davantage ».
- **La dérive d'identité** : de combien chaque méthode s'éloigne de la couleur de marque.
- **La dérive de teinte le long d'une rampe**, contre son cran d'ancrage. Invisible sur un
  nuancier — l'œil compare les crans voisins, jamais les extrémités — et pourtant c'est ce qui
  fait qu'une rampe cesse d'être une couleur déclinée pour devenir deux couleurs qui partagent
  un nom.
- **L'asymétrie clair/sombre**, à regarder pour un design system multi-mode ; elle vient de la
  répartition des crans, pas du fond qu'une méthode vise.
- **Le décalage de clarté perçue** : à contraste mesuré identique, une couleur saturée paraît
  plus claire qu'un gris (Helmholtz-Kohlrausch), jusqu'à 42 % d'un cran. L'outil l'affiche
  plutôt que de faire comme si l'interchangeabilité était parfaite.

### Un chiffre à ne pas promettre

L'écart de contraste entre deux familles au même cran ne peut **jamais** valoir zéro : la
grille hex est discrète. Le meilleur atteignable, mesuré sur 20 familles, est de l'ordre de
**0,04 point** — environ 1 % en relatif. Écrire « écart < 0,001 » dans la documentation d'un
design system produit un contrôle rouge à vie. Ce qui est atteignable, et ce qui compte, c'est
**zéro franchissement de seuil**.

---

## Fiabilité

La colorimétrie n'est pas approximée :

| Module | Validé contre |
|---|---|
| `lib/deltae.mjs` | CIEDE2000 — les 34 vecteurs de Sharma, Wu & Dalal |
| `lib/apca.mjs` | APCA 0.0.98G-4g — les vecteurs apca-w3 |
| `lib/cam16.mjs` | CAM16 / HCT — material-color-utilities |
| `lib/tune.mjs` | verrou de luminance, barreau sombre, profil de chroma, moyenne de variantes — 8 000 assertions sur toute la roue |
| `engine/conformance` | chaque méthode face à sa librairie d'origine : mix et Tailwind 4.3 au hex près, HCT à ΔE 0,6, easing identique hors bord du gamut ; Leonardo original identique au hex près, portage de la librairie d'Adobe (le Leonardo adapté en change le seul gamut, à teinte constante) ; Fusilier original (color-shades) identique au hex près, face aux fonctions de color-shades (`references/methods.md`) |

```bash
node check.mjs
```

Contrôle en un coup, six sections : colorimétrie, généricité du moteur, rendu réel des deux
pages dans un navigateur, déterminisme du build, refus explicite des entrées invalides, et
**le contrat du système** — ce que la palette promet, dans les deux modes.
**Doit être vert avant toute livraison.**

La section 6 est appliquée à la fixture **et à toute autre spec présente dans `brands/`** —
donc, une fois le moteur copié chez le client, à la sienne. C'était un trou réel : `check.mjs`
pouvait être vert alors que la spec livrée était fausse, puisqu'elle n'était jamais construite.

Ce qu'elle vérifie : zéro franchissement de seuil à rang égal · l'écart de contraste en relatif
· le cran où 3 / 4,5 / 7 tombe, identique pour toutes les familles · la monotonie de Y famille
par famille · la dérive de teinte intra-rampe · la non-régression de chroma en sombre · le
plafond de gamut · le budget de contraste du fond sombre · et la précision de la méthode core,
comparée non pas à zéro mais au **plancher physique de sRGB**.

`brands/example.json` est la fixture de non-régression, et elle est faite pour être hostile :
9 crans réguliers plus quatre hors grille, noms de rôles inhabituels, ancres aux bornes du
gamut, un nuancier sans couleur par défaut, un nuancier réglé à la main, des déclinaisons de
teinte, un mode sombre sur un fond dont le budget (19,41:1) rend un cran structurellement hors
d'atteinte, un profil de chroma en cloche, un nuancier qui le refuse, une valeur sombre
épinglée, et des couleurs littérales. La garder verte, c'est garantir que le moteur reste
générique — et que les cas limites restent traités comme tels, pas contournés.

---

## Utiliser avec Claude Code

`./install.sh` place le skill dans `~/.claude/skills/hueladder` (ou sous `$CLAUDE_CONFIG_DIR`). Claude le déclenche ensuite dès qu'une
conversation parle de nuancier, d'échelle de couleur ou de tokens couleur — y compris depuis
le dépôt d'un client.

Prompt de démarrage, à adapter :

> Utilise le skill `hueladder` pour produire la comparaison des méthodes de génération
> d'échelles pour **\<CLIENT\>**.
>
> **Couleurs** : \<dans la section « … » du fichier Figma connecté / dans ce fichier / les
> voici\>. Certains nuanciers ont plusieurs valeurs (background / light / dark en plus du
> défaut) — je veux les retrouver toutes, avec le step le plus proche.
>
> **Échelle** : \<50 → 950\>, ancrage sur \<500\>.
>
> Vérifie le rendu avant de me le rendre, lance `check.mjs`, et dis-moi quelle méthode tu
> recommandes en justifiant sur les chiffres, pas sur le principe.

---

## Contenu du dépôt

```
SKILL.md              le skill Claude Code (ce dépôt est le skill)
install.sh            l'installe dans ~/.claude/skills/hueladder
hueladder.html        le studio, généré par engine/studio.mjs — à ouvrir d'un double-clic
references/           la méthode : spec, studio, lecture des résultats, extraction, régleur,
                      leçons de mission, feuille de route
engine/
  build.mjs           CLI : spec → artefact + régleur + tokens
  studio.mjs          CLI : moteur + pages historiques → hueladder.html
  studio.template.html le studio
  check.mjs           contrôle complet, vert ou rouge
  template.html       l'artefact de comparaison
  tuner.template.html le régleur
  brands/             _template.json et la fixture example.json
  lib/                colorimétrie, méthodes, métriques (+ leurs tests)
clients/              dossiers de travail — ignorés par git
```

## Faire évoluer l'outil

Ajouter une méthode de génération : `references/methods.md` décrit le contrat en fin de
document. Toute modification de `lib/` ou des gabarits doit laisser `node check.mjs` vert, puis
`node engine/studio.mjs` pour que `hueladder.html` embarque le moteur à jour.

---

## Synchronisation avec les copies clientes

`engine/` est copié chez chaque client, et c'est ce qui garantit qu'un livrable reste reproductible
sans dépendre de ce dépôt. La contrepartie : les deux côtés dérivent dès qu'on travaille en mission.

**Ce qui remonte du client vers ici** : toute fonction générique — une mesure, un contrôle, une
correction de bug. Elles n'ont rien de spécifique à une marque et le client suivant en profite.
Remontées lors d'une mission (août 2026) : `luminanceGap`, `monotonicity`, `contrastY`,
`contrastVsBackgroundY`, `contrastVsBackground`, `GAMUT_CEILING`.

**Ce qui ne remonte jamais** : la spécification de marque (`brands/<client>.json`), les valeurs
relevées, les pages d'arbitrage écrites pour une réunion, et tout script qui reconstruit un système
livré. Le dossier `clients/` est d'ailleurs ignoré par git.

**Divergence connue et assumée** : `build.mjs`, `check.mjs` et `template.html` ont évolué des deux
côtés avec des idées différentes mais compatibles — la copie de cette mission a une section « Spécifications
client » dans son `check.mjs`, ce dépôt a ses propres contrôles de fixture. Les deux couvrent les
mêmes garanties par des chemins différents. Fusionner mécaniquement ces trois fichiers casserait
l'un ou l'autre ; la réconciliation se fait à la prochaine mission, en repartant de ce dépôt et en
re-portant ce qui manque.

**Avant de démarrer un client** : `cd engine && node --test lib/*.test.mjs && node check.mjs`.
Tout doit être vert avant la copie.

---

## Crédits et licence

Hueladder compare des méthodes qu'il n'a pas inventées : David Fusilier (color-shades), Nate
Baldwin (Adobe Leonardo), Andrew Somers (APCA), Björn Ottosson (Oklab), Eugene Fedorenko
(Accessible Palette), Gregor Aisch (chroma.js), l'équipe Material de Google (HCT), Lyft
(ColorBox), Stripe, Adam Wathan et Steve Schoger (Tailwind CSS, Refactoring UI). La liste
complète, avec les liens, est dans [README.md](README.md#credits). Merci à Shaun Bent pour la
mise en relation avec David Fusilier.

Licence [MIT](LICENSE) : reprendre, forker, intégrer les mécaniques dans son propre produit et
renommer ce qu'on construit, c'est fait pour. Un crédit et un lien sont toujours appréciés. Ce
qui n'est pas dans l'esprit du projet : le même outil, renommé, sans rien y ajouter.
