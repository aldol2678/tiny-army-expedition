# Public verification scope

This is a source-review package, not a release. The public tests deliberately use synthetic states/configurations, temporary files, and fresh in-memory starter runs. No real player data or retained full-campaign save is included.

## Reproduced here

- 443 core mechanism tests: progression, encounter/status adapters, relic/service reducers, event choices, transactional spear journals, sixteen trial ultimate actions, exact checkpoint recovery, current-state profile validation, family weighting, and bounded training access.
- 15 public package tests: three boot/SRI loader cases, local import closure, missing-input failure, asset path/sanitization guards, exact audio pin, two fresh-engine smoke checks, three synthetic assembly-input boundaries, and three fresh-generated profile checks.
- The fresh starter smoke executes one generated battle and cold-replays it, then verifies exact retry. This is not a win-rate sample or full-campaign proof.
- The U2 render sample is observational over a fresh checkpoint. It is not visual equivalence in a browser.
- No dependencies are installed by the tests. `npm test` runs a single Node test process with built-ins. Python is used only for local assembly-input checks.

## Source lineage, not repeated acceptance

The supplied PA5 and U2 archives were hash-checked before extraction. U2 is the browser entry/source authority; PA5 supplies the corresponding core support modules and synthetic tests. Copied files remain byte-identical, as enumerated by `SOURCE-PROVENANCE.json`. The only new code is the public test runner, assembly guard, and public-package smoke tests. Runtime rules, save identities, and the current-state trust contract are not rewritten for publication.

Historical candidate campaign/review results are not counted as newly executed public tests. In particular, the original U2 69-test suite is not claimed to run from this asset-free checkout.

## Deliberate exclusions

- All serialized legacy profile fixtures, historical complete campaign ledgers, real or generated retained save files, original raw logs, reports containing internal paths, and archive files.
- Two PA5 tests (11 cases) directly consuming a serialized all-unlocks legacy fixture. Three narrower public checks generate a new zero-entitlement original-engine run in memory and retire it before combat. They cover current/strict equality, lower-trust cache separation, and exact-parent/lost-ack behavior, not all original PA5 boundaries. This public subset is not the private 710-case acceptance suite.
- `ultimate-actions/runtime.test.js`, which consumes historical full-run fixtures. Its mechanism coverage is not substituted for a whole campaign; standalone ultimate/journal mechanism tests remain.
- The old PR-head comparison regression, which depends on a separate historical source-evidence snapshot.
- U2 media-dependent UI/audio/route test suites. Only its standalone synthetic boot-loader tests are copied. Runtime and UI source remain available for review.
- Original build/publishing/fixture-generation scripts and previous package manifests, which reference excluded working inputs or evidence.
- Original/generated media, fonts, sound files, and art/portrait/card registries without separately verified publication rights. Their 99 path/size/hash requirements are listed, but the bytes are absent.

## Remaining gates

A clean clone runs code tests, but cannot assemble a full playable UI until all exact, separately authorized inputs are supplied. No remote asset fallback is implemented. Local assembly itself has only been tested with missing inputs and synthetic tiny inputs in this public preparation; full-asset native browser, mobile, accessibility, performance, rendering, and listening verification remain separate.

CURRENT resume validates the current envelope but does not establish the same full-history provenance as strict import/recovery. Token issuance and purchase stay disabled. Trial effect/economy numbers and any synthetic fixture success are not final balance acceptance.

## Repository and deployment scope

Only a new review directory and a root README link are proposed. The root v0.8.2 source is not replaced. No workflow, hosting, DNS, access, merge, or release configuration is added. Readable repository contents showed no automatic deployment setup; hidden external integrations were not verified. A `[skip ci]` commit marker is not a guarantee against external deployment hooks.
