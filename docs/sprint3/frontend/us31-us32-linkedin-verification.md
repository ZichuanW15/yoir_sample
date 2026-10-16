# US-31 and US-32 frontend: LinkedIn verification and its status

Issues: front-end sub-issues [#190](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/190)
and [#193](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/193), under
[US-31 #25](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/25) and
[US-32 #26](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/26).

This slice gives a Career Professional a Verification screen: where they send the LinkedIn profile the
Platform Owner verifies them from, and where they read what came of it. It also puts one wording for
verification status into [`src/verification.tsx`](../../../frontend/src/verification.tsx), used by every
screen that shows it, so pending, verified and rejected read the same everywhere. Before this, a
rejected Career Professional was shown "Verification pending". It reached `dev` on 5 October 2026 in
[PR #232](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232) (commit `00af92c`).
The Platform Owner's side is [US-33 and US-58](us33-us58-verification-review.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 43, 44, 45
and 55.

## Screens and flow

| Route | File | What the Career Professional sees |
|---|---|---|
| `/counsellor/verification` | [`app/counsellor/verification.tsx`](../../../frontend/app/counsellor/verification.tsx) | Status panel, "How verification works" track, and the LinkedIn URL form. |

Entry points: the Verification card on the workspace ([`app/counsellor/index.tsx`](../../../frontend/app/counsellor/index.tsx),
now pressable), the status pill on the professional profile, and a new "Verification" button in the
account sheet ([`src/chrome.tsx`](../../../frontend/src/chrome.tsx)). Any role other than `counsellor`
is redirected to `/`.

## Behaviour and states

- **Status panel:** "Your status", the label and a line of explanation, tinted by state:

| State | When | Label | Line |
|---|---|---|---|
| `unsubmitted` | `pending` with no LinkedIn URL | Verification pending | Add your LinkedIn profile URL so the Platform Owner can verify you. |
| `pending` | `pending` with a URL | Verification pending | Your LinkedIn profile is with the Platform Owner for review. |
| `verified` | | Verified Career Professional | Your profile carries the verified mark across Yoir. |
| `rejected` | | Verification rejected | The Platform Owner could not verify you from this profile. The reason was emailed to you. |

- **Track:** three steps (send, review, verified mark). Pending marks the review step as current;
  rejected ends on "Not verified this time" with a red cross.
- **Form:** "LinkedIn profile URL" with a button that depends on state: "Submit for verification",
  "Update my submission" or "Resubmit for verification". A verified Career Professional sees "Verified
  from" with their link instead, which opens outside the app.
- **Validation in the app:** empty shows "Enter your LinkedIn profile URL."; anything whose host is
  not `linkedin.com` or a subdomain shows "Enter a LinkedIn profile URL, for example
  https://www.linkedin.com/in/your-name." Nothing is sent. `normaliseLinkedIn` accepts the URL with or
  without a scheme and sends `https://<host><path>`.
- **Submitting:** the button is busy during the call. The status changes only to what the back end
  returns, and a toast says "Sent to the Platform Owner for review". A failure shows the error banner
  and leaves the status as it was.
- **No guessed status:** nothing shows until the profile has been read. The workspace card and the
  profile pill read "Checking status" while loading and "Status unavailable" if the read fails. The
  Verification screen shows a spinner, or the error with Try again.
- **Reloads on focus**, so a decision made by the Platform Owner shows the next time the screen opens.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getOwnCounsellorProfile` | `GET /me/counsellor-profile` | `verificationStatus` and `linkedinUrl` decide the state. |
| `api.submitVerification(linkedInUrl)` | `POST /me/verification-submissions` | `201` with the stored submission. The back end refuses non-LinkedIn URLs, Job Seekers and an already verified Career Professional, and clears an old rejection reason on resubmission. |

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-31: Pending shown only after the back end stores the URL | Status set from the submission response | `counsellor-verification.test.tsx` "in review is shown only once the backend has stored the submission"; walkthrough 43–44 |
| US-31: empty or non-LinkedIn URL refused, nothing sent | In-app messages; no request | `counsellor-verification.test.tsx` "an empty or non-LinkedIn URL is refused in the app and nothing is sent"; `verification.test.ts` |
| US-31: an invalid URL that reaches the API is rejected | Back end | `test_admin.py` `test_a_non_linkedin_url_is_rejected_even_if_the_app_sent_it` |
| US-31: Job Seeker or unauthenticated submission rejected | Back end; the screen redirects other roles | `test_a_job_seeker_cannot_submit_for_verification` |
| US-31: back-end failure shows an error and no Pending | Error banner; status unchanged | `counsellor-verification.test.tsx` "a failed submission shows the error and claims no new status" |
| US-32: Pending shown on Professional Profile and My Services | Profile pill and the workspace card (which holds My services) use the shared wording | `verification.test.ts` "pending with nothing sent is told apart from pending in review, in the same words"; walkthrough 45 |
| US-32: Verified shown, no stale Pending | Read on every focus | `counsellor-verification.test.tsx` "verified reads in the shared wording"; walkthrough 55 |
| US-32: Rejected shown with the same wording everywhere | "Verification rejected" from one source | `counsellor-verification.test.tsx` "rejected reads in the shared wording" |
| US-32: failed status read shows an error and no status | "Status unavailable" or error with Try again | `counsellor-verification.test.tsx` "a status that cannot be read shows the error and a retry, never a guessed status" |
| US-32: only the Career Professional's own status; Job Seekers refused | Back end: `/me/counsellor-profile` reads the caller's own record | Not checked for this document |

## Tests

- [`__tests__/screens/counsellor-verification.test.tsx`](../../../frontend/__tests__/screens/counsellor-verification.test.tsx),
  6 tests against a mocked API: the four named above and "verified/rejected reads in the shared
  wording".
- [`__tests__/verification.test.ts`](../../../frontend/__tests__/verification.test.ts), 2 tests: "a
  LinkedIn address is accepted with or without its scheme, and nothing else is" and the pending wording
  test above.

Run from `frontend/`: `npx jest __tests__/verification.test.ts __tests__/screens/counsellor-verification.test.tsx`.
Local run on `dev` at `d3b7026`, 16 October 2026, Node 22.14.0: 8 passed.

## Known gaps

- The rejection reason is emailed but not shown on the Verification screen; the screen says to check
  the email.
- No Playwright or device run submits a URL end to end; the walkthrough screenshots are the only
  record of the live screen.
