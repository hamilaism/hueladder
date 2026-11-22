# Mode sombre : faut-il des méthodes plus « perceptives » ?

Complément à `references/mode-sombre/recherche.md`, octobre 2026. 
Conventions : **[S]** sourcé (URL lue) · **[C]** calculé ici avec le moteur Hueladder · **[I]** inférence ou avis.

Scripts dans `perceptif/` (`node perceptif/compare.mjs '#121212'`) :

- `compare.mjs [fond]` : 8 barreaux sombres pour les 3 rampes du gabarit (`brands/_template.json`, méthode `fusilier`, 50→950) et une rampe grise de même luminance. Pour chaque cran : contraste WCAG et Lc APCA face au fond, et vérification de la règle du nom. La règle utilisée est celle du moteur : Δ5 rangs ⇒ 3:1, Δ6 ⇒ 4,5:1, Δ8 ⇒ 7:1 (`rankForUI/AA/AAA`). Sortie dans `compare-121212.txt` et `compare.json`.
- `hk.mjs` / `hk-fixed.mjs` : effet Helmholtz–Kohlrausch, avec fond réel ou avec conditions de vision fixes.
- `de.mjs` : ΔE (OK et 2000) au fond, en clair et en sombre.
- `cam16x.mjs` : copie de `lib/cam16.mjs` qui exporte en plus les conditions de vision.

---

## 0. Réponse courte

1. **[C] On n'est pas faible : le miroir WCAG est déjà un miroir perceptif au sens des espaces uniformes.** Sur #121212, en miroir WCAG, l'écart au fond est le même en clair et en sombre à ±3 près, que l'on mesure en ΔE_OK, en ΔE2000 ou en ΔL*. Un miroir « ΔL* égal » ou « ΔL OKLab égal » ne déplace les crans que de 0 à +13 % en ratio, soit +1 à +4 en Lc. Il n'apporte donc rien, sauf un risque de plus : sa marge Δ6 tombe à 4,62.
2. **[C+S] Ce que les espaces uniformes ne voient pas, c'est l'adaptation au fond.** L*, OKLab et ΔE supposent un observateur adapté à un fond fixe. Seuls APCA (exposants inverses, Somers) et CAM16 avec le Yb réel modélisent le fait que des clairs sur du noir paraissent moins contrastés. Les études de lisibilité vont dans ce sens (Piepenbrock 2013, Dobres 2017, Luzsa & Mayr 2025), surtout en petit corps. Mais ces deux modèles sont non normatifs ou extrapolés.
3. **[C] Le conflit WCAG / APCA est structurel.** Le cran 950 est collé au plafond du fond (18,37 sur 18,73). Pour remonter les crans du milieu vers APCA, il faut resserrer les crans du haut, et l'on casse la règle « Δ6 ⇒ AA ». Le seul jeu disponible est la **marge de la grille** : à 6 rangs elle vaut 5,26:1, pour 4,5:1 exigés.
4. **[C] Un miroir hybride (« bridge ») exploite exactement cette marge.** Sur les 4 rampes et sur les fonds #000, #121212 et #1f1f1f, il tient la règle du nom (Δ6 minimal : 4,52 à 4,55). Il rapproche le Lc de 7 à 17 points sur les crans 200 à 800, par exemple : 600 passe de Lc −43 à −60, 700 de −55 à −70. Son prix : les crans voisins du haut sont espacés de ×1,20 au lieu de ×1,32.
5. **[C, modèle incertain] Helmholtz–Kohlrausch.** Sur les crans saturés, la clarté perçue est déjà presque symétrique en miroir WCAG : bleu 500, ΔJ_HK de 48,1 en clair contre 49,4 en sombre. Pour un gris de même luminance, on a 60,6 contre 36,9. Le déficit qu'APCA signale concerne donc surtout les neutres. **Ne pas implémenter de compensation H-K.** Le modèle est trop incertain, mais c'est une raison de ne pas pousser les accents saturés au plein APCA.

**Recommandation** : ajouter **une** méthode, `mirror-bridge` (formule au §4), pas une famille « perceptive ». Garder `mirror-wcag` par défaut. Ne pas ajouter ΔL*, OKLab, ΔJ CAM16, ΔE ni H-K comme méthodes, mais citer les mesures qui justifient de ne pas les ajouter.

---

## 1. Ce que font les systèmes (complément)

| Système | Espace | Métrique de contraste | Mode sombre | Source |
|---|---|---|---|---|
| Material 3 (MCU) | HCT, tone = L* | **ratio WCAG 2** (`ContrastCurve` : ratio cible par niveau de contraste, de −1 à 1 ; `foregroundTone`) | tons remappés par rôle | [S] https://pub.dev/documentation/material_color_utilities/latest/dynamiccolor_dynamic_color/DynamicColor-class.html , `color_spec_2021/2025.ts` |
| Apple | non publié | 4,5:1 minimum, 7:1 visé ; variante « contraste augmenté » | dessiné à la main | [S] HIG Dark Mode |
| Radix | OKLCH | APCA (Lc 60 et 90 publiés) | échelles dessinées, recalage par Bézier | [S] voir recherche.md §1.4 |
| Linear | LCH (« perceptually uniform ») | variable `contrast` ; formule non publiée | 3 entrées (base, accent, contraste) pour plus de 100 variables | [S] https://linear.app/now/how-we-redesigned-the-linear-ui |
| Vercel Geist | P3, dessiné | non publiée | fond noir pur, ajout d'un gray-1000 « pour le contraste sombre », plus de saturation aux extrémités sombres | [S] https://vercel.com/geist/colors |
| Figma | tokens dessinés | mode « enhanced contrast » aligné sur WCAG AA | thèmes ajoutés au code, canevas non touché | [S] https://www.figma.com/blog/illuminating-dark-mode/ |

**[I]** Aucun système publié ne dérive son sombre d'un modèle d'apparence ou de clarté perçue. Le plus « perceptif » (Material 3) combine un espace perceptif (L*) et une métrique WCAG 2, ce que Hueladder fait déjà. Radix est le seul calé sur APCA, et il le fait à la main.

---

## 2. Les pistes, une par une

Tous les chiffres sont pris face à **#121212** (budget 18,73:1), sur la rampe **brand** (#2f66e4). Les rampes error, neutral et gris donnent les mêmes chiffres à ±0,1 près (voir `compare-121212.txt`).

Pour mémoire, le clair (contraste avec le blanc, puis Lc) :

| | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WCAG | 1,15 | 1,51 | 2,01 | 2,63 | 3,48 | 4,61 | 6,03 | 7,96 | 10,52 | 13,78 | 18,32 |
| Lc | 0 | 24 | 39 | 51 | 62 | 71 | 79 | 87 | 93 | 99 | 104 |

### 2.1 Égalité de ΔL* (CIELAB) au fond

- **Principe [I]** : L*_sombre,i = L*_fond + (100 − L*_clair,i). C'est le « tone-flip » ancré sur le fond réel au lieu de 0.
- **Sources [S]** : Material 3 raisonne en écarts de ton (40 ⇒ 3:1, 50 ⇒ 4,5:1, `contrast_for_accessibility.md`).
- **Effet [C]** :

| | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|
| WCAG | 2,09 | 2,86 | 3,90 | 5,20 | 6,67 | 8,45 | 10,65 | 13,40 | 18,23 |
| Lc | −11 | −19 | −28 | −38 | −47 | −58 | −70 | −84 | −105 |

  - Par rapport au miroir WCAG, le gain est de +1 à +4 en Lc.
  - La règle tient, mais Δ6 minimal descend à 4,62–4,70 (contre 5,25), parce que le 950 baisse légèrement.
- **Verdict** : presque identique au miroir. **[C]** La raison : sur ce domaine, ln(Y + 0,05) et L* sont presque affines l'un de l'autre, et le terme de voile de 0,05 joue le rôle de la racine cubique. **À ne pas ajouter.**

### 2.2 Égalité de ΔL OKLab

- **Principe** : L_ok,sombre = L_ok,fond + (1 − L_ok,clair). Pour un gris, L_ok = Y^(1/3).
- **Effet [C]** : à peu près le même que ΔL* (500 : 5,15:1, Lc −38 ; Δ6 minimal 4,70).
- **Verdict** : **à ne pas ajouter.**

### 2.3 ΔE au fond (ΔE_OK, ΔE2000)

- **Principe** : garder la différence de couleur totale (clarté + chroma) avec le fond.
- **Mesure [C]** (`de.mjs`), en miroir WCAG actuel, ΔE clair → sombre :

| Cran | ΔE_OK | ΔE2000 |
|---|---|---|
| 200 | 25 → 24 | 27 → 27 |
| 500 | 47 → 46 | 46 → 46 |
| 700 | 59 → 57 | 60 → 59 |
| 900 | 71 → 72 | 77 → 81 |

  Les autres rampes donnent les mêmes valeurs à ±3 près. **Le miroir actuel conserve déjà ΔE.**
- **Limite [S/I]** : ΔE2000 n'est pas validé pour de grandes différences, et ΔE n'est pas une métrique de lisibilité. Parce qu'il intègre la chroma, il autoriserait des accents saturés moins contrastés en luminance, ce qui casse WCAG.
- **Verdict** : **à ne pas ajouter**, mais c'est un bon argument de communication : « le sombre est à la même distance perceptive du fond que le clair ».

### 2.4 ΔJ′ CAM16-UCS avec le fond réel (Yb)

- **Principe** : J′ = 1,7J/(1 + 0,007J), avec J calculé sous Yb = 100 en clair (fond blanc) et Yb = Y_fond en sombre. On égalise J′(cran) − J′(fond).
- **Effet [C]** :

| | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|
| WCAG | 3,45 | 5,07 | 7,27 | 9,83 | 13,14 | 17,11 | 18,73 | 18,73 |
| Lc | −24 | −37 | −51 | −66 | −82 | −100 | −107 | −107 |

  - Il va dans le sens d'APCA.
  - Mais il **sature** : 900 et 950 deviennent tous deux du blanc pur.
  - Il **casse la règle** : 400↔950 = 3,69:1.
  - Sur #000, il **diverge** : N_bb → ∞, tous les crans sortent à 1,00:1.
  - Sur #1f1f1f, 400↔950 = 2,91:1.
- **Sources [S]** : Li et al. 2017 ; Pei, Farnand, Fairchild 2025 (contraste simultané mal décrit).
- **Verdict** : **à rejeter** comme méthode. Il confirme seulement qualitativement le déficit sombre.

### 2.5 APCA, Lightness Contrast et Bridge-PCA

- **APCA [S]** : Lc est déjà le « lightness contrast » de Somers. Exposants 0,56/0,57 en polarité normale, 0,62/0,65 en inverse, plancher noir à 0,022 (https://github.com/Myndex/SAPC-APCA).
  - **[C] Miroir APCA pur** (même |Lc|, y compris sous Lc 30) : 500 à 10,87:1, 700 à 14,10:1.
  - Δ6 minimal : **2,04**. 11 violations de règle, dont 400↔950 = 2,04 et 100↔700 = 4,42.
  - `mirror-apca` (l'actuel, plancher Lc 30 et jamais sous le miroir) : Δ6 minimal 2,01, 8 violations.
- **Bridge-PCA [S]** (https://github.com/Myndex/bridge-pca) : variante d'APCA rendue « 100 % backwards compatible » avec WCAG 2. Si Bridge-PCA passe, WCAG 2 passe aussi. Seuils : Lc 60 ⊃ 3:1, Lc 75 ⊃ 4,5:1, Lc 90 ⊃ 7:1.
  - **[I]** C'est exactement le principe max(WCAG, APCA) de `mirror-apca`, appliqué à une paire. Il ne dit rien du contraste **entre crans**, qui est la promesse de Hueladder.
- **Verdict** : l'idée d'un pont est juste. Il faut l'étendre à la règle du nom : c'est le §4.

### 2.6 Peli, sensibilité au contraste

- **Peli 1990 [S]** (JOSA A 7(10), https://pelilab.partners.org/papers/ContrastJOSA.pdf) : contraste local à bande limitée, c'est-à-dire un contraste par fréquence spatiale rapporté à la moyenne locale.
- **[I]** C'est un outil pour des images, pas pour une paire de tokens. Ce qui en reste d'utile (petit texte = haute fréquence = plus de contraste nécessaire) est déjà dans les tables taille/graisse d'APCA.
- **Verdict** : **non applicable** à la dérivation d'une rampe.

### 2.7 Helmholtz–Kohlrausch

- **Formule [S]** (Hellwig, Stolitzka, Fairchild 2022, *Color Res. Appl.* 47(5), doi:10.1002/col.22793 ; coefficients relus dans `colour-science`, `hellwig2022.py`) :

  J_HK = J + f(h)·C^0,587, avec f(h) = −0,160 cos h + 0,132 cos 2h − 0,405 sin h + 0,080 sin 2h + 0,792.

- **Données [S]** : High, Green, Nussbaum 2023 (doi:10.1002/col.22839), sur écran. Plateau de 150° à 270°, pic rouge-magenta vers 330°, effet quasi nul pour les jaunes (h_ab ≈ 90°). Une issue de colour-science (#1047) signale que l'implémentation de référence utilisait la mauvaise chroma : le modèle est jeune.
- **Calcul [C]** (`hk-fixed.mjs`, Yb fixe pour isoler l'effet, J et C de CAM16, ce qui est une approximation) : écart de clarté au fond, ΔJ, en miroir WCAG.

| Cran | Gris de même Y, clair → sombre | Avec H-K, clair → sombre |
|---|---|---|
| bleu 500 | 60,6 → 36,9 | **48,1 → 49,4** |
| bleu 700 | 74,0 → 54,4 | 62,0 → 65,1 |
| rouge 500 | 57,9 → 39,6 | 48,6 → 48,7 |
| neutral 500 (peu chromatique) | — | 54,8 → 42,8 |

- **Lecture [I]**
  - H-K éclaircit la couleur. Sur fond blanc, cela **réduit** le contraste perçu ; sur fond sombre, cela **l'augmente**.
  - Pour les accents saturés, le miroir WCAG est donc déjà symétrique en clarté perçue. Le déficit sombre (APCA, CAM16 avec Yb) porte surtout sur les neutres et les teintes peu chromatiques.
  - Implication : un rehaussement APCA devrait être **plus fort sur les neutres que sur les accents**. C'est ce que font de fait Radix et Geist : texte neutre très clair, accents un pas plus clairs seulement.
- **Verdict** : **ne pas implémenter** de compensation H-K.
  - L'effet dépend fortement de la teinte et le modèle est jeune.
  - Avec le Yb réel, le lift H-K sombre gonfle à +16,7 sur bleu 500 (artefact de N_cb).
  - Il serait non normatif.
  - Le citer comme raison de ne pas appliquer le plein APCA aux accents.

### 2.8 Études de lisibilité en polarité négative

- **Piepenbrock, Mayr, Buchner 2013 [S]** : avantage de la polarité positive chez les jeunes (18–33 ans) comme chez les âgés (60–85 ans), en acuité et en relecture. Mécanisme : pupille plus petite, image rétinienne plus nette (https://www.psychologie.hhu.de/fileadmin/redaktion/Oeffentliche_Medien/Fakultaeten/Mathematisch-Naturwissenschaftliche_Fakultaet/Psychologie/AAP/Publikationen/2013/Piepenbrock-2013-Positive_display_polarity_is_.pdf).
- **Dobres, Chahine, Reimer 2017 [S]** (*Applied Ergonomics* 60:68–73) : le texte blanc sur noir est moins lisible, même en ambiance sombre, et le désavantage **croît quand la taille diminue**. Les participants ne le perçoivent pas subjectivement (https://jdobr.es/pdf/Dobres-etal-2017-Ambient.pdf).
- **Luzsa & Mayr 2025 [S]** (*Ergonomics* 69(2), doi:10.1080/00140139.2025.2457470) : l'effet de polarité persiste en VR et en MR.
- **[I]**
  - Aucune de ces études ne donne de **facteur de contraste** compensatoire. Elles justifient le sens (plus de contraste pour le texte en sombre, surtout en petit), pas l'amplitude.
  - L'amplitude n'est fournie que par APCA, qui n'est pas validé de façon indépendante et publiée.

---

## 3. Pourquoi WCAG et APCA ne se concilient pas entièrement [C]

- Soit x = ln(Y + 0,05). Le contraste entre deux crans vaut exp(Δx). Le miroir WCAG fixe x_sombre,i = x_clair,i + ln(k/1,05) : tous les Δx sont conservés.
- Toute famille qui **ajoute** une fonction croissante g(i) conserve la règle. Mais le cran 950 est déjà à 18,37 pour 18,73 possibles, soit g(950) ≤ ln(18,73/18,37) = 0,019, donc g ≤ 0,019 partout. **On ne peut rien remonter sans resserrer.**
- La seule marge vient de la grille :
  - Δ6 vaut 5,26:1 pour 4,5 exigés, soit ×1,17 de marge.
  - Δ5 vaut 3,99 pour 3, soit ×1,33.
  - Le pas voisin vaut 1,319.
- C'est cette marge que le miroir hybride répartit. **Sur une nomenclature dont la grille tient Δ6 à 4,5:1 pile, l'hybride redevient le miroir.**

---

## 4. La méthode à ajouter : `mirror-bridge` (miroir hybride)

**Principe** : cible APCA (comme `mirror-apca`), plafonnée de haut en bas pour que la règle du nom reste vraie, jamais sous le miroir WCAG, et avec un pas minimal entre voisins.

**Formule.** On note x = ln(Y + 0,05), m_i le barreau `mirror-wcag`, a_i le barreau `mirror-apca` actuel (déjà ≥ m_i), et R = {(rankForUI, 3), (rankForAA, 4,5), (rankForAAA, 7)} pris dans `rules`. On calcule pour i = n−1 jusqu'à 0 :

```
v   = min( x(a_i),
           min_{(d,r)∈R, i+d<n}  x_{i+d} − ln(r · 1,01),   // règle du nom, 1 % de marge pour l'arrondi hex
           x_{i+1} − ln(s) )                               // pas minimal entre voisins
x_i = min( max(v, x(m_i)), ln(1,05) − 0,001 )              // jamais sous le miroir, jamais au-delà du blanc
Y_i = exp(x_i) − 0,05
```

**Paramètres**
- `s` = 1,2 par défaut, c'est-à-dire environ 2/3 du pas de grille en log (1,319^0,66).
- Marge de 1 % : sans elle, l'arrondi hex donne 4,49 ou 2,99.

**Garantie, par récurrence**
- Si le miroir tient la règle et que x_{i+d} ≥ m_{i+d}, alors x_{i+d} − ln r ≥ m_i. Le plancher m_i ne viole donc rien, et chaque cran tient la règle avec ceux qui le dominent.
- Le code de référence est `hybridLadder` dans `compare.mjs` (environ 12 lignes).
- Dans le moteur, ce serait une branche de plus dans `darkLadder`, sans autre changement.

**Résultats [C]** (brand ; les autres rampes donnent les mêmes valeurs à ±0,1)

| #121212 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 | Δ6 min |
|---|---|---|---|---|---|---|---|---|---|---|
| Lc clair | 39 | 51 | 62 | 71 | 79 | 87 | 93 | 99 | 104 | — |
| mirror-wcag | 2,00 / −10 | 2,63 / −17 | 3,49 / −25 | 4,62 / −34 | 6,03 / −43 | 7,95 / −55 | 10,55 / −69 | 13,81 / −86 | 18,37 / −106 | 5,25 |
| **mirror-bridge** | 2,59 / −17 | 3,35 / −24 | 4,05 / −29 | 6,05 / −44 | **8,84 / −60** | **10,57 / −70** | 12,76 / −81 | 15,31 / −92 | 18,37 / −106 | **4,54** ✓ |
| mirror-apca | 5,40 / −39 | 7,28 / −51 | 9,13 / −62 | 10,99 / −72 | 12,52 / −79 | 14,07 / −87 | 15,47 / −93 | 16,86 / −99 | 18,37 / −106 | 2,01 ✗ |

**Selon le fond [C]**

| Fond | Δ6 min | 600 | 700 |
|---|---|---|---|
| #000 | 4,53 ✓ | Lc −60 (miroir −40) | Lc −69 (miroir −51) |
| #1f1f1f | 4,54 ✓ | Lc −60 (miroir −47) | Lc −70 (miroir −60) |
| #262626 | 4,36 ✗ | — | — |

Sur #262626, l'échec est le même que celui de `mirror-wcag` (4,37), parce que le fond dépasse le budget. L'hybride n'est jamais pire que le miroir.

**Sensibilité à `s` [C]** (brand, #121212)

| s | 600 | 700 | Pas des crans du haut | Commentaire |
|---|---|---|---|---|
| 1,10 | 12,5:1 / Lc −79 (= APCA) | — | ×1,10 | crans du haut presque indiscernables |
| 1,15 | Lc −69 | — | ×1,15 | |
| 1,20 | Lc −60 | Lc −70 | ×1,20 | défaut proposé |
| 1,25 | Lc −53 | — | ×1,25 | |
| 1,319 | — | — | ×1,32 | identique au miroir WCAG |

C'est **le** curseur honnête du compromis : « distinction entre crans voisins ↔ proximité APCA ».

**Ce qu'il coûte**
- Les crans 600 à 950 sont espacés de ×1,20 au lieu de ×1,32, donc moins de différence de survol ou d'état dans le haut de la rampe.
- La règle tient avec 1 % de marge au lieu de 17 %.
- 50 et 100 ne bougent pas (sous Lc 30).
- Il reste loin du plein APCA sur 300–500, car le cran 400 est bridé par 950/4,5.

**Défaut proposé [I]**
- Garder `mirror-wcag` par défaut. Il est exact, se compose, et il est symétrique en ΔE et en ΔL*.
- Proposer `mirror-bridge` comme **option recommandée quand le texte sombre doit tenir APCA** (Lc 60 pour le corps de texte à partir du 600).
- Il remplace avantageusement `mirror-apca` comme réponse au compromis WCAG/APCA. Garder `mirror-apca` comme témoin, puisqu'il casse la règle.
- Ne rendre `mirror-bridge` défaut qu'après revue visuelle sur les marques de test. Point à vérifier : la compression des crans 700–950.

**Raffinement possible, non implémenté [I]** : moduler la cible APCA par la chroma, puisque H-K suggère que les accents saturés en ont moins besoin. Par exemple : cible = m_i + (a_i − m_i)·(1 − C_ok/C_max). À ne faire qu'avec des données, puisque le modèle H-K est jeune.

**Test minimal à laisser** : pour toutes les rampes, nomenclatures et fonds de #000 à #1f1f1f, vérifier `rulesOk(mirror-bridge)` et que chaque Y est ≥ celui de `mirror-wcag`.

---

## Sources

- Hellwig, Stolitzka, Fairchild 2022, *Extending CIECAM02 and CAM16 for the H–K effect*, doi:10.1002/col.22793 ; coefficients : https://github.com/colour-science/colour/blob/develop/colour/appearance/hellwig2022.py ; issue : https://github.com/colour-science/colour/issues/1047
- High, Green, Nussbaum 2023, doi:10.1002/col.22839 (https://onlinelibrary.wiley.com/doi/10.1002/col.22839)
- Pei, Farnand, Fairchild 2025, doi:10.1002/col.22980 ; Li et al. 2017 (CAM16)
- Bridge-PCA : https://github.com/Myndex/bridge-pca , https://bridgepca.com/ ; APCA : https://github.com/Myndex/SAPC-APCA
- Peli 1990, JOSA A 7(10) : https://pelilab.partners.org/papers/ContrastJOSA.pdf
- Piepenbrock et al. 2013 : lien ci-dessus (hhu.de) ; Dobres et al. 2017 : https://jdobr.es/pdf/Dobres-etal-2017-Ambient.pdf ; Luzsa & Mayr 2025 : https://pubmed.ncbi.nlm.nih.gov/39918051/ ; NN/g : https://www.nngroup.com/articles/dark-mode/
- Material Color Utilities DynamicColor / ContrastCurve : https://pub.dev/documentation/material_color_utilities/latest/dynamiccolor_dynamic_color/DynamicColor-class.html
- Linear : https://linear.app/now/how-we-redesigned-the-linear-ui ; Vercel Geist : https://vercel.com/geist/colors ; Figma : https://www.figma.com/blog/illuminating-dark-mode/
