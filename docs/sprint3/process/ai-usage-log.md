<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: AI Usage Log
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/AI-Usage-Log
  Wiki commit: 3b74375 (2026-10-18)
  Exported:    2026-10-18
-->

# AI Usage Log

At the 26 August stand-up the team agreed to record whenever an AI tool is used, for transparency and academic integrity ([Daily Standups](Daily-Standups), Week 5). This page is that record. The same log is kept in the repository at `docs/sprint3/process/ai-usage-log.md`.

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

Manu's entries were reconstructed on 18 October 2026 from his Claude Code session history, which runs from 17 September; the 27 August entry comes from his session notes.

| Date | Member | Tool | Used for | Artefact | How the result was checked |
|---|---|---|---|---|---|
| Sprint 1, by 26 Aug | Team | Claude | Drafting commit messages and generating interface definitions | Discussed at the 26 Aug stand-up | Not recorded |
| Sprint 1, by 27 Aug | Not recorded | Not recorded | Generating early front-end screens in the repository | Front-end screens reviewed by James | James flagged at the 27 Aug supervisor meeting that the screens still needed verifying against the requirements ([Mentor Communication Log](Mentor-Communication-Log)) |
| 27 Aug 2026 | Manu | Claude Code (model not recorded) | Building the story map and Sprint 2 and Sprint 3 boards in Miro through its API, drafting a project-board restructure proposal, and rewriting the 51 `[US-nn]` issue bodies into the Purpose / Scope / Acceptance criteria / Evidence template | Miro story-map boards; the `[US-nn]` issue bodies | Not recorded. The original issue headers, DoR/DoD and traceability lines were kept; the board proposal was not applied |
| 7 Sep 2026 | Ariz | Claude (Sonnet model) | Rebranding the onboarding, sign-in and Explore screens; syncing `package-lock.json`; keeping shared UI primitives during a migration | Commits `60782a7`, `b2fdc7b`, `fd7224c` | Not recorded |
| 8 Sep 2026 | Jared | Codex | US-01 registration validation and contract on the back end | PR [#146](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/146), branch `codex/us01-registration-backend` | Not recorded |
| 14 Sep 2026 | Evelyn | Claude (Sonnet model) | Fixing a test that re-queried a slot after it might have been deleted | Commit `f7fa624` | Part of the backend suite that passed in Application CI on the Sprint 2 tag |
| 18 Sep 2026 | Jared | Codex | Transcribing the client's email screenshots, inspecting the diagnosis workbook read-only, organising the feedback and acceptance record, and drafting the linked requirement and story-map updates | [Sprint 2 Review & Client Feedback](Sprint-2-Review-and-Client-Feedback); [Requirements](Requirements); [Product Backlog](Product-Backlog); [User Story Map](User-Story-Map) | Sources, story IDs and links checked during preparation; disclosure note on the review page |
| 18 Sep 2026 | Wilson | Codex | Addressing PR review feedback: resolving the dev merge conflicts, migrating QA tests to the availability-window and booking contracts, correcting HTTP response mocks, and updating defect-report validation and evidence. | PR [#155](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/155); commit [`8aa2428`](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/commit/8aa24284dbbcf64a18e63b783cf43648574d75c6); [dev-sync validation report](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/docs/sprint2/qa/dev-sync-review-20260918.md) | Fresh local runs recorded 564 PostgreSQL tests passed with 15 xfailed, 298 frontend tests passed, and passing typecheck/lint checks. Further browser, live-client and platform-component results are in the report. Hosted CI status was not verified during that work. |
| 17 Sep 2026 | Manu | Claude Code (Claude Opus 5) | Checking which Sprint 2 documents needed updating against the lecture slides and the wiki, aligning the sprint dates with the subject schedule, and writing the descriptions of Manu's Sprint 2 front-end sub-issues | Wiki `ee4f64e`; Manu's Sprint 2 front-end sub-issues | Read and approved by Manu before publishing |
| 18 Sep 2026 | Manu | Claude Code (Claude Opus 5) | Admin dashboard, admin bottom navigation and role-aware landing | PR [#159](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/159) (`ea9f279`) | Tested locally by Manu; CI passed on `dev` after the same-day fix `64cb324` |
| 18–19 Sep 2026 | Manu | Claude Code (Claude Opus 5) | Merging `dev` into James's navigation PR #156 and adding the client's Sprint 2 feedback changes (Yoir Diagnosis onboarding, saved profiles with a photo, Career Professional naming, branding), the Job Seeker and richer Career Professional profiles on the back end, and CI fixes | PR [#156](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/156); commits `5c5463a`, `6042ec2`, `0ab0efd`, `64cb324` | Tested locally by Manu; CI passed on `64cb324` |
| 18–19 Sep 2026 | Manu | Claude Code (Claude Opus 5) | End of Sprint 2: splitting the remaining stories into Front-end, Back-end and QA sub-issues and ordering the Sprint 2 column, then the Sprint 2 documents (front-end story docs, Sprint 2 Planning, process documentation and Sprint 2 insights with the burndown redrawn from sub-issue completion, the response to the client's feedback, README) | Project board; repo `be53bce` to `d25e3d5`; wiki `15fab6a` to `9bf9bb8` | Each page read and approved by Manu before it was pushed; figures taken from the board and GitHub data |
| 19 Sep 2026 | Evelyn | Codex | Inspecting the back-end models, schemas, routers, migrations, tests and CI metadata to draft the back-end story documents | `docs/sprint2/backend/us30-counsellor-profile.md`, `us34-us41-services-and-availability.md`, `us44-us46-marketplace-discovery.md` | Used to find mismatches, not to invent results; disclosure note in each document |
| 20 Sep 2026 | Manu | Claude Code (Claude Fable 5.1, Claude Opus 5) | Sprint 2 submission: final documents to `main`, the Sprint 2 tag and release, a draft of the submission email, and preparation for the Sprint 2 review | PR [#177](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/177); tag `SWEN90014_MSEP_2026S2_CSD-Koala_Sprint2_20260920`; commits `de4558c`, `53063bc` | All CI checks passed on PR #177; Manu sent the email himself |
| 4 Oct 2026 | Evelyn | Claude | Exploring possible approaches for implementing the Yoir Diagnosis, to understand the options before the team built it | No artefact (exploration only, no code committed) | Used for understanding only; the implementation was written and reviewed by the team |
| 4–5 Oct 2026 | Manu | Claude Code (Claude Fable 5.1) | Checking the triage front end, splitting the Sprint 3 stories into sub-issues on the board, and building Manu's Sprint 3 front ends: Yoir Diagnosis resume, validation and Explore handoff (US-09–13), verification (US-31–33, US-58), Platform Owner orders, submissions, Users and Overview (US-48, US-71) and profile autosave; plus a Platform Owner Job Seeker list on the back end | PR [#232](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232) (`be8ea2c`, `00af92c`, `6f11b90`, `783bed8`, `7dc5527`); project board | Tested locally by Manu; all 16 CI checks passed on PR #232 |
| 6–8 Oct 2026 | Manu | Claude Code (Claude Opus 5.5) | CI fixes on `dev` (Ruff line length and an unused import, a test updated for US-05 onboarding) and board updates for US-05, US-27, US-28 and US-53 | Commits `e5dce2a`, `89c3346`, `5f46166`; project board | CI passed on `89c3346` and `5f46166` |
| 7–8 Oct 2026 | Manu | Claude Code (Claude Opus 5.5) | Checking the Sprint 2 feedback for gaps, then the follow-up documents: the requirements resolution record, this AI Usage Log, the Sprint 2 Retrospective and Sprint 3 Planning records, the design concept and schema updates, and the Sprint 3 feature walkthrough with iOS simulator screenshots | Repo `4f579d3`, `f6db563`, `10bad21`; wiki `d6cf91f`, `ed25726`, `37eaba3` | Contents shown to and approved by Manu before pushing; screenshots taken from the running build |
| 11–12 Oct 2026 | Manu | Claude Code (Claude Opus 5.5) | Recording a 1.5–2 minute demo video of the app in the mobile emulator, with synthesised voice-over | Demo video (not in the repository) | Watched by Manu; an audio and video sync problem was found and fixed |
| 13 Oct 2026 | Manu | Claude Code (Claude Opus 5.5) | Adding the Week 10 supervisor meeting minutes and the Week 11 architecture presentation deck to the wiki and the repository | Repo `a12b338`, `c57eee4`; wiki `2b7b2db`, `ad3d964` | Minutes formatted from the meeting summary Manu provided; checked by Manu before pushing |
| 14–15 Oct 2026 | Evelyn | Claude | Help with the US-36 backend implementation (editing and withdrawing a service while preserving existing order data) | US-36 backend sub-issue #200 | Reviewed and tested by me before committing |
| 16 Oct 2026 | Manu | Claude Code (Claude Opus 5.5) | Running Jared's diagnosis PR #242 locally to check the triage result, and summarising feedback for him | No artefact (feedback given to Jared) | Behaviour checked by running the PR locally |
| 16–17 Oct 2026 | Manu | Claude Code (Claude Opus 5.5) | The Week 11 client meeting minutes and the Sprint 3 front-end story documents | Wiki `c6cceb7`; repo `03978fd`, `972caee` | Minutes formatted from the meeting summary Manu provided; documents approved by Manu before pushing; CI passed on both commits |
| 17 Oct 2026 | Evelyn | Claude Code (Claude Opus 5.5) | US-36 fixes found during review: freezing the service title in booking emails and the in-person meeting area on orders (backend), and showing the booked title and area on the confirmation screen (frontend); with tests and the US-36 document | PRs #243, #244, #246 | New tests failed before each fix and passed after; full backend and affected frontend tests passed locally; CI passed |
| 17 Oct 2026 | Manu | Claude Code (Claude Opus 5.5) | A desktop layout for the web app, leaving the phone layout unchanged | Commit `bad7a8b` | Checked by Manu in the browser before pushing; CI passed |
| 18 Oct 2026 | Manu | Claude Code (Claude Opus 5.5) | End-of-sprint records: ordering and closing the Sprint 1–3 board columns; the Week 11 stand-up minutes; Sprint 3 minutes copied to the repository; the Risk Register's Sprint 3 review; closing the 15 deferred stories as not planned and recording it in the Requirements and Product Backlog; the traceability implementation status and README operation count; these AI Usage Log entries | Project board; wiki pages; repo `58be17d`, `d24a9ae`, `f390862` | Board re-read after every change; risk statuses checked against the code on `dev`; contract tests passed after the traceability change; minutes formatted from the meeting summary Manu provided |


## 4. Gaps in this record

The log was agreed on 26 August and its action was marked Closed, but this page was not created until 8 October 2026. The entries before 8 October were rebuilt from four sources:

- the stand-up and supervisor minutes
- commit metadata
- disclosure notes in documents
- branch names

Any use those sources did not capture is missing. **Each member should add their own missing entries by the 14 October stand-up.** From now on, entries are added on the day.
