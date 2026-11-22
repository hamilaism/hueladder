# Lire l'artefact et formuler la recommandation

Le build produit des chiffres. La valeur livrée, c'est la lecture.

## L'ordre dans lequel lire

### 1. « Les couleurs déjà choisies — où tombent-elles ? »

À lire **en premier**, avant toute considération de méthode. Le bandeau rouge en haut de
cette section liste les couleurs dont le nom ne correspond pas à la clarté réelle
(écart ≥ 2 rangs entre rang occupé et rang mérité).

C'est le constat le plus actionnable de tout l'artefact, parce qu'il ne dépend d'aucun
choix de méthode : c'est une propriété mesurable des couleurs du client. Une couleur
nommée `500` mais qui est perceptuellement un `200` a typiquement moins de 3:1 contre le
blanc — **du texte blanc dessus échoue**, et l'équipe s'en est probablement déjà rendu
compte sans savoir le nommer.

Formulation qui marche : « ces couleurs sont utilisables, mais pas sous ce nom-là. Soit on
les renomme au rang qu'elles méritent, soit on les remplace par la valeur générée au rang
qu'elles occupent. » La décision se prend nuancier par nuancier.

### 2. La synthèse a11y — chaque ligne a sa meilleure

**Le nombre de paires AA ne suffit pas.** Il ne dit pas lesquelles : une méthode peut en
produire beaucoup, mais inégalement d'une teinte à l'autre, et il faut alors vérifier chaque
paire teinte par teinte. Selon l'équipe, c'est un coût ou non. Aucune ligne n'est « la
bonne » : chacune mesure un critère, et le rapport met en gras la meilleure de chaque ligne.

| Ligne | Ce qu'elle dit |
|---|---|
| **Paires AA** | combien de paires passent, toutes teintes confondues |
| **Écart de crans qui garantit AA partout** | le plus petit écart qui vaut pour toutes les paires de toutes les teintes, mesuré sur chaque méthode elle-même |
| **Écart entre teintes à cran égal** | faible = on peut changer de teinte sans revérifier l'accessibilité |
| **Asymétrie clair/sombre** | l'écart entre textes AA sur blanc et sur noir ; il vient de la répartition des crans |
| **Écart à la couleur de départ** | ce qu'on abandonne de la couleur de marque |
| **Fidélité à toutes les couleurs** | ce qu'on abandonne des arbitrages déjà faits |

### 3. Choisir, sans désigner de gagnant

Aucune méthode n'a la meilleure valeur partout, et plusieurs ont souvent le même écart sûr
(OKLCH, Fusilier, HCT, Leonardo, l'interpolation Lab). Ne pas dire « X gagne » : demander
d'abord ce qui compte pour l'équipe, puis montrer ce que la méthode qui y répond paie sur
les autres lignes. Pour voir où chaque méthode passe 4,5:1, et si c'est au même cran sur
toutes les teintes : le tableau « Le contraste face au blanc, cran par cran » de `hueladder explain`
(dans le studio, le panneau « Une teinte, toutes les méthodes »).

- **Design system multi-mode** : l'asymétrie clair/sombre compte. Elle dépend des
  contrastes visés, pas du fond qu'une méthode vise : le contraste face au blanc multiplié par
  le contraste face au noir vaut toujours 21, donc viser un ratio face au blanc fixe aussi
  celui face au noir. Une méthode à contraste visé (Fusilier, Leonardo) est aussi symétrique
  que la liste de contrastes qu'on lui donne ; avec les ratios du barreau, Leonardo l'est
  autant que Fusilier.
- **Design system mono-mode clair** : l'asymétrie compte peu ; regarder plutôt la fidélité
  aux couleurs existantes, ou une clarté perçue régulière (OKLCH).
- **Fusilier** est le défaut de cran pour un critère, des intervalles réguliers (le contraste
  entre deux crans se lit dans l'écart de leurs noms). C'est une préférence de prévisibilité,
  pas un classement : ne pas le présenter comme « la meilleure méthode ».

### 4. Le voisinage de teinte

Deux constats y sont produits, et le **premier** est le plus important — il ne dépend
d'aucune hypothèse :

**Les couleurs réelles, par teinte.** Une règle 0 à 360° place chaque nuancier selon la
teinte OKLCH de sa couleur d'ancrage, puis les rampes entières sont affichées côte à côte,
regroupées par zone de la roue (rouges, orangés, jaunes, verts, cyans, bleus, violets,
magentas, neutres). Un bouton bascule entre les couleurs actuelles et la méthode core.
C'est la vue à montrer en réunion : les grappes se voient sans lire un seul hex.

**Les familles à la même teinte : factoriser ?** Le moteur (`hueProximity`, dans
`lib/analysis.mjs`) croise toutes les paires de nuanciers chromatiques à moins de 12° de
teinte et rend un verdict :

| Verdict | Condition | Ce que ça veut dire |
|---|---|---|
| **factorisable** | saturation comparable (rapport ≥ 60 %) et ΔE2000 moyen < 5 une fois régénérées par la méthode core | la méthode efface l'écart que la clarté et la saturation d'origine maintenaient : garder les deux, c'est deux noms pour une même couleur |
| **voisines** | saturation comparable, mais encore distinctes après régénération | un choix à faire en conscience, pas un doublon |
| **fausse proximité** | rapport de saturation < 60 % | même teinte, mais elles se lisent comme deux couleurs différentes (un violet et un prune terne) |

Le point clé à faire passer : **adopter une méthode à contraste verrouillé pose
mécaniquement la question de la fusion.** Ces méthodes imposent la clarté par cran, donc
deux familles de même teinte et de saturation proche convergent une fois régénérées. Typiquement :
plusieurs bleus à 1° de teinte, nettement distincts aujourd'hui, deviennent presque
indiscernables une fois régénérés par une méthode qui impose la clarté par cran. Une famille métier n'a pas
besoin de sa propre rampe pour exister : elle devient un nom sémantique qui pointe vers la
rampe commune.

Deux garde-fous :
- **le ΔE seul trompe** quand les saturations divergent. Un rapprochement de deux neutres
  proposé sur le seul ΔE a déjà été rejeté à la relecture. C'est pourquoi le rapport de
  saturation est testé avant le ΔE, et pourquoi les neutres et quasi-gris (chroma < 0,05)
  sont exclus ;
- **un verdict algorithmique se valide à l'œil** sur les rampes côte à côte avant d'être
  proposé au client.

Le cas à regarder en priorité reste une couleur de **marque** et une couleur **système**
qui se superposent (signalé dans le tableau) : un bouton principal et un état d'erreur
deviennent difficiles à séparer d'un coup d'œil, et impossibles à distinguer pour une
personne daltonienne si la clarté est proche elle aussi.

**Les déclinaisons qui tombent sur une teinte déjà prise.** Elles disent où la roue est
saturée. Une nouvelle ligne produit qui viendrait s'y loger serait confondue avec
l'existante ; à l'inverse, les déclinaisons qui n'apparaissent pas dans cette liste
pointent les zones libres. C'est la réponse à « où peut-on encore aller ».

### 5. Les graphiques

Le graphique **2 · Contraste vs noir en échelle log** montre ce qu'un écart de crans
garantit : une droite unique toutes teintes confondues signifie que la distance verticale
entre deux couleurs se lit directement dans leurs noms de steps. Un faisceau dispersé
signifie qu'un même écart de crans ne donne pas le même contraste d'une teinte à l'autre :
chaque paire se vérifie teinte par teinte. Il se montre bien en réunion.

Le graphique **4 · Dérive de la teinte** est celui qui parle aux designers : il montre les
jaunes qui brunissent et les bleus qui virent quand on éclaircit dans le mauvais espace.

## Les trois positions défendables

L'artefact n'impose pas une réponse. Il rend trois positions argumentables :

**Tout régénérer** (`fusilier`, `oklch`, `hct`…) — à cran égal, le contraste devient le
même (ou presque, selon la méthode) d'une teinte à l'autre ; avec Fusilier, il se lit dans
les noms. Prix : les couleurs d'identité bougent (ΔE typiquement 7 à 10 au
step d'ancrage). Défendable quand l'équipe souffre de vérifier l'accessibilité au cas par cas.

**Tout conserver** (`anchored`) — toutes les couleurs déjà validées sont reproduites
exactement, l'échelle est complétée autour. Prix : un même écart de crans ne garantit
plus le même contraste d'une teinte à l'autre.
Défendable quand la marque est intouchable ou quand le DS est jeune et l'adhésion fragile.

**Prendre une palette du commerce** (`tailwind`) — robuste, éprouvée, zéro effort. Prix :
on abandonne les couleurs de marque. Défendable pour les neutres, rarement pour la marque.

Une position intermédiaire est légitime : régénérer les nuanciers système (où
l'accessibilité prime) et conserver les couleurs de marque (où l'identité prime). Le format
de spec le permet — `coreMethod` est global, mais rien n'empêche de livrer deux builds et
de composer les tokens.

## Contrôles avant livraison

```bash
# 1. les conteneurs sont-ils remplis ? (vide = le script a planté)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --virtual-time-budget=8000 --dump-dom "file://$PWD/index.html" > /tmp/dom.html 2>/dev/null
python3 - <<'EOF'
import re
dom = open('/tmp/dom.html').read()
for cid in ['summary','charts','tester','anchors','usages','ramps','spread','annex']:
    m = re.search(r'id="%s"[^>]*>(.*?)(?=<h2|<div class="bgbtns")' % cid, dom, re.S)
    n = len(m.group(1)) if m else 0
    print(f"  #{cid:10s} {n:8d} {'OK' if n > 200 else '*** VIDE ***'}")

# 2. tous les labels de swatch sont-ils lisibles ? (zéro tolérance)
def lin(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def L(h):
    h = h.lstrip('#'); r,g,b = [lin(int(h[i:i+2],16)/255) for i in (0,2,4)]
    return 0.2126729*r + 0.7151522*g + 0.0721750*b
def C(a,b):
    x,y = L(a)+0.05, L(b)+0.05; return x/y if x>y else y/x
pairs = re.findall(r'class="sw[^"]*"\s+style="background:(#[0-9a-fA-F]{6});color:(#[0-9a-fA-F]{6})"', dom)
bad = [p for p in pairs if C(*p) < 3.0]
print(f"  swatches {len(pairs)}, illisibles {len(bad)}", bad[:5])

# 3. les marques W/B disent-elles la vérité ?
sw = re.findall(r'class="sw[^"]*"\s+style="background:(#[0-9a-fA-F]{6});color:#[0-9a-fA-F]{6}"[^>]*>.*?<span class="marks">([^<]*)</span>', dom, re.S)
err = sum(1 for bg,mk in sw if (C(bg,'#ffffff')>=4.5) != ('W' in mk) or (C(bg,'#000000')>=4.5) != ('B' in mk))
print(f"  marques W/B vérifiées sur {len(sw)}, {err} erreur(s)")
EOF
```

Puis **regarder** une capture d'écran, en clair et en sombre. Les chiffres ne montrent pas
un tableau qui déborde.

## Recompter les métriques indépendamment

Utile quand on présente les chiffres à un client. Charger `data.json`, réimplémenter le
contraste WCAG en dix lignes (sans importer `lib/`), et recompter `pairsAA`, `safeRank`,
`violationCount`, `onWhite`/`onBlack`, `stepSpread`. Vérifier aussi que la méthode
`anchored` reproduit bien **exactement** chaque couleur d'entrée, et que Fusilier atteint
ses cibles (`21^(shade/200)` face au noir) à la quantification hex près — écart attendu
< 0.15, essentiellement sur le cran le plus clair.
