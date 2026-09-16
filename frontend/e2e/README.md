# Browser QA for implemented functionality

These tests run the actual exported Expo Web app against the actual FastAPI app.
Each Playwright invocation starts its own server on `127.0.0.1` with a new temporary
SQLite database and the application's seed data. The server ignores a caller's
`DATABASE_URL`. No deployment, existing database or product source is modified.

## Reproduce

From `frontend/`, after installing the frontend and backend locked dependencies:

```sh
npx playwright install chromium
EXPO_PUBLIC_API_URL=/api/v1 EXPO_PUBLIC_USE_DEMO_API=false npm run build:web
WEB_QA_OUTPUT_DIR=test-results/web-normal npm run test:web
WEB_QA_OUTPUT_DIR=test-results/web-defects npm run test:web:defects
```

`test:web:defects` uses ordinary correctness assertions and currently exits
nonzero for reproduced defects. Keep its report separate from the normal suite;
a known failure is not a passed test. The main QA report records the current
counts, execution time and result files.

The default backend interpreter is `backend/.venv/bin/python`. Set
`YOIR_QA_PYTHON` to another installed backend interpreter if necessary. The
default port is `43117`; `WEB_QA_PORT` selects a different unused port. If browsers
are installed in a custom directory, retain the same `PLAYWRIGHT_BROWSERS_PATH`
when installing and running Playwright. `WEB_QA_DIST_DIR` can select another Web
export built with the API settings above.

## What the run verifies

- Public catalogue, implemented local keyword filtering, no-match feedback,
  detail navigation and network recovery.
- Both implemented registration roles, duplicate-email feedback, invalid-login
  recovery, real login/logout, server token revocation and protected navigation.
- Selecting a slot, creating an order, completing the implemented stub payment
  and showing the returned booking receipt. This is a stub-payment test.
- Counsellor service publication, delivery modes and location validation, API
  persistence, persistence after a fresh explicit login, and draft-preserving
  retry after one deliberately failed transport request.
- Availability creation, time/duration editing and removal through the browser,
  with independent API reads after each operation and Melbourne time checks.
- A newly registered pending counsellor's current publish-403 path: draft retained,
  no claimed success and no service persisted. This characterizes today's backend
  gate, not the final policy for the deferred Sprint 3 verification workflow.

Only the two `@injected-network` tests intercept browser requests. They abort a
request to exercise failure handling, then remove interception and use the real
API for recovery. Other tests use no mocked transport responses.

The defect group checks empty-slot feedback and forged-confirmation claims, plus
three integrity cases: a real verified identity must not be silently labelled
Pending by local profile fallback, persisted prices must retain cents on both
marketplace/detail, and negative input must not be converted to a positive price
and published. These use the actual local API, not successful response mocks.
Planned backend-driven Web filtering and automatic
session restoration are preserved in [planned acceptance proposals](planned/acceptance-proposals.md)
and are outside this run.

## Evidence

Each output directory contains `results.json`, an HTML report, explicitly attached
journey screenshots where a case captures them, and screenshots plus traces for failures.
Open the HTML report with `npx playwright show-report <output>/html`, or inspect
a failure with `npx playwright show-trace <path-to-trace.zip>`.

These Chromium Web checks complement the PostgreSQL and component suites. They
do not claim native iOS/Android device execution or PostgreSQL concurrency
coverage.

For availability persistence reads only, the helper interprets SQLite's
offset-free stored `startsAt` and `endsAt` as UTC before comparing instants. The
application writes these fields as UTC, while SQLite drops their timezone when
reading them back. This is a documented test-database adaptation; the actual UI
create/edit labels must still display the correct Melbourne times, and production
PostgreSQL timezone behaviour is checked by the PostgreSQL suite.
