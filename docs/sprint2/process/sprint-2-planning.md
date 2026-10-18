<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Sprint 2 Planning
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Planning
  Wiki commit: d6cf91f (2026-10-08)
  Exported:    2026-10-08
-->

# Sprint 2 Planning

**Sprint:** 2 of 3 · **Board iteration:** 31 August – 20 September 2026 (21 days) · **Scrum Master:** Manushresth Krishnan · **Product Owner:** Wei Chen Cheng (Jared)

This page records the Sprint 2 plan: the goal, the committed stories and who owned them, the rules that gated the work, the risks the team planned around, and how the plan changed during the sprint. The team did not minute a separate planning session, so the plan is taken from the records that hold it: the project board, the [User Story Map](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/User-Story-Map), the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog), the [Daily Standups](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups), the [Mentor Communication Log](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Mentor-Communication-Log) and the [Client meeting minutes](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes). It was written on 19 September 2026. What was accepted is recorded separately in the [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback); this page does not claim acceptance.

---

## 1. Sprint goal

> A Job Seeker can register, log in, find a Career Professional's service, book an open slot, pay in test mode and see confirmation; a Career Professional can set up a profile, services and availability. Collect client feedback and prepare diagnosis requirements for Sprint 3.

The goal is the account-to-booking foundation of the MVP. The Yoir Diagnosis (US-09–13) was **not** a Sprint 2 implementation commitment: Sprint 2 was to collect the client's feedback and prepare its requirements, and the Product Owner confirmed on 18 September that it is the first priority of Sprint 3. Its front-end is already in progress (see §8).

## 2. Inputs carried in from Sprint 1

| Input | Where it was agreed | What it meant for Sprint 2 |
|---|---|---|
| Stack locked: React Native with Expo, FastAPI, PostgreSQL | Stand-up, 26 Aug | One Expo codebase for iOS, Android and the web build |
| A mobile app, not a web application | Supervisor meeting, 27 Aug | Ariz reworked the screens for mobile before Sprint 2 implementation |
| Backlog reviewed and acceptance criteria refined | Stand-up, 26 Aug (Jared, Zhenyang) | Stories entered the sprint with testable acceptance criteria |
| Acceptance tests prepared for Sprint 2 | Stand-up, 26 Aug (Zhenyang) | QA could start from the criteria, not from finished code |
| Stripe test mode for payments | Stand-up, 26 Aug | Lowered the payment risk; no real money in Sprint 2 |
| LinkedIn URL plus manual Platform Owner review | Client decision `CLIENT-01` | No LinkedIn API integration |

## 3. Committed scope — 20 stories, 69 story points

All 20 stories are Must-haves. Points follow the sizing guide in [Process Documentation and Insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights#3-estimation) (about 1 SP ≈ half a day, 5 SP ≈ two to three days). Owners are the assignees of each story's front-end, back-end and QA sub-issues on the board.

| Journey activity | Story | SP | Front-end | Back-end | QA |
|---|---|---|---|---|---|
| Get an account | [US-01](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/4) Register as a Job Seeker | 3 | Ariz | Jared | Zhenyang |
| | [US-02](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/5) Create a valid Job Seeker account securely | 3 | Ariz | Jared | Zhenyang |
| | [US-03](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/6) Receive a useful duplicate-email error | 2 | Ariz | Jared | Zhenyang |
| | [US-04](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/7) Register as a Career Counsellor | 3 | James | Jashan | Zhenyang |
| | [US-06](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/9) Log in and reach role-appropriate functions | 4 | Ariz | Jared | Zhenyang |
| | [US-07](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/10) Receive safe feedback for failed login | 2 | Ariz | Jared | Zhenyang |
| | [US-08](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/11) Log out securely | 2 | Ariz | Jared | Zhenyang |
| Set up as a Career Professional | [US-30](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/24) Maintain a professional counsellor profile | 5 | James | Evelyn | Zhenyang |
| Offer services | [US-34](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/29) Create a counsellor service | 5 | James | Evelyn | Zhenyang |
| | [US-35](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/30) Describe and price a service | 4 | James | Evelyn | Zhenyang |
| | [US-37](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/32) Declare how a service is delivered | 2 | James | Evelyn | Zhenyang |
| | [US-38](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/33) Provide an area for in-person delivery | 3 | James | Evelyn | Zhenyang |
| | [US-39](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/34) Manage counsellor availability | 5 | James | Evelyn | Zhenyang |
| Find a Career Professional | [US-44](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/41) Browse counsellors and services | 4 | Ariz | Evelyn | Zhenyang |
| | [US-45](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/42) Find relevant services efficiently | 4 | Ariz | Evelyn | Zhenyang |
| | [US-46](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/43) Evaluate a service before purchase | 4 | Manu | Evelyn | Zhenyang |
| Book and pay | [US-40](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/35) Select only an open booking slot | 3 | Manu | Evelyn | Zhenyang |
| | [US-41](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/36) Prevent double-booking | 3 | Manu | Evelyn | Zhenyang |
| | [US-47](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/44) Complete a platform-supervised test purchase | 5 | Manu | Jashan | Zhenyang |
| | [US-68](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/39) Receive a clear booking confirmation | 3 | Manu | Jashan¹ | Zhenyang |
| **Total** | **20 stories** | **69** | | | |

¹ Assigned to Jashan at the 9 September stand-up; the back-end sub-issue has no assignee on the board.

| Activity | Stories | SP |
|---|---|---|
| Get an account | 7 | 19 |
| Set up as a Career Professional | 1 | 5 |
| Offer services | 5 | 19 |
| Find a Career Professional | 3 | 12 |
| Book and pay | 4 | 14 |

**Out of scope for Sprint 2:** the Yoir Diagnosis and matching (US-09–13, Sprint 3), messaging, reviews and ratings, disputes and refunds, and production concerns such as analytics and observability (proposed as out of the MVP at the 9 September stand-up).

## 4. Team and capacity

| Member | Role | Sprint 2 focus |
|---|---|---|
| Manu | Scrum Master | Board and process; front-end for slot selection, service evaluation, checkout and confirmation |
| Jared | Product Owner | Backlog and client communication; back-end for registration, login and logout (US-01–03, 06–08) |
| Ariz | Front-end | Onboarding, registration, login and logout screens; Explore browse, search and filters |
| James | Front-end | Career Professional registration and workspace: profile, services and availability |
| Evelyn | Back-end | Services, availability, discovery and booking back-end (US-30–46) |
| Jashan | Back-end | Career Professional registration, payments, email and deployment |
| Zhenyang | QA Lead | Acceptance tests and evidence for every story, across web, API, iOS and Android |

Seven members over a 21-day iteration, with weekly stand-ups, weekly supervisor meetings and a client demonstration planned before the sprint closed.

## 5. How work was gated

Every story used the Product Owner's Definition of Ready and Definition of Done, reproduced in [Process Documentation and Insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights#5-definition-of-ready-and-definition-of-done). In short: a story entered the sprint with agreed acceptance criteria, a shared story ID for front-end and back-end, and understood dependencies and error states; it was done only when its criteria passed at every level, it was reviewed, merged, demonstrated and deployed to the test environment.

Each story was split into three sub-issues — Front-end, Back-end and QA — so the three disciplines could move independently and be checked separately. Work flowed Product Backlog → Sprint Backlog → In Progress → Under Review → the Sprint 2 column. All code went to `dev` first, the integration branch; `main` changes only after client and QA sign-off (agreed 9 September).

## 6. Risks and dependencies planned around

| Risk or dependency | Plan | Source |
|---|---|---|
| Payment provider (Stripe) | Test mode only; production is a configuration change | Stand-up 26 Aug; [Risk Register](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Risk-Register) |
| LinkedIn cannot verify a professional | URL plus manual Platform Owner review (`CLIENT-01`) | Risk Register R-01, R-02 |
| App store rules for in-app purchases | Test purchases only in Sprint 2 | Risk Register R-04 |
| Front-end waits on back-end endpoints | Shared contract (`openapi.yaml`) and the same story IDs on both sides | Definition of Ready |
| Merge conflicts on `dev` | Pull the latest `dev` before new work; reviewers on every pull request; consistent branch names | Stand-up 9 Sep |
| Deployed database drops idle connections | Jashan to fix the serverless Postgres drop after about five minutes | Stand-up 9 Sep |
| Client's triage questions not yet answered | Keep triage out of Sprint 2; move it to Sprint 3 if answers are late | Stand-up 16 Sep |

## 7. How the plan changed during the sprint

| Date | Record | Change or decision |
|---|---|---|
| 31 Aug | Board | Sprint 2 iteration opened with the 20 stories above. |
| 8 Sep | PR [#148](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/148) | Career Professional workspace (James) merged into `dev`. |
| 9 Sep | Stand-up | Front-end nearly complete; Ariz finished onboarding, rebranding and Explore browse. Jashan deployed the app and database to FastAPI Cloud (PR [#149](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/149)). **Re-plan:** Jashan took US-47 payments, US-68 and email; Jared kept US-06–08. Client demonstration scheduled; MVP scope proposed. Registration back-end merged (PR [#151](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/151)). |
| 10 Sep | Supervisor meeting | Progress reported to Erfan, who confirmed the reuse plan belongs in the design concept (Manu added it by 17 Sep). SMTP and the Sprint 2 documentation flagged as outstanding. |
| 12 Sep | PR [#153](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/153) | Login, safe errors and logout back-end merged. |
| 14 Sep | PRs [#152](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/152), [#154](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/154) | Service and availability back-end (Evelyn); editing and deleting services and bulk availability on the front-end. |
| 15 Sep | Client meeting | Job Seeker and Career Professional flows demonstrated to Sam. |
| 16 Sep | Stand-up | Most tasks complete; focus moved to documentation. Triage questions still pending from the client, so triage may move to Sprint 3. Overlapping-slot bug found. |
| 17 Sep | Supervisor meeting; client email | Client asked for triage questions customised per user. Team to compare matching approaches by cost and effort. The client's written feedback asked for Career Professional terminology, richer profiles, closer branding and the diagnosis at the centre of the journey. |
| 18 Sep | Product Owner; PRs [#155](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/155), [#156](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/156), [#157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157), [#159](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/159) | Triage confirmed as Sprint 3's first priority. Merged: multi-platform QA evidence; payments, transactional email, the admin panel and My sessions; the admin dashboard; and the job seeker navigation with a first diagnosis slice and the client's feedback applied. Triage stories split into front-end, back-end and QA sub-issues (#160–#174). |

## 8. Work that landed beyond the committed stories

These arrived in Sprint 2 alongside the committed scope. They are not claimed as Sprint 2 commitments:

- Deployment of the API and web build to FastAPI Cloud, with a deploy pipeline (#149).
- Stripe payments, payouts, transactional email, the Platform Owner admin panel and My sessions (#157, #159).
- The Yoir Diagnosis (US-09–13, Sprint 3 work): a first front-end slice reached `dev` early, and its front-end is in progress (sub-issues #160, #163, #166, #169 and #172). The back-end has not started.
- The Job Seeker profile, richer Career Professional profiles, a notifications dropdown awaiting its backend, and the client's terminology and branding changes (#156).

## 9. Close-out and handover to Sprint 3

- **Board:** all 20 stories and their sub-issues sit in the Sprint 2 column. Per-story acceptance evidence and open gaps are in the [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback), the [Sprint 2 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Test-Approach), and the per-story [frontend](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/tree/dev/docs/sprint2/frontend) and [backend](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/tree/dev/docs/sprint2/backend) documentation.
- **Carried into Sprint 3:** estimate US-09–13 and build the diagnosis-to-booking slice first; import the client's question workbook; fix the overlapping-slot bug; confirm with the client whether payouts run through Stripe or manually.
- **Board, 19 September:** US-09–13 moved to the Sprint 3 iteration; their front-end sub-issues are In Progress. The Sprint field's dates now match the schedule: Sprint 2 ends 20 September and Sprint 3 runs 21 September – 18 October.
- **Sprint 2 retrospective:** held on 7 October 2026 and recorded in [Sprint 2 Retrospective](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Retrospective).
