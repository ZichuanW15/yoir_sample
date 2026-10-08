<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Sprint 2 Retrospective
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Retrospective
  Wiki commit: d6cf91f (2026-10-08)
  Exported:    2026-10-08
-->

# Sprint 2 Retrospective

**Sprint reviewed:** Sprint 2, 31 August – 20 September 2026 · **Meeting:** 7 October 2026, held before [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning) · **Facilitator:** Manushresth Krishnan (Scrum Master) · **Product Owner:** Wei Chen Cheng (Jared)

**Attendees:** Ariz, Evelyn, James, Jared, Jashan, Manu, Zhenyang

The team looked back at Sprint 2 to agree what to keep, what to change and who owns each change. The inputs were the [Sprint 2 insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights#8-sprint-2-insights), the [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback), the [Sprint 2 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Planning) record and the project board. The retrospective was held two and a half weeks after Sprint 2 closed. That delay is itself one of the points below.

---

## 1. Sprint 2 at a glance

| Measure | Result |
|---|---|
| Committed | 20 stories, 69 SP, all Must-haves |
| On the board at close | All 20 stories and their sub-issues in the Sprint 2 column; none of the 20 story issues closed |
| Pull requests merged into `dev` | 11, five of them on 18 September |
| Deployment | `dev` deployed to FastAPI Cloud on every merge from 9 September |
| Client | Demonstration on 15 September; written feedback on 17 September; feedback applied on 18 September |
| Release | Tag `SWEN90014_MSEP_2026S2_CSD-Koala_Sprint2_20260920`; Application CI passed on the tagged commit ([run 35484438293](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/35484438293), 20 Sep) |
| Meetings minuted | Two stand-ups, two supervisor meetings and one client meeting |

## 2. What went well

| # | What went well | Evidence |
|---|---|---|
| W1 | The whole account-to-booking journey works end to end: register, log in, browse Explore, open a service, pick a slot, pay in Stripe test mode and get a confirmation email. A Platform Owner admin panel and My sessions came with it. | PRs #151, #153, #157, #159; client walkthrough on 15 Sep |
| W2 | External boundaries are real. Payments go through one Stripe gateway module with a labelled stub when no keys are set. Email goes through Mailgun with a logging fallback, and Alembic manages the database migrations. | `backend/app/payments`, `backend/app/mail`, `backend/migrations` |
| W3 | Double-booking is prevented by locking the Career Professional's row while a booking is made. A PostgreSQL test with concurrent requests proves that only one succeeds. | `backend/app/routers/bookings.py`; `test_postgresql_concurrent_order_requests_reserve_slot_once` in `backend/tests/test_api.py` |
| W4 | Deploying `dev` on every merge made integration testing and client demonstrations easy, and it exposed an environment issue early: the serverless database dropped idle connections. | Deploy pipeline, 9–10 Sep |
| W5 | Re-planning at the stand-up worked. On 9 September payments (US-47), confirmation (US-68) and email moved to Jashan mid-sprint instead of waiting for the next sprint. | [Daily Standups](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups), 9 Sep |
| W6 | Splitting each story into Front-end, Back-end and QA sub-issues let the three disciplines move on their own and be checked separately. | Board |
| W7 | The client's feedback was recorded with its sources and applied within a day: Career Professional wording, Explore, richer profiles, closer branding and the first diagnosis screens. | [Sprint 2 Review](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback), [Feedback Implemented](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Client-Feedback-Response) |
| W8 | Testing is repeatable. CI runs lint, type checks, the backend suite on PostgreSQL, live API journeys, Chromium acceptance and iOS and Android component suites. Known defects stay visible as strict expected failures. | [Sprint 2 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Test-Approach); Application CI |

## 3. What did not go well

| # | What did not go well | Evidence | Effect |
|---|---|---|---|
| D1 | Integration bunched up at the end of the sprint. | 5 of 11 pull requests merged on 18 Sep; Application CI failed on four `dev` commits that day | A day of fixing CI instead of finishing, and little time to test the integrated build |
| D2 | The board was updated in bulk, after the work. | The sub-issue burndown drops between 15 and 18 Sep, after the main merges on 8, 9, 12 and 14 Sep | The board did not show real progress during the sprint |
| D3 | Stories were never closed, so the burndown never moved. | 20 stories open in the Sprint 2 column; Board Insights burndown flat at 69 SP | The chart said nothing was done |
| D4 | There was no rule for when a story counts as done if one part lags. | 16 Sep stand-up: front-end QA complete, back end not | Stories sat between columns |
| D5 | Sub-issues had no points and many items had no iteration. | Board Insights at close: 90 unpointed issues and 76 sprint-flow items without a Sprint iteration | Task-level effort and progress could not be measured |
| D6 | Client feedback came at the very end of the sprint. | Demonstration 15 Sep, written feedback 17 Sep | Feedback was absorbed on the last day instead of being planned |
| D7 | Scope records drifted when scope moved. | The wiki placed US-09–13 in Sprint 2 until 18 Sep; the board's Sprint field until 19 Sep | The plan, the board and the wiki disagreed |
| D8 | Meetings were not minuted consistently. | Nothing recorded for the first week; no planning meeting minuted; this retrospective held late; most actions in the minutes still Open, including Sprint 1 actions | Decisions and follow-ups were hard to trace |
| D9 | Documents fell behind the build. | The design concept diagram still said Sprint 1; the reuse plan listed built components as planned; the repository copy of the requirements still had the 48-story baseline; the README's operation count did not match `openapi.yaml`; the test results did not name the tagged commit | The documents described an older system than the one delivered |
| D10 | The AI usage log agreed on 26 August was never created, although its action was marked Closed. | [Daily Standups](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups), 26 Aug | AI use was not traceable |
| D11 | Branch names and pull-request practice stayed uneven. | Several branch-name patterns in Sprint 2 despite the 9 Sep agreement | Harder to link branches to stories |

## 4. What we will change

| # | Action | Addresses | Owner | Due | Status |
|---|---|---|---|---|---|
| R1 | Agree and apply the closure rule: a story closes when its front-end, back-end and QA sub-issues are done and its acceptance is recorded. Close the Sprint 2 stories that meet it; record any that do not as carry-over with a reason. | D3, D4 | Jared, Manu | 10 Oct | Open |
| R2 | Point every sub-issue, set the Sprint iteration on every sprint item and move cards when the work moves, not in a bulk update. | D2, D5 | Manu for the board; everyone for their own cards | 9 Oct, then ongoing | Open |
| R3 | Merge small pull requests as each part finishes, each with its tests. Pull `dev` first, name branches `feature/US-xx-short-name` and add a reviewer to every pull request. | D1, D11 | All developers | Ongoing | Open |
| R4 | Minute every meeting on the day, including planning and retrospectives. Go through the open Sprint 1 and Sprint 2 actions and close or carry each one with a date. | D8 | Manu | 10 Oct | Open |
| R5 | Demonstrate to the client before the sprint closes so feedback can still be acted on. | D6 | Jared | Before 18 Oct | Open |
| R6 | When scope moves, update the board, the User Story Map and the Requirements together, on the same day. | D7 | Jared, Manu | Ongoing | Open |
| R7 | Bring the documents in line with the build: requirements (repository copy and resolution record), design concept and schema, reuse-plan status, traceability status and test results tied to the tag. | D9 | Manu (requirements, traceability); Evelyn and Jashan (design, schema); Zhenyang (test results) | 16 Oct | Open |
| R8 | Create the [AI Usage Log](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/AI-Usage-Log) and record each use of an AI tool there. | D10 | Manu | 8 Oct | Open |
| R9 | Track environment issues, such as the database connection drops, on the board like any other defect. | W4 | Jashan | Ongoing | Open |
| R10 | Hold the Sprint 3 retrospective before the sprint closes, not after. | D8 | Manu | By 18 Oct | Open |

## 5. Keep doing

- Re-plan at the weekly stand-up and record the change on the board the same day (W5).
- Keep `dev` deployed on every merge (W4).
- Keep the Front-end, Back-end and QA split, now with the closure rule in R1 (W6).
- Record client feedback with its source and map it to stories before changing anything (W7).

## 6. Follow-up

Progress on these actions is checked at each Sprint 3 stand-up and closed out at the Sprint 3 retrospective. Sprint 3 actions that depend on them are in [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning#8-actions).
