# US-05 frontend: first-login onboarding for Career Professionals

Issues: front-end sub-issue [#178](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/178),
under [US-05 #8](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/8).

A Career Professional who has not finished setting up lands on an onboarding screen instead of the
workspace. It lists the two required steps, professional profile (US-30) and verification submission
(US-31), says which are done, and opens the existing screen for each. It has no forms of its own and
no route to service creation. Once both steps are done it steps aside for good. It reached `dev` on
6 October 2026 in commit `91ba76d`, pushed directly rather than through a pull request, together with
the back end it reads ([US-05 back end](../backend/us05-career-professional-onboarding-state.md)).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screen 42.

## Screens and flow

| Route | File | What the Career Professional sees |
|---|---|---|
| `/counsellor` | [`app/counsellor/index.tsx`](../../../frontend/app/counsellor/index.tsx) | The workspace, now behind an onboarding check. |
| `/counsellor/onboarding` | [`app/counsellor/onboarding.tsx`](../../../frontend/app/counsellor/onboarding.tsx) | New. "Finish setting up your workspace" and the two steps. |

Flow: login sends a Career Professional to `/counsellor` (`homeFor` in
[`src/navigation.ts`](../../../frontend/src/navigation.ts)). The workspace asks for the onboarding
state first and, while it is incomplete, redirects to `/counsellor/onboarding`. Each step opens
`/counsellor/profile` or `/counsellor/verification`. Coming back re-reads the state, and once both
steps are done the onboarding screen redirects to `/counsellor`.

The onboarding screen has no bottom bar (`CounsellorNav`), because every tab would lead back to it.
The avatar still opens the account sheet, so the Career Professional can log out.

## Behaviour and states

### Workspace gate

- **Checked on every focus.** Until the back end answers, the workspace shows only a spinner, so
  neither the workspace nor the onboarding screen flashes up first.
- **Incomplete:** redirects to `/counsellor/onboarding`.
- **Complete:** the workspace shows as before. Nothing changes for a Career Professional who has
  already onboarded.
- **Failed check:** fails open. The workspace shows with the error in a banner above it, rather than
  leaving an onboarded Career Professional on a spinner. The gate keeps its own error, separate from
  the workspace's, so the workspace's next successful load does not clear it.

### Onboarding screen

- Eyebrow "Before you publish", title "Finish setting up your workspace", and "Complete your
  professional profile and submit your LinkedIn profile for verification. Both are required before
  you can publish a service."
- A spinner until the state arrives; no step is shown before then.
- **Professional profile:** "Tell buyers who you are: your introduction, background and experience."
  until done, then "Saved — your introduction, background and experience are on file."
- **Verification submission:** "Submit your LinkedIn profile so the Platform Owner can verify you."
  until done, then "Sent — your LinkedIn profile is with the Platform Owner."
- Each step carries a "Done" (green) or "Not done" (yellow) tag. Its accessible name is, for example,
  "Professional profile, not done".
- **Re-read on every focus**, because finishing a step happens on another screen.
- **Both done:** redirects to `/counsellor` at once, with nothing to tap.
- **Failed read:** the error banner and Try again. No step status is shown, so none is made up.
- No session, or any role other than Career Professional: redirect to `/`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getOnboardingState` | `GET /me/onboarding-state` | New. `{ profileComplete, verificationSubmitted, complete }` (`OnboardingState` in [`src/api/types.ts`](../../../frontend/src/api/types.ts)). Read by the workspace gate and the onboarding screen. |

The steps themselves use the existing US-30 and US-31 calls on their own screens. Saving there is what
changes the answer here. The back end works out both flags; the app shows them as given.

## Executed acceptance coverage

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| First login goes to the onboarding flow with both steps shown as required, not to the workspace | The workspace redirects to `/counsellor/onboarding` while `complete` is false | `counsellor-dashboard.test.tsx` "an incomplete onboarding state sends a first-login counsellor to onboarding, not the workspace"; walkthrough 42 |
| The flow lists which steps remain, says in English that both are needed before publishing, and offers no route to service creation | Done or Not done per step; the intro text; no bottom bar and no New button | `counsellor-onboarding.test.tsx` "shows neither step until the onboarding state is received, then both as remaining", "a step already done reads as done, and the other as not", "offers no route to service creation" |
| The back end reports both steps incomplete for an account that has not onboarded | Shown as given | Back end `test_a_never_logged_in_counsellor_reports_both_steps_incomplete` |
| With the profile saved and the LinkedIn URL submitted, the next login reaches the workspace and the gate is gone | The workspace shows; the onboarding screen redirects to `/counsellor` | `counsellor-onboarding.test.tsx` "both steps already complete routes straight to the workspace instead of showing the gate"; the shared counsellor test harness defaults to complete for every other workspace test |
| A loading state until the state arrives, showing neither the flow nor the workspace | Spinner in both places | `counsellor-dashboard.test.tsx` "shows neither the workspace nor the onboarding gate until onboarding state is received"; `counsellor-onboarding.test.tsx` "shows neither step…" |

## Tests

- [`__tests__/screens/counsellor-onboarding.test.tsx`](../../../frontend/__tests__/screens/counsellor-onboarding.test.tsx),
  8 tests: the role redirect (two cases), loading then both steps remaining, no route to service
  creation, one step done, each step opening its screen, redirect when complete, and a failed check
  with Try again.
- [`__tests__/screens/counsellor-dashboard.test.tsx`](../../../frontend/__tests__/screens/counsellor-dashboard.test.tsx),
  "Counsellor dashboard onboarding gate — US-05": 3 of the file's 12 tests (loading, redirect when
  incomplete, fail open with the error shown).
- [`__tests__/screens/counsellor-screen-utils.tsx`](../../../frontend/__tests__/screens/counsellor-screen-utils.tsx)
  answers the onboarding check as complete by default, so other Career Professional screen tests still
  reach the workspace.
- Back end: [`tests/test_onboarding.py`](../../../backend/tests/test_onboarding.py), 8 tests.

Run from `frontend/`:
`npx jest __tests__/screens/counsellor-onboarding.test.tsx __tests__/screens/counsellor-dashboard.test.tsx`.
**Original dev-only execution:** `0df4068`, 17 October 2026, Node 22.14.0: 20 passed (8 and 12).

The refresh adds [the same-mounted-screen focus case](../../../frontend/__tests__/screens/onboarding-focus.test.tsx).
It returns from the verification step, checks the updated Done label while the
profile remains incomplete, then returns after both flags are confirmed and
checks the workspace redirect. The focused execution passed without remounting
the onboarding screen or signing in again.

## QA branch evidence

The preceding dev-only counts identify the original source-document execution.
The `sprint3-qa` overlay adds executed API, component and browser coverage. Its
[17 October report](../qa/archive/test-results-final-20261017.md) records the tested
`0df4068` product, and the [dev refresh report](../qa/archive/test-results-dev-refresh-20261017.md)
records reconciliation with `972caee`. That dev update adds documentation; product
code is unchanged. Suite counts belong to their dated executions and are not added
together. The [meeting-area report](../qa/archive/test-results-meeting-area-20261017.md)
retains the subsequent `9cce973` baseline from PR #244. The
[latest confirmation report](../qa/archive/test-results-confirmation-20261017.md) records
`8713b38d63ccb969dcc69a44a02f888fd65caa9a`, including the desktop layout update
and PR #246. Fresh full component runs passed 610 shared and 619 per native
preset. Confirmation now consumes a successfully read purchase snapshot; its
corrected regression and fallback boundaries have their own evidence. The older
06:33 UTC frontend figures retain their original execution date and source set.
The [QA matrix](../qa/qa-matrix.md) links these results to the QA tasks.

## Recorded behaviour and findings

- **Only the workspace is gated.** `/counsellor/services/new` and the other Career Professional screens
  do not check onboarding, so a deep link reaches them. The back end still refuses publishing until
  the Platform Owner has verified the account and the email is confirmed
  (`require_publishing_counsellor`, US-34).
- **Fails open.** If the check fails, the workspace shows with the error, including its New service
  entry. The same back-end rule still stops publishing.
- **One save can finish both steps.** The profile form already requires a LinkedIn URL, and the back
  end counts any stored URL as submitted. Saving the profile therefore marks verification Done too,
  without the Verification screen being opened.
- **Recorded native evidence:** [case D01](../qa/device-acceptance.md) exercised setup,
  restart and delayed/failed reads on both Expo Go simulator platforms on 16 October
  (`cdcc44e`). The failed-read case exposed the workspace and remains a recorded FAIL.
- **Transaction evidence:** `test_failed_counsellor_profile_save_keeps_public_onboarding_and_review_details_then_retries`
  in [the API completion tests](../../../backend/tests/test_sprint3_completion_qa.py)
  verifies that a refused commit leaves onboarding and public profile readers unchanged,
  then verifies a successful retry. Its PostgreSQL result is retained in the QA report.
