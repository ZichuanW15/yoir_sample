# US-31, US-32 and US-33 backend: LinkedIn submission, own status, and re-decision

Issues: back-end sub-issues [#191](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/191),
[#194](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/194) and
[#197](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/197), under
[US-31 #25](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/25),
[US-32 #26](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/26) and
[US-33 #27](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/27).

This slice is the backend behind a Career Professional's verification: the route that stores the
LinkedIn URL they are verified from, the read that tells them where it stands, and the Platform
Owner's ability to record the outcome of a second, manual investigation. The submission and decision
routes came from Sprint 2's [PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157);
the own-profile read came with [PR #234](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/234)
on 7 October 2026. Auditing them against these stories found two gaps: the submission accepted any
string as a LinkedIn URL, and a decision could not be set back to pending. Both were closed in
[PR #235](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/235), which reached
`dev` on 13 October 2026 after three rounds of review, each of which found a further way past the URL
check (see [URL validation](#url-validation)).

Frontend counterparts: [US-31 and US-32](../frontend/us31-us32-linkedin-verification.md) and
[US-33 and US-58](../frontend/us33-us58-verification-review.md).

## Endpoints and flow

| Endpoint | Code | What it does |
|---|---|---|
| `POST /me/verification-submissions` | `submit_verification` in [`app/routers/admin.py`](../../../backend/app/routers/admin.py) | US-31: stores the LinkedIn URL and sets the Career Professional to `pending`. |
| `GET /me/counsellor-profile` | `get_own_counsellor_profile` in [`app/routers/counsellor.py`](../../../backend/app/routers/counsellor.py) | US-32: the caller's own profile, including `verificationStatus` and `linkedinUrl`. |
| `POST /admin/verifications/{submissionId}/decision` | `decide_verification` in `app/routers/admin.py` | US-33 (and US-58): records `pending`, `verified` or `rejected` on any submission, decided or not. |

Flow: the Career Professional submits a URL and is pending. The Platform Owner approves or rejects
it, and may later re-investigate and record a new outcome on the same submission. The Career
Professional reads the current outcome from their own profile each time a screen loads.

## Behaviour and states

- **Guards:** submission and own-status read use `require_counsellor` (`401` without a session,
  `403` for another role). The decision uses `require_platform_owner`. There is no account ID in either
  Career Professional route.
- **Submission:** an already verified Career Professional gets `409 INVALID_STATE_TRANSITION`.
  Resubmitting after a rejection clears the old decision and reason, so they are not shown a rejection
  for work they have redone.
- **Re-decision (US-33):** `decision` accepts `pending`, `verified` or `rejected`, on a submission
  whatever its current status. A rejection needs a reason. `pending` sends no email, because the
  decision template only speaks to an approval or a rejection and US-33 puts notification out of scope;
  `verified` and `rejected` send it, and a failed email does not undo the decision.
- **Own status (US-32):** read fresh on every request; nothing is cached.

### URL validation

Both write paths that store a LinkedIn URL, `POST /me/verification-submissions` and
`PATCH /me/counsellor-profile`, call one function, `_require_linkedin_profile_url` in
[`app/schemas.py`](../../../backend/app/schemas.py). The app later hands the stored URL to
`Linking.openURL`, which on Web assigns it to `window.location`, so only a real `https` LinkedIn
address may be stored. Each review round of PR #235 found a further bypass:

| Round | Accepted before the fix | Fix |
|---|---|---|
| 1 | `javascript://linkedin.com/%0Aalert(1)`, `ftp://linkedin.com/in/test`: the host was checked, the scheme was not | Require scheme `https` when one is given; store the normalised `https://…` URL, not the raw input |
| 2 | `https://evil.example\@linkedin.com/in/test`: Python's `urlsplit` reads the host as `linkedin.com`, a browser treats `\` as `/` and opens `evil.example` | Reject any backslash before parsing; reject URL credentials |
| 3 | The same payloads through `PATCH /me/counsellor-profile`, which had its own host-only check and no test | One shared validator for both routes |

A bare `linkedin.com/in/name` is accepted and stored as `https://linkedin.com/in/name`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.submitVerification(linkedInUrl)` | `POST /me/verification-submissions` | `201` with the stored submission; `400` for a refused URL; `409` if already verified. |
| `api.getOwnCounsellorProfile` | `GET /me/counsellor-profile` | `verificationStatus` and `linkedinUrl` decide what the app shows. |
| `api.updateOwnCounsellorProfile` | `PATCH /me/counsellor-profile` | Same URL rules as the submission. |
| Platform Owner decision call | `POST /admin/verifications/{submissionId}/decision` | Body `{decision, reason}`; `404` for an ID that is not a Career Professional. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| US-31: Pending only after the URL is stored | Status set in the same write | `test_submitting_puts_a_counsellor_into_the_queue` |
| US-31: an invalid URL that reaches the API is rejected, nothing stored | Shared validator | `test_a_non_linkedin_url_is_rejected_even_if_the_app_sent_it` (10 cases), `test_a_non_linkedin_url_is_rejected_on_profile_save_too` (6 cases), `test_a_bare_linkedin_url_is_normalised_to_https_before_storage`, `test_a_bare_linkedin_url_is_normalised_to_https_on_profile_save` |
| US-31: a Job Seeker or unauthenticated request is rejected | `require_counsellor` | Job Seeker: `test_a_job_seeker_cannot_submit_for_verification`. No session: not covered |
| US-32: Pending, Verified and Rejected read from the backend | Stored status returned as-is | Frontend `counsellor-verification.test.tsx`. No backend test reads `verificationStatus` back through `GET /me/counsellor-profile` |
| US-32: only the caller's own status; a Job Seeker is refused | `/me` route, `require_counsellor` | Not covered by a test; checked by hand against `dev` at `03978fd` (no session `401`, Job Seeker and Platform Owner `403`) |
| US-33: an outcome on an already-decided submission is stored and returned | Any status accepted | `test_an_additional_investigation_can_send_a_verified_counsellor_back_to_pending` |
| US-33: the counsellor's views then show the new status | Read fresh | Frontend: see the US-33 frontend document |
| US-33: an outcome other than the three is rejected, status unchanged | `400` from the schema | `test_an_unrecognised_decision_outcome_is_rejected_and_changes_nothing` |
| US-33: a Job Seeker or Career Professional cannot record an outcome | `require_platform_owner` | Not covered by a test; checked by hand against `dev` at `03978fd` (`403` for both) |
| US-33: a failed update leaves the previous status | Decision and email are separate | `test_a_decision_email_that_fails_does_not_undo_the_decision` |

## Tests

- [`tests/test_admin.py`](../../../backend/tests/test_admin.py): the verification tests named above,
  plus `test_rejecting_requires_a_reason_and_passes_it_on`, `test_an_already_verified_counsellor_cannot_resubmit`
  and `test_deciding_on_somebody_who_is_not_a_counsellor_is_a_404`.
- [`tests/test_counsellor_profile_details.py`](../../../backend/tests/test_counsellor_profile_details.py):
  the profile-save URL tests.

Run from `backend/`:

```bash
env -u DATABASE_URL pytest tests/test_admin.py tests/test_counsellor_profile_details.py -q \
  -k "approving or rejecting_requires or decision_email or not_a_counsellor_is_a_404 or additional_investigation or unrecognised_decision or submitting_puts or cannot_resubmit or cannot_submit_for_verification or non_linkedin or bare_linkedin"
```

Local run on `dev` at `03978fd`, 16 October 2026, Python 3.12.8, temporary SQLite database: 28 passed.

## Known gaps

- Sending a verified Career Professional back to pending or rejected (US-33) leaves their published
  services in the Marketplace: listings check payouts, not verification status. US-33 records this
  effect as undecided and out of scope.
- US-32 has no backend test of its own: nothing reads `verificationStatus` back through
  `GET /me/counsellor-profile`, and Job Seekers and Platform Owners being refused there is untested.
  Non-owners posting a decision is also untested. All three behave correctly when checked by hand.
- The rejection reason is stored and emailed but not returned to the Career Professional's own
  profile read; the app tells them to check their email.
