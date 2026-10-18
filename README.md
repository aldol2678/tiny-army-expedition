# Tiny Army v0.8.2 code snapshot

Source-management snapshot for a local browser game. This checkout does not include a hosted game, deployment setup, raster portraits, or a complete self-contained playable release. Web publication is deferred until after v1.0.

## Included

- Game, campaign, UI, input, and HTML/CSS template source
- Procedural Canvas/SVG drawing code, including vector portraits, icons, backgrounds, and effects
- All 15 standalone code-test scripts, with seven small historical code fixtures for migration/regression checks
- Local assembly and optional portrait-packaging scripts

No original/generated image files, embedded portrait registry, user saves, private documents, research, prompts, account links, or historical playable HTML files are included. `SOURCE-PROVENANCE.json` records source hashes and the four test-path adaptations. `PUBLIC-MANIFEST.json` lists the public files. `QA-SCOPE.md` explains the test limits.

## Code tests

Tested with Node.js 24.19.0 and Python 3.12.14. The standalone code tests use only Node built-ins; no npm installation is needed.

```sh
node tools/run-tests.cjs
python3 tests/build-system.test.py
```

The runner starts each test in this checkout, checks required historical fixture hashes, and returns a failure if any test fails. These are synthetic/model tests, not browser, touch, accessibility, visual, or performance verification.

## Local assembly with separately supplied assets

1. Supply the authorized portrait registry as `assets-local/portrait-sheets.js`. It must define `TinyArmyPortraitSheets` for the eight classes listed in `assets/portrait-manifest.template.json`. For byte-identical reproduction, use the separately retained v0.8.2 registry matching the hash in `SOURCE-PROVENANCE.json`.
2. Check the inputs with `python3 assemble.py --check`.
3. Build with `python3 assemble.py`; the output is `dist/index.html`.

Both `assets-local/` and `dist/` are ignored. Assembly intentionally fails when the portrait registry is absent; it does not silently replace the selected portraits with fallback artwork. A clean checkout can run the code tests but cannot reproduce the full-asset game on its own. A local registry is executable JavaScript: only use trusted project assets.

To package separately supplied original PNGs, place the eight filenames from the asset template under `assets-local/portraits/`, install Sharp 0.35.5 in your local environment, and run `node tools/build-portrait-sheets.cjs`. That optional tool writes a lossless WebP registry, image proofs, and an asset manifest only under `assets-local/`. The original PNGs must be 2172 × 724 with alpha. Sharp and its native libraries are additional requirements for this optional step; they are not required for the code tests. Browser WebP rendering still needs separate verification.

## License

No new license has been chosen or granted for this snapshot. There is no LICENSE file. Public visibility does not itself grant an open-source license. No separate asset license is included or implied.
