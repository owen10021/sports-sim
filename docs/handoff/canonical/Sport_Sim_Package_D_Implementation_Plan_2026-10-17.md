# Sport Sim Package D - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** APPROVED FOR IMPLEMENTATION - amended after repository review on 2026-10-17

**Goal:** Add causal player development, scarce opportunity, practice intent, coaching/teaching context, role/scheme learning, workload/readiness, and medical/recovery state without XP, fixed potential, hidden-development oracles, or a second player-truth ledger.

**Architecture:** Package D extends the accepted Package C `FootballWorld` to world model 4 with two new authoritative domains: `development` and `medical`. Existing `roster.players[].capabilities` remains the only football-capability truth; D evolves those values in place through deterministic checkpoint resolution, while organizational observations/beliefs continue to use Package B's information substrate and all consequential actions continue through Package B authority/proposal/receipt machinery.

**Tech Stack:** TypeScript 7, Vitest 5, existing pure `packages/sim-core`, Expo 57/Hermes diagnostics, existing persistence/replay/golden harnesses.

**Spec:** `docs/handoff/canonical/Sport_Sim_Package_D_Design_Basis_2026-10-17.md`

## Global constraints

- Preserve accepted Package A/B/C evidence and tags; never rewrite an old golden to make D pass. A world-model bump creates new versioned current-model golden files while accepted prior versions remain immutable historical evidence.
- One authoritative `FootballWorld`; only `WorldKernel` commits authoritative reality.
- `packages/sim-core` remains pure TypeScript: no React/React Native/Expo/SQLite/filesystem/network/wall-clock imports.
- `roster.players[].capabilities` remains the only authoritative football-capability ledger. D may update it; D may not copy it into another rating store.
- No universal OVR, fixed-potential field, ceiling grade, XP, skill points, development trait tier, coach multiplier, chemistry bar, or ratings aura.
- Human and CPU organizations use identical legality, development, opportunity, workload, and medical rules.
- Ordinary decision policies never read latent capability, latent developmental responsiveness, hidden healing/prognosis, or future trajectory.
- Package B claims/beliefs remain the knowledge substrate; D records links/observations rather than inventing a second knowledge system.
- Package B authority categories `workload_usage`, `medical_clearance`, `scheme`, `game_day_activation`, `roster`, and plans remain authoritative governance boundaries.
- Rejected/stale/unauthorized commands mutate nothing and consume no RNG.
- Equivalent records are processed in canonical order; UI/insertion order cannot change outcomes.
- Save/reload before an unchanged checkpoint cannot reroll development or recovery.
- Practice is intent + delegated execution, not a user-operated calendar/minigame.
- More playing/practice time is not a universal growth buff; excess or redundant workload can be neutral/counterproductive.
- Position/role labels create zero capability.
- Medical diagnosis, structural healing, functional readiness, conditioning, reinjury risk, performance limitation, player preference, recommendation, clearance, and actual usage remain distinguishable.
- Synthetic Package D calibration is labeled synthetic and must not be described as validated NFL empirical truth.
- Package D stops before play-level football resolution, game-generated football injuries, GameCast/Sunday Proof, polished Command Center UX, or century-scale release calibration.

## Repository-review amendment (approved 2026-10-17)

The post-plan repository review identified three implementation-contract corrections and four clarifications. They are incorporated below and are implementation authority:

1. **World-model-4 golden versioning:** accepted golden files remain untouched. Task 1 creates `package-a-golden-v4.json`, `package-b-golden-v3.json`, and `package-c-golden-v2.json`; event-chain heads, event counts, revisions, RNG state/draw counts, and non-fingerprint scenario outputs must remain equal to their accepted predecessors. Current-model world fingerprints (including per-step fingerprints) are expected to change because the authoritative world shape changes.
2. **Legacy Package C persistence:** model-3 snapshots become a supported legacy input to persistence verification/loading, parallel to existing legacy A/B handling.
3. **Package D authority categories:** `workload_usage`, `medical_clearance`, and `scheme` are opened additively for proposals/domain commits in Task 4; no A/B/C category semantics are changed. Opportunity-allocation proposals use the organization and/or development plan as subjects; allocation details live in proposal terms rather than attempting to make an opportunity window a new `SubjectRef` kind.
4. **AdvanceDays equivalence:** Task 7 compares a D-domain projection rather than whole-world fingerprints across one 14-day command versus fourteen 1-day commands, because revision/event counters legitimately differ. D RNG draws are interleaved inside the existing per-day loop immediately after that day's `dayRoll`.
5. **Record IDs:** every task that introduces new authoritative D records updates `commandSupport.ts` record-ID collision accounting.
6. **Hermes scenario construction:** Package D scenario-driver loops that create closure-capturing steps use `forEach`/helpers, preserving the Package C Hermes fix pattern.
7. **Opportunity-window lifecycle:** D does not invent recurring automatic window creation. Tests/scenarios explicitly open windows through the system command; `AdvanceDays` only resolves due work whose allocations/defaults already exist authoritatively.

## Review focus

1. **Legacy-world preservation:** a Package C world model 3 snapshot must migrate to model 4 by adding only empty D state; its historical Package C fingerprint remains independently verifiable. Task 1 pins this.
2. **Latent-truth leakage:** staff/CPU development decisions must be unchanged when only hidden capability/response/healing values change but legitimate evidence does not. Tasks 12 and 13 pin this.
3. **Order/reroll exploits:** permutation of equivalent allocation inputs and save/reload before the same checkpoint must yield identical state, event chain, and RNG. Tasks 4, 6, 7, and 13 pin this.
4. **Medical state collapse:** structural healing, functional readiness, conditioning, risk, limitation, recommendation, clearance, and usage must be able to disagree in one scenario. Tasks 8, 9, and 14 pin this.
5. **Opportunity-free prospect hoarding:** adding prospects without increasing scarce rep/teaching capacity must crowd existing opportunity rather than granting free development. Tasks 4, 11, and 13 pin this.

---

## File structure locked for Package D

New focused modules:

- `packages/sim-core/src/development.ts` - authoritative D development state types and pure queries.
- `packages/sim-core/src/developmentRules.ts` - Package D rules/calibration parser and fail-closed access.
- `packages/sim-core/src/packageDSeedParse.ts` - D seed substrate parser/cross-reference validation.
- `packages/sim-core/src/opportunity.ts` - finite opportunity windows, allocations, conservation, derived summaries.
- `packages/sim-core/src/developmentIntent.ts` - reads active Package B development plans; contains no authoritative state.
- `packages/sim-core/src/roleLearning.ts` - role/scheme responsibility knowledge and transfer rules.
- `packages/sim-core/src/developmentResolution.ts` - pure checkpoint adaptation/aging/readiness resolution.
- `packages/sim-core/src/developmentCalendar.ts` - automatic logical-time checkpoint integration.
- `packages/sim-core/src/developmentCommands.ts` - opportunity/checkpoint/role-transition commands.
- `packages/sim-core/src/medical.ts` - authoritative medical state and derived functional-readiness queries.
- `packages/sim-core/src/medicalCommands.ts` - episode/recheck/recommendation/preference/clearance commands and E-facing episode helper.
- `packages/sim-core/src/developmentImpact.ts` - knowledge-safe opportunity-crowding projections for later acquisition/UX composition.
- `packages/sim-core/src/developmentView.ts` - organization-scoped development decision view; no latent truth.
- `packages/sim-core/src/developmentAudit.ts` - read-only D invariant/ecology findings.
- `packages/sim-core/src/packageDScenario.ts` / `packageDScenarioRun.ts` / `packageDGoldenExpected.ts` - integrated acceptance scenario.

Do not fold these concerns into the already-large Package C market/free-agency/trade files unless a narrow existing helper must be reused.

---

### Task 1: Freeze Accepted Package C and Version the World Model for D

**Files:**
- Modify: `packages/sim-core/src/worldModel.ts`
- Modify: `packages/sim-core/src/world.ts`
- Create: `packages/sim-core/src/development.ts`
- Create: `packages/sim-core/src/medical.ts`
- Modify: `packages/sim-core/src/index.ts`
- Modify: `packages/sim-core/src/persistence.ts`
- Modify: `packages/sim-core/test/persistenceContract.test.ts`
- Create: `fixtures/legacy/package-c-world-v3-snapshot.json`
- Modify: `fixtures/legacy/README.md`
- Modify: `fixtures/legacy/SHA256SUMS.txt`
- Create: `packages/sim-core/test/worldModelV4.test.ts`
- Create: `packages/sim-core/test/packageCWorldMigration.test.ts`
- Modify: `packages/sim-core/test/legacyFixtureIntegrity.test.ts`
- Create: `fixtures/golden/package-a-golden-v4.json`
- Create: `fixtures/golden/package-b-golden-v3.json`
- Create: `fixtures/golden/package-c-golden-v2.json`
- Modify: `packages/sim-core/src/goldenExpected.ts`
- Modify: `packages/sim-core/src/packageBGoldenExpected.ts`
- Modify: `packages/sim-core/src/packageCGoldenExpected.ts`
- Modify: `packages/headless/src/cli.ts` as needed so write/check commands target the new current-model files while retaining older files
- Verify/update: `scripts/hermes/entry.ts`, `scripts/hermes/entryPackageB.ts`, `scripts/hermes/entryPackageC.ts`
- Verify/update: `apps/mobile/src/diagnostics/goldenDiagnostics.ts`, `packageBJudgement.ts`, `packageCJudgement.ts`

**Interfaces:**
- `WORLD_MODEL_VERSION = 4`.
- `DevelopmentState` initially exposes arrays for `playerProfiles`, `teachingProfiles`, `roleKnowledge`, `readiness`, `opportunityWindows`, `opportunityAllocations`, `checkpoints`, and `events`.
- `MedicalState` initially exposes arrays for `episodes`, `progress`, `reports`, `preferences`, `recommendations`, and `clearances`.
- `FootballWorld` gains `development: DevelopmentState` and `medical: MedicalState`.
- Add `LegacyPackageCWorld` = exact accepted world-model-3 shape.
- Add `migrateLegacyPackageCWorld(world: LegacyPackageCWorld): FootballWorld` and `fingerprintLegacyPackageCWorld(world)`.
- `StoredWorld`, `requireCurrentWorld`, and persistence snapshot verification/loading recognize legacy C explicitly; A -> B -> C -> D migration stays explicit and future versions fail closed.
- Accepted golden versions remain immutable; new current-model versions become the active expected constants/Node/Hermes/mobile judgement targets.

- [ ] **Step 1: Capture accepted C fixture before changing the model**

Generate `fixtures/legacy/package-c-world-v3-snapshot.json` from accepted tag `package-c-acceptance-20261017`; record SHA-256 in `fixtures/legacy/SHA256SUMS.txt`. Test its accepted fingerprint equals `bf2e44d0c2609b59d506f90560e4248a5fe97664bb316b968f4f96fe34e055d4`.

- [ ] **Step 2: Write RED migration tests**

Tests must assert model 3 -> 4 adds exactly empty `development`/`medical`, preserves world id/date/revision/RNG/next ids/entities/all B/C domain canonical bytes, creates no event, consumes no RNG, and rejects incomplete/future shapes.

- [ ] **Step 3: Implement model 4 skeleton, legacy-C persistence support, and explicit migration**

Create empty state factories; update domain-key validation, stored-world handling, persistence verification, and fingerprints. Do not change existing Package A/B/C historical fingerprint functions. A stored model-3 snapshot must verify under its own legacy-C fingerprint and load/migrate to model 4 without history mutation.

- [ ] **Step 4: Create new current-model A/B/C golden versions**

Keep every accepted golden file unchanged. Generate `package-a-golden-v4.json`, `package-b-golden-v3.json`, and `package-c-golden-v2.json` under world model 4. Assert each new file preserves its predecessor's event-chain head, revision, event count, RNG state/draw count, record IDs/domain outputs, and command outcomes; only current-model world fingerprints/per-step fingerprints may change. Update expected-constant modules and Node/Hermes/mobile judgement paths to the new current-model versions.

- [ ] **Step 5: Run targeted and legacy gates**

Run: `npm test -- packages/sim-core/test/worldModelV4.test.ts packages/sim-core/test/packageCWorldMigration.test.ts packages/sim-core/test/legacyFixtureIntegrity.test.ts packages/sim-core/test/persistenceContract.test.ts` plus all A/B/C golden checks.

Expected: PASS; accepted historical files/hashes remain untouched and new current-model goldens preserve all non-fingerprint accepted semantics.

- [ ] **Step 6: Run full CI and commit**

Run: `npm run ci`

Commit: `feat(core): version world model for development ecology`

---

### Task 2: Package D Rules, Synthetic Calibration, and Seed Substrate

**Files:**
- Create: `packages/sim-core/src/developmentRules.ts`
- Create: `packages/sim-core/src/packageDSeedParse.ts`
- Modify: `packages/sim-core/src/ruleset.ts`
- Modify: `packages/sim-core/src/seed.ts`
- Modify: `packages/sim-core/src/world.ts`
- Create: `fixtures/rulesets/synthetic-package-d-rules-v1.json`
- Create: `fixtures/seeds/synthetic-package-d-world-v1.json`
- Create: `packages/sim-core/test/developmentRules.test.ts`
- Create: `packages/sim-core/test/packageDSeed.test.ts`

**Interfaces:**

`LeagueRules.rules.development?: DevelopmentRulesV1` remains optional so old ruleset hashes stay unchanged. D commands call `requireDevelopmentRules` and fail closed when absent.

`DevelopmentRulesV1`:
- `modelVersion: 1`;
- `checkpointCadenceDays: number`;
- `opportunityPools: readonly { resourceKey: 'first_team_reps' | 'development_reps' | 'meeting_attention' | 'installation_work'; scopeKey: string; capacityUnits: number }[]`;
- `maxPlayerLoadUnitsPerCheckpoint: number`;
- `recoveryUnitsPerDay: number`;
- `roleLearningScaleBp: number`;
- `conditioningScaleBp: number`;
- `medicalRecoveryScaleBp: number`;
- `capabilityFamilies: readonly { familyKey: string; capabilityKeys: readonly string[]; maturationMidpointAgeDays: number; declineOnsetAgeDays: number; adaptationScaleBp: number; declineScaleBpPerYear: number }[]`.

`PackageDSubstrateSeed`:
- `playerProfiles[] { personId, capabilityResponses[] { capabilityKey, malleabilityBp }, processingBp, adaptabilityBp, recoveryBp, durabilityBp }`; no final ceiling/destination field.
- `teachingProfiles[]` with `personId`, finite `bandwidthUnits`, and `expertise[] { responsibilityKey, teachingBp }`; no universal coach multiplier.
- `roleKnowledge[]` with `playerId`, `schemeKey`, `responsibilityKey`, `transferFamilyKey`, `familiarityBp`.
- `readiness[]` with `playerId`, `conditioningBp`, `acuteFatigueBp`, `accumulatedLoadUnits`.
- optional initial `medicalEpisodes[]` for synthetic tests only.

All basis-point values are safe integers `0..10000`; parser rejects `overall`, `ovr`, `potential`, `ceiling`, `finalRating`, `developmentTier`, or equivalent forbidden summary fields anywhere in the D player profile.

- [ ] **Step 1: RED ruleset compatibility tests**

Old A/B/C rulesets re-seal byte-identically; D rules parse only exact supported keys; unsupported modelVersion/future fields fail closed.

- [ ] **Step 2: RED seed-boundary tests**

Reject unknown players/staff, capability-response keys not present on the referenced player, duplicate responsibility keys, out-of-range BPs, duplicate profile IDs, hidden-destiny fields, and teaching profiles for non-people.

- [ ] **Step 3: Implement parsers + synthetic fixtures**

Synthetic fixture provenance must explicitly say synthetic calibration/not empirically validated NFL development or medicine.

- [ ] **Step 4: Seed `development` / `medical` in `createWorld`**

The D seed extends/contains the Package C seed substrate so every D `capabilityResponses.capabilityKey` references a real seeded Package C player capability. Current D seed initializes D state; old seeds still initialize empty D state after migration.

- [ ] **Step 5: Verify and commit**

Run targeted tests, then `npm run ci`.

Commit: `feat(core): add development rules and seed substrate`

---

### Task 3: Development Truth, Readiness, and Capability Mutation Boundary

**Files:**
- Expand: `packages/sim-core/src/development.ts`
- Modify: `packages/sim-core/src/roster.ts`
- Create: `packages/sim-core/test/developmentState.test.ts`
- Create: `packages/sim-core/test/developmentTruthBoundary.test.ts`

**Interfaces:**

`PlayerDevelopmentProfile` stores private causal traits only; it contains no current capability copy and no final destination.

`PlayerReadinessRecord`:
- `playerId`, `conditioningBp`, `acuteFatigueBp`, `accumulatedLoadUnits`, `updatedAt`.

`DevelopmentEvent`:
- immutable append-only fact containing `id`, `playerId`, `checkpointId`, `occurredAt`, `kind`, affected capability/responsibility keys, before/after values where authoritative, and causal record IDs. Debug-only internals never become organization claims automatically.

Add pure `applyCapabilityDeltas(roster, deltas)`:
- updates only named existing `PlayerCapability.valueBp` entries;
- rejects any delta whose resulting value would fall outside `0..10000`; resolution formulas must bound their own proposed deltas before calling it;
- cannot create `overall`, `potential`, or arbitrary undeclared capability keys.

- [ ] **Step 1: RED no-second-ledger tests**

Assert `DevelopmentState` has no field that mirrors all player capabilities or stores a summary rating; changing D profiles alone does not change capability truth.

- [ ] **Step 2: RED capability-mutation tests**

Exact per-dimension updates, zero-change allowed, undeclared key rejected, source `PlayerRecord` identity/role/rights untouched.

- [ ] **Step 3: Implement pure state/query/mutation boundary**

No command routing yet.

- [ ] **Step 4: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): add development truth and readiness substrate`

---

### Task 4: Opportunity Windows, Scarce Allocations, and Development Intent

**Files:**
- Create: `packages/sim-core/src/opportunity.ts`
- Create: `packages/sim-core/src/developmentIntent.ts`
- Modify: `packages/sim-core/src/plans.ts`
- Create: `packages/sim-core/src/developmentCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/decisionCommands.ts`
- Modify: `packages/sim-core/src/transactionCommit.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Modify: `packages/sim-core/src/index.ts`
- Modify: `packages/sim-core/test/transactionCommit.test.ts`
- Create: `packages/sim-core/test/opportunity.test.ts`
- Create: `packages/sim-core/test/developmentIntent.test.ts`
- Create: `packages/sim-core/test/opportunityCommands.test.ts`

**Interfaces:**

Add `development` to `PLAN_KINDS`; a Package B plan remains the authoritative GM intent record.

`OpportunityWindow`:
- `id`, `organizationId`, `phaseKey`, `fromDate`, `toDate`, `pools[] { resourceKey, scopeKey, capacityUnits }`, `status: 'open' | 'resolved'`.

`OpportunityAllocation`:
- `id`, `windowId`, `organizationId`, `playerId`, `resourceKey`, `scopeKey`, `units`, `teacherPersonId | null`, `responsibilityKeys[]`, `basisPlanIds[]`, `sourceProposalId`, `committedAt`.

Package D opens exactly these additional proposal/domain-commit categories through a dedicated exported `PACKAGE_D_PROPOSAL_CATEGORIES`: `workload_usage`, `medical_clearance`, `scheme`. Existing Package C categories remain unchanged. `transactionCommit.test.ts` must prove the D categories are accepted while still rejecting categories outside B/C/D domain commits.

Opportunity-allocation proposals use `{ kind: 'entity', id: organizationId }` and/or an existing `{ kind: 'plan', id: developmentPlanId }` as proposal subjects. Do not add `opportunity_window` to `SubjectRef`; the canonical allocation list/window id belongs in proposal terms, avoiding the existing eight-subject limit.

Commands:
- `OpenOpportunityWindow` - `system|commissioner|test_harness` only; creates ruleset-owned finite pools.
- `CommitOpportunityAllocationProposal` - category `workload_usage`, through shared Package B authorized commit adapter; all allocations for one window commit atomically from one snapshot.

Pure `opportunityProblems(window, allocations)` rejects negative/zero units, over-capacity, wrong-org/player-not-rostered, duplicate exact allocation, out-of-window, missing teacher, and allocation after resolved.

- [ ] **Step 1: RED conservation/permutation tests**

Same allocation set in every input order produces identical canonical state; allocating units to one player reduces remaining capacity for others.

- [ ] **Step 2: RED authority test**

A GM development plan may exist without granting the GM `workload_usage` execute authority. Intent alone cannot commit reps.

- [ ] **Step 3: RED bench-stash test**

Adding more rostered prospects does not add pool capacity. Starter-quality allocations cannot be granted to everyone when pool capacity is fixed.

- [ ] **Step 4: Implement window/allocation commands via existing proposal gate**

No hidden capability/profile input is permitted in allocation validation. Update `commandSupport.ts` so every new authoritative D record ID introduced by this task participates in `takenRecordIds` and any shared `Changes` plumbing needed by the router.

- [ ] **Step 5: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): add scarce development opportunity`

---

### Task 5: Teaching Bandwidth, Role Knowledge, Scheme Learning, and Installation Debt

**Files:**
- Create: `packages/sim-core/src/roleLearning.ts`
- Modify: `packages/sim-core/src/opportunity.ts`
- Expand: `packages/sim-core/src/development.ts`
- Create: `packages/sim-core/test/roleLearning.test.ts`
- Create: `packages/sim-core/test/teachingBandwidth.test.ts`

**Interfaces:**

`RoleKnowledgeRecord` is person-owned learned knowledge keyed by `playerId + schemeKey + responsibilityKey`; it carries `transferFamilyKey`, `familiarityBp`, `lastMeaningfulRepAt`.

`TeachingProfile` is responsibility-specific: `expertise[] { responsibilityKey, teachingBp }` + finite `bandwidthUnits`; no global coach development score.

Pure functions:
- `teachingProblems(world, allocations)` - teacher bandwidth/expertise/roster-role legality.
- `resolveRoleLearning(input)` - produces role-knowledge deltas only from meaningful installation/development allocations and teaching context.
- `projectTransferFamiliarity(existingKnowledge, targetSchemeKey, targetResponsibilityKey, transferFamilyKey)` - transferable credit only; never creates capability.

Installation debt is represented as missing/low familiarity across actual responsibilities, not a stored generic chemistry score.

- [ ] **Step 1: RED partial-knowledge tests**

Player may know responsibility A well and B poorly in the same scheme; no aggregate scheme familiarity field is authoritative.

- [ ] **Step 2: RED staff-change tests**

Changing teacher/coordinator leaves existing player capability and learned knowledge intact; only future teaching conditions/new terminology differ.

- [ ] **Step 3: RED mentor/staff stacking tests**

Multiple teachers cannot apply more total teaching units than finite pool/bandwidth; unrelated expertise grants no benefit.

- [ ] **Step 4: Implement learning helpers**

Use integer/fixed-point math only; deterministic canonical ordering.

- [ ] **Step 5: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): add role and scheme learning`

---
### Task 6: Capability Adaptation, Maturation, Aging, Decline, and Practice Checkpoint Resolution

**Files:**
- Create: `packages/sim-core/src/developmentResolution.ts`
- Expand: `packages/sim-core/src/developmentCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/developmentResolution.test.ts`
- Create: `packages/sim-core/test/agingDevelopment.test.ts`
- Create: `packages/sim-core/test/developmentCheckpoint.test.ts`

**Interfaces:**

`DevelopmentCheckpointRecord`:
- `id`, `organizationId`, `windowId`, `fromDate`, `toDate`, `resolvedAt`, `allocationIds[]`, `rngDrawStart`, `rngDrawCount`, `eventIds[]`.

`ResolveDevelopmentCheckpoint`:
- system/commissioner/test-harness only;
- validates one open opportunity window and its committed allocations;
- processes players sorted by `playerId`, then capability keys sorted lexically, then role responsibilities sorted lexically;
- consumes documented deterministic RNG only after all validation succeeds;
- applies capability deltas to `roster.players[].capabilities`, role-knowledge deltas, readiness/fatigue/conditioning changes, closes the window, appends checkpoint + D events atomically.

`resolveCapabilityAdaptation` must combine current dimension value, capability-family age curve, profile malleability, meaningful opportunity, relevant teaching, workload/recovery context, and controlled uncertainty. It must allow improvement/zero/decline and may not read draft slot, contract salary, stats, or organizational belief as direct capability inputs.

Aging is dimension/family-specific. No universal age-30 rule and no once-per-year progression ceremony.

- [ ] **Step 1: RED zero/redundancy tests**

Meaningful work can yield zero change; repeating redundant/max workload does not produce linear unlimited growth.

- [ ] **Step 2: RED age-curve tests**

Different capability families can mature/decline differently; one veteran can decline physically while retaining/increasing learned knowledge.

- [ ] **Step 3: RED no-status-buff and evidence-separation tests**

Changing draft status, salary, starter label, or box-score-like fixture data with identical causal inputs cannot directly change capability delta. Practice can create qualitative evidence without revealing the internal capability delta, and capability change alone does not auto-form a new organizational belief.

- [ ] **Step 4: RED save/reload/no-reroll test**

Same pre-checkpoint world + same accepted command produces identical deltas/fingerprint/RNG; already-resolved checkpoint rejects with no draw.

- [ ] **Step 5: Implement resolver + atomic command**

Keep formulas in pure functions and all mutation through one command resolution. The checkpoint may append qualitative Package B `ClaimRecord` practice observations sourced to the actual teacher/observer and event family; it must never encode raw capability deltas, malleability, or RNG results as organization-visible claims. A player may change capability without any automatic belief change.

- [ ] **Step 6: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): resolve causal development checkpoints`

---

### Task 7: Automatic Logical-Time Development Checkpoints

**Files:**
- Modify: `packages/sim-core/src/commandRouter.ts`
- Create: `packages/sim-core/src/developmentCalendar.ts`
- Modify: `packages/sim-core/src/developmentResolution.ts`
- Create: `packages/sim-core/test/developmentCalendar.test.ts`
- Modify: `packages/sim-core/test/rng.test.ts`

**Interfaces:**

Add pure `advanceDevelopmentForDay(world, ruleset, date, rng): { world, eventSpecs, rng }`. `routeAdvanceDays` invokes it inside the existing per-day loop immediately after that day's existing `dayRoll = rng.nextU32()` and before the next day's roll. This locks cross-command RNG ordering.

Contract:
- Package A/B/C worlds/rulesets with no D work preserve existing `AdvanceDays` RNG/event behavior byte-for-byte.
- D worlds process every due checkpoint in chronological order; same-day ties use stable org/window IDs.
- UI speed/wall clock never matters.
- A development window that requires an authority/user decision is **not** silently auto-filled; automatic resolution only consumes already committed allocations/defaults explicitly represented in authoritative state.
- Crossing a due medical/development checkpoint later may call D domain hooks but never Package E.

- [ ] **Step 1: RED legacy-advance compatibility test**

Accepted A/B/C `AdvanceDays` fixture outputs/RNG remain unchanged.

- [ ] **Step 2: RED coarse-vs-fine advance equivalence**

With identical explicitly opened windows and committed allocations/defaults, advancing 14 days once and advancing the same D starting state one day 14 times must yield an identical D-domain projection: `development`, `medical`, `roster.players[].capabilities`, final `simDate`, and RNG state/draw count. Do **not** compare whole-world fingerprint, revision, event count, or event-chain head because one command versus fourteen commands legitimately changes those command/audit fields.

- [ ] **Step 3: RED unattended-routine test**

The test explicitly opens the opportunity window through `OpenOpportunityWindow` and commits its allocation/default first. Time advancement then resolves the due routine work automatically; no user drill-click command and no automatic recurring-window invention is required.

- [ ] **Step 4: Implement calendar hook**

Preserve deterministic draw order and old-package no-op path. D draws for each logical day occur after that day's legacy day roll and before the following day's roll.

- [ ] **Step 5: Verify and commit**

Run targeted tests + `npm run ci` + existing A/B/C goldens.

Commit: `feat(core): advance development on logical time`

---

### Task 8: Medical Episode Truth, Progression, Reassessment, and Knowledge Boundary

**Files:**
- Expand: `packages/sim-core/src/medical.ts`
- Create: `packages/sim-core/src/medicalCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/medicalState.test.ts`
- Create: `packages/sim-core/test/medicalReassessment.test.ts`
- Create: `packages/sim-core/test/medicalKnowledgeBoundary.test.ts`

**Interfaces:**

`MedicalEpisode`:
- `id`, `playerId`, `conditionKey`, `onsetAt`, `sourceKind: 'football' | 'synthetic_test'`, `affectedActionKeys[]`, `initialStructuralSeverityBp`, `recoveryResponsivenessBp`, `baselineReinjuryRiskBp`, `status: 'open' | 'resolved'`; no guaranteed return date.

`MedicalProgressRecord`:
- `id`, `episodeId`, `assessedAt`, `structuralHealingBp`, `reinjuryRiskBp`, `limitations[] { actionKey, severityBp }`, `rngDrawStart`, `rngDrawCount`; append-only private truth at a checkpoint.

`MedicalReport { id, episodeId, organizationId, evaluatorPersonId, evidenceClaimIds, beliefId, formedAt }` links D medical work to Package B knowledge. Medical recheck resolution may append Package B claims/beliefs directly using the same record semantics as scouting; it must not create a second evidence store.

`functionalReadiness(world, playerId, actionKey)` is derived from current medical progress + D conditioning/fatigue; it is not synonymous with structural healing.

E-facing pure helper `createMedicalEpisodeChange(world, input)` returns authoritative D-state changes/event specs without committing; future Package E can compose it into one WorldKernel resolution.

Temporary harness command `CreateMedicalEpisode` is restricted to `system|commissioner|test_harness` and wraps the same helper.

`ReassessMedicalEpisode` advances episode progress from logical elapsed time/calibration/workload and controlled uncertainty; same state cannot reroll.

Organization-facing reports use categorical/uncertain findings, never exact hidden healing/risk BPs.

- [ ] **Step 1: RED separation test**

Scenario where structural healing is high while conditioning/functional readiness remain limited and reinjury risk remains elevated.

- [ ] **Step 2: RED prognosis uncertainty test**

A medical recheck narrows/changes legitimate organization evidence without revealing exact hidden recovery state or guaranteed return date.

- [ ] **Step 3: RED immutable-history test**

Later recovery/outcome does not rewrite prior medical claim/report/belief records.

- [ ] **Step 4: Implement episode/progress/recheck boundary**

No game injury generator; this task accepts externally supplied episode creation only.

- [ ] **Step 5: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): add medical recovery and reassessment`

---

### Task 9: Player Preference, Medical Recommendation, Clearance, and Actual Workload Usage

**Files:**
- Expand: `packages/sim-core/src/medical.ts`
- Expand: `packages/sim-core/src/medicalCommands.ts`
- Modify: `packages/sim-core/src/opportunity.ts`
- Modify: `packages/sim-core/src/developmentCommands.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/medicalAuthority.test.ts`
- Create: `packages/sim-core/test/readinessUsage.test.ts`

**Interfaces:**

Append-only records:
- `ParticipationPreferenceRecord { id, playerId, episodeId|null, preference: 'willing' | 'prefer_limit' | 'unwilling', recordedAt, sourceClaimIds[] }`.
- `MedicalRecommendationRecord { id, episodeId, medicalPersonId, participation: 'out' | 'limited' | 'full', maxLoadUnits|null, basisClaimIds[], basisBeliefIds[], issuedAt }`.
- `MedicalClearanceRecord { id, episodeId, organizationId, playerId, participation, maxLoadUnits|null, sourceProposalId, committedAt, supersedesClearanceId|null }`.

Commands:
- `RecordParticipationPreference` - future-facing factual communication path; restricted in D harness to system/test input and cannot mutate healing/readiness.
- `RecordMedicalRecommendation` - actor must possess appropriate `medical_clearance` advise/communicate right and cite legitimate evidence.
- `CommitMedicalClearanceProposal` - category `medical_clearance` through the shared proposal/receipt gate opened in Task 4; Task 9 must not add a parallel authorization path.

Opportunity/workload allocation must not exceed active clearance hard limits. Recommendation/preference can disagree with actual usage and remain separately inspectable; preference is not silently treated as medical truth or as a magical veto unless an explicit authority/protected constraint says so.

- [ ] **Step 1: RED authority matrix tests**

Medical adviser cannot execute clearance without execute right; coach with workload authority cannot manufacture medical clearance; GM cannot bypass both.

- [ ] **Step 2: RED disagreement scenario**

Store simultaneously: medically limited recommendation, legal clearance, player preference, coach usage. Verify each record remains distinct and traceable.

- [ ] **Step 3: RED workload-limit test**

Allocation above active clearance max is rejected atomically/no RNG; more conservative allocation passes.

- [ ] **Step 4: Implement commands + shared validation**

- [ ] **Step 5: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): separate clearance recommendation and usage`

---

### Task 10: Role/Position Transition and Player-Movement Continuity

**Files:**
- Expand: `packages/sim-core/src/developmentCommands.ts`
- Modify: `packages/sim-core/src/roster.ts`
- Modify: `packages/sim-core/src/roleLearning.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/roleTransition.test.ts`
- Create: `packages/sim-core/test/playerMovementContinuity.test.ts`

**Interfaces:**

`CommitRoleTransitionProposal`:
- category `roster`;
- if the same action changes scheme responsibilities, it also requires a current authorized `scheme` proposal (category opened in Task 4) and uses the existing multi-proposal commit gate;
- may change `PlayerRecord.primaryRole` / `roleTags` only;
- cannot change capability values, D profile values, role familiarity, readiness, or medical state by labeling alone.

Transfer behavior:
- capability, health history, person-owned learned knowledge, and actual D profile travel with the person;
- organization-specific private beliefs do not transfer;
- old coach relationship/buy-in is not copied as universal truth;
- new role/scheme familiarity is earned through Task 5 learning; `projectTransferFamiliarity` may grant only justified transfer-family credit.

- [ ] **Step 1: RED position-change cheese test**

Role label change causes exactly zero capability or role-knowledge gain and does not grant target responsibility familiarity.

- [ ] **Step 2: RED team-change continuity test**

Trade/waiver/FA movement preserves capability/medical/person-owned knowledge while new org decision view excludes old org private beliefs.

- [ ] **Step 3: RED revenge-boost test**

Changing organization alone produces no capability delta.

- [ ] **Step 4: Implement transition/transfer helpers**

- [ ] **Step 5: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): preserve causal role and team transitions`

---
### Task 11: Acquisition Opportunity-Cost Projection

**Files:**
- Create: `packages/sim-core/src/developmentImpact.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/developmentImpact.test.ts`

**Interfaces:**

`OpportunityImpactPreview` is derived/non-authoritative and separate from accepted Package C `AcquisitionImpactPreview`.

It contains only organization-legitimate structural consequences:
- affected `resourceKey/scopeKey` pools;
- current allocated/open units;
- incoming/outgoing roster competition IDs;
- crowding/relief bands (`none | low | meaningful | severe`) derived from finite capacity, not hidden ability;
- linked development/succession plan IDs the organization owns;
- uncertainty notes.

Pure entry points:
- `previewOpportunityImpactForRosterChange(world, organizationId, incomingPlayerIds, outgoingPlayerIds)`.

No player profile malleability, latent capability, medical hidden truth, universal prospect value, or predicted final development appears in the preview.

- [ ] **Step 1: RED opportunity-squeeze test**

Adding a young QB to an already fully allocated QB scope shows crowding; adding to an unused scope does not.

- [ ] **Step 2: RED no-oracle test**

Changing only hidden development profile/capability with identical roster/plans/allocations leaves preview unchanged.

- [ ] **Step 3: Implement derived preview**

- [ ] **Step 4: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): project developmental opportunity cost`

---

### Task 12: Knowledge-Safe Development Decision View and CPU/Human Symmetry

**Files:**
- Create: `packages/sim-core/src/developmentView.ts`
- Create: `packages/sim-core/test/developmentView.test.ts`
- Create: `packages/sim-core/test/developmentSymmetry.test.ts`

**Interfaces:**

`DevelopmentDecisionView` may contain:
- organization roster/rights/status facts;
- active organization development/succession plans;
- committed opportunity allocations and remaining capacity;
- legitimately held Package B claims/beliefs/reports;
- communicated medical recommendation/clearance facts available to the organization;
- role/scheme assignments the organization is responsible for;
- relevant relationship history/dimensions for the acting staff member and player where that relationship is legitimate organizational context;
- authority/mandate/protected-constraint facts relevant to the actor.

It must exclude:
- raw `PlayerRecord.capabilities`;
- `PlayerDevelopmentProfile` latent traits;
- raw hidden role-familiarity BP if not established as communicated/observable evidence;
- raw medical progress/healing/risk BPs;
- rival private plans/beliefs/allocations;
- future RNG or trajectory information.

CPU organization and human organization commands consume the same view/legality. No CPU development bonus or hidden truth API is permitted.

- [ ] **Step 1: RED latent-mutation invariance test**

Clone a world; alter only hidden capability/malleability/healing truth; same legitimate evidence must yield byte-equivalent `DevelopmentDecisionView`.

- [ ] **Step 2: RED rival-privacy test**

Organization A view cannot contain B's private development plan, medical belief, or allocation rationale. A coach's earlier choice not to allocate reps cannot create a fresh independent claim that the benched player lacks ability.

- [ ] **Step 3: RED actor-symmetry test**

Equivalent authorized human/cpu actors submitting identical legal D terms receive identical domain legality/outcomes.

- [ ] **Step 4: Implement view**

- [ ] **Step 5: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `feat(core): add development decision boundary`

---

### Task 13: Development/Medical Audit and Exploit Graveyard

**Files:**
- Create: `packages/sim-core/src/developmentAudit.ts`
- Create: `packages/sim-core/test/developmentAudit.test.ts`
- Create: `packages/sim-core/test/developmentExploits.test.ts`

**Interfaces:**

`DEVELOPMENT_FINDING_CODES` must at minimum include:
- `OPPORTUNITY_OVERALLOCATED`
- `ALLOCATION_WITHOUT_ROSTER_ACCESS`
- `TEACHING_BANDWIDTH_EXCEEDED`
- `INVALID_ROLE_KNOWLEDGE`
- `INVALID_READINESS_RANGE`
- `INVALID_CAPABILITY_RANGE`
- `RESOLVED_WINDOW_WITHOUT_CHECKPOINT`
- `CHECKPOINT_WITHOUT_ALLOCATIONS`
- `MEDICAL_PROGRESS_WITHOUT_EPISODE`
- `CLEARANCE_WITHOUT_EPISODE`
- `USAGE_EXCEEDS_CLEARANCE`
- `MEDICAL_REPORT_INACCESSIBLE_BASIS`
- `DEVELOPMENT_EVENT_WITHOUT_CAUSE`

`auditDevelopmentWorld(world, rules)` is read-only, deterministic, sorted, and never repairs. `collectDevelopmentMetrics(world)` returns deterministic grouped counts/sums needed by Package G for opportunity, capability-change, age/family, role-learning, workload, and medical-duration slices; metrics report what happened and never rebalance the world.

Exploit suite must directly attack:
- practice farming / repeated redundant work;
- bench-stash farming;
- stat-padding progression (synthetic stats or external performance totals must not award points);
- position-change cheese;
- mentor/staff stacking;
- hidden-potential inference via decision views;
- save/reload growth shopping;
- max-workload dominance;
- CPU/human asymmetry;
- input-order dependence.

- [ ] **Step 1: RED each finding with a deliberately corrupted fixture**

- [ ] **Step 2: RED exploit and metrics tests**

Do not merely test single happy-path calls; run repeated checkpoint sequences where appropriate. Assert `collectDevelopmentMetrics` is deterministic, knowledge-neutral, and includes the slices needed for later 10/25/50/100-year analysis.

- [ ] **Step 3: Implement audit only**

Audit may detect; it may not silently rebalance/repair.

- [ ] **Step 4: Verify and commit**

Run targeted tests + `npm run ci`.

Commit: `test(package-d): add development exploit audits`

---

### Task 14: Integrated Package D Golden Scenario, Persistence, Replay, and Recovery

**Files:**
- Create: `packages/sim-core/src/packageDScenario.ts`
- Create: `packages/sim-core/src/packageDScenarioRun.ts`
- Create: `packages/sim-core/src/packageDGoldenExpected.ts`
- Modify: `packages/headless/src/cli.ts`
- Modify: `package.json`
- Create: `fixtures/golden/package-d-golden-v1.json`
- Create: `packages/sim-core/test/packageDScenario.test.ts`
- Create: `packages/sim-core/test/packageDReplayRecovery.test.ts`

**Scenario obligations:**

Scenario-driver construction rule: when loops create closure-capturing scenario steps, use `forEach` callbacks or explicit helper functions rather than `for (const ...)` closures, matching the verified Package C Hermes fix. The scenario must explicitly open every required opportunity window; Package D does not auto-create recurring windows.

One integrated synthetic career slice must include all six named D obligations from the design basis:
1. developmental QB succession with finite reps;
2. staff/scheme transition retaining capability but creating installation debt;
3. position/role transition with no label-created skill;
4. major injury/rehab where diagnosis/healing/readiness/conditioning/risk/recommendation/clearance/usage disagree at points;
5. late-bloomer divergence from opportunity/teaching/health/context rather than fixed visible potential;
6. acquisition opportunity squeeze requiring rep-plan reconciliation.

Also include at least one rejected unauthorized/stale D command and one legitimate zero-growth checkpoint.

**Golden assertions:**
- deterministic run twice: same fingerprint, event-chain head, RNG state/draw count;
- alternate allocation variant from same seed diverges in career state without audit errors;
- save/reload at every command boundary yields identical final result;
- persist -> reload -> replay yields identical result;
- corrupt latest snapshot -> repair from history yields identical D history and does not rewrite old claims/reports;
- rejected/stale commands consume no RNG/mutate nothing;
- final acquisition + D audits contain zero error findings;
- accepted historical Package A/B/C golden files remain unchanged, while the new model-4 current-model A-v4/B-v3/C-v2 goldens match their updated expected constants independently and preserve their accepted non-fingerprint semantics.

- [ ] **Step 1: Write scenario RED gate before expected golden**

- [ ] **Step 2: Build scenario only from production commands/helpers**

No test-only direct mutation of authoritative D state after world creation except deliberate corruption tests.

- [ ] **Step 3: Generate expected golden once behavior is accepted by tests**

- [ ] **Step 4: Run golden twice + replay/recovery suites**

- [ ] **Step 5: Run full CI and commit**

Commit: `test(package-d): gate development and medical ecology`

---

### Task 15: Hermes/iPhone Cross-Runtime Gate and Package D Acceptance

**Files:**
- Create: `scripts/hermes/entryPackageD.ts`
- Modify: `scripts/hermes-golden.mjs`
- Modify: `package.json`
- Modify: `apps/mobile/src/diagnostics/goldenDiagnostics.ts`
- Create: `apps/mobile/src/diagnostics/packageDJudgement.ts`
- Modify: `apps/mobile/app/diagnostics.tsx`
- Create: `apps/mobile/test/packageDDiagnostics.test.ts`
- Create: `evidence/package-d/hermes-run.txt`
- Create: `evidence/package-d/ci-windows.txt`
- Create: `evidence/package-d/clean-checkout-ci.txt`
- Create after physical run: `evidence/package-d/iphone-run.md`
- Create after all gates: `docs/release/PACKAGE_D_ACCEPTANCE.md`

**Interfaces / gates:**
- Node Package D golden run twice must match itself.
- Standalone Hermes Package D bundle/run twice must match Node fingerprint, event-chain head, revision, event count, RNG state/draw count, and selected D record IDs.
- Physical iPhone Diagnostics gets `Run Package D scenario`; direct and SQLite-backed runs must MATCH the accepted Node/Hermes result.
- Clean checkout of the candidate commit: `npm ci` then `npm run ci` must pass.
- `npm run ci` must include Package D golden while retaining A/B/C golden checks and iOS export.
- Fresh test count, typecheck, lint, format, architecture, replay/recovery, all goldens, and iOS export recorded in acceptance evidence.
- Final physical-iPhone step is a user-action stop condition; do not fabricate it.

- [ ] **Step 1: RED mobile judgement tests and Hermes entry**

- [ ] **Step 2: Run Node <-> Hermes and resolve any actual cross-runtime difference**

Never normalize away a mismatch without finding its cause.

- [ ] **Step 3: Run clean-checkout full CI**

- [ ] **Step 4: Stop for physical iPhone diagnostics**

Record only the user's actual MATCH/MISMATCH observation.

- [ ] **Step 5: If every gate is green, write acceptance doc/tag**

Acceptance document must map every Package D acceptance identity item to concrete tests/evidence and list interpretations/deferrals honestly.

Tag only after acceptance: `package-d-acceptance-20261017` (or current acceptance date if completed later).

Commit sequence at the end should separate any diagnostic fix from the final acceptance-doc commit.

---

## Package D acceptance contract

Do not declare Package D accepted until all are true:

1. World model 4 migration preserves accepted A/B/C historical evidence and adds versioned current-model A-v4/B-v3/C-v2 goldens without rewriting prior files.
2. D rules/seed profiles fail closed and contain no fixed-destiny field.
3. Current capability truth remains only in `roster.players[].capabilities`.
4. Capability updates are per-dimension, causal, bounded, and allow zero/plateau/decline.
5. Age effects are capability-family-specific, not a universal cliff.
6. Opportunity pools are finite/conserved and prospect hoarding crowds opportunity.
7. GM development intent cannot bypass HC/staff workload authority.
8. Teaching is responsibility-specific and bandwidth-limited; no coach aura/stacking exploit.
9. Role/scheme learning is responsibility-level and position labels create no skill.
10. Development checkpoints are deterministic/idempotent and cannot be save/reload rerolled.
11. Routine checkpoints advance through logical sim time rather than user drill clicks.
12. Medical episode truth is distinct from organization diagnosis/prognosis knowledge.
13. Structural healing, functional readiness, conditioning, risk, performance limitation, preference, recommendation, clearance, and usage can disagree.
14. Historical medical/development reports remain immutable.
15. Workload cannot exceed authoritative clearance constraints.
16. Player movement preserves person-owned capability/health/knowledge without carrying rival private beliefs or revenge boosts.
17. Acquisition opportunity-cost preview is derivable and knowledge-safe, not a development-value oracle.
18. Development decision view cannot leak raw capability/profile/healing truth or rival private state.
19. CPU and human clubs use the same D legality and authoritative rules.
20. Audit/exploit suite catches practice farming, bench stash, stat padding, position cheese, staff stacking, hidden-potential inference, save/reload shopping, workload maxing, and order dependence.
21. Integrated D scenario covers all six named scenario obligations and ends clean.
22. Save/reload/replay/recovery preserve exact D history and current state.
23. Package A/B/C goldens remain independently green.
24. Node and Hermes agree exactly on D golden outputs.
25. Physical iPhone direct + SQLite-backed D diagnostics MATCH Node/Hermes.
26. Clean-checkout CI passes.
27. Package E can consume one coherent source of current capabilities, role/scheme knowledge, workload/readiness, medical limitation/risk, and knowledge-safe organizational evidence without inventing duplicate state.

## Execution discipline

- Implement Tasks 1-15 strictly in order.
- Use RED -> GREEN where behavior is new or changed.
- Every accepted task gets targeted tests, required broader gates, one reviewable commit, and push before continuing.
- Preserve failures and interpretations; do not rewrite the plan silently to match accidental code behavior.
- Do not start Package E before Package D acceptance/tag.
- Stop on any design conflict, hidden-truth leak, fixed-potential/XP shortcut, authority bypass, migration/persistence break, unresolved dominant exploit, or physical-device gate.
