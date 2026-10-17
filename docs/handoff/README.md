# Sport Sim — canonical handoff documents

Source: `SportSim_Programmer_Handoff_RECOVERY_FIXED.zip` (supersedes all earlier handoff ZIPs).
Recovery decision: Package A source was lost; Package A is being REIMPLEMENTED from the frozen iPhone-first
architecture and the canonical Package A iPhone plan (Tasks 1-12). Historical evidence (55/55 tests, 60/60 files,
commit `0660961`, old golden hashes) is NOT acceptance evidence for this tree.

## Document status (expected SHA-256 from the pack's SHA256SUMS.txt)

| Doc | Expected SHA-256 | Status in repo |
| --- | --- | --- |
| canonical/03 Package A iPhone Implementation Plan | `2d72f0421da26c745b93dafd6a522edd778816f4584c026d32e5bb051837e484` | PRESENT, hash verified (17,555 bytes) |
| canonical/01 SPORT_SIM_PROJECT_BRAIN | `c7db968a03ef9db6e20d9d2f76b38f5a199c01d9c68e0b8b1c796b290b8ca090` | PENDING byte-exact copy from the zip |
| canonical/02 Architecture (EXTRACTED TEXT, truncated at line 1000 of 1657) | `94fb9caf12cc6ee1fba7c2ba3b7e5520cac16728f8346d0fc101a90460e56264` | PENDING byte-exact copy from the zip |
| canonical/04 Build Sequence & Decision-Core Spec | `e0d6a2a01e828583689d2bacc61a8acdcc78fe180e58d2e42073367b09547069` | PENDING byte-exact copy from the zip |
| canonical/05 Game Blueprint | `927ba001d44b43c9d32d5de7de3d445ca7fa45153de4814f3a9f173d642e8fc9` | PENDING byte-exact copy from the zip |
| canonical/06 Final Prebuild Research Synthesis | `9e811f578646bf392e67dddab96b9eef52b1c10fbd1c8a79fa3b5f0754e51447` | PENDING byte-exact copy from the zip |

Frozen architecture (exact 66,400-byte file): `docs/superpowers/specs/2026-10-16-sport-sim-architecture-product-design.md`
— PENDING. The Windows copies are currently unreadable (ACL denies the owner account); needs elevated `takeown`/`icacls`.

Documents are never retyped: they are copied byte-for-byte and verified against these hashes.
