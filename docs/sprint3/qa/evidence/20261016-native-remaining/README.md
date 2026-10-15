# Remaining native cases evidence — 16 October 2026

**FINAL local run; acceptance remains incomplete.** See the
[report](../../test-results-native-remaining-20261016.md) and
[machine-readable summary](summary.json).

## Scope and counting

D01 and D04–D13 on iOS and Android comprise **22 case/platform combinations**:
**11 PASS, 8 FAIL, 3 BLOCKED, 0 IN PROGRESS, 0 whole cases NOT RUN**.
The [ledger](case-ledger.json) retains **110 planned substeps: 84 PASS, 9 FAIL,
15 BLOCKED and 2 NOT RUN**. The two true offline reset-submission substeps were
not executed; a controlled HTTP503 does not replace that boundary. Checkpoints
and substeps are not additional cases. Android D09 remains FAIL because its
separate Bookings false-empty checkpoint failed, although its four named
Payments/transition substeps passed.

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

## Evidence limits

These are native **Expo Go / local SQLite / development-stub payment** results.
They do not establish real email delivery, received-link routing, Stripe/provider
transactions, notification delivery, PostgreSQL concurrency, signed builds,
physical devices or deployment. Password-change entry, confirmation and
submission require manual user handoff under the computer-use policy; none was
performed. One iOS payout action was rejected by automatic approval review
because it could start external financial-provider onboarding; the click was
not executed. Android provider onboarding was not attempted.

Some iOS screenshots contain a system password-save prompt. Where it obscures
profile or payout fields, the report explicitly uses the native accessibility
tree plus independent readback and does not claim the image alone proves them.
FAIL and BLOCKED cases retain successful bounded checkpoints and unexecuted
substeps; no external or incomplete case is promoted to PASS.
