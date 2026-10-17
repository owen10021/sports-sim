# Package C — Roster, Contracts, Markets, Scouting, and Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** PLAN FOR REVIEW — do not implement until Owen approves this written plan. Even after approval, Task 1 is blocked until Package B's physical-iPhone gate is green and Package B has been accepted/tagged.

**Authoring baseline:** Package B automated-gate head `155df37c4b8a4f7a338a899158d47579d807f0a2`; Package C design-basis commit `314652f88e1da440a3f5994219e4bf59b9588bb2`. Package B currently has one open acceptance gate: physical iPhone Diagnostics → Run Package B scenario → MATCH/MATCH.

**Goal:** Implement the first substantively real GM acquisition ecology: player/roster rights, basic contract/cap mechanics, contextual trade and free-agent markets, persistent agents, value-of-information scouting, organizational draft boards, draft assets/order, and live draft transactions, all through Package B authority/knowledge/decision infrastructure.

**Architecture:** Extend the single pure-TypeScript `FootballWorld` with focused Roster & Player, Market & Contract, and Draft & Scouting state. Every actual acquisition/contract/roster/draft mutation routes through the existing static `WorldKernel` command boundary and Package B authority/proposal/receipt contracts. Organizational and CPU market reasoning consumes knowledge-filtered views only; player/agent resolution may use the player's own legitimate private preferences but never leaks those preferences or rival maxima to another organization. League-specific transaction mechanics live in an explicit ruleset-owned Package C profile; acceptance uses synthetic integer economics rather than pretending unresolved NFL calibration is known.

**Tech Stack:** Existing Package A/B stack only: strict TypeScript, Vitest, deterministic canonical hashing/serialization, `WorldKernel`, Package B knowledge/authority/decision/reasoning substrate, existing persistence/replay/recovery, Node headless QA, standalone Hermes verification, Expo/Expo SQLite physical-device diagnostics. Add no runtime dependency unless the plan is explicitly amended.

**Spec:** `docs/handoff/canonical/Sport_Sim_Package_C_Design_Basis_2026-10-17.md`, derived from the already-approved frozen architecture and project brain. Read that file before this plan.

## Global Constraints

- Package B must be accepted/tagged before Package C product code begins. Preparing/reviewing this plan does not waive that gate.
- One authoritative `FootballWorld`; only `WorldKernel` commits authoritative reality.
- Human, CPU, delegated, commissioner, system, and test actors use the same transaction legality and knowledge rules.
- Ordinary organizations/actors never receive hidden player capability truth, rival private beliefs, rival boards, client private preferences, or opponent maximum willingness to pay.
- No universal OVR, fixed-destiny potential, universal trade-value number, hidden offer-score minigame, or oracle trade finder.
- Scouting reveal and player development are separate. Package C does not implement progression, practice, opportunity, medical/readiness evolution, or scheme learning; those belong to Package D.
- Package C may establish baseline player football-capability/role state required by roster/scouting/draft, but no Package C decision policy may read that latent capability state directly.
- Draft, trade, contract, free agency, roster rights, agents, cap, and draft assets form one acquisition ecology and must conserve shared resources coherently.
- Every actual transaction revalidates authority, approvals, current terms, deadlines, ownership, cap/resources, roster rights/capacity, and protected constraints immediately before commit.
- A trade, contract execution/termination, offer acceptance, draft selection, or roster-rights transfer is all-or-nothing. Rejection/fault leaves authoritative world, RNG, chain, assets, obligations, and rights unchanged.
- Repeating an already accepted command ID is idempotent under the kernel. Repeating an unchanged external offer may return its recorded response/state but must not reroll willingness.
- Market resolution uses logical league time. Human UI ordering, wall-clock speed, renderer timing, or device performance are never tie-breakers.
- `LeagueRuleset` owns league-specific transaction mechanics. Package C acceptance uses an explicit synthetic transaction profile; synthetic values are test boundaries, not claims about current NFL rules/economics.
- Money/cap values use non-negative safe integers in a ruleset-declared unit. No authoritative floating-point money.
- Future picks retain uncertainty/optionality/time preference; no hardcoded pick-value chart is authoritative.
- Agent relationships may alter communication/access/credibility, never magic discounts or hidden information access.
- Historical claims, beliefs, proposals, approvals, market communications, agreements, and decision receipts remain immutable as-of records; later revisions link forward.
- Package B's knowledge filter remains the only organization-facing evidence boundary. Scouting/market modules plug into it rather than creating a second truth store.
- Package B plans/decision receipts remain the transaction authorization substrate. Package C does not create a parallel approval system.
- Derived cap summaries, trade-interest summaries, roster read models, draft views, and market comparisons are rebuildable; they are not second authoritative truth.
- `packages/sim-core` stays free of React, React Native, Expo, SQLite, filesystem, wall clock, and network imports.
- Package C does **not** implement Package D development/practice/medical/opportunity, Package E football resolution, or Package F polished Command Center UX.
- Preserve Package A and Package B accepted tags/evidence/goldens. World-model evolution is explicit, migrated, and tested rather than silently mutating old accepted fixtures.
- Each accepted task uses RED → GREEN where applicable, runs its targeted tests plus full typecheck/tests, gets one reviewable commit, and is pushed before the next task.

## Review Focus

1. **Private-information leakage:** scouting, trade discovery, agent communication, board construction, reasoning traces, and market summaries must never reveal latent ability, rival private boards/beliefs, client private preferences, or counterpart maxima. Every owning task includes an explicit no-leak test.
2. **Double-spend / double-ownership:** simultaneous offers, trades, draft-pick movement, contract commitments, and roster-rights transfers must not commit the same money/asset/right twice. Owning tasks test conflicting commitments and atomic rollback.
3. **Stale/replayed market actions:** expired offers, old proposal revisions, changed authority, changed cap/roster state, and repeated unchanged offers must fail/reuse prior state predictably rather than reroll or partially commit.
4. **Universal-value drift:** no helper, debug API, fixture convenience, or UI-facing record may become an authoritative player/pick/trade score. Contextual decisions must be explainable from organization knowledge/plans and may rationally differ.
5. **Migration/replay integrity:** Package B v2 saves must migrate deterministically to the Package C world model without RNG/events, while Package C save/reload/replay/recovery reproduces the exact same transaction history and authoritative state.

---

### Task 1: Freeze Accepted Package B and Version the World Model for Package C

**Precondition:** Package B physical-iPhone Diagnostics is MATCH/MATCH, acceptance evidence is committed, Package B milestone tag exists, and the accepted Package B commit SHA is known. Do not substitute `155df37` if acceptance moves after the iPhone run.

**Files:**
- Create: `fixtures/legacy/package-b-world-v2-snapshot.json`
- Modify: `fixtures/legacy/SHA256SUMS.txt`
- Create: `evidence/package-b/golden-expected-world-model-v2.json`
- Create: `packages/sim-core/src/roster.ts`
- Create: `packages/sim-core/src/contracts.ts`
- Create: `packages/sim-core/src/market.ts`
- Create: `packages/sim-core/src/scouting.ts`
- Create: `packages/sim-core/src/draft.ts`
- Modify: `packages/sim-core/src/worldModel.ts`
- Modify: `packages/sim-core/src/world.ts`
- Modify: `packages/sim-core/src/persistence.ts`
- Modify: `packages/sim-core/src/replay.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/worldModelV3.test.ts`
- Test: `packages/sim-core/test/packageBWorldMigration.test.ts`

**Interfaces:**
- Freeze the final **accepted** Package B current-model world bytes before changing `FootballWorld`.
- Set `WORLD_MODEL_VERSION = 3`.
- `FootballWorld` gains authoritative states: `roster`, `contracts`, `market`, `scouting`, `draft`.
- Initial empty state shapes:
  - `RosterState { players, rights, memberships }`
  - `ContractsState { agreements, terminations }`
  - `MarketState { agentClients, playerPreferences, inquiries, tradeOffers, contractOffers, reservations }`
  - `ScoutingState { evaluatorProfiles, questions, evidenceSamples, assignments }`
  - `DraftState { classes, picks, boards, sessions }`
- Produce `isPackageBWorldModelV2(value)`, `migratePackageBWorldModelV2(world)`, and update `requireCurrentWorld` to accept current v3, migrate genuine Package B v2, continue supporting genuine Package A v1 through the existing path, and fail closed on future/structurally incomplete worlds.
- Migration adds empty Package C states only; it changes no `worldId`, sim date, revision, RNG state, event counter, record counter, entities, Package B domain bytes, event history, or command history; it emits no in-universe event and consumes no RNG.

- [ ] Freeze the accepted Package B v2 world fixture and SHA-256 manifest before editing `FootballWorld`; record accepted Package B golden values separately and never overwrite them.
- [ ] Write RED tests proving v2 → v3 migration preserves every pre-C field byte-for-byte after canonicalization, creates only empty Package C domains, consumes no RNG/events, and rejects future model versions.
- [ ] Implement the empty domain interfaces and migration boundary.
- [ ] Route snapshot verification, resume, and replay through the same current-world requirement; no path may accept a structurally partial v3 world.
- [ ] Run Package A and Package B accepted goldens against their preserved historical fixtures; accepted historical evidence must remain unchanged.
- [ ] Run `npm run typecheck && npm test`.
- [ ] Commit: `feat(core): version world model for acquisition ecology`.

### Task 2: Add the Ruleset-Owned Package C Transaction Profile

**Files:**
- Create: `packages/sim-core/src/economy.ts`
- Modify: `packages/sim-core/src/ruleset.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `fixtures/rulesets/synthetic-package-c-rules-v1.json`
- Test: `packages/sim-core/test/transactionRules.test.ts`
- Existing regression: Package A/B ruleset and golden tests

**Interfaces:**
- `MoneyAmount` is a branded non-negative safe integer with `moneyAmount(value: number): MoneyAmount`.
- Add optional `transactions?: TransactionRulesV1` to `LeagueRules`. **Absent remains valid** for historical Package A/B rulesets; Package C transaction commands call `requireTransactionRules(ruleset)` and fail closed if absent.
- `TransactionRulesV1` contains explicit synthetic acceptance rules:
  - `moneyUnit: 'synthetic-unit'`
  - `salaryCaps: readonly { season: number; amount: MoneyAmount }[]`
  - `roster: { activeLimit: number; reserveLimit: number }`
  - `contracts: { minYears: number; maxYears: number; signingBonusProrationMaxYears: number; minimumBaseSalary: MoneyAmount; guaranteedFutureBaseOnRelease: boolean; signingBonusStaysWithOriginalClubOnTrade: boolean }`
  - `market: { freeAgencyOpen: string; freeAgencyClose: string; tradeDeadline: string; defaultOfferValidityDays: number; futurePickTradeHorizonSeasons: number }`
  - `draft: { rounds: number }`
- Fixture values are synthetic test boundaries, deliberately small enough for hand-verifiable assertions. The ruleset file must label them synthetic and must not imply current NFL calibration.
- Proration uses integer division with deterministic earliest-season remainder allocation; define/test this rule once in `economy.ts`.

- [ ] Write RED tests that old Package A/B rulesets still validate byte-identically, a Package C ruleset seals/validates, missing/negative/non-integer money fails, invalid date windows fail, and Package C commands cannot run against a ruleset with no transaction profile.
- [ ] Implement `MoneyAmount`, deterministic proration helper, transaction-rule parsing/validation, and `requireTransactionRules`.
- [ ] Seal the synthetic Package C ruleset fixture and record its content hash.
- [ ] Run accepted Package A/B goldens plus full tests/typecheck.
- [ ] Commit: `feat(core): add ruleset-owned transaction rules`.

### Task 3: Seed Player Truth, Roster Rights, Agents, and Draft Assets Without an OVR

**Files:**
- Modify: `packages/sim-core/src/seed.ts`
- Modify: `packages/sim-core/src/roster.ts`
- Modify: `packages/sim-core/src/market.ts`
- Modify: `packages/sim-core/src/scouting.ts`
- Modify: `packages/sim-core/src/draft.ts`
- Modify: `packages/sim-core/src/world.ts`
- Create: `fixtures/seeds/synthetic-package-c-world-v1.json`
- Test: `packages/sim-core/test/packageCSeed.test.ts`
- Test: `packages/sim-core/test/playerTruthBoundary.test.ts`

**Interfaces:**
- Extend `WorldSeedManifest` with optional `packageCSubstrate`; historical seeds remain valid when absent.
- `PlayerRecord { personId, birthDate, primaryRole, roleTags, capabilities }` where capabilities are canonical `PlayerCapability { key: string; valueBp: number }` values in `0..10000`. There is **no overall, potential, ceiling, star rating, trade value, or destination rating** field.
- `PlayerRightsRecord { id, playerId, holderOrganizationId, kind, sourceRecordId, effectiveFrom, effectiveUntil }`, with `kind = 'contract' | 'draft' | 'exclusive'` and no record when no organization owns rights.
- `RosterMembership { id, playerId, organizationId, status, effectiveFrom, effectiveUntil, sourceRecordId }`, with Package C statuses `active | reserve` only; later packages may add richer states through explicit versioning/rules.
- `AgentClientRecord { id, agentPersonId, playerPersonId, effectiveFrom, effectiveUntil }` references existing Package B people; agents are not recreated as market-only identities.
- `PlayerMarketPreferenceProfile { playerPersonId, security, earlyCash, roleOpportunity, contenderPreference, flexibility }` uses ordinal bands `low | medium | high`, is authoritative private person/market state, and is **not** added to organization knowledge views automatically.
- `ScoutEvaluatorProfile { personId, strongDimensions, weakDimensions, riskTolerance }` uses small categorical/ordinal fields; do not introduce cosmetic staff-rating bloat.
- `DraftClass { id, season, eligiblePlayerIds }`.
- `DraftPickAsset { id, season, round, slot, originalOrganizationId, ownerOrganizationId, status }`, where pre-draft `slot` may be known in the synthetic fixture and `status = available | used | forfeited`.
- Seed validation requires every player/scout/agent to reference a real person entity, every rights/membership/pick owner to reference an organization, unique IDs, no double active rights holder, no duplicate active roster membership, and canonical ordering.

- [ ] Write RED validation tests for wrong entity kinds, duplicate player records, duplicate ownership, malformed capabilities, forbidden OVR/potential-like fields, invalid agent clients, and duplicate draft-pick ownership.
- [ ] Write a positive synthetic fixture with at least four organizations, veteran players, free agents, draft prospects, persistent agents, scouts, draft picks, Package B plans/beliefs/authority, and hidden capability profiles.
- [ ] Prove `buildOrganizationDecisionView` and `buildOrganizationKnowledgeView` expose **none** of `PlayerRecord.capabilities` or `PlayerMarketPreferenceProfile` unless a legitimate claim communicates a derived fact/assessment.
- [ ] Implement seeding/canonical ordering without consuming additional RNG beyond the explicit seed contract.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): seed player roster agent and draft substrate`.

### Task 4: Roster Rights, Status, Capacity, and Conservation Invariants

**Files:**
- Modify: `packages/sim-core/src/roster.ts`
- Create: `packages/sim-core/src/rosterCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/roster.test.ts`
- Test: `packages/sim-core/test/rosterCommands.test.ts`

**Interfaces:**
- Pure queries: `currentRightsHolder(world, playerId, date)`, `currentRosterMembership(world, playerId, date)`, `organizationRoster(world, organizationId, date)`, `rosterCapacity(world, organizationId, date, ruleset)`.
- `RosterInvariantFinding` covers duplicate active rights, duplicate active membership, membership without compatible rights/contract context, and limit violations.
- Package C user-facing roster action: `CommitRosterStatusProposal` with proposal `termsType = 'roster_status_v1'`, category `roster`, action `active_to_reserve | reserve_to_active`.
- Acquisitions/releases are **not** implemented by this command. Contract, trade, draft, and termination adapters later own rights acquisition/release so there is no bypass around money/asset consequences.
- Revalidate active `execute` right, current proposal authorization, exact terms hash/revision, protected constraints, and target roster capacity immediately before commit.
- One accepted command updates membership, proposal state, decision receipt, and events atomically; it consumes no gameplay RNG.

- [ ] Write RED tests for capacity boundary, duplicate membership, moving a player another organization owns, stale proposal, revoked authority, protected player, exact idempotent retry, and `beforeCommit` fault rollback.
- [ ] Implement pure roster queries/audit and `CommitRosterStatusProposal` through the static router.
- [ ] Prove no direct command can manufacture or transfer player rights.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): enforce roster rights and capacity`.

### Task 5: Basic Real Contract and Cap Machinery

**Files:**
- Modify: `packages/sim-core/src/contracts.ts`
- Create: `packages/sim-core/src/contractMath.ts`
- Create: `packages/sim-core/src/contractCommands.ts`
- Modify: `packages/sim-core/src/roster.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/contracts.test.ts`
- Test: `packages/sim-core/test/contractCommands.test.ts`

**Interfaces:**
- `ContractYearTerms { season, baseSalary, rosterBonus, guaranteedBase }` using `MoneyAmount`.
- `ContractTermsV1 { startSeason, years, signingBonus }`; contiguous seasons only, within ruleset min/max years, each base salary at least ruleset minimum.
- `ContractAgreement { id, playerId, organizationId, terms, signedAt, sourceOfferId, sourceProposalId, status: 'active' | 'terminated' }`.
- `ContractTermination { id, agreementId, organizationId, playerId, terminatedAt, reason, deadCapBySeason, guaranteedCashDue }`.
- Pure functions: `contractCashSchedule`, `contractCapCharges`, `organizationCapCommitments`, `previewContractImpact`, `terminationImpact`.
- Signing-bonus proration follows Task 2 rules. On trade, future base/roster obligations move with the player while unamortized signing-bonus cap remains with the original club when the rules profile says so. On release, guaranteed future base and unamortized bonus follow the Task 2 rules.
- Cap totals are **derived from agreements/terminations**, not stored as an independent authoritative total.
- `CommitReleaseProposal` uses category `roster` and atomically terminates the active contract, records dead-cap/cash obligations, ends roster membership/contract rights, and makes the player eligible for the free-agent market. It cannot silently erase guaranteed obligations.
- Actual contract signing is exposed as pure `applyContractAgreement(...)` in this task; external player/agent acceptance and the command that calls it arrive in Task 8.

- [ ] Write RED hand-calculated contract tests for cash, guarantees, signing-bonus proration/remainder, cap by season, trade treatment, release/dead cap, max/min term rules, and no floating-point money.
- [ ] Write RED release tests: bad contract cannot disappear, cap consequence survives release, protected constraint blocks, revoked authority blocks, commit fault rolls back every roster/contract/cap effect.
- [ ] Implement contract math and release command without adding a universal contract-value grade.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add basic contract and cap obligations`.

### Task 6: Draft-Pick and Player Asset Ledger for Transactions

**Files:**
- Create: `packages/sim-core/src/assets.ts`
- Modify: `packages/sim-core/src/draft.ts`
- Modify: `packages/sim-core/src/roster.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/assets.test.ts`

**Interfaces:**
- `AcquisitionAssetRef = { kind: 'player_rights'; playerId: EntityId } | { kind: 'draft_pick'; pickId: RecordId }`.
- `assetOwner(world, asset, date): EntityId | null` derives current owner from roster-rights/draft state.
- `TradePackageV1 { organizationAId, organizationBId, assetsFromA, assetsFromB, validity, contingencies }`.
- Package C first implementation transfers only whole player-rights and whole draft-pick assets; no partial rights, cash trades, or obscure conditional-pick settlement.
- Future picks beyond the ruleset horizon are illegal, not silently assigned zero value.
- Duplicate asset references in one package and the same asset on both sides are invalid.
- Asset conservation audit proves every transferred asset has exactly one pre-owner and one post-owner; no transaction creates/deletes a player right or pick except draft selection consuming a pick in Task 11.

- [ ] Write RED tests for player/pick ownership lookup, future-pick horizon, duplicate asset references, self-trade, already-transferred asset, and conservation.
- [ ] Implement asset references/validation as pure domain helpers; no trade decision logic yet.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add acquisition asset ownership ledger`.

### Task 7: Contextual Trade Discovery, Negotiation, and Atomic Execution

**Files:**
- Modify: `packages/sim-core/src/market.ts`
- Create: `packages/sim-core/src/tradeReasoning.ts`
- Create: `packages/sim-core/src/tradeCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/tradeReasoning.test.ts`
- Test: `packages/sim-core/test/tradeMarket.test.ts`
- Test: `packages/sim-core/test/tradeCommands.test.ts`

**Interfaces:**
- `TradeInterestBand = 'none' | 'open' | 'interested' | 'priority'`; it is contextual to an organization/request and is **not** stored on the player as value.
- `MarketInquiry { id, requestingOrganizationId, asset, contactedOrganizationIds, createdAt, status, responseIds }`.
- `MarketInquiryResponse { id, inquiryId, respondingOrganizationId, band, communicationClaimIds, expiresAt }`; public/user-visible response includes only legitimately communicated band/claims, never internal max/package threshold/private board/private plan.
- `TradeOfferRecord { id, revision, proposerOrganizationId, counterpartyOrganizationId, package, proposerProposalId, counterpartyProposalId, termsHash, status, createdAt, expiresAt, supersedesRevision }`.
- `TradeDisposition = 'reject' | 'counter' | 'accept' | 'defer'` with a reasoning trace that cites only the responding organization's `OrganizationDecisionView`, board/beliefs/plans, public contract/asset facts, and its own cap/roster state.
- `evaluateTradeForOrganization(view, publicTransactionContext, package)` returns disposition/reasons/uncertainties; it never receives raw `FootballWorld` or hidden capability truth. There is no exported numeric universal value.
- `CommitTradeAgreement` requires two currently authorized internal proposals (one per organization) bound to the exact trade terms, revalidates both sides' authority/terms/deadline/assets/cap/roster/protections, creates one decision receipt per organization, transfers player rights/picks and applicable contract obligations atomically, and emits deterministic linked events at one revision.
- Re-evaluating the same unchanged external offer revision returns its recorded disposition; willingness changes only when the offer is revised or relevant world/market state changes and a new response record is created.

- [ ] Write RED no-oracle tests: discovery returns plausible bands but no max willingness; a rival private claim/board change not legitimately communicated leaves the requester's result unchanged.
- [ ] Write RED contextual-value test: two organizations with different legitimate beliefs/plans produce different disposition for the same player/package; neither trace cites hidden capability truth.
- [ ] Write RED trade execution tests for both internal approvals, revoked authority, stale asset owner, trade deadline, cap consequence, roster limit, duplicate request, unchanged-offer response reuse, and commit-fault rollback.
- [ ] Implement inquiry/disposition/execution without a universal trade-score helper.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add contextual trade market`.

### Task 8: Persistent Agents, Contract Offers, Concurrent Free Agency, and Fallbacks

**Files:**
- Modify: `packages/sim-core/src/market.ts`
- Create: `packages/sim-core/src/freeAgency.ts`
- Create: `packages/sim-core/src/freeAgencyCommands.ts`
- Modify: `packages/sim-core/src/contracts.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/agents.test.ts`
- Test: `packages/sim-core/test/freeAgency.test.ts`
- Test: `packages/sim-core/test/freeAgencyConcurrency.test.ts`

**Interfaces:**
- `ContractOfferRecord { id, revision, organizationId, playerId, agentPersonId, organizationProposalId, terms, roleCommitment, contingencyGroupId, priority, submittedAt, expiresAt, status, supersedesRevision }`.
- Offer states: `draft | communicated | countered | accepted_pending_commit | committed | rejected | withdrawn | expired | superseded`.
- `MarketReservation { id, organizationId, sourceOfferId, capBySeason, rosterSlots, contingencyGroupId, active }` prevents impossible double commitment. Mutually exclusive fallback offers may share one `contingencyGroupId`; only the declared priority winner can commit and the rest release reservation/state according to the resolver.
- `submitContractOffer` requires a currently authorized internal `contract` proposal and legitimate `communicate`/`execute` rights as defined by the domain adapter; it creates a real market communication and reservation but does not itself sign the player.
- `evaluatePlayerOfferSet(world, playerId, eligibleOffers)` may read the player's own private `PlayerMarketPreferenceProfile`, current client-agent relationship, offer terms, credible communicated role, and the player's public/current context. It must not reveal the private profile to organizations. Same unchanged offer set + same state produces the same result; no acceptance reroll.
- Preference evaluation is ordinal/explainable and ruleset-bounded; Package C does not introduce a universal player utility score exposed as truth.
- `ResolveFreeAgencyMarket` operates at a logical checkpoint, evaluates all eligible players/offers from one declared information snapshot, uses stable deterministic processing for replay, commits accepted offers only after revalidating reservations/cap/roster/proposals, releases losing fallback reservations, and permits no-deal outcomes.
- An extension to a currently contracted player uses the same offer/agreement path; a free-agent signing creates contract agreement + contract rights + roster membership atomically.
- Agent relationship may influence whether/when a counter or preference signal is communicated, but never applies an automatic money discount.

- [ ] Write RED tests that agent identity persists, wrong agent cannot act for a client, high relationship does not modify contract dollars, and private preference values never appear in organization knowledge/trace output unless separately communicated as claims.
- [ ] Write RED concurrency test with two clubs/two players/fallback groups where naive sequential processing would overcommit; declared reservations/contingency priorities produce one legal deterministic outcome independent of offer insertion/UI order.
- [ ] Write RED legitimate no-deal test and unchanged-offer-no-reroll test.
- [ ] Write RED stale proposal/expired offer/changed cap/changed roster/revoked authority tests; none partially signs or consumes gameplay RNG.
- [ ] Implement free-agency resolver and atomic contract application using Task 5.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add concurrent free agency and agents`.

### Task 9: Value-of-Information Scouting Workflow on Top of Package B Knowledge

**Files:**
- Modify: `packages/sim-core/src/scouting.ts`
- Create: `packages/sim-core/src/scoutingCommands.ts`
- Modify: `packages/sim-core/src/information.ts` only if a narrow reusable interface is required; do not fork the knowledge model
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/scouting.test.ts`
- Test: `packages/sim-core/test/scoutingKnowledgeBoundary.test.ts`

**Interfaces:**
- `ScoutingQuestion { id, organizationId, playerId, questionKey, decisionContext, createdByPersonId, createdAt, status }`.
- `ScoutingEvidenceSample { id, playerId, evidenceType, dimensionKey, signalBand, sourceFamilyId, observedAt, access, provenanceClaimId }` is authoritative evidence input, **not** latent capability truth. Normal organizations see it only through legitimate access/claims.
- `ScoutingAssignment { id, questionId, evaluatorPersonId, evidenceSampleIds, requestedAt, dueAt, status, resolvedClaimIds, resolvedBeliefId }`.
- Assignment resolution reads only the assigned scout profile plus evidence the organization/evaluator is allowed to use. It may not read `PlayerRecord.capabilities`.
- Resolution creates Package B `ClaimRecord`/`BeliefRecord` entries (or uses shared creation helpers) with preserved source-family/provenance and immutable as-of meaning. Scouting state stores links, not a competing report-truth copy.
- `signalBand`/assessment outputs are categorical/decision-useful; no exact hidden overall/potential probability is exposed.
- Repeating the exact same question/evaluator/evidence set does not reroll. It returns the existing resolved assignment/report link or rejects duplicate work according to one deterministic rule.
- Public facts/permitted test results are not locked behind arbitrary scouting points. Scouting work exists to resolve a question that might change a decision.
- Medical diagnosis/readiness modeling is out of scope; a medical question can reference an existing authorized claim but Package C does not create the Package D medical model.

- [ ] Write RED test proving the scouting resolver cannot receive/read `PlayerRecord.capabilities` and that direct latent-truth import would fail an architecture test.
- [ ] Write RED same-evidence-no-reroll and source-family-false-corroboration tests.
- [ ] Write RED two-organization disagreement test from different legitimate evidence/scout lenses, with immutable historical reports after later evidence arrives.
- [ ] Write RED value-of-information test: assignment requires an unresolved question/decision context rather than incrementing a generic completion percentage.
- [ ] Implement scouting workflow through the existing information/knowledge boundary.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add value-of-information scouting`.

### Task 10: Organizational Draft Boards, Tiers, and Need Without Rewriting Evaluation

**Files:**
- Modify: `packages/sim-core/src/draft.ts`
- Create: `packages/sim-core/src/draftBoardCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/draftBoards.test.ts`

**Interfaces:**
- `DraftBoard { id, organizationId, draftClassId, revision, tiers, createdAt, supersedesRevision }`.
- `DraftBoardTier { tier: number, entries: readonly DraftBoardEntry[] }`.
- `DraftBoardEntry { playerId, beliefIds, roleProjection, withinTierOrder, needPriority, planIds, noteClaimIds }`.
- `tier` is organizational evaluation grouping; `needPriority` is separate contextual decision priority. Changing need/roster plan may change `needPriority` without silently changing tier or scouting beliefs.
- `withinTierOrder` may be `null` to preserve genuine ties/uncertainty.
- `CommitDraftBoardProposal` uses category `acquisition` and Package B authorization/receipt semantics; board revisions link rather than overwrite.
- Board construction accepts only organization-visible belief/claim refs. No board API accepts raw capabilities.
- Staff disagreement remains represented by differing beliefs/claims; board finalization does not delete dissenting reports.

- [ ] Write RED tests for tier semantics, ties, revision history, inaccessible belief refs, need change without evaluation rewrite, and no latent truth access.
- [ ] Write RED test where two organizations place the same prospect in different tiers for legitimate evidence/plan reasons.
- [ ] Implement board commit/revision through Package B decision infrastructure.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add organizational draft boards`.

### Task 11: Live Draft Order, Pick Trades, Selections, and Draft Rights

**Files:**
- Modify: `packages/sim-core/src/draft.ts`
- Create: `packages/sim-core/src/draftCommands.ts`
- Modify: `packages/sim-core/src/tradeCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/liveDraft.test.ts`
- Test: `packages/sim-core/test/draftTrade.test.ts`

**Interfaces:**
- `DraftSession { id, draftClassId, status: 'scheduled' | 'open' | 'complete', orderedPickIds, currentIndex, selectionIds, openedAt, completedAt }`.
- `DraftSelection { id, sessionId, pickId, organizationId, playerId, organizationProposalId, selectedAt, boardRevision }`.
- `OpenDraft` is an authorized/system league command at the ruleset-defined checkpoint.
- `MakeDraftSelection` requires the current pick asset to be owned by the selecting organization, the player to remain eligible/undrafted, current acquisition/draft authority, exact proposal/board context, and no rights conflict. It atomically marks the pick used, records selection, grants draft rights, changes prospect lifecycle, writes receipt/events, and advances `currentIndex`.
- A draft pick can be traded through the Task 7 trade path before it is used. Pre-draft/live offers may include contingencies such as `validIfPickCurrent` and `validIfPlayerAvailable`; they are validated at commit, not treated as promises that alter reality early.
- There is no wall-clock reaction-speed rule. The single-player draft remains paused until a command advances it; presentation timers are non-authoritative.
- After final pick, undrafted prospects become eligible for the existing free-agent offer path; Package C proves at least one UDFA signing uses the same agent/contract/roster machinery rather than a draft-specific shortcut.

- [ ] Write RED draft-order/pick-owner/duplicate-selection/stale-pick tests.
- [ ] Write RED live pick-trade test: trade the current pick, then only the new owner can select; every asset/right/contract/receipt event remains atomic.
- [ ] Write RED conditional-framework tests and prove no wall-clock/timer value enters authoritative resolution.
- [ ] Write RED UDFA integration test through Task 8.
- [ ] Implement live draft commands and reuse the existing trade/contract/free-agency adapters rather than duplicating them.
- [ ] Run full tests/typecheck.
- [ ] Commit: `feat(core): add live draft transactions`.

### Task 12: Acquisition-Ecology Audit and House-Rule Graveyard Probes

**Files:**
- Create: `packages/sim-core/src/acquisitionAudit.ts`
- Create: `packages/sim-core/test/acquisitionAudit.test.ts`
- Create: `packages/sim-core/test/acquisitionExploits.test.ts`
- Modify: `packages/sim-core/src/index.ts`

**Interfaces:**
- `AcquisitionFinding { code, severity, organizationId?, subjectIds, detail }` is QA/read-only and never auto-repairs the world.
- `auditAcquisitionEcology(world, ruleset)` checks at minimum:
  - duplicate/contradictory player rights;
  - duplicate active roster membership;
  - draft asset conservation/duplicate ownership;
  - active contract vs rights/membership consistency;
  - cap obligations derived from contracts/terminations;
  - active reservations exceeding declared resources outside an explicit contingency group;
  - committed offers still marked live;
  - used draft picks still offered/traded;
  - inaccessible claim/belief refs in board/market reasoning traces;
  - transaction receipts missing corresponding outcome events.
- Exploit probes are regression tests, not new game rules.

- [ ] Write RED probe for repeated trade-down/asset duplication attempt; conservation rejects the illegal state/transaction.
- [ ] Write RED veteran-for-pick/bad-contract dump probe where counterpart has no coherent plan/market reason; contextual policy rejects or counters rather than accepting because of a global score bug.
- [ ] Write RED free-agent sniping/UI-order probe; reversing offer insertion order does not change the logical market result.
- [ ] Write RED contract backload/cap bypass probe using the Task 2 profile; every season's cap rules still validate.
- [ ] Write RED scouting-certainty inference probe; repeated identical evidence produces no extra independent certainty.
- [ ] Write RED future-pick-free-value probe; far-future illegal picks reject and legal future picks remain organization-contextual rather than zero/constant oracle value.
- [ ] Implement deterministic audit findings and preserve every failure for diagnosis; never auto-fix authoritative state.
- [ ] Run full tests/typecheck.
- [ ] Commit: `test(package-c): add acquisition exploit audits`.

### Task 13: Integrated Package C GM-Acquisition Golden Scenario, Persistence, and Replay

**Files:**
- Create: `packages/sim-core/src/packageCScenario.ts`
- Create: `packages/sim-core/src/packageCGoldenExpected.ts`
- Create: `packages/sim-core/test/packageCScenario.test.ts`
- Modify: `packages/headless/src/cli.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: existing persistence/replay/recovery suites

**Scenario:**
- Synthetic league with four organizations, contextual roster plans, authority, scouts, agents, veterans, free agents, two draft prospects, contracts/cap, and current/future draft assets.
- Organization A has one unresolved prospect question; scouting work creates a new legitimate belief without exposing latent truth.
- Organizations A/B place the same prospect differently because of legitimate evidence/plan differences.
- A shops a veteran; discovery reveals plausible interest but no rival maximum.
- A/B negotiate a player-for-future-pick trade; both internal proposal/authority paths approve; commit transfers assets/contract consequences atomically.
- A submits concurrent FA offers with an explicit fallback group while a rival competes; one signing occurs without cap overcommit, another target legitimately signs elsewhere or no-deals.
- A makes/extends one contract and later demonstrates the real future cap consequence in the world state.
- Draft opens; current pick is traded under a valid conditional framework; new owner selects a prospect; draft rights update; an undrafted player later signs through the same free-agent path.
- At least one stale/expired/revoked transaction attempt fails without mutation/RNG draw.
- Final audit has no error-severity findings.

**Interfaces:**
- `PackageCResult` prints final world fingerprint, event-chain head, revision, event count, sim date, cap summary for participating clubs, key contract/offer/trade/draft/board/report/receipt IDs, and asset ownership summary.
- Add headless command `package-c-golden` and npm check script.

- [ ] Write the complete integrated scenario test RED before writing scenario glue.
- [ ] Run scenario uninterrupted and with save/reload inserted after every committed command boundary; require exact final `PackageCResult` identity.
- [ ] Corrupt newest snapshot and prove existing recovery/replay restores the exact Package C result with immutable historic reports/offers/receipts.
- [ ] Run the scenario twice in Node; exact output must match.
- [ ] Record the accepted Node expected output in `packageCGoldenExpected.ts`; do not overwrite Package A/B expected files.
- [ ] Run `npm run typecheck && npm test && npm run golden:package-c:check`.
- [ ] Commit: `test(package-c): add GM acquisition golden scenario`.

### Task 14: Cross-Runtime/iPhone Package C Gate and Release Evidence

**Files:**
- Modify: root `package.json` scripts/CI only as needed
- Modify/generalize: `.github/workflows/package-a-ci.yml` if naming is now misleading; preserve historical tag behavior
- Create/modify: `scripts/hermes/entryPackageC.ts`
- Modify: `scripts/hermes-golden.mjs`
- Modify: `apps/mobile/src/diagnostics/goldenDiagnostics.ts`
- Modify: `apps/mobile/app/diagnostics.tsx`
- Create: `apps/mobile/src/diagnostics/packageCJudgement.ts`
- Test: `apps/mobile/test/packageCDiagnostics.test.ts`
- Create: `docs/release/PACKAGE_C_ACCEPTANCE.md`
- Evidence: `evidence/package-c/**`

**Acceptance:**
- Package A and Package B historical accepted evidence/tags remain untouched.
- Current Package C scenario is byte-identical on Node and standalone Hermes for final fingerprint + event-chain head + key authoritative summary.
- Mobile Diagnostics runs the **same production Package C scenario** through direct kernel and Expo SQLite save/reload/replay and compares against recorded Node values.
- Physical iPhone Diagnostics must show MATCH for direct runtime and SQLite round-trip before Package C is stamped accepted.
- Clean-checkout `npm ci` then full `npm run ci` succeeds, including typecheck, all tests, lint, format, Package A/B/C current/historical golden checks as appropriate, architecture import guard, and iOS export.
- `packages/sim-core` still imports no React/RN/Expo/SQLite/fs/network/wall clock.
- Acceptance doc maps every Package C invariant/golden/exploit case to executable evidence and records any explicit interpretation rather than hiding it.
- No Package D implementation begins before this acceptance is green.

- [ ] Capture fresh Windows CI-equivalent output at the final implementation commit.
- [ ] Run Package C golden twice on Node and twice on the standalone Hermes binary used for accepted cross-runtime evidence; compare exact outputs.
- [ ] Run clean checkout `npm ci` + `npm run ci` and record exit 0.
- [ ] Run the physical iPhone Package C diagnostic and record direct MATCH + SQLite MATCH with exact fingerprint/head.
- [ ] Inspect dependency tree, `git status`, acceptance doc, SHA manifests, and all Package C evidence.
- [ ] Create Package C milestone tag only after every gate is green.
- [ ] Create git bundle, source archive, and SHA-256 manifest; preserve at least one off-PC copy before Package D begins.
- [ ] Commit: `test(package-c): gate GM acquisition ecology`.

---

## Package C Acceptance Contract

Package C is complete only when fresh evidence demonstrates all of the following:

1. Accepted Package B saves migrate to world model v3 deterministically with no RNG/event/history mutation.
2. Historical Package A/B accepted evidence remains preserved and distinguishable from current Package C goldens.
3. League-specific transaction behavior comes from one validated `LeagueRuleset` transaction profile; historical rulesets without that profile remain readable but cannot run Package C transactions.
4. Player authoritative capability state contains no universal OVR/fixed-destiny potential, and no ordinary organization/CPU decision path can read latent capability truth directly.
5. Roster rights/membership are conserved, single-owner where applicable, ruleset-capacity constrained, and changed only through authorized domain adapters.
6. Contract/cap mechanics preserve integer cash timing, guarantees, bonus/proration treatment, future cap consequences, amendment/termination history, and cannot erase bad obligations by release/trade.
7. Derived cap summaries rebuild from authoritative contract/termination records; no competing cap source exists.
8. Draft picks/player rights behave as real conserved assets; future picks obey ruleset horizon and are not assigned a universal authoritative value.
9. Trade discovery can reveal legitimate plausible interest without exposing counterpart maxima/private boards/private beliefs.
10. Two organizations can rationally value/respond to the same player/package differently from legitimate beliefs, contracts, alternatives, plans, scarcity, and resource posture; no global trade-value oracle exists.
11. A trade requires current authorization on both sides and atomically transfers every asset/right/contract consequence or none.
12. Agents persist as people with client portfolios; agent relationships affect communication/access rather than magic discounts.
13. Free agency is concurrent in logical time, supports active fallbacks/withdrawals/pivots, prevents resource double-spend, is independent of UI insertion/wall-clock order, and permits legitimate no-deal outcomes.
14. Repeating an unchanged offer does not reroll acceptance or hidden willingness.
15. Scouting is value-of-information work over legitimate evidence; same evidence does not reroll, source-family provenance prevents fake corroboration, and scouting never doubles as development.
16. Historical scouting claims/beliefs remain immutable after later evidence/outcomes.
17. Organizational draft boards use beliefs/tiers; need changes decision priority without rewriting talent evaluation; different organizations may hold different boards without one being the hidden truth board.
18. Live draft order/pick ownership/selection are authoritative, pauseable in single-player, free of reaction-speed advantage, and integrate with the same trade/rights/agent/contract machinery.
19. At least one UDFA acquisition uses the free-agent path rather than a special draft shortcut.
20. Acquisition audits catch duplicate ownership, cap/resource overcommit, stale offers, used-pick trading, bad receipt/event linkage, and information leakage without auto-repairing truth.
21. Package C save/reload at every command boundary, replay, and corrupt-latest recovery reproduce identical authoritative state and immutable transaction/scouting history.
22. The integrated golden proves a complete scouting → plan/board → market → contract/trade/FA/draft → roster/cap/history acquisition loop rather than disconnected mini-games.
23. Node, standalone Hermes, and physical iPhone direct/SQLite diagnostics agree on the Package C golden fingerprint and event-chain head.
24. Clean-checkout CI, lint, format, tests, architecture guard, accepted golden checks, and iOS export all pass.
25. Package D can consume the resulting players/rosters/contracts/roles/scouting evidence without creating a second player truth, development system, medical model, or acquisition ledger.

## Explicitly Out of Scope for Package C

Do not smuggle later packages into this implementation. Specifically out of scope:

- player progression/decline algorithms, developmental possibility evolution, practice scheduling/intent resolution, opportunity/repetition allocation, coaching buy-in effects, scheme learning/installation debt, medical diagnosis/healing/readiness/risk (Package D);
- play-level football, game plans, scheme/concept execution, injuries generated by games, GameCast/Sunday Proof (Package E);
- polished Today/Watchboard/Plans/Notebook/History UX, knowledge-safe global search UI, onboarding, production negotiation/scouting screens (Package F);
- complete multi-decade Simulation Lab, full Synthetic GM population, exhaustive market calibration, century-save ecology certification (Package G);
- deep agent politics/network gameplay, every obscure CBA mechanism, full compensatory-pick/franchise-tag/waiver edge-case parity, licensed/current NFL economy calibration, cloud/accounts, optional LLM prose.

## Handoff to Package D

Package D may begin only after Package C acceptance. It must consume rather than duplicate:

- stable player/person identities and baseline football-capability/role state;
- authoritative roster rights/membership and contract/cap obligations;
- draft/acquisition history and decision receipts;
- Package B claims/beliefs/provenance and Package C scouting evidence/report links;
- organizational plans/authority/relationships;
- the same `WorldKernel`, ruleset, persistence, replay, and recovery path.

Package D owns causal development, opportunity/repetition scarcity, practice intent, scheme learning/installation debt, coaching buy-in, and medical/readiness. It must not reinterpret scouting confidence as hidden potential, create an XP progression bar, or mutate contracts/roster rights through a second path.