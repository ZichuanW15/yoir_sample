<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Daily Standups
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups
  Wiki commit: 6553fa9 (2026-08-27)
  Exported:    2026-08-27
-->

# Week 5
# Meeting Minutes - Daily Standup

| Field | Detail |
|---|---|
| Date | 26-8-2026 |
| Time | 7-7:30pm |
| Location | Zoom |
| Attendees | Manushresth (Scrum Master), Jared (PO), Evelyn, Jashan, James (WZC), Zhenyang |
| Minuted by | Manushresth |

---

## Discussion

| Topic | Notes |
|---|---|
| Risk register | Manu completed the risk register. Main risks identified are the LinkedIn API, the payment gateway, and app store deployment. To be updated with Stripe test mode, which lowers the payment risk for Sprint 1. |
| CI pipeline | Manu built the CI pipeline, including Mermaid diagrams generated per PR to capture architectural changes, in line with Erfan's project board requirements. |
| AI usage log | Team discussed use of Claude for commit messages and for generating interface definitions. Agreed to maintain an AI log recording when AI tools are used, for transparency and academic integrity. Manu to define and implement the process. |
| Design concept and data model | Evelyn completed the conceptual design and the database schema. Design concept document to be finished before Friday's tutorial, with a decision table and rationale added. |
| Executable architecture | Jashan completed the architecture diagrams and mapped them against Evelyn's schema. Conflicts between the architecture and the schema were found and resolved. Schema updated off the back of the data model. V1 needs sign-off from Erfan to lock scope. Evelyn to review Jashan's work. |
| Tech stack | React Native with Expo for cross-platform delivery, FastAPI with Python for the backend. |
| Payments | Stripe provides a test mode for development. Moving to production is a configuration change only, no code changes required. |
| Frontend screens | Evelyn reviewed the client video content and listed the screens needed for the executable architecture. Generated screens sit in the draw.io file and need review and changes from the frontend developers. Manu to notify James and Ariz in Slack. |
| Integration testing scope | Sprint 1 integration testing only needs to demonstrate that components can communicate correctly. Three requirements: a written explanation of the test approach, actual integration tests in the repo, and working code that matches the architecture diagram. Explanation to go in both the wiki and the GitHub repo. |
| Frontend progress | James is working on the front end and used AI to generate the interface definitions for S102. Work still needs review. Jashan to support on frontend architecture questions. |
| Testing prerequisites | Zhenyang reviewed the Sprint 1 testing requirements. The executable architecture and test plan are both needed before integration tests can start. Handoff from Jashan discussed. |
| Acceptance criteria | Jared asked for the backlog to be reviewed and acceptance criteria refined, with acceptance tests prepared for Sprint 2. Zhenyang may create separate documentation for acceptance criteria. |
| Client meeting | Jared reported on the client meeting. Minutes were reviewed and sent to the client with the transcript and recording attached. |
| Scrum master role | Jared reminded Manu that the scrum master role is to facilitate and empower the team, not to take on the work personally. |
| Sprint 1 deliverables | Requirements artefacts are largely complete, with adjustments still needed following the app versus web assumption. Open question on whether a separate product backlog document is required alongside the board. Erfan's guidance is that both formats are acceptable, to be confirmed in Friday's tutorial. Due 28-8-2026. |
| Escalation points | Jashan is the contact for executable architecture questions, Evelyn for design concept questions. James and Zhenyang to raise questions in Slack rather than waiting for standup. |

---

## Actions

| Action | Owner | Due | Status |
|---|---|---|---|
| Update risk register with Stripe test mode capability | Manushresth |  | Closed |
| Define and implement the AI usage tracking process | Manushresth |  | Closed |
| Update and share meeting minutes | Manushresth | Within 10 min | Closed |
| Notify James and Ariz in Slack about the draw.io frontend screen review | Manushresth |  | Closed |
| Confirm product backlog document requirement with Erfan | Manushresth | Friday tutorial | Closed |
| Complete design concept document | Evelyn | Before Friday tutorial | Closed |
| Add decision table and rationale to design concept | Evelyn |  | Closed |
| Review Jashan's executable architecture work | Evelyn |  | Closed |
| Add explanatory paragraph on the executable architecture approach and integration test rationale | Jashan |  | Closed |
| Get executable architecture V1 signed off by Erfan | Jashan |  | Closed |
| Document executable architecture in the wiki and GitHub repo | Jashan |  | Closed |
| Support James on frontend architecture questions | Jashan |  | Closed |
| Review and update frontend screens in the draw.io file | James (WZC), Ariz |  | Closed |
| Review backlog and refine acceptance criteria, add acceptance criteria documentation if needed | Zhenyang |  | Closed |
| Prepare acceptance tests for Sprint 2 | Zhenyang | Sprint 2 | Closed |
| Complete all Sprint 1 deliverables | All | 28-8-2026 | Closed |
| Raise blockers in Slack rather than waiting for standup | All |  | Closed |
