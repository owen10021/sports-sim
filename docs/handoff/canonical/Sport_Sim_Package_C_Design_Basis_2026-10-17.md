# Sport Sim Package C — Canonical Design Basis

Date: 2026-10-17
Status: **EXTRACTED FROM ALREADY-APPROVED CANON — NOT A NEW PRODUCT REDESIGN**

This document is a focused, repo-local implementation basis for Package C. It does not replace the frozen 26-section architecture, project brain, decision-core spec, or game blueprint. It exists so an implementer does not need to reconstruct Package C from conversation memory or invent missing rules.

Precedence remains:

1. latest explicit user-approved amendment;
2. frozen 26-section architecture;
3. decision-core/build spec;
4. game blueprint;
5. final pre-build research synthesis;
6. approved conversation additions captured in the project brain;
7. programmer preference.

If this focused extract appears to conflict with a higher-precedence source, stop and raise the conflict rather than silently reinterpret it.

## Package C purpose

Package C is **Roster / Contracts / Markets / Scouting / Draft**.

It adds player-rights/roster state, basic cap/contract machinery, trade market, agents at first useful depth, prospect/scouting workflow, board construction, draft order, draft plans, and live draft transactions.

**Package C proves the core GM acquisition loop.**

Package D owns development, practice, medical, and opportunity. Package E owns the football engine and Sunday Proof. Package F owns primary Command Center/decision-surface UX. Package C must leave clean interfaces for those later packages rather than smuggling them in.

## Locked architecture rules that Package C must preserve

- One authoritative `FootballWorld` exists.
- Only `WorldKernel` commits authoritative football state.
- Human and CPU actors use the same domain rules and legitimate information boundaries.
- Ordinary actors never access hidden player truth directly.
- Historical beliefs, reports, proposal context, and decision receipts remain immutable as-of records.
- Meaningful consequences have inspectable causes.
- Major transactions reconcile with organizational plans before and after commitment.
- Delegated actors cannot silently exceed explicit authority.
- Derived/read state is disposable; it may not become authoritative truth.
- Save/load/replay must preserve authoritative meaning exactly.
- Same state + ruleset + command sequence + RNG state must reproduce the same result.
- Difficulty may not create omniscience, hidden funds, secret physical bonuses, targeted injuries, or rubber-banding.
- League mechanics come from the active `LeagueRuleset`, not incidental programmer assumptions.
- Markets expose competition and uncertainty, not rival hidden maximums.
- Transactions commit atomically or not at all.
- Simulation depth may increase without requiring proportionally more player clicking.

## Player evaluation and scouting boundary

A player does **not** contain a predetermined destination overall/potential rating. Developmental possibility is not a fixed destiny.

Evaluation change and ability change are separate. An organization may learn more about a player without the player improving, and a player may later improve while an organization remains wrong. **Scouting reveal and progression are never the same mechanic.** Package C may establish the baseline football-capability/role state needed for acquisition and scouting, but Package D owns causal progression, opportunity, practice, scheme learning, and medical/readiness evolution.

Authoritative player truth, observations/evidence, organizational beliefs, and communications remain distinct. A scouting workflow must answer decision-relevant questions under uncertainty; it must not operate as a progress bar that buys hidden truth.

Reports preserve provenance/source family. Re-reading the same evidence cannot independently reroll a new reality or create fake corroboration. Different organizations may rationally disagree because they possess different legitimate evidence, evaluators, plans, and risk tolerances.

## Unified acquisition ecology

Draft, trades, extensions, free agency, contract structure, agents, cap planning, roster rights, and draft capital are connected parts of one player/asset market. Package C must not build independent mini-economies whose state or valuation disagrees.

### Contextual markets, never universal values

A player does not own one authoritative trade-value number. Organizational value is contextual and depends on legitimate beliefs, contract, age, alternatives, positional scarcity, competitive window, scheme/role fit, urgency, draft capital, and market competition.

A draft pick likewise does not have one universal value. Future picks contain expected value, uncertainty, optionality, and time preference; different organizations can value the same asset differently.

### Negotiation between plans

Trade and contract responses derive from organizational/player objectives, constraints, alternatives, authority, and current market state rather than a hidden offer-score minigame. Broad legal packages should be allowed by the active ruleset. Exploit resistance comes from coherent counterpart behavior and resource conservation, not arbitrary UI restrictions.

### Market discovery without oracle behavior

“Shop player,” “seek player,” or similar discovery can surface plausible interest and communication obtained legitimately. It must not expose every opponent's maximum willingness to pay, private board, private fallback, or exact hidden threshold.

## Contracts and cap

Contracts represent actual obligations and rights rather than only a headline total. At first useful depth the authoritative contract model must preserve enough structure to reason about:

- duration;
- cash timing;
- salary/cash obligations;
- guarantees/vesting where supported by the active ruleset;
- signing/bonus treatment where supported by the active ruleset;
- cap accounting;
- practical security;
- team flexibility;
- amendment/termination history;
- trade/release consequences under the active ruleset.

Player/agent evaluation considers the practical likelihood and timing of receiving money, credible role/opportunity information, alternatives, and preferences—not merely headline dollars.

Local what-if comparisons do not contact an agent or mutate the world. A real proposal can be accepted, countered, deferred, withdrawn, expire, or end in a legitimate no-deal outcome.

Exact final NFL money bands, cap calibration, and obscure CBA edge cases are not frozen. Package C uses explicit integer money units and a synthetic ruleset profile for acceptance fixtures; it must not claim synthetic values reproduce current NFL economics. The data model/rules boundary must permit later calibrated rulesets without a second source of truth.

## Trade market

- Asset ownership is authoritative and conserved; the same asset cannot be committed twice.
- A trade must validate both organizations' current authority, approvals, asset ownership, contract/cap consequences, roster consequences, deadlines, and current state at commit.
- Repeating the same accepted request does not execute twice.
- An unchanged external offer does not independently reroll counterpart willingness.
- Rival/private information is disclosed only when legitimately communicated.
- Not every player has a trade market and not every bad contract can be dumped.

## Free agency and agents

Free agency is a **simultaneous market** in logical league time. Human UI submission order, device speed, renderer timing, or wall-clock reaction speed are not market tie-breakers.

Targets and fallback options may remain active in parallel. Other signings change supply, leverage, organizational need, alternatives, and resource availability. Waiting, increasing an offer, withdrawing, pivoting, maintaining fallbacks, and walking away are legitimate actions.

Agents are persistent people/network actors with client portfolios, market knowledge, client objectives, and organizational relationships. Relationship can affect access, communication, and credibility; it may not grant magical discounts or hidden-truth access.

A market must permit no-deal outcomes. The engine cannot manufacture consent merely because an organization wants a player.

## Draft and scouting

Draft boards represent **organizational beliefs**, not universal player truth. Boards support tiers to reduce false precision. Organizational need may alter decision priority without rewriting the underlying scouting belief.

Draft night must support real board movement, changing information, staff disagreement, competing offers, draft-asset ownership, and live transaction context. Pre-draft conversations may create conditional trade frameworks.

The draft clock tests conviction, not mouse speed. Single-player pause is allowed; football reality advances only through explicit logical time movement. Accessibility/presentation pressure never changes football rules.

Draft selections, draft-rights ownership, later contracts, undrafted free agency, roster capacity, and market alternatives use the same underlying authoritative player/asset state.

At first useful depth, Package C also carries that same state through **cutdown/release → waivers → practice squad**. Waiver claims resolve at a logical ruleset-owned boundary with deterministic priority; a claim assumes the linked contract/rights rather than creating a duplicate player or contract. An unclaimed waived player follows the same contract-termination/free-agent path, and practice-squad signings use the same agent/offer/contract/rights machinery. Detailed accrued-season/protection/elevation and other obscure CBA edge cases remain later ruleset depth.

Before a consequential acquisition commits, the simulation must be able to derive a non-authoritative **acquisition-impact preview** from the same contract/rights/asset data used by commit validation: cap deltas, roster-capacity deltas, incoming/outgoing assets, draft capital, and active reservations. Package D may later add opportunity/repetition effects. The preview is never an alternate source of truth or a hidden-value score.

## LeagueRuleset ownership

League-specific transaction mechanics belong to the active `LeagueRuleset`. Examples include rookie-contract rules, franchise/transition mechanisms, compensatory-pick treatment, free-agency windows, trade deadlines, roster-rights rules, draft rounds/order constraints, salary-cap rules, and related timing semantics.

Package C does not need to implement every obscure rule. It **does** need an explicit first rules profile and extension boundary so current basic mechanics are real rather than hardcoded magic numbers spread through domain code.

## Domain ownership

### Roster & Player
Owns player football-capability state, roster rights/status, role suitability, depth/roster structures needed by acquisition, and the baseline player state on which later development/football packages operate.

### Market & Contract
Owns contracts, cap effects, offers, free agency, agents, trade negotiation, asset markets, market concurrency, and external agreement state.

### Draft & Scouting
Owns prospect lifecycle, scouting work, organizational boards, draft eligibility/order, draft plans, draft-pick assets, and live draft transaction context.

These domains plug into Package B's people, organizations, knowledge, relationships, plans, authority, proposals/approvals/receipts, and reasoning interfaces. They do **not** create competing copies of those systems.

## Atomic failure semantics

A trade, draft selection, contract execution, roster transaction, offer acceptance, or similar commitment either completes every required authoritative mutation or remains uncommitted. On rejection or commit fault, authoritative state, RNG state, event chain, assets, cap obligations, contracts, and roster rights remain unchanged unless the command explicitly represents a legitimate non-commit market communication event.

Failure to refresh a read model or presentation surface must never corrupt the authoritative transaction.

## QA obligations

Package C should establish invariant/audit hooks for:

- no duplicate player/draft-asset ownership;
- no impossible combined cap/resource commitment;
- no universal trade-value oracle;
- no trade-finder private-information leakage;
- no free-agent wall-clock/UI-order advantage;
- no unchanged-offer reroll exploit;
- no future-pick zero-cost/mispricing assumption;
- no bad-contract dumping by counterpart incompetence;
- no scouting certainty inference from implementation artifacts;
- no save/reload market-outcome exploit;
- coherent roster/contract/plan consequences after acquisition.

Named reproducible scenarios relevant to Package C include **Draft Night, Free Agency, Contract Extension, Trade Deadline, and Cutdown**. Package C does not need to complete Package G's full long-universe Simulation Lab, but its production systems must expose the metrics/invariants Package G will consume.

## Package C acceptance identity

A successful Package C proves that a GM can:

1. evaluate a player/prospect through imperfect organizational information;
2. place that player in a roster/acquisition plan;
3. compare real contract/cap/asset consequences;
4. discover or enter a contextual market without receiving an oracle;
5. negotiate/authorize a trade, contract, free-agent offer, or draft decision through Package B authority and decision receipts;
6. commit one legal transaction atomically;
7. see roster rights, cap/contract obligations, draft assets, market state, and organizational history update coherently;
8. save/reload/replay that history deterministically;
9. reproduce the same authoritative result on Node, standalone Hermes, and the physical iPhone diagnostic.

If Package C instead becomes a collection of disconnected scouting, contract, trade, and draft mini-games, it has failed the approved architecture.