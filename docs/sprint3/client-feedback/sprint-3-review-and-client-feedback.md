<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Sprint 3 Review & Client Feedback
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Review-and-Client-Feedback
  Wiki commit: fa8c5fc (2026-10-18)
  Exported:    2026-10-18
-->

# Sprint 3 Review & Client Feedback

**Recorded:** 18 October 2026, the last day of Sprint 3. **Product Owner:** Jared. **Scrum Master:** Manu. **Status:** evidence-backed review of the Sprint 3 delivery and the client's feedback; not a claim of client acceptance. The client's formal acceptance is due at the acceptance session on 23 October 2026.

This record connects the Sprint 3 delivery on `dev`, the 16 October client demonstration and the decisions taken there to the [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning) commitment, the [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements) and the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog). It supplements, rather than rewrites, the [16 October meeting minutes](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes#week-11) and the [Sprint 3 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Test-Approach). It follows the [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback).

## 1. Source and communication record

| ID | Date / source | Evidence and boundary |
|---|---|---|
| S01 | 7 October 2026; [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning) | Sprint goal, the 23 committed stories in order of work, story points and actions A1–A11. |
| S02 | 8 October 2026; [Week 10 supervisor meeting](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Mentor-Communication-Log#week-10) with Erfan | Confirms this is the final sprint, with the architecture presentation the following week and the demo presentation the week after (25–30 minutes each). Ariz's question on whether a reschedule (US-69) needs approval before the new slot is confirmed was taken to the 9 October workshop. |
| S03 | 14 October 2026; [Week 11 stand-up](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups#week-11) | Front-end work complete; one consolidated pull request for US-53–55 waiting on a CI fix; QA waiting for the last merges before its final runs; a document for each Sprint 3 story; client demo on 16 October, then a handover session the following week. |
| S04 | 16 October 2026; [Week 11 client meeting](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes#week-11), Microsoft Teams, about 26 minutes | Sam (Saumil Macwan), Jared, Manu and Jashan; supervisor not present. Minuted by Manu from the transcript. Records the demonstration, Sam's feedback, five confirmed decisions and eight actions. The minutes record no acceptance. |
| S05 | 16–17 October 2026; QA results in the repository | [QA evidence index][qa-readme], [latest report][qa-latest], [full review][qa-final], [meeting-area report][qa-area], [QA matrix][qa-matrix]. Summarised in §6. |
| S06 | 18 October 2026; GitHub issues, pull requests, Actions and the [Project Board](https://github.com/orgs/swen90014-2026-sm2/projects/6), read for this record | All 23 Sprint 3 stories and their 69 front-end, back-end and QA sub-issues are closed as completed. Fourteen pull requests merged into `dev` between 5 and 17 October (#232–#244 and #246). |
| S07 | 18 October 2026; [Risk Register, Sprint 3 review](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Risk-Register#sprint-3-review-18-10-2026) | Current ratings of R-01–R-05 and the new risks R-06–R-10. |

**Code boundary:** the QA baseline is `dev` at `8713b38`. No application code has changed on `dev` since then; later commits add tests, QA evidence and documentation only.

## 2. Sprint 3 goal and outcome

> A Job Seeker completes the Yoir Diagnosis, receives an explained direction and continues to relevant Career Professionals and booking. Career Professionals are verified and manage their bookings, the Platform Owner oversees verification, orders and users, and buyers can review a completed session. The sprint ends with a tagged, tested and documented build handed over to the client.

| Part of the goal | Outcome at 18 October | Evidence / boundary |
|---|---|---|
| Diagnosis, explained direction, relevant Career Professionals and booking | Delivered on `dev`. The diagnosis front end was connected to its back end on 17 October ([PR #242][pr242]), the day after the demo. | Runs on the team's version-1 questions and rules. The client has not confirmed them and is rewriting the questions (§4.2, R-06). Not shown live on 16 October. |
| Career Professionals verified and managing their bookings | Delivered. | Verification decisions and the Career Professional profile and bookings were shown on 16 October. |
| Platform Owner oversight of verification, orders and users | Delivered. | Overview, verification, Users, Bookings and Payments were shown on 16 October. |
| Buyers review a completed session | Delivered; the reviews back end merged on 14 October ([PR #239][pr239]). | Rating and written review were shown on 16 October. |
| Tagged, tested and documented build handed over | Partly. Tested (§6) and documented (front-end and back-end story documents, and the [Sprint 3 Feature Walkthrough](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough)). Not yet tagged or handed over. | No Sprint 3 tag or release at 18 October. Handover was agreed on 16 October for the 23 October session (§5). |

**Result:** the product part of the goal was met on `dev`, with the diagnosis content still to be confirmed by the client. The handover part was not complete at sprint close and moves to the acceptance session on 23 October 2026. All 23 committed stories were closed, including both Should-haves; none was dropped.

### 2.1 Planning actions at sprint close

Selected [Sprint 3 Planning actions](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning#8-actions) whose state can be read from the sources above.

| # | Action | State at 18 October |
|---|---|---|
| A3 | Estimate US-09–13, US-29 and US-71 | Done late: estimated at sprint close on 18 October, 24 SP in all (US-09 3, US-10 5, US-11 3, US-12 5, US-13 3, US-29 3, US-71 2). |
| A4 | Review and merge PR #233, the diagnosis persistence back end | Done; merged 12 October ([PR #233][pr233]). |
| A5 | Agree the diagnosis entry options and rules with the client (RR-13, RR-14) | Open. Both remain open in [Requirements §8.2](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements#82-open); on 16 October Sam said he is rewriting the questions. |
| A6 | Client demonstration of the diagnosis-to-booking slice before the sprint closes | Held 16 October; the diagnosis itself was explained, not shown live. |
| A7 | Merge the back end and close each story once its QA evidence is recorded | Done. Back ends merged by 17 October, QA sub-issues closed 16 October, stories closed 18 October. |
| A10 | Tag the Sprint 3 build, record the CI run on the tag, keep one current test-results page | Tag not created yet. The [QA evidence index][qa-readme] names one latest report and lists the others as historical. |

## 3. Delivery by story

Grouped and ordered as in [Sprint 3 Planning §3](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning#3-scope--23-stories). Every story below and its front-end, back-end and QA sub-issues are closed; the stories were closed by the team on 18 October 2026. Closing records the team's [Definition of Done](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning#6-how-work-is-gated); it is not client acceptance. QA findings marked advisory or strict XFAIL are executed failures kept visible under the QA policy ([evidence language](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Test-Approach#evidence-language)).

| Order | Story | SP | Front end | Back end | QA evidence |
|---|---|---|---|---|---|
| **1. Diagnosis to booking** | [US-09][us09] Enter the Yoir diagnosis journey | 3 | A new Job Seeker goes into the diagnosis after login; Home offers Continue or Retake. Screens in [PR #232][pr232], connected to the API in [PR #242][pr242]. | One private diagnosis record per Job Seeker: create or resume, read own progress, versioned questionnaire `yoir-six-step-v1`, migration `0009` ([PR #233][pr233]). | [#162][qa162]: entry, server resume in a fresh browser and account isolation pass. Advisory: if the first progress read fails, Home keeps spinning with no error or retry (`S3-DIAGNOSIS-HOME-READ-RECOVERY`). |
| | [US-10][us10] Complete the six-step Yoir triage | 5 | Five questions, then the Yoir Direction as step 6. A first-time answer advances only after the server confirms the save (PR #232, #242). | Validates and stores each step in order against an expected revision (PR #233). | [#165][qa165]: ordered saves, refused-save retry and server revisions pass. Advisory: a failed retake submission loses its error message (`S3-DIAGNOSIS-RETAKE-ERROR`). |
| | [US-11][us11] Progress through triage safely | 3 | "Choose an option to continue." on a missing answer; Back keeps answers; resume from the question reached. A retake stays a draft until its last question, so leaving early keeps the earlier direction. | Rejects invalid answers and other accounts; a stale save gets a conflict instead of overwriting newer answers (PR #233). | [#168][qa168]: validation, revision conflicts and account changes while requests are pending pass. |
| | [US-12][us12] Receive relevant direction or matching | 5 | Step 6 shows the back end's direction: main area, explanation and suggested next steps (PR #242). | `GET /diagnoses/{diagnosisId}/direction`: deterministic, versioned rules (`yoir-direction-v1`); an incomplete diagnosis is rejected ([PR #236][pr236]). | [#171][qa171]: direction reads, changed answers, incomplete rejection and retry pass for the implemented rules. |
| | [US-13][us13] Continue from diagnosis to Explore | 3 | Best Matches and Explore use the direction's criteria; the direction card stays on screen and a no-match result says so (PR #242). | The direction is turned into supported Explore criteria (PR #236), with relevance filtering of services and Career Professionals (PR #242). | [#174][qa174]: criteria, empty results and return to the result pass. Advisory: Best Matches fails to render when a partially visible or restricted profile omits private fields (`S3-PRIVACY-MATCH-CRASH`). |
| **2. Verification and trust** | [US-31][us31] Submit a LinkedIn profile for verification | 4 | Verification screen with the LinkedIn URL form; Pending shows only once the back end has stored the URL (PR #232). | Server-side LinkedIn URL validation, tightened over three review rounds ([PR #235][pr235]). | [#192][qa192]: URL and role validation, rollback and retry, and a stale-submission conflict pass. |
| | [US-32][us32] See the verification result | 3 | One wording for pending, verified and rejected on every screen; before this a rejected account read "Verification pending" (PR #232). | Own-profile read returns the caller's own status ([PR #234][pr234]). | [#195][qa195]: status rereads pass. Advisory: a failed workspace refresh keeps the old badge. |
| | [US-58][us58] Review verification as a Platform Owner | 4 | The queue is a list and each row opens one submission: approve asks first, reject needs a reason, Leave pending sends nothing (PR #232). | Decisions from Sprint 2; a single-submission read was added ([PR #238][pr238]) but the app does not call it yet. | [#222][qa222]: approve, reject, leave pending, rollback and wrong-role denial pass. |
| | [US-70][us70] Reset a forgotten password securely | 5 | Sprint 2 screens, now with screen tests (commit `4a67bcd`, pushed directly to `dev`). | Asking for a reset link takes about the same time whether or not the account exists; two new tests (same commit). | [#228][qa228]: token validity, expiry and reuse, old-password refusal and generic responses pass; mail is checked at a controlled test seam. |
| | [US-27][us27] Control profile visibility | 4 | Privacy settings: Public, Partially visible or Restricted (PR #234). | Visibility setting (PR #234) and its server-side enforcement ([PR #237][pr237]). | [#183][qa183]: back-end rollback and role checks pass. Advisory: after a failed save, the failed choice stays selected. |
| | [US-28][us28] Have privacy settings enforced | 2 | Another person's view shows only the fields returned; a restricted profile says so (PR #234). | Disallowed fields are left out of responses and search. A restricted introduction reaching Explore through service listings was found in review and fixed before merge (PR #237). | [#186][qa186]: the two former field-omission XFAILs now pass; hidden fields are excluded from search. Best Matches finding as for US-13. |
| **3. Accounts and profiles** | [US-05][us05] First-login Career Professional onboarding | 4 | Onboarding screen lists the profile and verification steps and holds back the workspace until both are done (commit `91ba76d`, pushed directly to `dev`). | `GET /me/onboarding-state` (same commit). | [#180][qa180]: routing and the gate pass. Recorded failure: a failed onboarding read still opens the workspace (native case D01, 16 October). |
| | [US-29][us29] Maintain a Job Seeker profile | 3 | Sprint 2 screen plus a Profile privacy button; 12 new screen tests (commit `9e43997`). | Job Seeker's own profile routes tightened (PR #237). | [#189][qa189]: persistence, account isolation, validation and failed-write rollback and retry pass. |
| **4. Services and bookings** | [US-36][us36] Edit or remove future service offerings | 3 | Edit and delete from Sprint 2; confirmation now shows the booked title and meeting area ([PR #246][pr246]). | An order keeps the title ([PR #243][pr243], migration `0011`) and the in-person meeting area ([PR #244][pr244], migration `0012`) it was bought with. | [#201][qa201]: purchased values survive edits and withdrawal for all three roles, receipts and emails; the former meeting-area XFAIL passes; eight confirmation scenarios pass. |
| | [US-42][us42] View upcoming and past bookings | 4 | My sessions: Coming up and Past tabs, the pre-session brief and a timezone on every time (commit `c53bd0b`, pushed directly to `dev`). | Bookings list scoped to the caller (Sprint 2), now with the brief and timezone (same commit). | [#204][qa204]: lists, amounts, titles and navigation pass. Partly met: a failed read shows "Nothing booked yet" beneath the error. |
| | [US-43][us43] Open a booking's working details | 3 | Booking details: the join link, or the meeting address the Career Professional adds (commit `de52c29`, pushed directly to `dev`). | Detail with the brief, timezone and meeting address, for participants only (commits `c53bd0b`, `de52c29`). | [#207][qa207]: participant guards and the frozen title and area pass. |
| **5. Platform Owner oversight** | [US-48][us48] Inspect transaction progress | 4 | Order detail screen, opened from Payments; redesigned Overview (PR #232). | One-order read with parties, session, split and progress (PR #238); the app does not call it yet. | [#210][qa210]. Advisory: an order beyond the first 200 rows cannot be opened, and a failed read shows a false empty Bookings list. |
| | [US-71][us71] View platform users | 2 | Users screen lists Job Seekers and Career Professionals with their status (PR #232). | `GET /admin/job-seekers` added alongside the Sprint 2 Career Professional list (PR #232). | [#231][qa231]: role guards and directory reads pass. Advisory: stale rows after a failed refresh. |
| **6. Reviews and ratings** | [US-53][us53] Review a completed purchased service | 4 | Write a review from a completed session: 1–5 stars and a comment (PR #234). | `POST /bookings/{bookingId}/review` for the buyer of a completed or paid-out session ([PR #239][pr239]). | [#213][qa213]: eligibility, validation and rollback and retry pass. Strict XFAIL: a duplicate submitted at the same moment can return 500 instead of 409. |
| | [US-54][us54] See updated service-level feedback | 3 | Service page shows the average, count and a Reviews section (PR #234). | Service rating recomputed from stored reviews on each submission (PR #239). | [#216][qa216]: display and refresh pass. Strict XFAIL: concurrent reviews can leave the stored figures stale. |
| | [US-55][us55] Judge a Career Professional's overall quality | 4 | Overall rating on Explore and the profile, as returned by the back end (PR #234). | Career Professional rating recomputed across all their services (PR #239). | [#219][qa219]: weighted counts and fresh reads pass. Recorded failures: concurrent aggregates, and no neutral wording for an unrated professional. |
| **7. Should-haves** | [US-33][us33] Receive the outcome of an additional investigation | 4 | Mark as verified or Mark as rejected on a decided submission (PR #232). | `pending` accepted as a decision outcome (PR #235). | [#198][qa198]: decision propagation and rollback pass. Advisory: stale workspace refresh. |
| | [US-69][us69] Reschedule an upcoming booking safely | 5 | Reschedule from booking details to another open time (commit `06c5446`, pushed directly to `dev`). | Moves the booking on the same order in one transaction (same commit). | [#225][qa225]: competing PostgreSQL moves and rollback and retry pass. Advisory: a failed read of open times looks like none (`S3-RESCHEDULE-SLOTS-READ`). |
| **Total** | **23 stories** | **84** | 21 Must, 2 Should | | All 23 stories and 69 sub-issues closed |

**Story points:** 84 SP in all: 60 SP across the 16 stories estimated at planning, and 24 SP for US-09–13, US-29 and US-71, estimated at sprint close on 18 October ([Sprint 3 Planning §4](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning#4-estimates-still-to-agree); [Process Documentation §3](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights#3-estimation)).

**Also merged in Sprint 3:** the desktop layout for the web app (commit `bad7a8b`, 17 October), covered by the new responsive browser cases, and an open-times fix for Career Professional availability and the US-40 time picker ([PR #240][pr240]).

**Per-story documents:** [diagnosis delivery record (US-09–13)][doc-diagnosis], [front-end documents][doc-fe] and [back-end documents][doc-be] in `docs/sprint3`.

## 4. Client demonstration, 16 October 2026

### 4.1 What the client saw

| Area | Shown or explained | Stories |
|---|---|---|
| Guest browsing | A guest browses Career Professionals, their services, each service's detail and its reviews. Booking needs a Job Seeker login. | US-44–46, US-54 |
| Booking and payment | A Job Seeker picks an open slot and pays through the Stripe sandbox. Confirmation shows a booking number, payment reference and receipt. "Open the meeting room" lets both parties join the live session from the app. | US-40, US-47, US-68, US-43 |
| My bookings and reviews | Upcoming and past bookings; a star rating and written review for a completed session. | US-42, US-53 |
| Profile privacy | Public, partially visible and restricted, presented by Manu as a non-functional requirement the team had addressed. | US-27, US-28 |
| Platform Owner | Overview (money taken through Yoir, active sessions, payment holds, payouts against Yoir commission, sessions by status); verification from the LinkedIn URL and summary with approve or reject and a reason; Users; Bookings including refunds and payouts; Payments showing each order's progress, parties and session time on one screen. | US-48, US-58, US-71 |
| Career Professional view | Verification status, LinkedIn URL, introduction, background, experience, qualifications, skills and expertise, languages, default delivery and location, and upcoming and past bookings. | US-30, US-32, US-42 |
| Terminology | Manu noted that "counsellor" has been replaced with "Career Professional" throughout the app, following Sam's Sprint 2 feedback. | Cross-cutting |
| Yoir Diagnosis | Explained, not shown live, because the demo account had already completed it. Jared said the front end and back end were built but not yet integrated, and expected integration to take one to two days. | US-09–13 |

**Demo conditions:** log-in and screen-sharing problems slowed the live demo. The app is deployed, and Sam can test it with his own accounts. Sam also asked whether CSD Koala and CSD Quokka are building one product; Jared confirmed each team delivers its own version of the same brief and both present separately at the same final meeting.

### 4.2 Client feedback and decisions

| ID | Client feedback | Recorded response / acceptance impact | Stories | Follow-up owner / state |
|---|---|---|---|---|
| FB3-01 | The diagnosis is "the heart and soul" of the app: it establishes why someone has come to Yoir, the way Sam questions a client in a counselling session. | Decision 1: the diagnosis is the client's top priority; the team completes the front-end and back-end integration and updates the live link. | US-09–13 | Jared, Manu: integration merged 17 October (PR #242); email to Sam open (actions 1–2). |
| FB3-02 | Sam is working on the questions himself and will send his version after reviewing the team's work. | The current questions and rules (`yoir-six-step-v1`, `yoir-direction-v1`) are the team's reading of the requirements, not client-confirmed; RR-13 and RR-14 stay open (R-06). Get the revised questions in writing and confirm the rules before acceptance. | US-09–13 | Sam: revised questions with his feedback, weekend of 17–18 October (action 7). |
| FB3-03 | Screenshots or a PDF of the work, as previous student teams provided. | The team sends the [Sprint 3 Feature Walkthrough](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough) as a PDF, with the demo video. | All | Jared, Manu: open (action 3). |
| FB3-04 | Keep the deployment private; launch nothing. | Decision 2: the demo stays reachable only by its URL, with no public launch, and the team keeps updating the same link. The URL is therefore not listed on this page. | Cross-cutting | Agreed. The deployment is protected only by its URL not being shared (R-07). |
| FB3-05 | Sam wants to keep developing without waiting on the team. | Decision 3: both handover options. The team copies everything, history and documents included, into an empty GitHub repository Sam creates, and also sends a zip of the final version. The current repository cannot be transferred, because it belongs to the account that created it. | Handover | Sam: create the repository (action 5). Jared: copy it and prepare the zip with set-up documentation by 23 October (action 6). |
| FB3-06 | Sam will review the app and email his feedback. | Decision 5: the team incorporates it before the final session. Decision 4: the final session on 23 October is the acceptance session. | All | Whole team (action 8). |

### 4.3 Sprint 2 feedback at the close of Sprint 3

| Sprint 2 ID | Feedback ([Sprint 2 Review](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback#2-client-feedback-and-product-decisions)) | State at 18 October |
|---|---|---|
| FB01 | Diagnosis differentiates Yoir from a booking platform. | Delivered on `dev` (US-09–13). Sam confirmed on 16 October that it remains his top priority. |
| FB02 | Step 1 decides which follow-up questions a user gets. | Not delivered. Every Job Seeker answers the same five questions; the workbook's 59 topic questions are not imported. RR-13 and RR-14 are open. |
| FB03 | Answers identify blockers and lead to a type of professional, then booking. | Delivered with the team's rules: direction, then Explore criteria, then booking. Client confirmation of the rules is pending. |
| FB04 | Profiles show qualifications, experience, skills, LinkedIn, languages and services before booking. | Shown on 16 October in the Career Professional view (RR-07). |
| FB05 | Career Professional, not Career Counsellor; avoid Marketplace. | Reported done throughout the app on 16 October (RR-06). Routes and API identifiers keep their names. |
| FB06 | Typography and visuals closer to the Yoir branding. | Not discussed on 16 October. Approval remains open (RR-15). |
| FB07 | Booking should feel connected to the career journey. | The diagnosis now hands off to Explore and booking (US-13, PR #242). Sam's view of the connected journey is not yet recorded. |

## 5. How the feedback is being handled

1. **Diagnosis integration and the live link.** PR #242 connected the diagnosis screens to the questionnaire, progress, direction and Explore-criteria APIs and merged into `dev` on 17 October. The Deploy to FastAPI Cloud workflow succeeded for that merge ([run 38998332350](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/38998332350)) and for each later `dev` merge up to `f8f91e3`. Jared emails Sam once it is live so he can try it (action 2).
2. **Revised diagnosis questions.** Sam is rewriting the questions (action 7). The questionnaire and direction rules are versioned and kept in one module, `backend/app/diagnosis.py`, so a new question set or rule table is a contained change (R-06). When Sam's version arrives, the team gets it in writing, confirms the rules before acceptance and records the decision against RR-13 and RR-14 in [Requirements §8](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements#8-requirements-resolution-record). Anything not changed by 23 October is listed as a known limitation in the handover.
3. **Screenshots and demo video.** The [Sprint 3 Feature Walkthrough](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough) goes to Sam as a PDF with the demo video (action 3). It was re-captured on 18 October on the current build, at phone size and at [desktop size](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough-Desktop), and now shows the diagnosis saved to the server, reviews and ratings, reschedule, privacy enforced on other members' views and the password reset.
4. **Private deployment.** The demo stays private (Decision 2). R-07 lists the configuration to tighten before handover: refuse to start with the development JWT secret outside local development, restrict CORS to the deployed origin, turn off seeding and the API docs page in deployed environments, remove demo credentials from the repository docs and rotate the admin password.
5. **Handover.** Both options are being prepared (Decision 3, actions 5–6). The handover document lists every external account (FastAPI Cloud, Neon, Stripe, Mailgun), who owns it and which settings and secrets it needs, and no secret value goes into the repository or the zip (R-10).
6. **Acceptance.** The final session on Friday 23 October 2026, 5:30–6:30 pm, is the acceptance session: about 30 minutes for each team, with the subject coordinator and mentor attending to assess (Decision 4). It includes a product demo and a discussion of what is handed over (source code and set-up). The client's formal acceptance is due then; this page records none. The team incorporates Sam's emailed feedback beforehand (action 8).

| # | Action (Week 11 minutes) | Owner | Due | Status in the minutes | Evidence at 18 October |
|---|---|---|---|---|---|
| 1 | Integrate the diagnosis front end with its back end and deploy it to the live link | Jared, Manu | 17-10-2026 | Closed | PR #242 merged 17 October; the deployment run on that merge succeeded. |
| 2 | Email Sam once the diagnosis is live so he can try it | Jared | 17-10-2026 | Closed | — |
| 3 | Send Sam the screenshots page as a PDF and the demo video | Jared, Manu | With the update email | Closed | — |
| 4 | Send this week's minutes and transcript to Sam | Jared | After the meeting | Closed | — |
| 5 | Create an empty GitHub repository for the handover and share it with the team | Sam | Before the handover | Closed | — |
| 6 | Copy the repository into Sam's repository and prepare the zip file, with set-up documentation | Jared | 23-10-2026 | Closed | — |
| 7 | Review the live app and email feedback, including the revised diagnosis questions | Sam | Weekend of 17–18 Oct | Closed | — |
| 8 | Incorporate Sam's feedback before the acceptance session | Whole team | 23-10-2026 | Closed | — |

A dash means the sources for this record hold no evidence yet; it does not mean the action has not happened.

## 6. QA results summary

QA Lead: Zhenyang. The latest edition was executed on 17 October 2026 against `dev` at `8713b38`, which includes the desktop layout and the confirmation fix (PR #246). The back-end and live-client results were run earlier the same day on `9cce973`, and their inputs were verified unchanged. Results from different revisions and times are kept separate, as in the [Sprint 3 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Test-Approach).

| Check | Recorded result | Report |
|---|---|---|
| Shared component regression | 610 passed in 70 suites | [Latest][qa-latest] |
| iOS and Android component regression | 619 passed each | [Latest][qa-latest] |
| Component advisory (known defects) | 4 passed / 19 failed shared; 4 passed / 20 failed on iOS and on Android | [Latest][qa-latest] |
| Lint, type checking and fresh Web export | Passed | [Latest][qa-latest] |
| Chromium regression, desktop and phone-configured | 43 passed / 1 failed in each full run. The failure was the test's expected address after administrator logout; the corrected case then passed in a separate one-case run in each project. Not a full 44-pass run. | [Latest][qa-latest] |
| Chromium advisory | 1 passed / 9 failed in each project, including two new accessibility findings | [Latest][qa-latest] |
| PostgreSQL API | 916 passed, 18 strict XFAILs, 7 deselected | [Meeting-area report][qa-area] |
| Live HTTPX and TypeScript client journeys | 2 passed each | [Meeting-area report][qa-area] |
| Coverage | Front end 87.77% lines / 69.06% branches, with the core-source gates passed. Back end 94.84% lines / 85.45% branches. | [Latest][qa-latest], [meeting-area report][qa-area] |
| Native, Expo Go on an iOS simulator and an Android emulator, 16 October on `cdcc44e` | 23 case/platform outcomes: 15 PASS, 8 FAIL | [Native procedures][qa-device] |
| Production dependency audit | 0 critical; 51 high and 14 moderate findings | [Full review][qa-final] (`0df4068`) |
| Application CI on `dev` after the QA merge (`f8f91e3`) | Passed | [Run 39016450115](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/39016450115) |

**Reading these results:**

- Advisory failures and strict XFAILs are real, reproduced failures kept visible under the CI policy. Passing the required gates does not mean every product defect is fixed. The per-story findings are in §3 and the [QA matrix][qa-matrix].
- Native evidence comes from simulators and an emulator in Expo Go on an earlier revision. It does not establish physical-device or release-build acceptance. Some of its failures, such as order titles changing after a service edit, have since been fixed and pass in the API and browser regressions; the onboarding failure (D01) has not.
- Zhenyang's five supplementary confirmations (real email, password reset, provider payment and payout setup, offline recovery and Android photo-permission denial) are attributed separately and excluded from the totals.
- The [17 October issue snapshot][qa-snapshot] recorded 23 closed QA tasks and 23 open parent stories. The parent stories were closed by the team on 18 October.

QA files: [evidence index][qa-readme] · [latest report, 17 October][qa-latest] · [full review, 17 October][qa-final] · [meeting-area report, 17 October][qa-area] · [QA matrix][qa-matrix] · [test plan][qa-plan] · [native procedures][qa-device].

## 7. Known limitations and open items

| Area | Limitation or open item | Source | Follow-up |
|---|---|---|---|
| Diagnosis content | One five-question route for every Job Seeker; the client workbook's topic questions are not imported, so there is no situation-based branching. The questions and rules are the team's reading, not client-confirmed. | [Diagnosis record][doc-diagnosis]; R-06; RR-13, RR-14 | Sam's revised questions; confirm the rules before 23 October (§5). |
| Diagnosis errors | A failed first progress read leaves Home spinning; a failed retake loses its error message; Best Matches fails to render for partially visible or restricted profiles. | [QA matrix][qa-matrix] | Open advisory defects. |
| Privacy | A Job Seeker's visibility setting is stored, but no screen shows a Job Seeker's profile to anyone else. Which fields belong at "partially visible" is the team's reading, not a client decision. | [US-27–29 back end][doc-be-privacy] | Confirm the field set with the client. |
| Verification | The app cannot send a decided submission back to pending, although the back end accepts it. The rejection reason is only emailed. Moving a verified Career Professional back to pending or rejected leaves their services listed. Nothing checks that the URL matches the registered name. | [US-33/58 front end][doc-fe-review]; [US-31–33 back end][doc-be-verify]; R-02 | Undecided and out of scope on US-33; reviewer judgement for the name check. |
| Onboarding | If the onboarding read fails, the workspace opens anyway; the back end still refuses publishing until the account is verified. | [US-05 front end][doc-fe-onboarding] | Recorded failure D01. |
| Rescheduling | A session inside the 24-hour late-cancellation window can be rescheduled further out and then cancelled for a full refund. Either party can move the booking, and the other is not told. The reschedule policy (RR-17) and the approval question raised on 8 October are not recorded as decided. | [US-43/69 back end][doc-be-booking]; S02 | Agree the policy with the client. |
| Bookings | A failed read of open times in the reschedule picker reads as none; times show in the viewer's device zone, not the booking's stored timezone; a failed My sessions read shows the empty state under the error. | [US-43/69 front end][doc-fe-booking]; [US-42 front end][doc-fe-bookings] | Open findings. |
| Service changes | Deleting a service with upcoming bookings leaves those bookings in place; what should happen is undecided. Orders that existed before migrations `0011` and `0012` take the listing's values at upgrade time. | [US-36 front end][doc-fe-service]; [US-36 back end][doc-be-service] | Open; out of scope on US-36. |
| Platform Owner | Order and verification detail screens load whole lists to show one item, so an order outside the newest 200 reads as not found; there is no paging; the new single-item reads are not called yet; the admin area has no screen tests. | [US-48/71 front end][doc-fe-admin] | Switch to the single-item reads. |
| Reviews | Seed data shows ratings and counts with no review rows; rating recomputation does not lock the row; each public review includes the reviewer's opaque `jobSeekerId`; reviews show as "Yoir member"; the overall-rating rule (RR-18) is not agreed. | [US-53–55 back end][doc-be-reviews]; [US-53–55 front end][doc-fe-reviews] | Fix the seed data and locking; agree RR-18. |
| Accessibility | Web radio buttons lack a checked state and the desktop sidebar lacks a current-page marker (`DEF-REGISTER-WEB-CHECKED`, `DEF-DESKTOP-NAV-CURRENT`). | [Sprint 3 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Test-Approach) | Open advisory findings. |
| Release | No App Store or Google Play release this semester; the app is deployed as an Expo web build served by FastAPI, with no EAS build configuration yet. | R-04 | Re-assess before any store release. |
| Configuration and dependencies | Insecure defaults (R-07). Dependabot reports 35 open alerts on `main` (2 critical, 17 high, 16 moderate) as of 18 October (R-08). | R-07, R-08 | Fix before handover and list what remains in the handover. |
| Hosted services | Mailgun sandbox delivers only to authorised recipients; Stripe is in test mode and needs Connect onboarding before a Career Professional can be booked; Neon drops idle connections after about 5 minutes; FastAPI Cloud free-tier limits are unconfirmed; there is no rate limiting. | R-09 | Authorise the client's test addresses and warm up the deployment before 23 October. |
| Commercial decisions | Commission settings and `on_behalf_of` (waiting on the client's accountant), the late-cancellation refund policy and ownership of the live Stripe account. | R-03; RR-19 | Client. |
| Other open requirements | Branding approval (RR-15) and the 43-story scope with the partner team (RR-16). | [Requirements §8.2](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements#82-open) | Jared. |
| Tracking | Seven stories were estimated only at sprint close, when every sub-issue was also pointed and given its Sprint. | §2.1, §3 | Estimate every story before it enters a sprint. |

## 8. Not targeted this semester

Fifteen stories were not targeted this semester: Forum (US-14–22), order-linked messaging (US-49, US-50, US-62, US-63) and after-sales and disputes (US-51, US-52). Their priority was lower relative to their story points and the team's capacity. They stay recorded in the [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements) (RR-20) and the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog), and their issues were closed as not planned on 18 October 2026. The other items outside Sprint 3 stay deferred as listed in [Sprint 3 Planning §9](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning#9-out-of-scope-for-sprint-3).

[pr232]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232
[pr233]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/233
[pr234]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/234
[pr235]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/235
[pr236]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/236
[pr237]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/237
[pr238]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/238
[pr239]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/239
[pr240]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/240
[pr242]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/242
[pr243]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/243
[pr244]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/244
[pr246]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/246
[us05]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/8
[us09]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/81
[us10]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/78
[us11]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/80
[us12]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/79
[us13]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/76
[us27]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/22
[us28]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/23
[us29]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/82
[us31]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/25
[us32]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/26
[us33]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/27
[us36]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/31
[us42]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/37
[us43]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/38
[us48]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/45
[us53]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/52
[us54]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/53
[us55]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/54
[us58]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/28
[us69]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/40
[us70]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/12
[us71]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/77
[qa162]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/162
[qa165]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/165
[qa168]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/168
[qa171]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/171
[qa174]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/174
[qa180]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/180
[qa183]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/183
[qa186]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/186
[qa189]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/189
[qa192]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/192
[qa195]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/195
[qa198]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/198
[qa201]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/201
[qa204]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/204
[qa207]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/207
[qa210]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/210
[qa213]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/213
[qa216]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/216
[qa219]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/219
[qa222]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/222
[qa225]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/225
[qa228]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/228
[qa231]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/231
[qa-readme]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/qa/README.md
[qa-latest]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/qa/test-results-confirmation-20261017.md
[qa-final]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/qa/test-results-final-20261017.md
[qa-area]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/qa/test-results-meeting-area-20261017.md
[qa-matrix]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/qa/qa-matrix.md
[qa-plan]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/qa/test-plan.md
[qa-device]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/qa/device-acceptance.md
[qa-snapshot]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/qa/issue-snapshot-20261017.json
[doc-diagnosis]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/backend/us09-us13-yoir-diagnosis.md
[doc-fe]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/tree/dev/docs/sprint3/frontend
[doc-be]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/tree/dev/docs/sprint3/backend
[doc-fe-onboarding]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/frontend/us05-career-professional-onboarding.md
[doc-fe-review]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/frontend/us33-us58-verification-review.md
[doc-fe-service]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/frontend/us36-service-edit-and-removal.md
[doc-fe-bookings]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/frontend/us42-my-bookings.md
[doc-fe-booking]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/frontend/us43-us69-booking-detail-and-reschedule.md
[doc-fe-admin]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/frontend/us48-us71-platform-owner-oversight.md
[doc-fe-reviews]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/frontend/us53-us55-reviews-and-ratings.md
[doc-be-privacy]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/backend/us27-us29-profile-privacy.md
[doc-be-verify]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/backend/us31-us33-linkedin-verification.md
[doc-be-service]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/backend/us36-service-edit-and-removal.md
[doc-be-booking]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/backend/us43-us69-booking-detail-and-reschedule.md
[doc-be-reviews]: https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/dev/docs/sprint3/backend/us53-us55-reviews-and-ratings.md
