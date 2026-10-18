<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Sprint 3 Planning
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning
  Wiki commit: 8fa8c88 (2026-10-18)
  Exported:    2026-10-08
-->

# Sprint 3 Planning

**Sprint:** 3 of 3 · **Board iteration:** 21 September – 18 October 2026 (28 days) · **Planning meeting:** 7 October 2026, straight after the [Sprint 2 Retrospective](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Retrospective) · **Scrum Master:** Manushresth Krishnan · **Product Owner:** Wei Chen Cheng (Jared)

**Attendees:** Ariz, Evelyn, James, Jared, Jashan, Manu, Zhenyang

The Sprint 3 iteration opened on 21 September with its 23 stories already on the board, and work on the diagnosis front end had started in Sprint 2. At this meeting the team confirmed the sprint goal and checked the remaining scope against the 11 days left. It also set the order of work, named owners for unowned work and agreed what the client receives at handover. The retrospective that came first is in [Sprint 2 Retrospective](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Retrospective); its actions shape §6 and §8.

---

## 1. Sprint goal

> A Job Seeker completes the Yoir Diagnosis, receives an explained direction and continues to relevant Career Professionals and booking. Career Professionals are verified and manage their bookings, the Platform Owner oversees verification, orders and users, and buyers can review a completed session. The sprint ends with a tagged, tested and documented build handed over to the client.

The first half of the goal is the Product Owner's 18 September priority: the diagnosis-to-booking slice comes first ([Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements), RR-09). The rest completes the Must-haves in the active backlog.

## 2. Where Sprint 3 stood at the meeting

| Item | State on 7 October |
|---|---|
| Days left | 11 of 28 (sprint ends 18 October) |
| Merged into `dev` since 21 September | PR [#232](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232) (5 Oct): diagnosis, verification and Platform Owner front end · US-05 first-login onboarding (6 Oct) · PR [#234](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/234) (7 Oct): privacy settings, service edit and reviews front end · US-29 Job Seeker profile tests (7 Oct) · US-42 My Bookings with pre-session brief and timezone label (7 Oct) |
| Open pull request | [#233](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/233): diagnosis persistence and validation back end for US-09–11 (Jared) |
| Front end | Sub-issues for 20 of the 23 stories are Under Review; US-43, US-69 and US-70 are In Progress |
| Back end | Started for 4 stories (US-31, US-32, US-33, US-36, all Evelyn), plus #233. The other back-end sub-issues have not started, and 10 have no owner |
| QA | Diagnosis QA (US-09–13) has an owner; 18 QA sub-issues have no owner |

**The main finding:** the front end is well ahead of the back end. Most stories are waiting for their endpoints, so the plan below puts back-end work and integration first.

## 3. Scope — 23 stories

Priority order is the order of work. Points follow the sizing guide in [Process Documentation and Insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights#3-estimation). Owners are the assignees of each story's front-end, back-end and QA sub-issues; "to assign" marks the ones action A1 and A2 fill.

| Order | Story | SP | Priority | Front end | Back end | QA |
|---|---|---|---|---|---|---|
| **1. Diagnosis to booking** | [US-09](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/81) Enter the Yoir diagnosis journey | TBD | Must | Manu | Jared | Zhenyang |
| | [US-10](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/78) Complete the six-step Yoir triage | TBD | Must | Manu | Jared | Zhenyang |
| | [US-11](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/80) Progress through triage safely | TBD | Must | Manu | Jared | Zhenyang |
| | [US-12](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/79) Receive relevant direction or matching | TBD | Must | Manu | To assign | Zhenyang |
| | [US-13](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/76) Continue from diagnosis to Explore | TBD | Must | Manu | To assign | Zhenyang |
| **2. Verification and trust** | [US-31](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/25) Submit a LinkedIn profile for verification | 4 | Must | Manu | Evelyn | To assign |
| | [US-32](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/26) See the verification result | 3 | Must | Manu | Evelyn | To assign |
| | [US-58](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/28) Review verification as a Platform Owner | 4 | Must | Manu | Jashan | To assign |
| | [US-70](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/12) Reset a forgotten password securely | 5 | Must | Ariz | Jashan | To assign |
| | [US-27](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/22) Control profile visibility | 4 | Must | James | To assign | To assign |
| | [US-28](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/23) Have privacy settings enforced | 2 | Must | James | To assign | To assign |
| **3. Accounts and profiles** | [US-05](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/8) First-login Career Professional onboarding | 4 | Must | Ariz | To assign | To assign |
| | [US-29](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/82) Maintain a Job Seeker profile | TBD | Must | Ariz | To assign | To assign |
| **4. Services and bookings** | [US-36](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/31) Edit or remove future service offerings | 3 | Must | James | Evelyn | To assign |
| | [US-42](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/37) View upcoming and past bookings | 4 | Must | Ariz | Jashan | To assign |
| | [US-43](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/38) Open a booking's working details | 3 | Must | Ariz | To assign | To assign |
| **5. Platform Owner oversight** | [US-48](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/45) Inspect transaction progress | 4 | Must | Manu | Jashan | To assign |
| | [US-71](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/77) View platform users | TBD | Must | Manu | Jashan | To assign |
| **6. Reviews and ratings** | [US-53](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/52) Review a completed purchased service | 4 | Must | James | Jashan | To assign |
| | [US-54](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/53) See updated service-level feedback | 3 | Must | James | To assign | To assign |
| | [US-55](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/54) Judge a Career Professional's overall quality | 4 | Must | James | To assign | To assign |
| **7. Should-haves, last** | [US-33](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/27) Receive the outcome of an additional investigation | 4 | Should | Manu | Evelyn | To assign |
| | [US-69](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/40) Reschedule an upcoming booking safely | 5 | Should | Ariz | To assign | To assign |
| **Total** | **23 stories** | **60 + 7 TBD** | 21 Must, 2 Should | | | |

| Group | Stories | Known SP |
|---|---|---:|
| Diagnosis to booking | 5 | TBD |
| Verification and trust | 6 | 22 |
| Accounts and profiles | 2 | 4 + TBD |
| Services and bookings | 3 | 10 |
| Platform Owner oversight | 2 | 4 + TBD |
| Reviews and ratings | 3 | 11 |
| Should-haves | 2 | 9 |

**If time runs short,** the two Should-haves (US-33, US-69) are dropped first. They are not traded for a Must-have. Nothing outside the active backlog is added in Sprint 3.

## 4. Estimates still to agree

US-09–13, US-29 and US-71 have no story points. The team will estimate them with the sizing guide (action A3) and not report a sprint total that includes them until then. Until they are agreed, Sprint 3 is 60 known SP plus seven unestimated stories ([Requirements §7](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements)).

## 5. Team and focus

| Member | Role | Sprint 3 focus |
|---|---|---|
| Manu | Scrum Master | Board, minutes and wiki; front end for the diagnosis (US-09–13), verification (US-31–33, US-58) and Platform Owner oversight (US-48, US-71); handover documentation |
| Jared | Product Owner | Diagnosis back end (US-09–11, PR #233); the open requirement questions with the client (RR-13–RR-19); client demonstration and handover |
| Ariz | Front end | Onboarding (US-05), Job Seeker profile (US-29), bookings (US-42, US-43), reschedule (US-69) and password reset (US-70) |
| James | Front end | Privacy (US-27, US-28), service edit (US-36) and reviews and ratings (US-53–55) |
| Evelyn | Back end | Verification (US-31–33) and service edit (US-36); design concept and schema documents |
| Jashan | Back end | Bookings list (US-42), order and user oversight (US-48, US-71), reviews (US-53), verification decisions (US-58) and password reset (US-70); deployment |
| Zhenyang | QA Lead | Acceptance evidence for every Sprint 3 story; one current test-results page tied to the Sprint 3 tag |

Jashan holds six back-end sub-issues and ten have no owner, so action A1 spreads the back-end work before anyone starts on a new story.

## 6. How work is gated

The [Definition of Ready and Definition of Done](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights#5-definition-of-ready-and-definition-of-done) from Sprint 2 still apply. The retrospective added three rules:

- **A story closes when it is done.** Its front-end, back-end and QA sub-issues are all done and its acceptance is recorded. Then the story issue itself is closed, so the burndown moves.
- **Every sub-issue has points, an owner and the Sprint 3 iteration.**
- **Cards move when the work moves,** at the latest at the next stand-up, never in a bulk update at the end.

Code still goes to `dev` first, and `main` changes only after client and QA sign-off. Every pull request has a reviewer, comes from a freshly pulled `dev` and lands with its tests. Application CI must pass on `dev` after each merge.

## 7. Risks and dependencies

| Risk or dependency | Plan |
|---|---|
| The back end is behind the front end | Back-end work for stories whose front end is Under Review goes first. Front ends already follow `openapi.yaml`, so integration is wiring, not redesign. Owners for the unowned sub-issues are set by 9 October (A1). |
| Diagnosis rules are not fully agreed with the client (RR-13, RR-14) | US-12 and US-13 are built against PO-approved fixtures taken from the client's workbook, with the rule version recorded. The client confirms or corrects them at the demonstration (A6). |
| Integration bunches up at the end of the sprint again | Small pull requests merged as they finish. The aim is no feature merged after 16 October except fixes. |
| Late client feedback | Demonstrate the diagnosis-to-booking slice to the client before the sprint closes (A6). |
| CI failures blocking `dev` | Run Ruff, type checks and the affected tests locally before pushing; fix a red `dev` before starting new work. A Ruff line-length failure on 7 October was fixed the same day. |
| Handover by 18 October | Tag the Sprint 3 build, record the CI run on the tag, and bring the README, design concept, schema and traceability documents in line with the build (A8–A10). |

## 8. Actions

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| A1 | Assign the 10 back-end sub-issues without an owner: US-05, US-12, US-13, US-27, US-28, US-29, US-43, US-54, US-55, US-69 | Jared with Evelyn and Jashan | 9 Oct | Closed |
| A2 | Assign the 18 QA sub-issues, point every sub-issue and set the Sprint 3 iteration on every Sprint 3 item | Manu, Zhenyang | 9 Oct | Closed |
| A3 | Estimate US-09–13, US-29 and US-71 | Jared with the developers | 9 Oct | Closed |
| A4 | Review and merge PR #233, the diagnosis persistence back end | Jared, with a back-end reviewer | 10 Oct | Closed |
| A5 | Agree the diagnosis entry options and rules with the client (RR-13, RR-14) and give the team approved fixtures for US-12 and US-13 | Jared | 11 Oct | Closed |
| A6 | Book a client demonstration of the diagnosis-to-booking slice before the sprint closes | Jared | 10 Oct | Closed |
| A7 | Merge the back end for every story whose front end is Under Review, and close each story once its QA evidence is recorded | Evelyn, Jashan, Zhenyang | 16 Oct | Closed |
| A8 | Update the design concept diagram, the schema document and the reuse-plan status column to match the build | Evelyn, Jashan | 16 Oct | Closed |
| A9 | Add an implementation-status column to the interface traceability file, and make the README's operation count match `openapi.yaml` | Manu | 16 Oct | Closed |
| A10 | Tag the Sprint 3 build, record the CI run on the tag, keep one current test-results page and move older reports into an archive | Zhenyang, Manu | 18 Oct | Closed |
| A11 | Minute every Sprint 3 meeting on the day, and hold the Sprint 3 retrospective before the sprint closes | Manu | Ongoing; retrospective by 18 Oct | Closed |

## 9. Out of scope for Sprint 3

Forum, order-linked messaging, disputes and automated refunds, live payouts, the notifications back end (US-60, US-61), App Store and Google Play release, a multilingual interface and advanced AI features. These stay deferred as recorded in the [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements) and the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog).
