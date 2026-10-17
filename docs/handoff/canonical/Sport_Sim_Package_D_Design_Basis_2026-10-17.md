# Sport Sim Package D — Canonical Design Basis

Date: 2026-10-17  
Status: **APPROVED DESIGN BASIS — IMPLEMENTATION REQUIRES SEPARATE APPROVED PLAN**

This document is the focused, repo-local design basis for **Package D: Development / Practice / Medical / Opportunity**. It is derived from the already-approved project canon and the accepted Package C handoff. It does not authorize implementation by itself and does not replace the frozen architecture, project brain, game blueprint, final pre-build research synthesis, or accepted Package A/B/C contracts.

Precedence remains:

1. latest explicit user-approved amendment;
2. frozen architecture;
3. decision-core/build spec;
4. game blueprint;
5. final pre-build research synthesis;
6. approved conversation additions captured in the project brain;
7. this focused Package D extract;
8. programmer preference.

If this document conflicts materially with a higher-precedence source, stop and raise the conflict rather than silently reinterpret it.

## Package D purpose

Package D makes player careers causally real before Package E makes Sundays causally real.

It owns:

- player development and decline;
- maturation and aging effects;
- finite opportunity and repetition allocation;
- practice/development intent;
- coaching opportunity and buy-in;
- role learning and scheme learning;
- installation debt and continuity effects;
- workload and readiness;
- medical episodes, diagnosis uncertainty, structural healing, functional readiness, conditioning, reinjury risk and performance limitation;
- development/readiness history and audits;
- the Package E-facing player state that football resolution may later consume.

Package D must make a player's career understandable as the product of capability, learning, teaching, opportunity, role, continuity, health, age and circumstance without reducing that career to XP accumulation or revealing a fixed destiny.

## Accepted predecessor boundary

Package C is accepted/tagged and already owns stable player/person identity, baseline latent football-capability dimensions, roster rights/membership, contracts/cap obligations, draft/acquisition/waiver history, agents/market state, scouting reports linked to Package B claims/beliefs, draft boards and decision receipts.

D **consumes those states rather than duplicating them**.

In particular:

- `roster.players[].capabilities` remains the authoritative baseline/current football capability truth to be evolved by D rather than copied into a separate player-rating ledger;
- Package B `information.claims` and `information.beliefs` remain the only organizational knowledge/belief substrate;
- Package B authority, mandates, protected constraints, proposals/approvals/receipts and relationships remain the decision/governance substrate;
- Package C roster membership and rights remain the source of who is actually in an organization's developmental environment;
- Package C acquisition-impact preview may later consume D's derived opportunity-cost projection, but D does not create a second acquisition authority path.

## Locked architecture rules

- One authoritative `FootballWorld` exists.
- Only `WorldKernel` commits authoritative football reality.
- Human and CPU organizations use the same development, opportunity, workload and medical rules.
- Ordinary actors never read latent player capability, latent responsiveness, hidden recovery state or future trajectory directly.
- Historical observations, staff assessments, medical reports, development plans and decision receipts remain immutable as-of records.
- Evaluation change and ability change are separate mechanics.
- Scouting confidence is confidence in evidence/belief, never disguised hidden-potential probability.
- No universal OVR, potential score, ceiling grade, development trait icon, XP pool, skill points, coach multiplier, chemistry bar or morale-derived ratings buff may become authoritative truth.
- Position labels do not manufacture skill.
- More playing time is not a universal growth buff.
- Hiring a coach means hiring judgment, teaching context and authority, not buying a numerical player-development aura.
- Medical clearance, functional readiness, conditioning, reinjury risk, performance limitation, player preference and coaching usage are distinct.
- Simulation depth must not require practice-calendar clicking or weekly per-player micromanagement.
- Difficulty may not grant CPU clubs hidden development truth, faster healing, artificial progression, targeted injuries or rubber-banding.
- League-specific timing/workload/medical mechanics belong to `LeagueRuleset` where they are rules rather than model calibration.
- Save/load/replay must preserve development and medical history exactly.
- Same world + ruleset + accepted commands + RNG state must reproduce the same authoritative result.
- Package D stops before Package E's play-level football resolution and Sunday Proof, Package F's polished primary UX, and Package G's full long-horizon calibration lab.

## Core philosophy: trajectory, not destiny

A player has no predetermined final overall and no single hidden ceiling that dictates where the career must end.

Development is a **path-dependent update process**. The future range of plausible outcomes is shaped by multiple interacting factors, including:

- current physical, technical and cognitive capabilities;
- age and maturation stage;
- capability-specific malleability/responsiveness;
- processing and learning characteristics;
- adaptability;
- work/engagement habits represented only at the abstraction level justified by the canon;
- durability and health history;
- teaching quality and fit;
- meaningful repetitions;
- role clarity and role complexity;
- scheme continuity or scheme transition;
- teammates and competition for opportunity;
- game exposure;
- workload and recovery;
- circumstance and controlled uncertainty.

Package D may introduce **multi-dimensional latent developmental substrate** where needed to produce bounded, heterogeneous trajectories, but it must obey all of these constraints:

1. no field represents a player's final destination;
2. no field is a universal scalar potential or overall;
3. developmental response may differ by capability rather than one global growth rate;
4. bounds may be soft/path-dependent rather than a fixed hard ceiling;
5. relevant latent traits may themselves mature or change where canonically justified;
6. organizations cannot query the substrate directly;
7. visible staff beliefs about development must come from legitimate evidence;
8. repeated training cannot deterministically solve the hidden substrate;
9. enough volume cannot turn every player elite;
10. the same starting player in different environments can plausibly reach meaningfully different careers.

The engine may know more than an organization does. That private truth exists to resolve the simulation, not to give the user a hidden-potential puzzle to reverse engineer.

## Capability change

D evolves the existing specific player capability dimensions rather than introducing a summary rating.

Capability change is:

- dimension-specific;
- incremental rather than a once-per-year progression ceremony;
- caused by identifiable inputs rather than arbitrary upgrade points;
- bounded by plausible state/context;
- capable of improvement, plateau and decline;
- allowed to differ between physical, technical and cognitive dimensions;
- not guaranteed merely because practice or game reps occurred.

Development events should preserve enough causal provenance to answer internally: what changed, over what interval, under what opportunity/teaching/health context, and which controlled uncertainty was consumed. Player-facing explanations remain knowledge-filtered and need not reveal the latent calculation.

A meaningful development update can produce **no capability change**. Lack of growth is a legitimate result when inputs were weak, mismatched, redundant, disrupted or simply did not produce a meaningful adaptation.

## Maturation, aging and decline

Age is an input, not a switch.

There is no universal peak age and no global age-30 cliff. Different capability families may have different maturation/decline patterns, and career context can alter the realized trajectory.

The model must permit:

- early physical maturation;
- slower technical/cognitive learning;
- believable plateaus;
- gradual physical decline;
- sharper decline after accumulated health/workload consequences where justified;
- late bloomers whose opportunity, role, teaching or maturation finally align;
- veterans who lose one capability while remaining effective through other capabilities/knowledge;
- prospects who never convert tools into reliable football skill;
- careers interrupted or reshaped by health without making every injury a permanent hidden bust flag.

Long-save QA must reject identical peak ages, universal cliffs, unlimited growth, no legitimate late bloomers, and draft status acting as a hidden protection from decline or career failure.

## The Opportunity Economy

Opportunity is a scarce authoritative resource, not flavor text.

The developmental environment must account for competition for meaningful forms of opportunity, including at minimum:

- first-team repetitions;
- developmental/backup repetitions;
- meeting/teaching attention;
- role-specific installation work;
- camp/preseason opportunities;
- game exposure when Package E later supplies it;
- roster/depth-chart access to those opportunities;
- coaching attention and limited developmental bandwidth.

The exact representation may be abstracted into bounded allocation units/checkpoints rather than minute-by-minute calendars. What matters is **conservation and consequence**: giving more scarce opportunity to one player may reduce opportunity available to another.

The depth chart is therefore also a development policy.

This prevents cheap-young-player hoarding from becoming free optionality. A club can carry many prospects if rules permit it, but it cannot give every player starter-quality developmental conditions simultaneously.

## Practice and development intent

The user normally manages **intent**, not drills.

Examples of valid intent-level directions include:

- prioritize a rookie quarterback's protection/coverage recognition;
- cross-train a lineman for a second role;
- emphasize a receiver's route-family responsibilities;
- preserve continuity for a young unit;
- protect a recovering veteran's workload;
- give a developmental player more first-team exposure;
- prepare a backup for likely near-term duty.

Intent does not directly grant capability gains or repetitions. Staff translate intent into actual opportunity and teaching under current authority, beliefs, roster competition, health and scheme demands.

There must be no mandatory daily/weekly drill calendar and no optimal click sequence that farms progression.

Routine practice planning should be delegatable. The simulation should interrupt the GM only when a material developmental tradeoff, authority conflict, role decision, medical constraint or meaningful change requires attention.

## Coaching buy-in and developmental opportunity

GM enthusiasm does not guarantee coaching opportunity.

Coaches and relevant staff are persistent people with legitimate beliefs, responsibilities, relationships and authority. Their decisions about opportunity may depend on:

- their observed evidence;
- role/scheme requirements;
- player learning/readiness;
- trust and professional familiarity where legitimately established;
- organizational plans;
- current competitive incentives;
- roster competition;
- medical/workload constraints;
- explicit promises/commitments if such records exist;
- actual authority over deployment/workload/practice decisions.

This is **not** a hidden coach-buy-in meter and not a numerical development multiplier.

Coaching buy-in manifests through decisions: who receives which reps, which responsibilities are taught, which players are trusted with broader roles, which mistakes change opportunity, and which disagreements escalate through authority.

A GM may advocate, set roster strategy, make personnel decisions or exercise granted authority. The GM may not silently control HC-owned deployment simply because the UI wants a player to develop.

## Teaching and staff effects

Good teaching can improve the conditions under which learning occurs, but a coach is not a universal ratings buff.

Teaching influence should be contextual:

- expertise must relate to the responsibility/capability being taught;
- teaching has finite bandwidth;
- player responsiveness can differ;
- continuity can preserve accumulated vocabulary/familiarity;
- a staff change may alter teaching strengths and terminology without deleting player capability;
- mentor/veteran effects, if represented, must be specific and bounded rather than stackable global bonuses.

Package D should initially model only staff interactions that change meaningful decisions. Do not add dozens of cosmetic coaching ratings.

## Role knowledge, scheme learning and installation debt

Football capability and learned football knowledge are separate.

A player may possess physical/technical tools while lacking familiarity with a role, terminology, checks, protections, route adjustments, coverage rules or other responsibilities.

D owns learned-role/scheme state needed by Package E.

Scheme learning must represent **usable football knowledge**, not a generic chemistry percentage. It should be possible for a player to know some responsibilities/packages well while remaining limited in others.

Scheme/role transitions can create installation debt through:

- narrower usable concept/package depth;
- slower or less reliable recognition;
- assignment/communication mistakes;
- increased teaching demand;
- temporary restrictions in how a coach can responsibly deploy the player.

Changing a position or role label creates no capability. A real transition requires teaching, meaningful reps and evidence that the player can execute the new responsibilities.

Continuity should matter without becoming sacred: familiar systems reduce installation burden, but good staffs and adaptable players can change systems successfully.

## Workload, fatigue and readiness boundary

Package D owns persistent workload/readiness state needed to reason about development and medical decisions before Package E supplies detailed game workloads.

Workload is not automatically good or bad. It creates tradeoffs among:

- meaningful exposure;
- learning opportunity;
- fatigue/recovery;
- conditioning;
- health stress;
- readiness;
- short-term competitive need.

More reps can eventually become redundant, low-quality or counterproductive. This is essential to prevent practice farming.

Package E later supplies actual football participation/workload events into this same model. It may not invent a separate fatigue/readiness truth.

## Medical model

Package D separates concepts that sports games often collapse into one injury percentage.

At minimum, authoritative medical/readiness state distinguishes:

1. **medical episode / condition** — what occurred or is being investigated;
2. **diagnostic state** — what authorized medical actors currently believe is occurring;
3. **structural healing state** — biological/structural recovery represented at the abstraction supported by the game;
4. **functional readiness** — ability to perform relevant football actions now;
5. **conditioning** — readiness lost or regained through inactivity/work;
6. **reinjury/aggravation risk** — contextual future hazard, not a guaranteed event;
7. **performance limitation** — what current condition may restrict even if participation is possible;
8. **player preference/tolerance** — whether the player wants/is willing to participate where represented;
9. **medical recommendation** — staff advice based on legitimate evidence;
10. **coaching usage** — the actual workload/deployment decision under authority.

These states may disagree legitimately.

Examples:

- a structure may be medically healed while conditioning is not restored;
- a player may be functionally usable but at elevated reinjury risk;
- medical staff may recommend a workload limit while a coach controls actual usage within granted authority;
- a player may be cleared for participation without being capable of normal performance;
- diagnosis/prognosis may narrow over time without ever becoming a guaranteed future return date.

## Medical knowledge and uncertainty

Medical truth is not automatically organization-wide omniscience.

Authorized medical examinations/history create legitimate observations/claims. Medical staff interpret those into uncertain reports/beliefs. Other actors receive information according to organizational access/routing and authority.

The production model must never expose exact hidden healing percentages, exact reinjury rolls, guaranteed return dates or guaranteed future performance merely because the engine contains those states.

Historical medical reports remain immutable. A later diagnosis or recovery outcome does not rewrite what was reasonably believed earlier.

Different organizations may rationally price or manage the same medical uncertainty differently when they possess different legitimate evidence, staff interpretations, risk tolerance, plans and alternatives.

## Injury generation boundary

Package D owns the state machine **after a medical episode exists** and may own non-game contextual medical events only where explicitly approved by higher canon.

Package E owns play-level football and therefore owns generation of football injuries that arise from resolved football events/exposures.

E must create those episodes through D's medical interface. It may not maintain a separate injury/healing/readiness system.

Rare or contextual non-football medical events are outside Package D's initial scope unless explicitly specified later; D must not inject sensational personal incidents merely to create drama.

## Development observations and organizational beliefs

Development reality and evaluation remain separate.

Practice, meetings, tests and later games can produce legitimate observations. Those observations enter Package B's information/provenance system. Coaches/scouts/medical staff may interpret them into organizational beliefs.

A player can improve while an organization remains wrong. An organization can update its evaluation even when the player's capability did not change.

Selection bias must not become fake evidence. In particular:

- a coach benching a player because the coach already doubted him cannot count the player's lack of starts as independent evidence confirming the original doubt;
- repeated observations originating from the same underlying event/source do not become independent corroboration;
- a development plan does not expose whether the player possesses a hidden high ceiling;
- failed growth does not prove a fixed low potential.

## Development plans and authority

Package D may introduce structured player-development intent/plans, but they must plug into Package B plans/authority rather than form a parallel organizational strategy system.

Relevant existing authority categories include:

- `workload_usage`;
- `medical_clearance`;
- `scheme`;
- `game_day_activation`;
- roster/organizational plan categories where applicable.

Actions must respect the real rights holder. Advice, recommendation, approval, veto, execution and communication remain separate rights.

Overrides require actual authority and create inspectable history. A user cannot bypass a medical or coaching authority boundary simply because a development screen presents a button.

## Logical time and development checkpoints

D runs on logical simulation time only.

Development/readiness resolution should occur at explicit deterministic checkpoints appropriate to the phase, such as bounded practice/training blocks, medical reassessment points, offseason maturation checkpoints or other ruleset/model-defined intervals.

It must not depend on:

- wall-clock time;
- UI frame timing;
- how long the user leaves a screen open;
- renderer order;
- device speed;
- repeated clicking.

If controlled uncertainty is required, draws are consumed through the existing deterministic RNG at a documented authoritative commit/checkpoint. Save/reload before the same unchanged checkpoint cannot provide a fresh outcome.

There is no manual annual progression/export ceremony. Advancement and snapshots are automatic/idempotent through normal simulation time.

## Acquisition-opportunity integration

Package C intentionally left an opening for D to make developmental opportunity visible in acquisition consequences.

D should provide a **derived, non-authoritative opportunity-impact projection** that Package C/F read models may use to show consequences such as:

- additional competition for first-team/development reps;
- likely crowding of a developmental role;
- displacement of existing practice/meeting bandwidth;
- role-learning conflicts;
- likely changes in succession-plan opportunity.

This projection must:

- derive from the same authoritative roster/opportunity/development state used by D;
- never become an alternate truth store;
- never expose latent development responsiveness or hidden capability;
- never collapse to a universal development-value score;
- never block a legal acquisition merely because an algorithm dislikes the developmental fit.

It is a consequence preview, not an oracle.

## CPU organization behavior

CPU clubs use the same legitimate inputs and same development/opportunity rules as the human organization.

A competent CPU should reconcile developmental consequences with its plans. Examples:

- drafting a first-round QB should trigger a review of veteran status, rep allocation, staff fit and protection/support assumptions;
- adding another young player at a crowded position should require an explanation of where meaningful opportunity will come from;
- a coordinator departure should trigger installation/continuity review;
- a rebuild may rationally prioritize young-player opportunity;
- a contender may rationally prioritize current readiness and accept slower prospect development;
- a player who lacks opportunity may become more valuable elsewhere without the engine secretly changing his talent because he changed teams.

CPU clubs do not receive hidden responsiveness, future growth or recovery outcomes.

## Player movement and continuity

When a player changes organizations, the player carries the player's actual capabilities, health history and learned knowledge that genuinely belongs to the person.

The player does **not** automatically carry:

- an old organization's private evaluation;
- an old coach's trust/buy-in state as if it were universal truth;
- organization-specific terminology mastery that has no transferable analogue;
- guaranteed future role/opportunity.

Transferable football knowledge may reduce learning burden where responsibilities/vocabulary overlap. New organization-specific responsibilities still require installation.

A player succeeding after leaving a club must be explainable through new opportunity, role, teaching, continuity, health, maturation and circumstance — not a revenge boost.

## Derived views versus authoritative truth

Authoritative D state contains only information required to resolve development/readiness/medical reality and preserve its history.

Rebuildable/non-authoritative views may include:

- current opportunity allocation summaries;
- development trend summaries;
- role-familiarity summaries;
- readiness dashboards;
- medical timelines assembled from authoritative records;
- coaching-development assessments;
- acquisition opportunity-impact previews;
- "what changed" causal summaries;
- comparison surfaces for Package F.

A derived summary cannot feed back into the simulation as truth.

## Explainability contract

Package D must preserve three explanation layers:

1. **Recorded fact** — reps allocated, practice block completed, role installed, medical recheck occurred, player participated, capability changed internally.
2. **Attributed assessment** — coach believes recognition is limiting deployment; medical staff recommends restricted workload; scout believes the player is adapting.
3. **Debug-only cause** — latent capability/responsiveness/healing state and RNG details used by the engine.

Player-facing systems may surface layers 1 and legitimately communicated parts of 2. Layer 3 stays out of ordinary organization/player views.

This prevents "explainability" from becoming omniscience.

## Ruleset ownership and calibration boundary

Package D should distinguish **rules** from **calibration**.

Ruleset-owned examples may include:

- phase/calendar checkpoints;
- practice/offseason windows;
- roster-status eligibility for certain work;
- workload/medical decision legality;
- return/reserve timing semantics where league-specific;
- other explicit league mechanisms.

Calibrated model parameters may include:

- capability-family maturation/decline tendencies;
- adaptation rates;
- teaching/opportunity response distributions;
- recovery/readiness distributions;
- workload effects;
- injury/reinjury hazard inputs.

Package D acceptance may use a clearly synthetic calibration profile where real NFL empirical calibration is unresolved. Synthetic fixtures must never be described as validated NFL development/medical truth.

Later empirical calibration must be able to change parameter profiles without redesigning the authoritative model.

## Determinism and atomicity

A development/practice/medical/workload command either commits every required authoritative mutation or commits none.

Rejected/stale/unauthorized commands consume no RNG and mutate no state.

A multi-player opportunity allocation checkpoint must resolve from one coherent snapshot rather than order-dependent UI iteration. Reordering equivalent input records must not change the authoritative result.

Medical re-evaluation, development checkpoints and workload changes must reproduce identically across Node, Hermes and the physical iPhone given identical authoritative inputs.

## Package D anti-exploit contract

The following are explicit House Rule Graveyard targets:

### Practice farming
Repeating redundant drills/work cannot manufacture unlimited capability gains. Additional volume must face finite time, diminishing informational/training value, workload/recovery constraints and opportunity cost.

### Bench-stash farming
Keeping large numbers of cheap young players cannot develop them all at starter-quality rates without consuming scarce reps/teaching/roles/roster space.

### Stat-padding progression
Package E statistics/results cannot directly award development points. Game exposure may create meaningful learning/opportunity/evidence, but box-score accumulation is not currency.

### Position-change cheese
Changing a label creates no capability and no free market/development value. New responsibilities must be learned and genuinely executable.

### Mentor/staff stacking
Multiple coaches/veterans cannot stack multiplicative global development buffs. Teaching effects are specific, bounded and bandwidth-limited.

### Hidden-potential inference
Users must not be able to repeat a deterministic test/training action until the underlying future trajectory is decoded. Visible outcomes remain noisy/contextual evidence, not a secret-potential scanner.

### Save/reload growth shopping
An unchanged development or medical checkpoint cannot be rerolled by saving/reloading.

### Workload maxing
"Always max reps" must not dominate. Excessive or low-quality workload can consume recovery/conditioning/health budget and crowd out better work.

### CPU asymmetry
No human-only training exploit and no CPU-only development bonus. Same rules, same opportunity conservation, same knowledge boundary.

## QA and long-save health obligations

Package D should establish audits/metrics for at least:

- opportunity conservation by organization/phase;
- prospect accumulation without plausible reps;
- development gain by capability family, age, role, health, teaching context and opportunity;
- plateau/decline distributions;
- age curves without identical cliffs;
- legitimate late-bloomer frequency/tails without forcing them;
- no unlimited training growth;
- position-change transitions;
- scheme/role-learning continuity and debt;
- staff change effects without universal skill deletion;
- medical episode duration and uncertainty;
- structural healing versus functional readiness divergence;
- reinjury/aggravation patterns;
- workload/readiness coherence;
- return-to-performance trajectories;
- user/CPU symmetry;
- no save/reload reroll;
- no hidden-potential inference path;
- deterministic migration/replay/recovery.

Long-run Package G calibration will later monitor these across 10/25/50/100-year universes. D must expose the production metrics/invariants that make that possible rather than hardcoding one apparently plausible golden career.

## Named Package D scenario obligations

At minimum D should support reproducible scenarios covering:

### Developmental QB succession
A veteran starter and young QB compete for finite first-team/development opportunity under a coherent organizational plan. Different allocation choices produce different learning/opportunity histories without directly awarding XP.

### Staff/scheme transition
A coordinator or teaching context changes. Existing player capability remains, transferable knowledge remains where justified, but installation debt and teaching demands change. No universal ratings penalty.

### Position/role transition
A player is cross-trained. The position label changes nothing by itself; usable responsibility set changes only through learning/reps and can fail to become viable.

### Major injury / rehab
Diagnosis/prognosis uncertainty narrows over time; structural healing, functional readiness, conditioning, risk and usage can disagree. A return decision is made under real authority and uncertainty.

### Late-bloomer divergence
Two plausible players with similar initial organizational beliefs follow different career paths because of different maturation/opportunity/teaching/health/context, not because one carries a visible or fixed final potential.

### Opportunity squeeze
An acquisition crowds an existing developmental room. The organization must reconcile reps/role plans; the system does not develop every prospect for free.

## Package D acceptance identity

A successful Package D proves that the simulation can:

1. evolve specific player capabilities over time without OVR/XP/fixed destiny;
2. create believable improvement, plateau and decline from causal conditions;
3. conserve meaningful developmental opportunity;
4. let GM/staff authority and disagreement affect opportunity without granting magical control;
5. represent practice through intent and delegated execution rather than calendar clicking;
6. represent role/scheme learning and installation debt as football responsibilities rather than chemistry bars;
7. keep position labels from manufacturing skill;
8. separate capability change from organizational evaluation change;
9. preserve knowledge boundaries around latent development truth;
10. represent workload/readiness tradeoffs without "more is always better";
11. distinguish diagnosis, healing, readiness, conditioning, risk, limitation, recommendation and usage;
12. preserve uncertain medical prognosis and immutable historical reports;
13. allow a medically cleared player to remain limited/not fully ready;
14. allow divergent careers from the same broad starting profile without scripted destiny;
15. make an acquisition's developmental opportunity cost derivable without a hidden-value oracle;
16. withstand practice/bench/stat/position/mentor/save-reload farming exploits;
17. use the same rules and legitimate information for CPU/human clubs;
18. save/reload/replay/recover exact development and medical history;
19. reproduce authoritative D results across Node, Hermes and physical iPhone diagnostics;
20. hand Package E one coherent source of capability, learned-role knowledge, workload/readiness and medical state to consume on Sundays.

If Package D becomes a set of XP bars, drill minigames, hidden potential tiers, coach development bonuses, universal age cliffs or one injury percentage, it has failed the approved architecture even if the code is deterministic.

## Explicitly out of scope for Package D

- Play selection, play-level matchup resolution, game statistics, game-generated football injury events, GameCast and Sunday Proof — Package E.
- Polished Command Center, production development dashboards, final medical UX, onboarding and broad presentation — Package F.
- Full century calibration and statistical certification of NFL-like age/injury/development distributions — Package G.
- Giant coaching skill trees or dozens of cosmetic staff ratings.
- Daily practice scheduling/minigames.
- Detailed psychotherapy/psychiatric diagnoses, family adversity or sensational private-life events as development mechanics.
- A complete real-world sports-medicine simulator.
- Exact proprietary NFL teaching/practice processes not supported by the research.
- Hidden potential reveal mechanics.
- Guaranteed comeback/revenge narratives.

## Handoff to Package E

Package E consumes D's current player capabilities, learned role/scheme knowledge, workload/readiness, medical limitations/risk and legitimate organizational knowledge.

E owns the authoritative football event resolver. It must:

- use those D states as causal inputs rather than inventing team/player overall modifiers;
- generate actual football participation/workload evidence back into D;
- create football-origin medical episodes through D's medical interface;
- produce observations/evidence that Package B knowledge and D development can consume;
- preserve the same single `FootballWorld` and `WorldKernel` mutation path;
- never create an alternate fatigue, injury, development or scheme-familiarity ledger.

This boundary is essential: D explains how players arrive at Sunday in their current condition; E resolves what happens on Sunday; the resulting football history then becomes new causal input for future development, evaluation, health and planning.

## Programmer stop conditions

Once a Package D implementation plan is separately written and approved, the programmer may continue task-to-task without routine permission when required tests/gates are green.

The programmer must stop and raise rather than improvise when:

- implementation would introduce a fixed destiny/potential/overall/XP abstraction;
- a development mechanic leaks latent truth into ordinary decision policy;
- a coaching mechanic becomes a universal ratings multiplier;
- opportunity cannot be conserved without a product-policy decision;
- medical implementation collapses the required distinctions or exposes exact hidden prognosis;
- a Package E football assumption is required before E is designed;
- a ruleset/calibration distinction is unclear and would hardcode a fake NFL claim;
- authority would be bypassed for workload, medical clearance, scheme or activation;
- migration/persistence/replay meaning would be broken;
- a dominant development exploit requires a product-policy choice;
- physical-iPhone acceptance is reached and requires user action.
