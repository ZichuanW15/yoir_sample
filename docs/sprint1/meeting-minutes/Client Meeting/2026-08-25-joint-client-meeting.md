<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Client meeting minutes
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes
  Wiki commit: b50cda4 (2026-08-25)
  Exported:    2026-08-26
-->

# Week 5
# Meeting Minutes - Joint Client Meeting

| Field | Detail |
|---|---|
| Date | 25-08-2026 |
| Time | 5:08-5:48 pm AEST |
| Location | Microsoft Teams |
| Meeting type | Joint client meeting / product scope and requirements clarification |
| Client | Saumil Macwan (Sam) |
| Supervisor | Erfan Farabi |
| Chairs | Jared Cheng and Manushresth Krishnan |
| Minuted by | Jared Cheng, prepared from the meeting transcript |

**Participants identified in the transcript**

| Name | Role |
|---|---|
| Saumil Macwan (Sam) | Client / Yoir founder / career counsellor |
| Erfan Farabi | Supervisor / Tutor |
| Jared Cheng | Product Owner, CSD Koala |
| Jason Yang | Product Owner, CSD Quokka |
| whole CSD dev team |

---

## Discussion

| Topic | Notes |
|---|---|
| Product purpose and initial users | Yoir is intended to connect job seekers with qualified career professionals. The first phase is aimed particularly at skilled migrants and job seekers in Australia who need personalised help with job searching, resumes and career decisions. |
| Product differentiator | Sam described the human relationship as the main differentiator. The platform should connect a job seeker with a real career professional who can understand personal circumstances and provide advice that a general AI tool cannot replace. |
| Initial market | The initial launch is for Australia. Location remains important when job seekers search for a career professional, while the longer-term concept may support professionals and users in other countries. |
| Target platform | Sam's first preference is a mobile app, with a website as a secondary alternative. He would prefer the mobile product to support both iOS and Android, subject to the teams confirming what is feasible within the semester. |
| Product name and assets | The team may continue using the existing Yoir name, logo and handover assets. Sam is working through name-registration and legal matters, so branding may need to be changed later. Sam shared landing-page material in the meeting chat. |
| Core service flow | The original designed flow remains: `browse service -> choose slot -> create order -> pay -> confirm -> deliver service -> review`. Sam requested this flow in writing for confirmation. |
| Account and login flow | A separate, simple account flow will be added before the core service flow: `create account -> log in`. |
| Payment | The team discussed a stub/mock, a real provider's sandbox/test environment, and a third-party live payment integration such as Stripe or Razorpay. Sam said he would ideally like the app to be able to process payments by the end of the semester if feasible. The provider, test-versus-live boundary, payment states and related business rules remain unresolved. |
| LinkedIn and counsellor verification | Sam expects career professionals to be reviewed before being accepted. LinkedIn-based registration or account linking could reduce manual work, but the meeting did not decide whether Yoir should use LinkedIn login/account linking, use an externally available LinkedIn verification result, or collect a LinkedIn URL for manual Platform Owner review. Sam requested the alternatives and the team's recommendation by email. |
| Language requirements | The app interface should be English-only for the initial Australian launch. Separately, career professionals should be able to list the languages they speak, and Job Seekers should be able to search or filter professionals by language. |
| Semester delivery | The teams confirmed that this semester is for building a working product rather than performing another requirements-only exercise. Erfan recommended a feasible, integrated phase-one outcome over a larger set of incomplete or disconnected features. Deployment and the exact meaning of "app ready" were not settled. |
| Indicative sprint roadmap | Sprint 2 was described as focusing on authentication, counsellor service management, Marketplace discovery and payment. Sprint 3 was described as focusing on the Forum, counsellor verification, ratings and reviews. The roadmap remains subject to feasibility and final scope confirmation. |
| Handover and documentation | Erfan stated that the outcome should be handed over with sufficient documentation for the client to understand and continue the product. The team should also send meeting minutes after each client meeting so that decisions and omissions can be corrected promptly. |
| Client communication | Sam requested at least a weekly progress email. Client meetings should occur approximately fortnightly, or more frequently when the team is blocked or needs clarification. Tuesday at the same time is Sam's preferred meeting time; Monday or Wednesday are alternatives. Future meetings will generally be held separately by the Koala and Quokka teams. |
| Communication contacts | Jared and Jason will be the primary contacts for their respective teams. Sam may contact either Product Owner for a short discussion when a question is difficult to resolve by email. Jared will send one consolidated follow-up email for this meeting. |
| Semester schedule and possible continuation | Sam asked when the semester work finishes and whether another student team may continue the project. The meeting gave inconsistent verbal dates, so the official schedule must be sent in writing. Erfan will discuss possible future-semester continuation with Dr B based on scope and progress. |

---

## Confirmed Decisions

| # | Decision |
|---|---|
| 1 | Mobile app is the client's preferred primary platform; a website is secondary. The client's preference is to support both iOS and Android. |
| 2 | The initial launch market is Australia, with skilled migrants and other Job Seekers as the phase-one audience. |
| 3 | The initial app interface is English-only. Career professionals' spoken languages are profile/search data, not additional interface languages. |
| 4 | The proposed flows are `create account -> log in` and `browse service -> choose slot -> create order -> pay -> confirm -> deliver service -> review`. They still require written approval from the client. |
| 5 | The semester should produce a working, integrated phase-one product and supporting handover documentation. Exact release and deployment expectations remain to be defined. |
| 6 | The client will receive weekly progress emails, meeting minutes after client meetings, and meetings approximately every two weeks or when clarification is needed. |
| 7 | Jared and Jason are the main communication contacts for the Koala and Quokka teams respectively. |

---

## Questions for the Client Follow-up Email

The client explicitly asked to receive the important flow and verification questions in writing. The following wording is ready to include in the follow-up email.

### 1. Account creation and login journey

Please confirm whether this simple account and login flow is correct:

`create account -> log in`

### 2. Core service flow after login

Please confirm whether the original designed service flow is correct:

`browse service -> choose slot -> create order -> pay -> confirm -> deliver service -> review`

Please let us know if either flow requires any step to be added, removed or reordered.

### 3. LinkedIn registration and counsellor verification

Which approach should Yoir use for phase one?

1. The Career Professional signs in or links a LinkedIn account, and the Platform Owner still performs Yoir's manual professional review.
2. The Career Professional submits a LinkedIn profile URL, and the Platform Owner manually records `pending`, `verified` or `rejected`.
3. Yoir reuses a LinkedIn verification result if that result is technically and contractually accessible, with manual review as a fallback.

Please confirm whether LinkedIn is intended only to prove control of an account, or whether the client expects it to prove professional qualifications as well. Please also confirm who performs the final approval, the approval criteria, and whether a rejected professional may edit and resubmit.

### 4. Payment scope for this semester

You indicated that the app should ideally be able to process payments by the end of the semester. Please confirm the minimum acceptable phase-one outcome:

1. A Yoir payment simulator/mock that records realistic success, failure, cancellation and expiry states without connecting to a provider.
2. A real payment provider in sandbox/test mode, using test transactions and no real transfer of money.
3. A live production payment provider that charges real customers.

If a provider integration is required, do you have a preferred provider, such as Stripe or Razorpay? Please also confirm whether phase one requires platform fees/commission, counsellor payouts, refunds, cancellation fees and payment dispute handling.

### 5. Platform and meaning of "app ready"

Please confirm that the semester priority is a mobile-first product supporting both iOS and Android, with the website deferred or treated as secondary. Also, when you say the app should be "ready" this semester, do you mean:

1. A working application that can be demonstrated and handed over as a test build;
2. A deployed but non-public pilot; or
3. A production release available through the Apple App Store and Google Play Store?

### 6. Phase-one priority if the full scope is not feasible

If all inherited features cannot be completed as a reliable, integrated product this semester, please rank the following phase-one capabilities:

1. Registration, login and account recovery;
2. Career Professional registration and verification;
3. Service creation and availability;
4. Marketplace search and discovery;
5. Booking and payment;
6. Order-linked communication;
7. Ratings and reviews;
8. Forum;
9. Disputes and after-sales support.

---

## Actions

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| 1 | Send one consolidated follow-up email containing the meeting minutes, transcript, recording and written clarification questions | Jared | After the meeting | Open |
| 2 | Include two proposed diagrams/flows in the client email: account creation-to-login and the complete post-login service journey | Jared, Jason | With the follow-up email | Open |
| 3 | Assess cross-platform mobile delivery against the inherited responsive-web baseline and semester constraints, then provide the client with a feasible recommendation | Both teams | Before Sprint 2 implementation | Open |
| 4 | Investigate LinkedIn integration availability and limitations; distinguish account linking from Yoir's professional-verification decision | Both technical teams | Before implementing verification | Open |
| 5 | Compare mock, provider-sandbox and production payment approaches and recommend a feasible, secure payment boundary | Both technical teams | Before implementing payment | Open |
