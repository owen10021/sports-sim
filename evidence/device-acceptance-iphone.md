# Package A on-device acceptance (physical iPhone, Expo Go)

Observed by the project owner on 2026-10-17 from the app's Diagnostics screen (screenshots supplied in the working session; not committed). Runtime: Expo Go on a physical iPhone, Expo SDK 57, Hermes, real expo-sqlite engine. Code under test: main at 3c36169.

## Golden scenario (acceptance 1 and 2)

- Kernel vs Node: MATCH (fingerprint + event-chain head)
- SQLite round trip: MATCH after SQLite save, reload and replay
- Fingerprint: fd3baa44a20b08e5e6f4948adc6f123da62c7239ad04062f185f8cec96a53bda
- Event-chain head: d9c18cb91bcfe9f09afe2cbd58f154ceaea9cb65f7c0606c3c5a8e9729ff897a

These equal GOLDEN_EXPECTED (Node), the independent Python reference and the standalone Hermes run.

## SQLite contracts on the real engine (acceptance 3, 5, 6, 7)

- CareerStore contract: PASS 19/19
- Recovery + repair contract: PASS 16/16

Includes stale/duplicate/rejected commands changing nothing, injected save faults preserving the previous snapshot, corrupt-newest-snapshot detection with explicit fallback, and replay-based repair.

## Career persistence across app restart (acceptance 4, restart half)

After creating a career and advancing twice, then closing and reopening the app:

- World: world-5ba539e4-d523-474c-ac55-4f713e14d0bc, sim date 2026-10-30, revision 2, events 2, pending saves 0
- Stored career: verified (snapshot hash, ruleset/seed refs, event chain, rev 2)
- Full-history replay: matches stored state (fingerprint 6e588609cf4b...)

## Background/resume (acceptance 4, background half)

A second Diagnostics screenshot taken after sending Expo Go to the background and reopening it showed the identical career: rev 2, 2 events, same fingerprint (6e588609cf4b...) and event-chain head, stored career verified, replay matching, pending saves 0. The screenshot itself cannot prove the app was backgrounded first; the owner reported doing it.

## Defects found by this run, fixed before acceptance

1. Replay line reported a mismatch on an empty store (fixed with a test, db64566).
2. expo-sqlite returns one shared connection for `:memory:` on device, so contract cases leaked state into each other (16/19 and 16/16 failed). Fixed with unique scratch databases, 3c36169. Node tests could not reproduce it; the device run was the failing test.

## Not covered by this record

- Runs were in Expo Go, not a TestFlight/App Store build. See docs/release/testflight-revalidation-gate.md.
- The golden scenario was observed once per screenshot; a second consecutive golden run was requested but not separately captured.
