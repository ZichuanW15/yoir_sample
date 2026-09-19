# Multi-platform QA results — 16 September 2026

Local execution of the then-uncommitted QA overlay on `sprint2-qa`, HEAD `3e7f4b348c03504360af04d438202e37a5428e83`; product baseline `0ffa565e47d60fc2783a4618e5dce6cfe73a4b08`. That execution changed no product source, dependency lockfile, remote issue or PR. Its results are retained below; later publication and remote CI have separate provenance.

Run `20260916T043532.423770Z`: **04:35:32.424–04:38:36.829 UTC** (14:35–14:38 Melbourne). Recorder completed all 22 checks, returned **1**, and confirmed unchanged executed-source/config fingerprints (`reproducible: true`, `changedDuringRun: []`). Only the four ordinary defect groups returned nonzero; no infrastructure check failed in this final run.

## Results by evidence layer

| Layer | Regression | Unresolved defect execution |
| --- | --- | --- |
| Shared frontend components/logic | 265 passed, 24 suites | 24 failed, 8 suites |
| iOS Expo-preset components | 274 passed, 25 suites | 25 failed, 8 suites |
| Android Expo-preset components | 274 passed, 25 suites | 25 failed, 8 suites |
| Chromium + isolated real API | 14 passed | 5 failed; no runner errors or retries |
| PostgreSQL backend | 347 passed, 12 deselected | 19 strict xfails, not passes |
| Separate live PostgreSQL API | HTTPX 2 passed; real TypeScript client 2 passed | — |
| QA tooling / Board generator | 23 / 49 passed | — |

No ordinary frontend or browser cases were skipped. Backend deselection is the existing ten future-contract cases plus two live cases executed separately. Native totals include shared tests and must not be added as independent product capabilities or distinct defects. iOS/Android results are **component/configuration evidence, not simulator/device or native-build acceptance**.

Lint, typecheck, existing frontend coverage gates, fresh Web export, backend lint, metadata and whitespace checks passed. Workflow `actionlint` and QA-tooling Ruff also passed separately. Frontend whole-app line coverage is 96.14%; backend combined line/branch measure is 94.39%. Coverage does not prove missing APIs or correct acceptance behavior. The production npm audit critical gate passed with **0 critical, 1 high and 15 moderate** findings; this is not an all-vulnerabilities-clear result.

### Later coverage audit — retained execution

The [16 September local coverage audit](coverage-audit-20260916.md) reconciles these raw results with current product-file hashes and all 20 QA issues. Shared frontend line/branch coverage is **96.14% / 87.23%**; backend line/branch coverage is **95.15% / 90.38%**. No independent iOS, Android, Chromium or manual-device coverage percentage was collected. This later read-only audit does not change the execution totals above or claim a new application run.

## What the additional checks established

- All seven mocked 403 write paths reject without local fallback or false success. Public resource 404 errors retain the original server error. Browser registration of a pending counsellor confirms the actual publish 403, preserved draft and no persisted service.
- The real API reports seeded Maya as verified, but the actual browser dashboard displays **Verification pending** with no profile-preview explanation. The user-provided screenshot is reproducible locally as a data-provenance problem; it does not prove the backend publishing gate was removed.
- A service persisted as 7050 minor units displays **$71**, not $70.50, on marketplace and detail. Entering **-70.50** publishes and persists a positive-price service. These browser failures independently confirm existing component-level integrity defects.
- Native presets verify actual platform/module resolution, login/registration keyboard configuration, password masking, confirmation acceptance/cancellation, splash configuration and confirmation gesture settings. Font-error tests remain failing at the shared rendered-tree and mocked native splash boundaries.
- Profile unavailable/save tests allow clear recovery with saving disabled rather than mandating a PATCH request. Missing-route, missing-resource and proxy-response cases still fail because the UI falsely reports durable success.

The full verification/LinkedIn review workflow remains deferred to Sprint 3. This QA change does not decide pending/rejected publishing eligibility or alter the existing backend gate. See [scope](scope.json), [platform matrix](platform-test-matrix.md) and [reproduction](reproduction.md).

## Reproduction and local evidence

The complete local run remains under ignored `artifacts/qa/sprint2/20260916-multiplatform-final/`. [Reviewed original outputs](evidence/20260916-multiplatform/README.md) are now included in the QA branch with their hashes and publication boundaries. The manifest distinguishes retained per-case results/logs/coverage/Web evidence from omitted artifacts. Tracked `evidence/latest/` remains the **15 September historical run**. Copying retained outputs does not rerun the suites or update their timestamps.

The final run used Node 20.20.2, Python 3.12.14, PostgreSQL 16.15 and the existing Playwright Chromium cache. The repository `.venv` lacked psycopg2, so the run explicitly used the existing complete QA interpreter `/private/tmp/yoir-sprint2-qa/venv/bin/python`. Fresh environments should install locked dependencies using the reproduction guide. Regression and live API used two new databases on an owned loopback PostgreSQL; each browser invocation used an owned temporary SQLite database. The owned API and PostgreSQL were stopped after execution.

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/yoir-s2-playwright \
/private/tmp/yoir-sprint2-qa/venv/bin/python scripts/run_sprint2_qa.py \
  --backend-python /private/tmp/yoir-sprint2-qa/venv/bin/python \
  --postgres-url postgresql://qa_local@127.0.0.1:55439/qa_multiplatform_test \
  --live-api-url http://127.0.0.1:58009/api/v1 \
  --output artifacts/qa/sprint2/20260916-multiplatform-final
```

This is the executed command, not an instruction to reuse stopped servers or overwrite evidence. For a rerun, provision fresh owned QA services and choose a new output path. Never use a shared database.

SHA-256 of the original local `summary.json`, which records source hashes, commands and every result:

`94f1d8707fbb3bd75aa99c1d41b0b22153ba5f2f50d81880dda63e61eba5a8de`

After this automated run, both native environments were installed and limited
manual smoke runs were executed on the dedicated iPhone 17 simulator (iOS 27
build `24A434`) in Xcode 27 Device Hub and the dedicated Android API 36 emulator
docked in IntelliJ IDEA, both using Expo Go 57.0.9. See the
[measured native-device results](native-device-results-20260916.md) and
[environment status](native-environment.md). Android observations included guest
browsing, incorrect-password rejection, corrected login with the booking
destination retained, stub-booking confirmation with matching persisted
order/booking, both-role logout, and system Photo Picker opening/cancellation.
Signed-out Android Back gestures were observed, but post-payment Back delivery
was not verified. These later observations do not change any automated totals
above or establish full native-platform sign-off. Permission grant/denial, image
selection/upload/save, remaining back/gesture behavior, Android protected deep
links, cold-start fault recovery, registration and service-creation coverage
remain outstanding; see the
[platform matrix](platform-test-matrix.md).
