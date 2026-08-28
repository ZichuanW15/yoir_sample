# User Story Map

**Live board:** [CSD-Koala User Story Board (Miro)](https://miro.com/app/board/uXjVHtnlqKA=/?share_link_id=876750713477)

The user story map is the planning picture for the Yoir build. It lays the 51 baselined stories (179 SP, [`backlog.md`](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Baselined-Requirements/blob/main/backlog.md)) along the user's journey through the product, shows which of them make up Sprint 2 and Sprint 3, and shows the order in which they have to be built. Every story card on the board is a `[US-nn]` issue on the [project board](https://github.com/orgs/swen90014-2026-sm2/projects/6); the map is where we decide *what and in which order*, the project board is where we track *status*.

The Scrum Master maintains the board. This document is the text record of the map; the live Miro board carries the visual frames and is authoritative between updates.


## 1. What is on the board

| Frame | What it shows | Size |
|---|---|---|
| **Yoir – User Story Map** | The whole product: 8 activities → 26 steps → 51 stories → 163 sub-task cards, with the red **sprint line** separating Sprint 2 (above) from Sprint 3 (below) | 51 stories / 179 SP |
| **Yoir – Story dependencies** | Build-order view of all 51 stories with 58 direct-dependency arrows | 8 columns |
| **Yoir – Sprint 2 User Story Map** | Only the Sprint 2 slice, with the sprint goal, points per activity and the open client decisions that affect it | 20 stories / 69 SP |
| **Yoir – Sprint 2 dependencies** | Build order within Sprint 2 (19 arrows) | 6 columns |
| **Yoir – Sprint 3 User Story Map** | Only the Sprint 3 slice, same layout | 31 stories / 110 SP |
| **Yoir – Sprint 3 dependencies** | Build order within Sprint 3 (23 arrows) | 6 columns |

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

The activities follow the two flows confirmed with the client on 25 August 2026 — `create account → log in` and `browse service → choose slot → create order → pay → confirm → deliver service → review` — plus the Forum as a side activity.

| # | Activity | Steps → stories | Sprint 2 | Sprint 3 |
|---|---|---|---|---|
| 1 | **Get an account** | Register US-01 02 03 04 · Log in/out US-06 07 08, *US-70* | 01 02 03 04 06 07 08 | *70* |
| 2 | **Set up as a counsellor** | Onboarding US-05 · Profile US-30 · Privacy US-27 28 · Get verified US-31 32 58, *US-33* | 30 | 05 27 28 31 32 58 *33* |
| 3 | **Offer services** | Create & price US-34 35 · Declare delivery US-37 38 · Maintain listings US-36 · Set availability US-39 | 34 35 37 38 39 | 36 |
| 4 | **Find a counsellor** | Browse US-44 · Search/filter US-45 · Evaluate US-46 55 | 44 45 46 | 55 |
| 5 | **Book & pay** | Choose slot US-40 41 · Pay US-47 · Confirm US-68, *US-69* | 40 41 47 68 | *69* |
| 6 | **Deliver the service** | Manage bookings US-42 43 · Talk about the order US-49 50 · Close the conversation US-62 63 | — | 42 43 49 50 62 63 |
| 7 | **Review & after-sales** | Review US-53 54 · Dispute US-51, *US-52* · Oversee orders US-48 | — | 48 51 *52* 53 54 |
| 8 | **Community forum** | Browse boards US-14 15 · Post US-16 17 · Reply US-18 19 20 · Like/search US-21 22 | — | 14 15 16 17 18 19 20 21 22 |

*Italic = Should-have.* Activities are journey-based, so they do not map one-to-one onto the backlog epics A–J: activity 2 combines Epics C and D, activity 5 takes the booking stories from Epic F and payment from Epic H, and activity 7 takes reviews from Epic J and after-sales from Epic H. The Epic field on each issue is unchanged.

## 4. Full map

The full map is a single Miro frame covering all eight activities across both sprints. Open it on the [live board](https://miro.com/app/board/uXjVHtnlqKA=/?share_link_id=876750713477); the tables in sections 3, 5 and 6 carry the same content in text.

## 5. Sprint 2 — 29 Aug → 16 Sep 2026

**20 stories / 69 SP — the walking path.** The thinnest end-to-end slice of the paid journey, which the Sprint 1 walking skeleton (`S1-03`) already stubs.

**Sprint goal:** a Job Seeker can register, log in, find a counsellor's service, book an open slot, pay in test mode and see the confirmation; a counsellor can set up profile, services and availability.

| Activity | Stories | SP |
|---|---|---|
| Get an account | US-01, 02, 03, 04, 06, 07, 08 | 19 |
| Set up as a counsellor | US-30 | 5 |
| Offer services | US-34, 35, 37, 38, 39 | 19 |
| Find a counsellor | US-44, 45, 46 | 12 |
| Book & pay | US-40, 41, 47, 68 | 14 |

Open client decisions that touch this sprint: **CLIENT-02** payment boundary (provider test mode assumed), how long a reserved slot is held before payment, the password rule.


## 6. Sprint 3 — 17 Sep → 12 Oct 2026

**31 stories / 110 SP — everything below the line.** Yellow (Should-have) cards are the first candidates to drop if velocity is short; the Forum (27 SP) is the largest block that is not on the paid journey.

**Sprint goal:** counsellors get verified and manage bookings; buyer and counsellor message on an order and the conversation closes with it; buyers review and dispute; the Forum works end to end; should-haves (password reset, reschedule, manual re-review, dispute resolution) land if velocity allows; the product is handover-ready.

| Activity | Stories | SP |
|---|---|---|
| Get an account | US-70 | 5 |
| Set up as a counsellor | US-05, 27, 28, 31, 32, 33, 58 | 25 |
| Offer services | US-36 | 3 |
| Find a counsellor | US-55 | 4 |
| Book & pay | US-69 | 5 |
| Deliver the service | US-42, 43, 49, 50, 62, 63 | 21 |
| Review & after-sales | US-48, 51, 52, 53, 54 | 20 |
| Community forum | US-14 – US-22 | 27 |

Open client decisions that touch this sprint: **CLIENT-01** LinkedIn verification approach (US-31/32/33/58), cancellation and reschedule policy (US-69), the counsellor rating formula (US-55), the shape of the Platform Owner console (US-48/52/58).


## 7. Dependencies frames

The dependency frames answer *what has to exist before this story can be demonstrated*.

- Columns are **build order**: a story in column *n* depends on at least one story in column *n − 1* and on nothing further right. Column 1 stories have no prerequisites.
- An **arrow** points from the prerequisite to the story it unblocks.
- Only **direct** dependencies are drawn — if A → B → C, the A → C arrow is left out.
- **Logging in is a prerequisite for almost everything**, so the arrows from US-01 → US-06 to every authenticated story are omitted rather than drawn 40 times. The Sprint 3 frame also omits prerequisites that Sprint 2 delivers.
- Yellow cards are Should-haves; nothing Must-have depends on a Should-have.

The dependencies are the team's current judgement, not a contract: they are pruned or extended at sprint planning, and the agreed ones are recorded on GitHub as *Blocked by* links on the issues.


## 8. Traceability

| On the board | On GitHub | Source of truth |
|---|---|---|
| Story card `US-47 · Complete a platform-supervised purchase · 5 SP` | Issue `[US-47] Complete a platform-supervised purchase`, Story Points = 5, Priority = Must-have | `backlog.md` §3 |
| Green card `US-47 BE: Order/transaction models, payment boundary…` | Sub-issue `[US-47] BE: …` under the story | Issue body, *Sub-tasks* |
| Card position above / below the sprint line | Sprint field = Sprint 2 / Sprint 3 | Sprint planning |
| Arrow A → B on a dependency frame | *Blocked by* link on issue B | Issue body, *Dependencies* |

If a card and its issue disagree, the issue is corrected to match the baseline and the card is updated at the next refresh.

## 9. Maintaining the board

- **Sprint planning:** re-slice by moving the sprint line or individual cards; update the Sprint field on the issues; prune the dependency arrows that turned out not to matter.
- **Sprint review:** mark delivered stories on the board (Miro tag or ✅ in the card text) so the client sees progress against the map.
- **Baseline change:** a story added, removed or re-estimated in `backlog.md` is mirrored on the board *and* on the project board in the same change, so the three never drift.

Map last reviewed against the board: **27 August 2026** (end of Sprint 1).
