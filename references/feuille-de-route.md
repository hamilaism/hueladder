# Feuille de route de Hueladder

Ce qui existe est dans `studio.md`. Ce qui suit vient de deux sources : les retours sur la V1
(ci-dessous), et les manques relevés en comparant le moteur au travail des missions
(`lecons.md`). Classé par version, puis par valeur.

## Version 1.1 : trois entrées, Créer · Auditer · Comprendre

La 1.0 montrait la génération. La science des comparaisons de méthodes et l'audit existaient
(le rapport complet, le diagnostic), mais cachés derrière un bouton ou dans une étape du
parcours de création. Montrés à quelqu'un qui découvre l'outil, ils sont pourtant ce qui le
distingue : aucun des outils du benchmark ne diagnostique une palette existante ni ne vérifie
une règle de nom.

**Critère de version** : si une spec 1.0 se reconstruit à l'identique et qu'aucune commande
ne change de sens, c'est une 1.1, même avec trois entrées ; si le format de spec casse, 2.0.

Statut : **fait** · **à faire** · *écarté* (avec la raison).

### Les entrées

| | Élément | Statut |
|---|---|---|
| E1 | Page d'accueil à trois entrées, onglets permanents dans l'en-tête, même spec | fait |
| E2 | Passages : « Corriger dans Créer » depuis un audit, « Créer avec ces couleurs » et « Auditer mes couleurs » depuis Comprendre | fait |
| E3 | L'étape 2 de Créer s'appelle « Diagnostic » (plus de doublon avec Comprendre) | fait |
| E4 | CLI : `hueladder audit`, `hueladder explain` ; skill : trois chemins de conversation | fait |

### Auditer

| | Élément | Statut |
|---|---|---|
| A1 | Une ou plusieurs sources (marques, produits, versions), nommées, datées, avec leur origine ; ce qui n'a pas été lu, compté par raison, affiché avant les chiffres | fait |
| A2 | Méthode la plus proche (écart moyen à chaque méthode) et hypothèse « HSL à teinte et saturation constantes » | fait |
| A3 | Sources face à face : chaque famille alignée, divergente, partagée ou exclusive, cran par cran | fait |
| A4 | Même nom pour deux couleurs ; deux noms pour une même couleur (ΔE moyen sur les crans communs) | fait |
| A5 | Grilles de crans comparées ; familles trop courtes pour être des rampes | fait |
| A6 | Table de triage : divergences d'abord, puis ce que la régénération bougerait | fait |
| A7 | Deux versions : chemins perdus, ajoutés, valeurs changées, dette d'alias | fait |
| A8 | Décision « garder ou régénérer » : méthode, repli, impact par famille en bandes de ΔE, ce qui ne dépend pas de la méthode ; page en Markdown | fait |
| A9 | Vérifier des fichiers livrés (tokens DTCG, un ou deux modes) : monotonie, seuils au même cran, règle du nom paire par paire, validité (pas de `null`, `$type` présent) | fait (`hueladder verify`, et dans chaque audit) |
| A10 | Familles proches selon la nature de la paire (marque ↔ système : à arbitrer, jamais à fusionner ; extrémité ↔ extrémité : sans risque) et ΔE cran par cran (sous 1 indiscernable, sous 2,5 inexploitable) | fait |
| A11 | La page de décision dans le paquet de livraison quand on part d'une palette | fait |
| A12 | Les pires écarts nommés dans la migration | fait |
| A13 | Un avertissement de provenance (`caveat`) porté par la spec et affiché avant les chiffres dans le rapport, le guide et le README du paquet | fait |
| A14 | Barreau médian : proposer comme cibles la médiane des Y existants par cran, avec son écart au barreau par défaut | fait (`hueladder suggest --ladder`, étape Diagnostic) |
| A15 | Audit d'un mode sombre existant (déclaré cran par cran), puis option de re-calage | fait (une source « mode sombre de… » dans Auditer, `hueladder audit --dark`) |
| A16 | Fiche de swatch : RGB, HSL, OKLCH, contraste sur blanc et noir, rang mérité, ΔE aux voisins et à l'actuel, chroma gardée | fait (au clic sur une pastille, dans tout le studio) |
| A17 | Import Figma direct : libellé ≠ valeur, couleurs en dur les plus employées hors collection, taux de liaison aux variables, bibliothèques en double | fait : `engine/figma-scan.js` relève, `hueladder figma` et l'entrée Auditer analysent — à éprouver en QA sur un vrai fichier |
| A18 | Paires par état (texte sur fond en survol, focus, pression : fond = texte, texte faible sous le seuil) | fait (`hueladder pairs`, et dans l'audit d'une source qui en contient) |

### Comprendre

| | Élément | Statut |
|---|---|---|
| U1 | Le cadre : espace ≠ méthode ≠ outil, la méthode comme quadruplet (règle, espace, gamut, politique de seed) | fait |
| U2 | Quatre familles de méthodes : espace machine, perceptuel uniforme, contraste visé, dessin manuel | fait |
| U3 | Un graphique par méthode, mêmes axes (contraste face au noir, échelle log) : la ligne contre le faisceau | fait |
| U4 | L'écart entre teintes au cran d'ancrage, par méthode | fait |
| U5 | Ce que chaque méthode coûte : paires AA et AAA, violations, franchissements, écart entre teintes, dérive, chroma gardée | fait |
| U6 | Leçons calculées : le budget (3 niveaux AA au plus), quantité contre prévisibilité, uniforme n'est pas ancré, l'usage qui départage, le prix en AAA et en identité | fait |
| U7 | Exemple synthétique sans donnée de client (neuf teintes, existant fait en clarté HSL) | fait |
| U8 | Méthodes paramétriques par canal (courbes L, C, H) comme dixième méthode | fait (`curves`, dixième méthode, cinquième famille) |
| U9 | Usages liens (G183), anneau de focus (2.4.13) et couleurs adjacentes en dataviz dans la matrice d'usages | fait pour les liens (G183) et le focus (2.4.13) ; les couleurs adjacentes sont dans les palettes dataviz |
| U10 | Simulation des daltonismes dans le rapport et l'audit : distinguabilité entre familles | fait (dans chaque audit) |
| U11 | Sans parti pris : le propos (ce qu'une méthode rend égal, comment elle répartit), le défaut de Hueladder dit comme une préférence, puis des constats titrés et calculés (budget, même luminance, OKLCH, intervalles, quantité, usages, identité, AAA, Tailwind, WCAG 2 ≠ APCA) | fait (chacun ne s'écrit que si les chiffres le montrent) |
| U12 | Une fiche par méthode : ses couleurs, ce qu'elle rend égal, comment elle répartit les crans, quand la choisir, ce qu'il faut savoir, ses chiffres, le calcul, la source ; l'exemple ne « fournit » aucune couleur | fait (neuf méthodes et les ancres ; « Tes couleurs » avec ses propres couleurs) |
| U13 | Les usages, teinte par teinte : une ligne cliquée montre la paire en couleurs, une case par teinte, avec son contraste | fait |
| U14 | Le tableau : huit critères nommés, ce qui est bon pour chacun, la meilleure valeur en gras, chaque colonne définie ; l'écart de crans mesuré pour chaque méthode, pas la règle d'une seule | fait |
| U15 | Choisir sa méthode : pour chaque critère, les méthodes qui y font le mieux (calculé), leur prix ailleurs, où le faire ; régler sous verrou et panachage compris | fait |
| U19 | Six graphiques aux mêmes axes, un à la fois : contraste face au noir, intervalles entre crans voisins, clarté OKLCH, éclat, teinte, Lc APCA | fait |
| U20 | Leonardo sur le chemin de la librairie (échelle blanc → couleur → noir en OKLCH), ratios du barreau par défaut | fait ; portage exact de la librairie le 2026-11-22 (identique au hex près, en OKLCH comme en RGB) |
| U26 | Si on cite un auteur, on fait ce qu'il fait : le Fusilier adapté (chemin OKLCH) le dit dans son nom, et l'original, color-shades au hex près, est proposé à côté (`colorshades`) | fait le 2026-11-22 (identique au hex près, vérifié contre les fonctions de color-shades) |
| U21 | Une teinte, toutes les méthodes : la même couleur de départ passée par chacune ; sous chaque case, son contraste face au blanc et face au noir, en gras dès 4,5:1. Le même tableau, toutes teintes, dans `hueladder explain` | fait |
| U22 | Une ligne « Réglages » par fiche : ce que Hueladder choisit, et en quoi il s'écarte de l'auteur (Leonardo en OKLCH, APCA devenu générateur, ColorBox mis en formule, tons HCT) | fait |
| U23 | Le rapport complet sans gagnant : la meilleure de chaque ligne, plus de « qui tient la règle » ; l'exemple n'y a ni existant ni « couleurs déjà choisies » | fait |
| U24 | Ce qui ne change pas, quelle que soit la méthode : seuils, nomenclature, travail de fond (dans l'argumentaire) | fait |
| U25 | Générer sans plaider : Fusilier « par défaut », plus « recommandé » ni « c'est la recommandation » ; « Trahisons » devient « Hors règle », le contrat et la règle du nom définis à l'écran | fait |
| U16 | Pour présenter : un déroulé de présentation, l'argumentaire complet en Markdown (`hueladder explain`, bouton du studio) | fait |
| U17 | D'où viennent les chiffres : protocole, conformité aux librairies d'origine, limites, sources | fait |
| U18 | Les autres choix de méthode : les six méthodes du mode sombre, les quatre nomenclatures, la norme (textes partagés avec les étapes qui les font choisir) | fait |

### Créer

| | Élément | Statut |
|---|---|---|
| C1 | Re-saturation en clair : chroma maximale tenable à Y donné, en cloche, jamais sous le seed, plafond 96 % | fait (`lightChroma`, étape Générer) |
| C2 | Choix de variante par famille et par mode (alignée, vive, max, moyenne via `blendVariants`), enregistré dans la spec | fait (planche à l'étape Générer : tes couleurs, vive, max, entre les deux) |
| C3 | Options de couleur système : assombrir, tirer la teinte, valeur éprouvée, chacune en rampe complète sous la marque | fait (trois actions du constat « familles voisines ») |
| C4 | Traçabilité : les usages servis par chaque famille (`primitives`), dans le manifeste et le guide | fait |
| C5 | `staticTokens` par mode et avec alpha (`{ light, dark, note }`, hex à 8 chiffres) | fait |
| C6 | Dégradés comme objets de la spec : amplitude de chaque moitié, asymétrie, normalisation en gardant la direction, tokens d'arrêt | fait (moteur et paquet ; pas encore d'écran) |
| C7 | Modes daltoniens à luminance verrouillée : seules teinte et chroma bougent, contrastes et interchangeabilité identiques par construction | fait (`cvdModes`, étape Livrer) |
| C8 | Palettes dataviz tirées de l'échelle : catégorielle (crans et teintes opposées), séquentielle, divergente ; 3:1 dans les deux thèmes, distance sous trois daltonismes | fait (`dataviz`, étape Livrer) |
| C9 | Régleur en mode sombre | fait (étape Mode sombre : teinte et éclat à luminance verrouillée, en épingles) |
| C10 | Sortie P3 (chroma bornée par Display-P3 à même luminance) | fait (`p3: true`, `code/colors-p3.css`) |
| C11 | Sombre en deux morceaux : égalité stricte jusqu'aux crans de texte, desserrement des crans du haut sur un fond non noir | fait (`darkMode.spreadTop`) |
| C12 | Plafond anti-halo du cran le plus clair en sombre ; norme APCA choisissable pour tout le système ; sortie contraste élevé / couleurs forcées | fait (`darkMode.haloCap`, `contract.norm: "apca"`, `highContrast`, couleurs forcées dans le guide) |
| C13 | Panachage : régénérer les couleurs système, garder la marque telle quelle, dans le même build | fait (`ramps[].method`, « garder telle quelle » à l'étape Générer) |
| C14 | Regroupement libre proposé par l'agent (couleurs déplacées, familles fusionnées), montré dans le studio, validé par l'humain | fait (`hueladder group`, panneau à l'étape Diagnostic) |

### Confiance

| | Élément | Statut |
|---|---|---|
| T1 | Dérive « non mesurable » plutôt que 0 quand aucune couleur d'identité n'est fournie | fait |
| T2 | Suite de conformité : chaque méthode comparée à sa librairie d'origine (égalité hex pour mix et easing, ±0,2 de ton pour HCT, ±0,135 de ratio pour Leonardo), hors du moteur sans dépendance | fait (`engine/conformance`, résultats dans `methods.md`) |
| T3 | Le neutre dans le test d'interchangeabilité (substituer une teinte par le neutre est le cas le plus courant) | fait |
| T4 | Le plancher sRGB par cran plutôt qu'un écart relatif fixe de 3 % | fait (3 %, ou deux fois le plancher sRGB du cran s'il est plus grand) |
| T5 | Test perceptif des méthodes sombres et des réglages d'éclat, sur quelques marques, avant de changer un défaut | outil fait (`hueladder perceptual`, réponses agrégées par `--summary`) ; le test lui-même reste à mener avec des personnes |
| T6 | Surfaces déclarées au contrat : contraste sur fonds teintés, pas seulement sur blanc | fait (`surfaces`) |

## Retours sur la V1, face aux évolutions

| Retour | Ce qui a été fait | Et ensuite |
|---|---|---|
| Les crans dans l'en-tête : les garder, pouvoir changer tout au long du parcours | gardé tel quel ; le choix reste modifiable à chaque étape | — |
| « À compléter » au diagnostic doit pousser à créer le neutre et les couleurs système | boutons d'ajout sur place ; seuls les rôles manquants sont ajoutés, y compris quand la palette en a déjà un | V2 : suggestions système placées dans les zones libres de la roue, contrôle système ↔ marque |
| Fusionner ou déplacer des couleurs à l'étape 1 : incompréhensible, et le résultat ne se retrouvait pas ensuite | retiré de l'interface ; on renomme, on change le rôle, on retire | V2 : geste d'expert par la spec et par le skill (un agent regroupe, l'humain valide) |
| Fusilier doit toujours être poussé | choisi par défaut et en tête de la comparaison, marqué « par défaut » : une préférence pour des intervalles réguliers, pas un classement (« recommandé » retiré, 2026-10-30) | — |
| Il manque la comparaison des méthodes | les neuf méthodes côte à côte à l'étape 3, sur le nuancier de son choix, avec leurs chiffres ; un clic choisit | V2 : planche de choix par famille (variantes à contraste égal) |
| Mode sombre : aucune différence entre « cloche » et « aligné » | vérifié : la différence existe, mais elle est faible sur une couleur déjà vive (l'écran plafonne) et nulle sur un neutre. Elle est maintenant mesurée et dite : nombre de crans qui changent, courbe des deux profils | V2 : profil « vif » (re-saturation au plafond), régleur en mode sombre |
| Mode sombre : le fond change les couleurs, c'est une boîte noire | le calcul est expliqué avec les chiffres du nuancier ; chaque cran affiche son contraste, en clair sur blanc et en sombre sur le fond | V2 : audit d'un mode sombre existant, re-calage |
| Interface en anglais et en français | studio, régleur intégré et contrat traduits ; bouton FR / EN | fait : rapport complet et descriptions des tokens en anglais |
| Vérifier soi-même que tout fonctionne | `studio.test.mjs` : le parcours complet dans un vrai Chrome, geste par geste, lancé par `check.mjs` | chaque nouvelle fonction arrive avec ses vérifications |
| Aucune référence aux clients | dépôt anonymisé (noms, codes de couleur métier) | l'historique git contient encore d'anciens messages et fichiers : publier depuis un historique neuf |

## Second passage

| Retour | Ce qui a été fait | Et ensuite |
|---|---|---|
| Le tag « identité » à l'étape 1 est incompréhensible | renommé « base », expliqué, affiché seulement sur les nuanciers de plusieurs couleurs ; un clic choisit la base | — |
| Les couleurs ajoutées disparaissent après l'étape 1 | les étapes 2 et 3 montraient une seule rampe : tout le système est maintenant affiché à chaque étape, et le test vérifie les 7 nuanciers d'un bout à l'autre | — |
| Les constats du diagnostic n'ont pas d'action | chaque action est un bouton qui modifie le système et relance le diagnostic ; les exceptions assumées partent dans la spec | V2 : journal des arbitrages avec la mesure qui les justifie |
| L'écran Générer ne montre que les 500 | le système complet s'affiche d'abord avec Fusilier, puis avec n'importe quelle méthode au choix, avant la comparaison | V2 : planche de choix par famille |
| Le mode sombre est une simple inversion, sans désaturation | vrai. Le moteur ne savait que garder ou augmenter la chroma. Il sait maintenant désaturer d'une part déclarée, vérifiée par le contrat ; le défaut à 20 % a ensuite été retiré (voir le troisième passage) | V2 : désaturation variable par cran, calée sur des mesures perceptives ; régleur en mode sombre |
| Les descriptions des tokens : à qui servent-elles ? | la description dit l'usage et les paires possibles, pour une personne ; `$extensions` porte les mêmes faits chiffrés, pour une machine | à valider sur un vrai import Figma et Style Dictionary |
| Un livrable orienté IA | `<id>-color-guide.md` : règle, rôle des crans, correspondances sémantiques, consignes, bloc JSON | voir ci-dessous |

## Livraison : décisions prises

1. **Un paquet, un dossier par destination** (`hueladder export --format package`, bouton « Télécharger
   le paquet » du studio) : `code/` (CSS, Tailwind 3 et 4, DTCG), `figma/` (un fichier par mode,
   couleurs au format objet de l'import natif), `tokens-studio/` (un fichier, un jeu par mode),
   `ai/`, la spec, la migration, un README. Formats et sources : `benchmark.md`.
2. **Primitives seules.** Hueladder propose une échelle ; la couche sémantique reste la décision de
   l'équipe. Les tokens et le guide décrivent l'usage de chaque cran, sans attribuer de rôles :
   la table de « correspondances sémantiques de départ » a été retirée du guide.
3. **Le guide IA en deux fichiers** : `ai/color-guide.md` (avec son bloc JSON, pour qui n'en
   colle qu'un) et `ai/palette.json`.

## Troisième passage

| Retour | Ce qui a été fait |
|---|---|
| L'ordre des décisions à l'étape 3 | verdict chiffré, puis résumé des méthodes où l'on choisit, puis le système, puis le détail replié |
| Le mode sombre reste une boîte noire | trois décisions ordonnées (fond, méthode, éclat), chacune comparée avant d'être prise, chaque défaut sourcé |
| Y a-t-il plusieurs méthodologies de mode sombre ? | oui : cinq méthodes documentées sont calculées et comparées (miroir WCAG, miroir APCA, part du budget, ton inversé HCT, crans échangés). Recherche sourcée dans `mode-sombre/recherche.md` |
| Pourquoi désaturer, et de combien ? | aucune source primaire ne donne de pourcentage, et les systèmes mesurés ne désaturent pas leurs accents : la désaturation par défaut est retirée, remplacée par une atténuation des seules surfaces, à 0 % par défaut |
| Pourquoi le fond change les couleurs | expliqué et montré : le fond est un facteur d'échelle commun qui décale toute la rampe et fixe le budget ; les écarts entre crans ne bougent pas |

Trouvé en vérifiant, et corrigé :
- sur 11 crans, « 4 rangs ⇒ 3:1 » ne tenait qu'avec 0,7 % de marge et cassait à l'arrondi (2,99:1). La règle retenue exige désormais 1,5 % de marge, soit 5 rangs pour 3:1 ; le contrat vérifie la règle du nom paire par paire, dans les deux modes ;
- une couleur sans équivalent dans sa rampe générée était annoncée « ajustée » dans la migration : elle est maintenant signalée « hors famille », avec l'action de la déplacer dans le neutre.

Fait aussi : couleurs système placées hors de la teinte de la marque, lien de chaque contrôle
rouge vers l'étape qui le répare, table de migration avant / après, rapport complet en anglais.

## Quatrième passage : relecture complète

| Retour | Ce qui a été fait |
|---|---|
| L'éclat (décision 3) ne montre rien | chaque option du mode sombre est rendue dans son panneau : rampe, interface sur le fond, part d'éclat gardée |
| Trop petit, pas assez clair | rampes agrandies, une interface par option, méthodes qui échouent repliées |
| Le miroir APCA « marche moins bien » | le verdict jugeait tout en WCAG 2 ; un point de vue WCAG 2 / APCA montre chaque option sous les deux normes, et le compromis est expliqué |
| La vérification ne laisse passer que certaines options | chaque option annonce son résultat au contrat au moment du choix (étapes 3 et 5) ; à l'étape 6, un échec dû à un choix est nommé et peut être accepté comme exception, liée à son détail |

Trois relectures indépendantes (moteur, documentation, parcours) ont trouvé et fait corriger :
- une marge de règle trop faible (contre-exemples à 4,485:1) : portée à 4 %, 0 échec sur 150 000 paires de 9 à 17 crans ;
- un cran qui changeait de couleur sombre d'un jeu de crans à l'autre avec le profil vif ;
- des contrôles qui passaient à vide (désaturation annoncée non faite, seuils sans le neutre ni comparaison entre modes) ;
- des chiffres contradictoires d'un écran à l'autre (un seul ΔE désormais, testé aux étapes 2, 3 et 4 ; parts d'éclat mesurées comme dans leur source ; « neuf méthodes » partout) ;
- des libellés de développeur à l'étape 6, remplacés par des phrases, le détail technique replié ;
- treize écarts entre la documentation et le code.

## Cinquième passage : les nomenclatures

| Retour | Ce qui a été fait |
|---|---|
| On ne s'est basé que sur les centaines | quatre nomenclatures : grille 50 → 950, centaines par contraste, contraste façon Fusilier (0–200), rang réparti (Radix, Carbon, Primer, Ant). Recherche sourcée dans `nomenclatures.md` |
| Ajouter ou enlever des crans selon les besoins | panneau Crans : préréglages, retrait d'un clic, ajout par le nom ; avec une nomenclature par contraste, un ajout ne déplace aucun autre cran et entre dans la règle |
| Crédit à David Fusilier | https://github.com/dfusilier/color-shades, cité dans le README anglais et dans la nomenclature qui porte son nom |

Reste : nomenclature par luminosité (tons Material, L*), dont la règle n'est pas linéaire dans
le nom (Δ 51 ⇒ AA et non Δ 50) ; ordre des crans modifiable pour une nomenclature par rang.

## Sixième passage : parité studio / agent, livraison, sombre perceptif

| Retour | Ce qui a été fait |
|---|---|
| Le skill doit pouvoir tout ce que fait le studio | la logique propre au studio est passée dans le moteur (`import`, `suggest`, `diagnose`, `compare`, exports) ; `engine/hueladder.mjs` en fait des commandes ; `SKILL.md` suit les sept décisions en conversation. Le studio appelle les mêmes modules |
| Des livraisons pour chaque destination, en paquet | voir « Livraison : décisions prises » |
| Pas de couche sémantique | retirée du guide ; les descriptions d'usage par cran restent |
| Benchmark des outils existants | `benchmark.md` : 17 outils, aucun ne diagnostique une palette existante ni ne vérifie une règle de nom |
| Le sombre est-il assez perceptif ? | `mode-sombre/perceptif.md` : ΔL*, OKLab, CAM16 et H-K évalués ; une méthode ajoutée, `mirror-bridge` (règle tenue, +7 à +17 Lc au milieu de l'échelle). Le défaut reste `mirror-wcag` en attendant une revue visuelle |

Pistes du benchmark, à trier : aperçus de composants en clair et sombre (l'argument n° 1
d'UI Colors), configuration partageable par URL, sorties P3 et alpha calculées pour le fond
(Radix), graphes L/C/H de toute la grille, Style Dictionary prêt à l'emploi, `colors.ts` typé.
À vérifier sur un vrai fichier avant de le promettre : le nom des modes à l'import Figma, et
l'objet couleur DTCG 2025.10 dans Tokens Studio et Style Dictionary.

## V2 et V3 de la 1.0

Repris, ligne par ligne, dans le backlog de la 1.1 en tête de ce document.

## Dettes connues

- `interchangeability` exclut les neutres ; or substituer une teinte par le neutre est le cas
  le plus courant. À rediscuter.
- La dispersion est bornée par un écart relatif fixe (3 %) ; le plancher sRGB par cran serait
  plus juste et plus explicable.
- Le contrat ne vérifie pas la validité DTCG des fichiers produits ni l'absence de `null`.
- `mirror-bridge` fait échouer « seuils identiques entre modes » par construction (plus de
  contraste en sombre). Faut-il distinguer un seuil atteint plus tôt (sans risque pour une
  règle écrite en clair) d'un seuil atteint plus tard ?
- Avec le jeu `maxi`, les `extraSteps` propres à la spec s'appliquent à tous les nuanciers,
  y compris `0` et `1000` s'ils y sont déclarés.
