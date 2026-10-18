<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Daily Standups
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups
  Wiki commit: cb85c93 (2026-10-18)
  Exported:    2026-10-18
-->

# Week 10
# Meeting Minutes - Daily Standup

| Field | Detail |
|---|---|
| Date | 7-10-2026 |
| Time | 7-7:30pm |
| Location | Zoom |
| Attendees | Manushresth (Scrum Master), Jared (PO), Evelyn, Jashan, Ariz, James (WZC), Zhenyang |
| Minuted by | Evelyn |

---

## Discussion

| Topic | Notes |
|---|---|
| Sprint 3 status | 11 of 28 days left. Most Sprint 3 front-end work is merged or under review, and the back end will continue over the coming days so the stories can be integrated and closed. The Sprint 2 Retrospective and Sprint 3 Planning follow straight after this stand-up. |
| Frontend - diagnosis, verification and admin | Manu merged PR #232 on 5 October with the diagnosis, verification and Platform Owner front end, and fixed a Ruff line-length failure on dev today. |
| Frontend - accounts and bookings | Ariz merged US-05 onboarding (6 October) and US-42 My Bookings and the US-29 profile tests (today). US-43, US-69 and US-70 are in progress. |
| Frontend - privacy and reviews | James merged PR #234 today with the privacy settings, service edit and reviews front end. |
| Backend - diagnosis | Jared raised PR #233 with the diagnosis persistence and validation for US-09–11. It needs a reviewer. |
| Backend - verification and service edit | Evelyn is working on the back end for US-31, US-32, US-33 and US-36. LinkedIn URL validation and the pending re-decision are close, and a PR follows. |
| Backend - oversight | Jashan will pick up the Platform Owner admin endpoints next, then the remaining bookings and reviews back end (US-42, US-48, US-53, US-58, US-70, US-71). |
| QA | Zhenyang is writing tests for the newly merged front-end features. |
| Blockers | None raised. Front ends follow openapi.yaml, so integration is wiring once the endpoints land. |

---

## Actions

| Action | Owner | Due | Status |
|---|---|---|---|
| Review PR #233 (diagnosis persistence) | Evelyn | 10-10-2026 | Closed |
| Raise the PR for the US-31–33 and US-36 back end | Evelyn | | Closed |
| Start the Platform Owner admin endpoints | Jashan | | Closed |
| Confirm owners for the remaining back-end and QA work | Team | Sprint 3 Planning, 7-10-2026 | Closed |
