# US-58 backend: the verification queue, one submission and the decision

Issues: back-end sub-issue [#221](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/221),
under [US-58 #28](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/28).

The Platform Owner lists Career Professionals' verification submissions, reads one, and approves or
rejects it. A Career Professional's profile *is* their submission: there is no separate table, so the
queue cannot disagree with the profile about whether someone is verified. The queue and the decision
reached `dev` on 18 September 2026 in
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157) (commit `70232ce`).
Sprint 3 adds reading one submission by id in
[PR #238](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/238) (commit `6b9a7d8`,
14 October 2026). Evelyn's [PR #235](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/235)
(13 October) lets a decision send a submission back to pending and validates the LinkedIn URL; that
work is documented in [US-31 to US-33 backend](us31-us33-linkedin-verification.md). The screens are in
[US-33 and US-58 frontend](../frontend/us33-us58-verification-review.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 63–66.

## Endpoints and flow

All in [`app/routers/admin.py`](../../../backend/app/routers/admin.py).

| Endpoint | Code | What it does |
|---|---|---|
| `GET /admin/verifications?status=` | `list_verification_submissions` | The queue: `pending` (the default), `verified`, `rejected` or `all`, oldest first. Any other value is `400`. |
| `GET /admin/verifications/{submissionId}` | `get_verification_submission` | One submission, whatever has since been decided. `404` if the id is not a Career Professional. |
| `POST /admin/verifications/{submissionId}/decision` | `decide_verification` | Body `{decision, reason}`. Records the outcome and emails the Career Professional. |

Flow: a Career Professional submits their LinkedIn URL (US-31) and joins the queue. The Platform
Owner opens the oldest submission, checks the profile, and approves or rejects it with a reason. The
Career Professional sees the outcome on their screens (US-32) and by email.

## Behaviour and states

- **Platform Owner only:** `require_platform_owner` reads the role from the database row. Other roles
  get `403`, and no session gets `401`.
- **A submission:** the Career Professional's id (used as the submission id too), name, email, LinkedIn
  URL, introduction, background, experience, status, submission time, decision time and the last
  reason. A Career Professional who never submitted shows their account creation time instead.
- **Oldest first:** the queue is worked through, so whoever has waited longest is at the top.
- **Deciding:** `decision` is `verified`, `rejected` or `pending`. The reason is trimmed and stored, or
  `null` when blank.
  - A rejection with no reason is `400 VALIDATION_ERROR`, "Say why, so the Career Professional knows
    what to change." Without one, the Career Professional cannot tell what to fix.
  - Any other outcome or an extra field is `400`, and nothing changes.
  - An id that is not a Career Professional is `404`, "Submission not found."
- **Leave pending:** nothing is sent, so nothing changes. `pending` is for sending back a decided
  submission after another look (US-33).
- **The email comes after the decision:** the decision is committed first, then the Career
  Professional is emailed whether they were verified or rejected, with the reason. A failed email is
  logged and does not undo the decision or report an error, so the Platform Owner is not invited to
  decide twice. Sending back to pending sends no email.
- **Resubmitting:** a rejected Career Professional who submits again goes back into the queue with the
  old decision cleared (US-31).

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listVerificationSubmissions(status)` | `GET /admin/verifications?status=` | The queue, and for now the submission screen with `all`. |
| Not called yet | `GET /admin/verifications/{submissionId}` | The submission screen still picks its row from the `all` list. |
| `api.decideVerification(id, decision, reason)` | `POST /admin/verifications/{submissionId}/decision` | The app sends `verified` or `rejected`. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| The queue lists pending submissions with name and LinkedIn URL | `pending` by default, oldest first | `test_the_queue_lists_pending_counsellors_oldest_first`, `test_the_queue_shows_only_pending_by_default` |
| A submission can be read on its own | One submission by id, any status | `test_one_submission_can_be_read_whatever_has_been_decided`, `test_reading_a_submission_that_is_not_a_counsellor_is_a_404` |
| Approve: Verified only after the back end stores it, and it leaves the pending list | Status stored and returned; queue filters on it | `test_approving_a_counsellor_records_it_and_tells_them` |
| Reject with the reason entered | Reason required, stored and emailed | `test_rejecting_requires_a_reason_and_passes_it_on` |
| Going back or leaving it pending keeps it pending and queued | No request, no change | Nothing to test on the back end; checked manually on the frontend |
| Job Seeker and Career Professional sessions are rejected | `403` (`401` without a session) | `test_the_admin_area_is_closed_to_everyone_else`, `test_single_records_are_closed_to_everyone_else`, `test_a_forged_owner_claim_does_not_open_the_admin_area` |
| A failed decision leaves the submission Pending | An invalid or unknown request changes nothing; a failed email does not undo a stored decision | `test_an_unrecognised_decision_outcome_is_rejected_and_changes_nothing`, `test_deciding_on_somebody_who_is_not_a_counsellor_is_a_404`, `test_a_decision_email_that_fails_does_not_undo_the_decision` |

## Tests

- [`tests/test_admin.py`](../../../backend/tests/test_admin.py): the tests above, plus Evelyn's US-33
  test `test_an_additional_investigation_can_send_a_verified_counsellor_back_to_pending`. The file
  has 52 tests in all; [US-48 and US-71](us48-us71-platform-owner-oversight.md) use the rest.

Run from `backend/`:

```bash
env -u DATABASE_URL uv run pytest tests/test_admin.py -q
```

Local run on `dev` at `a6eeb35`, 18 October 2026, Python 3.12.14, temporary SQLite database: 52 passed.

## Known gaps

- **The submission screen does not use the single read yet.** It fetches every submission with `all`
  and searches it.
- **Only the latest decision is kept.** The submission is the profile row, so a later decision
  overwrites the earlier status and reason, with no history of who decided what.
- Two Platform Owners deciding on one submission at once is not locked: the later write wins.
- The decision does not record which Platform Owner made it.
