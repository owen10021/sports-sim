# Package B — People, Organizations, Information, Relationships, and Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** APPROVED FOR IMPLEMENTATION — Owen explicitly authorized the work on 2026-10-17.

**Authoring baseline:** `main` at `73285373c67ddaba168bafc603257a1279560913` (Package A acceptance evidence is already preserved separately by tag/backups).

**Goal:** Implement the shared human/organizational substrate so persistent people and organizations can hold different legitimate knowledge, authority, relationships, plans, and decision history, and can make coherent explainable decisions without any actor receiving hidden truth.

**Architecture:** Keep all Package B authority in the pure TypeScript `packages/sim-core` world. Add explicit domain records for people, organizations, authority, information, relationships, plans, and decisions; mutate them only through the existing `WorldKernel` command path. Keep CPU reasoning behind knowledge-filtered views so a reasoner never receives the raw authoritative world. Package C must be able to add roster/contracts/markets/scouting/draft by plugging into these contracts rather than creating parallel authority, knowledge, or decision systems.

**Tech Stack:** Existing Package A stack only: strict TypeScript, Vitest, deterministic canonical serialization/hashing, `WorldKernel`, existing persistence/replay contracts, Node headless QA, Expo/Hermes runtime verification. Add no runtime dependency unless a task proves it is necessary.

**Spec basis:** Approved/frozen `Sport Sim App — Architecture & Product Design Specification` (especially Sections 4–7, 11–13, 17–20, and 23); `Sport_Sim_Build_Sequence_and_Decision_Core_Spec_v0_1.md` (Sections 5–15); `SPORT_SIM_PROJECT_BRAIN.md`. The exact 66,400-byte Windows architecture file is still a preservation artifact issue; this plan was derived from the preserved 1,657-line Library copy and does not claim that byte-exact Windows-file gap is closed.

## Global Constraints

- One authoritative `FootballWorld`; only `WorldKernel` commits authoritative football reality.
- Human, CPU, delegated, commissioner, system, and test actors use the same command/validation path.
- Ordinary actors never receive hidden player/world truth merely because they are CPU-controlled.
- Historical claims, beliefs, proposals, approvals, plans, and receipts are immutable as-of records; later knowledge links forward instead of rewriting history.
- Explicit decision rights are: `propose`, `advise`, `approve`, `veto`, `execute`, `communicate`. One right never implies another.
- Authority is scoped by organization, decision category, role/person, effective interval, and revision.
- A mandate can narrow existing transferable authority; it can never manufacture authority. No subdelegation in Package B.
- Staff departure/role end invalidates future use of role-bound grants/mandates without deleting historical records.
- Relationship state is multidimensional; do not add one universal friendship/loyalty/morale score.
- Confidence is confidence in evidence/belief, not a disguised probability that a hidden rating is correct.
- Plans represent intended futures, contingencies, triggers, constraints, fallbacks, and basis evidence; plan changes require causes rather than silent rewrites.
- CPU reasoning accepts a knowledge-filtered organizational view, never the raw `FootballWorld`.
- Rejected/stale/duplicate/unauthorized commands change no authoritative state and consume no RNG.
- Presentation/read models remain non-authoritative and disposable.
- `packages/sim-core` stays free of React, React Native, Expo, SQLite, filesystem, wall-clock, and network imports.
- Package B does **not** implement player ability, contracts/cap, trades, free agency, scouting mechanics, draft mechanics, development, medical, football gameplay, or polished Command Center UI.
- Package A acceptance evidence/tag/backups remain immutable. Main may intentionally evolve fingerprints only through an explicit versioned world-model change with migration tests.
- Every accepted task ends with targeted tests, full core tests/typecheck, a reviewable commit, and push to `main` (or the programmer's approved integration branch) before the next task.

## Review Focus

1. **Authority changes while work is pending:** approvals, mandates, or proposals created under revoked/expired authority must be revalidated and may not become permanent permission tokens. Pin with DC-04/DC-13 style tests.
2. **Indirect information leaks:** filtered views, reasoning traces, recommendations, search/read projections, and relationship access must not expose rival/private claims. Pin with a DC-12 style test.
3. **Hindsight mutation:** a later contradictory claim/belief may supersede an earlier belief but may not modify the earlier record or receipts that cited it. Pin with DC-17.
4. **World-model evolution:** Package A snapshots must either migrate deterministically to the Package B model or fail closed; never accept a structurally incomplete old world as current. Migration must consume no RNG and create no in-universe event.
5. **Coherent-but-different organizations:** two organizations seeing the same public world plus different legitimate private evidence/plans must be able to reach different decisions with traces that cite only what each was allowed to know.

---

### Task 1: Refactor Kernel Dispatch Without Changing Package A Behavior

**Files:**
- Create: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/kernel.ts`
- Modify: `packages/sim-core/src/audit.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/commandRouter.test.ts`
- Existing regression: all Package A tests/golden scenario

**Interfaces:**
- Produce `EventSpec { type: string; payload: CanonicalValue }`.
- Produce `CommandResolution { nextWorld: FootballWorld; eventSpecs: readonly EventSpec[]; detail: string }`.
- Produce a static/exhaustive `routeCommand(...)` function; do **not** use runtime plugin registration or unordered handler maps as authoritative dispatch.
- `WorldKernel` remains responsible for envelope validation, duplicate/stale detection, final commit, event IDs/hashes, audit-chain update, known command IDs, and all-or-nothing state replacement.
- One accepted command increments world revision exactly once even when it emits multiple events; events from that command share that revision and are chained in deterministic array order.

- [ ] Write RED tests proving a routed command can return two event specs and the kernel commits both at one revision, increments `nextIds.event` by two, and leaves everything unchanged when `beforeCommit` throws.
- [ ] Refactor `AdvanceDays` into the static router without changing its payload semantics, RNG draws, event body, fingerprint, or chain head.
- [ ] Run `npm run golden:check` and the full Package A suite; the pre-Package-B golden must still match byte-for-byte after this task.
- [ ] Run `npm run typecheck && npm test`.
- [ ] Commit: `refactor(core): make world kernel command routing extensible`.

### Task 2: Version the World Model and Add Empty Domain State Safely

**Files:**
- Create: `packages/sim-core/src/worldModel.ts`
- Create: `packages/sim-core/src/people.ts`
- Create: `packages/sim-core/src/organizations.ts`
- Create: `packages/sim-core/src/authority.ts`
- Create: `packages/sim-core/src/information.ts`
- Create: `packages/sim-core/src/relationships.ts`
- Create: `packages/sim-core/src/plans.ts`
- Create: `packages/sim-core/src/decisions.ts`
- Modify: `packages/sim-core/src/ids.ts`
- Modify: `packages/sim-core/src/world.ts`
- Modify: `packages/sim-core/src/persistence.ts`
- Modify: `packages/sim-core/src/kernel.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/worldModelV2.test.ts`
- Test: `packages/sim-core/test/legacyWorldMigration.test.ts`
- Fixture: `fixtures/legacy/package-a-world-v1-snapshot.json`

**Interfaces:**
- Add branded `RecordId` plus `recordId(value: string): RecordId`.
- Add `WORLD_MODEL_VERSION = 2` independently of the existing manifest/persistence schema version.
- `FootballWorld` gains `worldModelVersion: 2`, `nextIds.record`, and authoritative domain state fields: `people`, `organizations`, `authority`, `information`, `relationships`, `plans`, `decisions`.
- Each domain file initially defines its record/state interfaces plus an `empty*State()` constructor; later tasks add behavior.
- Freeze a genuine Package A v1 snapshot fixture before changing current fingerprint semantics.
- Produce `isLegacyPackageAWorld(value)` and `migrateLegacyPackageAWorld(world)`; migration adds empty Package B domain state deterministically, changes no sim date/revision/RNG/entity identity, consumes no RNG, and emits no football event.
- Snapshot verification must recognize and validate the legacy fixture with legacy fingerprint semantics before migration; a future unknown `worldModelVersion` fails closed.

- [ ] Freeze and hash the Package A v1 snapshot fixture before changing `FootballWorld`.
- [ ] Write RED tests for current-model creation, deterministic empty-domain ordering, legacy v1 migration, future-model rejection, and migration preserving `worldId`, revision, RNG, event count, chain head, and committed command IDs.
- [ ] Implement current world-model validation/migration and route `WorldKernel.resume`/career loading through it.
- [ ] Intentionally version the golden scenario after the world representation changes; preserve the old expected values in evidence instead of overwriting Package A history.
- [ ] Run `npm run typecheck && npm test && npm run golden:check` with the explicitly updated current-model golden.
- [ ] Commit: `feat(core): version world model for organization substrate`.

### Task 3: Seed Persistent People, Organizations, Roles, and Initial Authority

**Files:**
- Modify: `packages/sim-core/src/seed.ts`
- Modify: `packages/sim-core/src/people.ts`
- Modify: `packages/sim-core/src/organizations.ts`
- Modify: `packages/sim-core/src/authority.ts`
- Modify: `packages/sim-core/src/world.ts`
- Create: `fixtures/seeds/synthetic-org-substrate-v1.json`
- Test: `packages/sim-core/test/organizationSeed.test.ts`

**Interfaces:**
- Generic seed `initialEntities` remains the stable identity registry; person/organization domain records reference those entity IDs rather than duplicating names as a second source of truth.
- Add optional seed block `organizationSubstrate` containing `roleEpisodes` and `authorityGrants`; existing Package A seeds remain structurally valid when the block is absent.
- `PersonRole`: `owner | general_manager | head_coach | offensive_coordinator | defensive_coordinator | scout | personnel_executive | cap_executive | medical_lead | agent | player | other`.
- `PersonRecord { entityId, active }`.
- `OrganizationRecord { entityId, active }`.
- `RoleEpisode { id, personId, organizationId, role, title, startDate, endDate }`.
- `DecisionRight`: `propose | advise | approve | veto | execute | communicate`.
- `DecisionCategory` initially includes `organizational_authority`, `staff_role`, `organizational_plan`, plus reserved future categories required by the frozen architecture (`acquisition`, `contract`, `roster`, `game_day_activation`, `medical_clearance`, `workload_usage`, `major_trade`, `staff_hiring`, `scheme`). Reserved categories have no Package B transaction implementation.
- `AuthorityGrant { id, personId, organizationId, category, rights, transferable, effectiveFrom, effectiveUntil, sourcePersonId, revision }`.

- [ ] Write RED validation tests for wrong entity kind, missing person/org references, duplicate role/grant IDs, overlapping duplicate active role episodes, invalid dates, and rights outside the enum.
- [ ] Write a GREEN-path seed test with two organizations and at least owner/GM/scout roles per organization.
- [ ] Implement canonical sorting by stable IDs before state enters `FootballWorld`.
- [ ] Prove same seed + same world ID source yields identical Package B state/fingerprint.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): seed persistent organizations roles and authority`.

### Task 4: Role Transitions, Authority Revisions, Mandates, and Protected Constraints

**Files:**
- Modify: `packages/sim-core/src/people.ts`
- Modify: `packages/sim-core/src/authority.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/kernel.ts`
- Test: `packages/sim-core/test/authority.test.ts`

**Interfaces:**
- Commands: `StartRoleEpisode`, `EndRoleEpisode`, `GrantAuthority`, `RevokeAuthority`, `CreateMandate`, `RevokeMandate`, `CreateProtectedConstraint`, `AmendProtectedConstraint`.
- `Mandate { id, organizationId, delegatorPersonId, delegatePersonId, category, scope, hardConstraints, preferences, allowedRights, fallback, escalationRules, effectiveFrom, effectiveUntil, revision, active }`.
- `ProtectedConstraint { id, organizationId, subject, prohibitedChange, originRecordId, effectiveFrom, effectiveUntil, amendableByPersonIds, revision, active }`.
- Effective delegated permission is the intersection of current delegator transferable rights, delegate role/grants, mandate rights/scope, protections, and domain legality. Package B forbids subdelegation.
- Role end must make role-bound grants/mandates ineffective for future commands while preserving the historical records.

- [ ] Write RED DC-01-style partial-rights test: a scout with `advise/propose` cannot execute a synthetic organization mutation; no world/RNG/audit change.
- [ ] Write RED DC-04 test: revoke an applicable grant after approval context is created; later execution sees current authority and fails.
- [ ] Write RED DC-05 boundary test using 100 synthetic units vs 101, with explicit unit/scope metadata; exact limit passes the authority/mandate check and 101 escalates/rejects.
- [ ] Write RED DC-06 protected-constraint test and DC-13 role-departure test.
- [ ] Implement interval/revision helpers: `activeRightsAt(...)`, `validateMandateAt(...)`, and `isProtectedAt(...)`; these are pure and receive logical `SimDate`, never wall clock.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): enforce role authority and delegation boundaries`.

### Task 5: Claims, Evidence, Beliefs, Provenance, and Knowledge-Safe Views

**Files:**
- Modify: `packages/sim-core/src/information.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Create: `packages/sim-core/src/knowledgeView.ts`
- Test: `packages/sim-core/test/information.test.ts`
- Test: `packages/sim-core/test/knowledgeView.test.ts`

**Interfaces:**
- `ClaimVisibility = public | organization | restricted`.
- `ConfidenceBand = very_low | low | medium | high | very_high`; never expose it as hidden-truth accuracy.
- `SubjectRef { kind: 'entity' | 'plan' | 'proposal' | 'world'; id: string }`.
- `ClaimRecord { id, subject, propositionType, proposition, sourcePersonId, sourceFamilyId, observedAt, acquiredAt, visibility, holderOrganizationIds, confidence, possibleBias, corroboratesClaimIds, contradictsClaimIds }`.
- `BeliefRecord { id, organizationId, authorPersonId, subject, assessmentType, assessment, confidence, evidenceClaimIds, formedAt, supersedesBeliefId }`.
- Commands: `RecordClaim`, `ShareClaim`, `FormBelief`.
- `buildOrganizationKnowledgeView(world, organizationId, actorPersonId)` returns only legitimate claims/beliefs plus their provenance; it never returns raw world state or another organization's private records.
- A later belief supersedes by link; old belief bytes never change.

- [ ] Write RED provenance/access tests, including source-family preservation and invalid evidence reference rejection.
- [ ] Write RED DC-12 test: a rival-only private claim changes and the other organization receives no fact-revealing view/reason/badge data.
- [ ] Write RED DC-17 test: later contradictory evidence creates a new linked belief while the original belief and any receipt reference remain byte-identical.
- [ ] Write test proving `ShareClaim` requires legitimate claim access plus `communicate` right and cannot upgrade `restricted` visibility by accident.
- [ ] Implement knowledge filtering in one shared function used by human-facing and CPU reasoning inputs.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add provenance-safe organizational knowledge`.

### Task 6: Causal Multidimensional Relationships

**Files:**
- Modify: `packages/sim-core/src/relationships.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Test: `packages/sim-core/test/relationships.test.ts`

**Interfaces:**
- `RelationshipPartyRef { kind: 'person' | 'organization'; entityId: EntityId }`.
- Dimensions are separate: trust, professional respect, familiarity, alignment, access, current tension. Do not add an aggregate relationship score.
- Use categorical levels rather than pretending early arbitrary numbers are calibrated; current levels plus append-only effect records are authoritative.
- `RelationshipEffect { id, relationshipId, causeType, causeId, occurredAt, changes }`.
- Command `RecordRelationshipEffect` is permitted only for `system`, `commissioner`, `test_harness`, or a future domain resolver explicitly exercising authorized relationship effects; ordinary UI actors cannot directly farm relationship values.
- Relationship access may create communication opportunity later, but never grants hidden truth or automatic ownership of a claim.

- [ ] Write RED tests for canonical party ordering, duplicate-edge prevention, independent dimensions, causal effect history, and no implicit claim visibility from high access.
- [ ] Write test that repeating a browsing/comparison action produces no relationship effect (DC-14 principle).
- [ ] Implement deterministic edge/effect ordering and immutable effect history.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add causal multidimensional relationships`.

### Task 7: Proposal, Approval, and Decision-Receipt Substrate

**Files:**
- Modify: `packages/sim-core/src/decisions.ts`
- Modify: `packages/sim-core/src/authority.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Test: `packages/sim-core/test/decisionStateMachine.test.ts`

**Interfaces:**
- `ProposalState = draft | submitted | awaiting_approval | authorized | committed | rejected | withdrawn | expired`.
- `ProposalRecord { id, revision, organizationId, authorPersonId, category, subjects, termsType, terms, termsHash, relevantWorldRevision, requiredApproverPersonIds, expiresAt, contingencies, state, createdAt, supersedesRevision }`.
- `ApprovalRecord { id, proposalId, proposalRevision, approverPersonId, right, authorityGrantId, termsHash, decidedAt, active }`.
- `DecisionReceipt { id, proposalId, proposalRevision, commandId, actorPersonId, authorityGrantIds, evidenceClaimIds, beliefIds, approvalIds, mandateId, executedTermsHash, committedAt, outcomeEventIds, originalRationale }`.
- Generic commands may submit/revise/approve/veto/withdraw/expire proposals. Generic decision code may **not** apply an arbitrary domain mutation; committing a real action is owned by the domain adapter (Task 8 is the first one).
- Approval binds exact proposal revision + material terms hash. A material revision invalidates incompatible approvals without deleting them.

- [ ] Write RED DC-02 joint-approval, DC-03 material-revision, DC-04 revoked-grant, DC-07 retry, and DC-09 exclusive-deadline tests using the synthetic `organizational_plan` category.
- [ ] Prove direct `Submitted -> Authorized` when current rights make extra approval unnecessary; do not create approval ceremony for its own sake.
- [ ] Prove terminal proposal attempts are preserved and revisions link instead of overwriting.
- [ ] Prove no generic `CommitProposal` escape hatch can mutate arbitrary world fields.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add auditable decision authorization substrate`.

### Task 8: Organizational Plans as the First Real Decision-Domain Integration

**Files:**
- Modify: `packages/sim-core/src/plans.ts`
- Modify: `packages/sim-core/src/decisions.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Test: `packages/sim-core/test/plans.test.ts`
- Test: `packages/sim-core/test/planDecisionIntegration.test.ts`

**Interfaces:**
- `PlanKind = strategy | roster_group | succession | acquisition | staff` (only `strategy` is fully exercised in Package B; others are structural hooks for later packages).
- `PlanStatus = active | superseded | closed`.
- `PlanObjective { key, priority: 'low'|'medium'|'high'|'critical', target: CanonicalValue }`.
- `PlanConstraint { key, kind: 'hard'|'preference', value: CanonicalValue }`.
- `PlanTrigger { kind: 'date'|'claim'|'event'|'manual_review', refId, note }`.
- `PlanRevision { revision, ownerPersonId, effectiveAt, horizon, objectives, constraints, triggerRefs, fallbackPlanIds, basisBeliefIds, changeReasonRefs }`.
- `OrganizationPlan { id, organizationId, kind, scopeKey, status, currentRevision, revisions }`.
- Command `CommitPlanProposal` accepts only an `authorized` proposal with `termsType = 'organization_plan_v1'`; it revalidates current authority, exact proposal revision/terms hash, evidence access, mandate/protections, and relevant state immediately before commit.
- One atomic command updates the plan, proposal state, receipt, and associated events; no partial plan/receipt commit is possible.

- [ ] Write RED tests for plan creation, revision, fallback link integrity, belief-basis accessibility, and hard-vs-preference distinction.
- [ ] Write RED plan-inertia test: reversing an active plan in the same scope requires at least one `changeReasonRef`; absent cause is rejected/flagged rather than silently rewritten.
- [ ] Write RED atomicity test with fault injection after resolution: plan, proposal, receipt, events, RNG, and revision all remain at the pre-command state.
- [ ] Prove a receipt preserves the exact belief IDs and proposal revision that existed at commitment even after later plan/belief updates.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): commit organizational plans through decision receipts`.

### Task 9: Knowledge-Safe CPU Reasoning Interfaces and Organization Coherence Audit

**Files:**
- Create: `packages/sim-core/src/reasoning.ts`
- Create: `packages/sim-core/src/coherenceAudit.ts`
- Create: `packages/sim-core/test/support/referenceOrganizationReasoner.ts`
- Test: `packages/sim-core/test/reasoning.test.ts`
- Test: `packages/sim-core/test/coherenceAudit.test.ts`

**Interfaces:**
- `OrganizationDecisionView` contains only organization-visible claims/beliefs, current plans, relevant relationships, active authority/mandates, public world facts required by the request, and stable IDs. It does not expose `FootballWorld` itself.
- `ReasoningRequest { organizationId, actorPersonId, category, optionIds, deadline }`.
- `ReasoningTrace { organizationId, actorPersonId, category, goalPlanIds, beliefIds, claimIds, authorityGrantIds, consideredOptionIds, rejectedOptions, uncertainties }`.
- `OrganizationRecommendation { selectedOptionId: string | null, rationale, trace }`.
- `OrganizationReasoner` is an interface over `OrganizationDecisionView`; production domains may supply policies later. A deterministic **test-only** reference reasoner proves the interface without freezing a fake universal football-value formula into production.
- `CoherenceFinding` is QA/read-only. `auditOrganizationCoherence(world, organizationId)` may flag unexplained plan reversals, active mandates tied to ended roles, decisions that violate hard active plan constraints, or missing reasoning/receipt references. It never auto-repairs authoritative state.

- [ ] Write RED compile/runtime test proving a reasoner receives no raw-world/hidden-truth field.
- [ ] Write two-organization scenario: same public situation, different legitimate private claims + active plans -> different recommendations; each trace cites only records visible to that organization.
- [ ] Write DC-19 symmetry test: human and CPU actor with identical role/grants/view receive the same legal option set; actor kind alone creates no exception.
- [ ] Write coherence-audit tests for an unexplained plan reversal and a stale mandate after role end; findings are deterministic and non-mutating.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add knowledge-safe organizational reasoning interfaces`.

### Task 10: Integrated Package B Golden Scenario, Persistence, and Replay

**Files:**
- Create: `packages/sim-core/src/packageBScenario.ts`
- Create: `packages/sim-core/test/packageBScenario.test.ts`
- Modify: `packages/headless/src/bin.ts`
- Modify: `packages/sim-core/src/goldenExpected.ts` or create a separate `packageBGoldenExpected.ts`
- Test: persistence/replay/recovery suites

**Interfaces / scenario:**
- Synthetic seed has two organizations with owner/GM/scout roles and explicit grants.
- Both organizations observe the same public fact; each receives a different legitimate private claim from its own scout.
- Each forms a belief and an organizational strategy plan through the real decision/approval/commit path.
- A later contradictory claim causes one organization to form a new superseding belief and revise its plan with an explicit cause; original belief/receipt remain unchanged.
- Revoke one GM's relevant execute right and prove a pending/stale execution fails with no mutation/RNG draw.
- End a delegate role and prove its mandate is no longer effective while history remains.
- Save, reload, replay from persisted history, and require exact final fingerprint + event-chain head equality.

- [ ] Write the integrated scenario test RED before implementation glue.
- [ ] Run the scenario uninterrupted and with save/reload inserted at multiple command boundaries; all final fingerprints/heads must match.
- [ ] Corrupt the latest snapshot and prove existing recovery/replay logic restores the same Package B result without rewriting claim/belief/decision history.
- [ ] Add headless command `package-b-golden` (or an equivalent versioned scenario selector) that prints final fingerprint, event-chain head, revision, event count, and key record IDs.
- [ ] Run `npm run typecheck && npm test`.
- [ ] Commit: `test(package-b): add organization divergence golden scenario`.

### Task 11: Cross-Runtime Package B Gate, Diagnostics, and Release Evidence

**Files:**
- Modify: root `package.json` scripts as needed
- Modify: `.github/workflows/package-a-ci.yml` (rename/generalize only if that improves truthfulness; do not break Package A tag history)
- Modify: `apps/mobile/src/diagnostics/goldenDiagnostics.ts`
- Modify: `apps/mobile/app/diagnostics.tsx`
- Create: `docs/release/PACKAGE_B_ACCEPTANCE.md`
- Evidence: `evidence/package-b/**`

**Acceptance:**
- Node and standalone Hermes run the exact same Package B scenario and produce byte-identical final fingerprint + event-chain head.
- The mobile Diagnostics screen can run the same Package B scenario using production `sim-core`; physical iPhone result must match before Package B is stamped accepted.
- `npm run ci` passes from a clean checkout, including lint, format check, all tests, current golden checks, and `expo export --platform ios`.
- No React/React Native/Expo/SQLite/fs/network/wall-clock import has entered `packages/sim-core`.
- Save/reload/replay/recovery preserve Package B state and historical knowledge exactly.
- The two-organization divergence test proves different decisions arise from legitimate differences in evidence/plans, not hidden truth or actor identity.
- All DC cases that Package B owns are mapped in `PACKAGE_B_ACCEPTANCE.md`; cases intentionally owned by later packages are listed explicitly rather than silently marked complete.

- [ ] Run full Windows CI-equivalent suite fresh and capture output.
- [ ] Run Package B golden on Node twice and standalone Hermes twice; compare exact outputs.
- [ ] Run the Package B diagnostic on the physical iPhone and record MATCH/MATCH evidence.
- [ ] Inspect `git diff`, `git status`, and dependency tree; no unreviewed generated files or hidden runtime dependencies.
- [ ] Record final accepted commit SHA and create a Package B milestone tag only after every Package B gate above is green.
- [ ] Create `git bundle`, source archive, and SHA-256 manifest; preserve at least one off-PC copy before beginning Package C.
- [ ] Commit: `test(package-b): gate organizational substrate`.

---

## Package B Acceptance Contract

Package B is complete only when fresh evidence demonstrates all of the following:

1. Persistent people survive role changes without identity replacement.
2. Role/authority intervals are explicit; revoked/expired rights cannot authorize new execution.
3. Delegation only narrows legitimate transferable authority and cannot subdelegate in this package.
4. Organizations can possess different legitimate claims/beliefs about the same subject; no ordinary actor or CPU path receives hidden truth.
5. Claims retain provenance/source family/access/time; historical beliefs remain immutable when new evidence arrives.
6. Relationship state is causal and multidimensional with no universal relationship meter or browsing-farm path.
7. Organizational plans preserve revisions, constraints, fallbacks, basis evidence, and explicit causes for meaningful reversals.
8. Proposal/approval semantics bind exact revisions/material terms; authority changes force revalidation; generic decision infrastructure cannot mutate arbitrary domains.
9. A committed plan decision atomically produces plan state + decision receipt + events through `WorldKernel` only.
10. Human and CPU actors with the same legitimate rights/view receive the same legal option set; actor identity alone grants no exception.
11. Two organizations can make different coherent recommendations from different legitimate evidence/plans, and their reasoning traces cite only permitted records.
12. Save/load/replay/recovery reproduce exact Package B authoritative state and historical evidence.
13. Current Package B golden output is identical on Node, standalone Hermes, and the physical iPhone diagnostic.
14. Clean-checkout CI, lint, format, tests, golden checks, and iOS export all pass.
15. Package A acceptance evidence remains preserved and the current world-model evolution is explicit, versioned, and tested.

## Explicitly Out of Scope for Package B

Do not smuggle Package C–G work into this plan. Specifically out of scope: player football ability/potential implementation; roster rights/status; contract/cap accounting; trade valuation/market; agents beyond identity/relationship hooks; scouting assignment/evaluation mechanics beyond generic claims/beliefs; draft order/boards/live draft; development/practice/medical; play-level football engine; Sunday Proof/GameCast; full staff hiring market; owner firing/job market; Command Center/search/alerts/onboarding polish; real NFL dataset ingestion; optional LLM prose; cloud/account features.

## Handoff to Package C

Package C may begin only after Package B acceptance. It must consume:

- persistent person/organization/role IDs;
- authority grants/mandates/protections;
- knowledge-filtered claims/beliefs/provenance;
- relationship/network hooks;
- organization plans and plan revisions;
- proposal/approval/receipt contracts;
- knowledge-safe reasoning/audit interfaces;
- the same WorldKernel/persistence/replay path.

Package C must not create a second scouting truth store, a second trade/decision approval system, a universal organization opinion, or a CPU-only shortcut around these interfaces.
