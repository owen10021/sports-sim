# Package D implementation progress

Plan: `Sport_Sim_Package_D_Implementation_Plan_2026-10-17.md`. Authorization: `77be85e`. The approved plan and design basis remain authoritative.

## Inherited checkpoint

- Task 1: `83fdded`, world model 4.
- Task 2: `2269e2b`, rules and seed substrate. Previous implementer reported full CI green with 836 tests; this session independently reran the baseline tests: 68 files, 836 passed.
- Task 2 interpretations preserved from the handoff: `packageDWorldSeed.ts` is an additional focused module matching C's seed pattern; teaching profiles start empty because the seed has no coaches; profiles are not mandatory for every player, so Task 6 must specify missing-profile behavior.
- Task 2 test-order limitation: the parser preceded its tests; the previous implementer demonstrated smuggled-field rejection by disabling it, observing failure and restoring it. This is not recorded as a strict test-first cycle.

## Task 3: development truth and readiness boundary

Base: `2269e2b`.

- Existing profile, readiness and event types already satisfy the Task 3 state interfaces because Tasks 1/2 introduced them. Preserved them and added regression coverage rather than rewriting working substrate to manufacture a RED.
- Added private pure queries `developmentProfileFor` and `readinessFor`; absence returns `undefined`, with no inferred capability, potential or readiness default.
- Added `CapabilityDelta { playerId, capabilityKey, deltaBp }` and pure `applyCapabilityDeltas`. Changes only existing dimensions on existing players and preserves other roster state. Invalid input never mutates the source.
- Interpretation: deltas must be safe integers; duplicate player/dimension updates are rejected instead of sequentially accumulated. This avoids order-dependent intermediate bounds. Later resolution must submit one already-bounded delta per dimension. If later consumers need aggregation, combine their causal inputs before this boundary.
- New behavior was tested first: 14 failing tests and 2 already-passing state regressions before implementation, then 16/16 targeted tests passed.
- Broader verification: full `npm run ci` passed (exit 0): 70 files, 852 tests, typecheck, lint, formatting, independent A/B/C golden checks and iOS export. Log: `evidence/tmp/package-d/task3-ci.log`.

No command routing or Package E behavior was added.

## Task 4: scarce development opportunity

Base: `20a8daf`.

- Added explicit, privileged `OpenOpportunityWindow` and proposal-gated `CommitOpportunityAllocationProposal`. Pools come exclusively from the active D ruleset; roster count cannot create capacity.
- Added the `development` B plan kind and a read-only active-development/succession-plan query. Intent grants no workload execute authority.
- Opened only `workload_usage`, `medical_clearance` and `scheme` through the existing proposal and authorized-domain adapter. C categories remain unchanged; game-day activation and staff hiring remain reserved.
- Allocation lists and their reference lists are canonical before proposal hashing/approval. Equivalent allocation input order gives the same entire authoritative world, not merely the same balances.
- Validation includes conserved capacity, positive safe-integer units, membership, organization/window identity, date bounds, teachers, linked plans, duplicate rows and resolved windows. D window/allocation IDs participate in global collision avoidance.
- Interpretation: `opportunityProblems(world, window, allocations)` takes explicit roster/people/plans context; the plan's two-argument shorthand cannot validate those cross-references on its own.
- Interpretation: a window receives one atomic, nonempty allocation set. Opening a second overlapping organization window is rejected even under a different phase label, preventing duplicate capacity. Adjacent windows are allowed. No recurring windows are invented.
- Synthetic test coaches/authority/teaching profiles are added in a resealed genesis variant in `test/support/packageDHarness.ts`; the frozen D seed and accepted A/B/C fixtures are untouched.
- Debugging found that forwarding a caller-supplied mandate usage declaration could understate actual allocated units. Two regression tests failed (understated workload accepted; valid delegation without manual declaration rejected). The router now derives total `opportunity_units` from real terms and validates every actual scope against the mandate before the shared atomic commit. Both regressions pass.
- Targeted tests: 35/35 passed after RED runs for the new commands/helpers/categories and mandate regressions.
- Broader verification: full `npm run ci` passed (exit 0), 73 files and 869 tests, typecheck, lint, format, independent A/B/C goldens and iOS export. Log: `evidence/tmp/package-d/task4-ci.log`.

## Task 5: role learning and finite teaching

Base: `dd99510`.

- Added pure `teachingProblems`, `resolveRoleLearning` and `projectTransferFamiliarity`; exported the new focused module through the existing index (an additional routine export beyond the task's file list).
- Existing responsibility-level knowledge and teaching types already satisfy the task; no redundant state fields were added.
- Opportunity validation now composes teaching bandwidth, organization-role and expertise legality. Each teacher's budget is shared across all resources and players in the same window. A role scope must match the player's current role or an explicitly held role tag.
- Learning output is an ephemeral per-responsibility delta, not an aggregate scheme score. Only named installation/development lessons with relevant teaching produce learning. Shared units are divided among named responsibilities; multiple teachers contribute weighted expertise rather than stacked bonuses.
- Interpretation: the transfer helper is a read-only projection for one person's knowledge. Exact knowledge is retained; analogous transfer uses half of the strongest matching family source, with no stacking. This is a synthetic modeling coefficient, not an NFL empirical claim. Applying any transfer remains a later authorized checkpoint concern; projecting it alone changes nothing.
- Formula tests use literal, hand-calculated expectations and cover partial knowledge, zero change, unrelated expertise, fixed-budget staff splitting, shared-responsibility cost and person-owned continuity.
- Staff departure is exercised with the existing production role-ending and calendar commands: capability/learned knowledge persist, future teaching legality changes.
- RED: all 9 new tests failed for missing helpers/teaching validation after correcting a test payload to the existing `episodeId/lastDay` command interface. GREEN: 9/9 new tests and 13 opportunity regressions passed.
- Broader verification: full `npm run ci` passed (exit 0), 75 files and 878 tests, typecheck, lint, formatting, A/B/C goldens and iOS export. Log: `evidence/tmp/package-d/task5-ci.log`.
