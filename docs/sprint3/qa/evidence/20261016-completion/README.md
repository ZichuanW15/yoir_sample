# 16 October 2026 — test-completion evidence

This is the separate follow-up to [the earlier run](../20261016/README.md).
See the [results and scope](../../archive/test-results-completion-20261016.md).
Commands ran on 16 October Melbourne time (15 October evening UTC); packaging
preserves those execution dates and is not another application test run.

## Review order

1. [Exact commands, times, exits and execution source overlays](executions.json).
2. [Baseline and current QA source hashes](source-manifest.json).
3. [Case inventory](added-case-inventory.json): 127 additional regression cases;
   239 regression cases relative to dev. Native presets repeat shared cases.
4. [Shared](frontend-shared.json), [iOS](frontend-ios.json),
   [Android](frontend-android.json), [PostgreSQL](backend-postgres-complete-junit.xml)
   and [Chromium](browser-regression.json) per-case outcomes.
5. [Frontend coverage](frontend-coverage.json), [backend coverage](backend-coverage.json).
6. [HTTPX](live-httpx-junit.xml), [TypeScript](live-typescript.json),
   [independent live readback](live-readback.json) and [environment](environment.json).
7. [SHA-256 manifest and explicit omissions](manifest.json).

Root recorder logs include authoring failures and the corrected final runs.
The first PostgreSQL invocation failed at startup because its driver name did
not match the installed locked driver; subsequent runs used psycopg2. Earlier
focused screen/browser selector and focus-hook harness failures are retained,
not counted as new product defects. The final backend label is
`backend-postgres-complete`; it includes the additional ten recovery cases.

Jest/Playwright originals are reduced to every case outcome and error; original
file hashes are retained. Seven screenshots from the new Chromium cases and one
existing server-diagnosis readback attachment are included. Regenerable HTML,
full trace archives and duplicate screenshots remain in ignored local artifacts.

Existing defects are unchanged. Backend strict XFAILs are unresolved failures,
not passes. External calls are intercepted or stubbed as described in the
result report. This package records the dated local executions.
