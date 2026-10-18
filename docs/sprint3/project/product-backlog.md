<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Product Backlog
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog
  Wiki commit: c5be4bb (2026-10-18)
  Exported:    2026-10-18
-->

# Yoir Product Backlog

**Updated 18 September 2026:** [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback) records the client's emails and the PO clarification that **US-09–13 Diagnosis/Triage and direction/matching were always planned for Sprint 3 and are its highest-priority development feature**. Sprint 2 captures feedback and refines requirements; this is not delayed Sprint 2 scope. IDs, estimates and the 43-story active scope are retained; no acceptance or Board-field changes are implied.

## 1. Product Goal

Yoir is a mobile-first career-advisory platform. The Semester 2 product is a working, integrated MVP that supports iOS and Android and can be tested and demonstrated by the client. A production release through the App Store or Google Play is not required for the semester MVP. Public Explore browsing may remain available, while the preferred Job Seeker journey begins with account access and the Yoir diagnosis/triage.

The primary service journey is:

```text
create account -> log in -> complete Yoir diagnosis/triage -> receive relevant direction/matching -> browse/search career professionals -> select professional/service -> choose available slot -> book -> test payment -> booking confirmation -> service -> review/rating
```

Professional/service discovery and the end-to-end diagnosis-to-review journey form the semester MVP. Forum, order-linked messaging, automated cancellation/refunds, dispute handling, advanced notifications, advanced search, automated LinkedIn verification, live payouts, international rollout, multilingual interface support, and advanced AI features are deferred unless capacity is explicitly approved after the core journey is complete.

## 2. Backlog Summary

The revised active Product Backlog contains **43 stories**. Of these, 36 retained stories have existing estimates totalling **129 SP** and seven restored or newly clarified stories require cross-team estimation. A final total must not be reported until those seven estimates are agreed. On 18 October 2026, at the close of Sprint 3, the team estimated the seven with the sizing guide: US-09 3, US-10 5, US-11 3, US-12 5, US-13 3, US-29 3 and US-71 2 (24 SP), so the active backlog now totals **153 SP**. Confirming the 43-story scope with the partner team remains open (Requirements RR-16).

| Metric | Active backlog |
|---|---:|
| User stories | **43** |
| Must-have | **41 stories / 144 SP** |
| Should-have | **2 stories / 9 SP** |
| Total estimate | **153 SP** |

Priority definitions:

- **Must-have:** required to deliver the client-confirmed end-to-end MVP journey.
- **Should-have:** valuable within the semester, but scheduled only after its Must-have dependencies.
- **Deferred:** outside the active semester MVP unless a later capacity decision explicitly restores it.

Status definitions:

- **Baseline:** included in the revised active Product Backlog. Both teams must use the same ID, priority, and behaviour.
- **TBD estimate:** the scope is confirmed, but story points must be agreed by both teams before sprint commitment. No story has been in this state since 18 October 2026.

## 3. Ordered Product Backlog

Backlog order is represented first by epic order and then by story order within each epic. Dependency and workflow order may override numeric ID order during sprint planning.

**Sprint 3 priority (PO, 18 September):** deliver the integrated US-09 → US-10/11 → US-12 → US-13 slice first, using the account, professional-profile, discovery and booking dependencies already in scope. Required security/data-integrity fixes and blocking regressions remain essential. Other Sprint 3 Must-haves remain active and follow this slice; Should-haves and deferred additions must not displace it. Sprint 2 work here is feedback capture, content clarification and acceptance planning. Triage is planned Sprint 3 work, not Sprint 2 carry-over.

### Epic A - Authentication and Accounts

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-01` | Register as a Job Seeker. | A visitor can open registration and provide name, email, password, password confirmation, and the Job Seeker role. | Must-have | 3 | Baseline |
| `US-02` | Create a valid Job Seeker account securely. | Valid data creates the account, stores the password securely, shows success, and directs the user to login. | Must-have | 3 | Baseline |
| `US-03` | Receive a useful duplicate-email error. | An existing email does not create another account and produces a clear form-level error. | Must-have | 2 | Baseline |
| `US-04` | Register as a Career Professional. | A visitor can select the Career Professional role and register through the shared account flow. | Must-have | 3 | Baseline |
| `US-05` | Complete first-login career professional onboarding. | A new career professional is directed to professional-profile and verification setup before publishing services. | Must-have | 4 | Baseline |
| `US-06` | Log in and reach role-appropriate functions. | Correct credentials create an authenticated session and route the user appropriately. | Must-have | 4 | Baseline |
| `US-07` | Receive safe feedback for failed login. | Invalid credentials do not authenticate the user and produce a generic email-or-password error. | Must-have | 2 | Baseline |
| `US-08` | Log out securely. | Logout invalidates the session, redirects appropriately, and blocks reuse of authenticated pages. | Must-have | 2 | Baseline |
| `US-70` | Reset a forgotten password securely. | A registered user can request a secure, time-limited reset link and set a new valid password without exposing account existence. | Must-have | 5 | Baseline |

**Epic total:** 28 SP

### Epic B - Yoir Diagnosis and Direction

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-09` | Enter the Yoir diagnosis journey. | A logged-in Job Seeker can start or resume triage as the primary post-login journey, beginning with their current situation. | Must-have | 3 | Baseline |
| `US-10` | Complete the six-step Yoir triage. | Present the client's six named steps and situation/answer-dependent follow-up questions from the supplied workbook, preserving its options and free-text question types. | Must-have | 5 | Baseline |
| `US-11` | Progress through triage safely. | Validate applicable required answers, preserve confirmed progress, support back/resume and prevent stale answers from an abandoned branch influencing the direction. | Must-have | 3 | Baseline |
| `US-12` | Receive relevant direction or matching. | Explain the main support need and suggested next steps from approved answer-to-action rules, and recommend relevant Career Professional/service types without inventing scores or unsupported advice. | Must-have | 5 | Baseline |
| `US-13` | Continue from diagnosis to Explore. | Carry the direction into relevant professional/service discovery and booking without requiring the user to repeat triage; explain no-match and retrieval-failure states accurately. | Must-have | 3 | Baseline |

**Epic total:** 19 SP

**Source and detailed acceptance:** [Requirements §3](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements#3-priority-diagnosistriage-and-direction-requirements) records the six steps, workbook ranges, testable criteria and outstanding routing/ranking decisions. The workbook is a topic/question bank plus an overarching six-step flow, not a requirement to ask every user all 59 topic questions. See [source inventory](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback#12-workbook-content-and-open-decisions).

### Epic C - Privacy and User Profiles

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-27` | Control profile visibility. | A user can select public, partially visible, or restricted profile visibility. | Must-have | 4 | Baseline |
| `US-28` | Have privacy settings enforced. | Other users receive only the profile fields allowed by the selected visibility setting. | Must-have | 2 | Baseline |
| `US-29` | Maintain a Job Seeker profile. | A Job Seeker can create, view, and update the agreed core profile information used in their account and service journey. | Must-have | 3 | Baseline |
| `US-30` | Maintain a Career Professional profile. | A Career Professional can manage photo, introduction, background, qualifications, experience, skills/expertise, LinkedIn URL, spoken languages, base location and default modality; linked services are visible in the public profile subject to privacy and publication rules. | Must-have | 5 | Baseline |

**Epic total:** 14 SP

### Epic D - Career Professional Verification

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-31` | Submit a LinkedIn profile for verification. | A career professional can submit a valid LinkedIn URL for Platform Owner review. | Must-have | 4 | Baseline |
| `US-32` | See the verification result. | Relevant career professional views consistently show pending, verified, or rejected status. | Must-have | 3 | Baseline |
| `US-33` | Receive the outcome of an additional manual investigation. | Completing an additional review updates the career professional's verification outcome consistently. | Should-have | 4 | Baseline |
| `US-58` | Review career professional verification as a Platform Owner. | A Platform Owner can inspect a submission and approve, reject, or leave it pending. | Must-have | 4 | Baseline |

**Epic total:** 15 SP

### Epic E - Career Professional Service Management

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-34` | Create a career professional service. | An eligible career professional can open My Services and begin creating a service. | Must-have | 5 | Baseline |
| `US-35` | Describe and price a service. | The service form accepts required service information and rejects invalid or incomplete data. | Must-have | 4 | Baseline |
| `US-36` | Edit or remove future service offerings. | A career professional can change active listings without corrupting historical orders. | Must-have | 3 | Baseline |
| `US-37` | Declare how a service is delivered. | A service requires online, in-person, or both as its supported modality. | Must-have | 2 | Baseline |
| `US-38` | Provide an area for in-person delivery. | An in-person service requires state and city/region meeting information before saving. | Must-have | 3 | Baseline |

**Epic total:** 17 SP

### Epic F - Availability and Booking

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-39` | Manage career professional availability. | A career professional can add, edit, and remove available slots in a weekly calendar view. | Must-have | 5 | Baseline |
| `US-40` | Select only an open booking slot. | A Job Seeker sees only currently open slots as selectable for the service. | Must-have | 3 | Baseline |
| `US-41` | Prevent double-booking. | Confirming or reserving a slot makes it unavailable, and conflicting requests are rejected safely. | Must-have | 3 | Baseline |
| `US-42` | View upcoming and past career professional bookings. | My Bookings shows the service, Job Seeker, modality, time, and pre-session information. | Must-have | 4 | Baseline |
| `US-43` | Open a booking's working details. | An upcoming booking shows the participants, service, time, pre-session information, and online or in-person delivery details. | Must-have | 3 | Baseline |
| `US-68` | Receive a clear booking confirmation. | A confirmed booking displays its reference, participants, service, time, timezone, modality, payment status, delivery information, and next actions. | Must-have | 3 | Baseline |
| `US-69` | Reschedule an upcoming booking safely. | An authorised participant can move an eligible confirmed booking to another open slot without duplicating the order or losing the original booking on failure. | Should-have | 5 | Baseline |

**Epic total:** 26 SP

### Epic G - Explore Discovery

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-44` | Browse career professionals and services. | Public users can browse available career professional and service listings. | Must-have | 4 | Baseline |
| `US-45` | Find relevant services efficiently. | Public search, filter, and sorting use supported fields such as keyword, category, price, rating, location, spoken language, and modality. | Must-have | 4 | Baseline |
| `US-46` | Evaluate a professional and service before purchase. | Before booking, a Job Seeker can inspect the professional's qualifications, experience, skills/expertise, LinkedIn, languages and services, plus ratings, service price, modality/location and booking details. Missing information is shown honestly; private fields and unverified claims are not presented as verified. | Must-have | 4 | Baseline |

**Epic total:** 12 SP

### Epic H - Payment and Orders

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-47` | Complete a platform-supervised test purchase. | A sandbox/test payment records the transaction and associated booking/order without storing raw card data, and shows the service price, Yoir commission, and Career Professional amount using the configured test commission. | Must-have | 5 | Baseline |
| `US-48` | Inspect transaction progress as a Platform Owner. | A Platform Owner can see booking/order progress, payment status, relevant participants, service price, Yoir commission, and Career Professional amount in the test environment. | Must-have | 4 | Baseline |

**Epic total:** 9 SP

### Epic J - Reviews and Ratings

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-53` | Review a completed purchased service. | An eligible buyer can submit a one-to-five-star rating and written comment from a completed order. | Must-have | 4 | Baseline |
| `US-54` | See updated service-level feedback. | A submitted review updates the service average, count, and review list consistently. | Must-have | 3 | Baseline |
| `US-55` | Judge a career professional's overall service quality. | Career Professional profiles and Explore listings show a consistently calculated overall rating. | Must-have | 4 | Baseline |

**Epic total:** 11 SP

### Epic K - Platform Owner User Oversight

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-71` | View platform users as a Platform Owner. | A Platform Owner can view Job Seekers and Career Professionals with their role and relevant account/verification status; career professional approval and rejection remain governed by `US-58`. | Must-have | 2 | Baseline |

**Epic total:** 2 SP

## 4. Stories Outside the Active Backlog

The following IDs are not included in the revised active 43-story backlog:

```text
US-14 US-15 US-16 US-17 US-18 US-19 US-20 US-21 US-22
US-23 US-24 US-25 US-26
US-49 US-50 US-51 US-52
US-56 US-57 US-59 US-60 US-61
US-62 US-63 US-64 US-65 US-66 US-67
```

- `US-14`-`US-22` and `US-23`-`US-26` cover the Forum and its related navigation. The Forum is deferred so the team can complete the core diagnosis-to-review journey first.
- `US-49`, `US-50`, `US-62`, and `US-63` cover order-linked messaging. Messaging is deferred as a lower-priority capability.
- `US-51` and `US-52` cover dispute submission and resolution. Refunds and dispute handling are deferred; the MVP retains basic read-only payment/order oversight through `US-48`.
- `US-56`, `US-57`, and `US-59`-`US-61` cover broader administration, moderation, and global notifications. The MVP adds only the minimum user overview in `US-71`; career professional verification remains in `US-58`.
- `US-64` and `US-65` cover nearby/advanced discovery and remain deferred. Basic location and spoken-language filtering remain in `US-45`.
- `US-66` and `US-67` cover interface-language switching and saved interface-language preference. They remain deferred because spoken languages are profile/search data, not multilingual UI support.

Restoring a deferred story requires a traceable baseline change applied to both teams' requirements and the Project Board.

At the end of Sprint 3 (18 October 2026) the issues for Forum (US-14–22), order-linked messaging (US-49, US-50, US-62, US-63) and after-sales and disputes (US-51, US-52) were closed as *not planned*. They were not targeted this semester because of their lower priority relative to their story points and the team's capacity; they remain in this backlog as deferred (Requirements RR-20).

## 5. Client Decisions Affecting the Backlog

| ID | Status | Confirmed decision or remaining question | Affected backlog area |
|---|---|---|---|
| `CLIENT-01` | **Confirmed by client email** | Use LinkedIn URL submission plus manual Platform Owner review. LinkedIn API integration and automated verification are optional, lower-priority work only. | `US-31`-`US-33`, `US-58` |
| `CLIENT-02` | **Confirmed by client email** | Use a secure sandbox/test payment provider for the MVP. Show service price, Yoir commission, and Career Professional amount, but defer live payouts, refunds, and disputes. The provider and final commission percentage remain implementation/business decisions. | `US-47`, `US-48`, booking confirmation and payment-dependent states |
| `CLIENT-03` | **Confirmed 2026-08-25** | The interface may be English-only. Career Professionals' spoken languages are profile/search data, so keep `US-66` and `US-67` deferred while adding language to `US-30` and `US-45`. | Profile, Explore filtering, localisation scope, and acceptance tests |
| `CLIENT-04` | **Confirmed by client email** | Deliver a working, integrated mobile MVP supporting iOS and Android for testing and demonstration. A full production release through the App Store and Google Play is not required this semester. | Product Goal, Definition of Done, packaging, and platform testing |
| `CLIENT-05` | **Confirmed by client email** | Prioritise the complete diagnosis-to-review journey. Forum, messaging, advanced notifications/search, automated cancellation/refunds, disputes, actual payouts, international rollout, multilingual UI, and advanced AI may be deferred. | Active/deferred story set and priority fields |
| `CLIENT-06` | **Technical recommendation pending** | The client requested a recommendation on email verification and other standard authentication-security steps. Secure password reset is already included in `US-70`; email verification must not be treated as confirmed scope until the recommendation is reviewed. | Authentication acceptance criteria and security testing |
| `CLIENT-07` | **Client emails E02/E03; PO clarified Sprint 3 on 18 September** | Diagnosis/Triage and direction/matching are central to Yoir and the highest-priority Sprint 3 feature, as originally intended. Use the six-step flow and approved workbook-derived rules to connect user needs to professionals/services and booking. Entry-route reconciliation, multi-answer aggregation and ranking still need decisions. | `US-09`–`US-13`, `US-30`, `US-44`–`US-46` |
| `CLIENT-08` | **Client email E03** | Use **Career Professional**, not Career Counsellor, in user-facing copy. Avoid **Marketplace** in the app; **Explore** is the team's selected working label from the client's suggestions. Existing technical identifiers may remain unchanged. | All user-facing screens, messages and navigation |
| `CLIENT-09` | **Client email E03** | Show qualifications, experience, skills/expertise, LinkedIn, languages and services before booking. | `US-30`, `US-31`–`US-32`, `US-46` |
| `CLIENT-10` | **Client email E03; visual approval pending** | Refine the digital prototype and app typography/visuals towards Yoir branding using the pitch-night reference, then record PO/client review. This is not approval of a specific font, palette or final design. | Diagnosis, profile, Explore and booking journey |

E02/E03 and source-version boundaries are documented in [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback). These emails do not expand the earlier payment scope or approve placeholder commission, refund, tax or payout settings in implementation documents.

### Cross-cutting acceptance for this feedback

- User-facing labels, navigation, forms and displayed errors consistently use Career Professional and the agreed discovery label. Historical evidence and internal technical identifiers may retain their original wording.
- The profile and service detail journey supplies the professional information in `CLIENT-09` before the user commits to booking, with applicable privacy/verification rules enforced.
- The updated prototype/screens and their feedback disposition are linked to the affected stories. Brand alignment is reviewed, not asserted solely from the reference screenshot.
- For triage, the approved workbook mapping and source version, invalid/error cases, private-data access and relevant platform tests are traceable to the acceptance result. A green component test or a screenshot alone does not prove the end-to-end diagnosis-to-booking journey.

## 6. Definition of Ready

A story is ready for implementation when:

- its user role, outcome, priority, and acceptance criteria are agreed;
- frontend and backend teams use the same story ID and behaviour;
- dependencies, authorisation rules, error states, and relevant data are understood;
- any required client decision has been recorded;
- the story is small enough to plan or has been split into independently verifiable work;
- its acceptance tests can be derived without inventing missing product behaviour.

## 7. Definition of Done

A story is done only when:

- its acceptance criteria pass at frontend, backend, and end-to-end levels where applicable;
- backend role, ownership, privacy, and state rules are enforced;
- the frontend represents backend success, failure, and pending states accurately;
- relevant automated and manual tests pass;
- the implementation is peer reviewed and merged;
- the story is demonstrated in sprint review;
- the feature is deployed to the agreed test environment;
- user-facing behaviour works on the agreed target OS(es), supported versions, devices or simulators, and screen-size matrix;
- the integrated MVP can be installed or launched, tested, and demonstrated on the agreed iOS and Android targets; publication through the public App Store or Google Play is not required;
- the shared requirements and traceability records are updated if the delivered behaviour differs from the approved story.
