# US-09–13 frontend: Yoir Diagnosis resume, validation and Explore handoff

Issues: front-end sub-issues [#160](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/160),
[#163](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/163),
[#166](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/166),
[#169](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/169) and
[#172](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/172), under
[US-09 #81](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/81),
[US-10 #78](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/78),
[US-11 #80](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/80),
[US-12 #79](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/79) and
[US-13 #76](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/76).

This is the Sprint 3 continuation of the [Sprint 2 diagnosis slice](../../sprint2/frontend/us09-us13-yoir-diagnosis.md),
which describes the questions, direction rules and matching unchanged here. It reached `dev` on
5 October 2026 in [PR #232](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232)
(commit `be8ea2c`). It closes four of the Sprint 2 gaps: an unfinished diagnosis now resumes, Continue
explains why it will not move, "Something else" and "Other" take free text, and Explore carries the
direction. Answers are still kept on the device and the direction is still worked out in the app. The
back end for saving (US-09–11) and for the direction and Explore criteria (US-12, US-13) has since
merged, but this front end does not call it yet. None of the five stories is claimed as accepted.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 11–21.

## Screens and flow

| Route | File | What the Job Seeker sees |
|---|---|---|
| `/job-seeker/diagnosis` | [`app/job-seeker/diagnosis.tsx`](../../../frontend/app/job-seeker/diagnosis.tsx) | Steps 1–5, then step 6: the Yoir Direction. Opens on the question they had reached. |
| `/job-seeker/diagnosis?result=1` | same | A finished diagnosis opened straight on its direction, to read again. |
| `/job-seeker` | [`app/job-seeker/index.tsx`](../../../frontend/app/job-seeker/index.tsx) | Home: best matches, or "Pick up where you left off" while a diagnosis is unfinished. |
| `/marketplace` (`?match=1`) | [`app/marketplace/index.tsx`](../../../frontend/app/marketplace/index.tsx) | Explore with a "Your Yoir Direction" card; `match=1` turns on "Best matches first". |

Shared code: [`src/diagnosis/model.ts`](../../../frontend/src/diagnosis/model.ts) (`directionFor`,
`rankProfessionals`, and the new `rankServices`) and [`src/diagnosis/view.tsx`](../../../frontend/src/diagnosis/view.tsx)
(`useDiagnosis`, `finishedAnswers`, `DirectionCard`, `BestMatches`).

## Behaviour and states

- **Saving as they go:** each Continue stores the answers and the next step before the next question
  shows. Closing the app part-way reopens on that question with the answers given. Going back to
  change an answer never moves the place they resume at.
- **Loading:** Home and the diagnosis show a spinner while the stored answers are read, so a returning
  Job Seeker is never sent into the diagnosis by mistake.
- **Home, unfinished:** "Pick up where you left off", "You are on step n of 6 of your Yoir Diagnosis.
  Your answers so far are saved.", a progress bar and "Continue the Yoir Diagnosis".
- **Home, finished:** a yellow pill with the main area opens the direction again (`?result=1`); "Retake
  diagnosis" sits beside it.
- **Validation:** Continue on a single-choice step with nothing chosen shows "Choose an option to
  continue." (`accessibilityRole="alert"`) and does not advance. Choosing an option clears it.
  Multiple-choice steps may still be left empty.
- **Free text:** choosing "Something else" or "Other" opens "Tell us a little more (optional)", up to
  200 characters, stored with the answers under `other`. Step 4 has no "Other".
- **Retake:** starts from the last answers. Nothing is stored until step 5 is finished, so the earlier
  direction stands until then. Skipping a retake keeps the earlier direction.
- **Skip for now:** with step 1 answered, it keeps the answers and step reached; with nothing answered,
  it stores a skipped diagnosis as before.
- **Step 6:** "View Career Professionals" is pushed rather than replaced, so Back from Explore lands
  on the direction again.

### Explore, by direction (US-13)

With a finished diagnosis, Explore shows a yellow card: "Your Yoir Direction", the main area, a "Best
matches first" checkbox chip and "View my direction". With the chip on:

- `rankServices` puts services whose own title and description fit the direction first. The sort is
  stable, so equal services keep the order Explore's filters chose.
- Only a service for the main area (score of 10 or more) gets the "Fits your direction" tag. A service
  that only touches the goal or a barrier moves up but is not called a fit.
- The sort label reads "Best for your direction" when anything fits.
- With nothing that fits: "No service listed here fits this direction yet, so the list is in its usual
  order." The list is left alone.

Search, filters and the empty-results state work as before; the direction card stays on screen.

### Storage

`useDiagnosis` still reads and writes `yoir.diagnosis.<user id>` (SecureStore on a device,
`localStorage` on the web). The record is `{ answers, step? }`: `step` is present only while the
diagnosis is unfinished, and `answers: null` means skipped. A record is tagged with its key while it
loads, so one person's diagnosis never shows while another's is being read.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listCounsellors()` | `GET /counsellors` | Public. Behind the best matches. |
| `api.listServices()` | `GET /services` | Public. Matching, the "From" price and Explore's ranking. |

The diagnosis back end is now on `dev` but not called from the app:

| Endpoint | Back end | Front-end use |
|---|---|---|
| `GET /me/diagnosis/questionnaire`, `POST`/`GET /me/diagnosis`, `GET /diagnoses/{id}`, `PUT /diagnoses/{id}/steps/{stepId}` | US-09–11, [backend doc](../backend/us09-us11-diagnosis.md) | None yet |
| `GET /diagnoses/{id}/direction` | US-12 (`25acc4e`, 14 Oct) | None yet |
| `GET /diagnoses/{id}/marketplace-criteria` | US-13 (`1f7ffbf`, 15 Oct) | None yet |

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-09: a clear action starts or resumes the diagnosis after login | New Job Seekers are sent into it; Home offers Continue or Retake | `e2e/web.spec.ts` login journeys; walkthrough 11, 20 |
| US-09: saved incomplete progress resumes | Resumes at the step reached, on the same device | Checked manually; not unit tested |
| US-09: unauthenticated users must log in; no private data | Guests are redirected to login | Checked manually |
| US-09: another user's record is rejected | Back end only (`test_diagnosis.py`); the app reads no server record | Not covered in the app |
| US-10: six steps in order | Five questions then the direction, with progress | Walkthrough 11–17 |
| US-10: stored against the Job Seeker; advance only after confirmation | Not met: stored on the device, not the back end | Not covered |
| US-10: completed steps show saved answers | Back, resume and Retake show earlier answers | Checked manually |
| US-10: rejected submission shows an error | Not applicable until saves go to the back end | Not covered |
| US-11: missing answer shows validation and does not advance | "Choose an option to continue." | Checked manually; not unit tested |
| US-11: progress survives closing the app | Yes on the same device; not across devices | Checked manually |
| US-11: back keeps answers and allows changes | Yes | Checked manually |
| US-11: other users' triage rejected | Back end only | Not covered in the app |
| US-12: result tied to the responses | Worked out in the app (`directionFor`), not read from `/direction` | `diagnosis.test.ts` "the Yoir Direction" |
| US-12: result explains the direction and next step | Step 6 card | Walkthrough 17 |
| US-12: incomplete triage rejected | Step 6 is only reachable from step 5 | Not covered on the server path |
| US-12: failure shows an error, never a fabricated match | Matches show an error and Try again | `BestMatches` error state; not unit tested |
| US-13: criteria applied or clearly suggested | "Best matches first" on Explore, on by default from the direction | `diagnosis.test.ts` "Explore, by direction"; walkthrough 19 |
| US-13: result kept on return | Back from Explore lands on the direction; Home and Explore reopen it | Checked manually |
| US-13: empty listings keep the result | Direction card stays above the empty state | Checked manually |
| US-13: unsupported criteria not claimed | Fit is only claimed for main-area services; none fitting says so | `diagnosis.test.ts` "with nothing that fits, the list is untouched and no fit is claimed" |

## Tests

- [`__tests__/diagnosis.test.ts`](../../../frontend/__tests__/diagnosis.test.ts), 9 tests. New in
  Sprint 3, "Explore, by direction": "services that fit the direction come first, and the rest keep the
  order they had", "a service that only touches a barrier moves up but is not called a fit", "with
  nothing that fits, the list is untouched and no fit is claimed". The six Sprint 2 direction and
  best-match tests still pass.
- [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts): login journeys expect a new Job Seeker to land
  on the diagnosis and skip it.

Run from `frontend/`: `npx jest __tests__/diagnosis.test.ts`. Local run on `dev` at `d3b7026`,
16 October 2026, Node 22.14.0: 9 passed.

## Known gaps

- **Back-end integration:** the app does not call any diagnosis endpoint. Answers stay on one device,
  the direction is the app's own, and Explore's ranking is keyword-based rather than the back end's
  `marketplace-criteria`. Sub-issues #163 and #169 are closed on the board, but their "save to the
  backend" and "direction returned by the backend" wording is not met by this code.
- **Branching:** every Job Seeker still answers the same five questions; the client workbook's topic
  questions (FB02) are not imported.
- **No screen tests:** resume, the validation message, free text and the Explore card are checked by
  hand only.
