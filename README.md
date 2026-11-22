# Hueladder

**Color scales you can defend.**

**[Try the studio online](https://hamilaism.github.io/hueladder/)**, nothing to install. *Version française : [README.fr.md](README.fr.md).*

Hueladder turns the few colors a brand picked by hand into complete, accessible scales for a
design system, and puts a number on every trade-off. It compares eleven generation methods on
*your* colors, audits the palette you already have, and ships tokens for code, Figma and AI
agents.

No dependencies. The studio is a single HTML file that works offline; the command line needs
Node.js and nothing else.

## The promise: step names that carry contrast

Every scale Hueladder builds keeps one promise, and it is written in the step names: **two
steps N ranks apart pass a given contrast threshold, on every hue, in light and in dark
mode.** On an 11-step scale (50 → 950), that is 5 ranks for 3:1, 6 for AA (4.5:1) and 8 for
AAA (7:1).

A rule like *"900 text on a 100 background passes AA"* is then written once and holds for
every color family. The promise is checked pair by pair on the colors actually shipped, not
on a theoretical ladder.

Locking contrast costs a single degree of freedom, because contrast only depends on relative
luminance. Hue and chroma stay entirely yours: that is what the tuner lets you shape.

## Quick start

```bash
git clone https://github.com/hamilaism/hueladder.git
cd hueladder
open hueladder.html        # the studio (or just double-click it)
node engine/check.mjs      # the full verification: everything should be green
```

## Three ways in

**Create.** A complete system from a single color, or from a palette to rebuild. Choose how
steps are named, generate, tune each step while its contrast stays locked, derive dark mode,
verify the system contract, and download the delivery package.

**Audit.** What an existing palette is worth, without changing a thing. One palette or
several (brands, products, versions): findings backed by figures (*"success 500 has the
contrast of a 300"*), sources side by side, versions compared, and a keep-or-regenerate
decision page.

**Understand.** What each method makes equal from one hue to the next, what it costs, which
one to choose and how to present it: the frame, the families, one card per method, charts, a
criteria table, a choice guide and a Markdown brief, on an example or on your own colors.

The studio opens in English; French is one click away, and the choice is remembered.

## What you ship

One package, one folder per destination:

| Folder | Contents |
|---|---|
| `code/` | CSS variables, Tailwind 3 and 4, DTCG tokens |
| `figma/` | one file per mode, for Figma's native variable import |
| `tokens-studio/` | the same tokens for Tokens Studio |
| `ai/` | a usage guide and the same data as JSON, for agents as much as for people |

Plus a before/after migration table and the spec that rebuilds everything, bit for bit.
Hueladder ships the scale, not a semantic layer: each step says what it is good for, and the
semantic mapping stays your team's decision.

## The methods

Eleven generation methods, plus your existing colors as a witness. They all keep the hue and
vividness of your starting color, each in its own color space; what sets them apart is what
they make equal across hues at the same step.

| Method | Makes equal across hues | Comes from |
|---|---|---|
| `fusilier` | contrast, on a logarithmic progression: the gap between two step names gives their contrast | [color-shades](https://github.com/dfusilier/color-shades), David Fusilier. **Adapted**: his contrast targets, exactly; but Hueladder keeps the OKLCH hue and chroma of your color, where color-shades keeps its HSL hue and saturation, so that the tuner and dark mode work in the same space |
| `colorshades` | the same contrasts as `fusilier` | [color-shades](https://github.com/dfusilier/color-shades), David Fusilier. **Original**: his tool, reproduced to the hex, keeping your color's HSL hue and saturation. It is there to compare with the adapted version |
| `leonardo` | the WCAG ratio against the background, for the ratios you give it | [Leonardo](https://github.com/adobe/leonardo), Nate Baldwin (Adobe), interpolated in OKLCH (the library defaults to RGB) |
| `apca` | APCA contrast (Lc) against white | [APCA](https://github.com/Myndex/apca-w3), Andrew Somers. APCA is a measure; Hueladder turns it into a generator |
| `hct` | HCT tone | [Material Color Utilities](https://github.com/material-foundation/material-color-utilities), Google |
| `oklch` | OKLCH lightness | [Accessible Palette](https://accessiblepalette.com), Eugene Fedorenko, on Björn Ottosson's [Oklab](https://bottosson.github.io/posts/oklab/) |
| `easing` | CIELAB lightness, corrected | [chroma.js](https://gka.github.io/chroma.js/), Gregor Aisch (`correctLightness`) |
| `curves` | nothing across hues: lightness, chroma and hue each follow their own curve | the approach of [ColorBox](https://colorbox.io) (Lyft) and [Stripe](https://stripe.com/blog/accessible-color-systems), put into a formula |
| `mix` | nothing: a linear sRGB mix with white or black | Sass `mix()`, Bootstrap |
| `tailwind` | nothing: drawn by hand, the witness of manual design | the [Tailwind CSS](https://tailwindcss.com/docs/colors) palette |
| `anchored` | passes exactly through every color you already have | Hueladder, on Fusilier's backbone |

The adapted Fusilier is the default for one criterion, even contrast intervals: a preference for
predictability, not a ranking. Each criterion has its own best method, and the Understand
page shows which one. Third-party methods are applied the way their authors apply them; where Hueladder adapts one,
its name says so and the change is explained. Each method's targets come from the number of steps you choose, so all
of them are compared on equal terms.

**Dark mode is not a second palette.** It is the same contrast ladder, read against another
background. Six derivations, each rendered on your brand and judged under WCAG 2 or APCA:

| Derivation | Approach of |
|---|---|
| WCAG mirror | Adobe Leonardo |
| WCAG / APCA bridge | Hueladder |
| APCA mirror | Radix Colors |
| Budget share | Adobe Spectrum |
| Flipped tone (HCT) | Material 3 |
| Swapped steps | common practice (Tailwind, Atlassian) |

**Step names are a separate choice.** Hundreds on a 50 → 950 grid (the default), hundreds by
contrast, David Fusilier's 0–200 names (the name *is* the contrast), or plain ranks as in
Radix (1–12), IBM Carbon (10–100) or GitHub Primer (0–9). Add or remove steps freely; with
contrast names, adding a step moves no other.

## Command line

The same moves as the studio, for a person at a terminal or an AI agent. Every command reads
the spec, some rewrite it, all of them accept `--json`.

```bash
node engine/hueladder.mjs audit tokens.json                            # what your palette is worth
node engine/hueladder.mjs new "#2f5bd3" --brand Acme --out acme.json
node engine/hueladder.mjs compare acme.json                            # the methods, on your colors
node engine/hueladder.mjs check acme.json                              # the system contract
node engine/hueladder.mjs export acme.json --format package --out dist # the delivery package
node engine/hueladder.mjs explain                                      # the science, as Markdown
node engine/hueladder.mjs help                                         # every command
```

The studio only edits a spec, and the command line rebuilds the exact same tokens from it.
People use the page, agents use the spec, and both get the same result.

## Use it with your AI agent

Hueladder is an [Agent Skill](https://agentskills.io), the open `SKILL.md` format read by
Claude Code, OpenAI Codex, Cursor, Gemini CLI, GitHub Copilot and many other agents. Once
installed, it triggers on its own whenever a conversation is about color scales, color tokens
or a brand palette, and it leads the same decisions as the studio, one at a time, with the
numbers.

```bash
npx skills add hamilaism/hueladder         # pick your agents from the list
npx skills add hamilaism/hueladder -g      # the same, for all your projects
```

With Claude Code, `./install.sh` does the same from a clone: it links the repository instead of
copying it, so a `git pull` updates the skill. Either way, the agent needs Node.js to run the
engine.

Then just ask: *"Turn #2f5bd3 into an accessible color scale, with a dark mode"*, or *"Audit
the colors in tokens.css"*. The agent answers in your language.

[`llms.txt`](llms.txt) is the entry point for any other agent or LLM: the commands, and the
documentation in reading order.

## Verified, not approximated

| What | Checked against |
|---|---|
| CIEDE2000 | the 34 test vectors of Sharma, Wu & Dalal |
| APCA 0.0.98G-4g | the apca-w3 test vectors |
| CAM16 / HCT | material-color-utilities |
| Six generation methods | their original code (`engine/conformance`): mix, Tailwind 4.3, Leonardo and the original Fusilier identical to the hex (Leonardo is a port of Adobe's library, in OKLCH as in its default RGB; the original Fusilier is checked against color-shades' own functions, on the colorjs.io version it uses); HCT within ΔE 0.6; easing identical on 82 of 88 colors, within ΔE 1.7 at the gamut edge |
| The other five | no library to compare against: the adapted Fusilier (color-shades' targets, on an OKLCH path), APCA as a generator, OKLCH, curves and anchored follow the formulas written in [`references/methods.md`](references/methods.md) |

`node engine/check.mjs` runs the whole verification: color science, engine genericity, both
pages rendered in a real browser, build determinism, explicit rejection of invalid input, and
the system contract in both modes.

## Repository

```
hueladder.html   the studio, built by engine/studio.mjs; open it with a double-click
index.html       the GitHub Pages entry: opens the studio
SKILL.md         the agent skill (this repository is the skill)
llms.txt         the entry point for agents
install.sh       links the skill into Claude Code
THIRD_PARTY_NOTICES.md   what is not MIT (APCA) and the third-party portions
engine/          the engine and the CLI, zero dependencies, with their tests
references/      method, spec format, studio, reading results, dark-mode research
```

To add a generation method, the contract is at the end of
[`references/methods.md`](references/methods.md). Any change to `engine/lib` or to the
templates must keep `node engine/check.mjs` green; `node engine/studio.mjs` then rebuilds
`hueladder.html`.

## Status

Hueladder works and is verified, and it is young. The studio, the reports and the generated
files exist in English and French, and English is the default (`--lang fr` on the command
line). The in-depth references (`references/`) are still in French; English versions are
coming.

## Credits

Hueladder compares methods it did not invent, and it would not exist without the people who
did.

- **David Fusilier** ([@dfusilier](https://github.com/dfusilier)), for
  [color-shades](https://github.com/dfusilier/color-shades): steps that target an exact
  contrast, and names that carry it. Adapted, it is the default light-mode method; the
  original, reproduced to the hex, sits next to it for comparison. It is also one of the step
  namings.
- **Nate Baldwin** ([@NateBaldwinDesign](https://github.com/NateBaldwinDesign)), for
  [Adobe Leonardo](https://github.com/adobe/leonardo): colors defined by their contrast
  against a background, and recomputed when the background changes. It is the logic of the
  default dark-mode derivation.
- **Andrew Somers** ([@Myndex](https://github.com/Myndex)), for
  [APCA](https://github.com/Myndex/SAPC-APCA) and its research on readability.
- **Björn Ottosson** ([@bottosson](https://github.com/bottosson)), for
  [Oklab and OKLCH](https://bottosson.github.io/posts/oklab/).
- **Eugene Fedorenko**, for [Accessible Palette](https://accessiblepalette.com).
- **Gregor Aisch** ([@gka](https://github.com/gka)), for
  [chroma.js](https://gka.github.io/chroma.js/).
- **Google's Material Design team**, for HCT and
  [material-color-utilities](https://github.com/material-foundation/material-color-utilities).
- **Lyft**, for [ColorBox](https://colorbox.io), and **Stripe**, for their work on
  [accessible color systems](https://stripe.com/blog/accessible-color-systems).
- **Adam Wathan** ([@adamwathan](https://github.com/adamwathan)) and **Steve Schoger**
  ([@steveschoger](https://github.com/steveschoger)), for
  [Tailwind CSS](https://tailwindcss.com) and [Refactoring UI](https://www.refactoringui.com).
- **Radix Colors**, **Adobe Spectrum**, **IBM Carbon**, **GitHub Primer** and **Atlassian**,
  whose published color systems shaped the dark-mode derivations and the step namings.
- The color science: CIEDE2000 (Sharma, Wu & Dalal, 2005), CAM16 (Li et al., 2017),
  color-vision deficiency simulation (Machado, Oliveira & Fernandes, 2009), and
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (W3C).

Special thanks to David Fusilier and Nate Baldwin, whose work sits at the heart of
Hueladder's defaults, and to **Shaun Bent** ([@shaunbent](https://github.com/shaunbent)) for
introducing me to David.

## License

[MIT](LICENSE), except for the APCA code, which keeps its author's license (web content, in
support of WCAG), and a few third-party portions: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Use it, fork it, build its mechanics into your own product or package, and
rename what you build: that is what the license is for. A credit and a link back are always
appreciated. The one thing that isn't in the spirit of the project is the same tool, renamed,
with nothing added.

Made by [Ismail Hamila](https://github.com/hamilaism).
