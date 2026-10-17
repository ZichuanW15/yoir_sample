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

This is the Sprint 3 continuation of the [Sprint 2 diagnosis slice](../../sprint2/frontend/us09-us13-yoir-diagnosis.md).
The five questions, saved progress, direction rules and Explore criteria are now owned by the FastAPI
back end. The app reads the questionnaire, confirms first-time progress step by step, displays only the
server-derived direction and uses the returned criteria to query relevant public professionals and
services. A retake remains a local draft until its final question, so abandoning it cannot replace the
last confirmed direction.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 11–21.

## Screens and flow

| Route | File | What the Job Seeker sees |
|---|---|---|
| `/job-seeker/diagnosis` | [`app/job-seeker/diagnosis.tsx`](../../../frontend/app/job-seeker/diagnosis.tsx) | Steps 1–5, then step 6: the Yoir Direction. Opens on the question they had reached. |
| `/job-seeker/diagnosis?result=1` | same | A finished diagnosis opened straight on its direction, to read again. |
| `/job-seeker` | [`app/job-seeker/index.tsx`](../../../frontend/app/job-seeker/index.tsx) | Home: best matches, or "Pick up where you left off" while a diagnosis is unfinished. |
| `/marketplace` (`?match=1`) | [`app/marketplace/index.tsx`](../../../frontend/app/marketplace/index.tsx) | Explore with a "Your Yoir Direction" card; `match=1` turns on "Best matches first". |

Shared code: [`src/diagnosis/view.tsx`](../../../frontend/src/diagnosis/view.tsx) (`useDiagnosis`,
`DirectionCard` and `BestMatches`) and the diagnosis methods in
[`src/api/client.ts`](../../../frontend/src/api/client.ts).

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

- The app sends the back end's `query` and `modality` criteria to `GET /services`; returned services
  are placed first without changing the order of unrelated results.
- Only services returned by that criteria request receive the "Fits your direction" tag.
- The sort label reads "Best for your direction" when at least one returned service fits.
- With nothing that fits: "No service listed here fits this direction yet, so the list is in its usual
  order." The list is left alone.

Search, filters and the empty-results state work as before; the direction card stays on screen.

### Storage

`useDiagnosis` stores no diagnosis record on the device. It loads the signed-in Job Seeker's private
record from FastAPI, and the back end binds that record to the authenticated account. First-time
progress is saved after each Continue. During a retake, edited answers stay in component state until
the final question; leaving early therefore preserves the prior confirmed server revision.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `getDiagnosisQuestionnaire` | `GET /me/diagnosis/questionnaire` | Loads the versioned five-question flow. |
| `startDiagnosis`, `getOwnDiagnosis` | `POST`/`GET /me/diagnosis` | Creates once or resumes private progress. |
| `saveDiagnosisStep` | `PUT /diagnoses/{id}/steps/{stepId}` | Confirms ordered answers with optimistic revision checks. |
| `getDiagnosisDirection` | `GET /diagnoses/{id}/direction` | Returns advice only for a complete diagnosis. |
| `getDiagnosisMarketplaceCriteria` | `GET /diagnoses/{id}/marketplace-criteria` | Translates the confirmed direction into supported discovery criteria. |
| `listCounsellors`, `listServices` | `GET /counsellors`, `GET /services` | Applies those public criteria to Best Matches and Explore. |

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-09: a clear action starts or resumes the diagnosis after login | New Job Seekers are sent into it; Home offers Continue or Retake | `e2e/web.spec.ts` login journeys; walkthrough 11, 20 |
| US-09: saved incomplete progress resumes | Resumes the server-confirmed step across devices | `screens/diagnosis.test.tsx`; back-end diagnosis tests |
| US-09: unauthenticated users must log in; no private data | Guests are redirected to login | Checked manually |
| US-09: another user's record is rejected | The client uses only the authenticated `/me` record; the back end enforces ownership | `test_diagnosis.py` |
| US-10: six steps in order | Five questions then the direction, with progress | Walkthrough 11–17 |
| US-10: stored against the Job Seeker; advance only after confirmation | First-time flow advances only after the PUT succeeds | `screens/diagnosis.test.tsx` |
| US-10: completed steps show saved answers | Back, resume and Retake show earlier answers | Checked manually |
| US-10: rejected submission shows an error | The step remains visible and the hook exposes the safe API error | Screen and client tests |
| US-11: missing answer shows validation and does not advance | "Choose an option to continue." | Checked manually; not unit tested |
| US-11: progress survives closing the app | Yes; progress is server-backed | Back-end diagnosis tests |
| US-11: back keeps answers and allows changes | Yes | Checked manually |
| US-11: other users' triage rejected | Back end only | Not covered in the app |
| US-12: result tied to the responses | Read from `/direction` for the confirmed revision | `screens/diagnosis.test.tsx` |
| US-12: result explains the direction and next step | Step 6 card | Walkthrough 17 |
| US-12: incomplete triage rejected | Step 6 is only reachable from step 5 | Not covered on the server path |
| US-12: failure shows an error, never a fabricated match | Matches show an error and Try again | `BestMatches` error state; not unit tested |
| US-13: criteria applied or clearly suggested | Returned query/modality drive Best Matches and "Best matches first" | Diagnosis screen and API client tests; walkthrough 19 |
| US-13: result kept on return | Back from Explore lands on the direction; Home and Explore reopen it | Checked manually |
| US-13: empty listings keep the result | Direction card stays above the empty state | Checked manually |
| US-13: unsupported criteria not claimed | Fit is only claimed for services returned by supported criteria; none fitting says so | Marketplace and diagnosis screen tests |

## Tests

- [`__tests__/screens/diagnosis.test.tsx`](../../../frontend/__tests__/screens/diagnosis.test.tsx)
  covers creation, server-confirmed progress, server-derived results, criteria handoff, abandoning a
  retake without mutation and ordered final retake submission.
- [`__tests__/api/diagnosis-client.test.ts`](../../../frontend/__tests__/api/diagnosis-client.test.ts)
  covers the authenticated request and response boundary.
- [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts): login journeys expect a new Job Seeker to land
  on the diagnosis and skip it.

Run from `frontend/`: `npm test -- --runInBand __tests__/screens/diagnosis.test.tsx
__tests__/api/diagnosis-client.test.ts`.

## Known gaps

- **Branching:** every Job Seeker still answers the same five questions; the client workbook's topic
  questions (FB02) are not imported.
