# Browser QA for implemented functionality

These tests run the actual exported Expo Web app against the actual FastAPI app.
Each Playwright invocation starts its own server on `127.0.0.1` with a new temporary
SQLite database, the application's seed data and the explicit Sprint 3 browser
preconditions in `sprint3_fixtures.py`. The server ignores a caller's
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
  no claimed success and no service persisted. This verifies the current
  verified-professional publication gate; verification decisions have their own
  separate scenarios below.

The `@injected-network` tests intercept browser requests. They abort, refuse or
delay an explicitly selected request to exercise failure/acknowledgement handling,
then remove interception and use the real API for recovery. Other tests use no
mocked transport responses.

The defect group retains correctness assertions for empty-slot feedback,
forged-confirmation claims, exact-price display and negative-price publication.
Some previously failing assertions may pass after product changes; the dated run
report records their actual outcomes. Sprint 3 adds diagnosis selection semantics
and access to an existing admin order beyond the list's first 200 rows. These use
the actual local API, not successful response mocks. Earlier proposals in
[planned acceptance proposals](planned/acceptance-proposals.md) are historical
planning material; they do not establish current implementation or test results.

## Sprint 3 real browser workflows

`sprint3-diagnosis.spec.ts` exercises server-confirmed diagnosis progress,
account isolation, cancelled and completed retakes, and the result-to-stub-booking
journey. Independent API reads confirm saved revisions and derived direction.

`sprint3-integration-acceptance.spec.ts` gates saved-step acknowledgement, refused
save/retry, fresh-browser resume, real revision conflicts and
derived-result retry without resubmitting a saved answer. Its old diagnosis
`@defect` tags were removed after API integration; the professional unrated-state
assertion stays advisory. The new initial home read-failure assertion also stays
advisory: a 503 currently leaves the home screen loading instead of offering
retry. It retains a request counter and unchanged server-record evidence; no
success is claimed for the unreachable retry. Injected cases are labelled `@injected-network` and
preserve real API recovery/readbacks.

`sprint3-completion.spec.ts` checks privacy key omission as well as visible
redaction, backend-derived marketplace criteria and matching order, and frozen
purchased booking titles/prices after service editing and withdrawal. A real
stub-paid order is read by buyer, counsellor and administrator; a different
listing title must never rewrite its purchased title.

`sprint3-workflows.spec.ts` adds these independently reproducible scenarios:

| Scenario | Real outcomes checked |
| --- | --- |
| US-53/54/55 review submission | Required rating/comment, draft retained after a transport fault, one saved review, service and professional aggregates, repeat submission rejected |
| US-53 confirmed / cancelled sessions | Each state prevents the review form and the API write |
| US-53 another buyer | The booking read and review write return 404; private session content is not shown |
| US-32/33/58 verification decisions | Cancelled confirmation makes no change, approval persists, rejection requires a reason, the later reason survives reload, the pending queue refreshes |
| US-48 payment details | Failed read offers retry, real recovery shows the stored cent-exact split, viewing leaves API data unchanged |
| US-40/41 availability | Empty in-person view offers online times, reserving a real online start removes that time, the professional sees 120 free minutes and the next remaining start |
| US-48 older order (`@defect`) | A real existing order beyond the default 200 rows should open by ID; the API proof is attached alongside the browser outcome |

### Fixture boundaries

The dedicated `qa-s3-*` accounts exist only in `serve.py`'s temporary database.
They cannot authenticate against a deployment. `seed_sprint3` refuses any database
other than the exact SQLite path owned by that invocation, and runs after normal
application migrations and seeding. No fixture API route is added.

Completed, confirmed and cancelled historical bookings are seeded preconditions
for reviewing and reading. They are **not** evidence of the session-completion
scheduler, cancellation flow or payment provider. The review starts unreviewed;
the test itself performs the real POST and reads its persisted aggregate results.
The 201 zero-value cancelled archive orders exercise list truncation without
holding time or representing money movement. A separate professional owns one
three-hour future online-only window for the modality/remaining-time scenario.

Mailgun and Stripe credentials are cleared by the harness. Verification tests
confirm saved decisions and reasons, not external email delivery. Browser suites
must run against the entire new temporary fixture each time, rather than reusing
a previously mutated API process.

To run only the new workflows after the build:

```sh
WEB_QA_OUTPUT_DIR=test-results/sprint3-workflows npx playwright test e2e/sprint3-workflows.spec.ts --grep-invert '@defect'
WEB_QA_OUTPUT_DIR=test-results/sprint3-workflow-defects npx playwright test e2e/sprint3-workflows.spec.ts --grep '@defect'
```

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
