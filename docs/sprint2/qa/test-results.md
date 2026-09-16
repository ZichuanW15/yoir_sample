# Historical test results — 15 September Web/API baseline

This report and `evidence/latest/` retain the original execution unchanged. They do not certify the later iOS/Android component matrix; see [16 September results](test-results-multiplatform.md) and [platform scope](platform-test-matrix.md).

**Baseline:** `0ffa565e47d60fc2783a4618e5dce6cfe73a4b08` · **branch:** `sprint2-qa` · **run:** `20260915T080621.058365Z`.

**Executed:** 2026-09-15T18:06:21+10:00 to 2026-09-15T18:08:15+10:00 (Australia/Melbourne). Exact UTC times for every check appear below.

The complete recorder finished with exit **1**, caused only by the frontend and browser defect checks. All other recorded checks returned 0. All 145 recorded execution-source/config/input hashes were stable. This is a reviewable QA result with unresolved product defects, not an all-green product sign-off.

## Executed results

| Layer | Result | Evidence |
| --- | --- | --- |
| Frontend normal | **256 passed**, 23 suites, 0 skipped | [Jest JSON](evidence/latest/frontend-tests.json) |
| Frontend defect probes | **18 failed**, 8 suites; correct expectations reproduce existing defects | [Jest JSON](evidence/latest/frontend-defects.json) · [log](evidence/latest/frontend-defects.log) |
| PostgreSQL backend | **347 passed**, **19 strict xfailed**, 0 ordinary skipped/failures/errors; 12 deselected | [JUnit](evidence/latest/backend-tests.xml) · [log](evidence/latest/backend-tests.log) |
| Browser + real API (temporary SQLite) | **13 passed**, 0 skipped/flaky, one Chromium worker, no retries | [Playwright JSON](evidence/latest/browser-web/results.json) · [log](evidence/latest/browser-web.log) |
| Browser defect probes | **2 failed**, no runner errors; same empty-slot/forged-confirmation defects independently reproduced | [Playwright JSON](evidence/latest/browser-web-defects/results.json) · [log](evidence/latest/browser-web-defects.log) |
| HTTPX live + PostgreSQL | **2 passed** | [JUnit](evidence/latest/httpx-live.xml) |
| Real TypeScript client + PostgreSQL | **2 passed** | [Jest JSON](evidence/latest/typescript-live.json) |
| Recorder / archive tests | **21 passed** (12 recorder + 9 archive) | [log](evidence/latest/evidence-runner-tests.log) |
| Board tests | **49 passed** | [log](evidence/latest/board-tests.log) |
| Lint, types, build, metadata, diff | All pass | Per-check table below |
| Workflow / QA-tooling lint | Both pass | [Supplemental checks](evidence/latest/supplemental-checks.json) |

Backend JUnit encodes xfail as `skipped type="pytest.xfail"`; these 19 are known defects, not ordinary environmental skips and not passes. The 12 deselected items are 10 `future_contract` checks and two separately executed live checks. Archived frontend 31 probes were not run. Individual rows use different layers/fixtures, so do not add them as distinct user journeys.

## Supporting SQLite run

An independently executed backend SQLite run passed **337**, with **19 xfails**, **10 PostgreSQL-only skips** and **12 deselected**. Its actual timestamp is embedded in [SQLite JUnit](evidence/latest/backend-sqlite.xml), with [complete log](evidence/latest/backend-sqlite.log). It used the same unchanged backend test sources; the definitive concurrency and timezone evidence is the later full PostgreSQL run above.

## Coverage

| Measurement | Covered / total | Percent |
| --- | --- | --- |
| Frontend statements, complete app/src | 1428 / 1524 | 93.70% |
| Frontend branches, complete app/src | 820 / 940 | 87.23% |
| Frontend functions, complete app/src | 441 / 491 | 89.81% |
| Frontend lines, complete app/src | 1221 / 1270 | 96.14% |
| Backend statements | 785 / 825 | 95.15% |
| Backend branches | 141 / 156 | 90.38% |
| Backend combined coverage.py measure | (785 + 141) / (825 + 156) | 94.39% |

All existing core-area Jest gates passed. Whole-app percentages are visibility, not a new blanket gate or proof that every behavior is correct. [Frontend coverage JSON](evidence/latest/frontend-coverage/coverage-summary.json), [backend coverage JSON](evidence/latest/backend-coverage.json).

## Real persistence and environment

Live HTTPX and TypeScript journeys used their own seeded PostgreSQL database, separate from the destructive in-process fixture database. [Before/after database evidence](evidence/latest/live-database-check.json) verifies users +4, services +1, orders +2, bookings +2 and open slots −2. Slot create/edit/delete leaves no extra slot in the live counsellor journey. All fixture accounts and tokens are disposable local test data.

[Runtime versions](evidence/latest/runtime-versions.log): Node 20.20.2, npm 10.8.2, Python 3.12.14; locked frontend/backend dependencies. The local database version is recorded with live database counts. Browser evidence is Chromium desktop Web against SQLite; PostgreSQL tests separately verify locking and offset behavior. No iOS/Android, Safari/Firefox, remote deployment or real payment provider execution is claimed.

Production dependency audit returned **0 critical, 1 high and 16 moderate** findings. The existing critical-level gate passed; dependencies were not changed to repair these findings. [Raw audit](evidence/latest/frontend-production-audit.log).

## What ran, when, and outcome

| Check | UTC start → end | Exit | Seconds | Log |
| --- | --- | ---: | ---: | --- |
| runtime-versions | 2026-09-15T08:06:21.078+00:00 → 2026-09-15T08:06:21.203+00:00 | 0 | 0.13 | [log](evidence/latest/runtime-versions.log) |
| frontend-lint | 2026-09-15T08:06:21.203+00:00 → 2026-09-15T08:06:22.033+00:00 | 0 | 0.83 | [log](evidence/latest/frontend-lint.log) |
| frontend-typecheck | 2026-09-15T08:06:22.033+00:00 → 2026-09-15T08:06:23.623+00:00 | 0 | 1.59 | [log](evidence/latest/frontend-typecheck.log) |
| frontend-tests | 2026-09-15T08:06:23.623+00:00 → 2026-09-15T08:06:37.725+00:00 | 0 | 14.1 | [log](evidence/latest/frontend-tests.log) |
| frontend-defects | 2026-09-15T08:06:37.725+00:00 → 2026-09-15T08:06:40.866+00:00 | 1 | 3.14 | [log](evidence/latest/frontend-defects.log) |
| frontend-production-audit | 2026-09-15T08:06:40.867+00:00 → 2026-09-15T08:06:43.706+00:00 | 0 | 2.84 | [log](evidence/latest/frontend-production-audit.log) |
| backend-test-lint | 2026-09-15T08:06:43.706+00:00 → 2026-09-15T08:06:43.747+00:00 | 0 | 0.04 | [log](evidence/latest/backend-test-lint.log) |
| backend-source-lint | 2026-09-15T08:06:43.748+00:00 → 2026-09-15T08:06:43.786+00:00 | 0 | 0.04 | [log](evidence/latest/backend-source-lint.log) |
| backend-tests | 2026-09-15T08:06:43.787+00:00 → 2026-09-15T08:07:00.314+00:00 | 0 | 16.53 | [log](evidence/latest/backend-tests.log) |
| repository-metadata | 2026-09-15T08:07:00.315+00:00 → 2026-09-15T08:07:00.985+00:00 | 0 | 0.67 | [log](evidence/latest/repository-metadata.log) |
| evidence-runner-tests | 2026-09-15T08:07:00.985+00:00 → 2026-09-15T08:07:01.922+00:00 | 0 | 0.94 | [log](evidence/latest/evidence-runner-tests.log) |
| board-tests | 2026-09-15T08:07:01.923+00:00 → 2026-09-15T08:07:02.001+00:00 | 0 | 0.08 | [log](evidence/latest/board-tests.log) |
| web-build | 2026-09-15T08:07:02.002+00:00 → 2026-09-15T08:07:11.227+00:00 | 0 | 9.23 | [log](evidence/latest/web-build.log) |
| browser-web | 2026-09-15T08:07:11.227+00:00 → 2026-09-15T08:07:59.715+00:00 | 0 | 48.49 | [log](evidence/latest/browser-web.log) |
| browser-web-defects | 2026-09-15T08:07:59.715+00:00 → 2026-09-15T08:08:13.507+00:00 | 1 | 13.79 | [log](evidence/latest/browser-web-defects.log) |
| httpx-live | 2026-09-15T08:08:13.508+00:00 → 2026-09-15T08:08:14.117+00:00 | 0 | 0.61 | [log](evidence/latest/httpx-live.log) |
| typescript-live | 2026-09-15T08:08:14.117+00:00 → 2026-09-15T08:08:15.420+00:00 | 0 | 1.3 | [log](evidence/latest/typescript-live.log) |
| diff-check | 2026-09-15T08:08:15.421+00:00 → 2026-09-15T08:08:15.442+00:00 | 0 | 0.02 | [log](evidence/latest/diff-check.log) |

[Full recorder summary](evidence/latest/summary.json) includes exact commands, working directories and before/after hash checks. Failure details and exact selectors: [defect register](defects.md). Test-case names/outcomes are retained in full JSON/XML; screenshot and trace attachments accompany the Playwright JSON. Duplicate HTML bundles and LCOV views are regenerable and deliberately omitted from Git.

## Review and publication

At the time of the recorded run, no application source had changed and the QA changes had not been staged, committed or pushed. Remote `dev` was fetched before the run and matched the baseline. The user subsequently authorized committing and pushing `sprint2-qa`; branch publication makes these files available in the team repository. PR review is a separate next step. The results above describe local execution, not any later GitHub Actions run. See [submission guide](submission-guide.md).

## Publication preparation follow-up

Staging exposed trailing spaces emitted by Playwright and npm in the raw evidence. Narrow `.gitattributes` rules preserve those verbatim logs and generated error contexts while retaining normal whitespace checks for source code. The archive allowlist and its reconstruction test now include `.gitattributes`. Only packaging/format metadata changed after the full run; application and functional-test sources and raw execution evidence are unchanged. The QA tooling suite was rerun; see [publication checks](evidence/publication-checks.json).
