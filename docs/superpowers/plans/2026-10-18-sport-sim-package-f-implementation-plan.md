# Sport Sim — Package F Product/UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the accepted Packages A–E simulation substrate into the first polished iPhone-first Sport Sim product shell, with knowledge-safe decision surfaces, onboarding, long-save navigation, GameCast/postgame presentation and real-device acceptance evidence, without creating a second simulation authority.

**Architecture:** Keep all authoritative football state and mutation in `packages/sim-core` behind `WorldKernel`. Add pure Package F presentation/read-model functions to `sim-core`; add a mobile `ProductSession`/provider that is the only normal-app bridge from those safe read models to Expo Router screens; keep onboarding, guidance, navigation memory and display preferences non-authoritative in SQLite. The production shell uses the richest accepted synthetic Package E world for Package F acceptance, while full 32-club career content remains Package G/later work.

**Tech Stack:** TypeScript 7; React 19.2.3; React Native 0.86.3; Expo SDK 57.0.30; Expo Router 57.0.27; Expo SQLite 57.0.4; `expo-symbols` 57.0.3 declared directly when the shell task begins; Vitest 5.0.5; existing deterministic `WorldKernel`, Package B knowledge/authority, Package C market/draft, Package D development/medical and Package E football/GameCast/Sunday Proof APIs.

**Spec:** `docs/superpowers/specs/2026-10-18-sport-sim-package-f-product-ui-design.md`

## Scope decomposition ruling

Package F spans many screens, but the implementation is not split into separate specs because the product shell, navigation-state contract, viewer identity, read-model safety and command gateway are shared dependencies across every surface. The plan is instead divided into reviewable vertical tasks. Tasks 1–5 establish the shared product substrate; Tasks 6–12 add independently reviewable decision surfaces on that substrate; Tasks 13–15 integrate game presentation, quality gates and acceptance evidence.

## Global Constraints

- `FootballWorld` remains the only authoritative world and `WorldKernel` remains the only authoritative committer.
- No normal Package F screen may own or mutate an independent copy of authoritative football state.
- Package F read models are pure, disposable and one-way: `authoritative world -> knowledge/authority-safe derivation -> presentation model -> UI`.
- Ordinary UI may not expose latent capability, latent healing truth, hidden opponent state, hidden RNG values, debug-only coefficients, universal OVR, fixed potential, trade-value oracle or offer-score oracle.
- Historical beliefs/reports/offers/receipts/evaluations remain immutable as-of records.
- Human-player UI receives only actions allowed by current authority; no human-only god mode.
- Fast Sim, Condensed GameCast, Full GameCast and replay consume the same Package E resolved game facts. Presentation consumes zero gameplay RNG.
- True mid-game intervention/play calling remains out of scope.
- The normal Package F product career must use `PACKAGE_E_SEED` with `SYNTHETIC_PACKAGE_E_RULESET` for acceptance. Do not mutate the accepted A–E fixtures/goldens to fake richer product data.
- Package F acceptance exposes only synthetic acceptance franchises with complete Package E football support: Northfield (`org-northfield`, GM `person-nf-gm`) and Southport (`org-southport`, GM `person-sp-gm`). Full league content is deferred.
- Existing diagnostic/acceptance data in `sport-sim.db` is not silently overwritten. The Package F product career uses a distinct SQLite database namespace.
- Guidance mode affects teaching/presentation only, never simulation difficulty or truth.
- Core navigation is fixed: Command, Team, Front Office, League.
- Back navigation preserves valid filters, sort, selected tab, comparison selections and anchor/list position.
- Accessibility is structural: VoiceOver order, non-color-only states, Reduce Motion and non-drag alternatives are required in the owning task, not deferred to final QA.
- Generic cards are not the default visual grammar. Domain rows, sections, timelines, comparison structures and contextual headers are preferred.
- Frequently repeated actions may not gain unnecessary animation or confirmation friction.
- UI/read-model failures never corrupt authoritative state. Rejected commands consume no RNG and leave authoritative state unchanged under existing kernel rules.
- No runtime dependency beyond the accepted stack plus direct declaration of already-installed `expo-symbols` 57.0.3 unless a later task explicitly proves another dependency is necessary and obtains review.
- Each task ends in a focused commit. Run targeted RED/GREEN tests per task. Run full `npm run ci` at the explicit integration checkpoints instead of after every small UI task.

## Review Focus

1. **Normal app currently boots the empty Package A fixture:** Package F must prove the production shell uses the Package E acceptance world and a real seeded GM identity, while leaving old diagnostic storage untouched.
2. **Knowledge/authority leakage through convenience views:** every Package F view must have tests proving rival/private or latent fields cannot appear and that action affordances follow current rights.
3. **Navigation context invalidation:** Back must restore prior UI context when still valid, but must discard stale selections when an authoritative update removes the referenced entity/workspace.
4. **Presentation parity:** Fast Sim / Condensed / Full GameCast must produce identical authoritative game identity, result, stats, injuries, event-chain head and world fingerprint from the same pregame state.
5. **Interruption/recovery:** onboarding/preferences/navigation state may survive separately, but force-close/recovery must never invent simulation progress or mask an authoritative snapshot recovery.

---

### Task 1: Establish the Package F Product Career Substrate

**Files:**

- Create: `apps/mobile/src/product/productCareerConfig.ts`
- Modify: `apps/mobile/src/lifecycle/careerLifecycle.ts`
- Modify: `apps/mobile/src/lifecycle/CareerProvider.tsx`
- Modify: `apps/mobile/test/careerLifecycle.test.ts`
- Create: `apps/mobile/test/productCareerConfig.test.ts`

**Interfaces:**

- Produce `PlayableFranchise { organizationId: EntityId; gmPersonId: EntityId; displayName: string }`.
- Produce `PACKAGE_F_PLAYABLE_FRANCHISES` containing exactly Northfield and Southport for Package F acceptance.
- Produce `PACKAGE_F_PRODUCT_DATABASE = 'sport-sim-product.db'`.
- Normal Package F career dependencies use `PACKAGE_E_SEED` and `SYNTHETIC_PACKAGE_E_RULESET`.
- Refactor `CareerLifecycle` so actor identity is supplied per authoritative submission instead of constructor-fixed.
- Produce `submit(actor: ActorRef, command: CommandEnvelope['command']): Promise<SubmitResult>` where `SubmitResult` matches the existing persisted-commit semantics of `advance`.
- Preserve `advance(days, actor)` as a thin wrapper around `submit` for compatibility.
- Do not expose `WorldKernel` or a raw `FootballWorld` through the React context in this task.

- [ ] **Step 1: Write RED product-config tests** proving the Package F database name differs from `sport-sim.db`, both playable franchises map to seeded Package E GM role episodes, and the configured seed/ruleset references match.
- [ ] **Step 2: Run** `npx vitest run apps/mobile/test/productCareerConfig.test.ts` and confirm RED before implementation.
- [ ] **Step 3: Write RED lifecycle tests** proving `submit(actor, command)` persists exactly one accepted kernel commit, rejects stale/unauthorized commands without a save/RNG/revision change, and `advance(days, actor)` delegates to the same path.
- [ ] **Step 4: Implement the config and generic submission path** without changing `WorldKernel` semantics.
- [ ] **Step 5: Update `CareerProvider`** to open `PACKAGE_F_PRODUCT_DATABASE` with Package E seed/ruleset but do not yet create a career until onboarding selects a franchise.
- [ ] **Step 6: Run** `npx vitest run apps/mobile/test/productCareerConfig.test.ts apps/mobile/test/careerLifecycle.test.ts && npm run typecheck --workspace @sport-sim/mobile` and require PASS.
- [ ] **Step 7: Commit** `feat(package-f): establish product career substrate`.

### Task 2: Add Non-Authoritative Product Preferences and Franchise Selection State

**Files:**

- Create: `apps/mobile/src/preferences/productPreferences.ts`
- Create: `apps/mobile/src/preferences/sqliteProductPreferencesStore.ts`
- Create: `apps/mobile/test/productPreferences.test.ts`
- Modify: `apps/mobile/src/lifecycle/CareerProvider.tsx`

**Interfaces:**

- `GuidanceMode = 'guided' | 'light' | 'veteran'`.
- `ProductPreferencesV1 { schemaVersion: 1; guidanceMode; onboardingComplete; organizationId; gmPersonId; gameCastMode; reduceMotionOverride: null | boolean }`.
- `ProductPreferencesStore.load(): Promise<ProductPreferencesV1 | null>`.
- `ProductPreferencesStore.save(value: ProductPreferencesV1): Promise<void>`.
- Persist in a dedicated `package_f_ui_preferences` table in the product SQLite database. These bytes are never part of `FootballWorld`, snapshot hash, replay or RNG.
- `CareerProvider` exposes setup state and `selectFranchise(franchise)` without creating simulation authority.
- When a career already exists, the stored selected organization/GM must still correspond to an active seeded GM role in that loaded world. A mismatch enters an explicit setup-repair/error state; it must never silently transfer the human to another organization.

- [ ] **Step 1: Write RED store/setup tests** for empty load, round trip, schema rejection, loaded-career franchise/GM mismatch fail-closed behavior, and proof that preference writes do not change career snapshot/revision/fingerprint.
- [ ] **Step 2: Run** `npx vitest run apps/mobile/test/productPreferences.test.ts` and confirm RED.
- [ ] **Step 3: Implement the preferences store and provider setup state**; selected franchise must be validated against `PACKAGE_F_PLAYABLE_FRANCHISES`.
- [ ] **Step 4: Add a regression test** that changing guidance or GameCast preference cannot cause a kernel command or save commit.
- [ ] **Step 5: Run** `npx vitest run apps/mobile/test/productPreferences.test.ts apps/mobile/test/careerLifecycle.test.ts && npm run typecheck --workspace @sport-sim/mobile` and require PASS.
- [ ] **Step 6: Commit** `feat(package-f): persist product preferences safely`.

### Task 3: Create the Package F Product Session Boundary

**Files:**

- Create: `apps/mobile/src/product/ProductSession.ts`
- Create: `apps/mobile/src/product/ProductProvider.tsx`
- Create: `apps/mobile/src/product/productErrors.ts`
- Create: `apps/mobile/test/productSession.test.ts`
- Create: `apps/mobile/test/packageFArchitecture.test.ts`
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**

- `ProductSession` is the only normal-app module allowed to access `CareerLifecycle.kernel.world` for Package F presentation projection.
- `ProductApi` exposes immutable status/revision metadata, product preferences, typed read methods added by later tasks, and `submit(command)` using the selected seeded GM actor.
- Remove `lifecycle` from the public React context surface used by screens.
- `ProductCommandError` carries player-safe category/code plus diagnostic detail; screens never display raw internal stack/error strings by default.
- Architecture test forbids route files under `apps/mobile/app` from importing `WorldKernel`, `FootballWorld`, latent development/healing modules or direct kernel mutation APIs.

- [ ] **Step 1: Write RED architecture/session tests** proving routes cannot import forbidden authority/truth modules and a product session submits as the chosen GM only.
- [ ] **Step 2: Run** `npx vitest run apps/mobile/test/productSession.test.ts apps/mobile/test/packageFArchitecture.test.ts` and confirm RED.
- [ ] **Step 3: Implement `ProductSession`/`ProductProvider`** and wrap the app in the provider from `_layout.tsx`.
- [ ] **Step 4: Translate lifecycle/domain errors** into stable product error categories without losing diagnostic detail.
- [ ] **Step 5: Run** the targeted tests plus mobile typecheck.
- [ ] **Step 6: Run integration checkpoint** `npm run ci`; require all existing A–E tests/goldens/Hermes/iOS export green before continuing.
- [ ] **Step 7: Commit** `feat(package-f): define safe mobile product session`.

### Task 4: Build the Package F Read-Model Foundation, Command Center and Progression Boundary

**Files:**

- Create: `packages/sim-core/src/packageFCommon.ts`
- Create: `packages/sim-core/src/packageFCommandCenter.ts`
- Create: `packages/sim-core/src/packageFProgression.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/packageFCommandCenter.test.ts`
- Create: `packages/sim-core/test/packageFProgression.test.ts`

**Interfaces:**

- `PackageFViewer { organizationId: EntityId; actorPersonId: EntityId }`.
- `PackageFReadMeta { asOf: string; worldRevision: number; organizationId: EntityId; actorPersonId: EntityId; knowledgeAsOf: string }`.
- `buildCommandCenterView(world, viewer, ruleset, sinceSimDate?): PackageFCommandCenterView`.
- `buildReturningBriefing(world, viewer, ruleset): PackageFReturningBriefing`.
- `nextMeaningfulBoundary(world, viewer, ruleset): PackageFProgressionBoundary` returns one of `decision | fixture | deadline | calendar`, the blocking/target date, and a legal maximum advance-days value. It never mutates or resolves a game.
- Command Center output groups `needsYou`, `whatChanged`, `whatsNext`, `aroundLeague`; entries have stable IDs and structured facts, not generated prose essays.
- Action affordances include required authority rights and must be absent/disabled when the viewer lacks them.

- [ ] **Step 1: Write RED privacy/authority tests** using two organizations with different private beliefs; confirm the other club’s private claims, plans and hidden truth never enter Command Center output.
- [ ] **Step 2: Write RED progression tests** proving unresolved scheduled fixtures stop advancement, expired/current proposals are treated correctly, no RNG/state changes occur during boundary derivation, and a calm stretch can legally return a future calendar target.
- [ ] **Step 3: Run** `npx vitest run packages/sim-core/test/packageFCommandCenter.test.ts packages/sim-core/test/packageFProgression.test.ts` and confirm RED.
- [ ] **Step 4: Implement the pure read models** by composing existing Package B–E public/organization-safe functions; do not read latent capability or private rival structures directly.
- [ ] **Step 5: Add immutability tests** proving building each view leaves `fingerprintWorld(world)` byte-identical and consumes no RNG.
- [ ] **Step 6: Run targeted tests and root typecheck**; require PASS.
- [ ] **Step 7: Commit** `feat(package-f): add command center read models`.

### Task 5: Replace the Diagnostic Shell with the Production Design System and Stable Navigation

**Files:**

- Modify: `apps/mobile/package.json`
- Modify: `package-lock.json`
- Create: `apps/mobile/src/design/tokens.ts`
- Create: `apps/mobile/src/design/teamTheme.ts`
- Create: `apps/mobile/src/design/formatters.ts`
- Create: `apps/mobile/src/design/components/Screen.tsx`
- Create: `apps/mobile/src/design/components/DecisionRow.tsx`
- Create: `apps/mobile/src/design/components/StatusLine.tsx`
- Create: `apps/mobile/src/design/components/EvidenceRow.tsx`
- Create: `apps/mobile/src/design/components/SectionHeader.tsx`
- Create: `apps/mobile/src/design/components/StickyActionBar.tsx`
- Create: `apps/mobile/src/design/components/ProductNotice.tsx`
- Create: `apps/mobile/src/navigation/navigationMemory.ts`
- Create: `apps/mobile/test/teamTheme.test.ts`
- Create: `apps/mobile/test/formatters.test.ts`
- Create: `apps/mobile/test/navigationMemory.test.ts`
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/command/index.tsx`
- Create: `apps/mobile/app/(tabs)/team/index.tsx`
- Create: `apps/mobile/app/(tabs)/front-office/index.tsx`
- Create: `apps/mobile/app/(tabs)/league/index.tsx`

**Interfaces:**

- Declare `expo-symbols: ~57.0.3` directly; do not add a second icon library.
- Tokens define neutral surfaces, typography scale, spacing, separators, semantic good/warning/danger/information treatments and minimum touch target 44 CSS px.
- `deriveTeamTheme(identity): TeamTheme` must enforce contrast-safe text/accent combinations and never rely on color alone.
- `formatMoney`, `formatRecord`, `formatSimDate`, `formatPercentKnown`, `formatDraftPick` centralize numerical display precision.
- `NavigationMemory` stores only non-authoritative route/list state keyed by surface + stable entity/workspace IDs and supports explicit invalidation.
- Tabs are permanently ordered `Command`, `Team`, `Front Office`, `League`.
- `StickyActionBar` provides the contextual Continue affordance on top-level/product-flow surfaces where Task 4/6 says advancement is legal; it is hidden/disabled with a reason when a blocking decision or due game owns the next action.

- [ ] **Step 1: Write RED tests** for theme contrast fallback, numeric-format consistency, and navigation-memory restore/invalidate behavior.
- [ ] **Step 2: Run** the three new mobile tests and confirm RED.
- [ ] **Step 3: Implement tokens/theme/formatters/navigation memory** with no simulation imports.
- [ ] **Step 4: Build the four-tab shell** using Expo Router and `expo-symbols`; keep the root background/safe areas consistent and remove generic diagnostic `Card` as the production visual grammar.
- [ ] **Step 5: Keep diagnostics reachable only from a development/settings affordance**, not as a primary product tab.
- [ ] **Step 6: Run targeted tests, mobile typecheck and** `npm run export:ios`; require PASS.
- [ ] **Step 7: Commit** `feat(package-f): establish production shell and design system`.

### Task 6: Implement Islaria First Launch, Guidance and the Real Command Center

**Files:**

- Create: `apps/mobile/src/onboarding/onboardingModel.ts`
- Create: `apps/mobile/src/onboarding/IslariaSting.tsx`
- Create: `apps/mobile/src/onboarding/WelcomeFlow.tsx`
- Create: `apps/mobile/src/onboarding/helpCatalog.ts`
- Create: `apps/mobile/src/accessibility/useReduceMotion.ts`
- Create: `apps/mobile/test/onboardingModel.test.ts`
- Create: `apps/mobile/app/help.tsx`
- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/app/(tabs)/command/index.tsx`
- Modify: `apps/mobile/src/product/ProductSession.ts`
- Modify: `apps/mobile/src/product/ProductProvider.tsx`

**Interfaces:**

- `OnboardingStep = 'islaria' | 'welcome' | 'guidance' | 'franchise' | 'first_day' | 'complete'`.
- The state machine is deterministic from preferences/career state; it cannot submit football commands except explicit user career creation/Continue actions.
- Islaria sting is skippable, abbreviated on repeat launch and static/minimal under Reduce Motion.
- Franchise setup exposes only `PACKAGE_F_PLAYABLE_FRANCHISES` in Package F acceptance and clearly identifies the environment as synthetic acceptance content in development builds. Its `Advanced Setup` disclosure contains only currently supported non-authoritative presentation/default options; it must not invent unsupported football rules or difficulty sliders.
- `helpCatalog` provides permanent GM Academy entries for `What does this mean?`, `Why does this matter?` and `How was this determined?`; help content is static/structured and never alters the world.
- `ProductSession.commandCenter()` and `returningBriefing()` wrap Task 4 safe read models.
- `ProductSession.continue()` derives one `nextMeaningfulBoundary`, submits only the needed explicit `AdvanceDays` command, and never crosses/auto-resolves an unresolved game.
- If `CareerView.recovery` is non-null, Command Center shows an explicit recovery notice describing that an older verified snapshot was restored; dismissal is UI state only and cannot hide the underlying recovery from diagnostics.

- [ ] **Step 1: Write RED onboarding tests** for all three guidance modes, skip/Reduce Motion, repeat-launch abbreviation, franchise selection persistence, GM Academy catalog stability and no-command transitions.
- [ ] **Step 2: Write RED Continue/recovery tests** proving Continue stops before a due game, performs no command when a blocking decision exists, and a recovered save produces an explicit briefing notice without simulation progress.
- [ ] **Step 3: Implement first launch, GM Academy and Command Center** with structured `Needs You / What Changed / What’s Next / Around the League` sections and a calm no-action state.
- [ ] **Step 4: Add returning-player briefing** on resume without wall-clock simulation.
- [ ] **Step 5: Run targeted tests, typecheck and iOS export**; require PASS.
- [ ] **Step 6: Run integration checkpoint** `npm run ci`; require A–E evidence green.
- [ ] **Step 7: Commit** `feat(package-f): ship onboarding and command center`.

### Task 7: Add Canonical Team, Roster, Player, Health and Development Read Models

**Files:**

- Create: `packages/sim-core/src/packageFPlayerView.ts`
- Create: `packages/sim-core/src/packageFTeamView.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/packageFPlayerView.test.ts`
- Create: `packages/sim-core/test/packageFTeamView.test.ts`

**Interfaces:**

- `buildPackageFRosterView(world, viewer): PackageFRosterView` returns stable rows with public roster facts plus organization-legitimate assessments only.
- `buildPackageFPlayerProfile(world, viewer, playerId, context): PackageFPlayerProfile` is the one canonical profile pattern for roster/trade/FA/draft/GameCast/history entry points.
- Profile sections: `snapshot`, `football`, `development`, `health`, `contractCareer`, `assessments`, `history`.
- Assessment rows carry source person, formed/observed time, confidence band and safe evidence references; there is no averaged universal score.
- Health explicitly separates clearance, recommendation, readiness/limitation context and actual usage when known.
- Development exposes observations/opportunity/role learning context but no raw capability profile, hidden responsiveness, XP or destiny.
- `comparePackageFPlayers(...)` uses identical semantic rows for two candidates and organization-safe information only.

- [ ] **Step 1: Write RED tests** proving no output key/value exposes capability profiles, hidden medical episode truth unknown to the org, RNG/debug trace or universal OVR/potential.
- [ ] **Step 2: Write RED disagreement tests** proving two staff beliefs remain separate and attributed rather than averaged.
- [ ] **Step 3: Write RED medical separation tests** for clearance vs recommendation vs actual usage.
- [ ] **Step 4: Implement views** by composing `buildDevelopmentDecisionView`, knowledge view, public contract/roster facts and safe football history.
- [ ] **Step 5: Assert all views are pure** and do not alter world fingerprint/RNG.
- [ ] **Step 6: Run targeted tests and typecheck**; require PASS.
- [ ] **Step 7: Commit** `feat(package-f): add team and player read models`.

### Task 8: Build Team Screens with Persistent Context and Comparison

**Files:**

- Create: `apps/mobile/app/(tabs)/team/_layout.tsx`
- Modify: `apps/mobile/app/(tabs)/team/index.tsx`
- Create: `apps/mobile/app/(tabs)/team/depth.tsx`
- Create: `apps/mobile/app/(tabs)/team/player/[playerId].tsx`
- Create: `apps/mobile/app/(tabs)/team/health.tsx`
- Create: `apps/mobile/app/(tabs)/team/development.tsx`
- Create: `apps/mobile/src/team/rosterController.ts`
- Create: `apps/mobile/src/team/playerPresenter.ts`
- Create: `apps/mobile/test/rosterController.test.ts`
- Modify: `apps/mobile/src/product/ProductSession.ts`

**Interfaces:**

- Team secondary areas are stably reachable as `Roster`, `Depth & Roles`, `Health`, `Development`.
- Roster state: `{ query, positionFilter, statusFilter, sort, comparisonIds, anchorPlayerId }` stored in `NavigationMemory`.
- Long lists use `FlatList`/virtualization; no giant ScrollView roster.
- Player profile opens from every team context using Task 7 canonical read model.
- Authority-sensitive actions expose `Recommend/Propose/Execute` wording according to rights; no fake Set Starter button without execution authority.
- Existing Package C release/waive/practice-squad actions may be surfaced from the player/roster action menu only when legal; high-consequence roster removal requires consequence summary + confirmation and uses the existing authoritative command path.

- [ ] **Step 1: Write RED controller tests** for filter/sort stability, comparison rows and invalidation when an authoritative update removes a selected player.
- [ ] **Step 2: Implement Team screens** with five-second snapshot first and drill-down sections below.
- [ ] **Step 3: Implement profile Back restoration**: same tab/filter/sort/query/comparison IDs and anchor player.
- [ ] **Step 4: Add semantic accessibility labels** for player/status/assessment rows and non-color-only health states.
- [ ] **Step 5: Run targeted tests, mobile typecheck and iOS export**; require PASS.
- [ ] **Step 6: Commit** `feat(package-f): add team and player experience`.

### Task 9: Add Front Office Trade, Contract and Free-Agency Read Models

**Files:**

- Create: `packages/sim-core/src/packageFFrontOfficeView.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/packageFFrontOfficeView.test.ts`

**Interfaces:**

- `buildPackageFTradeWorkspace(world, viewer, ruleset, draft): PackageFTradeWorkspaceView` composes the existing acquisition decision view and acquisition-impact preview; `draft` is UI-authored proposal content, not authoritative state.
- `buildPackageFContractWorkspace(world, viewer, playerId, ruleset): PackageFContractWorkspaceView` exposes public contract structure, organization-safe staff beliefs, authority and local what-if cap consequences without player-private preference truth unless legitimately communicated.
- `buildPackageFFreeAgencyBoard(world, viewer, ruleset): PackageFFreeAgencyBoardView` exposes live organization offers/targets/fallbacks/reservations, public market facts and communications the organization legitimately received.
- No view contains counterpart maximum willingness, private board, private fallback plan, player-private offer evaluation or exact acceptance probability.
- Every workspace provides stable asset/player IDs and explicit `allowedActions` derived from current authority/market state.

- [ ] **Step 1: Write RED leakage tests** proving player-private preference profiles/evaluation reasons and rival private thresholds never appear in organization views.
- [ ] **Step 2: Write RED authority tests** for propose/approve/execute wording and no-action states after revocation/deadline changes.
- [ ] **Step 3: Write RED impact tests** proving local what-if comparison does not create inquiries/offers/events or change world/RNG.
- [ ] **Step 4: Implement the pure front-office read models** by composing accepted Package C functions; do not create a new valuation formula.
- [ ] **Step 5: Run** `npx vitest run packages/sim-core/test/packageFFrontOfficeView.test.ts packages/sim-core/test/acquisitionView.test.ts packages/sim-core/test/playerMarketView.test.ts` plus typecheck.
- [ ] **Step 6: Commit** `feat(package-f): add front office read models`.

### Task 10: Build Trade, Contracts and Free-Agency Workspaces

**Files:**

- Create: `apps/mobile/app/(tabs)/front-office/_layout.tsx`
- Modify: `apps/mobile/app/(tabs)/front-office/index.tsx`
- Create: `apps/mobile/app/(tabs)/front-office/trade.tsx`
- Create: `apps/mobile/app/(tabs)/front-office/contracts.tsx`
- Create: `apps/mobile/app/(tabs)/front-office/free-agency.tsx`
- Create: `apps/mobile/app/(tabs)/front-office/roster-moves.tsx`
- Create: `apps/mobile/src/frontOffice/workspaceState.ts`
- Create: `apps/mobile/src/frontOffice/frontOfficePresenter.ts`
- Create: `apps/mobile/test/frontOfficeWorkspace.test.ts`
- Modify: `apps/mobile/src/product/ProductSession.ts`

**Interfaces:**

- Trade draft state is explicitly non-authoritative until an existing Package C command is submitted and accepted.
- `FrontOfficeWorkspaceState` preserves selected assets, comparison player, draft terms, active sub-tab and anchor across detail round trips.
- Routine contract workflow supports multi-select/batch triage for expiring depth players plus fast proposal/delegation paths; detailed contract inspection remains one action away. Batch UI may queue existing legal commands but may not create a bulk authoritative command that bypasses per-player validation.
- Free-agency workspace exposes primary targets/fallbacks/protected priorities from actual plan/market records where represented; it must not invent automation behavior not backed by Package B/C mandates/protected constraints.
- Roster Moves surfaces cut/waive/practice-squad transitions supported by existing Package C commands and keeps resulting contract/rights consequences visible.
- All destructive submissions show consequence summary and proportional confirmation before `ProductSession.submit`.

- [ ] **Step 1: Write RED workspace tests** proving player-detail round trip preserves a trade draft, stale/removed assets invalidate only the invalid portion rather than silently substituting another asset, and delegated free-agency handling cannot silently withdraw/replace a protected GM target.
- [ ] **Step 2: Implement Trade workspace** with two-sided assets, organization impact, direct player comparison and communications; no acceptance meter.
- [ ] **Step 3: Implement Contracts workspace** with consistent cash/cap formatting, batch triage and quick/deep paths.
- [ ] **Step 4: Implement Free Agency workspace** as a simultaneous market board with active targets/fallbacks and communicated state.
- [ ] **Step 5: Implement Roster Moves** with legal cut/waive/practice-squad actions and consequence confirmation.
- [ ] **Step 6: Add player-safe rejection handling** for stale ownership, deadline, cap/roster and authority failures.
- [ ] **Step 7: Run targeted tests, mobile typecheck and iOS export**; require PASS.
- [ ] **Step 8: Run integration checkpoint** `npm run ci`; require A–E green.
- [ ] **Step 9: Commit** `feat(package-f): add front office workspaces`.

### Task 11: Add Scouting and War Room Read Models

**Files:**

- Create: `packages/sim-core/src/packageFWarRoomView.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/packageFWarRoomView.test.ts`

**Interfaces:**

- `buildPackageFScoutingView(world, viewer): PackageFScoutingView` exposes organizational questions/assignments/reports/board information only when legitimately visible.
- `buildPackageFWarRoomView(world, viewer, ruleset): PackageFWarRoomView` includes current/on-clock pick, next user pick, remaining owned capital, organizational board tiers, recent selections, current roster context, active trade communications/frameworks and attributed staff assessments.
- `buildPackageFDraftHistory(world, viewer, season): PackageFDraftHistoryView` returns selections plus the organization’s preserved as-of board/evaluation records for that season where recorded; later career outcomes never rewrite those historical evaluations.
- `selectionRecommendation` is separate from `boardTier`; roster need may inform the former but never rewrites historical scouting belief/tier.
- `staffAdvocacy` entries may exist only when a real current belief/plan/evidence record supports them. No random drama generator and no synthetic consensus percentage.
- Drafted-player output continues to expose only legitimate beliefs; selection does not unlock latent truth.

- [ ] **Step 1: Write RED board-truth tests** proving no latent capability/potential appears and board tier remains unchanged when roster need changes.
- [ ] **Step 2: Write RED staff-disagreement tests** proving real conflicting beliefs are preserved separately and absent beliefs do not generate fake advocacy.
- [ ] **Step 3: Write RED draft-flow/history tests** for recent picks, remaining capital, pause-safe state, trade communication visibility and byte-stable historical board/evaluation snapshots after later career outcomes.
- [ ] **Step 4: Implement the scouting/War Room/history projections** using Package B knowledge plus Package C scouting/draft state.
- [ ] **Step 5: Run targeted tests plus existing scouting/draft knowledge-boundary tests** and typecheck.
- [ ] **Step 6: Commit** `feat(package-f): add scouting and war room read models`.

### Task 12: Build the Scouting and Draft War Room Experience

**Files:**

- Create: `apps/mobile/app/(tabs)/front-office/scouting.tsx`
- Create: `apps/mobile/app/(tabs)/front-office/draft.tsx`
- Create: `apps/mobile/app/(tabs)/front-office/draft-history/[season].tsx`
- Create: `apps/mobile/app/(tabs)/front-office/prospect/[playerId].tsx`
- Create: `apps/mobile/src/draft/warRoomController.ts`
- Create: `apps/mobile/src/draft/draftBoardMemory.ts`
- Create: `apps/mobile/test/warRoomController.test.ts`
- Modify: `apps/mobile/src/product/ProductSession.ts`

**Interfaces:**

- War Room state preserves filters, tier focus, comparison IDs, board anchor and active trade conversation while opening prospect/trade detail.
- The main iPhone workspace keeps on-clock context, next pick, remaining capital and top remaining tiers persistent/near-persistent without requiring five separate screens.
- Draft pause/resume uses existing authoritative draft commands only; no wall-clock countdown changes simulation truth.
- Prospect comparison reuses the canonical player/prospect profile semantics from Task 7 with prospect-safe unknowns.
- Draft History exposes prior selections plus preserved as-of organizational evaluations and links into later player careers without rewriting the old board.

- [ ] **Step 1: Write RED controller tests** for prospect-detail round trip, trade-workspace round trip, selected-prospect invalidation after another club drafts him, and draft-history round trip preserving season context.
- [ ] **Step 2: Implement Scouting** as priority/assignment/report management, not repeated “+scout” taps.
- [ ] **Step 3: Implement War Room and Draft History** with tiers, recent picks, capital, roster context, attributed disagreement, active trade context and preserved prior-year evaluations.
- [ ] **Step 4: Add accessible linear semantic order** so VoiceOver reaches clock/pick, board, staff views and actions coherently.
- [ ] **Step 5: Run targeted tests, typecheck and iOS export**; require PASS.
- [ ] **Step 6: Commit** `feat(package-f): build scouting and draft war room`.

### Task 13: Add Staff, Organization and League-History Read Models

**Files:**

- Create: `packages/sim-core/src/packageFStaffView.ts`
- Create: `packages/sim-core/src/packageFLeagueView.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/packageFStaffView.test.ts`
- Create: `packages/sim-core/test/packageFLeagueView.test.ts`

**Interfaces:**

- `buildPackageFStaffRoom(world, viewer): PackageFStaffRoomView` exposes current roles, responsibilities, current rights, relevant visible beliefs, workload/capacity where supported, relationship dimensions and role history.
- `buildPackageFOrganizationMap(world, viewer): PackageFOrganizationMapView` answers who may propose/advise/approve/veto/execute/communicate by decision category as of the current date.
- `buildPackageFStaffHistory(world, viewer): PackageFStaffHistoryView` preserves role episodes and career destinations; it never collapses relationships into one number.
- `buildPackageFLeagueWeek(world, viewer): PackageFLeagueWeekView` prioritizes public/legitimately known material league changes without fabricating stories.
- `buildPackageFTransactionHistory(world, paging): PackageFTransactionHistoryView` returns recorded public transaction facts in stable chronological pages.
- `buildPackageFRecordsView(world): PackageFRecordsView` derives only records/milestones supportable from retained game/stat facts; unsupported award/record categories are omitted rather than invented.
- `buildPackageFSeasonHistory(world, season): PackageFSeasonHistoryView` summarizes recorded games/results, draft selections, transactions and staff/player history available in the accepted world.
- `buildPackageFRivalryHistory(world, organizationA, organizationB): PackageFRivalryHistoryView` derives meetings/records from retained facts only.
- History projections accept paging/range inputs so old careers are not loaded as one giant UI payload.

- [ ] **Step 1: Write RED staff authority/history tests** for role end/revocation and immutable prior role history.
- [ ] **Step 2: Write RED relationship tests** proving dimensions stay separate.
- [ ] **Step 3: Write RED league/history tests** using generated multi-season public records; verify paging and no rival-private knowledge leakage.
- [ ] **Step 4: Implement staff/org/league projections** with stable IDs and chronological ordering.
- [ ] **Step 5: Add a stress test** projecting current roster/league summary from a synthetic 20-season-sized history without material current-screen growth proportional to all historical detail.
- [ ] **Step 6: Run targeted tests and typecheck**; require PASS.
- [ ] **Step 7: Commit** `feat(package-f): add staff and league history read models`.

### Task 14: Build Staff, Organization and League/History Screens

**Files:**

- Create: `apps/mobile/app/(tabs)/front-office/staff.tsx`
- Create: `apps/mobile/app/(tabs)/front-office/organization.tsx`
- Create: `apps/mobile/app/(tabs)/league/_layout.tsx`
- Modify: `apps/mobile/app/(tabs)/league/index.tsx`
- Create: `apps/mobile/app/(tabs)/league/standings.tsx`
- Create: `apps/mobile/app/(tabs)/league/schedule.tsx`
- Create: `apps/mobile/app/(tabs)/league/scores.tsx`
- Create: `apps/mobile/app/(tabs)/league/leaders.tsx`
- Create: `apps/mobile/app/(tabs)/league/teams.tsx`
- Create: `apps/mobile/app/(tabs)/league/people.tsx`
- Create: `apps/mobile/app/(tabs)/league/transactions.tsx`
- Create: `apps/mobile/app/(tabs)/league/records.tsx`
- Create: `apps/mobile/app/(tabs)/league/history.tsx`
- Create: `apps/mobile/app/(tabs)/league/team/[organizationId].tsx`
- Create: `apps/mobile/app/(tabs)/league/person/[personId].tsx`
- Create: `apps/mobile/app/(tabs)/league/season/[season].tsx`
- Create: `apps/mobile/src/league/leagueController.ts`
- Create: `apps/mobile/test/leagueController.test.ts`
- Modify: `apps/mobile/src/product/ProductSession.ts`

**Interfaces:**

- Staff area exposes `Staff Room`, `Organization Map`, `Staff History` from Task 13.
- League landing prioritizes material weekly changes and exposes stable destinations for Standings, Schedule, Scores, Leaders, Teams, People, Transactions, Records and History. A destination with no accepted-world data shows an honest unavailable/empty state rather than fabricated content.
- Material weekly changes and rivalry/team history use structured recorded facts.
- History/transaction/people/team lists page or virtualize and preserve season/team/person context on detail round trips.

- [ ] **Step 1: Write RED controller tests** for season/team/person context preservation and invalidation.
- [ ] **Step 2: Implement staff/organization screens** with authority vocabulary visible at the decision level.
- [ ] **Step 3: Implement League landing and historical drill-downs** without an event-feed dump.
- [ ] **Step 4: Add accessible chronology labels and semantic headings** for long histories.
- [ ] **Step 5: Run targeted tests, mobile typecheck and iOS export**; require PASS.
- [ ] **Step 6: Run integration checkpoint** `npm run ci`; require A–E green.
- [ ] **Step 7: Commit** `feat(package-f): build staff and league history experience`.

### Task 15: Add Game Day, GameCast and Postgame/Sunday Proof Read Models

**Files:**

- Create: `packages/sim-core/src/packageFGameDayView.ts`
- Create: `packages/sim-core/src/packageFPostgameView.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/packageFGameDayView.test.ts`
- Create: `packages/sim-core/test/packageFPostgameView.test.ts`

**Interfaces:**

- `buildPackageFGameDayView(world, viewer, fixtureId, ruleset): PackageFGameDayView` separates `blockingProblems`, `warnings`, `medicalContext`, `designationContext`, `authorityContext`, opponent/public context and available actions.
- Hard blockers come only from accepted domain legality (`gameDayProblems`, scheduled-game legality, current authority, hard clearance/protected constraints). Staff advice is never upgraded into a legal veto by presentation.
- `buildPackageFPostgameView(world, viewer, gameId): PackageFPostgameView` composes `fastSimSummary`, safe football decision view and Sunday Proof.
- `selectCondensedGameCastFrames(frames): readonly GameCastFrame[]` is pure/deterministic and includes, at minimum, scoring changes, turnovers, fourth-down plays, terminal play and late-game high-leverage snaps; it never consumes RNG or alters the ledger.
- `buildPackageFSundayProofSummary(...)` is structured and sparse. It may return zero highlighted causal items. Every surfaced item retains source causal-link/play IDs.
- Turning points are selected from recorded game facts only; no generative narrative causality.

- [ ] **Step 1: Write RED Game Day tests** proving warnings and blockers remain distinct and that unavailable authority removes execute actions.
- [ ] **Step 2: Write RED condensed-frame tests** for deterministic selection and ordered subset identity.
- [ ] **Step 3: Write RED Sunday Proof tests** proving every highlighted statement references retained causal/fact IDs and an unsupported game may return no highlight.
- [ ] **Step 4: Implement the pure projections** using existing Package E `footballView`, `gameCast`, `gameDay` and `sundayProof` APIs.
- [ ] **Step 5: Add presentation-purity tests** proving all F game views leave world fingerprint/RNG unchanged.
- [ ] **Step 6: Run targeted tests plus** `fastSimEquivalence`, `presentationRng`, `gameCast`, `sundayProofDisclosure`, `packageEPresentationEquivalence`; require PASS.
- [ ] **Step 7: Commit** `feat(package-f): add game day and postgame read models`.

### Task 16: Build Game Day, Fast Sim, Condensed/Full GameCast and Postgame

**Files:**

- Create: `apps/mobile/app/game/[fixtureId]/index.tsx`
- Create: `apps/mobile/app/game/[fixtureId]/cast.tsx`
- Create: `apps/mobile/app/game/[fixtureId]/postgame.tsx`
- Create: `apps/mobile/src/game/gameDayController.ts`
- Create: `apps/mobile/src/game/gameCastController.ts`
- Create: `apps/mobile/src/game/postgamePresenter.ts`
- Create: `apps/mobile/test/gameDayController.test.ts`
- Create: `apps/mobile/test/gameCastController.test.ts`
- Modify: `apps/mobile/src/product/ProductSession.ts`
- Modify: `apps/mobile/src/preferences/productPreferences.ts`

**Interfaces:**

- `ProductSession.resolveDueGame(fixtureId)` submits the existing `ResolveScheduledGame` command exactly once as the selected GM/progression actor and persists through `CareerLifecycle.submit`.
- Presentation mode is chosen before/after resolution as a UI preference only: `fast | condensed | full`.
- GameCast controller reveals already-resolved frames by index/timer. Advancing frame index, changing speed, skipping or backgrounding cannot issue simulation commands.
- Reopening after a resolved game resumes from authoritative final state and may continue presentation/postgame without re-resolving.
- Game Day UI shows blockers separately from warnings/advice.
- Full GameCast anchor contains score, period/clock, possession/offense, down-distance, field position, current play/drive context and inspectable principals/statistics.
- Postgame shows result/turning points/performances/injuries/standings context that exists, then optional sparse Sunday Proof.

- [ ] **Step 1: Write RED controller tests** proving only `resolveDueGame` submits a game-resolution command; frame reveal/speed/skip submit none.
- [ ] **Step 2: Implement Game Day** and legal resolution action.
- [ ] **Step 3: Implement Fast Sim route** as immediate transition from accepted resolution to postgame.
- [ ] **Step 4: Implement Condensed and Full GameCast** over Task 15 frames with Reduce Motion/static transitions.
- [ ] **Step 5: Implement postgame/Sunday Proof** with source-linked structured facts and no forced praise.
- [ ] **Step 6: Run targeted tests, mobile typecheck and iOS export**; require PASS.
- [ ] **Step 7: Run integration checkpoint** `npm run ci`; require A–E green.
- [ ] **Step 8: Commit** `feat(package-f): build game day and gamecast experience`.

### Task 17: Harden Accessibility, Navigation Restoration and Repeated-Workflow Performance

**Files:**

- Create: `apps/mobile/src/accessibility/semanticLabels.ts`
- Create: `apps/mobile/src/performance/projectionMetrics.ts`
- Create: `apps/mobile/test/accessibilitySemantics.test.ts`
- Create: `apps/mobile/test/projectionPerformance.test.ts`
- Modify: Package F list/workspace screens from Tasks 6, 8, 10, 12, 14, 16
- Modify: `apps/mobile/src/navigation/navigationMemory.ts`

**Interfaces:**

- All primary interactive targets have at least 44 CSS px hit dimensions.
- Every semantic state has a text/icon/shape label in addition to color.
- Drag-enabled interactions, if any exist by this point, have explicit button/menu alternatives.
- `NavigationMemory.restore(key, validation)` returns prior state only when referenced stable IDs remain valid in the current read model.
- `measureProjection(name, fn)` is development/test instrumentation only and cannot alter result/state.
- Representative pure read-model stress fixture target: median < 25 ms and p95 < 75 ms for Command Center, current roster and one player profile on the developer machine; if hardware variance makes the exact threshold flaky, fail the task and document/approve a measured replacement rather than silently removing the gate.
- Physical-iPhone target for warm local transitions among primary tabs/roster/player detail: first meaningful local content should normally appear within 250 ms; any repeatable >500 ms path is a blocker for review.

- [ ] **Step 1: Write RED semantic tests** for Command Center, roster status, medical state and War Room labels; no critical state may require color interpretation.
- [ ] **Step 2: Write RED navigation tests** for valid restore and stale entity/workspace invalidation.
- [ ] **Step 3: Add synthetic stress fixture and RED performance assertions** around pure read models; keep the benchmark bounded/deterministic.
- [ ] **Step 4: Replace any remaining non-virtualized long lists** with `FlatList`/appropriate virtualization and remove read-model recalculation from scroll/render callbacks.
- [ ] **Step 5: Audit Reduce Motion, Dynamic Type and VoiceOver order** across Islaria, Command, Team, War Room and GameCast; fix in the owning components.
- [ ] **Step 6: Run targeted tests, mobile typecheck and iOS export**; require PASS.
- [ ] **Step 7: Commit** `perf(package-f): harden long-session product workflows`.

### Task 18: Add the Package F Deterministic Product Scenario and Cross-Runtime Evidence

**Files:**

- Create: `packages/sim-core/src/packageFScenario.ts`
- Create: `packages/sim-core/src/packageFScenarioRun.ts`
- Create: `packages/sim-core/src/packageFGoldenExpected.ts`
- Modify: `packages/sim-core/src/index.ts`
- Create: `packages/sim-core/test/packageFScenario.test.ts`
- Modify: `packages/headless/src/bin.ts`
- Modify: `scripts/hermes-golden.mjs`
- Modify: `package.json`

**Interfaces:**

- `runPackageFScenario()` starts from the accepted Package E seed/ruleset, exercises a representative product-safe path (viewer setup -> Command Center -> player/team views -> front-office/War Room projections -> scheduled-game resolution -> Fast Sim/GameCast/Postgame projections), and returns canonical hashes/identities for both authoritative world and selected F read-model payloads.
- Scenario must not introduce a new authoritative Package F command type merely for evidence.
- Add scripts `golden:package-f:check`, `golden:package-f:write`, `hermes:package-f:check`.
- Extend root `ci` so Package F golden and Hermes parity run after A–E goldens and before iOS export.
- Golden records read-model canonical hash plus authoritative fingerprint/event-chain/game identity; presentation-only operations do not change authoritative fingerprint.

- [ ] **Step 1: Write RED scenario test** asserting deterministic repeated runs and Fast/Condensed/Full presentation identity.
- [ ] **Step 2: Implement the scenario runner** by calling production commands/read models only.
- [ ] **Step 3: Generate the first Package F expected golden intentionally** with `npm run golden:package-f:write`; review the diff before accepting it.
- [ ] **Step 4: Run** `npm run golden:package-f:check` twice and `npm run hermes:package-f:check` twice; require identical MATCH output.
- [ ] **Step 5: Run complete** `npm run ci`; require all A–F checks green.
- [ ] **Step 6: Commit** `test(package-f): add product parity scenario`.

### Task 19: Physical iPhone Acceptance and Package F Evidence

**Files:**

- Create: `apps/mobile/src/diagnostics/packageFJudgement.ts`
- Modify: `apps/mobile/app/diagnostics.tsx`
- Create: `docs/release/PACKAGE_F_ACCEPTANCE.md`
- Create: `docs/handoff/PACKAGE_F_START_HERE.md`
- Modify only if evidence requires: launcher/helper scripts already used for Package E; do not replace working launch plumbing gratuitously.

**Interfaces:**

- Package F diagnostic judgement reports safe product/golden parity facts and never displays auth tokens or latent football truth in the normal product shell.
- Physical acceptance covers: first launch; guidance/franchise setup; Command Center; roster filter/open/back restoration; canonical player profile; health/development; trade workspace round trip; contract batch/deep paths; protected-target free agency; roster moves; Scouting/War Room/draft-history round trips; staff/Organization Map; League/season/history navigation; Game Day; Fast Sim; Full/Condensed GameCast; postgame/Sunday Proof; app background/reopen/recovery notice; Reduce Motion; VoiceOver linear pass; long-list responsiveness.
- Record fresh Node/Hermes Package F golden values and physical iPhone results in `PACKAGE_F_ACCEPTANCE.md`.
- Acceptance is blocked by any mismatch in authoritative fingerprint/game identity, broken navigation restoration, inaccessible critical decision action, repeated warm navigation >500 ms, or normal UI leakage of debug/latent values.

- [ ] **Step 1: Add the Package F diagnostics judgement** and test its output against the accepted Package F golden.
- [ ] **Step 2: Run complete CI fresh** `npm run ci`; capture exit 0 and exact Package F golden/Hermes values.
- [ ] **Step 3: Launch the production Package F shell on the physical iPhone** under the interactive user/session and execute the acceptance flows above.
- [ ] **Step 4: Record measured performance/accessibility observations** and any defects; fix defects in their owning task files and rerun affected targeted/full gates before claiming acceptance.
- [ ] **Step 5: Re-run Fast Sim/GameCast parity after all visual fixes**; confirm score, stats, injuries, play-ledger identity, RNG draw count, event chain and final world fingerprint are unchanged.
- [ ] **Step 6: Write `PACKAGE_F_ACCEPTANCE.md` and `PACKAGE_F_START_HERE.md`** with exact evidence, known deferrals and Package G handoff boundaries.
- [ ] **Step 7: Run final** `git diff --check && npm run ci` and require exit 0.
- [ ] **Step 8: Commit** `evidence(package-f): record product acceptance gates` and push only after verification.

## Implementation sequencing and CI cadence

The intended sequence is strictly Tasks 1 -> 19 because later surfaces consume interfaces created earlier. To avoid the old “full suite every five minutes” pattern without weakening evidence:

- every task runs its targeted RED/GREEN tests and relevant workspace typecheck;
- iOS export runs whenever navigation/native UI surface changes materially;
- full `npm run ci` runs after Tasks 3, 6, 10, 14, 16, 18 and 19;
- any task that changes accepted sim-core authoritative behavior unexpectedly stops immediately for design review rather than updating a golden casually;
- Package F read-only projections should not require a world-model version bump. If implementation appears to require one, stop and re-review the design boundary before coding it;
- before each task is accepted, the reviewer applies the spec's ten-question Final Design Test: one authoritative path, legitimate knowledge only, real authority, decision usefulness, repeated-action speed, context preservation, accessibility, no fake urgency/causality/precision, Year-10 value and football-management identity.

## Explicit non-goals during execution

- Do not build real 32-team/NFL-like content in Package F.
- Do not add mid-game key-decision authority.
- Do not add cloud/accounts/monetization.
- Do not add universal ratings, trade meters, acceptance percentages or generated AI analyst prose.
- Do not redesign Packages B–E authoritative mechanics merely to simplify a screen.
- Do not replace proven Package E game resolution with a UI-specific simulation path.

## Plan self-review result

Self-review coverage map:

- Spec §§1–4 (promise/scope/architecture/design laws) -> Global Constraints, Review Focus, Tasks 1–4 and per-task Final Design Test.
- Spec §§5–6 (navigation, Islaria, onboarding/help) -> Tasks 5–6.
- Spec §7 (player/team/health/development) -> Tasks 7–8.
- Spec §8 (trades/contracts/free agency) -> Tasks 9–10.
- Spec §9 (scouting/draft/War Room/history) -> Tasks 11–12.
- Spec §§10–11 (staff, organization, league/history) -> Tasks 13–14.
- Spec §§12–14 (weekly cadence, Game Day, GameCast, postgame/Sunday Proof) -> Tasks 4, 6, 15–16.
- Spec §§15–18 (visual system, accessibility, performance, errors/recovery) -> Tasks 3, 5, 6, 17.
- Spec §§19–22 (500-hour protections, anti-AI test, read models, navigation state) -> Global Constraints plus Tasks 4–17.
- Spec §§23–24 (acceptance and evidence gates) -> Tasks 18–19.
- Spec §§25–27 (deferrals/final design test/end state) -> Explicit non-goals, sequencing gate and Package G handoff in Task 19.

Self-review findings resolved before plan review: the plan now explicitly covers GM Academy/help, recovery notice, stable Depth & Roles navigation, roster moves, batch contract triage without bypassing validation, protected free-agency intent, preserved historical draft evaluations, all nine League destinations, loaded-career GM/team mismatch fail-closed behavior, and the spec's ten-question Final Design Test.

The plan intentionally keeps all new `packageF*View` modules pure. The only planned Package F path that advances authoritative state is the existing production command gateway through `CareerLifecycle.submit`; the deterministic scenario runner likewise invokes existing commands rather than inventing Package F authority.
