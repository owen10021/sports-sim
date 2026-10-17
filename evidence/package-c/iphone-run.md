# Package C physical iPhone run

- Date: 2026-10-17 18:10 America/New_York
- Device: Owen's iPhone, Expo Go (not TestFlight), Diagnostics > Run Package C scenario
- Code under test: main at 2bd5249 (Metro served from Owen's PC; later commits change tests only)
- Kernel vs Node: MATCH Node Package C (fingerprint + event-chain head)
- SQLite round trip: MATCH after SQLite save, reload and replay
- Fingerprint: bf2e44d0c2609b59d506f90560e4248a5fe97664bb316b968f4f96fe34e055d4
- Event-chain head: 3f847dec6c81e179bb285617a9d8ae9eadf7c5e7e6bea2dd0edf2f61e2424e76
- Source: transcribed from Owen's screenshot (image itself not stored in repo). Both values equal
  PACKAGE_C_EXPECTED, the Node run and the standalone Hermes run.
- Run took a few minutes on the phone (103 steps persisted to SQLite and replayed).
