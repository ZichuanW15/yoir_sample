# Sprint 3 QA — implemented features

Product baseline: `cdcc44e66d647a9c5993736b797312b495715a3f` (`dev`).
Local branch: `sprint3-qa`. Review and execution: **16 October 2026**, Melbourne.
**Test owner: Wilson** (`Zhouzhny` on GitHub).

The automated gap follow-up adds **6 regression cases and 7 advisory acceptance
cases**, after the earlier 127-case completion increment. The local package now
contains **245 regression cases and 17 defect cases relative to dev**, counting
each source case once, not once per platform or execution. Failed assertions
remain failures, and several may describe the same underlying integration gap.

Changes affect tests, isolated fixtures and QA documentation/evidence. Product
sources, dependencies and CI gates are unchanged. The recorded execution was
completed locally before publication. Remote CI for the published commit must
be reviewed separately; these local results do not establish its outcome.

## Read first

1. [Remaining native results](test-results-native-remaining-20261016.md):
   D01 and D04–D13 on both platforms, **11 PASS, 8 FAIL, 3 BLOCKED**;
   [execution information](test-results-native-remaining-20261016.md#execution-information)
   also records Wilson's five supplementary workflow confirmations.
   The [earlier native report](test-results-native-20261016.md) retains the
   separate four D02/D03 passes. Use the [device procedures](device-acceptance.md)
   for the complete recorded case table.
2. [Gap-follow-up results](test-results-gap-followup-20261016.md): refresh
   recovery, diagnosis integration, unrated profiles and the earlier device preflight.
3. [All 23 QA tasks](qa-matrix.md): parent
   criteria, implementation, executable sources and remaining acceptance gaps.
4. [Repeatable plan](test-plan.md): commands, fixtures and expected outcomes.
5. [Native evidence](evidence/20261016-native-remaining/README.md) and
   [gap-follow-up evidence](evidence/20261016-gap-followup/README.md): observations,
   screenshots, per-case results, logs, hashes and API readbacks. Each package
   retains its own execution scope and totals.
6. [Issue snapshot](issue-snapshot-20261016.json): 23 parents and their 69 subtasks.
   At that snapshot all 23 QA tasks were open and assigned to Wilson;
   workflow state is not an acceptance result. No remote issue state was changed.

## Current results and boundaries

The earlier native run passed **4 case/platform executions**: D02/D03 on iOS and
Android, with Android operated in IntelliJ IDEA. These cover local diagnosis
validation, Back/Skip, actual process restart, account isolation, direction,
no-results search and retakes. They establish same-device Expo Go observations;
server-backed diagnosis integration remains absent.

The remaining native run exercised the other **22 case/platform combinations**:
**11 PASS, 8 FAIL, 3 BLOCKED**. Together, the two recorded runs cover **26
case/platform combinations: 15 PASS, 8 FAIL, 3 BLOCKED**. Android was operated
through IntelliJ IDEA; both platforms used Expo Go and an isolated local API.
The follow-up reproduced failed-onboarding-check access, historical service-title
changes, false empty Bookings after a read error, and duplicate email-resend
requests on both platforms. Those failures remain unresolved.

The
[execution information](test-results-native-remaining-20261016.md#execution-information)
records five supplementary groups as PASS based on Wilson's confirmation:
real-email delivery, password reset, payment-provider flow including Set up
payouts, offline testing/recovery, and Android photo-permission denial. Their
execution dates, platform/build/environment details and supporting logs were
not supplied. They are not added to the 26 recorded executions and do not imply
that every detailed token, session-policy or provider substep was exercised.

The latest full shared component run passed **568 cases in 64 suites**. Focused
refresh checks passed **15 per shared/iOS/Android preset**, including the 6 new
cases. New advisory checks failed **3 per component preset and 4 in Chromium**.
These are completed assertions, not passes; the browser save-recovery case stops
at its missing-request guard and does not reach the injected 503/retry sequence.

The [earlier completion execution](test-results-completion-20261016.md) passed
571 iOS components, 571 Android components, 848 PostgreSQL cases, 32 normal
Chromium journeys and 2 cases per real HTTPX/TypeScript client. It also retained
21 backend strict XFAILs. Those full component/backend/browser/live suites were
not repeated during the native device run. Historical defect suites remain separately
reported; new failures have not been presented as fresh results for every old case.

Measured line/branch coverage remains **94.45% / 86.69% frontend** in the latest
run and **94.78% / 85.16% backend** in the earlier completion run, for their
configured source sets. Coverage is not whole-story or device acceptance.

Backend direction/criteria and review/aggregation APIs exist and were tested.
The diagnosis app still uses local storage/rules: executable browser assertions
now show missing saves and missing server-confirmed resume. Refresh assertions
also expose stale workspace status and missing/stale administrator directory
refresh. Unrated professional profiles lack an explicit neutral rating state.
Known defects remain visible; existing advisory CI policy is unchanged.

The recorded native runs establish bounded Expo Go observations, not signed-build,
physical-device or deployed-environment acceptance. The supplementary confirmations
retain the scope above. Detailed provider lifecycle coverage, agreed privacy/matching
policy and individual story sign-off still require their own evidence or decisions.

## Historical evidence

[14 October results](test-results-20261014.md) and
[their evidence](evidence/20261014/README.md) describe the older `98cd8cb` baseline
and retain their original outcomes. Statements there that direction/review APIs were absent are
superseded for the current baseline by the Oct16 reports.
The [earlier 16 October execution](test-results-20261016.md),
[its evidence](evidence/20261016/README.md), the
[completion report](test-results-completion-20261016.md) and
[completion evidence](evidence/20261016-completion/README.md) are retained as dated records,
including original defect outcomes, authoring corrections and dependency findings.

Publication copies of seven earlier Oct16 log/XML files redact truncated local
test authentication fragments. Outcomes remain unchanged; original and published
hashes are recorded in the [publication-redaction manifest](evidence/20261016/manifest.json).

Published text evidence also removes trailing spaces and extra blank lines at EOF
to satisfy the existing CI whitespace check. The five affected package manifests
record the previous packaged hashes, sizes and transformation counts alongside
the updated hashes. Original `sourceSha256` values remain unchanged, and the
previous published bytes remain available at commit `7ce59e5`. This formatting
correction changes no test outcomes and does not represent another test run.
