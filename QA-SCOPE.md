# QA scope of this public-code snapshot

## Reproducible here without raster assets

All 15 original standalone `.test.cjs` scripts are included. Four were adapted only to use dependencies inside this checkout. The combat-stat test also now fails explicitly if its required historical fixture is missing, rather than silently skipping that comparison. Test assertions are otherwise unchanged.

Seven historical JavaScript modules (223,843 bytes) are included under `tests/fixtures/`. They are code, not recorded player saves. Each retains the exact hash of the corresponding frozen original. The test runner verifies those hashes before running tests. This includes migration, deterministic campaign maps/events, shop logic, engine statistics, input, strategy, and procedural-art checks.

Three additional Python tests verify missing/empty asset rejection, script-termination escaping, and read-only assembly validation. Their synthetic registry does not contain actual portraits and does not establish playable output.

## Not reproduced by this checkout alone

The full release's 263-group aggregate QA harness is intentionally not copied. It requires the full-asset assembled HTML, selected source PNGs, generated WebP atlases and portrait metadata, older complete release files, and additional historical baseline inputs. Those artifacts are outside this code-only publication scope. Passing the included 15 scripts is not equivalent to rerunning the 263-group release audit.

The portrait-packaging helper additionally requires separately supplied original PNGs, Sharp 0.35.5 and its native libraries. Its image-proof step is not a browser renderer.

No browser/mobile visual, touch, accessibility, performance, deployed-service, or user-save verification is claimed. No GitHub, CI, hosting, deployment, account, or authentication configuration is included.

## Provenance

Current product source modules and the three procedural-art dependencies are copied byte-for-byte from the tested v0.8.2 inputs. The HTML template is also unchanged. `SOURCE-PROVENANCE.json` records those hashes, historical fixtures, adapter changes, and the excluded full release's reference hash. A full assembly can be byte-identical only when the separately supplied registry also matches its recorded hash.
