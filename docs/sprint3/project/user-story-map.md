<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: User Story Map
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/User-Story-Map
  Wiki commit: c5be4bb (2026-10-18)
  Exported:    2026-10-18
-->

# User Story Map

**Live board:** [CSD-Koala User Story Board (Miro)](https://miro.com/app/board/uXjVHtnlqKA=/?share_link_id=876750713477)

The user story map is the planning picture for the Yoir build. It lays the 43 active stories (153 SP, [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog)) along the user's journey through the product, shows which of them make up Sprint 2 and Sprint 3, and shows the order in which they have to be built. Every story card is a `[US-nn]` issue on the [project board](https://github.com/orgs/swen90014-2026-sm2/projects/6); the map is where we decide *what and in which order*, and the project board is where we track *status*.

The Scrum Master maintains the board. **PO clarification, 18 September 2026:** Diagnosis/Triage and direction/matching (US-09–13) were originally planned for **Sprint 3** and are its highest-priority development feature. This corrects the earlier Wiki allocation to Sprint 2; it is not delayed delivery or carry-over. See [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback). This documentation update does not move Project cards. The 27 August Miro images are historical; the corrected textual tables below state the intended allocation, while Project fields need explicit reconciliation.

## Sprint 3 development priority — confirmed 18 September

| Order | Development slice | Stories / acceptance boundary |
|---|---|---|
| 1 | Authenticated diagnosis entry, current situation, goal, prior actions, challenges and barriers, with relevant follow-up questions and saved progress | US-09–11. Use the supplied `6 step flow` and topic question bank; resolve entry-option differences, question placement and validation rules. |
| 2 | Explained Yoir Direction, suggested next steps and relevant professional/service types | US-12. Use approved answer-to-action mappings; do not invent scores, aggregation/ranking rules or an AI dependency. |
| 3 | Direction → Explore → informed selection → existing booking/test-payment/confirmation journey | US-13 with US-30/44–46 and US-40–47/68. Complete one integrated slice; profile richness, terminology and relevant design feedback are part of it. |
| 4 | Remaining Must-haves, followed by Should-haves | Retain existing scope; refine sequencing against actual capacity and test evidence. Optional additions must not displace the diagnosis slice. |

Sprint 2 captures the client feedback, clarifies content/rules and prepares acceptance criteria. Sprint 3 implements this priority slice, alongside required security, data-integrity and blocking integration fixes. Triage is **planned Sprint 3 work, not Sprint 2 carry-over**. No automatic Board reassignment or completed acceptance is implied.

The six steps are **Where are you now? → What are you trying to achieve? → What have you tried so far? → Where are you getting stuck? → Are there any barriers affecting your next step? → Your Yoir Direction**. Conditional topic questions support this flow; users are not required to answer all 59 workbook questions. Detailed criteria and remaining decisions are in [Requirements §3](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements#3-priority-diagnosistriage-and-direction-requirements).


## 1. What is on the board

| Frame | What it shows | Size |
|---|---|---|
| **Current textual story map** | The current diagnosis-to-review MVP: 8 journey activities with the Sprint 2/3 split recorded below | 43 stories / 153 SP |
| **Sprint 2 allocation** | Account/profile/service/discovery/booking foundation; triage clarification only, not implementation | 20 stories / 69 SP |
| **Sprint 3 allocation** | Diagnosis/direction first, followed by remaining operational completion | 23 stories / 84 SP |
| **Embedded Miro frames** | Historical pre-clarification map; it still shows the superseded 51-story plan until refreshed | 51 stories / 179 SP (historical) |

## 2. How to read a map frame

Each map frame has four rows. Left to right follows the user's journey; top to bottom goes from *what the user is doing* to *what we build*.

| Row | Colour | Meaning |
|---|---|---|
| **Activities** | Blue bar | A goal the user is pursuing, e.g. *3. Offer services*. The bar spans all of its steps and, on the sprint frames, shows the story points in that sprint. |
| **Steps** | Light-blue card | One thing the user does to complete the activity, e.g. *Set availability*. Each step is a column. |
| **User Stories** | Red card = **Must-have**, yellow card = **Should-have** | The `[US-nn]` stories that deliver the step, with their story-point estimate. Same ID, title and estimate as the GitHub issue. |
| **Details** | Green card | The sub-tasks the story splits into — `FE:` frontend, `BE:` backend, `QA:` acceptance tests — one card per sub-issue on the project board. |

On the full map the **red sprint line** runs across the User Stories row: everything above it is Sprint 2, everything below it is Sprint 3. Moving the line, or moving a card across it, is the visual form of re-planning; the Sprint field on the matching GitHub issue is changed at the same time.

The **LEGEND** box on the left of each frame repeats the colour key.

## 3. The backbone

The activities follow the client-confirmed primary journey: `create account → log in → complete Yoir diagnosis/triage → receive direction → browse/search professionals and services → choose slot → book → test payment → confirmation → service → review`. Forum, order-linked messaging, refunds/disputes and other deferred capabilities are outside this map.

| # | Activity | Steps → stories | Sprint 2 allocation | Sprint 3 allocation |
|---|---|---|---|---|
| 1 | **Get an account** | Register US-01 02 03 04 · Log in/out US-06 07 08 · Reset password US-70 | 01 02 03 04 06 07 08 | 70 |
| 2 | **Complete diagnosis and receive direction** | Enter triage US-09 · Complete and preserve progress US-10 11 · Receive direction US-12 · Continue to Explore US-13 | — | 09 10 11 12 13 (highest priority) |
| 3 | **Set up profiles and verification** | Career Professional onboarding US-05 · Job Seeker profile US-29 · Career Professional profile US-30 · Privacy US-27 28 · LinkedIn/manual review US-31 32 58, *US-33* | 30 | 05 27 28 29 31 32 58 *33* |
| 4 | **Offer services** | Create & price US-34 35 · Declare delivery US-37 38 · Maintain listings US-36 · Set availability US-39 | 34 35 37 38 39 | 36 |
| 5 | **Find a career professional** | Browse US-44 · Search/filter US-45 · Evaluate US-46 · Overall rating US-55 | 44 45 46 | 55 |
| 6 | **Book and pay** | Choose slot US-40 41 · Test payment US-47 · Confirm US-68 · Reschedule *US-69* | 40 41 47 68 | *69* |
| 7 | **Deliver the service** | View and open booking details US-42 43 | — | 42 43 |
| 8 | **Review and oversee** | Review US-53 54 · Oversee transactions US-48 · View platform users US-71 | — | 48 53 54 71 |

*Italic = Should-have.* Activities are journey-based, so they do not map one-to-one onto backlog Epics A–K. The Epic field on each issue is unchanged.

## 4. Full map

> **Historical visual:** this image is the 27 August 2026 pre-clarification map. Use the revised backbone and sprint tables on this page until the Miro frames are refreshed.

<img width="2704" height="1478" alt="image" src="https://github.com/user-attachments/assets/57792bea-6968-4cc0-96ef-79caa955af21" />

## 5. Sprint 2 — 31 Aug → 20 Sep 2026

**Review boundary:** planned scope below is not a completed-feature list. Triage implementation belongs to Sprint 3; Sprint 2 includes its feedback/requirements preparation only. See the [delivery/acceptance snapshot](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback#3-sprint-2-delivery-and-acceptance-snapshot). Mark delivery only after integrated acceptance review.

**20 stories / 69 SP — the account-to-booking foundation.** US-09–13 are not Sprint 2 implementation commitments. Their earlier placement here was a documentation error corrected by the PO's Sprint 3 clarification.

**Sprint goal:** a Job Seeker can register, log in, find a Career Professional's service, book an open slot, pay in test mode and see confirmation; a Career Professional can set up a profile, services and availability. Collect client feedback and prepare diagnosis requirements for Sprint 3.

| Activity | Stories | SP |
|---|---|---|
| Get an account | US-01, 02, 03, 04, 06, 07, 08 | 19 |
| Set up as a career professional | US-30 | 5 |
| Offer services | US-34, 35, 37, 38, 39 | 19 |
| Find a career professional | US-44, 45, 46 | 12 |
| Book & pay | US-40, 41, 47, 68 | 14 |

Close-out: verify actual Sprint 2 delivery against current-build evidence; Stripe code in dev is not proof of payment acceptance. Keep configured test settings distinct from client-approved policy. Preparation for Sprint 3 includes estimating US-09–13 and resolving workbook route/step mapping and test fixtures; this does not make triage a Sprint 2 implementation commitment.

> The images below are historical Sprint 2 frames. Use the corrected 20-story table above for the current documented allocation; visuals do not prove delivery.

<img width="2079" height="1923" alt="image" src="https://github.com/user-attachments/assets/e2e25283-e4a5-46a9-972e-e2f8c0cf350b" />

<img width="2927" height="1366" alt="image" src="https://github.com/user-attachments/assets/0392f6a1-bac7-460a-bd59-3320e4a5f702" />

## 6. Sprint 3 — 21 Sep → 18 Oct 2026

**First priority:** implement diagnosis/direction and connect it to relevant professional/service selection and booking. This was intended for Sprint 3 from the outset. Any genuine unfinished Sprint 2 foundation work is recorded separately, with capacity reviewed before promises are made.

**23 stories / 84 SP — diagnosis/direction first, then operational completion and handover.** US-33 and US-69 remain the only Should-haves and are the first candidates to defer if capacity is short. The corrected allocation changes neither the 43-story product total nor existing estimates. The seven estimates that were TBD (US-09–13, US-29 and US-71, 24 SP) were set at the close of Sprint 3 on 18 October 2026.

**Updated sprint goal:** finish the integrated Yoir diagnosis → direction → relevant professional/service → booking journey first, then complete remaining profile, verification, operations, oversight and review capabilities within reviewed capacity, with integration and handover evidence.

| Activity | Stories | SP |
|---|---|---|
| Complete diagnosis and receive direction (first priority) | US-09, 10, 11, 12, 13 | 19 |
| Get an account | US-70 | 5 |
| Set up profiles and verification | US-05, 27, 28, 29, 31, 32, 33, 58 | 28 |
| Offer services | US-36 | 3 |
| Find a career professional | US-55 | 4 |
| Book & pay | US-69 | 5 |
| Deliver the service | US-42, 43 | 7 |
| Review and transaction oversight | US-48, 53, 54 | 11 |
| Platform Owner user oversight | US-71 | 2 |

Planning decisions: estimate US-09–13, US-29 and US-71; settle triage entry/routing, multi-answer direction rules and matching taxonomy first. Agree rescheduling policy (US-69), rating formula (US-55) and minimum user-oversight fields (US-71) when scheduling those stories. LinkedIn verification remains URL submission plus manual review; automated integration is not required.

> The two images below are the historical 31-story Sprint 3 frame and dependency frame. The corrected 23-story table and diagnosis-first order above are the current textual plan.

<img width="2448" height="1633" alt="image" src="https://github.com/user-attachments/assets/c7ab5ef6-0b07-4a70-ac55-992fb644a89c" />

<img width="2203" height="1815" alt="image" src="https://github.com/user-attachments/assets/74e6f395-ff51-47a3-8abe-78ed7b6aca31" />

## 7. Dependencies frames

The dependency frames answer *what has to exist before this story can be demonstrated*.

- Columns are **build order**: a story in column *n* depends on at least one story in column *n − 1* and on nothing further right. Column 1 stories have no prerequisites.
- An **arrow** points from the prerequisite to the story it unblocks.
- Only **direct** dependencies are drawn — if A → B → C, the A → C arrow is left out.
- **Logging in is a prerequisite for almost everything**, so the arrows from US-01 → US-06 to every authenticated story are omitted rather than drawn 40 times. The Sprint 3 frame also omits prerequisites that Sprint 2 delivers.
- Yellow cards are Should-haves; nothing Must-have depends on a Should-have.

The dependency images below are the 27 August pre-clarification snapshot. Current dependencies are recorded on GitHub as *Blocked by* entries on the active issues; deferred stories must not be treated as prerequisites for the revised 43-story plan.

![Full dependency map](images/user-story-map-full-dependencies.png)

## 8. Traceability

| On the board | On GitHub | Source of truth |
|---|---|---|
| Story card `US-47 · Complete a platform-supervised test purchase · 5 SP` | Issue `[US-47] Complete a platform-supervised test purchase`, Story Points = 5, Priority = Must-have | Product Backlog §3 |
| Green card `US-47 BE: Order/transaction models, payment boundary…` | Sub-issue `[US-47] BE: …` under the story | Issue body, *Sub-tasks* |
| Card position above / below the sprint line | Sprint field = Sprint 2 / Sprint 3 | Sprint planning |
| Arrow A → B on a dependency frame | *Blocked by* link on issue B | Issue body, *Dependencies* |

If a card and its issue disagree, the issue is corrected to match the baseline and the card is updated at the next refresh.

## 9. Maintaining the board

- **Sprint planning:** re-slice by moving the sprint line or individual cards; update the Sprint field on the issues; prune the dependency arrows that turned out not to matter.
- **Sprint review:** mark delivered stories on the board (Miro tag or ✅ in the card text) so the client sees progress against the map.
- **Baseline change:** a story added, removed or re-estimated in the Product Backlog is mirrored on the story map *and* on the project board in the same change, so the three never drift.
- **Refreshing this page:** in Miro select a frame → right-click → **Export as image** (or *Export* → *Save as image*) → replace the file in `images/` and note the date below.

Sprint allocation corrected and priority confirmed by the PO: **18 September 2026**. This supersedes the 2 September table's incorrect Sprint 2 placement of US-09–13. Embedded screenshots: **27 August 2026**, historical. Project iteration dates also differ from the Wiki schedule; Manu must reconcile them with the official timetable and correct triage fields to Sprint 3. No Project fields were changed by this documentation update.
