<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Daily Standups
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups
  Wiki commit: 1144d7e (2026-09-16)
  Exported:    2026-09-18
-->

# Week 8
# Meeting Minutes - Daily Standup

| Field | Detail |
|---|---|
| Date | 16-9-2026 |
| Time | 7-7:30pm |
| Location | Zoom |
| Attendees | Manushresth (Scrum Master), Jared (PO), Evelyn, Jashan, Ariz, James (WZC), Zhenyang |
| Minuted by | Manushresth |

---

## Discussion

| Topic | Notes |
|---|---|
| Sprint 2 status | Manu reported that most Sprint 2 tasks are complete, with only a few items left to finish over the coming days. Focus now shifts to documentation and the feedback received on Sprint 1. |
| Documentation | Manu updated the reuse plan in the design wiki and the client meeting minutes. Repo documentation will be updated over the weekend once the dev branch is merged. |
| Client triage questions | Triage questions for the client are still pending. Manu will work on the Sprint 2 documentation and apply the Sprint 1 feedback changes once answers arrive. If time runs short, the triage tasks may move to Sprint 3. |
| Backend - registration, payment and email | Jashan completed the backend user stories for counsellor registration and payment, and set up SMTP for the email functionality. A PR will be raised tonight after verification. |
| Slot booking bug | Jashan identified a bug that allowed duplicate and overlapping slots to be created. The fix needs changes on both the backend and frontend, and the API endpoint changes will be shared with the frontend team. |
| Frontend - counsellor console | Ariz completed edit, delete and block availability for services on the counsellor console page. The work was shown to the client and merged into dev with Manu's help. Ready for the next task. |
| Frontend review | James reviewed the frontend and found no blockers. Offered to support Manu where needed. |
| Backend - counsellor service | Evelyn finished the duplicate user stories and the counsellor service user story, with a PR published. The verification work has been merged into dev. Available to help with backend work and the Sprint 2 documentation. |
| Backlog blocker | Evelyn raised a blocker on a user story where frontend QA is complete but the backend work is not, so it is unclear how to move it to Done. Manu to look into it. Jared walked Manu and Evelyn through how to close an issue on the board. |
| Product owner update | Jared completed US-06, US-07 and US-08, and sent the client an email with the meeting recording and transcript. The client confirmed receipt and will reply soon. Jared also reviewed Zhenyang's and Evelyn's PRs for refinement and debugging. |
| QA and testing | Zhenyang completed the test user stories for the web, API, iOS and Android workflows. Documentation and results are pushed to the repo. |
| Sprint 2 submission | Manu asked everyone to add task descriptions and acceptance criteria in the task information section of their items so the work is properly documented for the Sprint 2 submission. |

---

## Actions

| Action | Owner | Due | Status |
|---|---|---|---|
| Update the reuse plan documentation in the repo after merging the dev branch | Manushresth | Weekend | Open |
| Update the Sprint 2 documentation | Manushresth |  | Open |
| Check how to move user stories to Done when frontend QA is complete but backend is pending | Manushresth |  | Open |
| Update and share meeting minutes | Manushresth |  | Open |
| Raise a PR for the SMTP setup after verification | Jashan | 16-9-2026 | Open |
| Fix the duplicate and overlapping slot booking bug | Jashan |  | Open |
| Share the slot booking API endpoint changes with the frontend team | Jashan |  | Open |
| Finish the Sprint 2 documentation deliverables | Evelyn |  | Open |
| Follow up with the client on the triage questions and user stories | Jared |  | Open |
| Add task descriptions and acceptance criteria to the task information section | All | Sprint 2 submission | Open |
