# Package B Acceptance — Organizational Substrate

**Status: NOT YET ACCEPTED.** Every automated gate below is green. The one remaining gate is the
physical-iPhone run of the Package B Diagnostics scenario, which needs Owen's hands. No milestone tag
exists until that gate records MATCH.

## What Package B delivers

Pure `packages/sim-core`, no React / React Native / Expo / SQLite / fs / clock / network:

- Role episodes and role-bound authority with six independent rights (propose, advise, approve,
  veto, execute, communicate); mandates only narrow transferable authority; protected constraints.
- Provenance-safe claims and beliefs; one knowledge filter shared by human reads, command
  validation and CPU reasoning.
- Multi-dimensional, causal relationships (no universal score).
- Proposal, approval and decision-receipt state machine; one commit gate that re-derives authority.
- Organizational plans committed only through that gate.
- Knowledge-safe reasoning interface and a read-only coherence audit.
- A two-organization golden scenario, persisted, reloaded and replayed.

## Gates

| Gate                                                               | Result                                          |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| `npm run ci` (typecheck, tests, lint, format, goldens, iOS export) | PASS — `evidence/package-b/ci-windows.txt`      |
| Clean checkout of 0e94970: npm ci, then npm run ci                 | PASS - evidence/package-b/clean-checkout-ci.txt |
| Core + mobile tests                                                | 383 passed                                      |
| Package A golden unchanged                                         | MATCH `ca1b4957…0df3` / `d9c18cb9…897a`         |
| Package B golden on Node, run twice                                | identical, MATCH                                |
| Package B golden on standalone Hermes, run twice                   | identical, MATCH (Hermes bytecode 98)           |
| sim-core imports no RN / Expo / SQLite / fs / clock / network      | PASS — `architecture.test.ts`                   |
| Save / reload at every command boundary                            | PASS — `packageBScenario.test.ts`               |
| Corrupt latest snapshot → repair from history, history untouched   | PASS — `packageBScenario.test.ts`               |
| Physical iPhone, Diagnostics → "Run Package B scenario"            | **PENDING (needs Owen)**                        |

Package B golden (`package-b-golden-v1`), identical on Node and Hermes:

- fingerprint `fc1163b8df89db98d951a6393341986c72992853eea4198bb678c941a36c064c`
- event-chain head `934b6d86fe79af00c6de40da67e64e1b4bdb7039701c7c45af1598a61ed4f9d0`
- revision 20, 33 events, final sim date 2026-10-19, RNG draws 3 (day advancement only)

## Decision cases owned by Package B

| Case  | Where it is proven                                                                      |
| ----- | --------------------------------------------------------------------------------------- |
| DC-01 | `authority.test.ts` — partial rights never suffice                                      |
| DC-02 | `decisionStateMachine.test.ts` — joint approval                                         |
| DC-03 | `decisionStateMachine.test.ts` — material revision invalidates approvals                |
| DC-04 | `authority.test.ts`, `decisionStateMachine.test.ts` — revoked grant, later commit fails |
| DC-05 | `authority.test.ts` — 100 units pass, 101 escalate                                      |
| DC-06 | `authority.test.ts` — protected constraints                                             |
| DC-07 | `decisionStateMachine.test.ts` — retry links a new revision, old attempt kept           |
| DC-09 | `decisionStateMachine.test.ts` — exclusive deadline                                     |
| DC-12 | `knowledgeView.test.ts` — rival-only private claim leaves no trace                      |
| DC-13 | `authority.test.ts` — role end ends role-bound grants and mandates                      |
| DC-14 | `relationships.test.ts` — repeating an action repeats no effect                         |
| DC-17 | `information`, `knowledgeView`, `decisionStateMachine`, `planDecisionIntegration` tests |
| DC-19 | `reasoning.test.ts` — human/CPU symmetry                                                |

Only the cases named in the Package B plan are mapped. The repository's documents do not define
DC-02, DC-03, DC-07 or DC-09 beyond their names, so those four were implemented from the plan's
wording (see interpretations). Any other DC numbers are not defined in the repository and are **not**
claimed here.

## Interpretations to review

1. Authority is evaluated for an explicit `actingPersonId` in the command. Actor kind confers
   nothing, except relationship effects, which only system / commissioner / test_harness actors may
   record.
2. Authority-structure commands need `execute` on `organizational_authority` (the seed's grants carry
   no `staff_role`).
3. Ending a role also ends that person's role-bound grants and mandates, as extra events in the same
   revision, unless another role still covers the next day.
4. Information commands use `advise` (claims, beliefs) and `communicate` (sharing) on
   `organizational_plan`. Restricted claims are visible only to their source or an `execute` holder on
   organizational authority. A hidden claim is indistinguishable from a missing one.
5. DC-09 "exclusive deadline" is read as: a proposal is dead on the `expiresAt` date itself.
6. DC-03 "material revision" is a change to category, subjects, terms type or terms. Other changes keep
   approvals.
7. Plan inertia: a plan revision that changes or removes an objective or a hard constraint, or a new
   plan in an occupied scope, needs at least one visible change-reason reference. Preferences change
   freely.
8. The coherence audit does not check "decisions violating hard plan constraints": no domain adapter
   yet defines what a constraint means for a real action. It checks plan reversals, stale mandates and
   missing receipt references.
9. `testRouter` is a constructor-only, test-only kernel seam; production code never configures or
   persists it.
10. The Task 9 interfaces and implementation were written before their tests rather than strictly
    RED-first; the tests were then added and pass.

## Environment notes

- Standalone Hermes: the Windows `hermes.exe` shipped with the prebuilt CLI rejects ES2015 class
  expressions, so the Hermes run used the Linux build from the Package A evidence (same source tag,
  bytecode 98). The app's own Hermes reports bytecode 99; only the physical-device run closes that
  difference.
- The frozen 66,400-byte architecture file remains locked and untouched.
- Expo Go was used on the phone, not TestFlight.
- ESLint 9 with a TypeScript-6 shim, as in Package A.

## Reproduce

```
npm ci
npm run ci
npm run golden:package-b:check
node scripts/hermes-golden.mjs <hermes> --scenario package-b
```

## Still needed from Owen

- Run Diagnostics → **Run Package B scenario** on the iPhone and report whether both rows say MATCH
  and the fingerprint / chain head equal the values above.
- Copy `C:\dev\backups\package-a-acceptance-20261017\` (and the Package B archive once made) off the PC.
- `npx.cmd expo logout` (carried over from Package A).
