# Package C Acceptance — Roster, Contracts, Markets, Scouting, Draft (GM acquisition ecology)

**Status: ACCEPTED (2026-10-17).** Every automated gate is green and the physical-iPhone run of the Package C Diagnostics scenario recorded MATCH on both rows (see `evidence/package-c/iphone-run.md`).
Milestone tag: `package-c-acceptance-20261017`

## What Package C delivers

Pure `packages/sim-core` (no React / React Native / Expo / SQLite / fs / clock / network, no new runtime
dependencies), extending the accepted Package B authority → proposal → approval → receipt → knowledge
substrate. One authoritative `FootballWorld` (model 3); only `WorldKernel` commits.

- Ruleset-owned transaction, season, waiver and rookie rules; unsupported rulesets fail closed.
- Player truth, roster rights and memberships, persistent agents, waiver priority and draft assets, with
  no universal OVR, no fixed potential and no trade-value oracle. Ordinary actors never read latent truth.
- A reusable authorized-domain commit adapter on the Package B gate.
- Contracts and cap: integer money, guarantees, signing-bonus proration, future cap, termination history.
- Waivers and the practice-squad path on the same rights / contract / cap / authority machinery.
- Acquisition asset ledger, rules-owned future-pick legality, impact preview, contextual trade discovery,
  reasoning, negotiation and atomic execution.
- Persistent agents, contract offers, simultaneous free agency with fallback chains and no double-spend.
- Value-of-information scouting on the Package B claims / beliefs; organizational draft boards.
- A live, pauseable draft with pick trades, rookie contracts and a UDFA bridge.
- A read-only acquisition-ecology audit (32 finding codes) and an exploit graveyard.
- An integrated, persisted, replayed 103-step golden, and a Package C on-device diagnostic.

## Gates

| Gate                                                                            | Result                                                                       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run ci` on Owen's PC (typecheck, tests, lint, format, goldens, iOS export) | PASS — `evidence/package-c/ci-windows.txt`                                   |
| Clean checkout of `4ea587d`: `npm ci`, then `npm run ci`                        | PASS — `evidence/package-c/clean-checkout-ci.txt`                            |
| Tests (core + headless + mobile)                                                | 761 passed                                                                   |
| Package A golden unchanged                                                      | MATCH (`golden:check`)                                                       |
| Package B golden unchanged (accepted v1 and current-model v2 files kept)        | MATCH (`golden:package-b:check`)                                             |
| Package C golden on Node, run twice                                             | identical, MATCH (`golden:package-c:check`, `packageCScenario.test.ts`)      |
| Package C golden on standalone Hermes, run twice                                | identical to Node, MATCH (bytecode 98) — `evidence/package-c/hermes-run.txt` |
| Alternate variant from the same seed                                            | different fingerprint, clean audit                                           |
| Save / reload at every command boundary                                         | PASS — `packageCScenario.test.ts`                                            |
| Persist → reload → replay through the store                                     | PASS                                                                         |
| Corrupt latest snapshot → repair from history, history untouched                | PASS                                                                         |
| RNG draws only on day advancement; rejected steps change no state               | PASS                                                                         |
| Final acquisition audit                                                         | 0 error findings                                                             |
| sim-core imports no RN / Expo / SQLite / fs / clock / network                   | PASS — `architecture.test.ts`                                                |
| Physical iPhone, Diagnostics → "Run Package C scenario"                         | **MATCH (2026-10-17 18:10, Expo Go)** — `evidence/package-c/iphone-run.md`   |

Package C golden (`package-c-golden-v1`), identical on Node and Hermes and on the physical iPhone:

- fingerprint `bf2e44d0c2609b59d506f90560e4248a5fe97664bb316b968f4f96fe34e055d4`
- event-chain head `3f847dec6c81e179bb285617a9d8ae9eadf7c5e7e6bea2dd0edf2f61e2424e76`
- revision 100, 199 events, final sim date 2027-04-25, RNG draws 69 (day advancement only)

## Acceptance contract → evidence

| #   | Requirement                                                                                | Where it is proven                                                                                                  |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Accepted B saves migrate to model 3 deterministically                                      | `legacyWorldMigration`, `packageBWorldMigration`, `worldModelV3` tests                                              |
| 2   | A/B evidence preserved and distinct                                                        | `legacyFixtureIntegrity`, `packageBScenario` tests; A/B goldens still match; tags untouched                         |
| 3   | One validated ruleset profile; fail closed                                                 | `transactionRules` test                                                                                             |
| 4   | No universal OVR / fixed destiny; no latent reads                                          | `playerTruthBoundary`, `scoutingKnowledgeBoundary`, `packageCSeed` tests                                            |
| 5   | B categories / authority / receipts via one adapter                                        | `transactionCommit` test                                                                                            |
| 6   | Rights / membership conserved, capacity constrained                                        | `roster`, `rosterCommands` tests                                                                                    |
| 7   | Integer cash, guarantees, proration; no vanishing obligations                              | `contracts`, `contractCommands`, `acquisitionExploits` tests (incl. extension bonus retention)                      |
| 8   | Derived cap rebuilds from contracts / terminations                                         | `contracts`, `acquisitionAudit` tests                                                                               |
| 9   | Pick / right conservation; rules-owned pick legality                                       | `assets`, `tradeMarket`, `draftTrade` tests                                                                         |
| 10  | Discovery reveals no maxima / private boards                                               | `tradeMarket`, `tradeReasoning` tests                                                                               |
| 11  | Two-sided authorization; atomic transfer                                                   | `tradeCommands`, `draftTrade` tests                                                                                 |
| 12  | Agents persist as people; no magic discounts                                               | `agents`, `playerMarketView` tests                                                                                  |
| 13  | Simultaneous FA, fallbacks, no double-spend, order-invariant                               | `freeAgency`, `freeAgencyConcurrency` tests                                                                         |
| 14  | Unchanged offers do not reroll                                                             | `freeAgencyConcurrency` test                                                                                        |
| 15  | Waiver / practice-squad on shared machinery                                                | `waivers` test                                                                                                      |
| 16  | Scouting is value-of-information over B claims                                             | `scouting`, `scoutingKnowledgeBoundary` tests                                                                       |
| 17  | Historical scouting / boards immutable                                                     | `scouting`, `draftBoards` tests                                                                                     |
| 18  | Boards from organizational beliefs; need ≠ rewrite                                         | `draftBoards` test                                                                                                  |
| 19  | Draft order / ownership / selection, pauseable                                             | `liveDraft`, `draftTrade` tests                                                                                     |
| 20  | Rookie contract and UDFA through shared paths                                              | `rookieContract`, `liveDraft` tests; golden steps                                                                   |
| 21  | Impact preview matches committed deltas; no oracle                                         | `acquisitionImpact`, `acquisitionView` tests; golden preview-agreement test                                         |
| 22  | Audits catch the listed breakages without repair                                           | `acquisitionAudit`, `acquisitionExploits` tests                                                                     |
| 23  | Save/reload, replay, corrupt-latest recovery                                               | `packageCScenario`, `replay`, `recovery` tests                                                                      |
| 24  | Coherent scouting → plan/board → market → contract/trade/FA/draft/waiver → roster/cap loop | `packageCScenario` golden                                                                                           |
| 25  | Node, Hermes, iPhone agree                                                                 | Node + Hermes above; iPhone: **MATCH (2026-10-17 18:10, Expo Go)** — `evidence/package-c/iphone-run.md`             |
| 26  | Clean-checkout CI                                                                          | `evidence/package-c/clean-checkout-ci.txt`                                                                          |
| 27  | D can consume without a second truth                                                       | Design-level only: C exposes players / rosters / contracts / scouting history from the one world; no D code written |

Only the contract items above are claimed. Items 10, 12 and 27 are covered by tests of the stated
behaviours and by design; no separate Package C "decision case" numbering exists in the repository.

## Findings made while building the golden

1. **Extension erased the old signing-bonus proration.** An extension superseded the old agreement, so its
   unamortized bonus left the cap — an exploit path for making a bad obligation disappear. Fixed: the
   extension now records an `extension_retained_bonus` termination holding the remaining proration, and the
   reservation delta excludes it. Test: `freeAgency.test.ts` (RED-proven by mutation). This changes a Task 10
   behaviour and is flagged as an interpretation below.
2. **Hermes mis-bound loop variables captured by closures** in the scenario _driver_ (`for…of` building
   steps). The first Hermes run aborted at a clear error rather than matching. The step where Node and Hermes
   first differ was located by comparing per-step fingerprints. Fixed in the driver (`forEach` callbacks);
   sim-core production code was not implicated.

## Interpretations to review

Earlier packages' tasks:

1. "Season" is the calendar year of the sim date.
2. Releasing a contract keeps signing-bonus proration as dead cap; there is no dead-cap acceleration.
3. Guaranteed-base rules follow the ruleset: the release season's guaranteed base is owed; future
   guaranteed base is owed only if the ruleset says so.
4. A waiver claim assumes the released contract (successor agreement supersedes the original).
5. On trade, a successor agreement supersedes the original; signing-bonus proration stays with the sender
   when the ruleset says so (`trade_retained_bonus` termination).
6. Belief convention `acquisition_tier`; plan objective `competitive_window`.
7. Asking the same trade inquiry again on the same day returns the recorded answer.
8. Trade-offer cap/slot reservations are not implemented; trades are revalidated at commit. "Conditional
   frameworks" are covered only by that commit-time revalidation.
9. `contenderPreference` is not applied (there is no team-results data in Package C).
10. Free-agency window gating (opens 2027-03-10 in the synthetic ruleset); default offer validity is 7 days.
11. Deferred-acceptance club choice among competing offers is a deterministic approximation.
12. An extension reservation holds only the cap delta. **(New in this package's Task 15:** the extension
    retains the old bonus proration as dead cap, per finding 1.)
13. Scouting has no observation generator (observations enter as claims); the stale-commit-by-cap path has no
    direct test.
14. There is no draft forfeit/timeout command: the draft pauses until an explicit logical command.
15. The synthetic rookie scale has `rosterBonus` 0 and `guaranteedBase` 0.
16. The seeded draft-right holder with no selection cannot sign (a draft right is exercised by selection).
17. Prospects cannot be signed before the draft completes; afterwards, undrafted prospects sign as UDFAs.

## Environment notes

- Standalone Hermes was the Linux build from the Package A evidence (same source tag, bytecode 98); the
  Windows CLI cannot run ES2015 bundles. The app's Hermes reports its own bytecode version; the physical-device
  run closes that difference.
- The frozen 66,400-byte architecture file remains locked and untouched. Package A and B tags and evidence
  were not modified.
- Expo Go was used on the phone, not TestFlight.

## Reproduce

```
npm ci
npm run ci
npm run golden:package-c:check
node scripts/hermes-golden.mjs <hermes> --scenario package-c
```

## Still needed from Owen

- Copy `C:\dev\backups\package-c-acceptance-20261017\` off the PC (and the earlier A and B backups if not
  yet done).
- `npx.cmd expo logout` (carried over from Package A).
