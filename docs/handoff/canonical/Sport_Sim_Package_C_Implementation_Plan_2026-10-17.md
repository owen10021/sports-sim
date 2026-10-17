# Package C — Roster, Contracts, Markets, Scouting, and Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** PLAN FOR REVIEW — do not implement until Owen approves this written plan.

**Authoring baseline:** Accepted Package B commit `f50cb2119b874542787241d1f1767fe01865efcd`, tagged `package-b-acceptance-20261017`; Package C design-basis line at `a1ffeb2766510e184d88d9d27731d31e3f67bdec` (the design-basis file itself originated at `314652f88e1da440a3f5994219e4bf59b9588bb2` and was tightened with cutdown/waiver/practice-squad + acquisition-impact-preview requirements at `a1ffeb2`). Package B’s physical-iPhone gate is closed with MATCH/MATCH; its accepted evidence/tag are immutable historical inputs.

**Goal:** Implement the first substantively real GM acquisition ecology: player/roster rights, cutdown/waiver/practice-squad continuity, basic real contracts and cap consequences, contextual trade and free-agent markets, persistent agents, value-of-information scouting, organizational draft boards, draft assets/order, and live draft transactions — all through Package B authority, knowledge, plans, proposals, approvals, and decision receipts.

**Architecture:** Extend the single pure-TypeScript `FootballWorld` with focused Roster & Player, Market & Contract, and Draft & Scouting state. Every actual acquisition/contract/roster/draft/waiver mutation routes through the existing static `WorldKernel` command boundary. Package C first generalizes Package B’s already-reserved transaction categories into a reusable authorized-domain-commit adapter so later domains do not create a second approval/receipt system. Organization/CPU market reasoning receives knowledge-filtered acquisition views; player/agent resolution receives a separate player-side private view. League-specific transaction mechanics live in an explicit ruleset-owned profile using synthetic integer economics for acceptance fixtures rather than pretending unresolved NFL calibration is known. Derived acquisition-impact previews reuse the same contract/rights/assets/reservations used by commit validation and never become authoritative truth.

**Tech Stack:** Existing Package A/B stack only: strict TypeScript, Vitest, deterministic canonical hashing/serialization, `WorldKernel`, Package B authority/information/relationships/plans/decision/reasoning substrate, existing persistence/replay/recovery, Node headless QA, standalone Hermes verification, Expo/Expo SQLite physical-device diagnostics. Add no runtime dependency unless the plan is explicitly amended.

**Spec:** `docs/handoff/canonical/Sport_Sim_Package_C_Design_Basis_2026-10-17.md`. It is a repo-local extract of already-approved frozen canon. Precedence remains the one stated in that design-basis document.

## Global Constraints

- Package B is accepted/tagged; Package C begins from that accepted boundary and never rewrites it.
- One authoritative `FootballWorld`; only `WorldKernel` commits authoritative football reality.
- Human, CPU, delegated, commissioner, system, and test actors use the same transaction legality and knowledge rules.
- Ordinary organizations/actors never receive latent player capability truth, rival private beliefs, rival boards/fallbacks, client private preferences, or opponent maximum willingness to pay.
- No universal OVR, fixed-destiny potential, universal player/pick trade-value number, hidden offer-score minigame, or oracle trade finder.
- Scouting reveal and player development are separate. Package C does not implement progression, practice, opportunity, medical/readiness evolution, or scheme learning; those belong to Package D.
- Package C may establish baseline football-capability/role state required by roster/scouting/draft, but no organization/human/CPU decision policy may read that latent capability state directly.
- Draft, rookie signing, UDFA, cutdown/release, waivers, practice squad, trade, contracts, free agency, roster rights, agents, cap, and draft assets are one acquisition ecology and conserve shared resources coherently.
- Every actual transaction revalidates current authority, approvals, terms, deadlines, ownership, cap/resources, roster capacity/rights, and protected constraints immediately before commit.
- A trade, contract execution/termination, signing, draft selection, waiver resolution, practice-squad signing, or roster-rights transfer is all-or-nothing. Rejection/fault leaves world, RNG, chain, assets, obligations, rights, proposals, and receipts unchanged.
- Repeating an already accepted command ID is idempotent under the kernel. Repeating an unchanged external offer cannot independently reroll willingness.
- Market/waiver/draft resolution uses logical simulation time. UI insertion order, wall clock, renderer timing, device speed, or human reaction speed are never tie-breakers.
- `LeagueRuleset` owns league-specific transaction mechanics. Package C acceptance uses one explicit synthetic transaction profile; synthetic values are test boundaries, not claims about current NFL rules/economics.
- Money/cap values use non-negative safe integers in a ruleset-declared synthetic unit. No authoritative floating-point money.
- Future picks retain uncertainty, optionality, and time preference. Legality is ruleset-defined; valuation is organization-contextual, never a universal chart stored as truth.
- Agent relationships may affect communication/access/credibility, never magic discounts or hidden-information access.
- Historical claims, beliefs, scouting reports, board revisions, offers, agreements, proposals, approvals, plans, and decision receipts remain immutable as-of records; later revisions link forward.
- Package B’s information domain remains the single authoritative claim/evidence/belief system. Scouting references it; scouting does not create a second evidence truth store.
- Package B plans/proposals/approvals/decision receipts remain the authorization substrate. Package C does not create a parallel approval system.
- Derived cap ledgers, roster counts, market summaries, acquisition-impact previews, draft read models, and comparisons are rebuildable and non-authoritative.
- `packages/sim-core` stays free of React, React Native, Expo, SQLite, filesystem, wall-clock, and network imports.
- Package C does **not** implement Package D development/practice/medical/opportunity, Package E football gameplay/Sunday Proof, or Package F polished Command Center UX.
- Preserve Package A/B accepted tags, fixtures, and evidence. World-model evolution is explicit, migrated, and tested rather than silently rewriting accepted history.
- Each accepted task follows RED → GREEN where applicable, then targeted tests plus the full current CI gate, one reviewable commit, and push before the next task.

## Review Focus

1. **Stale/double-spend transaction state:** changed ownership, cap, offer revision, authority, waiver status, or proposal terms after approval must be revalidated at commit; stale execution fails atomically.
2. **Information/oracle leakage:** scouting, market discovery, CPU reasoning, error reasons, offer explanations, and draft boards must not leak latent traits, player private preferences, rival private boards/fallbacks/offers, or counterpart maxima.
3. **Simultaneous-market fairness:** the same eligible free-agent/waiver input set resolves identically regardless of insertion/UI order, runtime speed, or save/reload; player-side choice and waiver priority are deterministic/rules-driven.
4. **Contract/cap conservation:** signing, extension, trade, release, waiver assumption, guarantees, bonus proration, and dead-money effects use integer arithmetic and cannot erase or duplicate obligations.
5. **Migration/replay integrity:** accepted Package B model-2 saves migrate deterministically to model 3 with no RNG/events/history mutation, and Package C save/load/replay/recovery reproduces exact acquisition history.

---

### Task 1: Freeze Accepted Package B and Version the World Model for Package C

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
- Modify persistence/replay validation only where required by the model boundary.
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/worldModelV3.test.ts`
- Test: `packages/sim-core/test/packageBWorldMigration.test.ts`

**Interfaces:**
- Freeze final accepted Package B model-2 world bytes before changing `FootballWorld`.
- Set `WORLD_MODEL_VERSION = 3`.
- `FootballWorld` gains `roster`, `contracts`, `market`, `scouting`, `draft` authoritative states.
- Empty shapes:
  - `RosterState { players, rights, memberships, waivers, waiverClaims, waiverPriority }`
  - `ContractsState { agreements, terminations }`
  - `MarketState { agentClients, playerPreferences, inquiries, tradeOffers, contractOffers, reservations, responses }`
  - `ScoutingState { evaluatorProfiles, questions, assignments, reports }`
  - `DraftState { classes, picks, boards, sessions, selections }`
- Produce model-2 recognition/migration and update `requireCurrentWorld` so current v3 is validated, genuine Package B v2 migrates, existing Package A migration still chains safely, and future/partial worlds fail closed.
- v2 → v3 adds only empty C state; preserve pre-C canonical data, world ID, date, revision, RNG, counters, Package B domains, and history meaning; emit no event and consume no RNG.

- [ ] Freeze/hash accepted Package B model-2 snapshot/expected values first.
- [ ] Write RED tests for exact pre-C preservation, empty C state, chained Package-A migration, partial-v3 rejection, and future-version rejection.
- [ ] Implement model 3 and one shared load/resume/replay migration boundary.
- [ ] Preserve Package A/B historical goldens; add new current expectations instead of overwriting accepted history.
- [ ] Run accepted Package A/B checks and full CI.
- [ ] Commit: `feat(core): version world model for acquisition ecology`.

### Task 2: Add Ruleset-Owned Transaction, Season, Waiver, and Rookie Rules

**Files:**
- Create: `packages/sim-core/src/economy.ts`
- Modify: `packages/sim-core/src/ruleset.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `fixtures/rulesets/synthetic-package-c-rules-v1.json`
- Test: `packages/sim-core/test/transactionRules.test.ts`

**Interfaces:**
- `MoneyAmount` is a branded non-negative safe integer; all money/cap arithmetic stays integer.
- Add optional `transactions?: TransactionRulesV1` to `LeagueRules`; historical A/B rulesets remain valid/hash-stable when absent. Package C commands call `requireTransactionRules` and fail closed if missing.
- `TransactionRulesV1` contains:
  - `moneyUnit: 'synthetic-unit'`;
  - `seasonRules: readonly TransactionSeasonRules[]`, each with `season`, `salaryCap`, `activeRosterLimit`, `reserveRosterLimit`, `practiceSquadLimit`, `freeAgencyOpen`, `freeAgencyClose`, `tradeDeadline`, `draftDate`;
  - `contracts: { minYears, maxYears, signingBonusProrationMaxYears, minimumBaseSalary, guaranteedFutureBaseOnRelease, signingBonusStaysWithOriginalClubOnTrade }`;
  - `market: { defaultOfferValidityDays, futurePickTradeHorizonSeasons, resolutionPolicy: 'checkpoint' }`;
  - `waivers: { claimWindowDays, releasedPlayerWaiverPolicy: 'all' | 'none', claimWinnerMovesToEnd }`;
  - `draft: { rounds, rookieContractByRound }`, each synthetic round mapping to ruleset-owned `years`, `baseSalaryBySeason`, `signingBonus`.
- Deterministic signing-bonus proration divides integer bonus across declared years with remainder assigned in season order.

- [ ] RED compatibility test: accepted A/B rulesets validate/hash as before without `transactions`.
- [ ] RED validation tests for duplicate/missing seasons, invalid logical date order, negative/float money, impossible term bounds, waiver window, duplicate rookie rounds, unsupported policy enums.
- [ ] Implement parsing/sealing plus pure `transactionSeasonRules`/`requireTransactionRules`/proration helpers.
- [ ] Seal one explicitly synthetic Package C profile and record hash/provenance.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add ruleset-owned transaction rules`.

### Task 3: Seed Player Truth, Roster Rights, Agents, Waiver Priority, and Draft Assets Without an OVR

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
- Add optional `packageCSubstrate`; historical seeds stay valid/hash-stable when absent.
- `PlayerRecord { personId, birthDate, primaryRole, roleTags, capabilities }`; `PlayerCapability { key, valueBp }` is a specific latent dimension fixed-point `0..10000`. No overall/potential/ceiling/star grade/trade value/destination field.
- `PlayerRightsRecord { id, playerId, holderOrganizationId, kind, sourceRecordId, effectiveFrom, effectiveUntil }`, `kind = contract | draft | exclusive`; unrestricted FA has no organization-held active right.
- `RosterMembership { id, playerId, organizationId, status, effectiveFrom, effectiveUntil, sourceRecordId }`, status `active | reserve | practice_squad`.
- `AgentClientRecord { id, agentPersonId, playerPersonId, effectiveFrom, effectiveUntil }` references Package B people.
- `PlayerMarketPreferenceProfile { playerPersonId, security, earlyCash, roleOpportunity, contenderPreference, flexibility }` uses `low | medium | high`; private player-side state, never automatically organization-visible.
- `ScoutEvaluatorProfile { personId, strongDimensions, weakDimensions, riskTolerance }` is a small scouting lens, not staff-rating bloat.
- `DraftClass { id, season, eligiblePlayerIds }` and `DraftPickAsset { id, season, round, slot, originalOrganizationId, ownerOrganizationId, status }`.
- `waiverPriority` seeds one complete unique organization order; future updates follow ruleset only.

- [ ] RED wrong-kind, duplicate player/right/pick, malformed capability, forbidden OVR/potential-like field, invalid agent, rights/membership mismatch, duplicate ownership, incomplete/duplicate waiver-priority tests.
- [ ] Add positive four-org synthetic fixture with veterans, FAs, prospects, agents, scouts, current/future picks, hidden capability/preference profiles.
- [ ] Prove Package B organization knowledge/reasoning views expose neither latent capabilities nor private market profile absent legitimate claims.
- [ ] Implement deterministic seed parsing/canonicalization without incidental RNG.
- [ ] Run full CI.
- [ ] Commit: `feat(core): seed player roster agent and draft substrate`.

### Task 4: Generalize Package B Proposals and Receipts for Authorized Domain Commits

**Files:**
- Create: `packages/sim-core/src/transactionCommit.ts`
- Modify: `packages/sim-core/src/decisionCommands.ts`
- Modify: `packages/sim-core/src/decisions.ts`
- Modify: `packages/sim-core/src/commandSupport.ts` only if shared deterministic helper needed.
- Test: `packages/sim-core/test/transactionCommit.test.ts`
- Existing regression: all Package B authority/decision/plan tests/goldens.

**Interfaces:**
- Extend proposal submission/revision from Package B’s implemented first-three categories to already-reserved Package C categories `acquisition`, `contract`, `roster`, `major_trade`; do not change Package B category semantics.
- Produce `prepareAuthorizedDomainCommit(world, request)` (or one consistently documented equivalent) reusing Package B helpers.
- Request includes organization, acting person, proposal ID/exact revision, expected category, canonical executed terms, visible claim/belief refs, original rationale, optional mandate usage, protected-change context.
- Revalidate latest/live proposal, terms hash, current approval/authority backing, mandate scope, protected constraints, cited-knowledge visibility **at commit time**.
- Produce one shared receipt builder following existing Package B plan-commit semantics. Domain routers provide outcome specs; receipt outcome IDs are deterministically predicted from current event ordinal using the established kernel ID contract.
- Successful domain commit marks exact proposal revision committed and appends immutable `DecisionReceipt` in same resolution. Rejection/fault appends neither proposal mutation nor receipt.
- Trade can invoke adapter for both organizations and append two receipts in one atomic commit.

- [ ] RED Package C category submission + stale revision + changed terms + revoked authority + expired proposal + hidden evidence + protected constraint + mandate over-limit tests.
- [ ] RED successful immutable receipt test and dual-org receipt test.
- [ ] RED `beforeCommit` fault test proving domain/proposal/receipt/RNG/chain all unchanged.
- [ ] Refactor/reuse Package B logic; no independent authority/approval implementation.
- [ ] Run all Package B regressions plus full CI.
- [ ] Commit: `refactor(core): add authorized domain commit adapter`.

### Task 5: Roster Rights, Status, Capacity, and Conservation

**Files:**
- Modify: `packages/sim-core/src/roster.ts`
- Create: `packages/sim-core/src/rosterCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/roster.test.ts`
- Test: `packages/sim-core/test/rosterCommands.test.ts`

**Interfaces:**
- Pure queries: `currentRightsHolder`, `currentRosterMembership`, `organizationRoster`, `rosterCapacity`.
- `RosterInvariantFinding` covers duplicate active rights/membership, membership without compatible rights/contract context, and active/reserve/practice-squad limit violations.
- `CommitRosterStatusProposal`: category `roster`, terms `roster_status_v1`, action `active_to_reserve | reserve_to_active | practice_squad_to_active | practice_squad_to_reserve`.
- Active/reserve player cannot be demoted directly to practice squad; that passes through release/waiver and market signing path. Practice-squad promotion requires compatible rights/contract and capacity.
- Acquisition/release cannot bypass contracts/markets.

- [ ] RED capacity boundary, duplicate membership, wrong-owner, stale proposal, revoked authority, protected player, idempotent retry, fault rollback tests.
- [ ] Implement queries/audit/status command through Task 4/static router.
- [ ] Prove status command cannot manufacture/transfer player rights.
- [ ] Run full CI.
- [ ] Commit: `feat(core): enforce roster rights and capacity`.

### Task 6: Basic Real Contract and Cap Machinery

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
- `ContractTermsV1 { startSeason, years, signingBonus }` with contiguous years/ruleset term constraints.
- `ContractAgreement { id, playerId, organizationId, terms, signedAt, sourceOfferId, sourceProposalId, status }`, status `active | terminated | superseded`.
- `ContractTermination { id, agreementId, organizationId, playerId, terminatedAt, reason, deadCapBySeason, guaranteedCashDue }`.
- Pure cash schedule, cap charges, organization commitments, preview impact, release impact, trade impact. No cached authoritative cap total.
- Trade/release proration/guarantee treatment follows ruleset policy.
- `CommitReleaseProposal` category `roster` atomically terminates contract, records remaining obligations, ends active membership/rights, and enters Task 7 waiver path when rules require instead of immediately manufacturing free agency.
- Pure `applyContractAgreement`/validation is produced; player/agent accepted signing invokes it later.

- [ ] RED hand-calculated cash/cap/proration/remainder/guarantee/trade/release/max-term/min-salary, exactly-at-cap pass, one-over reject.
- [ ] RED bad-contract release preserves future/dead obligations.
- [ ] RED stale proposal/revoked authority/protected player/fault atomicity.
- [ ] Implement integer-only math and release integration point through Task 4.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add contract and cap obligations`.

### Task 7: Basic Waivers, Claims, and Practice-Squad Path

**Files:**
- Modify: `packages/sim-core/src/roster.ts`
- Create: `packages/sim-core/src/waiverCommands.ts`
- Modify: `packages/sim-core/src/contracts.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/waivers.test.ts`
- Test: `packages/sim-core/test/practiceSquad.test.ts`

**Interfaces:**
- `WaiverRecord { id, playerId, waivingOrganizationId, contractAgreementId, openedAt, claimDeadline, status, winnerOrganizationId }`, status `open | awarded | unclaimed | cancelled`.
- `WaiverClaim { id, waiverId, claimingOrganizationId, submittedAt, active }`.
- Waiver priority is authoritative ordered org IDs; synthetic rules move winner to end only when configured.
- `CommitWaivePlayerProposal` category `roster`: removes active/reserve membership, opens waiver, preserves linked contract/right until resolution; does not erase obligations.
- `SubmitWaiverClaim` requires current legal authority, cap/roster capacity and creates reservation so pending commitments cannot double-spend.
- `ResolveWaivers` is system/commissioner/test-harness logical-boundary command over all claims before deadline from one snapshot. Claimed: rights + active contract obligations + active membership move atomically to highest-priority legal claimant. Unclaimed: contract terminates using Task 6, old club retains dead/guaranteed consequences, rights end, player becomes FA-eligible.
- Practice-squad signing is **not** a separate market: Task 10 offers may target `practice_squad` and reuse agent/offer/contract/cap/rights path subject to ruleset limit.
- Defer accrued-season/protection/elevation/obscure waiver edges.

- [ ] RED window, claim eligibility, priority insertion-order invariance, competing claims, reservation conflicts, fault rollback.
- [ ] RED claimed-waiver atomic contract/right/membership transfer.
- [ ] RED unclaimed-waiver free-agency + surviving dead/guaranteed obligations.
- [ ] RED practice-squad capacity/one-player-one-contract/right tests.
- [ ] Implement through static router + existing contract/roster primitives.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add basic waiver and practice squad path`.

### Task 8: Acquisition Asset Ledger, Future-Pick Legality, and Impact Preview

**Files:**
- Create: `packages/sim-core/src/assets.ts`
- Create: `packages/sim-core/src/acquisitionImpact.ts`
- Modify: `packages/sim-core/src/draft.ts`
- Modify: `packages/sim-core/src/roster.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/assets.test.ts`
- Test: `packages/sim-core/test/acquisitionImpact.test.ts`

**Interfaces:**
- `AcquisitionAssetRef = player_rights | draft_pick` by stable IDs.
- `assetOwner(world, asset, date)` derives current owner.
- `TradePackageV1 { organizationAId, organizationBId, assetsFromA, assetsFromB, validity, contingencies }`.
- Transfer whole player-rights/draft-pick assets only. No cash trade, partial rights, conditional-pick settlement engine yet.
- Future picks beyond ruleset horizon are illegal, not zero-value.
- Duplicate/same-both-sides/self-trade/used-pick/wrong-owner invalid.
- `AcquisitionImpactPreview { capDeltaBySeason, activeSlotsBefore/After, reserveSlotsBefore/After, practiceSquadSlotsBefore/After, incomingAssets, outgoingAssets, draftPickIdsGained/Lost, reservationIdsAffected }` is derived/non-authoritative and contains no hidden capability/preference/value score.
- `previewAcquisitionImpact` is one shared calculation later used by trade/FA/draft legality and Package F read models; D may later add separate opportunity/repetition projection.

- [ ] RED ownership/duplicate/self-trade/stale-owner/used-pick/future-horizon/conservation tests.
- [ ] RED preview-vs-actual test proving derived cap/roster/asset deltas equal committed post-state for fixtures.
- [ ] Implement pure helpers only; no trade valuation.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add acquisition assets and impact preview`.

### Task 9: Contextual Trade Discovery, Reasoning, Negotiation, and Atomic Execution

**Files:**
- Create: `packages/sim-core/src/acquisitionView.ts`
- Modify: `packages/sim-core/src/market.ts`
- Create: `packages/sim-core/src/tradeReasoning.ts`
- Create: `packages/sim-core/src/tradeCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/acquisitionView.test.ts`
- Test: `packages/sim-core/test/tradeReasoning.test.ts`
- Test: `packages/sim-core/test/tradeMarket.test.ts`
- Test: `packages/sim-core/test/tradeCommands.test.ts`

**Interfaces:**
- `AcquisitionDecisionView` contains acting org’s own roster/contracts/cap/draft assets/plans, visible scouting knowledge, public facts, legitimately communicated market state, candidate IDs, authority. Excludes latent capabilities, player private preference, rival private boards/plans/offers/maxima.
- `TradeInterestBand = none | open | interested | priority` is communicated contextual interest, never player value.
- `MarketInquiry/Response` preserve who was contacted and what was communicated; `no known interest` reveals nothing about hidden interest.
- `TradeOfferRecord { id, revision, proposerOrganizationId, counterpartyOrganizationId, package, proposerProposalId, counterpartyProposalId, termsHash, status, createdAt, expiresAt, supersedesRevision }`.
- `TradeDisposition = reject | counter | accept | defer` with trace citing only responder `AcquisitionDecisionView`.
- `evaluateTradeForOrganization(view, publicContext, package)` returns disposition/reasons/uncertainties, no numeric universal value.
- `CommitTradeAgreement` requires exact accepted offer revision + two currently authorized proposals; revalidate both orgs’ authority/terms/deadline/assets/contracts/cap/roster/protection, append two receipts, transfer rights/picks/contract obligations atomically.
- Unchanged offer + unchanged relevant state reuses recorded response; new response needs revision or relevant changed state/evidence.

- [ ] RED no-oracle/leak tests for rival board/claim/plan/offer, player preference, latent capability.
- [ ] RED contextual divergence test contender vs rebuilder.
- [ ] RED dual-approval/revoked authority/stale asset-contract/deadline/cap/roster/duplicate/unchanged-offer/fault tests.
- [ ] Implement without universal score helper.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add contextual trade market`.

### Task 10: Persistent Agents, Contract Offers, Concurrent Free Agency, Fallbacks, and Practice-Squad Signings

**Files:**
- Modify: `packages/sim-core/src/market.ts`
- Create: `packages/sim-core/src/playerMarketView.ts`
- Create: `packages/sim-core/src/freeAgency.ts`
- Create: `packages/sim-core/src/freeAgencyCommands.ts`
- Modify: `packages/sim-core/src/contracts.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/agents.test.ts`
- Test: `packages/sim-core/test/playerMarketView.test.ts`
- Test: `packages/sim-core/test/freeAgency.test.ts`
- Test: `packages/sim-core/test/freeAgencyConcurrency.test.ts`

**Interfaces:**
- `ContractOfferRecord { id, revision, organizationId, playerId, agentPersonId, organizationProposalId, terms, roleCommitment, targetRosterStatus, contingencyGroupId, priority, submittedAt, expiresAt, status, supersedesRevision }`, target `active | reserve | practice_squad`.
- Offer state `draft | communicated | countered | accepted_pending_commit | committed | rejected | withdrawn | expired | superseded`.
- `MarketReservation { id, organizationId, sourceOfferId, capBySeason, rosterSlots, contingencyGroupId, active }`; declared mutually exclusive fallbacks may share group.
- `PlayerMarketDecisionView` contains only target player’s own market profile, agent/client relation, eligible offers, legitimate org/role facts, alternatives. Never organization-visible.
- Submitting offer requires exact internal `contract` proposal/current authority + communication right, creates external offer/reservation, does not sign yet.
- `evaluatePlayerOfferSet(view)` yields structured preference reasons/counter/no-deal/accept, not a public utility score.
- `ResolveFreeAgencyMarket` resolves logical checkpoint over complete eligible set in stable order; same set/state invariant to insertion/UI order/save reload. If RNG becomes necessary define one fixed persisted draw protocol; otherwise deterministic preference comparison.
- Accepted signing revalidates proposal/reservation/cap/roster then atomically creates agreement + contract + rights + target membership + receipt. Losing/fallback offers release consistently. No-deal valid.
- Extensions reuse same offer/agreement path outside multi-club FA when rights remain exclusive.
- Agent relationship can affect access/credibility, never dollars automatically.

- [ ] RED persistent-agent/wrong-agent/private-preference leak/no-magic-discount.
- [ ] RED permutation test over all insertion orders of small offer set: result/fingerprint/head/RNG identical.
- [ ] RED fallback/reservation overcommit prevention.
- [ ] RED no-deal/unchanged-offer/save-reload/stale proposal/expired/changed cap-roster/revoked authority.
- [ ] RED practice-squad target uses same contract/rights/cap path and limit.
- [ ] Implement via Task 6 + Task 4.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add concurrent free agency and agents`.

### Task 11: Value-of-Information Scouting on the Existing Package B Information Domain

**Files:**
- Modify: `packages/sim-core/src/scouting.ts`
- Create: `packages/sim-core/src/scoutingCommands.ts`
- Modify: `packages/sim-core/src/information.ts` only if narrow reusable claim/belief creation helper needed.
- Modify: `packages/sim-core/src/knowledgeView.ts` only for legitimate scouting links/read projection.
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/scouting.test.ts`
- Test: `packages/sim-core/test/scoutingKnowledgeBoundary.test.ts`

**Interfaces:**
- **No separate scouting evidence truth store.** Package B `ClaimRecord`/`BeliefRecord` remains authoritative evidence/belief system.
- `ScoutingQuestion { id, organizationId, playerId, questionKey, decisionContext, createdByPersonId, createdAt, status }`.
- `ScoutingAssignment { id, questionId, evaluatorPersonId, evidenceClaimIds, requestedAt, dueAt, status, resolvedReportId }`.
- `ScoutingReport { id, assignmentId, organizationId, playerId, evaluatorPersonId, questionId, evidenceClaimIds, beliefId, unresolvedQuestionKeys, formedAt }` links Package B knowledge instead of duplicating assessment truth.
- Resolution accepts only visible claims + evaluator lens; cannot receive/read latent `PlayerRecord.capabilities`.
- Report belief uses existing Package B information semantics/source-family provenance/immutable history.
- Same question/evaluator/evidence set does not reroll; repeated work returns/links existing resolution or deterministic duplicate rejection.
- Public facts/tests are not arbitrarily scouting-point locked. Work must answer a decision-relevant unresolved question.
- Medical modeling remains D; C may cite existing authorized medical claims only.

- [ ] RED architecture/leak prevention for latent capabilities.
- [ ] RED same-evidence-no-reroll/source-family false-corroboration.
- [ ] RED two-org disagreement from legitimate claims/lenses with immutable old reports after new evidence.
- [ ] RED value-of-information requirement rather than generic completion meter.
- [ ] Implement through Package B knowledge only.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add value-of-information scouting`.

### Task 12: Organizational Draft Boards, Tiers, and Need Without Rewriting Evaluation

**Files:**
- Modify: `packages/sim-core/src/draft.ts`
- Create: `packages/sim-core/src/draftBoardCommands.ts`
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/draftBoards.test.ts`

**Interfaces:**
- `DraftBoardRevision { id, organizationId, draftClassId, revision, tiers, createdAt, supersedesBoardRevisionId }`.
- `DraftBoardTier { tier, entries }`.
- `DraftBoardEntry { playerId, beliefIds, roleProjection, withinTierOrder, needPriority, planIds, noteClaimIds }`.
- `needPriority = low | normal | high | must_address`; separate from evaluation tier. Need/plan change may alter priority without rewriting belief/tier.
- `withinTierOrder` nullable for genuine ties/uncertainty.
- `CommitDraftBoardProposal` category `acquisition` via Task 4. Revisions link, never overwrite.
- Board accepts only visible claim/belief refs; no raw capabilities; dissent remains in underlying knowledge.

- [ ] RED tier/tie/revision/inaccessible belief/need-without-rewrite/no-latent tests.
- [ ] RED different-org board for same prospect from legitimate evidence/plans.
- [ ] Implement via Task 4.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add organizational draft boards`.

### Task 13: Live Draft Order, Pick Trades, Selections, Rookie Rights/Contracts, and UDFA Bridge

**Files:**
- Modify: `packages/sim-core/src/draft.ts`
- Create: `packages/sim-core/src/draftCommands.ts`
- Modify: `packages/sim-core/src/tradeCommands.ts`
- Modify: `packages/sim-core/src/contractCommands.ts` only to consume ruleset rookie terms.
- Modify: `packages/sim-core/src/commandRouter.ts`
- Modify: `packages/sim-core/src/index.ts`
- Test: `packages/sim-core/test/liveDraft.test.ts`
- Test: `packages/sim-core/test/draftTrade.test.ts`
- Test: `packages/sim-core/test/rookieContract.test.ts`

**Interfaces:**
- `DraftSession { id, draftClassId, status: scheduled | open | complete, orderedPickIds, currentIndex, selectionIds, openedAt, completedAt }`.
- `DraftSelection { id, sessionId, pickId, organizationId, playerId, organizationProposalId, selectedAt, boardRevisionId }`.
- `OpenDraft` system/league-authorized at ruleset checkpoint.
- `MakeDraftSelection` category `acquisition`: validate current pick owner, eligibility/undrafted, current authority/proposal/board, no rights conflict; atomically mark pick used, record selection, grant draft rights, append receipt/events, advance index.
- Pick may trade through Task 9 before use. Conditional frameworks such as current-pick/player-available validate at commit, never pre-author reality.
- No wall-clock draft deadline; single-player pauses until explicit logical command/time.
- Drafted player signs through Task 10/6 using ruleset rookie terms; no draft-only contract shortcut.
- After final selection, undrafted eligible players become market-eligible; at least one test signs UDFA through shared agent/FA/contract path.

- [ ] RED order/owner/duplicate/stale/already-drafted tests.
- [ ] RED live pick trade: only new owner selects after atomic trade.
- [ ] RED no-wall-clock/conditional-framework.
- [ ] RED rookie-contract-by-round + UDFA shared-path.
- [ ] Implement by reusing trade/contract/FA adapters.
- [ ] Run full CI.
- [ ] Commit: `feat(core): add live draft transactions`.

### Task 14: Acquisition-Ecology Audit and House-Rule Graveyard Probes

**Files:**
- Create: `packages/sim-core/src/acquisitionAudit.ts`
- Create: `packages/sim-core/test/acquisitionAudit.test.ts`
- Create: `packages/sim-core/test/acquisitionExploits.test.ts`
- Modify: `packages/sim-core/src/index.ts`

**Interfaces:**
- `AcquisitionFinding { code, severity, organizationId?, subjectIds, detail }` is QA/read-only, never auto-repair.
- Audit checks duplicate/contradictory rights, duplicate membership, pick conservation, contract-right-membership consistency, derived cap obligations, reservation overcommit outside explicit fallback group, committed offer still live, used pick offered/traded, waiver contract/right mismatch, inaccessible knowledge refs in board/market traces, receipt/outcome linkage.
- Exploit probes are regression tests, not anti-player exceptions.

- [ ] RED repeated trade-down/asset duplication.
- [ ] RED veteran-for-pick/bad-contract dumping where counterpart has no coherent reason.
- [ ] RED FA sniping/UI-order.
- [ ] RED contract backload/cap bypass.
- [ ] RED scouting certainty inference.
- [ ] RED future-pick-free-value/horizon.
- [ ] RED waiver claim insertion-order exploit.
- [ ] Implement deterministic findings; preserve failures.
- [ ] Run full CI.
- [ ] Commit: `test(package-c): add acquisition exploit audits`.

### Task 15: Integrated Package C GM-Acquisition Golden, Persistence, Replay, and Recovery

**Files:**
- Create: `packages/sim-core/src/packageCScenario.ts`
- Create: `packages/sim-core/src/packageCGoldenExpected.ts`
- Create: `fixtures/golden/package-c-golden-v1.json`
- Create: `packages/sim-core/test/packageCScenario.test.ts`
- Modify: `packages/headless/src/cli.ts`
- Modify Hermes entry/script for Package C.
- Modify: `packages/sim-core/src/index.ts`
- Evidence: `evidence/package-c/**`.

**Scenario:**
- Four organizations with distinct Package B plans/authority/knowledge, scouts, agents, veterans, FAs, prospects, contracts/cap, current/future picks.
- Unresolved prospect question scouted through legitimate claims; two orgs form different beliefs/boards without latent truth.
- Veteran shopped; discovery shows plausible interest without maximum.
- Trade negotiation has at least one reject/counter/defer, then separate legal dual-proposal/dual-receipt atomic trade.
- Concurrent FA offers include fallback group + rival; no resource overcommit; one target signs elsewhere or no-deals while fallback remains actionable.
- Signing/extension/release shows future cap consequence.
- Cutdown enters waiver process; competing legal claims demonstrate deterministic priority + contract assumption; another eligible player/practice-squad signing uses shared contract/rights/cap path.
- Draft opens; current pick trades; new owner selects; rookie rights update; rookie contract uses shared path; UDFA uses shared FA path.
- Capture at least one pre-commit acquisition-impact preview and prove exact agreement with committed cap/roster/asset deltas.
- At least one stale/expired/revoked attempt fails with no state/RNG mutation.
- Final audit has no error findings.

**Interfaces:**
- `PackageCResult` includes fingerprint, chain head, revision/event count/date/RNG draws, org cap summaries, key contract/offer/trade/scouting/board/draft/waiver/receipt IDs, asset ownership summary.
- Headless `package-c-golden` runs production scenario.

- [ ] Write scenario RED before freezing expected output.
- [ ] Compare uninterrupted vs save/reload after every committed boundary; exact final result.
- [ ] Corrupt newest snapshot; recover exact result without rewriting historical reports/offers/receipts.
- [ ] Run two legal paths from same seed and prove histories diverge rather than scripted convergence.
- [ ] Node twice; freeze expected only after deterministic green.
- [ ] Hermes twice; exact identity with Node.
- [ ] Run full CI.
- [ ] Commit: `test(package-c): gate GM acquisition loop`.

### Task 16: Physical-iPhone Diagnostics, Clean-Checkout CI, and Package C Acceptance

**Files:**
- Modify root scripts/CI only as needed.
- Create/modify Hermes Package C entry.
- Modify mobile diagnostics or focused Package C diagnostic module.
- Modify: `apps/mobile/app/diagnostics.tsx`
- Create: `apps/mobile/src/diagnostics/packageCJudgement.ts`
- Test: `apps/mobile/test/packageCDiagnostics.test.ts`
- Create: `docs/release/PACKAGE_C_ACCEPTANCE.md`
- Create/update: `evidence/package-c/SHA256SUMS.txt`

**Acceptance:**
- A/B accepted historical evidence/tags untouched.
- C byte-identical on Node/Hermes for fingerprint/head/key result summary.
- Diagnostics adds **Run Package C scenario**, same production scenario direct + real Expo SQLite scratch persistence/reload/replay.
- Physical iPhone must show `Kernel vs Node: MATCH` and `SQLite round trip: MATCH` before acceptance/tag.
- Clean checkout `npm ci` then complete CI: typecheck/tests/lint/format/accepted+current goldens/architecture guard/`expo export --platform ios`.
- Acceptance doc maps invariants/exploits/evidence and explicit interpretations.
- No D code before C acceptance.

- [ ] RED mobile judgement mismatch/clean-run tests.
- [ ] Implement on-device production diagnostic.
- [ ] Capture fresh Windows + clean-checkout CI evidence.
- [ ] Run physical iPhone Package C diagnostic; record exact hashes + both MATCH rows.
- [ ] Only after every gate green: acceptance, milestone tag, git bundle, source archive, SHA-256 manifest, off-PC copy before D.
- [ ] Commit: `docs(package-c): accept GM acquisition ecology` (or leave pending if phone gate not satisfied).

---

## Package C Acceptance Contract

Package C is complete only when fresh evidence proves:

1. Accepted B saves migrate to model 3 deterministically without RNG/event/history mutation.
2. A/B historical evidence remains preserved/distinct.
3. Transaction behavior comes from one validated ruleset profile; unsupported historical rulesets fail closed for C actions.
4. Player capability has no universal OVR/fixed destiny and ordinary org/CPU paths cannot read latent truth.
5. C transaction proposals use B categories/authority/approvals/receipts through one reusable commit adapter.
6. Rights/membership are conserved/capacity constrained and changed only through legal adapters.
7. Contracts preserve integer cash, guarantees, proration, future cap, termination history; bad obligations cannot disappear by release/trade/waiver.
8. Derived cap summaries rebuild from authoritative contracts/terminations.
9. Draft picks/player rights are conserved; future-pick legality is rules-owned and value contextual.
10. Trade discovery reveals legitimate interest without maxima/private boards/private beliefs; org responses may differ rationally.
11. Trade requires current authorization both sides and atomically transfers all consequences or none.
12. Agents persist as people; relationships affect access/credibility, not magic discounts.
13. FA is simultaneous logical time, supports fallbacks/pivots/no-deal, prevents double-spend, invariant to insertion/UI order/save reload.
14. Unchanged offers do not reroll.
15. Basic waiver/practice-squad flow uses same rights/contracts/cap/authority/logical-time machinery; deterministic ruleset priority, no duplicate player/contract.
16. Scouting is value-of-information work over B claims/beliefs; no duplicate evidence engine, no latent access, no development coupling.
17. Historical scouting beliefs/reports/boards immutable after later evidence/outcomes.
18. Boards use organizational beliefs/tiers; need changes priority without rewriting evaluation; different org boards legitimate.
19. Draft order/pick ownership/selection authoritative, pauseable, no reaction-speed advantage, reuse trade/rights/agent/contract machinery.
20. Drafted rookie contract and at least one UDFA use shared contract/market paths.
21. Acquisition-impact preview is rebuildable, matches committed cap/roster/asset deltas, and contains no hidden value oracle.
22. Audits catch duplicate ownership, cap/resource overcommit, stale offers, used-pick trading, waiver inconsistencies, receipt/event mismatch, knowledge leakage without auto-repair.
23. Save/reload every boundary, replay, corrupt-latest recovery reproduce exact authoritative state/history.
24. Golden proves coherent scouting → plan/board → market → contract/trade/FA/draft/waiver → roster/cap/history loop.
25. Node, Hermes, physical iPhone direct/SQLite agree on C fingerprint/head.
26. Clean-checkout CI/lint/format/tests/architecture guard/goldens/iOS export pass.
27. D can consume C players/rosters/contracts/scouting history without second truth/development/acquisition ledgers.

## Explicitly Out of Scope for Package C

- Development/progression/decline, practice/opportunity allocation, coaching buy-in, scheme learning/install debt, medical diagnosis/healing/readiness/risk — D.
- Play-level football, game plans, scheme resolution, game injuries, GameCast/Sunday Proof — E.
- Polished Today/Watchboard/Plans/Notebook/History/search/onboarding/production negotiation screens — F.
- Complete Synthetic GM Lab, 10/25/50/100-year calibration, century-save market ecology certification, integrated emotional vertical slice — G.
- Deep agent politics, every obscure CBA mechanism, full compensatory-pick/franchise-tag/waiver **edge-case** parity beyond this basic waiver/practice-squad path, licensed/current NFL economy calibration, cloud/accounts/community/LLM prose.

## Handoff to Package D

D begins only after C acceptance. It consumes rather than duplicates stable player/person identity/baseline capability; roster rights/membership; contracts/cap obligations; acquisition/draft/waiver history and decision receipts; B claims/beliefs/provenance + C scouting report links; org plans/authority/relationships; same WorldKernel/ruleset/persistence/replay/recovery. D owns causal development, opportunity/repetition scarcity, practice intent, scheme learning/install debt, coaching buy-in, medical/readiness. It must never reinterpret scouting confidence as hidden potential or create XP progression.

## Programmer Stop Conditions

After Owen approves this plan, continue task-to-task without routine permission when required tests/gates are green. Stop and raise rather than improvise when implementation conflicts materially with frozen canon; would expose hidden truth/invent universal market value; requires unspecified ruleset mechanic that cannot safely fail closed; would bypass/redefine Package B authority/knowledge/receipt semantics; breaks migration/persistence/replay meaning; exposes dominant exploit needing product-policy decision; or reaches physical-iPhone acceptance gate.