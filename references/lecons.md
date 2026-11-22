# Leçons de mission

Ce que deux missions réelles ont appris, écrit pour qu'un humain ou une IA ne refasse pas les
mêmes erreurs. Le détail daté, avec les couleurs des clients, reste dans leurs dossiers
(`clients/`, jamais versionné ici).

## Importer

- **Un import doit dire ce qu'il a perdu.** Compter les valeurs lues, retenues, écartées, et
  donner la raison de chaque écart : alias, alpha, format, doublon. Vérifier ensuite que la
  couleur d'identité tombe bien au cran d'ancrage.
- **Lire la valeur, pas le nom.** Dans un fichier de design, les libellés de calques sont
  souvent périmés : un « 600 » peut porter la couleur d'un 400. C'est le constat le plus
  fréquent, et le plus utile à montrer.
- **Chercher au-delà de la sélection.** Les fichiers de fondations ont souvent une palette
  complète ailleurs que là où l'on regarde.
- **Les alphas et les dégradés ne sont pas des primitives comme les autres.** Un primitif
  décrit un rendu, un token sémantique un usage. Un alpha se pose sur une couleur pleine, et
  une couleur sans token se remplace par la primitive la plus proche.
- **Photographier la source, datée.** Une reconstruction ne fait pas autorité sur un système
  déjà livré. On compare d'abord (identiques / écarts / pires écarts), et on écrit ensuite,
  explicitement.

## Mesurer

- **« Zéro violation » ne désigne pas une méthode.** Plusieurs y arrivent, et chaque critère a
  sa meilleure. L'interchangeabilité (zéro franchissement de seuil à cran égal, dans les deux
  modes) en est un, pas le seul : c'est à l'équipe de dire lequel compte.
- **Un seul ΔE, nommé partout** : ΔE2000, D65. Mélanger CIE76 et ΔE2000 dans un même rapport
  rend les chiffres incomparables.
- **Moyenner avant d'arrondir.** Et ne jamais moyenner deux couleurs sur leurs composantes RGB :
  la moyenne se fait sur la chroma OKLCH, à luminance et teinte constantes (`blendVariants`).
- **L'arrondi hex peut repasser sous la cible.** Contrôler le contraste obtenu, pas celui visé.
- **Le gamut CSS 4 fait tourner la teinte** (jusqu'à 14° mesurés) en ramenant une couleur dans
  sRGB. Réduire la chroma à teinte constante. Seule exception : l'import de couleurs P3.
- **Afficher les seuils dans l'unité de nommage de l'utilisateur** : « 500 sur 50 », pas « shade
  95,4 ».
- **APCA a une zone morte sous Lc 7,3.** WCAG 2 et APCA ne mesurent pas la même chose : le dire
  plutôt que de les additionner.
- **Contrôler avec un code indépendant du code contrôlé.** Le contraste du contrôle est
  réimplémenté, pas importé.

## Générer

- **Le nombre de crans fixe la règle**, pas l'inverse. Une échelle plus fine donne plus de
  nuances, pas plus de contraste : le budget noir → blanc reste 21:1. Il fixe aussi les cibles
  de chaque méthode : Leonardo, APCA, HCT lisent le même barreau, pas leurs niveaux propres
  (tons de Material, niveaux d'usage d'APCA), sinon la comparaison n'est plus à crans égaux.
- **Une couleur système s'écarte de la marque, jamais l'inverse.** Une couleur d'erreur trop
  proche de la marque (ΔE2000 < 5) se corrige en l'assombrissant ou en tirant sa teinte vers
  un voisin, sans jamais la faire tourner de 30° : un rouge d'erreur reste rouge.
- **Fusionner selon la nature de la paire.** Deux extrémités proches : sans risque. Marque et
  système : à arbitrer, jamais à fusionner. Garder la trace des usages servis par chaque
  famille avant de fusionner.
- **Nommer une primitive par sa teinte, pas par son usage.** L'usage devient un alias
  sémantique vers elle.
- **Un décalage de teinte fixe (±30° HSL) peut inverser le sens d'un dégradé.** Toute
  génération d'extrémités se cale sur les paires existantes.

## Mode sombre

- **Le fond d'abord.** Il fixe le budget : un fond non noir ne porte pas 21:1, et les crans
  au-delà sortent en blanc pur. Le dire avant de promettre une amplitude.
- **Pas de miroir de shades** (`200 − shade`) : il conserve le contraste face au noir, pas
  face au fond. La bonne relation relit chaque cran contre le fond réel.
- **Profil d'éclat en cloche**, jamais constant : sinon les crans extrêmes, qui sont des fonds
  et des encres, deviennent des aplats.
- **Déclarer les couleurs qui ne s'inversent pas** (`staticTokens`) : blanc du logo, encre sur
  photo. Sans elles, les équipes détournent le cran extrême du neutre, qui s'inverse.
- **Tester la monotonie dans les deux modes.** C'est ce test qui attrape une inversion
  invisible à l'œil entre deux crans très clairs.

## Recommander

- **Aucune phrase chiffrée écrite à la main.** Une recommandation qui contredit ses propres
  chiffres ruine la confiance dans tout le reste. Le texte se génère depuis les données.
- **Un usage qui échoue annonce le cran qui le répare** : « bordure en 300 : 2,1:1, passer au
  400 ».
- **Pour un décideur, une page courte** : explicabilité en une phrase, effort de migration,
  impact visible par famille (invisible, modéré, visible), ce qui ne change pas selon la
  méthode, et une méthode de repli nommée.
- **Comparer, pas plaider.** Juger toutes les méthodes à la règle d'une seule (« règle non
  tenue » partout) fausse la comparaison et la rend illisible. Chaque méthode se mesure sur des
  critères nommés, avec ce qui y est bon ; la meilleure valeur de chaque critère se montre, quelle
  que soit la méthode ; le défaut de l'outil se dit comme une préférence, avec son critère.
- **Une méthode tierce se règle comme son auteur la règle.** Donner à Leonardo les ratios de
  Tailwind slate serrait 50 et 100 à 1,04 et 1,09:1 : un plateau qui ne dit rien de Leonardo. À
  ratios égaux, et sur le chemin de la librairie, la comparaison isole ce qui diffère vraiment.
- **Le rapport parle comme la page.** Une page neutre ne suffit pas si le rapport qu'elle ouvre
  conclut encore « qui tient la règle » : tout ce qui part vers une réunion ou vers un agent
  (rapport, `hueladder explain`, skill, références) se relit avec le même critère, et une correction
  de l'interface s'y reporte le jour même. Et les réglages d'une méthode tierce se disent quand ils ne sont pas ceux de son
  auteur (Leonardo en OKLCH, APCA devenu générateur).
- **Un exemple ne « fournit » rien.** Montrer des « couleurs fournies » sur une page qu'on
  ouvre vide perd le lecteur : l'exemple part de ses couleurs de départ, et c'est tout.
- **Journaliser les arbitrages** avec la mesure qui les a justifiés. Un choix fait sur papier
  et dont la feuille disparaît est un choix perdu.

## Au-delà de l'échelle

- **Le verrou de luminance est fait pour l'interface, pas pour des catégories.** À cran égal,
  toutes les familles ont la même luminance : en gris et sous un daltonisme, elles se
  confondent. Une palette de dataviz change de cran, pas seulement de famille, et au-delà de
  quatre séries la couleur ne suffit plus (étiquettes, formes).
- **Un mode daltonien ne casse rien s'il garde la luminance.** Seules les teintes des couleurs
  de statut tournent ; décaler des crans pour gagner en écart casse le verrou, et la règle avec.
- **Un sombre déclaré se juge contre son clair, pas contre un clair régénéré.** La question qui
  décide : chaque seuil tombe-t-il au même cran dans les deux modes ?
- **Vérifier les fichiers livrés, pas la sortie du moteur.** Un fichier retouché, exporté,
  recopié ne promet que ce qu'il contient : relire la règle dans les tokens eux-mêmes.
- **Les extrémités d'un dégradé se déclarent.** La normalisation égalise la longueur des deux
  moitiés en gardant la direction voulue ; un écart fixe de teinte inverse le sens.
