<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Requirements
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements
  Wiki commit: 9e20263 (2026-10-18)
  Exported:    2026-10-18
-->

# Yoir Requirements — Current Koala Delivery Scope

**Updated 8 October 2026.** Frontend and backend share the **43 active stories** in [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog). This replaces the obsolete 48-story scope which excluded diagnosis and included deferred Forum, messaging and disputes. This update adds the sprint allocation of all 43 stories (§7) and the requirements resolution record (§8), and brings the repository copy, `docs/sprint1/project/requirements.md`, in line with this page. The story requirements in §2–§5 are unchanged from 18 September. This is a team delivery view, not a new independent cross-team baseline; changes/deviations must be reconciled with the partner PO in the [shared requirements repository](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Baselined-Requirements).

Sources: [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback). **US-09–13 Diagnosis/Triage and direction/matching are the highest-priority Sprint 3 development feature**, as the PO clarified on 18 September. They were originally intended for Sprint 3, not deferred from Sprint 2. Sprint 2 captures the new feedback and refines these requirements. Existing IDs and estimates are retained; requirements do not imply completed implementation or acceptance.

**Updated 18 October 2026, end of Sprint 3.** The 15 deferred stories that were still open on GitHub were closed as *not planned* (§1, RR-20). Nothing else on this page changed.

## 1. Product boundary and terminology

- Primary journey: create account → log in → diagnosis/triage → explained direction → relevant Career Professionals/services → choose slot → book → sandbox payment → confirmation → service → review.
- Target: integrated mobile-first MVP supporting iOS and Android for testing/demonstration; public app-store release is not required. Browser deployment alone is not mobile acceptance.
- User-facing roles: Job Seeker, **Career Professional**, Platform Owner. Do not use Career Counsellor or Marketplace as current app labels. **Explore** is the team's working discovery label, one of the client's suggested alternatives. Existing technical identifiers may remain for compatibility.
- Public discovery may remain available. The preferred authenticated journey makes diagnosis central before recommending support; mandatory completion versus skipping remains a PO/client decision, not an invented access restriction.
- Forum, order-linked messaging, automated cancellation/refunds, disputes, live payouts, advanced notifications/search, automated LinkedIn verification, international rollout, multilingual UI and advanced AI remain deferred. Do not restore them implicitly through superseded frontend/backend lists.
- The 15 deferred stories, Forum (US-14–22), order-linked messaging (US-49, US-50, US-62, US-63) and after-sales and disputes (US-51, US-52), were not targeted this semester. Their priority was lower than the core journey relative to their story points and the team's capacity across three sprints. Their issues were closed as *not planned* on 18 October 2026; the requirements stay recorded here and in the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog) so a later team can restore them through a traceable baseline change.
- In Sprint 3, develop the integrated diagnosis-to-support slice first. Security, data integrity and blocking integration fixes remain essential; other Must-haves remain active and Should-haves follow them.

## 2. Account and profile requirements

### Authentication and accounts

- **US-01:** Job Seeker registration collects name, email, password, confirmation and role.
- **US-02:** Valid registration creates an account, securely hashes credentials, shows success and directs the user to login.
- **US-03:** Duplicate email creates no extra account and produces a clear error while retaining safe form inputs.
- **US-04:** A Career Professional registers through the shared flow using that user-facing role label.
- **US-05:** First-login professional onboarding directs the user to profile and verification setup before publishing services.
- **US-06:** Valid credentials create an authenticated session and route to role-appropriate functions, including the Job Seeker diagnosis entry.
- **US-07:** Invalid credentials return safe generic feedback without revealing which credential failed or creating a session.
- **US-08:** Logout invalidates the session, leaves authenticated screens and prevents token replay or navigation back into private data.
- **US-70:** Secure password reset uses a time-limited link and valid new password without disclosing account existence. An unreviewed email-verification recommendation is not a separate client-approved feature.

### Privacy, profiles and verification

- **US-27:** Users can select public, partially visible or restricted profile visibility.
- **US-28:** API and UI enforce the chosen visibility for other users; hiding a field only in the UI is insufficient.
- **US-29:** Job Seekers can maintain agreed core profile data; record the exact fields without unnecessary collection.
- **US-30:** Career Professionals can maintain photo, introduction, background, qualifications, experience, skills/expertise, LinkedIn URL, spoken languages, base location and default modality. Link published services from the profile, respect privacy, and distinguish self-entered information from verified credentials.
- **US-31:** Submit a valid LinkedIn profile URL for manual Platform Owner review; automated integration is not required.
- **US-32:** Display pending, verified and rejected outcomes consistently in relevant profile/service-management views.
- **US-33:** Additional manual investigation updates the verification outcome consistently; remains Should-have.
- **US-58:** An authorised Platform Owner can inspect submissions and approve, reject or retain pending status.

## 3. Priority Diagnosis/Triage and direction requirements

### 3.1 Source, flow and routing boundary

Content source: `Yoir Diagnosis.xlsx`, supplied 18 September, SHA-256 `49a22b1e2b8f9e8572508e4fb13bd480c710c488445fca3ed32b883fb09c578d`. See [workbook inventory and source](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback#12-workbook-content-and-open-decisions). It contains Summary, **10 topic banks / 59 topic questions**, and `6 step flow`. The topic banks are a conditional question pool, not a requirement to ask all questions to every user.

| Step | Client question | Purpose / source |
|---|---|---|
| 1 | Where are you now? | Current situation; `6 step flow!A2:D2`: Looking for a job; Thinking about changing careers; Looking to upskill or study; Returning to work; Not sure what career direction to take; Something else. |
| 2 | What are you trying to achieve? | Immediate goal; supplied options in `6 step flow!A3:D3`. |
| 3 | What have you tried so far? | Previous actions; `6 step flow!A4:D4`. |
| 4 | Where are you getting stuck? | Main challenge; `6 step flow!A5:D5`. |
| 5 | Are there any barriers affecting your next step? | Relevant barriers; `6 step flow!A6:D6`. |
| 6 | Your Yoir Direction | Main area to work on, suggested next steps, relevant professionals/services and View Career Professionals; `6 step flow!A7:D7`. |

The emails mention mature-age workers and international students as entry examples; these are **not separate options in the supplied six-step sheet**. Use the workbook as the current content reference and resolve this difference with the PO/client before locking entry options. Do not silently add, remove or equate categories.

Email-confirmed examples: job search routes to Job Search, Resume and Interview; career change routes to Career Direction, Courses & Study and Skills Recognition. Exact placement within the six steps, other routes, multi-select behaviour and answer-dependent exceptions require a recorded mapping. Do not show everyone identical follow-ups or infer routing from demographics without an approved need-based rule.

### 3.2 Acceptance criteria by existing story

| Story | Testable acceptance criteria |
|---|---|
| **US-09 — Enter diagnosis** | An authenticated Job Seeker can clearly start/resume from the main journey and understands how diagnosis helps choose support. Saved progress belongs to that account. Unauthenticated/other-account requests cannot retrieve it. Step 1 uses approved situation options; no new mandatory-completion gate is inferred. |
| **US-10 — Complete six steps** | Present the six named steps in order with approved workbook-derived content and conditional follow-ups. Job-search and career-change fixtures show their approved, different topic routes. Preserve discrete options and free-text questions (`Career Direction!B3:C3`, `B5:C5`). Do not ask everyone all 59 questions. |
| **US-11 — Progress safely** | Validate applicable required answers, explain errors, allow back/continue and resume confirmed progress. Changing an earlier answer must stop no-longer-applicable answers influencing the result. Failed saves are not shown as successful and do not discard confirmed progress. Record required/optional and single/multi-select rules before acceptance. |
| **US-12 — Receive direction/matching** | Approved answer fixtures produce the mapped support need, suggested next steps and relevant professional/service types, explained using the user's answers. Results are reproducible for the approved rule version. Aggregate multiple signals only through approved precedence rules. Ambiguous/unmapped inputs produce honest clarification, not fabricated scores, eligibility decisions or professional matches. |
| **US-13 — Continue into Explore** | View Career Professionals opens relevant available options, preserving recommendation context and saved diagnosis. Inspect full public profile/service details and proceed through booking without repeating triage. Distinguish no matches from retrieval failure; never present unavailable services as bookable. |

These are requirements, not executed tests. Stale-branch handling, privacy and no-match states operationalise the existing stories; they are not quoted as additional client promises.

### 3.3 Source-backed examples and open decisions

| Workbook evidence | Direction to preserve in approved test fixtures |
|---|---|
| `Resume!B3:E3` | Unsure about Australian resume format / using home-country format indicates resume-rewrite support. |
| `Interview!B3:E3` | No interview invitations points first to resume/application support, not automatically interview coaching. |
| `Interview!B9:E9` | Difficulty with behavioural questions indicates STAR-method training; no invitations redirects to Resume/Job Search. |
| `Career Direction!B4:E4` | "I don't know" about desired work indicates career exploration before job search. |

These are client-authored qualitative rules, not independently validated claims about employment outcomes. Translate developer-facing `What this tells me` / `Red flag / action` notes into respectful user guidance rather than displaying all internal wording verbatim.

**Open:** entry-option discrepancy; complete route/step mapping; required/optional and single/multiple-selection rules; cross-answer priority, ties and contradictions; professional/service taxonomy and ranking; free-text interpretation; skip/retake policy; privacy/retention/access rules. The workbook supplies neither a numeric scoring model nor a complete matching algorithm. Do not infer an AI requirement or make automated legal/employment eligibility decisions from work-rights/licensing answers; suggest appropriate professional clarification.

## 4. Service discovery, booking and completion

### Service management and availability

- **US-34:** An eligible professional can begin creating a service from My Services.
- **US-35:** Validate title, description, category, price, duration/delivery and required information; show field-level errors.
- **US-36:** Edit/remove future offerings without corrupting historical orders.
- **US-37:** Require online, in-person or both as the service modality.
- **US-38:** In-person services require state and city/region meeting-area information.
- **US-39:** Authorised professionals can add, edit and remove slots in a weekly availability calendar.
- **US-40:** Only currently open slots are selectable for the chosen service.
- **US-41:** Reserve/confirm atomically to prevent double-booking; explain conflicts and refresh availability.
- **US-42:** Professional My Bookings shows upcoming/past bookings with service, Job Seeker, modality, time and pre-session information.
- **US-43:** Details show participants, service, time, pre-session information and online link or in-person delivery details; order-linked chat is deferred.
- **US-68:** Confirmation includes reference, participants, service, time/timezone, modality, payment status, delivery details and next actions. Pending/failed payment does not become confirmed without backend confirmation.
- **US-69:** Authorised participants can reschedule eligible bookings to an open slot without duplicate orders or losing the original booking on failure. Policy remains to be agreed; Should-have.

Collect service, modality, open slot and a short pre-session brief before payment. Display clear timezones. Slot-hold/expiry UI must match the implemented and tested backend policy, not an unsupported countdown.

### Explore and informed selection

- **US-44:** Public users browse available Career Professionals/services; diagnosis can direct users into this existing capability.
- **US-45:** Search/filter/sort uses supported keyword, category, price, rating, location, spoken-language and modality fields with honest empty/error states. Unsupported filtering must not appear to work solely through demo data.
- **US-46:** Before booking, display qualifications, experience, skills/expertise, LinkedIn, languages and services alongside ratings/reviews, service description/price, modality/location and booking details. Respect public-field permissions, show missing information honestly and distinguish profile information from verification status.

### Sandbox payment and oversight

- **US-47:** Complete a sandbox/test purchase through the agreed boundary, record its order/booking and show service price, Yoir commission and professional amount. Never store raw card data. Display actual pending/success/failure states and prevent duplicate transaction effects.
- **US-48:** Authorised Platform Owners inspect transaction status, parties, order progress and the same price/commission/professional breakdown.
- **US-71:** Authorised Platform Owners view users with role and relevant account/verification status; professional approval/rejection remains in US-58.

Live payouts, automated refunds and disputes remain deferred. Configured test commission and other implementation placeholders are not final client-approved commercial policy; additional code does not silently expand the acceptance scope.

### Ratings and reviews

- **US-53:** An eligible buyer submits a one-to-five-star rating and written review for a completed purchased service.
- **US-54:** Service views show consistent updated averages, review counts and reviews.
- **US-55:** Professional profiles and Explore show a consistently calculated overall rating; agree and test the aggregation rule.

## 5. Non-functional and implementation requirements

- Support agreed iOS/Android versions, devices/simulators and screen sizes with readable text, accessible touch/keyboard interactions and clear loading/validation/error states.
- Refine existing digital prototype/screens towards Yoir branding using the client reference and record PO/client review. The email alone establishes no exact font/palette or final design approval.
- Enforce roles, ownership and privacy server-side. Diagnosis answers are private to the user and explicitly authorised access, not public profile data; do not expose raw answers in public discovery or routine logs.
- Use persisted application data, not demo fallbacks, for accepted integrated journeys. Do not claim save/payment/booking/verification/review success without backend confirmation.
- Trace recommendations to relevant questions, answers and approved rule versions so QA can reproduce expected outcomes. Numeric scoring, machine learning and generative AI are not required by the supplied material.
- Backend scope uses the same 43 active IDs above. It supplies authenticated diagnosis/progress storage, validation, approved recommendation rules and discovery integration alongside account/profile/service/booking/payment functions. The old Forum/messaging/disputes list is superseded.
- Existing technology direction remains Python/FastAPI, PostgreSQL, JSON REST and the project's authenticated session/token design. A cache/queue product is not a product requirement just because an old document named it; use maintained design/interface contracts for technical choices.

## 6. Acceptance and change traceability

Use [Product Backlog DoR/DoD](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog) and the [review's proposed narrative checks](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback#5-proposed-narrative-acceptance-session--not-run). Each accepted story needs identified build/platform evidence and an explicit result. Merged PRs, closed subtasks, deployment or positive general client feedback alone do not establish whole-story acceptance.

The 18 September change updated four Wiki documents. The 8 October update adds §7 and §8 and replaces the repository copy's obsolete 48-story front-end and back-end baseline with this page. Issue AC, Project sprint fields and historical Miro visuals are not silently changed; tracking reconciliation is a follow-up. Cross-team baseline agreement/deviations remain explicit PO work, not an assertion of partner-team approval.

## 7. Story allocation by sprint

Every one of the 43 active stories has a sprint. Sprint 2 committed 20 stories (69 SP). Sprint 3 holds the other 23 (60 SP known, plus seven stories still to estimate). The allocation comes from the project board on 8 October 2026. It records the plan, not acceptance.

| Epic | Sprint 2 (31 Aug – 20 Sep) | Sprint 3 (21 Sep – 18 Oct) |
|---|---|---|
| A — Authentication and Accounts | US-01, US-02, US-03, US-04, US-06, US-07, US-08 | US-05, US-70 |
| B — Yoir Diagnosis and Direction | — | US-09, US-10, US-11, US-12, US-13 |
| C — Privacy and User Profiles | US-30 | US-27, US-28, US-29 |
| D — Career Professional Verification | — | US-31, US-32, US-33, US-58 |
| E — Service Management | US-34, US-35, US-37, US-38 | US-36 |
| F — Availability and Booking | US-39, US-40, US-41, US-68 | US-42, US-43, US-69 |
| G — Explore (discovery) | US-44, US-45, US-46 | — |
| H — Payment and Orders | US-47 | US-48 |
| J — Reviews and Ratings | — | US-53, US-54, US-55 |
| K — Platform Owner User Oversight | — | US-71 |
| **Total** | **20 stories, 69 SP** | **23 stories, 60 SP + 7 to estimate** |

The seven stories without an estimate are US-09–13, US-29 and US-71. Estimating them is an action from [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning). They are not counted in any total until the estimates are agreed.

## 8. Requirements resolution record

This record lists each change to the requirements since the Sprint 1 baseline, where it came from, who decided it and who reviewed it. A change is **Resolved** only when the decision and its reviewer are recorded. Anything without a recorded reviewer stays **Open**, with the person responsible for closing it.

**Who resolves requirements.** The Product Owner (Jared) owns the requirements and decides changes. The client (Saumil Macwan, "Sam") confirms product behaviour. The supervisor (Erfan Farabi) reviews scope and feasibility. The partner team's Product Owner (team Quokka) agrees the shared baseline in the [shared requirements repository](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Baselined-Requirements). The Scrum Master (Manu) keeps this page, the backlog and the board consistent.

### 8.1 Resolved

| ID | Date | Change | Source | Decided by | Reviewed by |
|---|---|---|---|---|---|
| RR-01 | Sprint 1 | Shared baseline requirements agreed with the partner team. | [Daily Standups](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups), Week 4 | Jared with the Quokka PO | Jashan reviewed the backend baseline; no changes needed |
| RR-02 | 25 Aug | The app interface is English-only for launch. Career Professionals list the languages they speak, and Job Seekers can filter by language (US-30, US-45, US-46). | [Joint client meeting, 25 Aug](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes) | Client | Erfan, Jared and Manu, at the meeting |
| RR-03 | 26 Aug | Payments run through Stripe in test mode; no real money moves this semester (US-47). | [Daily Standups](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups), 26 Aug | Team | Jared, in the Sprint 2 Review (18 Sep) |
| RR-04 | 27 Aug | Yoir is a native mobile app for iOS and Android, not a web application. The web build is a demo convenience. | Client decision, recorded at the [supervisor meeting](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Mentor-Communication-Log) on 27 Aug | Client | Erfan |
| RR-05 | Sprint 1 | Career Professional verification uses a submitted LinkedIn URL and manual Platform Owner review. There is no LinkedIn API integration (US-31–33, US-58; `CLIENT-01`). | Client decision `CLIENT-01` | Client | Jared, in the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog) |
| RR-06 | 17 Sep | User-facing copy says **Career Professional**, not Career Counsellor, and **Explore**, not Marketplace. Routes, role values and API identifiers keep their names. | Client email E03 (FB05), [Sprint 2 Review](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback) | Client | Jared; applied 18 Sep ([Feedback Implemented](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Client-Feedback-Response)) |
| RR-07 | 17 Sep | Career Professional profiles show qualifications, experience, skills and expertise, LinkedIn, languages and services before booking (US-30, US-46). | Client email E03 (FB04) | Client | Jared; applied 18 Sep ([Feedback Implemented](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Client-Feedback-Response)) |
| RR-08 | 18 Sep | Active scope is **43 stories**, replacing the 48-story baseline. Added: US-09–13, US-29, US-68, US-69, US-70, US-71. Deferred: Forum (US-14–22), order-linked messaging (US-49, US-50, US-62, US-63) and disputes (US-51, US-52). Stories already outside the baseline stay deferred. | [Sprint 2 Review](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback), [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog) | Jared | Team, at [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning) (7 Oct) |
| RR-09 | 18 Sep | Diagnosis/Triage and direction (US-09–13) is the highest-priority Sprint 3 feature. It was always planned for Sprint 3 and is not Sprint 2 carry-over. | PO clarification PO01 | Jared | Team, at [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning) (7 Oct) |
| RR-10 | 18 Sep | The diagnosis content source is the client's `Yoir Diagnosis.xlsx` (SHA-256 recorded in §3.1): the six-step flow and 10 topic banks. | Client emails E02, E03; workbook E04 | Client | Jared, who inspected and archived the workbook |
| RR-11 | 18 Sep | In-app notifications (US-60, US-61) stay deferred; the client ranked them lower priority. The notifications dropdown on the front end does not bring them back into scope. | [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog); front-end feedback record | Jared | Team, at [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning) (7 Oct) |
| RR-12 | 18 Sep | Redis and other cache or queue products are not product requirements. Technical choices live in the design concept and the interface contracts. | §5 of this page | Jared | Team, at [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning) (7 Oct) |
| RR-20 | 18 Oct | The 15 deferred stories, Forum (US-14–22), order-linked messaging (US-49, US-50, US-62, US-63) and after-sales and disputes (US-51, US-52), were not targeted this semester because of their lower priority relative to story points and team capacity. Their issues were closed as *not planned* at the end of Sprint 3; their requirements stay on this page and in the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog). | RR-08; [Sprint 3 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Review-and-Client-Feedback) | Team, at the end of Sprint 3 | Jared (PO), to confirm |

### 8.2 Open

| ID | Raised | Question to resolve | Affects | Owner | Reviewer needed |
|---|---|---|---|---|---|
| RR-13 | 18 Sep | Does Step 1 include mature-age workers and international students (named in email E02 but not in the workbook's six-step sheet)? | US-09, US-10 | Jared | Client |
| RR-14 | 18 Sep | Complete the diagnosis rules: the route from each Step 1 answer, required versus optional questions, single versus multiple selection, how answers combine into one direction (priority, ties and contradictions), professional and service types, free-text handling, skip and retake, and how long answers are kept. | US-10–13 | Jared | Client |
| RR-15 | 17 Sep | Approve the branding and typography changes against the pitch-night reference. | Cross-cutting (FB06) | Jared | Client |
| RR-16 | 18 Sep | Confirm the 43-story scope with the partner team in the shared requirements repository. | All | Jared | Quokka PO |
| RR-17 | 18 Sep | Agree the reschedule policy: notice period, number of reschedules and who can reschedule. | US-69 | Jared | Client |
| RR-18 | 18 Sep | Agree the overall-rating rule: plain average of all reviews, or weighted by service. | US-55 | Jared | Team |
| RR-19 | 18 Sep | Confirm the commission rate, and whether Career Professional payouts go through Stripe or are paid manually. The test values in code are placeholders, not client policy. | US-47, US-48 | Jared | Client |

**How to use this record.** Raise a requirement change at a stand-up, client meeting or supervisor meeting and add it to §8.2 the same day. When the decision and its reviewer are recorded, move it to §8.1 and update the affected story in §2–§5, the [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog) and the issue's acceptance criteria together.
