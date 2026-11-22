# Auditer : ce que vaut l'existant

Pour une personne au studio (entrée **Auditer**) ou un agent (`hueladder audit`). L'audit ne génère
rien et ne modifie rien : il mesure, compare, et rend une décision à prendre.

## Ce qu'on peut lui donner

| Source | Comment | Ce que l'audit en tire |
|---|---|---|
| Une palette | liste de hex, CSS/SCSS, config Tailwind, DTCG, Tokens Studio, spec Hueladder | lecture, constats, contrôles, décision |
| Plusieurs palettes | une par marque, produit ou version : `hueladder audit a.json b.css --names A,B` | en plus : le face-à-face, le triage |
| Deux versions | les mêmes, avec `--diff` (studio : « deux versions ») | chemins perdus, valeurs changées, alias |
| Un mode sombre déclaré | `--dark sombre.css --bg #121212` (studio : rôle « mode sombre de… ») | le sombre jugé contre sa palette claire |
| Un fichier Figma | le relevé de `engine/figma-scan.js`, collé ou passé à `hueladder figma` | couleurs en dur, taux de liaison, libellés, doublons |
| Des tokens sémantiques | un fichier dont les chemins portent rôle et état (`button.primary.bg.hover`) | les paires par état |
| Des fichiers livrés | `hueladder verify tokens.json [--dark …]` | validité, monotonie, seuils, règle relue |

## Dans quel ordre le lire, et le présenter

1. **À lire avant les chiffres** : d'où vient chaque source, sa date, ce qui n'a pas été lu et
   pourquoi (alias, transparence, format, doublon). Rien ne disparaît en silence ; une
   conclusion tirée d'une lecture incomplète se dit comme telle.
2. **De quelle méthode la palette se rapproche** (écart moyen à chaque méthode), et si elle a
   été faite en ne variant que la clarté HSL. C'est souvent la phrase qui fait comprendre
   pourquoi le reste suit.
3. **Les franchissements de seuil à cran égal** : le chiffre de l'interchangeabilité. Zéro, une règle
   écrite une fois vaut pour toutes les teintes ; au-delà, chaque usage se re-teste teinte par
   teinte.
4. **Les constats**, du plus grave au moins grave, chacun avec ses actions (studio : trois en
   vue, le reste replié). Les contrôles des fichiers livrés, la distinguabilité sous trois
   daltonismes, le barreau médian.
5. **Entre sources** : familles alignées, divergentes, partagées, exclusives ; un même nom pour
   deux couleurs ; deux noms pour une même couleur ; grilles de crans ; puis **le triage** —
   les divergences d'abord, puis ce que la régénération bougerait.
6. **La décision** : garder ou régénérer, avec quelle méthode, la méthode de repli, ce que ça
   bouge famille par famille, ce qui ne dépend pas de la méthode. `--format decision` l'écrit
   en une page qui se lit en trois minutes.

## Les seuils, et pourquoi

| Mesure | Seuil | Raison |
|---|---|---|
| Deux valeurs identiques | ΔE2000 < 0,5 | sous le seuil de discrimination, même en comparaison directe |
| Un même nom pour deux couleurs | ΔE moyen ≥ 10 | plus une nuance : une autre couleur |
| Deux noms pour une même couleur | ΔE moyen < 5 sur au moins deux crans communs | indiscernables en interface |
| Familles proches, cran par cran | < 1 indiscernable, < 2,5 inexploitable | ce qu'un écran et un œil séparent |
| Impact d'une régénération | < 7 quasi invisible, 7–15 perceptible, ≥ 15 visible | ce qui se montre avant de basculer |
| Distinguabilité (daltonismes) | OKLab × 100 < 5 | deux aplats se confondent |
| Paires de texte / d'interface | 4,5:1 / 3:1 ; désactivé exempté | WCAG 1.4.3 et 1.4.11 |

## Ce qu'il ne faut pas faire

- **Régénérer avant d'avoir décidé.** L'audit sert à décider ; « Corriger dans Créer » (ou
  `hueladder import` puis le parcours) vient après, quand la décision est prise.
- **Fusionner une couleur de statut avec une couleur d'identité**, même à ΔE 0,2 : ce sont deux
  intentions. C'est la couleur système qui s'écarte ; le diagnostic propose trois options
  chiffrées.
- **Écrire une phrase chiffrée à la main** dans un rapport : elle finit par contredire ses
  chiffres. Tout ce que l'audit dit est calculé.
- **Comparer un sombre déclaré à un clair régénéré** : un sombre se juge contre son clair.
- **Croire un libellé** dans un fichier de design : lire la valeur, pas le nom du calque.
