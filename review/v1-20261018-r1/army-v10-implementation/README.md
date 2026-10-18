# Tiny Army 1.0: isolated campaign implementation trial

Status: a UI-independent, testable campaign skeleton. **Not a playable five-chapter release.** No production game files, browser storage, profiles, old saves, deployment or git remotes are touched. Node 18+; zero dependencies. This module uses Node SHA-256 and is not yet a browser bundle.

## Run

From this directory:

- `npm test`: campaign transitions, save replay, phase boundaries, negatives and one explicitly assumed-win 35-battle traversal.
- `npm run verify`: 1,000 seeds × five graphs, exhaustive legal-route bounds by DAG dynamic programming and graph path-prefix validation.

Both commands operate only in this isolated module. `test-results.txt` and `seed-results.json` contain the recorded run. Graph path-prefix coverage is not 191,229 production save imports. Full campaign save round trips are tested at each transition of the sample traversal and additional boundary scenarios.

## Implemented

- Deterministic normalized seed, immutable version IDs, five persisted graphs and SHA-256 hashes. Per-chapter width 2–3 across six battle layers plus a single disclosed boss, exactly seven battles along every legal route.
- Near-lane seeded edges, no orphan/dead-end/cycle, no skipped battle layer, always a no-elite route. At most two optional service detours after battle rows 2 and 4. Direct next-battle edges are retained; no forced merge/rest room.
- Real selectable paths, prepare/battle/reward/service/map transitions and chapter changes. Chapter 3 collection metadata, chapter 3 boss reserved target slot, chapter 4 entry awakening opportunity, chapter 5 use-build stage.
- Explicitly supplied battle result receipts. The module NEVER runs combat or fabricates results. Winning applies trial XP once. Defeat grants no XP/reward. All reward windows block onward progression until explicitly skipped (claim adapter not implemented). Battle 35 has no unusable growth window and stops at a settlement boundary, without awarding profile currency.
- Separate trial config: XP 3/1/1/1/1/2/1 and deployment-cap thresholds. An integration-values export records the P0 economy/awakening proposal without applying it.
- Copy-on-write transitions and deterministic event replay validate saved phase, visited/completed prefixes, receipt and XP ledgers, pending opportunities and graphs. Exact schema rejects unknown fields and mixed versions. Import rejects unsafe keys and oversized JSON. Unsupported 0.9 saves are rejected without modification; no migration adapter yet.
- Battle checkpoints preserve node and battle seed. Import preserves `battle`; an explicit `retryBattleCheckpoint` action moves to prepare, allowing the host to display its retry notice. No mid-battle HP/mana restoration is claimed.

## Deliberately not implemented

- Combat engine/encounter definitions, roster, skills, fatigue, injury, currency, inventory, reward candidate generation, purchases, research, forging, actual recovery or awakening grants.
- Service definitions identify meaningful optional services, but this skeleton only supports leaving without an effect. Do not ship these rooms as working services until their effect/price/eligibility adapters exist. Direct bypass already works.
- Reward selection currently supports explicit pass only. Reserved growth/target slots are opportunity metadata, NOT automatic items or advancement. Awakening supports explicit skip only. A caller cannot manufacture a claim by sending an unsupported action.
- Final settlement/profile updates; actual 0.9 migration/continuation; persistence transaction/revision conflicts; UI; deployment.
- Save anti-cheat/authenticated receipts. Replay detects inconsistency, not a fabricated but internally consistent save. A local editable action log is not cryptographic proof of a win.

## API outline

`createCampaign(seed, runId)` pre-generates and stores all five graphs. `availableNodes(campaign)` exposes only currently reachable choices. `transition(campaign, action)` returns a new validated state or throws without changing the input. `exportCampaign`/`importCampaign` round-trip only this exact isolated schema. `validateGraph` proves structural bounds, and `validatePathPrefix` checks path edges. `summary` describes progression, not a combat or balancing result.

The host chooses one exposed node, starts its pending battle, and supplies a result receipt with matching battleId. Tests use receipt IDs prefixed `ASSUMED-WIN`; those are fixture assumptions, not player wins. No demo is wired into the production game.

Trial storage key: `tiny-army-v10-campaign-skeleton-trial`. This constant is a suggested separate key, not a storage write. Production identifiers from the save-transition design are intentionally not registered.

See `INTEGRATION-CONTRACTS.md` for the next steps and the planning `IMPLEMENTATION-BASELINE.md` for trial values. Map and campaign versions differ from the Python design validator, so identical seeds need not yield identical JS/Python maps. Changing any generated data requires a generator-version change and new golden fixture.
