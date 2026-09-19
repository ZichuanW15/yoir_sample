<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Mentor Communication Log
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Mentor-Communication-Log
  Wiki commit: 28ebead (2026-09-18)
  Exported:    2026-09-18
-->

# Week 8
# Meeting Minutes

**Week 8, Sprint 2**

| Field | Detail |
| --- | --- |
| Date | Thursday, 17 September 2026 |
| Time | 6:30 pm - 7:00 pm |
| Location | Zoom |
| Attendees | Erfan Farabi (Supervisor), Manushresth Krishnan (Scrum Master), Wei Chen Cheng "Jared" (Product Owner), Qingyi Zhu "Evelyn" (Backend), Jashan Arora (Backend), Zichuan Wang "James" (Frontend), Zhenyang Zhou "Wilson" (QA / CI-CD) |
| Apologies | Ariz Muflih Muttaqi (Frontend) |

## Discussion

| Topic | Notes |
| --- | --- |
| Stand-up: Scrum Master (Manu) | Reviewed Erfan's Sprint 1 feedback and updated the design documentation to include the reuse plan. Ran a client meeting to walk through the counsellor flow. Next focus is the Sprint 2 documentation ahead of this weekend's submission. |
| Stand-up: Product Owner (Jared) | Completed user stories 6-8. Received client feedback asking for the triage questions to be customised per user rather than using a standard question set. Continuing on the Sprint delivery documentation. |
| Stand-up: Backend (Jashan) | Implemented the payment functionality with Stripe along with the SMTP email features. Still to confirm with the client whether payment distribution is handled through Stripe or manually by the counsellors. Overlapping time slots issue still open. |
| Stand-up: Backend (Evelyn) | Completed the backend user stories for counsellor service creation and the marketplace functionality. Moving on to the Sprint 2 delivery documentation. |
| Stand-up: Frontend (James) | Worked on design updates and started preparing documentation. Frontend work is close to complete, so the focus shifts to documentation. Needs to confirm the current design concept version with Manu before uploading the updates to GitHub. |
| Stand-up: QA (Wilson) | Completed testing for the Sprint 2 workflows across web, API, iOS and Android, and documented the test results. Test coverage and evidence still to be double-checked. |
| Workshop rescheduling | Next week's workshop needs to move because of the public holiday. Thursday 9:00-10:00 am was agreed as the proposed slot, with most of the team available. The session runs online and includes team demos with feedback. CI/CD topics will be covered the following day. |
| Job seeker to counsellor matching | Manu and Jared asked Erfan whether the matching should use ML, AI or a vector-based approach, given the team is on FastAPI and working within compute credits. Erfan advised researching the options and comparing them on cost, time and implementation complexity, and building a table of pros and cons before committing to one. Free-tier resource constraints need to be factored in. The team will present findings at tomorrow's session. |
| MVP demo | Manu demonstrated the job seeker flow: browsing services, viewing service details and booking a session. The payment step is still in development with Jashan. Erfan asked for a short demo of MVP progress at the workshop. |
| Onboarding and preference capture | Manu explained that user preferences and career goals will be captured during onboarding in Sprint 3 through a multiple-choice questionnaire, which keeps the matching input structured and the process quick for the user. |
| Vector search and counsellor profiles | Erfan raised search engine optimisation methods and vectorisation techniques as options for the matching algorithm, and flagged cost as the main consideration across different user tiers. He and Manu discussed using detailed counsellor profiles so job seekers can be matched on similar experience and background, for example someone new to Australia looking for work after finishing a master's degree. Erfan had to leave for another meeting and will continue the discussion tomorrow. |

## Actions

| Action | Owner | Due | Status |
| --- | --- | --- | --- |
| Complete the documentation for the Sprint 2 submission | Manu | This weekend | Open |
| Meet with the team to work through the triage and matching function | Manu | 18 Sep 2026 | Open |
| Raise the pull requests for the payment and SMTP functionality | Jashan |  | Open |
| Fix the overlapping time slots issue | Jashan |  | Open |
| Verify the payment distribution mechanism with the client, Stripe or manual | Jashan |  | Open |
| Prepare the documentation for the Sprint 2 delivery | Evelyn |  | Open |
| Continue the documentation for the Sprint delivery | Jared |  | Open |
| Confirm the current design concept version with Manu and upload the updates to GitHub | James |  | Open |
| Double-check the test coverage and evidence | Wilson |  | Open |
| Research the matching algorithm options and build a comparison table of costs, effort and trade-offs | Team | 18 Sep 2026 | Open |
| Discuss the matching implementation approach at the workshop | Team | Next workshop | Open |
| Prepare the MVP demo for the workshop | Team | Next workshop | Open |
| Confirm the rescheduled workshop slot, Thursday 9:00-10:00 am | Erfan | Before next week | Open |
