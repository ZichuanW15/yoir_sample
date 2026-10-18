<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Daily Standups
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups
  Wiki commit: 8fa8c88 (2026-10-18)
  Exported:    2026-09-18
-->

# Week 7
# Meeting Minutes - Daily Standup

| Field | Detail |
|---|---|
| Date | 9-9-2026 |
| Time | 7-7:30pm |
| Location | Zoom |
| Attendees | Manushresth (Scrum Master), Jared (PO), Evelyn, Jashan, Ariz, James (WZC), Zhenyang |
| Minuted by | Manushresth |

---

## Discussion

| Topic | Notes |
|---|---|
| Frontend Sprint 2 | Manu reported Sprint 2 frontend work is 99% complete, including the payment confirmation screens. No blockers. |
| Project board | Manu optimised the board and walked the team through how to read it. |
| Frontend - onboarding and marketplace | Ariz completed onboarding, rebranding and marketplace browse. Earlier CI failures were resolved by Manu. No blockers. |
| Frontend - counsellor dashboard | James improved the counsellor dashboard pages and will add edit and delete course functionality next. |
| Deployment | Jashan deployed the application to the dev environment on FastAPI Cloud and provisioned a serverless Postgres database. The Expo web build is now served from FastAPI so both deploy together. |
| Database connection issue | The serverless Postgres instance drops connections after roughly 5 minutes of inactivity. Jashan to address. |
| Backend - counsellor logic | Evelyn completed the counsellor logic and user stories 30-40, covering counsellor service and availability management. Next up is register functionality for counsellors. |
| Backend - user stories | Jared completed US-01 and US-02, with US-03 landing the same day. Work continues on the remaining stories. Dev branch updated without conflicts. |
| QA and testing | Zhenyang reviewed the Sprint 2 requirements and wrote frontend tests. No blockers. Further tests to be prepared once frontend and backend features are complete. |
| Branching strategy | Jared raised concern that no pull requests are being merged into main. Jashan clarified that all development goes to the dev branch first, which acts as the integration testing playground. Main is only updated after client and QA sign-off. |
| Merge conflicts | Jashan asked everyone to pull the latest dev branch before starting new work to avoid conflicts. |
| Pull request practice | Jashan asked for consistent branch naming and for reviewers to be added to every pull request so the whole team has visibility. |
| Task redistribution | Jashan to take on payment functionality (US-47) and the email features, including registration confirmation emails. Jared to continue with US-06, US-07 and US-08. |
| Client demo | Team agreed to schedule a client meeting next week to demonstrate the MVP prototype. Manu to send a When2Meet link in Slack. |
| MVP scope and timeline | Jared flagged the client's questions on final scope and timeline, specifically what lands in the MVP versus later iterations. Manu proposed the MVP cover the fundamental application features for counsellors, job seekers and the admin dashboard, with productionisation, analytics and observability out of scope given the timeline. Jared to discuss with Erfan at the supervisor meeting before replying to the client. |

---

## Actions

| Action | Owner | Due | Status |
|---|---|---|---|
| Send the When2Meet link in Slack for the client demo meeting | Manushresth |  | Closed |
| Work on US-47 (payment) and US-68 | Jashan |  | Closed |
| Set up SMTP configuration for the email functionality | Jashan |  | Closed |
| Resolve the serverless Postgres connection drop after 5 minutes of inactivity | Jashan |  | Closed |
| Continue work on US-06, US-07 and US-08 | Jared |  | Closed |
| Fix the branch naming convention on pull requests | Jared |  | Closed |
| Discuss MVP scope and timeline with Erfan before sending the client email | Jared | Supervisor meeting, 10-9-2026 | Closed |
| Review Jared's pull request | Evelyn |  | Closed |
| Continue register functionality for counsellors | Evelyn |  | Closed |
| Add edit and delete course functionality to the counsellor dashboard | James (WZC) |  | Closed |
| Prepare tests once frontend and backend features are complete | Zhenyang |  | Closed |
| Pull the latest dev branch code before starting new work | All |  | Closed |
| Add reviewers to pull requests for visibility | All |  | Closed |
| Schedule the client demo meeting to show Sprint 2 progress | Team | Next week | Closed |
