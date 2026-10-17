# Package B — START HERE

**Status:** APPROVED FOR IMPLEMENTATION

**User authorization:** Owen explicitly authorized the team to do whatever is needed to get the programmer working on Package B on 2026-10-17.

## Canonical plan

Read and execute:

`docs/handoff/canonical/Sport_Sim_Package_B_Implementation_Plan_2026-10-17.md`

## Immediate next action

Start **Task 1: Refactor Kernel Dispatch Without Changing Package A Behavior**.

Use the same discipline that closed Package A:
- TDD: RED before implementation, GREEN before acceptance.
- One reviewable commit per accepted task.
- Push each accepted task before starting the next.
- Preserve Package A acceptance evidence/tag/backups exactly as-is.
- Do not start Package C until the Package B acceptance contract is green.
- Do not touch the damaged old `owenr` Windows profile.
- If implementation exposes a material conflict with the frozen architecture or this plan, stop and raise it rather than silently redesigning.

## Architecture boundary

Package B owns People / Organizations / Information / Relationships / Plans and the shared authority/decision substrate. It does not implement Package C roster/contracts/markets/scouting/draft features.

## Offsite backup note

The Package A bundle/source archive currently also exist locally under `C:\dev\backups\package-a-acceptance-20261017\`. Moving those artifacts off-PC is still required, but it is **not a blocker to starting Package B** because the Package A source/tag already exist in GitHub.
