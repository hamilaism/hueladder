# Third-party notices

Hueladder is released under the [MIT license](LICENSE), with the exceptions below. They apply
to the files named here and to `hueladder.html`, which embeds the engine.

## APCA (`engine/lib/apca.mjs`)

A port of [apca-w3](https://github.com/Myndex/apca-w3) (APCA 0.0.98G-4g), copyright © 2019-2023
Andrew Somers and Myndex Research. **This file is not covered by Hueladder's MIT license.** Its
author licenses it under the
[W3 License for Compliant Code Only](https://github.com/Myndex/apca-w3/blob/master/LICENSE.md):

- use for web-based content, in support of the WCAG accessibility guidelines;
- no modification of the essential algorithm, and an obligation to keep it current;
- other uses fall under the AGPL v3, and commercial use outside that agreement needs a written
  license from Myndex. Patents are pending.

APCA™ and the related terms are trademarks of Myndex. Hueladder is not affiliated with,
certified or endorsed by Myndex. If you build Hueladder into a product, read the APCA license
for your use case first.

## Material Color Utilities (`engine/lib/cam16.mjs`)

Portions derived from [material-color-utilities](https://github.com/material-foundation/material-color-utilities),
copyright 2021 Google LLC, licensed under the Apache License, Version 2.0
([full text](LICENSES/Apache-2.0.txt)). Changes: ported from TypeScript to dependency-free
JavaScript, with Hueladder's own gamut solver.

## Leonardo, chroma.js and CIECAM02 (`engine/lib/leonardo.mjs`)

The `leonardo` method is a port, so that it gives exactly what Adobe's library gives:

- [@adobe/leonardo-contrast-colors](https://github.com/adobe/leonardo) 1.1.0 (the scale and the
  contrast search), copyright 2024 Adobe, Apache License 2.0 ([full text](LICENSES/Apache-2.0.txt));
- the [chroma.js](https://github.com/gka/chroma.js) 3.2.0 code it runs on (OKLCH conversions,
  hue interpolation, scale cache, clipping), copyright (c) 2011-2025 Gregor Aisch, BSD 3-Clause
  ([full text](LICENSES/chroma-js-BSD-3-Clause.txt));
- the CIECAM02 lightness that places the key color, from ciecam02 0.4.6 and ciebase 0.1.1,
  copyright (c) 2014 Bastien Dejean, BSD 2-Clause ([full text](LICENSES/ciecam02-ciebase-BSD-2-Clause.txt)).

Changes: gathered in one dependency-free file, for a single key color on a white background.

## color-shades and colorjs.io (`engine/lib/colorshades.mjs`)

The `colorshades` method (the original Fusilier) is a port, so that it gives exactly what David
Fusilier's tool gives:

- [color-shades](https://github.com/dfusilier/color-shades) (its shade search, commit 1c944dc),
  copyright (c) 2022 David Fusilier, MIT License;
- the [colorjs.io](https://github.com/color-js/color.js) 0.4.1-patch.1 code it runs on (HSL ↔ sRGB,
  the sRGB transfer function and luminance, WCAG 2.1 contrast, hex output), copyright (c) 2021
  Lea Verou, Chris Lilley, MIT License.

Both under the MIT terms quoted in the Tailwind section below. `engine/conformance/color-shades/`
holds color-shades' own functions, unchanged but for their imports, as the reference the port is
checked against.

## Tailwind CSS palette (`engine/lib/methods.mjs`)

The `tailwind` method embeds the Tailwind CSS 4.3 default palette.

> MIT License. Copyright (c) Tailwind Labs, Inc.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software
> and associated documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions: The above copyright
> notice and this permission notice shall be included in all copies or substantial portions of
> the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## Radix Colors (`references/mode-sombre/radix.mjs`)

A research script that quotes a few Radix Colors values. MIT License. Copyright (c) 2021-2022
Modulz, Copyright (c) 2022-Present WorkOS.

## Methods used as ideas, without their code

These methods are reimplemented from their published descriptions. No code is copied, and
each one is credited in the [README](README.md#credits): color-shades' contrast targets on an
OKLCH path (the adapted Fusilier, `fusilier`), chroma.js's `correctLightness` scale (the `easing` method), Oklab and OKLCH (Björn Ottosson),
Accessible Palette, ColorBox (Lyft), Stripe's accessible color system, Adobe Spectrum, IBM
Carbon, GitHub Primer and Atlassian. The test vectors and matrices come from
published papers: CIEDE2000 (Sharma, Wu & Dalal, 2005), CAM16 (Li et al., 2017) and
color-vision deficiency simulation (Machado, Oliveira & Fernandes, 2009).
