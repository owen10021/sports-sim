# Sport Sim — Package F Product/UI Design Specification

**Date:** 2026-10-18
**Status:** DRAFT FOR USER REVIEW
**Authoring baseline:** `package-e-implementation` at `041856c5353937fc153c7d0ffced2c295364fa0f`
**Purpose:** Define the polished iPhone-first product shell, decision surfaces, onboarding, information architecture, GameCast presentation, history surfaces, accessibility/performance contract, and long-save UX rules that sit on top of accepted Packages A–E without creating a second simulation authority.

## 1. Product promise

Sport Sim is a professional-football front-office / franchise-rebuild / GM career game.

The player does not control athletes on the field and does not become a play-caller by default. The core fantasy is:

> Build the organization. Hire the people. Set the philosophy. Make the consequential calls. Let football reveal the consequences.

Package F must make the deep simulation legible, fast and enjoyable without flattening uncertainty, authority, causality or organizational disagreement into arcade meters.

Success is not “a polished first season.” A player who reaches two seasons and feels they have seen the whole game represents a product failure. Package F must therefore optimize for Year 10+, hundreds of hours, repeated offseason workflows and an accumulated fictional league history that becomes more meaningful over time.

## 2. Package F scope

Package F owns:

- the production mobile navigation shell;
- Islaria studio identity and first-launch product welcome;
- onboarding and guidance modes;
- the Command Center / task-home experience;
- player, roster, depth, development and medical presentation;
- transaction, contract, free-agency, scouting and draft decision surfaces;
- staff and organizational-management presentation;
- league, team, person and season history presentation;
- weekly cadence and “continue to next meaningful event” orchestration;
- game-day preparation UX;
- Fast Sim, Condensed GameCast and full GameCast presentation over the same Package E resolved facts;
- postgame and Sunday Proof presentation;
- product design system, team theming, accessibility and performance rules;
- long-save workflow protections and navigation-state preservation;
- derived, non-authoritative read models required by these surfaces.

Package F does **not** own:

- a second authoritative world or mutation path;
- a separate fast-sim football engine;
- live play calling or true mid-game intervention;
- new hidden player truth, universal overall, fixed potential, trade-value oracle or offer-score oracle;
- empirical NFL calibration that Packages C–E explicitly deferred;
- century simulation certification, league tactical/meta evolution, community/cloud/challenge systems or monetization;
- 3D gameplay, route-coordinate collision simulation or Madden-style direct player control.

True deterministic mid-game intervention is reserved for Package G or a later explicit engine extension because Package E currently resolves a scheduled game atomically.

## 3. Non-negotiable architecture boundaries

Package F is presentation and orchestration over accepted A–E domains.

- `FootballWorld` remains the only authoritative world.
- `WorldKernel` remains the only authoritative committer.
- Mobile UI never stores an independent mutable copy of authoritative football reality.
- Presentation/read models are derived, disposable and non-authoritative.
- Human and CPU organizations obey the same domain legality and information boundaries.
- Ordinary user-facing views never read latent player capability, latent healing truth, hidden opponent state, hidden RNG rolls or debug-only causal coefficients.
- Historical claims, beliefs, reports, proposals, approvals, offers, receipts and evaluations remain immutable as-of records.
- A derived summary may not feed back into the simulation as truth.
- Fast Sim, GameCast, replay, CPU-vs-CPU and QA consume the same Package E game result path.
- Presentation, animation speed, watching, skipping and deeper explanation consume zero gameplay RNG and cannot change world fingerprints.
- Package F may orchestrate lower-level commands into user-friendly flows but may not redefine command legality or logical-time semantics.

## 4. Core product design laws

### 4.1 Depth is allowed; friction is not

Complex simulation is a feature. Complex navigation is not. Important information should travel with the decision that needs it.

### 4.2 Surface the decision, not the menu containing the decision

A Command Center item should say what requires judgment, not merely point to “Medical — 1 new.”

### 4.3 Preserve place and context

Opening a player/prospect/offer and going back must restore the prior list, filters, sort, selected tab and approximate scroll position. This applies to roster, scouting, draft, free agency, transactions, standings and history.

### 4.4 Progressive disclosure

Every major screen should support a useful five-second summary and deeper inspection one action away. Dense information is acceptable; indiscriminate simultaneous information is not.

### 4.5 Comparison is first-class

Roster, draft, trade and free-agency decisions must support direct comparison with consistent rows and organization-facing knowledge.

### 4.6 Theme the room; do not rearrange the furniture

Team identity may change visual atmosphere, accents, imagery and game-week presentation. Navigation structure and interaction logic remain stable across teams and saves.

### 4.7 Motion explains state

Motion may clarify movement, selection, draft flow or GameCast progression. It may not make repeated actions slower merely to feel cinematic.

### 4.8 No fake urgency

If nothing needs the GM, the Command Center may be calm. Package F must never manufacture alerts simply to increase interaction frequency.

### 4.9 Routine execution may be delegated; judgment remains interesting

Automation should remove repetitive execution, not eliminate the strategic decision itself.

### 4.10 No AI-app aesthetic or behavior

The product must not rely on chatbot mascots, fake “AI analyst” copy, unexplained generated recommendations, repetitive synthetic essays, glowing assistant bubbles, excessive rounded-card dashboards, decorative gradients/glows or generic SaaS visual grammar.

## 5. Product shell and navigation

The permanent primary destinations are:

- **Command** — what needs the GM, what changed, what is next, current week/game context;
- **Team** — roster, depth/roles, player profiles, health, development/readiness;
- **Front Office** — scouting, contracts, trades, free agency, draft and staff/org decisions;
- **League** — standings, schedule, scores, news, leaders, records and history.

A persistent/contextual **Continue** action advances toward the next meaningful boundary when legal. It is not a hidden alternate simulator and must respect explicit A–E command boundaries.

The Command Center is organized conceptually around:

- **Needs You** — blocking or consequential decisions requiring judgment;
- **What Changed** — grouped material changes since the player last meaningfully reviewed the area;
- **What’s Next** — upcoming game, deadline, market window or organizational boundary;
- **Around the League** — selectively prioritized world context.

If a blocking decision exists, it dominates the screen. If no action is required, the screen becomes calmer rather than generating fake work.

Returning-player orientation must immediately answer where the save stands: current phase/date/week, last result, meaningful changes, decisions waiting and next major event. No simulation advances merely because the app was closed.

## 6. Islaria identity and first-launch experience

Technical launch remains fast. The native launch experience must not become an advertisement.

After launch, a short **ISLARIA** or **ISLARIA PRESENTS** studio sting establishes product identity. The first launch may breathe slightly longer; repeat launches abbreviate. It is skippable and has a Reduce Motion alternative.

The product welcome explains the simulation contract rather than dumping feature marketing. The core message is that the player runs a football organization under imperfect information, hires people with real authority and beliefs, makes consequential decisions and lives with what happens.

The first-launch flow is:

1. Islaria studio sting;
2. Sport Sim reveal / welcome;
3. concise “why this game is different” framing;
4. guidance selection;
5. franchise setup with recommended defaults and optional advanced setup;
6. first day on the job inside the real Command Center;
7. contextual tutorials only as systems become relevant.

Guidance modes are:

- **Guided GM** — strong contextual explanations and teaching prompts;
- **Light Guidance** — explanations on unfamiliar/important systems without frequent interruptions;
- **Veteran** — minimal teaching and denser defaults.

Guidance changes teaching intensity, not hidden simulation truth, CPU legality or difficulty. It can be changed later.

Onboarding is in-world and task-based rather than a long carousel. The first hour should demonstrate the game’s differentiation through real modeled disagreement, uncertainty and consequences rather than merely describing them.

A permanent **GM Academy / Help** surface allows replay of tutorials and definitions such as “What does this mean?”, “Why does this matter?” and “How was this determined?”

## 7. Player and team information architecture

There is one canonical player profile pattern reused from roster, free agency, trade, draft, medical, GameCast and history contexts.

The top of a player profile must answer, in seconds:

- who the player is;
- position/role and organizational status;
- age/career context;
- contract status where legitimate/relevant;
- availability/readiness summary;
- current organizational role;
- major staff view(s) and confidence;
- opportunity context;
- whether anything currently requires attention.

Package F must not expose universal OVR or fixed-potential destiny. Unknown means unknown. Conflicting legitimate staff views remain visible instead of being averaged into a single pseudo-objective score.

Important assessments support a **Why?** drill-down showing attribution, confidence, timing and legitimate evidence/provenance. Confidence is confidence in an assessment/evidence, not a percentage chance that a hidden rating is correct.

The Team destination has stable secondary areas:

- **Roster**;
- **Depth & Roles**;
- **Health**;
- **Development**.

Roster is the fast-scanning surface. Player profile is the deep-inspection surface. Veteran users may enable additional useful columns, but default presentation remains readable and remembered preferences cannot destroy core navigation.

Depth-chart changes may preview legitimate consequences such as likely opportunity, role-learning context, workload or displaced usage. Authority determines available actions: when the GM cannot directly set something, the UI presents the legal action such as Recommend Change or Discuss Role rather than granting god-mode control.

Medical presentation keeps distinct:

- clearance;
- functional readiness;
- conditioning/readiness context;
- performance limitation;
- reinjury concern where legitimately known;
- medical recommendation;
- coaching usage intention;
- player preference where represented;
- actual usage.

Development presentation has no XP bar. It emphasizes opportunity history, staff observation, role learning, workload context and legitimately observed change. Evaluation change and capability change remain separate concepts.

Career history follows the player through transactions, contracts, injuries, role changes, statistics, major games, awards/records when available and organizational history.

## 8. Trades, contracts and free agency

### 8.1 Trade workspace

There is no universal trade-value number, acceptance meter or hidden-threshold minigame.

A trade workspace keeps both sides’ assets and the user organization’s legitimate consequences in context: cap/contract effects, roster-space effects, draft-capital changes, known role/opportunity implications and comparable roster alternatives.

Counterpart communication may express legitimate interests or objections, but it may not leak private maximum willingness, hidden thresholds, private boards or exact fallback plans.

“Shop player” or similar actions discover the market. Repeating an unchanged inquiry must not reroll a better market merely because the player pressed the button again.

### 8.2 Contracts

Routine contract business supports fast workflows and bounded delegation. Major negotiations support deeper inspection of duration, cash timing, guarantees/security where supported, cap implications, flexibility, release/trade consequences, known player/agent priorities, alternatives and relevant market context.

Package F may present attributed staff assessments of an offer. It may not expose a hidden exact acceptance probability.

No-deal outcomes are legitimate.

### 8.3 Free agency

Free agency is presented as a simultaneous evolving market, never as an e-commerce list sorted by a magic rating.

The player may maintain primary targets, fallbacks, protected targets and delegated routine actions. Staff delegation may not silently abandon or overwrite explicit protected GM intent.

Other signings and market events may change alternatives, leverage, positional scarcity and organizational plans. Waiting, increasing, withdrawing, pivoting and walking away are legitimate actions.

## 9. Scouting, draft and the War Room

Scouting is not a click-farming minigame. Scouts work continuously under organizational priorities, available access and finite staff bandwidth. The GM controls attention and priorities rather than repeatedly pressing “Scout Player.”

Draft boards represent organizational beliefs, not universal player truth. Boards use tiers to reduce false precision. Team need may change selection priority without rewriting the scouting belief itself.

The War Room must keep, in one coherent iPhone workspace:

- current pick / team on the clock;
- user’s next pick and remaining draft capital;
- remaining top organizational tiers;
- major roster/need context;
- staff disagreement and strong advocacy when it genuinely exists;
- active trade conversations and pre-draft frameworks;
- recent selections and league draft flow;
- direct prospect comparison;
- preserved filters, sort and scroll state.

Board rank and selection recommendation are explicitly different concepts.

Staff disagreement is attributed, evidence-based and non-scripted. Package F must not generate fake arguments simply because “draft night needs drama.” Strong advocacy appears only when a modeled staff member actually holds a strong relevant view.

The single-player draft clock tests conviction, not reflex speed. Pause is allowed; logical football time advances only through the authoritative rules.

Drafting a player does not reveal latent ratings or “true potential.” Information continues to update through legitimate camp, practice, preseason and game evidence.

Past drafts remain easy to revisit. Historical evaluations are preserved as-of draft time so a later career outcome does not rewrite what the organization knew then.

## 10. Staff and organizational management

Staff are modeled people with roles, authority, beliefs, relationships, workload and history—not decorative stat boosters.

Package F staff presentation must emphasize:

- current role and responsibilities;
- reporting/authority relationships;
- what decision rights the person currently holds;
- relevant expertise demonstrated through modeled work/history;
- current legitimate beliefs and evidence;
- workload/capacity context where supported;
- organizational history;
- major shared decisions and disagreements when historically recorded.

The staff area contains three primary views:

- **Staff Room** — who works here, roles, responsibilities, status and workload;
- **Organization Map** — who owns or participates in roster, scheme, medical, workload, activation, scouting, transactions and related decisions;
- **Staff History** — hires, promotions, role changes, departures and later career destinations.

Authority must be visible in the action vocabulary. A user cannot receive an `Execute` button when they only possess `Advise` or `Propose` rights.

Delegation supports category scope, boundaries, protected priorities and exception review. Delegation must never manufacture authority or silently undo protected GM intent.

Relationships remain multidimensional. Package F must never collapse trust, professional respect, familiarity, alignment, access and tension into one universal relationship number.

Organizational genealogy is a first-class long-save feature: former assistants, scouts and executives remain connected to their prior teams and can later appear elsewhere in the league with their history intact.

## 11. League world and history

The league must feel alive without becoming a feed that demands homework.

The default League experience prioritizes material football-world changes such as:

- major results and upsets;
- division/standings movement;
- significant injuries that are legitimately public/known;
- major trades/signings;
- records and milestones;
- breakout performances;
- coaching/front-office changes;
- relevant upcoming games and rivalry context.

Permanent destinations include Standings, Schedule, Scores, Leaders, Teams, People, Transactions, Records and History.

Relevance may prioritize information connected to the user’s division, playoff race, upcoming opponents, former staff/players or explicit tracked interests, but it does not alter the underlying facts.

Team pages accumulate history over decades: season records, playoff runs, championships, major player eras, coaches/GMs, notable drafts/trades and rivalry context.

Past seasons are directly browseable as historical presentations of recorded facts: standings, playoffs, champions, leaders/awards where represented, drafts, major transactions and organizational story.

History must not be buried in deep archive navigation. Past seasons, drafts, old rosters, staff careers, transactions and playoff runs should be reachable in a few actions from their natural context.

Rivalry/history views may summarize real accumulated records and notable meetings but may not invent narrative causes unsupported by history.

## 12. Weekly cadence and progression

The week has rhythm but does not create chores for the sake of activity.

At any point, the Command Center should answer:

- Where are we?
- What materially changed?
- Does anything actually require the GM?
- What happens next?

Routine stretches may advance quickly. Meaningful changes or blocking decisions naturally slow the flow.

The friendly Continue action may orchestrate advancement toward the next meaningful event, but lower-level Package A–E semantics remain explicit and authoritative. It must stop at unresolved scheduled-game boundaries and other domain-required decision points.

Game-week presentation introduces opponent, standings implications, rivalry/history relevance, legitimate matchup observations, roster/medical decisions and authorized game-plan context without changing the simulation because a game is dramatic.

## 13. Game Day, Fast Sim and GameCast

Before kickoff, one Game Day surface presents required blockers and contextual warnings separately. Examples include activation legality, medical clearance limits, protected workload constraints, roster issues and authority/approval requirements.

Warnings/advice are not hard legal blockers unless the underlying domain says they are.

Once legal preparation is complete, the same scheduled game may be experienced through:

- **Fast Sim** — resolve and move directly to polished result/postgame presentation;
- **Condensed GameCast** — reveal the same resolved ledger through selected drives, scoring opportunities and high-leverage events;
- **Full GameCast** — progressively reveal the full supported play/drive sequence.

All modes consume the same authoritative Package E result. Watching, skipping or changing presentation speed cannot alter score, stats, injuries, RNG or world fingerprint.

GameCast’s visual anchor is score, quarter/clock, possession, down-and-distance and field position, with current drive, play-by-play, statistics and contextual inspection around it.

Presentation should make turnovers, injuries, red-zone possessions and high-leverage moments feel consequential without requiring slow cinematic sequences.

Package F may design the UX contract for future rare key-decision interventions, but true mid-game intervention is out of scope until an authoritative deterministic pause/continue engine exists.

## 14. Postgame and Sunday Proof

Postgame must tell the football story quickly before exposing deeper box-score/history detail.

The first postgame layer should emphasize:

- result and score;
- major turning points;
- meaningful performances;
- game-created injuries;
- standings/playoff consequences;
- material organizational observations that legitimately emerged.

**Sunday Proof** surfaces recorded causal participation from Package E’s authoritative causal ledger. It is not a narrative-generator permission slip.

Valid examples may connect:

`decision receipt -> roster membership/designation -> game-plan snapshot -> responsibility/role knowledge -> resolved football action -> consequence`.

Sunday Proof may show positive, negative or ambiguous consequences. It must not claim that one noisy play was “caused” exclusively by an offseason decision unless the authoritative causal model actually supports that claim.

It is acceptable, and often preferable, for a game to produce no strong organizational causal story. Sparse truthful proof is more valuable than a forced “your genius move paid off” message every week.

Postgame consequences flow naturally into the next week: workload/readiness changes, medical episodes, staff observations, role context, standings changes and league history.

## 15. Visual design system

The target visual language is **premium football operations + modern sports broadcast + elite mobile information design**.

It must not look like a generic startup dashboard with football logos added afterward.

### 15.1 Layout and surfaces

Use typography, spacing, dividers, compact rows, tables/lists, timelines, comparison structures, contextual headers and selective surfaces as the default grammar.

Generic cards are not the universal container. “Card soup” is prohibited. Components should represent domain concepts such as player rows, decision rows, staff assessments, evidence trails, status treatments, transaction structures, standings, game strips, draft tiers, market offers and timelines.

### 15.2 Team theming

Team identity may influence:

- header atmosphere;
- accent treatments;
- selected states;
- matchup/Game Day presentation;
- charts/series where accessible;
- future imagery/venue identity.

A derived accessibility-safe palette overrides unreadable raw team colors. Core information architecture and interaction placement remain stable.

### 15.3 Information density

Sport Sim may be denser than a normal consumer app. Rebuild players need information.

The solution to density is hierarchy, filtering, sorting, abbreviation, drill-down and progressive disclosure—not giant whitespace and not tiny unreadable text.

The UI must reflow across supported iPhone sizes without page-level horizontal scrolling. Purpose-built comparison surfaces may use local horizontal scrolling only when necessary to preserve legibility.

### 15.4 Numerical consistency

Contracts, cap, scores, statistics, percentages and draft values use consistent formatting and tabular numerals where useful.

Displayed precision must never exceed legitimate knowledge precision. A moderate-confidence assessment cannot visually masquerade as `82.4% certainty`.

### 15.5 Motion

Motion is functional. It may communicate movement, ordering, selection, draft flow, GameCast progression or changed state.

Repeated workflows must not incur an animation tax. First-exposure branding/motion may be slightly richer; repeat exposure abbreviates. Reduce Motion must preserve all information.

## 16. Accessibility contract

Accessibility is part of the design, not final QA.

Package F must include:

- logical VoiceOver semantic order;
- meaningful spoken labels for dense comparison and status rows;
- touch targets sized for reliable one-handed use;
- Dynamic Type support where practical, with deliberate reflow for dense tables/comparisons;
- no information conveyed by color alone;
- Reduce Motion behavior for studio sting, transitions and GameCast;
- non-drag alternatives for any drag-enabled workflow;
- accessible War Room navigation that remains coherent when linearized;
- focus/order preservation when returning from detail views where platform behavior allows.

Complex visual composition may never make the semantic reading order nonsensical.

## 17. Performance contract

Performance is part of product quality.

Local information should feel immediate. A beautiful screen that routinely takes seconds to open has failed.

Package F therefore uses purpose-built derived read models rather than binding large UI trees directly to the entire authoritative `FootballWorld`.

Requirements include:

- read only the smallest useful derived representation for each surface;
- virtualize long player/history/transaction lists;
- memoize/cache derived work where correctness permits;
- do not recompute expensive league summaries because of unrelated UI scrolling/state;
- restore navigation context instead of rebuilding list state on every Back action;
- GameCast reads retained game facts rather than recalculating football;
- large/old career histories remain browseable without loading all historical detail at once;
- suspend/force-close never creates a partial authoritative commit;
- read-model refresh failure cannot corrupt authoritative state.

Frequently repeated actions must be measured during implementation. Polish may not materially regress those paths without explicit review.

## 18. Error, confirmation and recovery UX

Domain errors are translated into player-understandable language while preserving technical diagnostic detail for support/development.

The UI should explain what changed and what action is now required when authority, deadline, roster legality, market state or another domain condition invalidates a pending action.

Destructive/high-consequence actions receive proportional confirmation. Routine harmless actions must not be buried under constant “Are you sure?” dialogs that train users to ignore confirmations.

Save recovery or fallback to an older verified snapshot must be explicit and understandable. Package F cannot silently hide a recovery event that materially changes the player’s current save state.

## 19. Long-save / 500-hour protections

Every recurring workflow must pass two questions before implementation:

1. **Is this still useful the 200th time?**
2. **If we automate it, is there still an interesting decision left?**

The following protections are mandatory:

- Continue may remove routine traversal but must not collapse the game into `Continue -> Continue -> Draft`;
- Command Center “What Changed” groups and prioritizes material changes rather than becoming an event inbox;
- scouting priorities persist and require intervention only when strategy changes materially;
- routine contracts support batch/fast/delegated paths while important negotiations remain deep;
- unchanged trade inquiries do not reroll better counterpart behavior;
- draft workflow remains familiar while decision environments vary through real world state, staff, evidence, capital and class shape;
- Fast Sim / Condensed / Full GameCast are all first-class so repeated seasons do not force one presentation speed;
- Sunday Proof is sparse and never mandatory praise;
- old career history is indexed and summarized rather than dumped into current screens;
- onboarding/guidance recedes for veterans;
- user customization may affect secondary density/order/preferences but may not destroy core navigation consistency.

Package F must not create replayability through random scripted drama, arbitrary menu reshuffling, hidden rubber-banding or CPU omniscience.

## 20. Anti-pattern / “AI bullshit” rejection test

A Package F surface fails design review if it relies materially on any of the following:

- excessive rounded-container/card layout;
- decorative gradients/glows with no information role;
- generic assistant/chatbot visual language;
- unexplained synthetic recommendations;
- repetitive generated paragraph summaries where structured sports information is clearer;
- giant whitespace that hides useful data;
- fake urgency/notification spam;
- motion for its own sake;
- redundant labels and duplicate navigation paths;
- hidden universal scores masquerading as “insight”;
- post-hoc narrative causality unsupported by recorded simulation evidence.

The interface should look and behave like it was designed by people obsessed with football management, not produced from a generic “sleek sports dashboard” template.

## 21. Package F read-model architecture

Package F may introduce mobile-facing derived read-model modules, but their contract is one-way:

`authoritative A–E world -> knowledge/authority-safe derivation -> presentation model -> UI`

Never:

`UI summary -> authoritative truth`.

Read models should be organized by decision surface rather than one mega-view of the world. Expected categories include, at minimum:

- Command Center summary;
- returning-player briefing;
- roster/player summary and comparison;
- health/development summary;
- trade/acquisition impact view;
- contract/free-agency workspace view;
- scouting/board/War Room view;
- staff/authority/organization view;
- league-week/history summary;
- game-day readiness view;
- GameCast presentation payload;
- postgame/Sunday Proof explanation view.

Each read model must document:

- authoritative inputs;
- knowledge/visibility filter applied;
- authority context where actions are offered;
- stable identity keys used for list/navigation-state restoration;
- whether data is current-state, historical as-of, or derived projection;
- which fields are safe to persist as UI preferences versus recomputed from the world.

No read model may contain latent capability/healing/RNG truth merely because the mobile app could technically access it.

## 22. Navigation-state contract

State restoration is a product requirement, not an implementation convenience.

For major list/workspace surfaces, navigation state should preserve as appropriate:

- selected sub-tab;
- filter set;
- sort order;
- selected comparison candidates;
- search query;
- expanded section state when useful;
- approximate list position / anchor item;
- active draft/trade/free-agency workspace context;
- chosen GameCast presentation speed/mode preference.

This state is non-authoritative UI state. Losing it after an authoritative world update is acceptable only when the prior state is no longer valid; otherwise Back should feel like returning to the same place.

## 23. Acceptance scenarios for Package F

Package F implementation planning must include explicit end-to-end acceptance scenarios rather than only screen-by-screen existence checks.

### 23.1 First launch

- Islaria sting respects skip and Reduce Motion.
- Guidance selection persists as a preference.
- Player reaches a real Command Center rather than a tutorial-only shell.
- First contextual teaching does not change simulation rules.

### 23.2 Roster inspection

- Apply position/filter/sort.
- Scroll deep into roster.
- Open player.
- Inspect evidence/contract/health context.
- Back returns to the same roster context.

### 23.3 Trade workspace

- Build a legal trade concept.
- Inspect incoming/outgoing player comparison.
- Inspect acquisition impact.
- Return with offer/workspace unchanged.
- No private counterpart threshold is exposed.

### 23.4 Free agency

- Maintain primary target plus fallback.
- Delegate routine targets while protecting one explicit priority.
- Market changes through logical simulation time.
- Delegation cannot silently abandon the protected target.

### 23.5 Draft Night

- War Room exposes board tiers, remaining capital, recent picks, roster context and staff disagreement.
- Prospect detail and trade inquiry round trips preserve board state.
- Pause does not alter football/draft reality.
- Selecting a player does not reveal latent truth.

### 23.6 Game Day / presentation parity

From one identical pregame state:

- resolve through Fast Sim presentation;
- replay/reveal the same accepted game through GameCast presentation;
- score, stats, injuries, play-ledger identity, RNG draw count, event chain and final world fingerprint remain identical;
- presentation speed changes no authoritative result.

### 23.7 Sunday Proof

- every surfaced causal statement maps to retained authoritative causal/fact records and legitimate organization-facing disclosure;
- a game with no strong supported causal story is allowed to show none;
- UI cannot invent a causal link from a narrative template.

### 23.8 Returning after interruption

- suspend/force-close after a committed save and reopen;
- app resumes from verified state;
- returning-player briefing correctly orients the user;
- no wall-clock simulation occurs simply because the app was closed.

### 23.9 Long-career history

- a synthetic long save with many seasons remains navigable;
- opening current roster does not require loading all historical detail;
- past seasons/drafts/players/staff remain discoverable;
- list interactions remain responsive on target iPhone hardware.

### 23.10 Accessibility

- VoiceOver can traverse Command Center, roster, player profile and War Room coherently;
- critical state is understandable without color;
- Reduce Motion preserves all information;
- any drag interaction has a non-drag equivalent;
- larger text does not make core decision actions unreachable.

## 24. Quality gates for implementation planning

The later Package F implementation plan must preserve the project’s existing evidence discipline.

At minimum, it must define:

- one-commit-per-reviewable-task structure;
- RED -> GREEN tests for new pure/read-model behavior where applicable;
- full existing A–E regression / golden checks at defined checkpoints;
- TypeScript typecheck, lint, formatting and iOS export;
- Node/Hermes parity for any new deterministic derivation that participates in accepted evidence;
- physical iPhone proof for the polished production shell and critical flows;
- accessibility checks on real device/simulator tooling where available;
- targeted performance measurements for recurring high-frequency workflows;
- evidence that UI presentation does not mutate authoritative state except through authorized domain commands.

Package F is not accepted because screenshots look good. It is accepted when the product workflows are coherent, fast, accessible, knowledge-safe and architecture-safe on the real app.

## 25. Explicit deferrals to Package G or later

Package F intentionally leaves the following for later design/implementation:

- deterministic mid-game pause/intervention/key-decision authority;
- empirical NFL statistical/injury/economic calibration beyond accepted synthetic profiles;
- full 32-club career vertical-slice calibration and century stress certification;
- endogenous league tactical/meta evolution;
- giant content/playbook breadth;
- advanced route-coordinate/collision visualization;
- cloud sync/accounts/community/challenges;
- premium/monetization systems;
- final App Store launch/commercialization work unless separately authorized.

Package F surfaces must be designed so these later capabilities can plug in without replacing the core information architecture.

## 26. Final design test

Before any Package F implementation plan is approved, every proposed task must be checked against these questions:

1. Does it preserve one authoritative simulation path?
2. Does it show only information the organization/player is legitimately allowed to know?
3. Does it respect real authority instead of granting human-player god mode?
4. Does it help a football decision rather than merely display data?
5. Is the common action fast enough for hundreds of repetitions?
6. Does it preserve user context when navigating deeper and back?
7. Does it remain understandable with accessibility features enabled?
8. Does it avoid fake urgency, fake causality and fake precision?
9. Does it make Year 10 richer rather than merely longer?
10. Would a rebuild enthusiast recognize it as a football-management product rather than generic AI/SaaS UI?

If a proposed Package F feature fails any of those tests, it must be redesigned before implementation.

## 27. Design conclusion

Package F turns the accepted A–E simulation substrate into the first real player-facing Sport Sim product.

Its job is not to add a second game on top of the engine. Its job is to make the existing world understandable, fast, emotional and replayable while preserving the very uncertainty, organizational structure, causal history and deterministic rules that make the project distinctive.

The intended end state is a mobile football front-office game that a new player can understand, a veteran can operate quickly, and a rebuild enthusiast can still care about deep into a multi-decade career.
