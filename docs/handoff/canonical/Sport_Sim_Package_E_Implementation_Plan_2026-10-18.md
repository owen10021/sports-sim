# Sport Sim Package E - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** APPROVED FOR IMPLEMENTATION - user authorization recorded 2026-10-18

**Goal:** Add the first authoritative deterministic football engine so accepted A-D roster, capability, role-knowledge, readiness, medical, authority and planning truth produces one truthful Sunday outcome path for complete games, Fast Sim, GameCast, replay and headless QA.

**Architecture:** Package E extends the accepted Package D `FootballWorld` to world model 5 with one new `football` domain. One pure play resolver consumes ruleset-owned football vocabulary plus existing A-D truth; one complete-game command repeatedly invokes that resolver, composes D-owned workload and medical ingress, stores compact football facts and causal links, and commits atomically through the existing `WorldKernel`. Presentation and fast-forward are consumers of resolved facts and never consume gameplay RNG.

**Tech Stack:** TypeScript 7, Vitest 5, existing pure `packages/sim-core`, Expo 57/Hermes diagnostics, existing persistence/replay/golden harnesses.

**Spec:** `docs/handoff/canonical/Sport_Sim_Package_E_Design_Basis_2026-10-18.md`

## Global constraints

- Baseline is Package D acceptance commit `cc29f6ebb0c912a3d69d52a67aee8635e703d299`; the E design-doc commits may sit on top of it, but implementation must preserve all accepted A-D evidence and tags.
- Never apply, pop, delete or treat `stash@{0}` (`rescueadmin-pre-final-package-d-20261017`) as current source.
- Never use stale `docs/handoff/PROGRAMMER_HANDOFF_CURRENT.md` as architectural truth until it is intentionally refreshed.
- Substantive implementation occurs in an isolated worktree/branch created at execution time with the established superpowers worktree workflow.
- One authoritative `FootballWorld`; only `WorldKernel` commits authoritative reality.
- `packages/sim-core` remains pure TypeScript: no React/React Native/Expo/SQLite/filesystem/network/wall-clock imports.
- World model 5 adds exactly one new authoritative top-level domain: `football`.
- `roster.players[].capabilities` remains the only authoritative football-capability ledger. E may read it internally; E may not copy or summarize it into OVR/team strength.
- `development.readiness` remains the only physiological readiness/fatigue/load truth. E may retain historical participation/workload facts but no second readiness ledger.
- `medical.*` remains the only injury/medical truth. E generates football injury occurrence then composes `createMedicalEpisodeChange`; E stores references, not an injury state copy.
- Human and CPU clubs use identical legality, information boundaries and football resolution.
- Offense and defense commit calls independently; neither selector may receive the opponent's final call or rival private/latent truth.
- One authoritative play resolver drives complete-game resolution; Fast Sim/GameCast/replay/headless consume the same stored football facts.
- Football outcomes use deterministic integer/fixed-point/basis-point math and the existing world RNG only. No `Math.random`, wall clock, presentation RNG or second gameplay stream.
- `AdvanceDays` may reach but may not cross an unresolved scheduled-game boundary; blocking must happen before any RNG draw/mutation for the rejected command.
- Complete scheduled game resolves as one kernel command in Package E. Invalid/faulted games commit nothing.
- Game-resolution actor kind authorizes simulation progression only; it cannot affect football calls, participants, probabilities, RNG order or outcomes.
- Existing `strategy` `PlanKind` remains; no new Package E game-plan `PlanKind`.
- Open the already-reserved `game_day_activation` proposal/domain-commit category; do not change existing A-D category meaning.
- Game-day designations are fixture-scoped and never duplicate Package C roster membership/status truth.
- D gets an explicit D-owned football-usage ingress before game code depends on it.
- Actual football usage may update D readiness/load and role familiarity immediately through that ingress, but it does not directly award capability-rating gains per snap/play; capability adaptation remains with D checkpoint/development resolution.
- Medical clearance is the hard legal usage cap. Recommendation and preference remain distinct context and may disagree.
- Engine facts do not masquerade as staff opinion. Organization-facing interpretations require legitimate people/roles and Package B provenance.
- Sunday-Proof links are recorded from inputs that truly entered resolution; no post-hoc importance bonus/modifier.
- Package E synthetic football numbers are test/calibration fixtures, not claims about NFL probabilities, injuries or tactical balance.
- Package E stops before full current NFL rule/CBA replication, giant playbooks, route geometry/collision physics, polished 2D rendering, final Command Center UX, full 32-club career calendar generation, Year-100 certification or real-world statistical calibration.

## Review focus

1. **Hidden-information leakage:** selector and organization-facing evidence paths must not expose opponent final calls, latent capabilities, private medical truth, rival plans, RNG rolls or debug margins. Tasks 5, 12 and 15 pin this.
2. **Duplicate truth:** football state must never become a second capability, readiness/fatigue or medical ledger. Tasks 2, 8, 9 and 15 pin this.
3. **Determinism/reroll:** validation, RNG draw order, fixture finalization and save/reload boundaries must make due/final games impossible to reroll. Tasks 4, 6, 10, 14 and 16 pin this.
4. **Resolver divergence:** Fast Sim, GameCast, CPU games, history and replay must consume identical play/game facts rather than recomputing outcomes. Tasks 10, 13, 15 and 16 pin this.
5. **Fake Sunday Proof:** causal links must reference resolution-time inputs that actually participated and organization-facing views must not overstate latent or exclusive causality. Tasks 11, 12 and 15 pin this.

---

## File structure locked for Package E

New focused modules:

- `packages/sim-core/src/football.ts` - authoritative E football state types and pure queries.
- `packages/sim-core/src/footballRules.ts` - `FootballRulesV1`, vocabulary, exact-key parser and fail-closed access.
- `packages/sim-core/src/packageESeedParse.ts` - synthetic fixture/game substrate parsing and cross-reference checks.
- `packages/sim-core/src/gameDay.ts` - fixture-scoped designation/assignment legality and activation commit adapter.
- `packages/sim-core/src/gamePlan.ts` - game-plan execution snapshot and authority/plan binding.
- `packages/sim-core/src/footballCalendar.ts` - unresolved-fixture boundary queries for `AdvanceDays`.
- `packages/sim-core/src/footballSelection.ts` - separate offense/defense selector input construction and deterministic call selection.
- `packages/sim-core/src/footballActions.ts` - action/capability/readiness/role-familiarity input derivation; no persistent ratings.
- `packages/sim-core/src/playResolver.ts` - pure meaningful-phase play resolution and deterministic draw schedule.
- `packages/sim-core/src/gameState.ts` - clock/down/distance/possession/scoring/penalty/substitution/special-teams transitions.
- `packages/sim-core/src/gameResolver.ts` - complete-game orchestration using only `resolvePlay`.
- `packages/sim-core/src/developmentFootballUsage.ts` - Package-D-owned actual-football-usage ingress.
- `packages/sim-core/src/footballInjuries.ts` - E occurrence/exposure calculation; D episode creation remains in `medicalCommands.ts`.
- `packages/sim-core/src/footballEvidence.ts` - legitimate staff-observation claims built from football facts without latent leakage.
- `packages/sim-core/src/sundayProof.ts` - causal link construction/query/disclosure filtering.
- `packages/sim-core/src/gameCast.ts` - read-only projections from resolved play/game facts.
- `packages/sim-core/src/footballAudit.ts` - read-only E invariants/exploit findings and storage counters.
- `packages/sim-core/src/footballCommands.ts` - E command routing for activation and scheduled-game resolution.
- `packages/sim-core/src/packageEScenario.ts` / `packageEScenarioRun.ts` / `packageEGoldenExpected.ts` - integrated acceptance scenario.

Do not fold the resolver into `commandRouter.ts`, `world.ts`, `medicalCommands.ts` or Package D resolution files. Those files should remain boundaries/orchestration, not become football-engine monoliths.

---

### Task 1: Freeze Accepted Package D and Version World Model 5

**Files:**
- Modify: `packages/sim-core/src/worldModel.ts`
- Modify: `packages/sim-core/src/world.ts`
- Create: `packages/sim-core/src/football.ts`
- Modify: `packages/sim-core/src/index.ts`
- Modify: `packages/sim-core/src/persistence.ts`
- Create: `packages/sim-core/test/worldModelV5.test.ts`
- Create: `packages/sim-core/test/packageDWorldMigration.test.ts`
- Modify: `packages/sim-core/test/persistenceContract.test.ts`
- Create: `fixtures/legacy/package-d-world-v4-snapshot.json`
- Modify: `fixtures/legacy/README.md`
- Modify: `fixtures/legacy/SHA256SUMS.txt`
- Modify: `packages/sim-core/test/legacyFixtureIntegrity.test.ts`
- Create new versioned current-model A/B/C/D golden files; exact filenames follow the existing suffix pattern and must not overwrite accepted files.
- Modify expected-constant/headless/Hermes/mobile judgement paths only as required by the model bump.

**Interfaces:**
- `WORLD_MODEL_VERSION = 5`.
- `FootballState` initially exposes exactly `fixtures`, `designations`, `gamePlans`, `games`, `plays`, `causalLinks` arrays.
- `FootballWorld` gains `football: FootballState`.
- Add `LegacyPackageDWorld` = exact accepted world-model-4 shape.
- Add `isLegacyPackageDWorld`, `migrateLegacyPackageDWorld(world: LegacyPackageDWorld): FootballWorld`, and `fingerprintLegacyPackageDWorld(world)` using fingerprint version 4 semantics.
- `StoredWorld`, `requireCurrentWorld` and persistence verification explicitly recognize model 4; A -> B -> C -> D -> E remains an explicit migration chain.
- Current `fingerprintWorld` moves to version 5. Accepted historical event-chain heads and old golden files are immutable.

- [ ] **Step 1: Capture accepted D legacy fixture before model changes**

Generate the model-4 fixture from accepted D state/tag and record its SHA-256. Assert its accepted fingerprint matches the D acceptance evidence.

- [ ] **Step 2: Write RED migration/persistence tests**

Assert D -> E adds only empty `football`, preserves every A-D domain canonical byte, world id/date/revision/RNG/next ids/entities, creates no event and consumes no RNG. Future/incomplete shapes fail closed.

- [ ] **Step 3: Implement model-5 skeleton and legacy-D migration**

Add `emptyFootballState`; extend exact domain-key validation; update stored-world/persistence fingerprint dispatch. Do not alter legacy A/B/C/D fingerprint functions.

- [ ] **Step 4: Version current-model A/B/C/D goldens**

Generate new current-model files under model 5. For each predecessor, assert event-chain head, event count, revision, RNG state/draw count and scenario-domain outputs remain equal; only current-model/per-step fingerprints may change from the added empty football domain.

- [ ] **Step 5: Verify**

Run: `npm test -- packages/sim-core/test/worldModelV5.test.ts packages/sim-core/test/packageDWorldMigration.test.ts packages/sim-core/test/persistenceContract.test.ts packages/sim-core/test/legacyFixtureIntegrity.test.ts`

Then: `npm run golden:check && npm run golden:package-b:check && npm run golden:package-c:check && npm run golden:package-d:check && npm run ci`

Expected: PASS; accepted historical files stay untouched and current-model versions preserve accepted non-fingerprint semantics.

- [ ] **Step 6: Commit and push**

Commit: `feat(core): version world model for football engine`

---

### Task 2: Football Rules, Vocabulary, Synthetic Calibration, and Seed Substrate

**Files:**
- Create: `packages/sim-core/src/footballRules.ts`
- Create: `packages/sim-core/src/packageESeedParse.ts`
- Modify: `packages/sim-core/src/ruleset.ts`
- Modify: `packages/sim-core/src/seed.ts`
- Modify: `packages/sim-core/src/world.ts`
- Extend: `packages/sim-core/src/football.ts`
- Modify: `packages/sim-core/src/syntheticFixtures.ts`
- Create: `fixtures/rulesets/synthetic-package-e-rules-v1.json`
- Create: `fixtures/seeds/synthetic-package-e-world-v1.json`
- Create: `packages/sim-core/test/footballRules.test.ts`
- Create: `packages/sim-core/test/packageESeed.test.ts`

**Interfaces:**

`LeagueRules.rules.football?: FootballRulesV1` is optional so accepted A-D ruleset hashes remain byte-identical. E commands call `requireFootballRules` and fail closed when absent.

`FootballRulesV1` must contain only versioned deterministic football structure needed by the accepted E model: `modelVersion: 1`, field/clock/down/scoring semantics, represented penalties, represented substitution/eligibility rules, represented special-teams situations, scheme/formation/personnel/concept/responsibility/action vocabularies, action -> capability bindings, compatibility maps, exposure -> D workload conversion, synthetic play outcome parameters, synthetic injury parameters and canonical ordering declarations.

`FootballActionDefinition` includes `actionKey`, `capabilityBindings[] { capabilityKey, weightBp }`, `responsibilityKeys[]`, and a deterministic readiness/role-familiarity participation policy. Binding weights are safe integers, non-negative and normalized according to the parser contract; no action creates a stored ability value.

`PackageESubstrateSeed` supplies a minimal synthetic fixture schedule only: fixture id, logical date, home/away organization ids and rules-profile key. It does not seed resolved games, latent calls or outcomes.

- [ ] **Step 1: Write RED compatibility/exact-key tests**

A-D rulesets re-seal byte-identically. Unknown/future football model versions, unknown vocabulary keys, duplicate definitions, invalid capability bindings and unsupported fields fail closed.

- [ ] **Step 2: Write RED cross-reference tests**

Every action binding must reference capability keys present in the synthetic seeded player ecology; every concept references declared responsibilities/actions/personnel; fixtures reference distinct existing organizations and valid logical dates.

- [ ] **Step 3: Implement parser/accessors + synthetic profile**

Provenance text must say synthetic engineering/calibration fixture, not empirically validated NFL football or injury truth.

- [ ] **Step 4: Seed fixture state only**

`createWorld` initializes football fixtures from Package E seed and leaves designations/game plans/games/plays/causal links empty. Older seeds initialize empty football state.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/footballRules.test.ts packages/sim-core/test/packageESeed.test.ts packages/sim-core/test/packageDSeed.test.ts`

Then: `npm run ci`

Expected: PASS; A-D rulesets still seal/check under their accepted hashes.

Commit: `feat(core): add football rules and fixture substrate`

---

### Task 3: Package-D-Owned Football Usage Ingress

**Files:**
- Create: `packages/sim-core/src/developmentFootballUsage.ts`
- Modify: `packages/sim-core/src/development.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/developmentFootballUsage.test.ts`
- Create: `packages/sim-core/test/footballUsageTruthBoundary.test.ts`

**Interfaces:**

`FootballUsageEvidence`:
- `fixtureId`, `playId`, `organizationId`, `playerId`, `occurredAt`;
- `workloadUnits` safe integer >= 0;
- `contactClass` ruleset-declared value;
- `responsibilityExposures[] { schemeKey, responsibilityKey, meaningfulReps }`;
- `actionExposures[] { actionKey, attempts }`.

Add pure `applyFootballUsageEvidence(world, ruleset, evidence[]): { nextWorld: FootballWorld; eventSpecs: readonly EventSpec[] }` in the D-owned module. The complete-game resolver may invoke it after each resolved play against its local working world so subsequent plays see accumulated D readiness/fatigue; the kernel still commits only once when the entire game succeeds.

Contract:
- canonicalize by fixture/play/player/action/responsibility before mutation;
- validate all evidence before changing D state;
- update `development.readiness` fatigue/load only through one D-owned formula using ruleset-defined workload units;
- update existing/new `roleKnowledge` familiarity only for meaningful represented responsibilities using D learning semantics;
- append D causal events/record IDs as needed;
- do **not** directly mutate `roster.players[].capabilities` and do not invoke `resolveCapabilityAdaptation` per snap/play;
- do not create football history or medical episodes;
- no RNG consumption in the ingress itself;
- evidence already represented by an existing D `football_usage` development event for the same play/player rejects rather than double-counting.

- [ ] **Step 1: RED no-XP/capability test**

A large valid game workload changes readiness/load and eligible role familiarity but produces exactly zero immediate capability-value change.

- [ ] **Step 2: RED canonical-order/idempotence-boundary tests**

Permutation of the same evidence set yields identical D state/record ordering. Duplicate fixture+play+player evidence in one input is rejected rather than double-counted.

- [ ] **Step 3: RED medical-cap separation test**

The ingress does not decide whether usage was legally allowed; it records already-validated actual usage. Game legality will own cap enforcement later.

- [ ] **Step 4: Implement D ingress and record-id accounting**

Reuse D role-learning/readiness helpers where possible; do not fork a second adaptation formula.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/developmentFootballUsage.test.ts packages/sim-core/test/footballUsageTruthBoundary.test.ts packages/sim-core/test/developmentTruthBoundary.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): ingest actual football usage into development`

---

### Task 4: Game-Day Activation, Designation, and Authority Commit Path

**Files:**
- Create: `packages/sim-core/src/gameDay.ts`
- Create: `packages/sim-core/src/footballCommands.ts`
- Modify: `packages/sim-core/src/football.ts`
- Modify: `packages/sim-core/src/decisionCommands.ts`
- Modify: `packages/sim-core/src/transactionCommit.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/gameDayActivation.test.ts`
- Create: `packages/sim-core/test/gameDayAuthority.test.ts`
- Modify: `packages/sim-core/test/transactionCommit.test.ts`

**Interfaces:**

Open exactly one additional proposal/domain-commit category: `game_day_activation`.

`GameDayDesignation` stores `id`, `fixtureId`, `organizationId`, `playerId`, `status: 'active' | 'inactive'`, `unitKey`, `roleKey`, `depthOrder`, `sourceProposalId`, `committedAt`.

`CommitGameDayActivationProposal` executes `termsType: 'game_day_activation_v1'` through `commitAuthorizedDomainChange` and may only designate players with legitimate C roster membership/rights on the fixture date.

- [ ] **Step 1: RED roster-truth separation test**

Committing active/inactive designation changes no Package C membership status/right/contract record.

- [ ] **Step 2: RED authority/protected-constraint tests**

GM UI identity grants no implicit activation authority; stale/unauthorized terms reject atomically. Existing proposal hash/receipt machinery binds exact fixture/player designation terms.

- [ ] **Step 3: RED eligibility basics**

Wrong-org, not-rostered, duplicate designation, fixture-final, and unknown unit/role fail before RNG. A player with hard medical workload cap 0 cannot be designated active for a participation role in the synthetic profile.

- [ ] **Step 4: Implement designation state + command adapter**

Update `takenRecordIds` for E designation records.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/gameDayActivation.test.ts packages/sim-core/test/gameDayAuthority.test.ts packages/sim-core/test/transactionCommit.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): add game-day activation authority`

---
### Task 5: Competition State, Game-Plan Snapshot, and AdvanceDays Boundary

**Files:**
- Create: `packages/sim-core/src/gamePlan.ts`
- Create: `packages/sim-core/src/footballCalendar.ts`
- Modify: `packages/sim-core/src/football.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Expand: `packages/sim-core/src/footballCommands.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Reuse: `packages/sim-core/src/transactionCommit.ts`
- Create: `packages/sim-core/test/gamePlan.test.ts`
- Create: `packages/sim-core/test/footballCalendar.test.ts`
- Modify: `packages/sim-core/test/rng.test.ts`

**Interfaces:**

`FootballFixture` stores `id`, `date`, `homeOrganizationId`, `awayOrganizationId`, `rulesProfileKey`, `status: 'scheduled' | 'final'`, `finalGameId: RecordId | null`.

`GamePlanExecutionSnapshot` stores `id`, `fixtureId`, `organizationId`, `capturedAt`, `strategyPlanRefs[] { planId, revision }`, `schemeProposalRef { proposalId, revision, termsHash }`, `authorizedStaffPersonIds[]`, `schemeKey`, `conceptKeys[]`, `personnelPreferenceKeys[]`, canonical `constraints`, and `sourceProposalId`. It is an immutable committed execution snapshot, not a live pointer.

Add pure `buildGamePlanExecutionSnapshot(world, fixtureId, organizationId, proposalId): GamePlanExecutionSnapshot | Failure` which validates exact strategy-plan revisions, scheme vocabulary, authorized staff and current authority against the proposed terms. Add command `CommitGamePlanProposal` using existing category `scheme`, `termsType: 'game_plan_execution_v1'`, and `commitAuthorizedDomainChange`; the successful domain commit creates the snapshot and a normal immutable decision receipt. A due game may resolve only when both organizations have exactly one committed snapshot for the fixture.

Add `nextBlockingFootballFixture(world, targetDate): FootballFixture | null` and integrate it into `AdvanceDays` **before** creating the local RNG or entering the per-day loop.

`ResolveScheduledGame` command type is registered now as a skeleton progression command, permitted for `human_gm | commissioner | system | test_harness`, but it must reject until Tasks 6-10 provide the resolver. Actor kind is excluded from football selector/resolver inputs.

- [ ] **Step 1: RED snapshot immutability tests**

Commit a game-plan proposal, then revise the underlying strategy plan or submit a newer scheme proposal afterward. Prove the committed snapshot and its decision receipt retain the exact prior plan revision/terms hash rather than following live state.

- [ ] **Step 2: RED AdvanceDays boundary tests**

Advancing exactly to a scheduled-game date succeeds under legacy daily/D semantics. Any command whose target date is after an unresolved fixture rejects before RNG or mutation and reports the blocking fixture/date. A/B/C/D worlds with empty football preserve accepted behavior.

- [ ] **Step 3: RED progression-actor neutrality test**

Equivalent `human_gm`, `commissioner`, `system` and `test_harness` game-resolution skeleton inputs produce the same validation path; actor identity is never passed into game-plan or football outcome inputs.

- [ ] **Step 4: Implement committed game-plan snapshot, boundary, and skeleton**

Keep `AdvanceDays` D draw ordering unchanged for every day it is legally allowed to advance.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/gamePlan.test.ts packages/sim-core/test/footballCalendar.test.ts packages/sim-core/test/developmentCalendar.test.ts packages/sim-core/test/rng.test.ts`

Then: `npm run golden:check && npm run golden:package-b:check && npm run golden:package-c:check && npm run golden:package-d:check && npm run ci`

Expected: PASS; legal pre-E/D time advancement stays unchanged.

Commit: `feat(core): stop time at scheduled football boundaries`

---

### Task 6: Separate Offensive and Defensive Selection Boundaries

**Files:**
- Create: `packages/sim-core/src/footballSelection.ts`
- Create: `packages/sim-core/src/footballActions.ts`
- Modify: `packages/sim-core/src/football.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/footballSelection.test.ts`
- Create: `packages/sim-core/test/footballActionInputs.test.ts`
- Create: `packages/sim-core/test/footballSelectionPrivacy.test.ts`

**Interfaces:**

`OffensiveSelectionView` and `DefensiveSelectionView` are distinct structural types. Each may contain its own fixture/game state, own game-plan snapshot, own designations/assignments, legitimate public/held opponent tendencies, and rules vocabulary needed for selection. Neither type contains the opponent's final call, opponent latent capabilities, rival private plans/beliefs/medical truth or future RNG.

Pure functions:
- `buildOffensiveSelectionView(world, ruleset, fixtureId, gameState): OffensiveSelectionView`;
- `buildDefensiveSelectionView(world, ruleset, fixtureId, gameState): DefensiveSelectionView`;
- `selectOffensiveCall(view, selectorRolls): CommittedOffensiveCall`;
- `selectDefensiveCall(view, selectorRolls): CommittedDefensiveCall`.

The initial deterministic selector may be deliberately simple, but it must use legitimate football context rather than a team-strength oracle. Selection RNG draws are supplied explicitly by the eventual play resolver; selectors do not reach into world RNG themselves.

`deriveFootballActionInput(world, ruleset, playerId, actionKey, schemeKey, responsibilityKey)` returns ephemeral action inputs from existing capability values, D role familiarity and `functionalReadiness`. It may compute integer weighted components but returns no persistent rating and performs no mutation.

- [ ] **Step 1: RED structural privacy test**

Type/runtime fixtures prove offensive input contains no defensive final-call field and defensive input contains no offensive final-call field.

- [ ] **Step 2: RED post-construction leakage test**

Construct both views, then mutate an otherwise equivalent test world's opponent final call/private plan; already constructed selector input and selected call remain unchanged.

- [ ] **Step 3: RED latent-knowledge test**

Changing opponent hidden capabilities/private medical progress while held/public evidence is unchanged must not change selector views. Internal `deriveFootballActionInput` may change only when called by the reality resolver after commitment.

- [ ] **Step 4: Implement selectors/action derivation**

Unknown scheme/responsibility/action/capability binding fails closed before supplied selector/resolver rolls are consumed by the caller.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/footballSelection.test.ts packages/sim-core/test/footballActionInputs.test.ts packages/sim-core/test/footballSelectionPrivacy.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): isolate football call information boundaries`

---

### Task 7: Pure Play Resolver and Canonical RNG Draw Contract

**Files:**
- Create: `packages/sim-core/src/playResolver.ts`
- Modify: `packages/sim-core/src/footballActions.ts`
- Modify: `packages/sim-core/src/football.ts`
- Create: `packages/sim-core/test/playResolver.test.ts`
- Create: `packages/sim-core/test/playResolverRng.test.ts`
- Create: `packages/sim-core/test/footballMechanism.test.ts`

**Interfaces:**

`PlayStateInput` includes current authoritative game state, offense/defense organizations, frozen game-plan snapshots, legal designated participants, and the active `FootballRulesV1` profile.

`ResolvedPlayDraft` contains no global record id; it includes sequence, offense/defense org ids, pre-play down/distance/field/clock/score, personnel keys, committed offensive/defensive concept keys, principal represented assignments/matchups, result kind, yards/field effect, turnover/scoring facts, penalty facts, participation/action exposure facts, post-play state summary and internal trace hash. `gameResolver.ts` mints the eventual `ResolvedPlayFact.id` on its local working world before composing downstream D/medical/causal references. Neither draft nor persisted fact stores raw capability values or debug margins.

Add pure `resolvePlay(input, rng: DeterministicRng): { resolved: ResolvedPlayDraft; nextGameState: GameState; rng: DeterministicRng; privateTrace: PlayPrivateTrace }`.

Canonical draw order is explicit and tested. The initial contract names draw families for offensive selection, defensive selection, recognition/execution, interaction, progression/target-or-lane, contest/ball security, penalty, and injury/exposure evaluation. Optional phases may consume draws only through a versioned deterministic branch defined by play type; no presentation consumer draws.

- [ ] **Step 1: RED deterministic replay test**

Identical validated play input + identical RNG snapshot produces byte-equivalent resolved play, next state, trace hash and draw count.

- [ ] **Step 2: RED validation-before-draw test**

Unknown vocabulary, illegal participant, malformed assignment or impossible starting game state throws/rejects without advancing the supplied RNG.

- [ ] **Step 3: RED no-OVR/status-input test**

Changing team name/id labels, human-control status, win streak-like test metadata or any synthetic OVR field outside the accepted input cannot affect the play result. No accepted resolver input type contains team OVR.

- [ ] **Step 4: RED mechanism/distribution tests**

Across fixed synthetic seed batches, increasing a capability used by the represented action, improving exact responsibility familiarity, changing functional readiness, or changing a relevant tactical concept matchup shifts the expected outcome statistic in the designed direction but does not guarantee every trial.

- [ ] **Step 5: Implement pure meaningful-phase resolver**

Use integer/fixed-point helpers only. Ephemeral matchup/execution margins live in `PlayPrivateTrace`, never player/world rating state.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- packages/sim-core/test/playResolver.test.ts packages/sim-core/test/playResolverRng.test.ts packages/sim-core/test/footballMechanism.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): resolve deterministic football plays`

---

### Task 8: Clock, Downs, Possession, Scoring, Penalties, Substitutions, and Special Teams

**Files:**
- Create: `packages/sim-core/src/gameState.ts`
- Expand: `packages/sim-core/src/playResolver.ts`
- Modify: `packages/sim-core/src/footballRules.ts`
- Create: `packages/sim-core/test/gameState.test.ts`
- Create: `packages/sim-core/test/footballPenalties.test.ts`
- Create: `packages/sim-core/test/footballSubstitutions.test.ts`
- Create: `packages/sim-core/test/specialTeams.test.ts`

**Interfaces:**

`GameState` is ephemeral complete-game resolution state containing period, clock ticks/seconds, possession, down, distance, field position, score, possession/drive counters and legal participant usage counters needed for hard-cap enforcement. It is not a second world domain collection by itself.

Pure transition helpers must independently test represented V1 semantics:
- `applyScrimmageResult`;
- `applyPenaltyResult`;
- `applyScoringResult`;
- `applyKickoffResult`;
- `applyPuntResult`;
- `applyFieldGoalResult`;
- `nextDownAndDistance`;
- `legalSubstitution` / eligibility checks.

The synthetic profile need only implement the accepted E representation boundary, but every rule it claims to represent must reconcile deterministically.

- [ ] **Step 1: RED clock/down/possession table tests**

Pin first-down reset, turnover on downs, possession changes, scoring restart and game-end semantics using exact synthetic fixture rules.

- [ ] **Step 2: RED penalty enforcement tests**

Represented accepted/declined/offset or simplified V1 penalty behaviors must be explicit; no impossible down/clock/field state may survive.

- [ ] **Step 3: RED substitution/eligibility tests**

Only active designated players in legal represented units/roles may participate. Inactive/reserve-only/wrong-org participants fail before play RNG.

- [ ] **Step 4: RED special-teams tests**

Kickoff, punt and field-goal situations use the same game state/play facts and reconcile score/possession/clock; no second special-teams simulator.

- [ ] **Step 5: Implement transition layer and integrate with `resolvePlay`**

Keep state transitions pure; no world mutation here.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- packages/sim-core/test/gameState.test.ts packages/sim-core/test/footballPenalties.test.ts packages/sim-core/test/footballSubstitutions.test.ts packages/sim-core/test/specialTeams.test.ts packages/sim-core/test/playResolver.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): reconcile football game state`

---

### Task 9: Complete-Game Orchestration and Medical Workload Enforcement

**Files:**
- Create: `packages/sim-core/src/gameResolver.ts`
- Expand: `packages/sim-core/src/footballCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/football.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/gameResolver.test.ts`
- Create: `packages/sim-core/test/gameMedicalUsage.test.ts`
- Create: `packages/sim-core/test/gameResolutionAtomicity.test.ts`

**Interfaces:**

Add `resolveScheduledGameChange(world, ruleset, fixtureId): { nextWorld, eventSpecs, gameDraft }` as a pure composition boundary used by the command router.

`ResolveScheduledGame` validates fixture due/not-final, both clubs' designations, game-plan snapshots, rules/vocabulary and initial game state **before first football RNG draw**. It then creates one local RNG from `world.rng`, repeatedly invokes `resolvePlay`, enforces per-player actual usage against `medicalWorkloadCap`, and finishes only at a legal final state.

The game command may emit multiple event specs but commits one world revision through the kernel. Fixture becomes final and references exactly one `GameRecord`.

`GameRecord` initially stores `id`, `fixtureId`, `playedAt`, organizations, final score, game-plan snapshot ids, play ids, participation summary, team/player stat summary refs/data, medical episode refs, `rngDrawStart`, `rngDrawCount`, and reconciliation counters/hash.

- [ ] **Step 1: RED exact-once/date tests**

Too-early, wrong-date, already-final and duplicate-resolution attempts reject with no RNG/mutation. A valid due fixture resolves once and becomes final.

- [ ] **Step 2: RED clearance-cap enforcement**

A player with limited hard cap may participate only until cumulative ruleset-converted actual workload reaches the cap; subsequent selection must substitute legally or fail closed if no legal substitute exists. Full and zero-cap cases are pinned.

- [ ] **Step 3: RED atomicity test**

Deliberately trigger a late invariant failure in a test fixture after several pure play resolutions; kernel-visible world/RNG/audit remain unchanged because no partial game is committed.

- [ ] **Step 4: Implement complete-game loop**

The loop may be simple but cannot use a whole-game winner draw. Store only resolved play drafts/facts and required private trace hashes, not presentation output.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/gameResolver.test.ts packages/sim-core/test/gameMedicalUsage.test.ts packages/sim-core/test/gameResolutionAtomicity.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): resolve complete scheduled games`

---

### Task 10: In-Game D Usage Write-Back and Football-Origin Injury Composition

**Files:**
- Create: `packages/sim-core/src/footballInjuries.ts`
- Modify: `packages/sim-core/src/gameResolver.ts`
- Modify: `packages/sim-core/src/developmentFootballUsage.ts`
- Reuse/modify narrowly: `packages/sim-core/src/medicalCommands.ts`
- Modify: `packages/sim-core/src/football.ts`
- Create: `packages/sim-core/test/gameUsageWriteback.test.ts`
- Create: `packages/sim-core/test/footballInjuryIngress.test.ts`
- Create: `packages/sim-core/test/noDuplicateHealthTruth.test.ts`

**Interfaces:**

`FootballInjuryOccurrence` is an ephemeral E resolver result containing player/action/exposure refs and the exact `CreateMedicalEpisodeInput` values required by D. It is not stored as an E injury state record after composition.

`resolveFootballInjuryOccurrence(ruleset, exposure, roll): FootballInjuryOccurrence | null` owns only football occurrence/severity input derivation under explicitly synthetic rules.

During complete-game composition on the local working world, for each resolved play in canonical sequence:
1. mint the play record id and materialize its factual exposure evidence;
2. call D `applyFootballUsageEvidence` for that play before the next play so subsequent action derivation sees accumulated D readiness/fatigue and role learning;
3. for each generated injury occurrence in canonical player order, call existing `createMedicalEpisodeChange` on that progressively composed world with `sourceKind: 'football'`;
4. store resulting episode IDs as references in play/game history;
5. resolve the next play from the updated local A-D truth. If any later invariant fails, the entire local composition is discarded by kernel atomicity.

- [ ] **Step 1: RED usage truth-boundary test**

Every resolved play's participation facts reconcile exactly to evidence sent through the D ingress once; later plays can observe updated D fatigue/readiness, no E readiness/fatigue field exists, and immediate capability values remain unchanged by the ingress itself.

- [ ] **Step 2: RED injury single-truth test**

A football occurrence creates exactly one D `MedicalEpisode`, `sourceKind: 'football'`; E stores only its reference. No `football.injuries`, injury boolean/status mirror or second severity state is introduced.

- [ ] **Step 3: RED midgame consequence test**

After a created episode, a later action for that player reads updated `functionalReadiness`; if rules/clearance or legal availability removes the player, substitution follows the same game-state path.

- [ ] **Step 4: Implement composition**

No return date, prognosis or staff opinion is generated by E.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/gameUsageWriteback.test.ts packages/sim-core/test/footballInjuryIngress.test.ts packages/sim-core/test/noDuplicateHealthTruth.test.ts packages/sim-core/test/medicalState.test.ts packages/sim-core/test/readinessUsage.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): feed football workload and injuries into package d`

---
### Task 11: Football History, Statistics, and Reconciliation

**Files:**
- Expand: `packages/sim-core/src/football.ts`
- Modify: `packages/sim-core/src/gameResolver.ts`
- Create: `packages/sim-core/src/footballStats.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/footballHistory.test.ts`
- Create: `packages/sim-core/test/footballStats.test.ts`
- Create: `packages/sim-core/test/gameReconciliation.test.ts`

**Interfaces:**

Persist compact `ResolvedPlayFact` records in `football.plays` and final `GameRecord` records in `football.games`. Debug-only `PlayPrivateTrace` is not appended to `FootballWorld`; tests may retain it transiently during direct resolver calls.

Add pure `deriveGameStatistics(plays): GameStatistics` and `reconcileFinalGame(game, plays): readonly FootballReconciliationFinding[]`.

Required V1 reconciliation covers:
- final score derived from scoring play facts equals `GameRecord` score;
- every play sequence belongs to the game exactly once and is monotonic;
- possession/down/clock transitions join correctly from one play to the next;
- player/team counting stats represented by V1 sum to the ledger;
- participation/workload summaries equal play exposure facts;
- medical episode references were created by referenced plays;
- play/game plan/fixture refs exist and agree.

History retention stores facts the engine actually resolved: pre/post down-distance/clock/score, represented personnel/concepts/assignments/matchups, result, penalties/scoring, participation/exposure, and factual refs. It does not permanently store raw latent capability contributions, internal random rolls or ephemeral numeric matchup margins.

- [ ] **Step 1: RED scoring/stat reconciliation tests**

Create deliberate bad score, stat and participation summaries and prove reconciliation flags them; valid complete game returns zero errors.

- [ ] **Step 2: RED retention-boundary test**

Serialize a final `FootballWorld` and assert persisted play/game fields contain no raw capability BP, hidden readiness BP, RNG roll values or `PlayPrivateTrace` payload.

- [ ] **Step 3: Implement stats/history persistence**

Use record IDs from shared minting and update `takenRecordIds` for games/plays.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- packages/sim-core/test/footballHistory.test.ts packages/sim-core/test/footballStats.test.ts packages/sim-core/test/gameReconciliation.test.ts packages/sim-core/test/gameResolver.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): persist truthful football history`

---

### Task 12: Legitimate Staff Observations and Knowledge-Safe Football Views

**Files:**
- Create: `packages/sim-core/src/footballEvidence.ts`
- Create: `packages/sim-core/src/footballView.ts`
- Modify: `packages/sim-core/src/gameResolver.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/footballEvidence.test.ts`
- Create: `packages/sim-core/test/footballView.test.ts`
- Create: `packages/sim-core/test/footballKnowledgeBoundary.test.ts`

**Interfaces:**

`FootballObservationInput` references a real `sourcePersonId`, organization, fixture/game/play facts the person/organization may legitimately observe, observation type and represented subject. The engine itself is never a `sourcePersonId`.

Add pure/compose boundary `createFootballObservationClaims(world, inputs): { nextWorld, eventSpecs }` that appends Package B `ClaimRecord` entries only when the source person holds a relevant role/relationship to the organization and the referenced football facts are eligible for observation.

Initial organization-facing observations may express qualitative execution/assignment/result facts already observable in the ledger. They must never include raw latent capability/readiness/healing BPs, private opponent game-plan refs, hidden rolls or debug margins.

`FootballDecisionView` / history view exposes organization-legitimate football facts, held claims/beliefs, own game-plan/designation refs and public opponent facts/tendencies. It excludes rival private plans, hidden D/medical truth and private traces.

- [ ] **Step 1: RED source-person rule test**

Attempt to create an observation with a synthetic engine/system-as-person source or person outside the legitimate organizational role path; reject with no mutation.

- [ ] **Step 2: RED latent-field scrub test**

Feed a play whose private trace contains exact capability/readiness/RNG/debug margins. Generated organization claim/view remains byte-identical when only those hidden values change but the observable play fact does not.

- [ ] **Step 3: RED rival privacy test**

Organization A cannot retrieve B's private game-plan snapshot details or private held claims through the football view; public final facts remain available.

- [ ] **Step 4: Implement observation/view boundaries**

Claims use existing Package B provenance/visibility/confidence fields and canonical record IDs; do not add a second evidence store.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/footballEvidence.test.ts packages/sim-core/test/footballView.test.ts packages/sim-core/test/footballKnowledgeBoundary.test.ts packages/sim-core/test/information.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): turn football facts into legitimate evidence`

---

### Task 13: Sunday-Proof Causal Ledger

**Files:**
- Create: `packages/sim-core/src/sundayProof.ts`
- Modify: `packages/sim-core/src/football.ts`
- Modify: `packages/sim-core/src/gameResolver.ts`
- Modify: `packages/sim-core/src/commandSupport.ts`
- Create: `packages/sim-core/test/sundayProof.test.ts`
- Create: `packages/sim-core/test/sundayProofDisclosure.test.ts`

**Interfaces:**

`FootballCausalLink` stores `id`, `fixtureId`, `gameId`, `playId`, `subjectPlayerIds`, `inputRefs[]`, `consequenceRef`, `linkKind`, `recordedAt`, and `disclosureClass: 'debug_only' | 'football_fact' | 'organization_explainable'`.

Allowed `inputRefs` are references to authoritative records that actually entered the resolver path, such as decision receipts, roster memberships, game-day designations, game-plan snapshots, role-knowledge records, medical clearance/episode refs and ruleset action/concept keys. Do not copy the hidden value into the causal link merely because the record was consulted.

Add `recordCausalLinksForPlay(context): FootballCausalLink[]` during resolution-time composition and `sundayProofForOrganization(world, organizationId, gameId): OrganizationSundayProofView` for filtered explanation.

A causal link means an input participated/contributed to the represented resolution path. It must never state that one decision exclusively caused a noisy outcome unless that statement is mechanically true.

- [ ] **Step 1: RED no-post-hoc-link test**

A decision receipt/plan that did not enter designation/game-plan/action resolution cannot be attached later merely because it concerns the same player.

- [ ] **Step 2: RED upstream-chain test**

Synthetic chain proves a real receipt -> roster/designation -> game-plan/responsibility -> play action -> consequence path is linked with valid record refs.

- [ ] **Step 3: RED disclosure test**

Organization view omits debug-only links and hidden values while retaining explainable factual chain segments the organization may legitimately know.

- [ ] **Step 4: Implement causal-link construction/query**

Update record-ID accounting; narrative strings are not authoritative causal state.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/sundayProof.test.ts packages/sim-core/test/sundayProofDisclosure.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): record sunday proof at resolution time`

---

### Task 14: Fast Sim, GameCast, and Replay Projections From Identical Facts

**Files:**
- Create: `packages/sim-core/src/gameCast.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/gameCast.test.ts`
- Create: `packages/sim-core/test/fastSimEquivalence.test.ts`
- Create: `packages/sim-core/test/presentationRng.test.ts`

**Interfaces:**

Read-only functions:
- `gameCastFrames(world, gameId, organizationId?): readonly GameCastFrame[]`;
- `fastSimSummary(world, gameId): FastSimSummary`;
- `footballReplayFacts(world, gameId): readonly ResolvedPlayFact[]`.

`GameCastFrame` defaults to resolved score/time, down/distance, personnel, factual result and principal represented matchup/assignment; progressive detail may expose legitimate concept/coverage/pressure/protection/assignment facts already in the ledger or organization-facing evidence. It may not fabricate route geometry, movement coordinates or latent cause.

All three consumers are projections only: no RNG input parameter, no world mutation and no re-resolution call.

- [ ] **Step 1: RED one-ledger equivalence test**

For the same accepted game, Fast Sim final score/stats and the terminal GameCast frame equal `GameRecord`; replay facts are exactly the game's stored play IDs/order.

- [ ] **Step 2: RED no-RNG/no-mutation test**

Call every presentation projection repeatedly before/after save serialization; world fingerprint and RNG snapshot remain byte-identical.

- [ ] **Step 3: RED no-fabricated-detail test**

If a detail was not resolved/stored, GameCast omits/labels it rather than inventing it. No fake movement path or hidden capability explanation appears.

- [ ] **Step 4: Implement read-only projections**

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/gameCast.test.ts packages/sim-core/test/fastSimEquivalence.test.ts packages/sim-core/test/presentationRng.test.ts packages/sim-core/test/gameReconciliation.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `feat(core): project fast sim and gamecast from one ledger`

---

### Task 15: Football Audit, Symmetry, and Exploit Graveyard

**Files:**
- Create: `packages/sim-core/src/footballAudit.ts`
- Create: `packages/sim-core/test/footballAudit.test.ts`
- Create: `packages/sim-core/test/footballExploits.test.ts`
- Create: `packages/sim-core/test/footballSymmetry.test.ts`
- Create: `packages/sim-core/test/footballStorageMetrics.test.ts`

**Interfaces:**

`FOOTBALL_FINDING_CODES` must at minimum cover:
- `FIXTURE_FINAL_WITHOUT_GAME`
- `GAME_WITHOUT_FINAL_FIXTURE`
- `PLAY_WITHOUT_GAME`
- `ILLEGAL_PARTICIPANT`
- `UNDESIGNATED_PARTICIPANT`
- `USAGE_EXCEEDS_MEDICAL_CLEARANCE`
- `GAME_STATS_DO_NOT_RECONCILE`
- `GAME_CLOCK_STATE_INVALID`
- `DUPLICATE_GAME_RESOLUTION`
- `DUPLICATE_FOOTBALL_TRUTH`
- `FOOTBALL_INJURY_WITHOUT_MEDICAL_EPISODE`
- `FOOTBALL_USAGE_NOT_REFLECTED_IN_D`
- `CAUSAL_LINK_INPUT_NOT_USED`
- `LATENT_TRUTH_IN_ORG_EVIDENCE`
- `PRIVATE_CALL_LEAKAGE`
- `PRESENTATION_OUTCOME_DIVERGENCE` where a supplied audit bundle detects a consumer mismatch.

`auditFootballWorld(world, ruleset)` is deterministic/read-only and never repairs.

`collectFootballMetrics(world)` returns deterministic counts needed by G, including games, plays, scoring/result aggregates, participation/workload aggregates, injuries created, penalty counts, causal-link counts and serialized-byte estimates for football records. Metrics do not rebalance or modify the world.

Exploit/adversarial suite directly attacks:
- CPU/human asymmetry;
- final-call leakage;
- OVR/team-id/user-control winner injection;
- save/reload reroll shopping;
- duplicate game resolution;
- medical-cap bypass;
- inactive/illegal participant injection;
- input/insertion-order dependence;
- Fast Sim/GameCast divergence;
- presentation RNG use;
- fake causal link creation;
- latent-field evidence leakage;
- second injury/readiness/capability truth.

- [ ] **Step 1: RED every audit finding with deliberate corrupt fixtures**

- [ ] **Step 2: RED repeated adversarial sequences**

Run equivalent human/cpu fixtures and permuted canonical inputs. Outcomes/legality match when legitimate inputs match; corruption/exploit attempts are rejected or found.

- [ ] **Step 3: RED storage metrics determinism**

Repeated metric collection is byte-equivalent and reports football record counts/serialized bytes without mutating state.

- [ ] **Step 4: Implement audit/metrics only**

No silent repair, auto-balancing or calibration correction.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/sim-core/test/footballAudit.test.ts packages/sim-core/test/footballExploits.test.ts packages/sim-core/test/footballSymmetry.test.ts packages/sim-core/test/footballStorageMetrics.test.ts`

Then: `npm run ci`

Expected: PASS.

Commit: `test(package-e): add football exploit audits`

---

### Task 16: Integrated Package E Golden, Persistence, Replay, and Recovery

**Files:**
- Create: `packages/sim-core/src/packageEScenario.ts`
- Create: `packages/sim-core/src/packageEScenarioRun.ts`
- Create: `packages/sim-core/src/packageEGoldenExpected.ts`
- Modify: `packages/headless/src/cli.ts`
- Modify: `package.json`
- Create: `fixtures/golden/package-e-golden-v1.json`
- Create: `packages/sim-core/test/packageEScenario.test.ts`
- Create: `packages/sim-core/test/packageEReplayRecovery.test.ts`
- Create: `packages/sim-core/test/packageEPresentationEquivalence.test.ts`

**Scenario obligations:**

One integrated synthetic game/career slice must prove all of these in one accepted chain:
1. two legitimate organizations with distinct game-plan snapshots and game-day designations;
2. strategy/scheme/activation authority is exercised through existing proposal/receipt mechanisms;
3. `AdvanceDays` reaches game date but rejects crossing the unresolved fixture with no RNG/mutation;
4. offense/defense call selection is independently committed;
5. complete game uses the same play resolver for every scrimmage and special-teams play;
6. at least one capability/role/readiness/tactical mechanism is materially exercised without deterministic guarantee claims;
7. clock/downs/possession/scoring/penalty/substitution/special-teams state reconciles;
8. one player reaches a limited medical workload boundary and cannot legally exceed it;
9. actual participation writes into D through `applyFootballUsageEvidence` with no instant per-snap capability reward;
10. at least one football-origin injury creates a D medical episode through `createMedicalEpisodeChange` and later game state consumes the new medical truth;
11. statistics reconcile to the play ledger/final score;
12. a legitimate staff observation becomes a Package B claim without latent leakage;
13. at least one Sunday-Proof chain links real upstream decision/designation/game-plan inputs to a resolved football consequence;
14. Fast Sim/GameCast/replay projections agree on the accepted football facts and consume no RNG;
15. one rejected unauthorized/stale/duplicate E command proves no mutation/no RNG;
16. final football/acquisition/development audits return zero error findings.

**Golden assertions:**
- run scenario twice from identical seed: identical fingerprint, event-chain head, score/result, RNG state/draw count and key E/D record IDs;
- save/reload immediately before the game and at every accepted command boundary yields identical final result;
- persist -> reload -> replay through real kernel yields identical result;
- corrupt latest snapshot -> repair from history restores identical game/history and never rewrites old claims/receipts;
- resolving accepted final fixture again rejects without RNG/mutation;
- alternate legitimate game-plan/capability variant from same base changes at least one distribution/sample outcome across a synthetic repeated-trial mechanism test, not via a hidden bonus;
- accepted historical A/B/C/D golden files stay untouched while current-model versioned files match their updated expectations.

- [ ] **Step 1: Write scenario RED gate before generating expected file**

- [ ] **Step 2: Build scenario from production commands/helpers only**

No direct authoritative mutation after world creation except deliberate corruption tests. Closure-capturing scenario loops must preserve the proven Hermes-safe pattern (`forEach`/helpers rather than problematic loop closures).

- [ ] **Step 3: Generate expected Package E golden once behavior is accepted**

Add `golden:package-e:check` / `golden:package-e:write`; include E golden in `npm run ci` while retaining A-D checks.

- [ ] **Step 4: Run golden twice + persistence/replay/recovery suites**

- [ ] **Step 5: Run full CI and commit**

Commit: `test(package-e): gate authoritative football engine`

---

### Task 17: Hermes/iPhone Cross-Runtime Gate and Package E Acceptance

**Files:**
- Create: `scripts/hermes/entryPackageE.ts`
- Modify: `scripts/hermes-golden.mjs`
- Modify: `package.json`
- Modify: `apps/mobile/src/diagnostics/goldenDiagnostics.ts`
- Create: `apps/mobile/src/diagnostics/packageEJudgement.ts`
- Modify: `apps/mobile/app/diagnostics.tsx`
- Create: `apps/mobile/test/packageEDiagnostics.test.ts`
- Create: `evidence/package-e/hermes-run.txt`
- Create: `evidence/package-e/ci-windows.txt`
- Create: `evidence/package-e/clean-checkout-ci.txt`
- Create after physical run: `evidence/package-e/iphone-run.md`
- Create after all gates: `docs/release/PACKAGE_E_ACCEPTANCE.md`

**Interfaces / gates:**
- Node Package E golden run twice matches itself.
- Standalone Hermes E bundle/run twice matches Node fingerprint, event-chain head, game result/score identity, revision/event count, RNG state/draw count and selected E/D record IDs.
- Modify `scripts/hermes-golden.mjs` so a clean install auto-discovers the platform Hermes CLI shipped under `node_modules/hermes-compiler/hermesc/<platform-bin>/hermesc[.exe]`, while retaining `HERMES_CLI`/explicit-path override. The current Windows clean tree resolves `node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe`; missing/unsupported platform binaries fail clearly rather than silently skipping.
- Add `hermes:package-e:check` and include both `hermes:package-d:check` and `hermes:package-e:check` in canonical `npm run ci` after auto-discovery is proven on a clean install.
- Physical iPhone Diagnostics gets `Run Package E scenario`; direct and SQLite-backed runs must MATCH the accepted Node/Hermes result.
- Watching/reading GameCast diagnostics after resolution must not alter the identity.
- Fresh clean checkout/install of candidate commit: `npm ci` then `npm run ci` passes.
- Acceptance evidence records fresh test counts, typecheck, lint, format, all goldens, both required Hermes gates, replay/recovery and iOS export.
- Physical iPhone is a real user-action stop condition; never fabricate MATCH evidence.

- [ ] **Step 1: Write RED mobile judgement/Hermes entry tests**

- [ ] **Step 2: Run Node <-> Hermes twice and fix actual root causes of any mismatch**

Run: `npm run hermes:package-d:check && npm run hermes:package-e:check` twice from the candidate checkout.

Expected: both PASS on both runs with identical accepted identities. Never normalize or suppress a mismatch without explaining/fixing it.

- [ ] **Step 3: Run clean-checkout canonical CI**

From a fresh clone/worktree of the candidate commit run: `npm ci` then `npm run ci`.

Expected: PASS including A-E goldens, Package D/E Hermes checks and iOS export. Record exact command/output evidence.

- [ ] **Step 4: Stop for physical iPhone direct + SQLite-backed diagnostics**

Record only Owen's actual MATCH/MISMATCH result and the displayed identities.

- [ ] **Step 5: If every gate is green, write final acceptance doc, refresh current handoff, and tag**

`PACKAGE_E_ACCEPTANCE.md` maps every acceptance-contract item below to concrete evidence/tests. Refresh `docs/handoff/PROGRAMMER_HANDOFF_CURRENT.md` only now so it no longer points at Package A recovery. Tag `package-e-acceptance-20261018` (or actual acceptance date if later), push commit/tag, verify local `main` = `origin/main`, and leave the working tree clean.

Commit diagnostic fixes separately from the final acceptance-doc/handoff commit.

---

## Package E acceptance contract

Do not declare Package E accepted until all are true:

1. World model 5 adds only the authoritative `football` domain and legacy D snapshots migrate without rewriting A-D history.
2. Football rules/vocabulary fail closed, are versioned, and Package E calibration is explicitly synthetic.
3. No E-owned OVR/team-strength/capability copy exists.
4. No E-owned physiological readiness/fatigue truth exists; actual usage reaches D through the explicit D-owned ingress.
5. Actual game usage does not directly award per-snap capability-rating gains.
6. No E-owned injury/medical truth exists; football injuries create D medical episodes through the existing ingress.
7. Game-day designations require legitimate C roster state and do not rewrite C membership/status.
8. `game_day_activation` uses the established proposal/receipt/authority path; UI/player-team identity grants no shortcut.
9. Strategy/scheme execution snapshots freeze exact plan/proposal/authority references used for the game.
10. `AdvanceDays` cannot cross an unresolved scheduled-game boundary and rejected crossing consumes no RNG/mutates nothing.
11. A due scheduled game resolves exactly once through one kernel command and cannot be save/reload rerolled.
12. Progression actor kind cannot influence football calls, probabilities, participants, draw order or results.
13. Offense and defense selectors cannot inspect the opponent's final call before both commit.
14. Selectors cannot inspect rival latent capabilities/private plans/private medical truth/future RNG.
15. One pure `resolvePlay` path drives every represented play including special teams.
16. Relevant capability, exact role familiarity, readiness and tactical inputs can alter synthetic outcome distributions without guaranteeing outcomes.
17. Clock, down/distance, possession, scoring, represented penalties, substitutions/eligibility and special teams reconcile for the complete game.
18. Hard medical workload caps cannot be exceeded; legal substitutions/usage remain possible below the cap.
19. Midgame football-origin medical truth can affect later game actions through D readiness/medical queries.
20. Player/team statistics and participation/workload summaries reconcile exactly with stored play facts and final score.
21. Persistent football history contains only resolved facts needed for history/GameCast, not raw latent/debug numeric traces.
22. Organization-facing football claims have legitimate human/role sources and cannot leak latent capability/readiness/healing/RNG/private-opponent truth.
23. Sunday-Proof links reference only inputs that actually entered resolution and are recorded at resolution time.
24. Organization-facing Sunday Proof filters debug/private links and does not claim false exclusive causality.
25. Fast Sim, GameCast, replay and headless QA consume the identical accepted football ledger and never re-resolve outcomes.
26. Presentation/fast-forward consumes no gameplay RNG and cannot change world fingerprint.
27. Human and CPU organizations use the same football legality and information rules.
28. Football audit/exploit suite detects duplicate truth, leakage, reroll, illegal participation, clearance bypass, divergence and fake causality.
29. Integrated Package E scenario ends with zero football/development/acquisition error findings.
30. Persistence/save/load/replay/recovery reproduce the accepted football result through the real kernel.
31. A/B/C/D accepted historical artifacts remain untouched and independently green under intentional current-model versioning.
32. Node and Hermes agree exactly on the Package E golden identity.
33. Canonical CI includes Package E golden and required Hermes E gate (plus retained D Hermes gate per the approved design).
34. Physical iPhone direct + SQLite-backed Package E diagnostics MATCH Node/Hermes.
35. Clean-checkout `npm ci` + `npm run ci` passes and final repo/tag identity is recorded.

Passing this contract proves the football-engine/Sunday-Proof foundation. It does not claim final NFL statistical calibration, full playbook breadth, advanced 2D animation, final Command Center UX or long-horizon career certification.

## Execution discipline

- Implement Tasks 1-17 strictly in order unless a reviewer proves an interface dependency requires a plan amendment before code continues.
- At execution start, create an isolated implementation worktree/branch using the established superpowers worktree skill; never implement E directly in the accepted main checkout.
- Use RED -> GREEN for every behavior/interface change.
- Each accepted task gets targeted tests, required broader gates, one reviewable commit and push before the next task.
- Do not silently rewrite this plan to match accidental implementation behavior. Stop and amend the plan when architecture conflicts with accepted A-D reality.
- Preserve accepted failures/evidence and old golden artifacts.
- Never use `stash@{0}` as source.
- No programmer-selected real-NFL probabilities, injury rates, workload equivalences or tactical balance weights. Synthetic fixture values remain labeled synthetic until later calibration.
- Independent review is mandatory at the selector privacy boundary (Task 6), medical/readiness/usage boundary (Task 10), deterministic complete-game boundary (Task 16), and Fast Sim/GameCast/Sunday-Proof boundary (Tasks 13-15).
- Stop on hidden-truth leakage, duplicate capability/readiness/medical truth, second sim path, authority bypass, unreconciled game state/stats, save/reload reroll, unexplained Node/Hermes mismatch or physical-device mismatch.
