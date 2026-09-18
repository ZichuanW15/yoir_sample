<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Sprint 2 Review & Client Feedback
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback
  Wiki commit: d3a3eab (2026-09-18)
  Exported:    2026-09-18
-->

# Sprint 2 Review & Client Feedback

**Recorded:** 18 September 2026. **Product Owner:** Jared Cheng. **Status:** evidence-backed review and current product direction; not a claim of full acceptance or final client sign-off.

This record connects the 15 September client demonstration, subsequent email feedback and the PO's 18 September prioritisation to the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog), [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements) and [User Story Map](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/User-Story-Map). It supplements, rather than rewrites, the [15 September meeting minutes](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes#week-8). Requirements resolution from Sprint 1 is outside this update.

## 1. Source and communication record

### 1.1 Communication sources

| ID | Date / source | Evidence and boundary |
|---|---|---|
| E01 | 15 September 2026, 7:13 pm; Jared to Saumil; "Meeting Follow-up – Recording, Transcript and Yoir App" | Screenshot supplied by Jared. Confirms recording/transcript shared through Teams; asks for triage questions and recommendation guidance; invites feedback on the deployed app. Teams links and access were not independently verified for this record. |
| E02 | 17 September 2026, 11:42 am; Saumil reply | Screenshot header says "Yesterday" and was captured on 18 September; calendar date is inferred from that context. Client explains situation-based questions, blockers and recommendations. Shows `Yoir Diagnosis.xlsx` (26.2 KB) and a pitch-night reference image. |
| E03 | 17 September 2026, 3:56 pm; Saumil follow-up reply | Same date inference as E02. Client reports trying the app, gives profile/terminology/branding feedback and lists the six diagnosis steps. Shows `Yoir Diagnosis.xlsx` (27.8 KB). |
| PO01 | 18 September 2026; Jared's instruction and schedule clarification | Triage and direction/matching were originally planned for **Sprint 3** and are its highest-priority feature. Sprint 2 records feedback and refines requirements. Correct the earlier Wiki allocation; do not describe this as Sprint 2 delay/carry-over. This is not client acceptance or a new promised completion date. |
| E04 | 18 September 2026; `Yoir Diagnosis.xlsx` supplied by Jared | All 12 sheets inspected read-only: Summary, 10 topic banks and `6 step flow`. 28,488 bytes; SHA-256 `49a22b1e2b8f9e8572508e4fb13bd480c710c488445fca3ed32b883fb09c578d`. The supplied workbook is preserved unchanged. |

The email bodies are transcribed in Appendix A. Recipient email addresses and CC lists are omitted because they are not needed for requirements traceability. The screenshots are source evidence supplied to the PO, not repository-hosted attachments.

**Attachment boundary:** E04 was supplied and inspected during this update; its size is consistent with the later email's displayed 27.8 KB attachment. The earlier 26.2 KB version and original slide are not available for version comparison. E04 is the current supplied content reference, not evidence that every routing/scoring decision is settled or that the questions have been imported into the app.

### 1.2 Workbook content and open decisions

The unchanged supplied workbook is archived in this Wiki repository at `assets/client-feedback/2026-09-18-Yoir-Diagnosis.xlsx`. Jared explicitly authorised archiving this original file in the project Wiki on 18 September. The source is preserved unchanged, with the hash and exact sheet ranges recorded below.

**Access:** this is a private Wiki; an anonymous raw-file download returns 404. With a GitHub account that has repository access, use the Wiki's **Clone this wiki locally** URL (or the SSH command below), then open the archived file. Repository access permissions are unchanged.

```sh
git clone git@github.com:swen90014-2026-sm2/SWEN90014-2026-CSD-Koala.wiki.git
```

Inside the cloned Wiki, open `assets/client-feedback/2026-09-18-Yoir-Diagnosis.xlsx`.

| Sheet | Inspected range | Role / topic-question count |
|---|---|---|
| Summary | A1:A14 | Topic inventory, not extra questions. |
| Job Search | A1:E9 | 7 questions. |
| Resume | A1:E10 | 8 questions. |
| Cover Letter | A1:E7 | 5 questions. |
| KSC | A1:E6 | 4 questions on Key Selection Criteria. |
| Interview | A1:E9 | 7 questions. |
| Courses & Study | A1:E9 | 7 questions. |
| Networking | A1:E7 | 5 questions. |
| LinkedIn | A1:E7 | 5 questions. |
| Career Direction | A1:E9 | 7 questions, including free text in B3:C3 and B5:C5. |
| Skills Recognition | A1:E6 | 4 questions. |
| 6 step flow | A1:D7 | Six overarching steps, purposes and possible responses/outcomes. |

The **59 topic questions** each have question/options/interpretation/action columns. They form a conditional question bank; the six-step sheet provides the journey structure. It does not mean every user must answer all 59 questions.

- `6 step flow!D2` contains looking for work, changing careers, upskilling/study, returning to work, unclear direction and something else. Email E02 additionally mentions mature-age workers and international students as examples. Their treatment must be reconciled; they are not separate options in D2 and should not be silently added or equated to another option.
- The emails give two route examples, but neither the workbook nor the emails fully maps every entry/goal to every question and step, or defines single/multi-select and required/optional behaviour.
- Rows give qualitative indications/actions. For example `Resume!B3:E3` indicates resume-rewrite support for uncertainty/home-country format; `Interview!B3:E3` redirects no-interview cases towards resume/application support; `Career Direction!B4:E4` points uncertainty towards career exploration.
- No complete multi-answer aggregation, tie-break, professional taxonomy/ranking or free-text interpretation algorithm is supplied. Record these decisions before treating matching as fully specified. Do not invent numeric scoring or an AI requirement.
- Developer-facing red-flag notes need respectful user-facing wording and appropriate privacy. A work-rights/licensing answer should lead to relevant support/clarification, not an automated legal or employment eligibility determination.

## 2. Client feedback and product decisions

| ID | Client feedback | Recorded response / acceptance impact | Stories | Follow-up owner / state |
|---|---|---|---|---|
| FB01 | Diagnosis is what differentiates Yoir from a standard booking platform. | PO01 confirms the integrated diagnosis-to-recommendation-to-booking slice as the highest-priority Sprint 3 feature, not delayed Sprint 2 work. Do not replace it with a generic questionnaire or an optional cosmetic addition. | US-09–13, US-44–46 | Jared: Sprint 3 priority recorded; implementation and acceptance planned. |
| FB02 | Step 1 selects the user's current situation; later questions differ accordingly. | Use the six-step flow and E04 question bank. Job search routes to Job Search, Resume and Interview; career change routes to Career Direction, Courses & Study and Skills Recognition. Resolve the entry-option discrepancy and complete the remaining route/step mapping. | US-09–11 | Jared with frontend/backend/QA: workbook inspected; unresolved mapping decisions remain. |
| FB03 | Answers identify blockers and recommend a type of professional or service, followed by relevant professionals and booking. | Explain the identified support needs and the recommended direction. Preserve the recommendation context into Explore. Do not invent scoring thresholds, a ranking algorithm or an AI requirement. | US-12–13, US-44–46 | Jared: unresolved content rules to clarify; developers/QA implement and verify the approved mapping. |
| FB04 | Profiles need qualifications, experience, skills/expertise, LinkedIn, languages, services and relevant details before booking. | Extend existing profile and detail acceptance criteria; protect private fields and distinguish profile information from verification status. | US-30, US-31–32, US-46 | Frontend/backend/QA; product acceptance pending. |
| FB05 | Use Career Professional, not Career Counsellor, throughout the app. Avoid Marketplace in user-facing wording. | Use Career Professional consistently; Explore is the team's current navigation label, one of the client's suggested alternatives. Internal API/database identifiers do not need renaming solely for display copy. | Cross-cutting; US-04–05, US-30–46, US-55 | Frontend: copy update and QA sweep; not yet accepted. |
| FB06 | Typography and visuals should better reflect Yoir branding and the pitch-night reference. | Refine the existing digital prototype/screens, record the changes and review with the PO/client. Do not assert an exact font, palette or final visual approval from the small email screenshot. | Cross-cutting; diagnosis, profile and Explore screens | Frontend with Jared: design review outstanding. |
| FB07 | Booking works, but the experience should feel connected to the career journey. The app is still a work in progress. | Treat this as positive progress feedback, not sign-off of every booking/payment/platform acceptance criterion. Validate the whole recommended-service-to-booking path. | US-09–13, US-40–47, US-68 | Jared with QA: narrative acceptance session required. |

Existing sandbox payment scope is unchanged: booking → test payment → confirmation, including service price, platform commission and Career Professional amount. Live payouts, automated refunds and disputes remain deferred. The payment implementation's sample commission/cancellation/payout settings are not evidence of client approval.

## 3. Sprint 2 delivery and acceptance snapshot

**Snapshot only, 18 September:** reviewed integration commit `776899c8e59669c831b8608513c0567921cb339f` on `dev`. This record does not rerun tests, mark issues Done or change GitHub Project fields.

| Capability / evidence | What is supported by the available record | Acceptance boundary / remaining work |
|---|---|---|
| Job Seeker and Career Professional walkthroughs | Both are recorded in the 15 September meeting minutes. E03 says the client tested the flow and saw the main functionality coming together. | No per-story client sign-off is recorded. Document exact accepted and outstanding criteria with QA. |
| Account access, discovery, profile/service/availability and booking work | Implementations and existing QA evidence are available; [QA PR #155](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/155) is still open at this snapshot. | Its application baseline is `0ffa565`, with dated 15–16 September results, not proof that all criteria pass on 18 September. Consult its defect and platform-limit records. |
| Payment, email and related new integration work | Additional code merged by the 18 September `dev` snapshot. [Payment specification](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/776899c8e59669c831b8608513c0567921cb339f/docs/payment/stripe-payment-spec.md) documents the design and open settings. | Needs current-build integration and sandbox journey evidence. Old stub-payment test results cannot certify provider integration. No live-payment acceptance is asserted. |
| Deployment | [Deployment run 35305476374](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/35305476374) succeeded for the snapshot. Client demo URL: [Yoir](https://yoir-b8de6ebf.fastapicloud.dev). | Deployment success alone is not acceptance and does not prove all mobile targets or production readiness. |
| Integration testing | [Application CI run 35305476331](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/35305476331) failed in its live PostgreSQL / HTTPX / TypeScript-client journey job. | Team must resolve or explicitly disposition failures and retain new results against the delivery build. Do not report "all tests passed". |
| Diagnosis / Triage and direction / matching | E02/E03 clarify behaviour and E04 supplies the inspected question bank/flow. PO01 confirms original Sprint 3 development intent. The old Wiki/Board Sprint 2 allocation was a tracking discrepancy. | Not expected as completed Sprint 2 functionality and not a missed Sprint 2 commitment. Highest-priority Sprint 3 scope; rules, implementation and integrated acceptance remain to complete. |
| Profile richness, wording and branding feedback | E03 supplies actionable changes, now mapped to existing stories. | These changes are requirements, not claims of completed fixes. |

## 4. Sprint 2 follow-up and Sprint 3 development order

1. **Sprint 2 follow-up:** record client feedback, inspect E04, clarify remaining content/rules and prepare acceptance criteria. Finish verification of actual Sprint 2 commitments; do not require triage implementation for Sprint 2 acceptance.
2. **Sprint 3 first development slice:** authenticated entry, branching questions and safe progress (US-09–11), followed by explained direction/matching (US-12) and relevant professional/service discovery (US-13). Use the existing US-30/44–46 capabilities to connect needs to booking.
3. **Protect the integrated journey:** address blocking regressions and validate recommendation → profile/service → slot → booking → sandbox payment → confirmation. Security and data integrity remain essential dependencies.
4. **Then complete other Sprint 3 Must-haves within reviewed capacity**, followed by Should-haves. Do not silently remove existing Must-haves or promise the entire backlog without evidence and capacity review.

| Action | Accountable role / collaboration | Completion evidence |
|---|---|---|
| Workbook received/inspected; resolve source differences, routing and answer-to-direction rules, and obtain the original slide if needed | Jared, with client clarification as needed | E04 source/hash/ranges archived with permission; outstanding mapping/entry decisions and final review recorded. |
| Break down and estimate US-09–13 and link FE/BE/QA work | Developers and QA, coordinated by Manu and prioritised by Jared | Small tasks, owners, estimates, dependencies and testable AC. Existing TBD estimates are not converted to invented values. |
| Develop and test the priority slice | Frontend/backend/QA | Integrated tests, narrative demo and evidence against an identified commit/build. |
| Incorporate profile/copy/brand feedback | Frontend/backend as relevant; Jared reviews | Updated prototype/screens, comparison with feedback and QA results. |
| Finalise Sprint 2 acceptance and Sprint 3 plan | Jared with QA/developers; Manu updates tracking | Per-story result for actual Sprint 2 scope. US-09–13 are planned Sprint 3 priority work, not carry-over. Record any genuine carry-over from other stories separately. |
| Reconcile documents, issue AC and sprint fields | Jared and Manu | Consistent documentation and Board, with a dated reconciliation. This update changes Wiki documents only; Board/issue edits remain a tracked follow-up. |

**Sprint boundary:** per PO01, Triage was intended for Sprint 3 from the outset. Correcting the previous Wiki/Board allocation is a documentation/tracking correction, not a newly approved delay. Sprint 2 records clarification/preparation; Sprint 3 prioritises implementation and integrated acceptance. No Triage delay justification or Sprint 2 failure is asserted. Do not label client material as "not sent": the emails show it was sent and E04 is available and inspected.

## 5. Proposed narrative acceptance session — NOT RUN

These are planned **Sprint 3** checks, not retrospective Sprint 2 test results or client acceptance.

| Scenario | Expected observable outcome |
|---|---|
| Job search journey | An authenticated Job Seeker selects looking for work, receives the approved Job Search / Resume / Interview route, answers applicable questions and receives a support direction explained by the approved answer mapping. |
| Career change journey | Selecting changing careers gives the approved Career Direction / Courses & Study / Skills Recognition route, not the same undifferentiated questionnaire as job search. |
| Save, change and return | The same user can resume confirmed progress. Changing an earlier answer updates applicable follow-ups and does not produce a result based on stale, no-longer-applicable answers. Another account cannot access the answers. |
| Direction to booking | The user sees relevant professional/service options, can inspect qualifications, experience, expertise, LinkedIn, languages and services, then reaches the existing booking/test-payment/confirmation journey. An empty matching result or failed payment is explained without inventing success. |
| Language and visual review | User-facing screens use Career Professional and an approved discovery label; the PO/client reviews the updated Yoir visual treatment. Visual approval must be recorded separately. |

Before executing: agree the workbook-derived answer fixtures and expected directions with the PO; record app build, platform, actual result, defects and reviewer. No diagnosis-specific pass result is claimed in this document.

## Appendix A. Product communication transcripts

Transcribed from the three supplied screenshots; paragraph layout is normalised. These are source communications, not implementation instructions or evidence that every requested feature is complete. Personal addresses and distribution lists are omitted. The underlying destination of "Try the Yoir app" is not visible in E01; the project URL is separately recorded in section 3.

### E01 — Jared's follow-up, 15 September 2026, 7:13 pm

Hi Saumil,

Thanks again for meeting with us.

I've shared the meeting transcript and recording with you via Teams. If you have any trouble accessing either, please feel free to contact me.

Could you also share the questions you would like users to answer for the Diagnosis/Triage and direction/matching process? Any existing questionnaires or materials from Semester 1, including guidance on how the answers should inform recommendations, would be helpful.

You're also very welcome to explore the current version of our app:

Try the Yoir app

Please feel free to reply with any feedback, questions, or suggestions after trying it out. Your input will help us refine the experience and prioritise our remaining work.

Best regards,
Jared
On behalf of the Koala team

### E02 — Client diagnosis explanation, 17 September 2026 (inferred), 11:42 am

Hi Jared,

Attached are the diagnosis/triage questions for Yoir, plus a slide showing how the diagnosis fits into the app.

Each tab in the spreadsheet covers a topic area (Job Search, Resume, Interview, etc). The columns include the question, answer options, what each answer indicates, and suggested actions.

How it should work in the app:

1. Job seeker signs up and completes the diagnosis
2. Step 1 is the entry point — the user selects which situation best describes them (e.g. looking for a job, changing careers, mature-age worker, international student). You can see this on the attached slide which I created for one of the pitch night.
3. Based on what they pick in Step 1, they get different follow-up questions from the spreadsheet. For example, a job seeker would get Job Search, Resume and Interview questions. A career changer would get Career Direction, Courses & Study and Skills Recognition.
4. Based on their answers, Yoir identifies their main blockers (e.g. resume not Australian-adapted, no interview skills, qualifications not recognised)
5. Yoir recommends the type of career professional or service that matches their needs
6. The job seeker then sees relevant professionals and can book

The diagnosis is what makes Yoir different from a standard booking platform. It's the part that tells the user what they actually need before they start browsing.

Happy to jump on a call if you want to talk through any of it.

The screenshot also contains the pitch-night "Our solution" reference image. It is not transcribed as a complete UI specification.

### E03 — Client app feedback, 17 September 2026 (inferred), 3:56 pm

Hi Jared,

In continuation from my previous email. I have gone through the screens and also tested the flow.

I can see the main functionality coming together. I have put together some feedback to help clarify a few things from the Yoir side.

My main feedback is around making sure the app reflects the Yoir concept and not just the basic booking functionality.

A few key points:

- Career Professional profiles need to give Job Seekers enough information before they book, including qualifications, experience, skills/expertise, LinkedIn, languages, services and other relevant details.
- Please use Career Professional rather than Career Counsellor throughout the app.
- I would prefer not to use the word Marketplace in the user-facing app. Something like Explore or Career Professionals would fit Yoir better.
- The current typography and overall visual design feel quite plain. I would like the design to be closer to the Yoir branding. Screenshot in previous email can be explores which I used for pitch night.
- The booking flow is working, but I would like the experience to feel more connected to the Yoir career journey rather than a standard appointment booking system.
- Most importantly, I would like the Yoir Diagnosis/Triage and direction/matching to remain an important part of the overall journey.

I also sent through the Yoir Diagnosis questions earlier. I am reattaching the same exl again with simple 6-step Diagnosis Flow with this email as well. This is mainly to help the team understand where the diagnosis fits into Yoir and how the questions are intended to lead to a direction/recommendation for the Job Seeker.

The six steps are:

1. Where are you now?
2. What are you trying to achieve?
3. What have you tried so far?
4. Where are you getting stuck?
5. Are there any barriers affecting your next step?
6. Your Yoir Direction

I understand this is still a work in progress, so I am not expecting everything to be final at this stage. I just wanted to provide the feedback now so the team has a clearer idea of what I am looking for as you continue development.

## Documentation assistance disclosure

Codex was used on 18 September 2026 to transcribe supplied email screenshots, inspect the workbook read-only, organise the feedback/acceptance record and draft linked requirement/story-map updates. The purpose was to preserve traceability and align documents without inventing decisions or test results. Sources, story-ID consistency and links were checked during preparation; human content review remains with the PO/team. This note covers this documentation update only, not all AI use elsewhere in the project.
