# US-58 and US-33 frontend: Platform Owner verification review

Issues: front-end sub-issues [#220](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/220)
and [#196](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/196), under
[US-58 #28](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/28) and
[US-33 #27](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/27).

The Sprint 2 queue ([US-48, US-58, US-71 Sprint 2](../../sprint2/frontend/us48-us58-us71-platform-owner-administration.md))
put Approve and Reject on every card. In Sprint 3 the queue is a list and each row opens one
submission, where the decision is made. Approving asks first, a rejection needs its reason, Leave
pending sends nothing, and a decision already made can be changed after another look (US-33). It
reached `dev` on 5 October 2026 in [PR #232](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232)
(commit `6f11b90`). The Career Professional's side is [US-31 and US-32](us31-us32-linkedin-verification.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 63–66.

## Screens and flow

| Route | File | What the Platform Owner sees |
|---|---|---|
| `/admin/verifications` | [`app/admin/verifications.tsx`](../../../frontend/app/admin/verifications.tsx) | The queue, oldest first: initials, name, email, applied date, status tag. |
| `/admin/verifications/[submissionId]` | [`app/admin/verifications/[submissionId].tsx`](../../../frontend/app/admin/verifications/[submissionId].tsx) | One submission: status, LinkedIn link, introduction, background, experience, and the decision card. |

Both sit in `AdminShell` ([`src/admin/shell.tsx`](../../../frontend/src/admin/shell.tsx)), which now
takes a `back` link for detail screens and keeps the Verify tab lit on them. A Career Professional's
row on the Users screen ([US-71](us48-us71-platform-owner-oversight.md)) also opens this detail.

## Behaviour and states

- **Queue:** filter chips Waiting (default), Approved, Rejected and Everyone. Status tags use the shared
  one-word wording (Pending, Verified, Rejected) from [`src/verification.tsx`](../../../frontend/src/verification.tsx),
  not the raw back-end value. The queue reloads on focus, so a decided submission has left the Waiting
  list on return. Empty: "Nobody is waiting on a decision." (or "Nothing here." for other filters).
- **Failed read:** `LoadFailed` shows the reason and Try again, never an empty list posing as the
  answer.
- **Submission:** "Applied …" and, once decided, "decided …". The LinkedIn URL opens outside the app;
  with no URL, "No LinkedIn profile supplied, so there is nothing to check." A previous reason shows
  under "Reason given".
- **Pending decision card ("Your decision"):**
  - **Approve** opens a confirm dialog, "Approve <name>?", "They will carry the verified mark across
    Yoir, and are told by email." Cancel sends nothing.
  - **Reject** opens "Why are you rejecting this?". "Confirm rejection" with an empty reason shows "Say
    why, so the Career Professional knows what to change." and sends nothing. Cancel closes it.
  - **Leave pending** goes back to the queue without a request.
- **Decided card ("Additional investigation", US-33):** "Looked again? Record the new outcome." A
  verified submission offers "Mark as rejected"; a rejected one offers "Mark as verified"; "Keep this
  outcome" goes back. The same confirm and reason rules apply.
- **After a decision:** the status shown is the one the back end returns, and a toast says "<name> is
  verified" or "<name> was rejected". A failure shows the error banner and leaves the status as it was.
- **Not found:** "This submission could not be found."

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listVerificationSubmissions(status)` | `GET /admin/verifications?status=` | The queue. The detail screen also uses it, with `all`, and picks its row. |
| `api.decideVerification(id, decision, reason)` | `POST /admin/verifications/{id}/decision` | The app sends `verified` or `rejected`. The back end emails the Career Professional. |

Every `/admin/*` endpoint requires a Platform Owner; the shell's redirect is a convenience, not the
protection.

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-58: queue lists pending submissions with name and LinkedIn URL; URL opens outside the app | Waiting by default; URL on the detail screen via `Linking.openURL` | `verification-admin-client.test.ts` "the verification queue filters by status in the query string"; walkthrough 63–64 |
| US-58: Approve and confirm; Verified only after the back end stores it; leaves the pending list | Confirm dialog; status from the response; queue reloads on focus | Walkthrough 65–66; back end `test_approving_a_counsellor_records_it_and_tells_them`. Screen: not unit tested |
| US-58: Reject and confirm, with the reason | Reason required by the app and the back end | `verification-admin-client.test.ts` "a decision carries its reason, which the counsellor is emailed"; back end `test_rejecting_requires_a_reason_and_passes_it_on` |
| US-58: back or Leave pending keeps it pending and queued | Leave pending and Back send nothing | Checked manually |
| US-58: other roles rejected | Back end; the shell redirects other roles | Back end `test_the_admin_area_is_closed_to_everyone_else` |
| US-58: failed decision shows an error; still Pending | Banner; status unchanged | Not unit tested |
| US-33: a new outcome on a decided submission is stored and returned | Mark as verified or Mark as rejected | Walkthrough 66; back end `test_an_additional_investigation_can_send_a_verified_counsellor_back_to_pending` |
| US-33: Career Professional sees the new status | Their screens read on focus, in the shared wording | See [US-32](us31-us32-linkedin-verification.md) |
| US-33: an outcome that is not pending, verified or rejected is refused | Back end | `test_an_unrecognised_decision_outcome_is_rejected_and_changes_nothing` |
| US-33: failure keeps the previous status | Banner; status unchanged | Not unit tested |

## Tests

- [`__tests__/api/verification-admin-client.test.ts`](../../../frontend/__tests__/api/verification-admin-client.test.ts),
  "administration calls": queue filter, decision body and "ids are escaped rather than pasted into the
  path".
- No Jest test renders the queue or detail screen; the walkthrough screenshots are the record of them.

Run from `frontend/`: `npx jest __tests__/api/verification-admin-client.test.ts`. Local run on `dev` at
`d3b7026`, 16 October 2026, Node 22.14.0: 13 passed (the file also covers US-48, US-70 and US-71
calls).

## Known gaps

- **Back to pending:** the back end accepts `pending` as a decision since 8 October (`81b3f9c`), but the app
  offers only verified and rejected, so an additional investigation cannot reopen a submission from
  here.
- **Single read:** the detail screen loads the whole list to find one submission. `GET
  /admin/verifications/{id}` was added on 14 October (`6b9a7d8`, Jashan) and is not called yet.
- **No screen tests** for the queue or the decision flow.
