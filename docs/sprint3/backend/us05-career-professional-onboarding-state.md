# US-05 backend: Career Professional onboarding state

Issue: back-end sub-issue [#179](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/179),
under [US-05 #8](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/8).

This slice gives the app one place to ask whether a Career Professional still has first-login
setup to do: a saved professional profile and a submitted LinkedIn URL. It only reports what the
profile save (US-30) and the verification submission (US-31) have already recorded; it writes
nothing. It reached `dev` on 6 October 2026 in commit `91ba76d`, pushed directly rather than
through a pull request, together with the onboarding screen that reads it.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screen 42.

## Endpoints and flow

| Endpoint | Code | What it answers |
|---|---|---|
| `GET /me/onboarding-state` | `get_onboarding_state` in [`app/routers/counsellor.py`](../../../backend/app/routers/counsellor.py); `OnboardingStateOut` in [`app/schemas.py`](../../../backend/app/schemas.py) | `{profileComplete, verificationSubmitted, complete}` for the caller's own account |

Flow: after login the app reads this state. Until `complete` is true it shows the onboarding screen
with the two steps; each step opens the existing profile or verification screen, and saving there is
what changes the answer here.

## Behaviour and states

- **Guard:** `require_counsellor`. No session is `401`; a Job Seeker or Platform Owner is `403`.
  There is no account ID in the path, so a Career Professional can only read their own state.
- **Read-only:** the endpoint never writes `verification_submitted_at` or any profile field.
- **`profileComplete`:** true only when `introduction`, `background` and `experience` are all
  non-empty. The LinkedIn URL is not part of this check; `PATCH /me/counsellor-profile` already
  refuses a save without one.
- **`verificationSubmitted`:** false only for `pending` with no LinkedIn URL on file. Pending with a
  URL, verified and rejected all count as submitted, because a submission has happened whatever the
  Platform Owner decided about it.
- **`complete`:** both of the above.
- **Publishing is gated separately.** `POST /me/services` uses `require_publishing_counsellor`: the
  Platform Owner must have verified the Career Professional and their email must be confirmed. A
  completed onboarding with a still-pending verification can therefore reach the workspace but cannot
  publish yet. That is stricter than US-05 asks, and it is enforced by US-34, not here.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getOnboardingState` | `GET /me/onboarding-state` | Read once per routing decision; the app shows a spinner until it answers. |
| `api.updateOwnCounsellorProfile` | `PATCH /me/counsellor-profile` | US-30; filling `introduction`, `background` and `experience` sets `profileComplete`. |
| `api.submitVerification` | `POST /me/verification-submissions` | US-31; storing a LinkedIn URL sets `verificationSubmitted`. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| First login routes to onboarding, not the workspace | Returns `complete: false` for a new account | `test_a_never_logged_in_counsellor_reports_both_steps_incomplete`; frontend `counsellor-onboarding.test.tsx` |
| The flow lists which steps remain and offers no route to service creation | Reports each step separately | `test_profile_fields_alone_do_not_count_as_verification_submitted`, `test_a_linkedin_url_alone_does_not_count_as_profile_complete`; frontend "offers no route to service creation" |
| The backend reports both steps incomplete for an account that has not onboarded | Both flags false | `test_a_never_logged_in_counsellor_reports_both_steps_incomplete` |
| Profile saved and LinkedIn URL submitted routes to the regular area | `complete: true` | `test_profile_saved_and_linkedin_submitted_reports_complete`, `test_rejected_verification_still_counts_as_submitted`; frontend "both steps already complete routes straight to the workspace" |
| A loading state until the state arrives | Frontend only | Frontend "shows neither step until the onboarding state is received" |
| Only a Career Professional can read it | `require_counsellor` | `test_requires_authentication`, `test_refuses_a_job_seeker` |

## Tests

- [`tests/test_onboarding.py`](../../../backend/tests/test_onboarding.py): 8 tests, the six named above
  plus `test_the_shared_verified_counsellor_fixture_is_already_complete`, which keeps the shared test
  fixture from silently sending every other Career Professional test through onboarding.
- Frontend: [`__tests__/screens/counsellor-onboarding.test.tsx`](../../../frontend/__tests__/screens/counsellor-onboarding.test.tsx), 6 tests.

Run from `backend/`:

```bash
env -u DATABASE_URL pytest tests/test_onboarding.py -q
```

Local run on `dev` at `03978fd`, 16 October 2026, Python 3.12.8, temporary SQLite database: 8 passed.
Full backend suite at the same commit: 794 passed, 8 skipped, 18 expected failures.

## Known gaps

- `OnboardingStateOut`'s docstring says `profileComplete` mirrors what the profile save requires, but
  the save accepts an empty introduction, background and experience. A Career Professional can
  therefore save their profile successfully and still be told the profile step is not done.
- No test covers a Platform Owner calling this endpoint; only the Job Seeker refusal is tested.
- No pull request reviewed this change; it went to `dev` directly.
