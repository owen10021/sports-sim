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

## Task 6: causal capability/checkpoint resolution

Base: `979d42f`.

- Added a pure, fixed-point capability adaptation function using dimension headroom, the ruleset's capability-family maturation/decline curves, per-dimension malleability, meaningful work, dimension-relevant teaching, conditioning/fatigue, elapsed time and deterministic uncertainty. It permits improvement, zero and decline; no salary/draft/stat/belief input is read.
- Synthetic model interpretation: useful adaptation volume saturates at half the ruleset maximum; additional load creates strain. This is synthetic calibration, not a validated NFL workload threshold. Dimension-keyed teaching can affect that dimension; other responsibility teaching affects learned knowledge rather than granting a global coach buff.
- Added privileged `ResolveDevelopmentCheckpoint`: validate first, then resolve sorted players/capabilities/responsibilities, replace roster capability values through Task 3's boundary, update readiness/knowledge, close the window and append checkpoint/development history atomically.
- RNG contract: one uint32 per ruled capability in player/key order; role learning, readiness and qualitative claims consume none. Rejected/early/unauthorized/repeated requests do not change authoritative RNG or state.
- Private capability/readiness events retain causes. Supervised responsibility work can append qualitative B claims attributed to the actual teacher and one shared practice-event family. Raw deltas, responsiveness and RNG never enter those claims; no belief is created automatically.
- Missing-profile ruling: no responsiveness is invented or persisted. Missing profile/dimension response (or missing readiness) yields no positive adaptive capability gain; known family-specific aging and workload consequences still apply. Missing profile traits yield no learned-familiarity gain. Allocation legality does not depend on hidden player traits.
- Learning context ruling: an unambiguous existing responsibility retains its scheme; new/ambiguous targets can be named by linked B plan objective targets `{ playerId, schemeKey, responsibilityKey, transferFamilyKey }`. Unqualified labels grant no installed knowledge. Multiple target schemes share the same finite lesson units.
- Anti-farming correction: the existing ruleset `checkpointCadenceDays` now owns window duration. A one-day window formerly received a full budget; a failing regression demonstrated that exploit. Windows now require exactly the declared cadence. The synthetic harness uses a seven-day window instead of fourteen days; fourteen-day advancement remains a valid test of a late manual checkpoint.
- The initial full CI run failed the added multi-scheme conservation regression (396 total familiarity versus 198 for one scheme). The resolver now divides the same lesson budget among its target schemes; the regression passes. A remote edit that did not match its formatted source was detected by that test and reapplied to the actual source before retesting.
- Verification so far: 10 new tests pass plus 7 opportunity regressions, including exact save/reload outcome and chain equality, aging-family divergence, zero growth, excess workload, short-window farming and shared scheme budgets. First failed CI preserved as `evidence/tmp/package-d/task6-ci-failed-scheme-budget.log`. Fresh full CI pending.

### Task 6 review corrections (verification reopened)

A fresh-context review found four important defects; the earlier green CI was not sufficient for acceptance. No Task 6 commit/push was made on that evidence.

- Exact B plan revision pins are now included in canonical workload terms before approval and persisted in allocations. Later or same-day revisions cannot invalidate or redirect already committed work. Intent changed between approval and execution rejects atomically. Three regressions were observed failing, then passing.
- Combined per-player resource load is checked at allocation commit, before its one-shot set becomes authoritative. The over-ceiling regression was observed accepted before the fix and rejected afterward.
- Ruling: biological time belongs to people, not organization windows. Added a focused private `developmentPassive.ts` helper. Passive daily checkpoint records have `kind: passive` and null organization/window references; they share existing checkpoint/event ID accounting and change no empty legacy-domain shape. Every player, including free agents and missing-profile players, receives family-specific passive aging. Recovery only uses recorded readiness and response traits. Passive time creates no training opportunity, role learning, observation claims or RNG draws. Daily integrated family decline conserves fractional aging across daily/coarse calls. Cost if wrong: synthetic calibration/history volume may need adjustment under later long-run/mobile evidence.
- Ruling: a manual checkpoint must resolve on its logical due date; early/overdue work rejects before draws instead of rewinding readiness or applying stale load. Task 7's chronological day hook will execute committed work on that date. This supersedes the earlier late-manual-checkpoint interpretation. Cost if wrong: integrations must use the calendar hook or issue manual work exactly when due.
- Actual lesson exposure is prorated to days after commitment when player roster access and the named teacher's organizational service overlap. Reserved capacity is not refunded. Staff/membership changes do not retroactively corrupt approved intent; unavailable work yields less/zero exposure and cannot create a completed-supervision claim. The late-commit/departure regression failed before this correction and now passes.
- Ruling: personal teaching bandwidth reserves the full declared lesson units across every intersecting organization window, including already resolved historical work; adjacent windows release the reservation. Duplicate record IDs are counted once. This deliberately conservative reservation can reject partly overlapping commitments that a later explicit daily scheduling model might accommodate. It prevents multi-organization attention multiplication without inventing a scheduling feature.
- The review set aside later-task medical, role-transition, privacy/view, audit, scenario/replay, Hermes and physical-device obligations. These remain required in Tasks 8-15; they are not claimed verified here. Synthetic coefficients remain synthetic, not empirical NFL findings.
- Review regression evidence: plan/load/time/exposure/overdue RED logs retained under `evidence/tmp/package-d`; latest focused run passes 31 tests across six files. Fresh full CI is required after these fixes.

- Task 6 acceptance verification after the review corrections: full `npm run ci` exit 0, 79 files / 898 tests, typecheck, lint, formatting, A/B/C golden matches and iOS export. Log: `evidence/tmp/package-d/task6-review-ci.log`. No deferred review minors. Automatic daily integration remains Task 7.

## Task 7: automatic logical-time development

Base: `370e958`.

- Added pure `advanceDevelopmentForDay` and called it inside the existing day loop, immediately after each legacy day roll. Due committed windows resolve chronologically, with organization/window IDs breaking same-day ties. No windows or allocations/defaults are invented.
- D rules activate daily person-owned passive aging/recovery even without practice; work still requires an explicit authoritative allocation. Uncommitted windows remain open/undecided.
- Rulesets without D remain an exact no-op at the hook. Tests pin A/B/C legacy day-roll vectors, unchanged D/medical/roster domains and one existing calendar event; full accepted goldens are also required.
- Four new behavior regressions failed before implementation (unattended resolution, coarse/fine committed checkpoint, no-window passive time and RNG interleaving). They now pass, including identical D-domain projection/RNG for one 14-day and fourteen 1-day commands.
- A production-command two-organization case opens windows in the opposite creation order and verifies same-day checkpoint order. Its resealed synthetic genesis adds only the second owner's ordinary workload rights; no authorization bypass is used.
- Test adaptation: manual checkpoint boundary tests use an explicit resumed due-date fixture because normal `AdvanceDays` now resolves the window itself. The staff-departure continuity regression compares two careers with equal elapsed passive time so ordinary aging cannot be mistaken for a coach departure effect.
- Focused verification: 30/30 tests across calendar, RNG, manual checkpoint and teaching-bandwidth files. Full CI pending.

- Task 7 acceptance verification: full `npm run ci` exit 0, 80 files / 904 tests, typecheck, lint, formatting, all A/B/C goldens and iOS export. Log: `evidence/tmp/package-d/task7-ci.log`.
