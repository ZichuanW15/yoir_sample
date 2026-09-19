# US-09–13 frontend: Yoir Diagnosis and best matches

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

The five triage stories are Sprint 3 work and its highest priority, as the Product Owner recorded on
18 September in the [Sprint 2 review](../client-feedback/sprint-2-review-and-client-feedback.md). Their
front-end is in progress: the five front-end sub-issues are In Progress on the board, and a first slice
reached `dev` on 18 September 2026 in response to the client's 17 September feedback, ahead of any
backend support. It gives a signed-in Job Seeker the six-step Yoir Diagnosis as their onboarding, a
Yoir Direction, and a home screen of the Career Professionals best matched to it. Answers are kept on
the device, the direction is worked out in the app, and the questions do not yet branch on the first
answer. None of the five stories is claimed as accepted.

## Screens and flow

| Route | File | What the Job Seeker sees |
|---|---|---|
| `/job-seeker/diagnosis` | [`app/job-seeker/diagnosis.tsx`](../../../frontend/app/job-seeker/diagnosis.tsx) | Steps 1–5, one question per screen, then step 6: their Yoir Direction. |
| `/job-seeker` | [`app/job-seeker/index.tsx`](../../../frontend/app/job-seeker/index.tsx) | Home: best matches and a Retake diagnosis button. |

Shared code: [`src/diagnosis/model.ts`](../../../frontend/src/diagnosis/model.ts) (questions, direction
rules, ranking), [`src/diagnosis/view.tsx`](../../../frontend/src/diagnosis/view.tsx) (`useDiagnosis`,
`DirectionCard`, `BestMatches`) and [`src/diagnosis/storage.ts`](../../../frontend/src/diagnosis/storage.ts)
with its web variant `storage.web.ts`.

Entry: after login `homeFor('job_seeker')` in [`src/navigation.ts`](../../../frontend/src/navigation.ts)
sends a Job Seeker to `/job-seeker`. If no diagnosis is stored for them, Home redirects to
`/job-seeker/diagnosis`, so a new Job Seeker starts there. A login that carries a service to book
(`/auth/login?serviceId=…`) goes to that service instead and does not interrupt the booking.

The questions are the client's six steps from the 17 September email (E03 in the review), in the
client's wording:

| Step | Question | Answers |
|---|---|---|
| 1 | Where are you now? | One of six |
| 2 | What are you trying to achieve? | One of ten |
| 3 | What have you tried so far? | Any of eight, or none |
| 4 | Where are you getting stuck? | One of twelve |
| 5 | Are there any barriers affecting your next step? | Any of seven |
| 6 | Your Yoir Direction | Result |

## Behaviour and states

- **Progress:** a six-segment bar and "Step n of 6". Steps 1, 2 and 4 are single choice (radio chips);
  steps 3 and 5 are multiple choice (checkbox chips).
- **Validation:** Continue is disabled until a single-choice step has an answer. Multiple-choice steps
  may be left empty. There is no inline validation message.
- **Back** returns to the previous step with its answers kept. **Skip for now** appears on steps 1–5;
  it stores a skipped diagnosis (unless one was already completed) and opens Home.
- **Completing:** "See my Yoir Direction" on step 5 stores the answers and shows step 6.
- **Step 6:** a card headed "Main area to work on" with the area, a summary and numbered "Suggested next
  steps"; "Relevant Career Professionals" (the top three matches); buttons "View Career Professionals"
  (Explore), "Go to my home" and "Retake the diagnosis".
- **Retake** starts from the last answers given.
- **Guests** never see the diagnosis: the route redirects to `/auth/login?role=job_seeker`, and a
  guest's Home shows the top-rated Career Professionals with a "Create an account" button. Other roles
  are redirected to their own home.

### Direction rules (`directionFor`)

The main area comes from step 4 (where they are stuck). "Not sure" falls back to step 2 (the goal),
then step 1 (the situation), then Career direction. The seven areas are Career direction, Job search
strategy, Resume and applications, Interview skills, Getting your experience recognised, Networking and
LinkedIn, and Study and upskilling pathway. Each has a summary and three next steps. If step 3 shows
the Job Seeker has already worked on the main area, the summary says expert feedback is the fastest way
forward. Each barrier in step 5 adds its own next step, at most two.

### Matching (`rankProfessionals`)

Each Career Professional is scored by keywords, matched as word prefixes, against their introduction,
skills and expertise, and the titles and descriptions of their services. Main-area keywords weigh 10;
the goal's area and each barrier's area weigh 1, so a barrier widens the matches without outranking the
main area. Ties, and everyone when there is no diagnosis, are ordered by rating. A positive score shows
"Best match" (first) or "Good match".

### Home

A green brand panel greets the Job Seeker ("Your best matches"), shows the main area and a Retake
diagnosis button. Below it, up to five Career Professional cards: photo or initials, name, Verified or
New to Yoir, rating, introduction (three lines), up to three areas of expertise, languages and the
lowest service price ("From $85"). A card opens the public profile documented in
[US-46](us46-service-evaluation.md). "View all Career Professionals" opens Explore. A Job Seeker who
skipped the diagnosis sees the top-rated Career Professionals and a "Take the Yoir Diagnosis" button.

### Storage

`useDiagnosis` reads and writes `yoir.diagnosis.<user id>`: SecureStore on a device, `localStorage` on
the web. The stored value is `{ "answers": … }`, or `{ "answers": null }` when skipped. A storage
failure costs only the saved answers; the Job Seeker takes the diagnosis again.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listCounsellors()` | `GET /counsellors` | Public. The Career Professionals behind Explore's services, best rated first. |
| `api.listServices()` | `GET /services` | Public. Grouped by Career Professional for matching and the "From" price. |

There is no diagnosis endpoint yet. Saving, resuming and the direction itself are the back-end
sub-issues [#161](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/161),
[#164](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/164),
[#167](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/167),
[#170](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/170) and
[#173](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/173).
`model.ts` is a ready specification for the #170 rules.

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-09: a clear action starts or resumes the diagnosis after login | New Job Seekers are sent into it; Home has Retake diagnosis | `e2e/web.spec.ts` US07 and US06/08 (skip the diagnosis after login) |
| US-09: saved incomplete progress resumes | Not met: only a finished or skipped diagnosis is stored | Not covered |
| US-09: unauthenticated users must log in; no private data | Guests are redirected to login; there is no server record yet | Checked manually in the browser, 18 Sep |
| US-09: another user's record is rejected | Not applicable until the backend record exists (#161) | Not covered |
| US-10: six steps in order | Five questions then the direction, with progress | Checked manually in the browser, 18 Sep |
| US-10: stored against the Job Seeker; advance only after confirmation | Not met: stored on the device only | Not covered |
| US-10: completed steps show saved answers | Back and Retake show earlier answers | Checked manually |
| US-10: rejected submission shows an error | Not applicable without a backend | Not covered |
| US-11: missing answer does not advance | Continue disabled until answered; no message | Checked manually |
| US-11: progress survives closing the app | Only a finished diagnosis survives | Not covered |
| US-11: back keeps answers | Yes | Checked manually |
| US-11: other users' triage rejected | Backend (#167) | Not covered |
| US-12: result tied to the responses | Worked out in the app, not returned by the backend | `__tests__/diagnosis.test.ts` "the Yoir Direction" |
| US-12: result explains the direction and next step | Step 6 card | Checked manually |
| US-12: incomplete triage rejected | The result is only reachable from step 5 | Not covered on the server |
| US-12: failure shows an error, never a fabricated match | Matches show an error with Try again if loading fails | `BestMatches` error state; not unit tested |
| US-13: criteria applied or suggested in discovery | Suggested on Home; Explore opens unfiltered | "best matches" tests in `__tests__/diagnosis.test.ts` |
| US-13: result kept on return | Stored per user; Home shows it | Checked manually |
| US-13: empty listings keep the result | "No Career Professionals are listed yet" | Not unit tested |
| US-13: unsupported criteria not claimed | Explore claims no filter | Checked manually |

## Tests

- [`__tests__/diagnosis.test.ts`](../../../frontend/__tests__/diagnosis.test.ts): "the main challenge
  decides the area to work on", "\"Not sure\" falls back to the goal, then to the situation", "barriers
  add their own next steps, and what they tried changes the advice", "put the Career Professionals who
  fit the direction first", "a barrier brings in related people without outranking the main area",
  "without a diagnosis, rank by rating and claim no match".
- [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts): "Career
  Professionals are listed and read publicly, without authentication".
- [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts): the login journeys expect a new Job Seeker to
  land on the diagnosis, skip it and reach Home.

Run from `frontend/`: `npm test -- __tests__/diagnosis.test.ts`.

## Known gaps

- **Branching:** the review's FB02 expects later questions to follow the step 1 answer, drawn from the
  client's workbook (E04, archived in the Wiki). Every Job Seeker currently answers the same five
  questions. The workbook's questions have not been imported.
- **Persistence:** nothing reaches the backend; answers do not follow the Job Seeker to another device,
  and an unfinished diagnosis is lost.
- **Discovery:** Explore is not filtered by the direction.
- **Free text:** "Something else" and "Other" have no text field.
