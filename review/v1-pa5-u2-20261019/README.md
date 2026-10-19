# v1.0 source review: PA5 core + U2 official-UI integration

This is a code-review package, not a release or a self-contained playable build. It combines the frozen PA5 current-state/profile implementation and the reviewed U2 UI connection without changing their gameplay or save identities. U3 is not included. The repository's root v0.8.2 source remains unchanged.

## Included

- Five-chapter variable routes, eight events, paid individual awakening preparation, independent trial ultimate actions, interest-relic settlement, training access, family-weighted relic offers and battle-statistics source.
- Current-state loading and explicit full replay validation, exact-parent persistence, pending transaction recovery and retained legacy profile interfaces.
- U2 official-UI route, formation, render-projection, loading, profile and audio connection source. The underlying v6 audio implementation is unchanged.
- Synthetic mechanism tests and generated-in-test starter checks. Profile smoke checks generate a new zero-entitlement original-engine instance in memory; no serialized profile fixture is included.
- A strict, local-only asset injection check and build script.

No user saves, generated full-campaign ledgers, internal work reports, raw logs, ZIPs, screenshots, private filesystem paths, credentials, image/font/audio files, or unverified original art/portrait registries are included. `assets-required.json` lists omitted inputs by relative name/hash. No build downloads them.

## Reproduce the public subset

Requires Node.js 22+ and Python 3.10+. No dependency installation or network access is needed.

```sh
python3 tools/verify-manifest.py
node tools/run-tests.mjs
python3 assemble.py --check
```

The first command runs the published synthetic/core subset. The second intentionally exits 2 on a clean checkout because separately supplied assets are absent. It does not silently substitute different artwork or claim a complete build.

To assemble locally, obtain rights-cleared inputs separately, place their exact relative paths under `assets-local/`, and run `python3 assemble.py --check` followed by `python3 assemble.py`. Trusted executable registries are required as well as media. The build writes only ignored `dist/`, refuses to overwrite an existing output, and performs no deployment. Browser execution, visual parity, mobile interaction and listening remain separate verification stages.

## Trust and scope

- “Current state checked” is intentionally weaker than “full replay verified”. It does not prove that historical gold or combat was legitimately earned. Explicit audit/import/recovery retains strict validation boundaries.
- New permanent-token issuance/purchases remain disabled. Existing profile balances and entitlements are preserved through explicit APIs, not silently migrated from browser storage.
- Ultimate timing/effect coefficients, the 60G per-unit preparation price, interest coefficients and family-key gate remain trial rules, not final balance approval.
- The 120-relic catalog, new chapter rarity probabilities, additional class branches and future encounter patterns remain design work only. They are not implemented by this PR.
- Public source visibility does not grant an open-source or asset license. No new license is chosen here.

See `docs/verification-scope.md`, `docs/design-status.md`, `SOURCE-PROVENANCE.json` and `PUBLIC-MANIFEST.json` for exact source bindings and the public transition. No CI/deployment workflow is added. A branch/PR and a commit's `[skip ci]` text are not guarantees against externally configured hooks.
