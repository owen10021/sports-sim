# Package C — Start Here

Status: **AUTHORIZED FOR IMPLEMENTATION**

Approval date: 2026-10-17

Canonical implementation plan:
`docs/handoff/canonical/Sport_Sim_Package_C_Implementation_Plan_2026-10-17.md`

Canonical design basis:
`docs/handoff/canonical/Sport_Sim_Package_C_Design_Basis_2026-10-17.md`

Accepted predecessor boundary:
- Package B accepted commit: `f50cb2119b874542787241d1f1767fe01865efcd`
- Package B tag: `package-b-acceptance-20261017`

## Execution instruction

Pull current `main`, read the design basis and implementation plan in full, then begin **Task 1: Freeze Accepted Package B and Version the World Model for Package C**.

Execute Package C task-by-task with TDD/RED→GREEN where applicable. Each accepted task gets targeted tests, the required broader gates, one reviewable commit, and a push before continuing. Do not wait for routine confirmation after each green task.

Continue automatically through Package C unless one of these stop conditions occurs:

- a material conflict with the frozen architecture or approved Package C plan;
- a change would invalidate or rewrite accepted Package A/B evidence rather than preserve it historically;
- a locked product decision would need to change;
- an unresolved migration, save-integrity, determinism, or information-leak problem appears;
- a required gate needs physical user action, especially the final iPhone diagnostics.

Do not start Package D until every Package C acceptance gate is green and Package C is accepted/tagged.

## Non-negotiable architecture

- One authoritative `FootballWorld`; only `WorldKernel` commits authoritative state.
- Human and CPU actors use the same domain legality and legitimate-information boundaries.
- No ordinary actor reads latent player truth directly.
- No universal OVR, fixed-destiny potential, universal trade-value oracle, hidden offer-score minigame, or oracle trade finder.
- Package B remains the authority/proposal/approval/receipt and knowledge/provenance substrate; Package C extends it rather than duplicating it.
- Transactions are atomic and revalidated at commit.
- League-specific mechanics belong to `LeagueRuleset`.
- Market concurrency uses logical simulation time, never UI or wall-clock speed.
- Historical beliefs, reports, proposals, approvals, offers, and receipts remain immutable as-of records.
- Package C stops before Package D development/practice/medical/opportunity, Package E football, and Package F polished primary UX.

This file is the explicit authorization to implement Package C and supersedes any older `PLAN FOR REVIEW` status from pre-approval history.