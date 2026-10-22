# Tiny Army player source candidate

Code-only development snapshot, isolated from the existing root application. This is not a release, hosted game, or approval to merge or deploy.

## Included

- Player HTML/CSS, game and presentation JavaScript, runtime/profile modules, and dedicated storage-worker code.
- The runtime dependency closure, verified classic-script boot manifest, and source-only SHA-256 manifest.
- Original procedural Canvas/SVG drawing code already within the project code boundary.

## Excluded

No image/audio/font asset files, asset license bundles, user profiles, saved games, serialized private QA fixtures, evidence, private reports, source archives, internal working paths, or credentials are included. The separate legacy application is excluded. References to omitted media remain unchanged in the source. A clean checkout is therefore not a full-asset, self-contained playable release.

## Validation boundary

This snapshot includes the current prisoner-event reward validation correction. Focused account/storage validation was completed before snapshot publication, but full-campaign and cold event replay work was still running at snapshot time. No full-campaign completion, native-browser acceptance, visual/asset parity, audio listening acceptance, mobile performance, or production readiness is claimed here.

Any later code-only browser smoke workflow must be read-only with respect to this repository, use fresh synthetic browser storage, omit deployment and secrets, and report only the behavior actually checked.

## Licensing

No new software or asset license is granted by this snapshot. Existing notices in source files are preserved. Third-party media and fonts and their associated license bundles are not distributed here. Public visibility is not an open-source license.
