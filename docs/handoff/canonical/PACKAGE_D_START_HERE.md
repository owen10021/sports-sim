# Package D - Start Here

Date: 2026-10-17  
Status: **AUTHORIZED FOR IMPLEMENTATION**

Package D is authorized after repository review and amendment of the implementation plan.

Read in this order before touching production code:

1. `docs/handoff/canonical/Sport_Sim_Package_D_Design_Basis_2026-10-17.md`
2. `docs/handoff/canonical/Sport_Sim_Package_D_Implementation_Plan_2026-10-17.md`
3. accepted predecessor evidence at tag `package-c-acceptance-20261017`

The implementation plan's **Repository-review amendment (approved 2026-10-17)** is part of the plan and has full implementation authority. In particular:

- preserve all accepted A/B/C golden files; create new model-4 current-model A-v4/B-v3/C-v2 versions rather than overwriting history;
- support stored legacy Package C world-model-3 snapshots in persistence;
- open `workload_usage`, `medical_clearance`, and `scheme` additively through the existing proposal/domain-commit machinery;
- preserve daily RNG interleaving in `AdvanceDays` and use the D-domain projection for coarse-vs-fine equivalence;
- update `commandSupport.ts` whenever new authoritative D record IDs are introduced;
- keep opportunity-window creation explicit in D; do not invent recurring automatic windows;
- use the Package C `forEach`/helper pattern for scenario-driver loops that capture closure variables under Hermes.

## Execution contract

Implement Tasks 1-15 strictly in order. Use RED -> GREEN for new/changed behavior. Each accepted task gets its specified targeted tests, required broader gates, one reviewable commit, and push before continuing.

Do not ask for routine permission between green tasks. Continue automatically unless a plan stop condition is reached.

Do not start Package E.

Stop and report before improvising if implementation would introduce or require any of the following:

- fixed destiny/potential/OVR/XP abstraction;
- latent-truth leakage into ordinary decision policy;
- universal coach-development multiplier;
- non-conserved opportunity requiring product policy;
- collapsed or omniscient medical state;
- an unplanned Package E football assumption;
- a fake hard-coded NFL empirical claim;
- authority bypass;
- migration/persistence/replay meaning break;
- unresolved dominant development exploit;
- physical-iPhone acceptance action.

At each task report the commit, tests/gates run, and any interpretation or deviation. Do not silently edit the approved plan to fit accidental implementation behavior.
