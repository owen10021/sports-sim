# Package E Task 17 Hermes Gate Amendment

Date: 2026-10-18
Status: implementation correction to the approved Package E plan

## Why this amendment exists

The approved Task 17 plan assumed that the platform `hermesc` binary installed by `hermes-compiler` could both compile and execute the Package E scenario.

That assumption is false for the clean installed toolchain in this repository. The installed Windows binary is:

`node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe`

It reports Hermes compiler release `1.0.0`, HBC bytecode version `99`, and successfully compiles the Package D/E bundles. It explicitly refuses execution and reports that `hermesc` does not support `-exec`. This matches Hermes' documented compiler/runtime separation: `hermesc` compiles, while a Hermes VM/runtime executes.

## Corrected host cross-runtime gate

Task 17 keeps the same architectural objective: Node and a real Hermes VM must agree exactly on the accepted deterministic identity, and the current React Native Hermes compiler must accept the exact scenario bundle.

The host gate is therefore split into two mandatory stages over the same generated source bundle:

1. **Current compiler gate**
   - Auto-discover the platform `hermesc` shipped by `node_modules/hermes-compiler`.
   - Compile the exact generated scenario source to HBC.
   - Missing/unsupported compiler binaries fail closed.

2. **Real Hermes VM identity gate**
   - Execute the same generated source in a real standalone Hermes VM.
   - `HERMES_CLI` or an explicit positional runtime path takes precedence.
   - On Windows, when no override is supplied, bootstrap the official pinned standalone Hermes release archive into ignored `evidence/tmp` storage.
   - Verify the archive and `hermes.exe` with fixed SHA-256 values before execution.
   - Never execute current HBC bytecode in the older standalone VM; the current compiler and execution VM are deliberately separate gates because their bytecode versions differ.

The pinned Windows runtime artifact is not committed to the repository. A fresh checkout obtains and verifies it when the host identity gate runs.

## Provenance pinned by the gate

- Official standalone release archive: `v0.13.0/hermes-cli-windows.tar.gz`
- Archive SHA-256: `485907ae87f267f7901f45c12979fea9703967ee2fa930bab887d022de9d6478`
- `hermes.exe` SHA-256: `c0962ee3f84f8767a6b24ff70d9ff91e7dc131920b4ae574b31f0b9043f6e685`
- Current clean-install compiler path on Windows: `node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe`

## What does not change

- No football behavior, probability, RNG contract, accepted golden value, world model, or persistence behavior changes because of this amendment.
- Package D and Package E must each MATCH the accepted Node identity in Hermes.
- Both Hermes host gates remain part of canonical `npm run ci`.
- Physical iPhone direct + SQLite-backed Package E diagnostics remain mandatory and are the final authority for the app's actual current on-device Hermes runtime.
- A physical-device MATCH cannot be fabricated or inferred from the host gate.

## Verification requirement

Before Task 17 is accepted:

- Package D host Hermes gate passes twice.
- Package E host Hermes gate passes twice.
- Fresh clean-checkout `npm ci` + `npm run ci` passes with compiler auto-discovery and both host Hermes gates enabled.
- Physical iPhone direct and SQLite-backed Package E diagnostics both report MATCH.
