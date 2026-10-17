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

## package-b-world-v2-snapshot.json

A genuine Package B career (world model v2): the genesis snapshot plus all 20 committed
commits of the `package-b-golden-v1` scenario, with the accepted Package B golden values embedded.

- Generated on 2026-10-17 from the accepted Package B code (source identical to `f50cb2119b874542787241d1f1767fe01865efcd`,
  tag `package-b-acceptance-20261017`), at repository commit `d6fe95e73b7bf7916be3949f8c8a1deea595480e`,
  BEFORE the Package C world-model change.
- Size 542740 bytes, SHA-256 `68a6bbc87cecc252a6695be284bf0ba0796a3d383388c561d3f5dd5352b86d84` (see `SHA256SUMS.txt`; also pinned in
  `packages/sim-core/test/legacyFixtureIntegrity.test.ts`).
- It must NEVER be regenerated with newer code.
- The Package B golden values are also preserved in `evidence/package-b/golden-expected-world-model-v2.json`.
