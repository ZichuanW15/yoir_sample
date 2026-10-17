# Remaining native cases evidence — 16 October 2026

See the [report](../../test-results-native-remaining-20261016.md) for the
completed cases from the 16 October Expo Go simulator/emulator execution.

## Scope and counting

The selected **19 completed case/platform outcomes** are **11 PASS and 8 FAIL**.
The [completed-case selection](../../completed-native-cases-20261016.json) records
exact case/platform identities and original source hashes. Counts use whole-case
PASS/FAIL verdicts. Checkpoints are evidence for those cases, not additional cases.
Android D09 remains FAIL because its Bookings false-empty checkpoint failed,
although its four Payments/transition substeps passed.

The earlier [D02/D03 package](../20261016-native/README.md) contains four separate
historical passes, excluded from this run's totals. No earlier evidence was
replaced.

## Included evidence

- [106 root observations](observations.json), mainly Android with the initial
  iOS onboarding failure, and [104 iOS observations](ios/observations.json),
  original PNG screenshots and available accessibility text. Android UI was
  operated through IDEA Running Devices; host accessibility text alone does
  not prove device-screen content.
- [Device metadata](device-final-facts.json), [service environment](services/environment.json),
  [explicit fixtures](services/fixtures.json), controlled request/fault audits,
  and independent API readbacks. Fixtures are preconditions, not native actions.
- [Final reconciliation](services/final-reconciliation.json): fresh logins and
  readbacks for 14 synthetic accounts, corroborating stored state without adding
  UI passes. [Final source verification](services/source-integrity-final.json)
  matches all 346 baseline hashes.
- [Service cleanup](services/cleanup.json): three owned processes exited0,
  ports43189/8099/43219 released, fault rules empty and temporary SQLite directory
  removed. [Android network cleanup](device-network-cleanup.json) removed only
  the two matching reverse mappings, leaving an empty list. Its ownership
  assessment explicitly notes that the original creation log was not retained.
  Devices and applications were left running.
- [Publication allowlist](services/publish-safety.json), [original-byte copy audit](copy-audit.json),
  [local validation](validation.json), and [SHA-256 manifest](manifest.json).
  The manifest covers every packaged file except itself.

Originals were copied from `artifacts/qa/sprint3-native-remaining-20261016/`
after the observations and service evidence were frozen. The service allowlist
excludes private credentials, live fault controls, executable Python harness,
navigation HTML and raw logs. The synthetic QA avatar is the only source image
included. Original observation records include restart restoration, but a
separate process-lifecycle command log was not retained; final device metadata
does not prove earlier restarts.

## Recorded environment

These are **Expo Go simulator/emulator / local SQLite / development-stub payment**
results. Original observations, screenshots and independent readbacks identify
the tested behavior. Some iOS screenshots include a system password-save prompt;
profile and payout observations use the accessibility tree and independent
readbacks alongside the screenshots. Executed failures retain their actual verdicts.
