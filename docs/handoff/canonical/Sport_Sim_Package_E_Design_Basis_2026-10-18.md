# Sport Sim - Package E Design Basis

**Package:** E - Football Engine / Sunday Proof
**Date:** 2026-10-18
**Repository baseline:** `cc29f6ebb0c912a3d69d52a67aee8635e703d299` (`docs(package-d): record final acceptance`)
**Design status:** conversational architecture approved; this written specification requires review before an implementation plan may be written.
**Implementation status:** NOT STARTED.

## 1. Purpose

Package E makes Sunday real. It must turn the people, roster, development, medical, authority, plans, contracts and information systems already accepted in Packages A-D into one deterministic football simulation whose actual causal inputs can be inspected later.

Package E is not a presentation trick and not a second sports game bolted onto the GM simulation. It is the authoritative football resolver for Fast Sim, GameCast, CPU games, replay and headless QA.

The product test is simple: a front-office decision changes who is available, what they know, what they can execute and how they are used; the football engine consumes those exact facts; the game produces consequences and evidence; the world remembers them without inventing a post-hoc "your decision mattered" modifier.

## 2. Non-negotiable inheritance from A-D

Package E MUST preserve all accepted architectural laws:

- One authoritative `FootballWorld`.
- `WorldKernel` remains the only authoritative committer.
- Same state + ruleset + command + RNG state produces the same result.
- CPU and human organizations use the same legality and knowledge boundaries.
- Historical beliefs, reports and decision receipts never rewrite with hindsight.
- Player capability truth remains `roster.players[].capabilities`; there is no OVR ledger.
- Development/readiness truth remains Package D truth.
- Medical truth remains Package D truth.
- Scheme familiarity remains Package D `roleKnowledge`; E may consume and extend its vocabulary but not duplicate its state.
- News, explanation and presentation never create football truth.
- Difficulty may not use omniscience, rubber-banding, hidden user counters or physical stat buffs.
- Fast Sim and GameCast may not use separate football engines.
- Presentation may not consume gameplay RNG.
- Rejected concepts remain rejected: team OVR winner-picking, fake chemistry bonuses, fixed-potential destiny, scripted meta, hidden counter-human logic and prose-authored reality.

## 3. Package boundary

Package E owns football competition truth and Sunday resolution.

It owns:

- versioned football rules and vocabulary;
- competition fixtures and game status;
- game-day active/inactive designation and football assignments;
- frozen pregame execution snapshots;
- offensive/defensive/special-teams call selection under legitimate information;
- play and meaningful-phase resolution;
- clock, downs, possession, scoring, penalties, substitution and eligibility semantics;
- authoritative football participation, statistics and result facts;
- football injury occurrence/exposure decisions before they enter D medical truth;
- compact authoritative play/game history required for GameCast and Sunday Proof;
- resolution-time causal references linking real upstream inputs to football consequences.

It does NOT own:

- a second roster membership model;
- capability values or OVR;
- a second fatigue/readiness ledger;
- a second medical/injury ledger;
- player development response;
- contracts, rights, cap or markets;
- organizational beliefs or scouting estimates;
- final Command Center UX;
- route geometry, collision physics or animated replay;
- empirically certified NFL calibration.

## 4. World Model 5

Package E bumps the current world model from 4 to 5 and adds one top-level authoritative domain: `football`.

The migration contract is additive and fail-closed:

- model 4 becomes the recognized `LegacyPackageDWorld`;
- D -> E migration adds an empty/seeded `football` domain and changes no prior A-D domain meaning;
- chained A/B/C/D migrations remain supported;
- current-model fingerprints move to version 5;
- old event-chain heads remain unchanged because the event chain does not embed current-world fingerprints;
- accepted historical golden artifacts are never rewritten; current-model golden expectations receive the same versioned treatment used by earlier model bumps;
- snapshot verification must recognize legacy D fingerprints explicitly;
- future unknown model versions remain rejected rather than interpreted.

The E domain must be structured so football state can be understood without reading presentation code and so no A-D truth is copied merely for convenience.

## 5. Football domain state

The minimum authoritative `football` state contains these conceptual record families:

1. **Competition/fixture records** - logical date, participants, status, rules profile and final-result reference.
2. **Game-day designation records** - fixture-scoped active/inactive state and football unit/role assignment for players who already have valid C roster membership.
3. **Game-plan execution snapshot** - the exact plan revisions, authorized staff, scheme/concept profile, constraints and intent that entered the game.
4. **Game record** - immutable final score/result, possession/clock reconciliation data, statistics, participant summary, RNG identity and play-ledger references.
5. **Resolved play facts** - compact authoritative facts sufficient to support honest GameCast and later football queries.
6. **Causal-link records/references** - resolution-time links from actual upstream decision/plan/designation/medical/development inputs to the football moments they entered.

Game-day designation is NOT roster membership. A player must first be legitimately rostered by Package C. E only records whether and how that player is available for this fixture.

## 6. Versioned football rules and vocabulary

`LeagueRuleset.rules` gains an optional, versioned `football` key, following the same fail-closed pattern as existing optional transaction and development rules.

The first profile is conceptually `FootballRulesV1` and owns deterministic football structure rather than world-specific organization choices. It contains:

- down/distance, possession, scoring and clock semantics;
- penalty categories/enforcement required by the represented game model;
- substitution and eligibility rules required by the represented game model;
- special-teams situation rules;
- scheme, formations and personnel-grouping vocabulary;
- offensive and defensive concept vocabulary;
- responsibility vocabulary;
- canonical football action keys;
- action-key -> capability-key bindings;
- concept/responsibility compatibility;
- ruleset-defined football exposure -> D workload-unit conversion;
- synthetic football outcome parameters;
- synthetic football injury exposure/occurrence parameters;
- deterministic selection/resolution ordering contracts.

The Package E acceptance ruleset MUST be explicitly synthetic. Its numeric values are engineering/calibration fixtures, not claims about current NFL probabilities, injury rates, player distributions or tactical effectiveness.

Exact real-world football weights remain calibration-dependent and MUST NOT be guessed into permanence during Package E.

## 7. Scheme, action keys and capability binding

Package D currently stores role knowledge as `(playerId, schemeKey, responsibilityKey)` and medical limitations use free-form action keys. E formalizes the vocabulary without creating new player truth.

Rules:

- `schemeKey`, `responsibilityKey` and `actionKey` used by E must resolve through the active football rules profile.
- An action definition references one or more existing capability keys and deterministic integer weights/roles. It does not produce a new persistent ability score.
- Role familiarity is read from D `roleKnowledge` for the exact scheme/responsibility entered by the play.
- Medical functional readiness is queried for the action being attempted.
- Missing or invalid vocabulary fails closed before football RNG is consumed.
- A concept may require multiple responsibilities; each participant resolves only the actions assigned to that participant.

This establishes the bridge that the Package E audit found missing: E can say which existing capabilities, learned responsibilities and readiness dimensions matter to a football action without copying them into an E-owned rating ledger.

## 8. One authoritative play resolver

The core football primitive is one pure resolver, conceptually `resolvePlay`.

The authoritative resolution unit is **one play plus meaningful football phases**, not an animation frame and not a whole-game winner draw.

The initial phase model must be rich enough to represent:

1. pre-snap selection/alignment and recognition;
2. initial assignment execution;
3. protection/block/run-fit or pressure interaction;
4. progression and target/lane selection where relevant;
5. coverage/contest or ball-security interaction where relevant;
6. ball progression and result;
7. contact/finish and football exposure;
8. flags/administrative resolution;
9. clock, possession, scoring and next-state effects.

Special-teams plays use the same authoritative game state and deterministic machinery. They are not a separate quick-sim path.

A resolved phase may derive temporary matchup margins or execution values internally. Those derived values are ephemeral resolver data, not persistent ratings. There is never a persistent team-strength or player-OVR value that selects a winner.

## 9. Independent pre-play commitment and information safety

Before a play resolves, offense and defense select personnel/assignments/calls from separate legitimate information snapshots.

Neither side may inspect the opponent's final call before both calls are committed.

The implementation must make this structural rather than relying on programmer discipline:

- offensive selector input excludes the defensive final call;
- defensive selector input excludes the offensive final call;
- both selectors may consume legitimate public/organizational evidence and observable strategy tendencies;
- neither selector receives opponent latent capabilities, private plans, private medical truth or hidden future randomness;
- the play resolver may consume both committed calls and latent player truth only after commitment because it is the internal reality resolver, not an organizational decision-maker.

A dedicated test must prove that changing the opponent's final call after selector input construction cannot alter the already selected call through information leakage.

## 10. GM intent and coaching execution

No new `PlanKind` is required for Package E. Existing `strategy` plans are sufficient for intent-level football planning and preserve Package B's plan architecture.

Authority semantics are:

- `organizational_plan` / `strategy`: organizational and GM intent;
- `scheme`: scheme/game-plan and coaching execution authority;
- `game_day_activation`: fixture-scoped active/inactive designation;
- `workload_usage`: intended usage constraints and authorized workload decisions;
- `medical_clearance`: the hard legal medical participation boundary.

Package E opens the already-reserved `game_day_activation` category through the established proposal/domain-commit pattern.

A **GamePlanExecutionSnapshot** freezes the exact authorized plan revisions, staff identity, relevant scheme/concept profile, constraints and intent that actually entered a game.

Per-play coaching calls do not create a new proposal record for every snap. They are operational decisions executed under authority already validated for that fixture. The game record must retain enough references to prove which authority/plan snapshot governed those calls.

CPU organizations and the user organization follow the same path. No special "player team" football authority is implied by UI control.

## 11. Game-day designation and eligibility

Package E creates fixture-scoped designation/assignment records only for players with valid Package C roster membership on the game date.

A designation may capture active/inactive state plus the football unit/role/depth assignment necessary for the represented game model.

It must not duplicate C's `active`, `reserve` or `practice_squad` membership status.

Eligibility validation occurs before game resolution and includes:

- valid roster membership/rights required by existing C rules;
- fixture-scoped activation legality;
- medical clearance hard limits;
- ruleset-defined position/personnel/substitution eligibility;
- any committed protected constraints or authority requirements relevant to the designation.

Package E does not invent real-world practice-squad elevation or inactive-list rules unless they are explicitly represented in a versioned rules profile. Synthetic acceptance rules may use a minimal deterministic legality profile.

## 12. Time advancement and game resolution

Football game resolution is NOT hidden inside the existing `AdvanceDays` daily RNG loop.

The contract is:

- `AdvanceDays` may advance to the logical date of the next unresolved scheduled game.
- It may not cross an unresolved scheduled-game boundary.
- A request that would cross one fails before consuming RNG or mutating authoritative state and identifies the blocking fixture/date.
- A separate authoritative command, conceptually `ResolveScheduledGame`, resolves the due game exactly once.
- `ResolveScheduledGame` is simulation-progression authority, not football decision authority. It accepts the same actor-kind progression set as `AdvanceDays` (`human_gm`, `commissioner`, `system`, `test_harness`); the actor kind may authorize progression but MUST NOT affect calls, participants, probabilities, RNG order or any football result.
- CPU organizations and delegates do not acquire calendar/game-resolution authority merely because they participate in the fixture.
- After the game is final, logical time may advance again.

This preserves accepted Package D daily RNG ordering and creates an explicit save/reload boundary before kickoff.

Package F/G may orchestrate these primitives into a seamless user action such as "advance to next meaningful event," but the lower-level simulation semantics remain explicit.

## 13. Game command and atomicity

For Package E, a complete scheduled game resolves as one kernel command while the internal `resolvePlay` primitive remains independently pure and testable.

This means:

- all validation finishes before the first football RNG draw;
- the command uses a local deterministic RNG seeded from the current world RNG state;
- every play is resolved by the same play resolver;
- if resolution fails, the kernel rejection/fault contract leaves world, audit chain and RNG untouched;
- if it succeeds, the game commits one world revision with one final RNG snapshot and the required event specs;
- the fixture becomes final exactly once, preventing save/reload rerolls.

This design controls command volume now without blocking a later authorized interactive mode. A future product may pause at drive/play boundaries only if it preserves the exact same resolver and deterministic continuation contract.

## 14. RNG contract

Package E uses the existing single world RNG. It does not create a second gameplay RNG stream.

The initial football resolver must define a canonical draw schedule with stable ordering. Draw consumers are named by purpose rather than scattered ad hoc through presentation or orchestration code.

Requirements:

- no `Math.random()` or wall-clock entropy;
- integer/fixed-point/basis-point football math for authoritative resolution;
- deterministic participant ordering, normally stable record/player id order where no football ordering is required;
- no RNG consumption by presentation, explanation, replay formatting or fast-forward controls;
- game record stores `rngDrawStart` and `rngDrawCount`;
- resolved play facts store enough draw identity/trace references for diagnostics without exposing hidden rolls to normal organization-facing views;
- invalid games, calls or participants fail before the first football draw;
- the same saved pregame state cannot be resolved twice into two accepted outcomes.

The exact number of draws per play may vary by play type/phase, but for a given validated input path the order and count are deterministic and covered by tests.

## 15. Fast Sim, GameCast and replay

There is exactly one football outcome path.

`ResolveScheduledGame` repeatedly invokes the authoritative play resolver until the game reaches a legal final state. It produces the play ledger, statistics, score and causal records.

- **Fast Sim** suppresses/condenses presentation of those already-resolved facts.
- **GameCast** reveals those same resolved facts progressively.
- **Replay/history** reads those same facts.
- **CPU-vs-CPU** uses the same game resolver.
- **Headless QA** uses the same game resolver.

Watching, skipping, changing animation speed or requesting deeper explanation must consume zero gameplay RNG and must not change the final world fingerprint.

No presentation component may infer a different completion, target, sack, turnover, penalty, injury or score from the resolver output.

## 16. Actual football usage -> Package D

The audit identified a required missing boundary: D has no explicit ingress for actual game workload.

Package E therefore requires a new **Package-D-owned pure mutation interface**, conceptually `applyFootballUsageEvidence`.

E supplies factual game exposure, such as:

- player id;
- fixture/play references;
- action/responsibility exposure;
- meaningful rep counts;
- contact/exposure classification;
- ruleset-defined workload units;
- logical game date.

D owns the response. The D ingress may update only D-owned truth, including readiness/fatigue/load and role-learning/development causal records as appropriate.

Rules:

- E never directly edits `development.readiness` or D development events.
- E never creates a second snap-count-derived fatigue field in `football`.
- `maxPlayerLoadUnitsPerCheckpoint` is not silently redefined as "snaps."
- `FootballRulesV1` defines deterministic conversion from represented football exposure to D workload units.
- D remains the authority for how those units affect conditioning, acute fatigue, accumulated load and development/learning.
- postgame D state must be derivable only through the explicit ingress, so the boundary can be independently tested.

Persistent football participation/stat facts may remain in E because they are historical game facts; they cannot become a second physiological state.

## 17. Medical clearance, recommendations and usage

Package E consumes existing Package D interfaces:

- `functionalReadiness(world, playerId, actionKey)` for engine-facing functional readiness;
- `medicalWorkloadCap(world, orgId, playerId)` for the hard clearance cap.

The medical hierarchy remains deliberately non-collapsed:

- clearance is the hard legal participation boundary;
- recommendation is advice/context, not a veto by itself;
- player preference is context, not a veto by itself;
- coaching usage may be lower than the legal cap;
- actual usage may never exceed the hard clearance cap.

The game resolver tracks actual authorized exposure and must stop further participation when a hard cap is reached. Attempts to produce an illegal usage path fail rather than silently exceeding clearance.

## 18. Football-origin injuries

Package E owns whether a football exposure causes a new injury occurrence. Package D owns the resulting medical truth.

The accepted ingress is `createMedicalEpisodeChange` with `sourceKind: 'football'`.

E's synthetic football rules may determine occurrence/exposure inputs, affected action keys and severity/risk inputs needed by the D medical episode contract. E may not invent a return date or maintain an E-owned injury flag/episode list.

When an injury is generated during game resolution:

1. the football play/exposure fact is recorded;
2. E composes the existing D medical ingress into the same authoritative resolution;
3. the new episode exists in `medical.episodes`;
4. subsequent game participation/readiness checks consume the updated D medical truth;
5. any substitution/removal follows normal game legality and authority, not a hidden presentation rule.

Injury probability/severity calibration in Package E is explicitly synthetic and versioned. Empirical injury calibration belongs to later targeted research/calibration work.

## 19. Football facts, observations and Package B information

The engine is not a fake person and must not create staff opinions under a synthetic `sourcePersonId`.

Package E distinguishes:

### 19.1 Authoritative football facts

These are reality records/events: calls/concepts actually used, participants, assignments actually resolved, down/distance, target/lane where represented, result, score/clock, statistics, workload exposure and injury occurrence.

### 19.2 Legitimate organizational observations

Interpretive claims enter Package B only through a real observing person or an explicitly modeled organization process that can be traced to real people/roles. Such claims carry the existing B provenance fields: source, visibility, holder organizations, confidence and possible bias.

An organization-facing claim may describe observable execution or a staff interpretation. It must not contain latent capability values, private opponent state, hidden RNG rolls or debug-only causal coefficients.

The required information flow is:

`football reality -> legitimate observation -> Claim -> Belief`

not:

`engine latent truth -> GM-visible claim`.

## 20. Sunday Proof causal ledger

Sunday Proof records causality at resolution time from inputs that truly participated in football resolution. It never applies a bonus because a decision was important or because a narrative later wants a satisfying explanation.

The system has three disclosure layers:

1. **Private engine trace** - exact internal resolver inputs/derived values/trace references; debug/test only.
2. **Football fact layer** - what actually happened and may be safely stored as game history.
3. **Organization-facing explanation layer** - only facts/claims/causal links the organization can legitimately know or infer.

A valid causal chain may link, for example:

`decision receipt -> roster membership/designation -> game-plan snapshot -> responsibility/role knowledge -> resolved matchup/action -> play consequence`.

The causal record states participation and contribution, not philosophical certainty. No single noisy play must be labeled as exclusively caused by one offseason decision.

Narrative/UI may summarize recorded links but cannot create, strengthen or rewrite them.

## 21. History, GameCast payload and retention

Package E stores compact authoritative football facts, not an unbounded copy of every internal diagnostic value.

Always-retained game history must support:

- final score/result and game status;
- team/player statistical reconciliation;
- participation/workload summary;
- medical episode references created by the game;
- immutable play-ledger identity/references;
- score/clock/possession reconciliation;
- selected causal-moment references needed by Sunday Proof;
- the exact game-plan/authority snapshot that governed execution;
- RNG start/count and deterministic replay identity.

The resolved play ledger retains only detail that the engine actually resolved and that is required for honest GameCast/history: down/distance, personnel, legitimate call/concept disclosure, principal assignments/matchups represented by the model, play result, score/time and factual event references.

Debug-only intermediate numeric margins and latent capability contributions are not automatically permanent career-history fields.

Package E must expose measurable storage counters (for example games, plays, events and serialized bytes) so Package G can test long-save cost. Package E does not claim Year-100 performance certification.

## 22. Error handling and fail-closed rules

Football commands fail without mutation when any required precondition is invalid, including:

- fixture not due or already final;
- participant organization mismatch;
- invalid/missing roster membership;
- illegal or duplicate activation/designation;
- ruleset football profile absent when required;
- unknown scheme/concept/responsibility/action key;
- invalid game-plan/authority reference;
- unresolved proposal/commit precondition;
- illegal medical usage or clearance conflict;
- impossible clock/down/possession state;
- non-canonical selector/resolver input;
- attempt to cross unresolved fixture through `AdvanceDays`;
- record-id collision or malformed E record;
- invalid D usage-ingress or medical-ingress result.

All validation that can be completed without randomness must finish before the first football RNG draw.

A resolution-time invariant failure is a fault, not permission to partially save a game. The accepted kernel atomicity contract remains authoritative.

## 23. Required audits and anti-exploit checks

Package E must add dedicated audit coverage for at least:

- no second capability/OVR truth;
- no second readiness/fatigue truth;
- no second medical/injury truth;
- no cross-team private-information leakage;
- offense cannot read defense final call pre-commit and vice versa;
- CPU and human game legality symmetry;
- no playing beyond medical clearance;
- every participating player was legitimately rostered and designated;
- no presentation RNG consumption;
- no Fast Sim/GameCast outcome divergence;
- no save/reload reroll of a final or due game;
- no duplicate resolution of a finalized fixture;
- no direct football outcome from team identity, user-control status, win streak or OVR;
- no Sunday-Proof link to an input that did not enter resolution;
- no organization-facing record containing latent capability values or hidden RNG/debug data;
- football-generated injury state exists only through D medical truth;
- actual football workload enters D only through the explicit D-owned ingress.

These should be regression tests, not review-only conventions.

## 24. Testing strategy

Package E uses TDD and follows the established package pattern: RED -> GREEN -> targeted verification -> package golden -> full CI -> cross-runtime/device acceptance.

Testing layers:

### 24.1 Pure unit tests

- rules/profile parsing and exact-key rejection;
- action/capability binding;
- selector input boundaries;
- play phase semantics;
- clock/down/possession/scoring transitions;
- penalty/substitution/eligibility rules represented by V1;
- deterministic workload conversion;
- D usage-ingress composition;
- injury ingress composition;
- causal-link construction and disclosure filtering.

### 24.2 Distribution/mechanism tests

Synthetic repeated trials must prove that changing a relevant capability, role familiarity, readiness, concept matchup or tactical input changes outcome distributions in the expected direction without guaranteeing an outcome.

These are mechanism tests, not claims of NFL calibration.

### 24.3 Invariant and adversarial tests

- hidden-information probes;
- human/CPU symmetry;
- illegal designation/usage attempts;
- stale authority/plan references;
- save immediately before/after game;
- fixture resolution attempted twice;
- presentation/fast-forward equivalence;
- order/randomness perturbation checks;
- malformed rules/vocabulary fail closed.

### 24.4 Integrated game tests

A complete synthetic game must reconcile:

- legal start/end state;
- score;
- downs/possession/clock;
- player/team statistics;
- participation/workload;
- D readiness/learning write-back;
- D medical episodes;
- RNG draw accounting;
- event/audit chain;
- replay from genesis.

## 25. Golden, persistence, replay and cross-runtime gates

Package E reuses the established acceptance machinery rather than inventing a second test harness.

Requirements:

- new Package E golden scenario and expected artifact;
- A/B/C/D historical goldens remain preserved and independently checkable under versioned current-model handling;
- `golden:package-e:check` becomes part of canonical CI;
- Package E Hermes check is included in canonical CI rather than existing only as an optional script;
- Node and Hermes must match world fingerprint, event-chain head, result identity and RNG draw identity for the E golden;
- SQLite save/reload/replay must match direct execution;
- a clean install must pass canonical CI;
- physical iPhone diagnostics must resolve/reload the same Package E scenario and match accepted Node/Hermes identity.

The implementation plan must preserve accepted Package D evidence until the new model-version expectations are intentionally versioned. Old accepted golden files are never rewritten in place.

## 26. Package E acceptance contract

Package E is acceptable only when all of the following are simultaneously true:

1. One authoritative play resolver drives complete games.
2. Fast Sim, GameCast, CPU games, replay and headless QA consume the same resolved football.
3. Offense and defense commit without peeking at the opponent's final call.
4. Relevant player capability changes alter football distributions without deterministic guarantees.
5. Role/scheme knowledge can affect the actions it legitimately governs without becoming a generic chemistry bonus.
6. Functional readiness and medical limitation affect eligible football actions through D truth.
7. Medical clearance hard caps cannot be exceeded.
8. Actual game usage updates D only through the explicit D-owned usage ingress.
9. Football-origin injuries create D medical episodes and no E-owned injury truth.
10. Clock, downs, possession, scoring, substitutions, represented eligibility, penalties and special teams reconcile for the complete synthetic game.
11. Player/team statistics reconcile with the play ledger and final score.
12. A scheduled game resolves exactly once on its logical date and cannot be rerolled by save/reload.
13. `AdvanceDays` cannot silently cross an unresolved game boundary.
14. Resolution is deterministic across Node and Hermes; physical iPhone matches the accepted identity.
15. Presentation/fast-forward consumes no gameplay RNG and cannot change the final fingerprint.
16. Engine/debug latent truth never leaks into organization-facing claims/views.
17. Sunday-Proof links are created from real resolution-time inputs and never from a post-hoc importance modifier.
18. CPU and human clubs use identical legality and knowledge contracts.
19. Persistence/replay/recovery continues through the real kernel and reproduces the accepted game.
20. A/B/C/D accepted invariants and goldens continue to pass under intentional versioning.

Passing this contract proves the **football-engine foundation**, not complete NFL statistical calibration, full playbook expressiveness, advanced animation or final product UX.

## 27. Explicitly deferred beyond Package E

The following are intentionally outside Package E acceptance:

- real NFL probability/injury/statistical calibration;
- full current CBA/game-day rulebook replication unless separately sourced/versioned;
- giant playbook/content breadth;
- route-coordinate animation or collision physics;
- polished 2D GameCast rendering;
- final Command Center decision surfaces/onboarding;
- full 32-club calendar generation and career vertical slice;
- long-horizon Year-100 certification;
- endogenous league tactical evolution/meta calibration;
- cloud/challenge/community/monetization systems.

Package F owns the polished decision surfaces and onboarding. Package G owns the integrated playable loop, simulation lab, calibration and long-run stress evidence.

## 28. Implementation planning constraints

The implementation plan that follows this design must:

- be dependency ordered;
- use one reviewable commit/push per accepted task;
- use TDD for every product behavior change;
- isolate substantive implementation in a dedicated worktree/branch following the established workflow;
- never apply/pop/delete `stash@{0}` (`rescueadmin-pre-final-package-d-20261017`);
- never treat stale `PROGRAMMER_HANDOFF_CURRENT.md` as current truth;
- preserve `WorldKernel` as sole committer;
- introduce D-owned usage ingress before game code depends on it;
- introduce football vocabulary/rules before selectors/resolvers depend on it;
- implement information boundaries before sophisticated tactical behavior;
- build clock/rules/stat reconciliation before presentation polish;
- add audits before declaring any milestone complete;
- perform independent review at the hidden-information, medical/readiness, determinism and Fast Sim/GameCast boundaries;
- stop rather than guess if a task would require a new product decision outside this specification.

## 29. Recommended implementation dependency shape

The exact task file list belongs in the later implementation plan, but the safe dependency order is:

1. model-5/rules/vocabulary substrate;
2. D football-usage ingress and its truth-boundary tests;
3. game-day activation/designation and authority commit path;
4. competition fixture/game-state substrate and `AdvanceDays` blocking semantics;
5. separate offensive/defensive selector input boundaries;
6. pure play/phase resolver with deterministic RNG contract;
7. clock/downs/possession/scoring/penalties/substitutions/special teams;
8. complete-game orchestration;
9. D workload/readiness/learning write-back;
10. football-origin medical ingress;
11. factual football history/stat reconciliation;
12. Package B observation/evidence emission and knowledge-safe views;
13. Sunday-Proof causal records/queries;
14. Fast Sim/GameCast/replay consumers of identical facts;
15. audits/exploit suite;
16. golden/replay/persistence/CI/Hermes/mobile acceptance.

No product code may start until this written design is reviewed and a separate implementation plan is written and reviewed.

## 30. Decision ledger for Package E

### Locked by this design

- World Model 5 adds one `football` domain.
- One play resolver and one complete-game engine path.
- Complete game is one kernel command for Package E.
- `AdvanceDays` stops at unresolved scheduled games; it does not secretly resolve them.
- Existing single world RNG; authoritative football uses deterministic integer/fixed-point math.
- Football rules own concept/responsibility/action vocabulary and action-to-capability binding.
- Existing `strategy` PlanKind remains; no Package E game-plan PlanKind is added.
- Reserved `game_day_activation` authority category is opened.
- Game-day designation never duplicates Package C roster membership.
- D gets a D-owned explicit actual-football-usage ingress.
- E owns football injury occurrence; D owns medical episode truth.
- Engine facts and staff interpretations are distinct.
- Sunday Proof records real causal participation at resolution time.
- GameCast/Fast Sim/presentation consume resolved football and no gameplay RNG.
- Package E calibration remains explicitly synthetic.

### Intentionally calibration-dependent, not programmer-decided

- exact football probability weights;
- real injury frequencies/severity distributions;
- exact workload equivalence to NFL snaps/contact;
- full tactical catalog breadth and balance;
- real league scoring/stat distributions;
- final retention/performance budgets for century saves.

These are later evidence/calibration problems, not unspecified holes in the Package E architecture.

## 31. Final architectural test

A programmer is safe to implement Package E only if they can answer all of these without guessing:

- What state does E own, and what A-D truth must it never duplicate?
- What blocks `AdvanceDays` at kickoff?
- How do offense and defense commit without call leakage?
- Where do action keys and capability bindings come from?
- How does actual game exposure reach D?
- Where does a football injury live after occurrence?
- Which layer may see latent capability truth?
- Why can Fast Sim and GameCast never disagree?
- How is a game prevented from rerolling after save/reload?
- What makes a Sunday-Proof link legitimate?
- Which numeric policies are synthetic versus empirically calibrated?
- What does Package E explicitly defer to F and G?

If any answer conflicts with this document or accepted A-D architecture, implementation stops at the conflict rather than inventing a local workaround.
