# 16 October 2026 — selected Sprint 3 execution evidence

Product baseline: `cdcc44e66d647a9c5993736b797312b495715a3f`. The local QA overlay
is identified by [source-manifest.json](source-manifest.json). Packaging is not a
rerun. UTC times on 15 October evening correspond to 16 October in Melbourne.

## Canonical final results

| Evidence | Purpose |
| --- | --- |
| [executions.json](executions.json) | Exact commands, directories, UTC start/end, exits and per-run source overlays |
| [added-case-inventory.json](added-case-inventory.json) | 112 unique added regression cases and 10 defect cases, relative to dev |
| [frontend-shared.json](frontend-shared.json) | 479 normal passes, full case names/outcomes |
| [frontend-ios.json](frontend-ios.json), [frontend-android.json](frontend-android.json) | 488 component passes each; no device claim |
| [backend-postgres-final.xml](backend-postgres-final.xml) | 811 passes, 21 strict expected failures; 7 deselections described in console |
| [browser-regression.json](browser-regression.json) | All 25 Chromium journeys passed |
| [browser-defects.json](browser-defects.json) | 1 repaired assertion passed, 5 defect assertions failed |
| [shared](frontend-shared-defects-final.json), [iOS](frontend-ios-defects-final.json), [Android](frontend-android-defects-final.json) | Final advisory outcomes, including new admin/privacy failures |
| [live-httpx.xml](live-httpx.xml), [live counts](live-after.json) | Real network/database evidence; TypeScript output is in the execution console |
| [frontend coverage](frontend-coverage.json), [backend coverage](backend-coverage.json) | Measured files and missing backend lines/branches |
| [environment.json](environment.json), [live-static-checks.json](live-static-checks.json) | Runtime versions, dependency comparison and same-origin static/API checks |
| [manifest.json](manifest.json), [validation.json](validation.json) | Selected artifact hashes and independently checked consistency |

The `logs/` folder retains command diagnostics, including dependency-audit
advisories and original unmasked race/field-omission failures. The review race
`backend-review-concurrency-cause` log records SQLSTATE, unique constraint and
both barrier arrivals. `attachments/` retains selected JSON proofs, screenshots
and error context; browser case records link their retained attachments.

## Earlier attempts and limitations

`backend-privacy-focused`, `browser-authoring` and other non-final labels are
retained authoring/discovery evidence. They are not added to final pass totals.
The first backend broad run preceded the last privacy-contract cases and tighter
race classification; `backend-postgres-final` covers the final backend sources.
The initial defect runs preceded one privacy UI case; `*-defects-final` covers it.
Application source hashes stayed equal to the recorded dev commit.

Jest and Playwright results are reduced to all per-case outcomes and diagnostics;
the manifest stores each original report's SHA-256 alongside its derivative.
Regenerable HTML/LCOV and browser trace ZIPs remain in ignored
`artifacts/qa/sprint3-20261016/`. No physical-device execution, real external
payment/email delivery, deployed environment or new remote CI is claimed.

## Verify retained bytes

From the repository root, using Python 3.12:

```bash
backend/.venv/bin/python - <<'PY'
import hashlib, json
from pathlib import Path
root = Path('docs/sprint3/qa/evidence/20261016')
for item in json.loads((root / 'manifest.json').read_text())['files']:
    data = (root / item['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
    assert len(data) == item['bytes'], item['path']
print('All retained artifact hashes match')
PY
```

Use [the plan](../../test-plan.md) to rerun the application suites. Matching
retained hashes proves evidence integrity; it does not rerun tests or resolve
their failures.

## Publication preparation

Seven historical log/XML files contain publication-time redactions of 29 truncated
local test Authorization bearer fragments. Assertions, dates, result counts and
error messages are otherwise unchanged. The [manifest](manifest.json) records
each original packaged hash, published hash and redaction count. Original files
remain in ignored local artifacts; source-report hashes retain their provenance.
This is publication sanitization, not a new test execution or a product fix.
