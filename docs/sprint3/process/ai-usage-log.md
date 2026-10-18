<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: AI Usage Log
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/AI-Usage-Log
  Wiki commit: 23d05bc (2026-10-18)
  Exported:    2026-10-18
-->

# AI Usage Log

At the 26 August stand-up the team agreed to record whenever an AI tool is used, for transparency and academic integrity ([Daily Standups](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups), Week 5). This page is that record. The same log is kept in the repository at `docs/sprint3/process/ai-usage-log.md`.

## 1. Rules

- **Log every use that shapes project work.** That includes code, tests, documentation, commit messages, designs and meeting records: one row per task, added on the day.
- **The member who used the tool owns the result.** They read, test and correct the output before it is merged or published, and they answer for it in review.
- **Never give an AI tool secrets or personal data.** That covers API keys, passwords, tokens, the client's personal details, other users' data and other students' work.
- **AI output is not evidence.** Test results come from real runs, client decisions from the client, and meeting outcomes from the meeting. A tool may help organise or word them but may not supply them.
- **Check generated code like any other code.** It goes through a pull request with a reviewer, and CI must pass on it.

## 2. How to add an entry

Add a row to §3 with:

| Column | What to write |
|---|---|
| Date | The day the tool was used |
| Member | Who used it |
| Tool | The tool or model, as precisely as known |
| Used for | The task, in a sentence |
| Artefact | The pull request, commit, page or file it affected |
| How the result was checked | Review, tests or CI run, or "Not recorded" if unknown |

## 3. Log

Wilson's 18 September entry was reconstructed on 8 October 2026 from the Codex conversation and linked project records.

| Date | Member | Tool | Used for | Artefact | How the result was checked |
|---|---|---|---|---|---|
| Sprint 1, by 26 Aug | Team | Claude | Drafting commit messages and generating interface definitions | Discussed at the 26 Aug stand-up | Not recorded |
| Sprint 1, by 27 Aug | Not recorded | Not recorded | Generating early front-end screens in the repository | Front-end screens reviewed by James | James flagged at the 27 Aug supervisor meeting that the screens still needed verifying against the requirements ([Mentor Communication Log](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Mentor-Communication-Log)) |
| 7 Sep 2026 | Ariz | Claude (Sonnet model) | Rebranding the onboarding, sign-in and Explore screens; syncing `package-lock.json`; keeping shared UI primitives during a migration | Commits `60782a7`, `b2fdc7b`, `fd7224c` | Not recorded |
| 8 Sep 2026 | Jared | Codex | US-01 registration validation and contract on the back end | PR [#146](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/146), branch `codex/us01-registration-backend` | Not recorded |
| 14 Sep 2026 | Evelyn | Claude (Sonnet model) | Fixing a test that re-queried a slot after it might have been deleted | Commit `f7fa624` | Part of the backend suite that passed in Application CI on the Sprint 2 tag |
| 18 Sep 2026 | Jared | Codex | Transcribing the client's email screenshots, inspecting the diagnosis workbook read-only, organising the feedback and acceptance record, and drafting the linked requirement and story-map updates | [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback); [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements); [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog); [User Story Map](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/User-Story-Map) | Sources, story IDs and links checked during preparation; disclosure note on the review page |
| 18 Sep 2026 | Wilson | Codex | Addressing PR review feedback: resolving the dev merge conflicts, migrating QA tests to the availability-window and booking contracts, correcting HTTP response mocks, and updating defect-report validation and evidence. | PR [#155](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/155); commit [`8aa2428`](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/commit/8aa24284dbbcf64a18e63b783cf43648574d75c6); [dev-sync validation report](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/docs/sprint2/qa/dev-sync-review-20260918.md) | Fresh local runs recorded 564 PostgreSQL tests passed with 15 xfailed, 298 frontend tests passed, and passing typecheck/lint checks. Further browser, live-client and platform-component results are in the report. Hosted CI status was not verified during that work. |
| 19 Sep 2026 | Evelyn | Codex | Inspecting the back-end models, schemas, routers, migrations, tests and CI metadata to draft the back-end story documents | `docs/sprint2/backend/us30-counsellor-profile.md`, `us34-us41-services-and-availability.md`, `us44-us46-marketplace-discovery.md` | Used to find mismatches, not to invent results; disclosure note in each document |
| 4 Oct 2026 | Evelyn | Claude | Exploring possible approaches for implementing the Yoir Diagnosis, to understand the options before the team built it | No artefact (exploration only, no code committed) | Used for understanding only; the implementation was written and reviewed by the team |
| 14–15 Oct 2026 | Evelyn | Claude | Help with the US-36 backend implementation (editing and withdrawing a service while preserving existing order data) | US-36 backend sub-issue #200 | Reviewed and tested by me before committing |
| 17 Oct 2026 | Evelyn | Claude Code (Claude Opus 5.5) | US-36 fixes found during review: freezing the service title in booking emails and the in-person meeting area on orders (backend), and showing the booked title and area on the confirmation screen (frontend); with tests and the US-36 document | PRs #243, #244, #246 | New tests failed before each fix and passed after; full backend and affected frontend tests passed locally; CI passed |


## 4. Gaps in this record

The log was agreed on 26 August and its action was marked Closed, but this page was not created until 8 October 2026. The entries before 8 October were rebuilt from four sources:

- the stand-up and supervisor minutes
- commit metadata
- disclosure notes in documents
- branch names

Any use those sources did not capture is missing. **Each member should add their own missing entries by the 14 October stand-up.** From now on, entries are added on the day.
