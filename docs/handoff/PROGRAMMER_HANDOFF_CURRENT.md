# Sport Sim App — Current Programmer Handoff

**Handoff date:** 2026-10-16
**Canonical repo:** `C:\dev\sport-sim`
**Branch:** `main`
**Canonical resume commit:** `8dcc9156cf3175f6304957c2c4791ede75411935`

## Read this first

This file is the current operational resume point after the Windows profile incident. Do not restart the project, do not recreate Tasks 1–6, and do not treat historical pre-loss Package A evidence as acceptance for this rebuilt tree.

The product remains the iPhone-first American professional-football front-office / GM career RPG defined by the preserved canonical design documents. The current implementation is Package A only.

## Current verified implementation state

Tasks 1–6 of the canonical Package A iPhone implementation plan have been implemented in this rebuilt repository and committed through `8dcc915`:

1. Expo 57 workspace + authoritative primitive types
2. Ruleset, world-seed, and provenance contracts
3. Versioned deterministic RNG
4. `FootballWorld` + canonical fingerprint
5. Immutable command/event audit chain
6. Single `WorldKernel` mutation pipeline

The last fresh verification before this handoff was 58/58 tests passing and TypeScript typecheck clean. Re-run these yourself before relying on that evidence.

## Exact next task

Resume at **Task 7: Persistence Contract and Reference In-Memory Store** from:

`docs/handoff/canonical/03_Sport_Sim_Package_A_iPhone_Implementation_Plan_2026-10-16.md`

Do not skip ahead to SQLite until Task 7 contract tests are red, the contract/reference adapter is implemented, and the contract suite is green.
## Task 7 contract

Files:
- `packages/sim-core/src/persistence.ts`
- `packages/sim-core/test/persistenceContract.test.ts`

Required `CareerStore` operations:
- `initialize`
- `saveCommit`
- `loadLatest`
- `listVerifiedSnapshots`
- `loadHistorySince`
- `markRecovery`

Required behavior:
- snapshot/history DTOs stay SQLite-independent
- provide reference/test-only `MemoryCareerStore`
- RED tests first for initial save, append history, transaction visibility, future-schema rejection, and previous-snapshot retention
- then implement, run contract tests, and commit as `feat(core): define career persistence contract`

## Non-negotiable architecture rules

- One authoritative `FootballWorld`.
- Only `WorldKernel` commits authoritative football state.
- Human and CPU actors use the same domain rules and legitimate information boundaries.
- No hidden-truth access for CPU clubs.
- Historical beliefs/reports/decision context never rewrite with hindsight.
- Same authoritative state + ruleset + command sequence + RNG state must reproduce the same result.
- Presentation cannot mutate football reality or consume gameplay randomness.
- `packages/sim-core` remains pure TypeScript with no React/React Native/Expo/filesystem/SQLite/wall-clock/network imports.
- Rejected/stale/duplicate commands mutate nothing and consume no RNG.
- Save/load must fail closed on unsupported future schema.
- iPhone is the primary product surface; Windows development must remain viable.

## Remaining Package A sequence

After Task 7, continue in order only:

8. Expo SQLite Career Store
9. Integrity loading + last-known-good recovery
10. Deterministic replay + latest-state repair
11. iPhone lifecycle safety + diagnostics app
12. Headless runner + cross-runtime determinism + Package A gate

Package B has **not** started and must not start until Package A acceptance is demonstrated with fresh evidence.
## Canonical design/source hierarchy

The detailed design corpus is preserved outside the damaged Windows user profile. Precedence remains:

1. latest explicit user-approved amendment
2. frozen iPhone-first architecture
3. build-sequence / decision-core spec
4. game blueprint
5. final pre-build research synthesis
6. approved conversation-only additions captured in the project brain
7. programmer preference

The canonical Package A plan already present in this repo is the implementation authority for Tasks 1–12.

Repo handoff directory currently contains the Package A plan but not yet every byte-exact canonical design document. Do not infer that missing local copies mean the design was lost. Do not silently improvise around a missing design question; raise it.

## Windows/profile incident boundary

The original `owenr` Windows profile suffered major data loss/corruption. The user is currently operating from a new local administrator profile, `RescueAdmin`.

Do not perform cleanup, deletion, reset, profile migration, permission-recursion, or recovery experiments as part of Sport Sim implementation. Treat the old profile as read-only evidence unless the user explicitly authorizes a separate recovery operation.

`C:\dev\sport-sim` survived the profile incident. Git may report ownership concerns under `RescueAdmin`; the repository was added to this account's Git `safe.directory` list without changing repository contents or ownership.

## Evidence discipline

Historical Package A results from the lost pre-rebuild tree are reference/archaeology only. They do not satisfy acceptance for this tree.

Before claiming a task complete:
- run its targeted tests fresh
- run the required broader verification fresh
- inspect `git diff` / `git status`
- preserve failures rather than explaining them away
- commit and push each accepted task so local disk loss cannot erase progress

Do not declare Package A complete until every item in the Package A Acceptance Contract at the bottom of the canonical plan has fresh evidence.
