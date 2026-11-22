---
name: hueladder
description: >
  TRIGGER on: hueladder, color scale, color ramp, color tokens, brand palette, generating a
  50-950 / 100-900 scale, color steps, color primitives of a design system, "which generation
  method", OKLCH, Fusilier, color-shades, Leonardo, HCT / Material tone, APCA, contrast curve,
  fixing a palette, uneven palette, interchangeable color families, dark mode of a palette,
  exporting colors to Figma / Tokens Studio / Tailwind; in French: échelle de couleur,
  nuancier, palette de marque. Compares 11 scale-generation methods, plus the existing colors
  as a witness, on a brand's real colors; audits existing palettes; produces a decision report,
  a contrast-locked tuner and DTCG tokens ready for Figma. Use whenever a few hand-picked
  colors must become complete, defensible scales, or an existing palette that isn't right
  must be audited or fixed.
---

# Hueladder — color scales you can defend

A brand arrives with a few colors picked by hand. A design system needs complete scales,
consistent with one another and defensible in a meeting. This tool bridges the two, and above
all it **measures** what each option costs.

The engine is frozen, validated code — **never rewrite the color science**. The work is to
extract the right colors, write the spec, run the build, then **read the results and
recommend**. That last part is where the value for the team lies.

## Three ways in

First ask what the person came to do. The studio opens on the same three entries, which share
the spec: you move from one to another without losing anything.

- **Audit** — they have a palette, or several (brands, products, versions), and want to know
  what it is worth, without changing anything. `$C audit a.json b.css --names Brand,Product`
  returns, per source, the reading (what was dropped and why), the closest method, the
  threshold crossings, the findings and the keep-or-regenerate decision; across sources, the
  aligned, divergent or exclusive families, the different names for the same color, the triage
  table. `--diff` compares two versions (lost paths, changed values, aliases); `--format
  decision` writes the page that reads in three minutes. Present the reading **before** the
  numbers. To fix: `$C import`, then the path below.
- **Understand** — they want to understand the methods and choose theirs. `$C explain`
  (synthetic example: nine starting colors, nothing else supplied) or `$C explain <spec>`: the
  thesis and the titled findings, each computed from the numbers; the frame (space ≠ method ≠
  tool), the five families, one card per method (what it makes equal across hues, how it
  spreads the steps, when to choose it, what to know), the criteria table (same verdict at the
  same step, gap across hues, step gap for 3 · 4.5 · 7:1, intervals, pairs, vividness, starting
  color moved: what is good, the best on each criterion), the contrast of each step against
  white, method by method, the uses, the choice guide, a presentation outline, the protocol and
  its limits, the other choices (dark mode, naming, standard). Don't plead: each method has its
  strengths, and Fusilier is Hueladder's default for one criterion (even intervals), not a
  ranking. Each method's targets (contrasts, Lc, tones, lightnesses) come from the chosen
  number of steps, never from the method: methods are compared at equal steps. For
  stakeholders: start from the choice guide.
- **Create** — the seven-decision path below.

## Create: the path, as a conversation

The studio (`hueladder.html`) asks seven decisions in a set order; an agent asks the same ones,
in the same order, with `engine/hueladder.mjs`. **One decision at a time**: show the
information that lets the person decide (numbers, not an opinion), recommend, wait for the
answer, then write it into the spec. Offer the studio as soon as the person is a designer and
prefers to see (`hueladder.html`, or online at https://hamilaism.github.io/hueladder/); the spec
moves between the two without loss.

```bash
C="node <this skill's folder>/engine/hueladder.mjs"   # the folder that holds this SKILL.md
$C help
```

Only dependency: Node.js. Every command accepts `--json` (data output, to read rather than the
text) and `--lang`. The spec is the only state: every command reads it; `new`, `import`,
`suggest --write` and `fix` rewrite it.

**Language.** Answer in the person's language. Commands answer in English by default; for a
French speaker, pass `--lang fr` to `new` and `import` (the spec keeps the language, later
commands follow it) and to `explain` and `audit`.

### 0. Steps

Ask how the team names its steps, and how many it wants. By default, the 50 → 950 grid
(`naming: "grid"`). If they want to **add a step later without moving anything**, offer
`hundreds` (hundreds by contrast) or `shade` (the name is the contrast, David Fusilier); if
they already have ranks (Radix 1–12, Carbon 10–100), `rank`. Write `naming` and `stepList`.
Details: `references/nomenclatures.md`.

### 1. Enter

- An existing palette: `$C import <file> --brand Name --out <id>.json`. The file can be a list
  of hex values, CSS/SCSS, a Tailwind config, DTCG or Tokens Studio tokens. **Tell the user
  what was dropped** (aliases, rgba, duplicates): nothing may disappear silently.
- A single color: `$C new "#2f5bd3" --brand Name --out <id>.json`.
- From Figma: `references/extracting-colors.md`. Read the displayed text, not the layer name,
  and scan the whole file before concluding that a brand has only one color.

### 2. Diagnosis

`$C diagnose <id>.json` returns the findings, from most to least severe, each with numbered
actions (rename, replace, remove, set the hue aside, regenerate, keep and document). Present
them **one by one**, with the finding's sentence and numbers, and ask which one to apply:
`$C fix <id>.json <finding> <action>`. An exception that is kept goes into the spec
(`accepted`, `notes`) and does not come back.

`$C suggest <id>.json` says what is missing (a neutral tinted by the brand, the four system
colors placed away from the hues already taken); `--write` adds them, after agreement.

Starting from an existing palette: `$C suggest <id>.json --ladder` gives the **median ladder**
(the median of the supplied luminances, step by step) and its gap to the default ladder; a
small gap means the palette already followed a rule. `--write` adopts it, after agreement. A
system color too close to an identity color gets three options with numbers (darken, pull the
hue, proven value): the brand does not move, the system steps aside.

### 3. Generate

`$C compare <id>.json`: each method, whether it will hold the contract, its mean gap to the
original colors (ΔE) and its threshold crossings. The contract is the set of checks from the
Verify step, including the naming rule (the same step gap guarantees the same contrast on every
hue). The adapted Fusilier is Hueladder's default, at the top of the list: a preference for even
intervals, not a ranking. Say it is adapted: David Fusilier's contrast targets, exactly, on an
OKLCH path (color-shades keeps the HSL hue and saturation); the tuner and dark mode work in
OKLCH too. The original, `colorshades` (color-shades reproduced to the hex), sits right after
it, to compare. Leonardo comes the same way: `leonardo` is Adobe's library, to the hex;
`leonardoAdapted` is the same search and ratios, but colors that fall outside sRGB lose chroma at
the same hue, where the library clips RGB channels and turns the hue of dark yellows, oranges and
reds. Name which one you show. Choose on these numbers and on the criterion that matters to the team
(`$C explain` compares them criterion by criterion). Write `coreMethod`. Reading the results:
`references/reading-results.md`, `references/methods.md`.

Vividness: `"lightChroma": "vivid"` re-saturates the light steps at constant luminance (so
without touching a single contrast), in a bell, never below the previous chroma nor beyond 96 %
of the gamut. Offer it when the team finds the ramp dull; the neutral is left alone.

### 4. Tune (optional)

The tuner (`tuner.html`, produced by `build`) locks contrast and leaves hue and vividness
free. Without it: write the values into `ramps[].tuned` (`{ "500": "#…" }`),
`"coreMethod": "tuned"`, `"tunedBase": <method>`, then `$C check`: a value off the luminance
ladder breaks the guarantee, and the check will say so. `references/tuner.md`.

### 5. Dark mode

Three decisions, in this order:

1. **The background.** It sets the highest possible contrast (`#121212`: 18.73:1). Too light,
   and the last steps no longer reach their contrast.
2. **The method.** `$C compare <id>.json --dark --bg "#121212"` judges each one under WCAG 2
   (does the naming rule survive?) and under APCA (does text stay as readable as in light
   mode?). `mirror-wcag` by default: the only one that carries the rule over exactly.
   `mirror-bridge` if the team also judges in APCA: the rule holds, text gains 7 to 17 Lc in
   the middle of the scale, at the price of thresholds reached one step earlier than in light
   mode. The others serve as witnesses.
3. **Vividness.** Keep the light-mode chroma (the measured systems keep 90 to 100 % of the
   allowed chroma); `chromaProfile: "bell"` or `desaturate` (surfaces only) are options to
   justify.

Write `darkMode`. Add `staticTokens` for what does not invert (a white that must stay white).
Sources and measurements: `references/mode-sombre/recherche.md` and
`references/mode-sombre/perceptif.md`.

### 6. Verify

`$C check <id>.json`: the system contract (interchangeability, naming rule pair by pair in both
modes, monotonicity, hue, chroma, gamut, budget). Exit code 1 if anything is red. Each red
points back to an earlier decision: go back there rather than ship. A deliberate deviation is
accepted in the studio (Verify step) and documented (`assumed`).

`node engine/check.mjs` checks the tool itself (color science, rendering, determinism,
studio): run it after any change to the engine. Without Chrome, the rendering sections are
skipped: say so rather than conclude "all green".

`$C verify <tokens.json> [--dark <tokens.json> --bg #hex] [--rule N]` checks **delivered**
files (retouched, exported, copied), not the engine's output: validity (no `null`, a type),
monotonicity, thresholds at the same step for every family, naming rule read back from the
files. Tinted backgrounds to hold are declared in `surfaces`: the contract says where AA text
starts on each one.

### 7. Ship

`$C export <id>.json --format package --out dist` writes one folder per destination:

- `code/`: CSS variables (dark under `[data-theme="dark"]`), Tailwind 4 (`@theme`),
  Tailwind 3, DTCG tokens;
- `figma/`: one file per mode, to drop together into the Variables panel (colors in the object
  format of the native import);
- `tokens-studio/tokens.json`: one set per mode, themes for the Pro version;
- `ai/`: `color-guide.md` (the rule, the role of each step) and `palette.json` (the same
  information as data), to attach to the context of an agent that builds interfaces;
- the spec, the migration (imported palette) and a README.

A single format: `--format css | tailwind | tailwind4 | dtcg | dtcg-dark | guide | palette |
migration`. The decision report (`index.html`) and the tuner: `$C build <id>.json --out
<folder>` (same as `node engine/build.mjs`). The studio produces the same files, bit for bit.

**Hueladder offers a scale, not a semantic system.** The tokens and the guide describe what
each step is for (background, border, text, with which steps it passes AA); they do not assign
roles (`action.primary`, `surface.default`…). That mapping stays the team's decision.

For a client project, copy the engine into the project folder
(`cp -R engine clients/<client>/hueladder`): the delivery stays reproducible without depending
on a future version of the tool.

Package options, to offer depending on the product: `"cvdModes": true` (color-vision
deficiency modes with locked luminance: status hues rotate to stay distinguishable, nothing
else changes), `"dataviz": true` (dataviz palettes as aliases of steps; beyond four series, a
second encoding), `gradients` (measured and normalized gradients, stop tokens). Starting from a
palette, the package also contains `decision.md`, the keep-or-regenerate page.

## What not to do

- **Don't reimplement ΔE2000, APCA or CAM16.** They are in `lib/`, validated against the
  published vectors. An on-the-fly reimplementation will be wrong.
- **Don't strip the report.** The 5 chart groups, the pair tester, the conventional uses, the
  matrices and the appendix are part of the delivery.
- **Don't choose the method before reading the numbers.** `fusilier` is a reasonable default,
  not a conclusion.
- **Don't take Tailwind as an aesthetic reference.** Its interchangeability is poor
  (measurable in the report). It serves as the "hand-drawn palette" witness, nothing more. The
  perceptual reference is the brand's own colors.
- **Don't invent colors.** Everything in `anchors` comes from a verifiable source.
- **Don't promise a zero contrast gap across hues.** The hex grid is discrete: the best
  achievable over 20 families is around 0.04 point, about 1 % relative. The number that goes
  into the design system's documentation is **zero threshold crossings**.
- **Never average two colors on their RGB components.** The average moves luminance, hence
  contrast, hence the meaning of the step. When a team hesitates between two variants, average
  **on chroma in OKLCh**, at constant luminance and hue (`blendVariants` in `lib/tune.mjs`) —
  measured, the RGB average is off by 9 % on Y.
- **Don't re-saturate a dark mode uniformly.** Without a bell profile, the extreme steps turn
  into flat fills instead of staying backgrounds: measured, +1065 % chroma on a 50 step.

## References

These documents are in French for now; read them all the same.

| File | When to open it |
|---|---|
| `references/audit.md` | auditing: what to give, in what order to read and present, the thresholds and why |
| `references/brand-spec.md` | writing the spec: every key and its effect |
| `references/reading-results.md` | interpreting the report and phrasing the recommendation |
| `references/extracting-colors.md` | getting colors out of Figma cleanly |
| `references/methods.md` | the frame (space ≠ method ≠ tool), the five families, each method, conformance to the libraries |
| `references/tuner.md` | the contrast-locked tuner |
| `references/studio.md` | the Hueladder studio: path, reading imports, diagnosis, exports |
| `references/lecons.md` | what real projects taught — reread before recommending |
| `references/feuille-de-route.md` | what is still missing, before promising a feature |
| `references/nomenclatures.md` | the ways to name steps (rank, lightness, contrast) and their rules |
| `references/mode-sombre/recherche.md` | the documented dark-mode methods, sources and measurements |
| `references/mode-sombre/perceptif.md` | "perceptual" methods evaluated, and why `mirror-bridge` |
| `references/benchmark.md` | the other tools, what Hueladder adds, and the delivery formats (Figma, Tokens Studio, code) |
