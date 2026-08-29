# Project Background: Yoir Career Advisory Platform
## 1. Project Overview
 
This project starts from requirements another team has already defined. In Semester 1 2026, the SWEN90009 CSD-Koala team ran a full requirements phase: stakeholder analysis, elicitation with the client, a groomed and estimated product backlog, personas, goal models, low- and high-fidelity prototypes, and a round of moderated usability testing. Our job in this phase is to build the product those requirements describe.
 
The product, working name Yoir, is a two-sided career advisory marketplace delivered as a native mobile application for iOS and Android. It connects job seekers (graduates, career changers, students and skilled migrants) with career counsellors who sell services such as CV review, mock interviews and career planning. A third role, the platform owner, moderates content, reviews counsellor verification, and oversees orders and disputes.
 
The client described the product during elicitation as three familiar things joined together:
 
- a service marketplace in the style of Uber Eats, with counsellors as providers and services as items
- a community forum in the style of Xiaohongshu (RED) and Facebook
- appointment booking in the style of HotDoc
## 2. Problem Definition
 
Job seekers find it hard to get advice that is reliable, personal and available when they need it. Job platforms list vacancies and offer generic tools, but they rarely provide direct human guidance shaped around one person's goals and background.
 
Counsellors have the opposite problem. They have expertise to offer but no single organised channel for presenting their services, managing their availability and reaching clients. Their practice is scattered across social media, messaging apps and separate payment arrangements.
 
Yoir closes that gap by putting mentor discovery, service catalogues, appointment booking, supervised payment, order-linked messaging and peer support in one place.
 
## 3. Purpose and Objectives
 
The purpose of this phase is to deliver a working implementation of the platform the previous team specified. The objectives are:
 
1. **Build the backlog.** Implement the product defined in the Groomed Product Backlog: 67 user stories (US-01 to US-67), each with Given-When-Then acceptance criteria and a story point estimate.
2. **Re-groom the backlog into a semester MVP.** 54 of the 67 stories are currently marked Must-have, which is more than this team can deliver in one semester. The re-groom happens with the client.
3. **Settle the open decisions.** Resolve the items in Section 7 with the client before building the features they affect.
4. **Meet the Definition of Done, updated for mobile.** Every story is peer reviewed, tested at unit, integration and system level, demonstrated at sprint review, distributed to test devices through TestFlight and Google Play internal testing, and working on current iOS and Android versions.
## 4. Users and Roles
 
| Role | Description | Key capabilities |
|---|---|---|
| **Job seeker** | Recent graduates, career switchers, Year 12 students and skilled migrants (see `personas.md`) | Register, complete a first-login diagnose triage, browse the forum and marketplace, purchase services, book sessions, chat on orders, rate and review |
| **Career counsellor** | Verified professionals selling services, both full-time practitioners and side-hustle counsellors | Guided onboarding, LinkedIn verification, service catalogue management, availability calendar, booking management, order messaging, replies in the forum (cannot create posts) |
| **Platform owner** | The platform administrator | Verification review (approve or reject), forum moderation, account management, order and payment oversight, dispute handling |
 
## 5. Proposed Solution
 
A mobile application for iOS and Android with two clearly separated areas reached from the home screen, Forum and Marketplace, plus account screens specific to each role. The capability areas below follow the grouping used in the backlog.
 
### 5.1 Accounts and roles
 
Registration with role selection, secure login (hashed passwords, token-based sessions held in the device's secure storage) and role-based permissions enforced on the backend.
 
### 5.2 Guided entry
 
Home screen navigation blocks, plus a first-login "diagnose" triage popup for new job seekers that points them to relevant forum boards or services. This is front-desk triage rather than deep diagnosis. The question set will be designed together with counsellor subject-matter experts.
 
### 5.3 Forum
 
Topic boards covering CVs, interviews, graduate jobs, international students and career change. Job seekers create posts, counsellors reply. Includes likes, search and filter, avatar-to-profile navigation, and pathways from the forum into the marketplace.
 
### 5.4 Marketplace
 
Browsable counsellor and service listings with search, filter and sort by keyword, category, price, rating, location and modality (online, in person, or both). Service detail screens are kept separate from counsellor profile screens.
 
### 5.5 Counsellor verification
 
The counsellor submits a LinkedIn URL, the platform reviews it manually, and the account moves through pending, verified or rejected states with a badge visible to users.
 
### 5.6 Service management
 
Counsellors create, edit and delete priced service listings with a category, a duration and a declared delivery modality. Services delivered in person require a base meeting area.
 
### 5.7 Booking
 
Weekly availability calendars with timezone handling and double-booking prevention. Each booking includes a short pre-session brief that is shown to the counsellor. Both sides get a "My Bookings" view.
 
### 5.8 Payment, supervised by the platform
 
Purchases are recorded as orders with a transaction status. Payment runs through a PCI-DSS-compliant third-party gateway using its mobile SDK, and the platform never stores card data. Counselling sessions are real-world services delivered outside the app, so payment is taken through the gateway rather than app-store in-app purchase.
 
### 5.9 Order messaging
 
Every purchase automatically opens a conversation thread between buyer and counsellor. Threads are closed server-side once the order completes or is cancelled.
 
### 5.10 Ratings and reviews
 
Five-star reviews per service, restricted to verified buyers, aggregated into a counsellor-level rating.
 
### 5.11 After-sales and disputes
 
Job seekers raise dispute requests, and the platform owner reviews and resolves them.
 
### 5.12 Platform owner console
 
Verification queue, reported-content moderation, account management, and oversight of services, orders and payments.
 
### 5.13 Features that span the whole product
 
A notification centre with deep links, English and Simplified Chinese translations, opt-in nearby-counsellor discovery, and granular profile privacy settings (public, partial or restricted).
 
## 6. Scope
 
### 6.1 In scope for the build phase
 
The 67-story groomed backlog is the scope baseline. The Must-have set covers registration and login for both roles, the home screen and diagnose triage, the forum, marketplace browsing and search, counsellor profiles and LinkedIn verification, service and availability management, booking, platform-supervised payment and orders, order-linked messaging with access control, reviews and ratings, and the platform owner's verification queue. Should-have items include password reset, admin moderation and oversight screens, notifications, nearby discovery, and translations.
 
Because the Must-have set alone runs to roughly 54 stories, re-grooming an explicit MVP with the client is itself in scope, and it is the first activity of this phase.
 
### 6.2 Deferred or out of scope
 
These follow the previous team's risk guidance (RK-002) and the fact that no backlog stories exist for them:
 
| Item | Reason |
|---|---|
| Video call consultations (goals DO-08 and DO-17) | No backlog story. Sessions link out to Zoom or Meet in the meantime |
| File sharing inside order messaging (goal DO-07) | No backlog story. Chat is text-only for the MVP |
| Counsellor earnings dashboard and automated payouts (goal DO-18) | Payout model not confirmed |
| Automated LinkedIn identity checking | Verification stays a manual admin review of a submitted URL |
| Web or desktop browser version | Platform confirmed as mobile only. See Section 6.3 |
| Publication to the public App Store and Google Play | Test builds are distributed through TestFlight and Play internal testing; store publication is outside the semester scope |
 
### 6.3 Platform requirement
 
The target is a native mobile application for iOS and Android, confirmed by the client at the first client meeting on 25 August 2026. This resolves the conflict between the responsive-web requirement recorded in the previous team's Requirements Analysis (quality goal BE-03) and their backlog's Definition of Done, and the mobile-only statement in the original `project_background.md` (Section 7.2), in favour of mobile. The backlog's Definition of Done is updated accordingly (Section 3, objective 4).
 
The `app/` folder in the handover repo is an untouched Expo (React Native) scaffold. It contains no product code. Whether to build on it, on another cross-platform framework, or as two native codebases is decided in the technology stack decision and recorded in the design notebook, with team familiarity as the deciding factor.
 
The client has not imposed a technology or infrastructure stack, so the team will choose technologies it knows and that are well supported.
 
## 7. Open Decisions Carried Into the Build Phase
 
The requirements phase left these unresolved. Each needs to be settled with the client before the affected features are built.
 
| # | Decision | Status from handover |
|---|---|---|
| 1 | Platform: responsive web or mobile app | **Resolved 25 August 2026.** Native iOS and Android application, confirmed by the client at the first client meeting |
| 2 | Product name: "Yoir" (used in the prototype and mock data) or "Koala" (used in the test documents) | No canonical decision recorded |
| 3 | Shape of the platform owner / admin role | The client said he was still thinking about it, so admin stories US-56 to US-59 may change |
| 4 | Payment model: payout timing, platform fee or commission, refund rules | Flagged in US-47 and in the elicitation notes. Unresolved. Payment was only mocked during testing |
| 5 | Diagnose popup question set | Placeholder only, to be designed with counsellor subject-matter experts |
| 6 | Counsellor rating aggregation formula | US-55 says it should be defined consistently, but it is undefined |
| 7 | Cancellation and reschedule policy | No deadlines or refund interaction defined |
| 8 | Privacy compliance detail: Australian Privacy Act handling and under-18 users (the persona Nick is a minor) | Only high-level security requirements exist |
 
## 8. Industry Partner and Client
 
Saumil Macwan, The Gordon Skills and Jobs Centre. The Centre runs appointment-based career support, workshops and job-search guidance, which lines up directly with what the platform is for.
 
The client is the project sponsor and the primary stakeholder voice. He is non-technical and holds a conceptual vision of the product, so the team takes a consultative role: proposing solutions, validating requirements the previous team derived rather than elicited, and getting sign-off on the open decisions in Section 7.
 
## 9. Expected Benefits
 
- **Job seekers** get one trustworthy place to find verified counsellors, compare services on price, rating and modality, and complete booking and payment without leaving the app.
- **Counsellors** get a professional storefront: verified credibility, a managed service catalogue, an availability calendar and supervised payment.
- **The community forum** gives users free peer support and also points them toward relevant paid services.
- **The platform owner** gets the oversight tools needed to keep the marketplace safe and credible: verification, moderation and dispute handling.
- **The client** receives a working, tested implementation of the vision elicited in the requirements phase, with every deviation from the handover documented and signed off.
