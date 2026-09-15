# Sprint 2 QA — implemented Web and API features

This review tests the frontend and backend actually present at `0ffa565e47d60fc2783a4618e5dce6cfe73a4b08` (`dev`). The local working branch is `sprint2-qa`. Product sources are unchanged. Missing features and unsettled policies are excluded from current pass/fail totals.

## Review order

1. [Scope and repeatable procedures](test-approach.md): what is tested, fixtures, expected outcomes and exact suites.
2. [Latest results](test-results.md): when each check ran, its outcome, coverage and evidence links.
3. [QA task mapping](qa-matrix.md): all 20 existing QA tasks, limited to their implemented portions.
4. [Defects](defects.md): unresolved failures with reproducible test selectors.
5. [Reproduction](reproduction.md): clean dependencies, isolated databases and the complete recorder command.
6. [PR submission guide](submission-guide.md) and [PR description](pr-description.md).

The machine-readable boundary is [scope.json](scope.json). [Remote progress](remote-progress.json) records the latest merged frontend, registration, authentication and counsellor-management PRs. [QA issue snapshot](qa-issue-snapshot.json) records a separate read-only check; an open task is not automatically an unimplemented feature.

## Evidence standard

The supplied assessment rubric asks for repeatable cases and complete records of what was tested, when, and the outcome in the team space. Procedures, source hashes, UTC timings, structured results, failure details and selected browser screenshots are included here. Original broad-scope drafts and repeated report bundles were preserved outside this change set before consolidation. Historical runs are not relabelled as this run.

**Publication and team-space access.** The execution recorded here was completed locally before the QA commit. After `sprint2-qa` is pushed, reviewers can access this index and its evidence on the team repository branch; the prepared PR body links that location. A PR into `dev` is the next review step. GitHub Actions retains run evidence for 90 days. This report records the local run only; consult Actions separately for any later remote execution.

Passing component tests are not proof of an absent backend. PostgreSQL concurrency evidence is separate from the temporary SQLite browser server. Stub payment is the implemented flow, not a provider integration. No mobile/device or whole-backlog sign-off is asserted.
