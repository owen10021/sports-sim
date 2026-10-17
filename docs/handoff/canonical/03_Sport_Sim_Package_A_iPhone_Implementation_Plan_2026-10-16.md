# Package A — iPhone World Kernel Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest production-grade iPhone-first foundation proving one authoritative `FootballWorld` can run identically in the mobile app and in headless QA, mutate through one command pipeline, persist locally, survive interruption, load/recover, replay deterministically, and remain App-Store-ready without requiring the developer to own a Mac.

**Architecture:** Use an npm workspace with an Expo SDK 57 iPhone app and a pure TypeScript `sim-core` package that has no React/React-Native dependency. The core owns authoritative state, deterministic RNG, ruleset/seed provenance, commands, events, and replay. The mobile app owns adapters only: Expo SQLite persistence, lifecycle/background handling, and a diagnostic UI. A Node headless runner imports the exact same core package for long-save and regression tests.

**Tech Stack:** Node.js 22.13+ (Windows machine currently has Node 24.19); npm workspaces; Expo SDK `57.0.30`; React Native `0.86`; React `19.2.3`; Expo Router `57.0.27`; Expo SQLite `57.0.4`; TypeScript strict mode; `@noble/hashes` `2.4.0`; Vitest for pure TypeScript tests; Expo-managed package versions installed with `npx expo install`; EAS Build/EAS Submit for future iOS cloud builds and App Store delivery.

**Spec:** `docs/superpowers/specs/2026-10-16-sport-sim-architecture-product-design.md`

## Global Constraints

- iPhone is the primary product surface. No player workflow may require a Mac or desktop computer.
- Package A targets iOS 16.4+ and Expo SDK 57. Re-check current Apple submission requirements before every TestFlight/App Store release.
- Expo SDK 58 is not the foundation baseline yet because it was released on 2026-10-15; upgrade only through a dedicated compatibility gate.
- `packages/sim-core` imports no React, React Native, Expo, filesystem, SQLite, wall-clock, or network APIs.
- There is exactly one authoritative football universe. UI and headless tools consume the same `sim-core` implementation.
- Only the World Kernel may commit authoritative state changes.
- Every meaningful mutation follows `Intent → Validation → Authorization → Resolution → Commit → Event(s)`.
- Same authoritative state + ruleset + command sequence + RNG state produces the same authoritative result across Node and Hermes/React Native.
- Authoritative deterministic math uses integers and explicit 32-bit operations where randomness is involved; do not rely on `Math.random()`.
- Simulation dates are timezone-free value objects; never use device local time for simulation progression.
- Real-world seed/ruleset metadata carries provenance and effective/as-of dates. Package A ships synthetic fixtures only.
- Career data is offline-first. Cloud sync/accounts are out of scope.
- The mobile UI never stores authoritative world state as its own mutable copy.
- A background/suspend or force-close may not partially commit a command.
- SQLite writes use explicit transactions; acknowledged authoritative history exists only after commit.
- Failed persistence leaves the prior verified snapshot usable.
- Save schema starts at version `1`; unsupported future versions fail closed.
- Canonical hashes use SHA-256 via `@noble/hashes` 2.4.0 over deterministic canonical bytes.
- Commit `package-lock.json`; dependency upgrades require full determinism/replay gates.
- No branded 2026 NFL dataset is part of Package A.

## Review Focus

1. **Duplicate/stale command submission:** must reject without RNG consumption, revision increment, event append, or state change. Covered in Task 6.
2. **Mobile interruption during save:** previous verified snapshot remains usable and command acknowledgement is not emitted early. Covered in Tasks 8 and 11.
3. **Corrupt newest snapshot:** loader detects checksum failure, falls back to newest verified snapshot, then replay-repairs latest state when history is intact. Covered in Tasks 9–10.
4. **Cross-runtime determinism drift:** Node and iPhone/Hermes produce the same canonical fingerprint for the same synthetic scenario. Covered in Tasks 4, 10, and 12.
5. **Unsupported schema/ruleset:** load/replay fails explicitly rather than guessing. Covered in Tasks 2, 7, 9, and 10.

---

## File Structure to Create

```text
package.json
package-lock.json
tsconfig.base.json
vitest.config.ts
.github/workflows/package-a-ci.yml

apps/mobile/
  package.json
  app.json
  eas.json
  tsconfig.json
  app/
    _layout.tsx
    index.tsx
    diagnostics.tsx
  src/
    persistence/sqliteCareerStore.ts
    lifecycle/careerLifecycle.ts
    platform/idSource.ts

packages/sim-core/
  package.json
  tsconfig.json
  src/
    index.ts
    ids.ts
    simDate.ts
    canonical.ts
    hash.ts
    provenance.ts
    ruleset.ts
    seed.ts
    rng.ts
    world.ts
    audit.ts
    commands.ts
    kernel.ts
    replay.ts
    persistence.ts
  test/
    primitives.test.ts
    provenance.test.ts
    rng.test.ts
    world.test.ts
    audit.test.ts
    kernel.test.ts
    persistenceContract.test.ts
    replay.test.ts

packages/headless/
  package.json
  tsconfig.json
  src/main.ts
  test/smoke.test.ts

fixtures/
  rulesets/synthetic-minimal-v1.json
  seeds/synthetic-empty-v1.json
```

### Boundary responsibilities

- `packages/sim-core`: pure deterministic authoritative simulation. No mobile/platform dependencies.
- `apps/mobile`: iPhone UI and platform adapters. It may depend on `sim-core`; core never depends on it.
- `packages/headless`: Node QA/debug runner using the exact production core.
- `fixtures`: synthetic package data only.

---

### Task 1: Expo 57 Workspace and Authoritative Primitive Types

**Files:** root workspace files; `apps/mobile` shell; `packages/sim-core/src/{ids,simDate,canonical,hash}.ts`; `packages/sim-core/test/primitives.test.ts`.

**Interfaces:**
- Produces branded `WorldId`, `EntityId`, `CommandId`, `EventId`, `WorldRevision` types and `ActorRef`.
- Produces `SimDate.parse(iso)`, `addDays(n)`, `toISO()` with no timezone dependence.
- Produces `canonicalBytes(value)` and `Hash32.sha256(bytes)` returning 64 lowercase hex characters.

- [ ] Write primitive tests first: ID round trip, `2026-10-16 + 1 = 2026-10-17`, leap-day behavior, deterministic key ordering, SHA-256 exact known vector.
- [ ] Run `npm test -- primitives` and confirm RED because APIs do not exist.
- [ ] Create the Expo SDK 57/npm workspace and minimal core implementation. Use `expo@57.0.30`, Expo Router `57.0.27`, Expo SQLite `57.0.4`, and `@noble/hashes@2.4.0`; let `npx expo install` pin compatible React Native packages and commit the lockfile.
- [ ] Run `npm run typecheck && npm test -- primitives` and confirm GREEN.
- [ ] Commit `feat(core): establish iPhone workspace and world primitives`.

### Task 2: Ruleset, World Seed, and Provenance Contracts

**Files:** `packages/sim-core/src/{provenance,ruleset,seed}.ts`; fixtures; `test/provenance.test.ts`.

**Interfaces:**
- Produces `ValidationStatus`, `SourceProvenance`, `RulesetRef`, `LeagueRulesetManifest`, `SeedRef`, `WorldSeedManifest`.
- Each manifest hashes a canonical body excluding its own embedded content hash.
- `validateForWorldCreation()` accepts only synthetic/verified required sources and exact seed→ruleset identity/version/hash match.

- [ ] Write five failing provenance/version/tamper tests.
- [ ] Run targeted test and confirm RED.
- [ ] Implement schema version `1`, exact hash validation, synthetic fixtures, and explicit future-version errors.
- [ ] Run targeted tests plus `npm test` and confirm GREEN.
- [ ] Commit `feat(core): define ruleset and seed provenance contracts`.

### Task 3: Versioned Deterministic RNG

**Files:** `packages/sim-core/src/rng.ts`; `test/rng.test.ts`.

**Interfaces:**
- Produces `RngState { algorithm: 'xoshiro128ss-v1'; s0; s1; s2; s3; draws }` where words are uint32.
- Produces `DeterministicRng.fromSeed(seed32)`, `nextU32()`, `nextInt(maxExclusive)`, `snapshot()` and `restore(state)`.
- No `Math.random()` in authoritative code.

- [ ] Write RED tests for exact first output vector, snapshot/restore, bounded integer draws, zero/invalid bounds, and no state consumption on validation errors.
- [ ] Implement xoshiro128** using explicit JS 32-bit operations and unsigned normalization.
- [ ] Run tests under Node twice and assert identical vectors.
- [ ] Commit `feat(core): add versioned deterministic rng`.

### Task 4: FootballWorld and Canonical Fingerprint

**Files:** `packages/sim-core/src/world.ts`; `test/world.test.ts`.

**Interfaces:**
- Produces `FootballWorld` with world ID, schema version, ruleset ref, seed ref, sim date, revision, RNG state, next IDs, and minimal authoritative domain state.
- Produces `createWorld(seed, ruleset, idSource)` and `fingerprintWorld(world)`.
- Fingerprint excludes presentation/read caches and includes every authoritative field.

- [ ] Write RED tests for valid creation, invalid package rejection, same-input fingerprint equality, and fingerprint change on authoritative mutation.
- [ ] Implement minimal world creation/fingerprint.
- [ ] Run full core tests and confirm GREEN.
- [ ] Commit `feat(core): add authoritative football world`.

### Task 5: Immutable Command/Event Audit Chain

**Files:** `packages/sim-core/src/audit.ts`; `test/audit.test.ts`.

**Interfaces:**
- Produces `CommandEnvelope`, `EventEnvelope`, `DecisionTrace`, `chainEvent(previousHash,eventBody)` and `verifyEventChain(events)`.
- Each event records world revision, simulation date, actor, command ID, event ID, payload, previous hash, and current hash.

- [ ] Write RED tests for append-only ordering, tamper detection, broken previous-hash detection, and deterministic hashes.
- [ ] Implement SHA-256 chained event envelopes.
- [ ] Run tests and commit `feat(core): add tamper-evident audit history`.

### Task 6: Single World Kernel Mutation Pipeline

**Files:** `packages/sim-core/src/{commands,kernel}.ts`; `test/kernel.test.ts`.

**Interfaces:**
- First command is `AdvanceDays { days: number }` solely to prove the pipeline.
- Produces `WorldKernel.execute(commandEnvelope): CommandResult`.
- Validates schema, expected revision, actor authority, and payload before resolution; commit is atomic in memory.
- Successful command increments revision exactly once and appends event(s); rejected command changes nothing and consumes no RNG.

- [ ] Write RED tests for success path, stale revision, duplicate command ID, invalid days, unauthorized actor, and invariant that all rejected commands leave fingerprint/RNG/audit unchanged.
- [ ] Implement minimum kernel pipeline.
- [ ] Run core suite and commit `feat(core): enforce single mutation pipeline`.

### Task 7: Persistence Contract and Reference In-Memory Store

**Files:** `packages/sim-core/src/persistence.ts`; `test/persistenceContract.test.ts`.

**Interfaces:**
- Defines `CareerStore` interface: `initialize`, `saveCommit`, `loadLatest`, `listVerifiedSnapshots`, `loadHistorySince`, `markRecovery`.
- Defines snapshot/history DTOs independent of SQLite.
- Provides test-only/reference `MemoryCareerStore` to run the same contract suite before the mobile adapter exists.

- [ ] Write RED contract tests for initial save, append history, transaction visibility, future-schema rejection, and previous snapshot retention.
- [ ] Implement interfaces/reference adapter.
- [ ] Run contract tests and commit `feat(core): define career persistence contract`.

### Task 8: Expo SQLite Career Store

**Files:** `apps/mobile/src/persistence/sqliteCareerStore.ts`; mobile persistence integration tests/diagnostic hook.

**Interfaces:**
- Implements `CareerStore` using Expo SQLite.
- Tables: metadata, snapshots, commands, events, recovery_log.
- A save transaction inserts pending commands/events + verified snapshot, then updates active snapshot pointer as the final statement.
- SQLite adapter never owns simulation decisions.

- [ ] Write adapter contract test harness before implementation; it must be runnable inside Expo runtime and expose PASS/FAIL to diagnostics.
- [ ] Implement schema v1 and explicit transaction boundaries with foreign keys.
- [ ] Add fault injection immediately before commit and prove the old active snapshot remains loadable.
- [ ] Run TypeScript/Vitest suite and Expo runtime contract harness; commit `feat(mobile): add transactional sqlite career store`.

### Task 9: Integrity Loading and Last-Known-Good Recovery

**Files:** mobile SQLite store + `packages/sim-core/src/replay.ts`; `test/replay.test.ts`.

**Interfaces:**
- `loadCareer()` verifies schema, snapshot hash, ruleset/seed refs, and event-chain head.
- Corrupt active snapshot triggers newest older verified snapshot fallback with explicit `RecoveryReport`; never silently treats corrupt data as valid.

- [ ] Write RED corruption/future-schema/missing-history tests.
- [ ] Implement verified fallback and recovery reporting.
- [ ] Run tests and commit `feat(save): recover from corrupt active snapshots`.

### Task 10: Deterministic Replay and Latest-State Repair

**Files:** `packages/sim-core/src/replay.ts`; persistence adapter; replay tests.

**Interfaces:**
- `replayFrom(snapshot, commands)` executes the exact production kernel.
- `verifyCareerReplay()` compares final world fingerprint and event-chain head.
- `repairLatestFromHistory()` may write a new verified snapshot only when the immutable history verifies fully.

- [ ] Write RED tests proving replay equality and intentional mismatch detection.
- [ ] Write RED test where newest snapshot is corrupt but history is intact and repair reconstructs exact latest fingerprint.
- [ ] Implement replay/repair with no alternate mutation path.
- [ ] Run full suite and commit `feat(save): add deterministic replay and repair`.

### Task 11: iPhone Lifecycle Safety and Diagnostic App

**Files:** `apps/mobile/app/{_layout,index,diagnostics}.tsx`; `src/lifecycle/careerLifecycle.ts`; `src/platform/idSource.ts`.

**Interfaces:**
- Home screen is deliberately minimal: create/load synthetic career and link to diagnostics.
- Lifecycle coordinator flushes only already-committed kernel results; app backgrounding cannot invent a simulation command.
- Diagnostic screen displays world ID, sim date, revision, fingerprint, save verification, replay verification, and SQLite contract status.

- [ ] Write lifecycle unit tests first: background during pending save, resume after successful save, and repeated lifecycle events are idempotent.
- [ ] Implement lifecycle coordinator and minimal touch-first diagnostics UI.
- [ ] Run `npm run typecheck`, tests, and `npx expo export --platform ios` on Windows.
- [ ] Verify the synthetic career can create → advance → save → reload → fingerprint-match in Expo runtime.
- [ ] Commit `feat(mobile): prove safe iPhone career lifecycle`.

### Task 12: Headless Runner, Cross-Runtime Determinism, and Package A Gate

**Files:** `packages/headless/**`; `.github/workflows/package-a-ci.yml`; root scripts/docs.

**Interfaces:**
- CLI commands: `create`, `advance`, `inspect`, `verify`, `replay` for synthetic careers.
- Golden scenario file records command sequence and expected final fingerprint/event-chain head.
- Mobile diagnostics runs the same golden scenario and must match the Node outputs exactly.

- [ ] Write RED headless smoke/golden scenario test.
- [ ] Implement headless runner using `sim-core` only.
- [ ] Add CI: `npm ci`, typecheck, unit tests, lint/format, headless golden scenario, Expo iOS bundle export.
- [ ] On Windows run the entire CI-equivalent command set fresh and record exact output.
- [ ] Run golden scenario inside Expo/Hermes and compare exact fingerprint + event-chain head with Node.
- [ ] Commit `test(package-a): gate iPhone world kernel foundation`.

---

## Package A Acceptance Contract

Package A is complete only when all of the following are demonstrated with fresh evidence:

1. The same synthetic career scenario runs through the same `sim-core` kernel in Node and the iPhone Expo/Hermes runtime.
2. Their final world fingerprint and event-chain head are byte-for-byte identical.
3. Stale/duplicate/rejected commands mutate nothing and consume no RNG.
4. A committed career survives app background/resume and process restart.
5. Fault injection during SQLite save preserves the previous verified snapshot.
6. Corrupt newest snapshot is detected and recovered from verified history without pretending corruption did not occur.
7. Deterministic replay reproduces exact authoritative state and can repair a bad latest snapshot when immutable history remains valid.
8. No React/React Native/Expo import exists in `packages/sim-core`.
9. `npx expo export --platform ios` succeeds from Windows, proving the JS/native dependency graph is iOS-bundle-compatible without owning a Mac.
10. Current TestFlight/App Store requirements are documented as a release-time revalidation gate; EAS cloud build/submission is the planned delivery path.

## Explicitly Out of Scope for Package A

Real NFL rosters, contracts, logos, player likenesses, staff data, scouting, trades, drafting, development, football gameplay, polished Command Center UI, accounts/cloud sync, monetization, analytics, and App Store submission itself.

Package A creates the trustworthy iPhone foundation those systems will use; it does not fake progress by building them early.