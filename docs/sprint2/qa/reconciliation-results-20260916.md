# Issue reconciliation — delta-only verification

Verified **16 September 2026, final targeted test completion by 06:30:27 UTC**
(16:30 Melbourne). Local branch `sprint2-qa`, QA HEAD `3e7f4b3`, product baseline
`0ffa565`. No Git staging/commit/push, remote issue/PR/Wiki write, product-source
change, dependency install, or existing application-suite rerun was performed.

## Changes in this increment

- Dated read-only GitHub child-state and parent-AC snapshot: **20 QA issues,
  #87/#94/#97 closed, 17 open**. The older snapshot remains historical.
- Machine-readable issue evidence plus generated human-readable matrix distinguish
  implemented passes, real defects, unimplemented parent requirements and native
  observations/gaps. No row claims full acceptance because its task is closed.
- Corrected stale native Not run text, the registration planned-probe comment,
  the PR draft's contradictory device-execution sentence, and submission guidance
  for updating existing PR #155 rather than creating a duplicate.
- Added ten remaining-only native scenario groups, each explicitly **NOT RUN**.
  These reuse completed smoke checkpoints and do not certify new device behavior.
- Added a read-only traceability checker, CI/recorder integration, and an explicit
  QA packager allowlist entry. Future recorder hashes include reconciliation inputs.

## New QA-tooling verification only

Using the existing Python **3.12.14** environment:

```sh
backend/.venv/bin/python -B scripts/check_sprint2_qa_traceability.py --verify-local-artifacts
backend/.venv/bin/python -B -m unittest discover -s scripts/tests -p test_qa_traceability.py -v
backend/.venv/bin/ruff check --no-cache scripts/check_sprint2_qa_traceability.py scripts/tests/test_qa_traceability.py scripts/run_sprint2_qa.py scripts/package_sprint2_qa.py
/private/tmp/yoir-sprint2-qa/actionlint/actionlint .github/workflows/app-ci.yml
git diff --check
```

- Traceability and retained original summary checksum: **passed**.
- New traceability unit cases: **13 passed**. They cover source/state/parent
  mapping drift, duplicates/missing tasks, stale native scope, disappeared device
  gaps, invalid paths, missing sources, mismatched matrix, artifact tampering,
  honest CLI status and the packaging boundary. No application runner is invoked.
- Targeted Ruff, workflow actionlint and whitespace check: **passed**.
- Local Markdown link validation: **149 links across 17 changed/new documents passed**.
- Read-only comparison of `frontend/app`, `frontend/src` and `backend/app` against
  product baseline `0ffa565`: **no business-source differences**.
- An earlier development iteration ran 12 of these new cases on system Python
  3.9.6; that is not 12 additional product tests. The final 13-case execution above
  uses the project Python. Ruff's first cache-enabled attempt hit a local cache
  permission error; the explicit no-cache run passed without weakening rules.

## Reused evidence, not a new passing application run

The original automated run and its failures remain exactly those in
[multi-platform results](test-results-multiplatform.md); its original `summary.json`
SHA-256 remains:

`94f1d8707fbb3bd75aa99c1d41b0b22153ba5f2f50d81880dda63e61eba5a8de`

The [manual device report](native-device-results-20260916.md) remains the only
measured native result. No Jest, backend pytest, Chromium, live API or simulator
test was repeated for this reconciliation. New tooling checks must not be added
to product test totals or described as fixing the known acceptance failures.
This update changes QA metadata/tooling, so the historical source fingerprint
is not relabelled as the current entire working-tree fingerprint.

Raw automated artifacts remain local and ignored. The original temporary native
databases are not promised as retained evidence. New scenarios require their own
measured runs and independent persistence checks before their NOT RUN status can
change. Business fixes, full native acceptance and publication remain separate.
