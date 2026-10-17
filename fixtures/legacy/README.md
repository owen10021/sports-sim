# Legacy fixtures (immutable)

`package-a-world-v1-snapshot.json` is a genuine Package A career (world model v1: the
`FootballWorld` has no `worldModelVersion` field): the genesis snapshot plus the three
committed commits of the `package-a-golden-v1` scenario, with the Package A expected
golden values embedded.

- Generated from Package A code at commit `078ad505f7f31826b8d453121ebe46b3863fc148`
  (the last commit before the Package B world-model change), on 2026-10-17.
- Size 13052 bytes, SHA-256 `da67913b6d2cbeea39424120129930cbb2fa4e9a673a3df7e45b6e8f51d44683`
  (see `SHA256SUMS.txt`; also pinned in `packages/sim-core/test/legacyFixtureIntegrity.test.ts`).
- It must NEVER be regenerated with newer code. It exists so that migration and legacy
  verification are tested against real Package A bytes, not a reconstruction.
- The Package A golden values it carries are also preserved in
  `evidence/package-a/golden-expected-world-model-v1.json`.
