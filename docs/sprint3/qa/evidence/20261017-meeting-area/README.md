# 17 October 2026 — meeting-area QA evidence

Product: `dev@9cce9737ded87c13a7575d7236a051c5db7628f8`, including PR #244.

- [Report](../../archive/test-results-meeting-area-20261017.md): exact executions and boundaries.
- [Source manifest](source-manifest.json) and [executions](executions.json): commands,
  timestamps, outcomes and source changes between runs.
- [PostgreSQL cases](backend-postgres.json) and [coverage](backend-coverage.json).
- [Chromium 38-case regression](browser-regression.json), [separate area case](browser-area-focused.json)
  and [advisory cases](browser-defects.json), including selected original attachments.
- [Shared](frontend-defects.json), [iOS](ios-defects.json) and [Android](android-defects.json)
  advisory outcomes; [report health](report-health.json).
- [HTTPX](httpx-live.json) and [TypeScript](typescript-live.json) live-client cases.
- [Retained component verification](retained-component-evidence.json): dated 06:33 UTC
  regression/coverage reports and matching source fingerprints.
- [Merge record](merge-record.json) and [merged-dev CI](remote-ci.json).
- [Manifest](manifest.json): packaged hashes, original hashes and explicit transformations.

Authoring logs retain the initial ambiguous selector and its subsequent correction.
Only final component reports count the confirmation-area product failure. Full
raw reports and regenerable browser HTML/trace bundles remain under the local
`artifacts/qa/sprint3-meeting-area-20261017` directory. All outcome counts above
refer to recorded assertions; packaging does not create a new execution.
