# Yoir Product Backlog

## 1. Product Goal

Yoir is a mobile career-advisory marketplace and community platform. The semester product is a native mobile application for iOS and Android, confirmed with the client at the first client meeting on 25 August 2026. It allows public visitors to browse Marketplace listings and Forum content, while authenticated users perform core actions such as profile management, booking, payment, posting, and order-linked communication.

The primary service journey is:

```text
browse service -> choose slot -> create order -> pay -> confirm -> deliver service -> review
```

Marketplace and Forum capabilities are included in this backlog; they are not deferred as complete capability areas.

## 2. Backlog Summary

The active Product Backlog contains **51 stories / 179 SP**. It consolidates the 48 aligned stories inherited from the frontend/backend Wiki requirements and directly includes booking confirmation, booking rescheduling, and password reset in their relevant epics.

| Metric | Active backlog |
|---|---:|
| User stories | **51** |
| Must-have | **47 stories / 161 SP** |
| Should-have | **4 stories / 18 SP** |
| Total estimate | **179 SP** |

Priority definitions:

- **Must-have:** required to deliver the agreed baseline and its critical end-to-end journey.
- **Should-have:** valuable and retained in the draft, but scheduled after higher-priority dependencies where necessary.

Status definitions:

- **Baseline:** included in the active 51-story Product Backlog. Both teams must use the same ID, priority, and behaviour.

## 3. Ordered Product Backlog

Backlog order is represented first by epic order and then by story order within each epic. Dependency and workflow order may override numeric ID order during sprint planning.

### Epic A - Authentication and Accounts

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-01` | Register as a Job Seeker. | A visitor can open registration and provide name, email, password, password confirmation, and the Job Seeker role. | Must-have | 3 | Baseline |
| `US-02` | Create a valid Job Seeker account securely. | Valid data creates the account, stores the password securely, shows success, and directs the user to login. | Must-have | 3 | Baseline |
| `US-03` | Receive a useful duplicate-email error. | An existing email does not create another account and produces a clear form-level error. | Must-have | 2 | Baseline |
| `US-04` | Register as a Career Counsellor. | A visitor can select the Career Counsellor role and register through the shared account flow. | Must-have | 3 | Baseline |
| `US-05` | Complete first-login counsellor onboarding. | A new counsellor is directed to professional-profile and verification setup before publishing services. | Must-have | 4 | Baseline |
| `US-06` | Log in and reach role-appropriate functions. | Correct credentials create an authenticated session and route the user appropriately. | Must-have | 4 | Baseline |
| `US-07` | Receive safe feedback for failed login. | Invalid credentials do not authenticate the user and produce a generic email-or-password error. | Must-have | 2 | Baseline |
| `US-08` | Log out securely. | Logout invalidates the session, navigates appropriately, and blocks reuse of authenticated screens. | Must-have | 2 | Baseline |
| `US-70` | Reset a forgotten password securely. | A registered user can request a secure reset link and set a new valid password without exposing account existence. | Should-have | 5 | Baseline |

**Epic total:** 28 SP

### Epic B - Basic Forum

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-14` | Browse a structured career Forum. | Public users can browse topic-based Forum boards or categories. | Must-have | 4 | Baseline |
| `US-15` | View and narrow posts within a board. | Selecting a board displays its posts and supports board-level search or filtering. | Must-have | 3 | Baseline |
| `US-16` | Create a Forum post as a Job Seeker. | An authenticated Job Seeker can enter a title, content, and board/category. | Must-have | 4 | Baseline |
| `US-17` | Publish a post to the selected board. | Valid content is stored and shown in the selected board without a manual reload. | Must-have | 2 | Baseline |
| `US-18` | Reply to a post as a Career Counsellor. | An authenticated counsellor can submit a reply to an existing post. | Must-have | 3 | Baseline |
| `US-19` | Enforce the counsellor post-creation restriction. | A counsellor cannot create a new post and receives an explanatory response if attempted. | Must-have | 2 | Baseline |
| `US-20` | Participate in a Forum discussion. | An eligible reply appears with its author, timestamp, and content. | Must-have | 3 | Baseline |
| `US-21` | Like or unlike Forum content. | The like state and count update consistently when an eligible user toggles a like. | Must-have | 2 | Baseline |
| `US-22` | Search, filter, and sort Forum content. | Users can narrow posts by supported keyword, board, and sorting options. | Must-have | 4 | Baseline |

**Epic total:** 27 SP

### Epic C - Privacy and Counsellor Profile

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-27` | Control profile visibility. | A user can select public, partially visible, or restricted profile visibility. | Must-have | 4 | Baseline |
| `US-28` | Have privacy settings enforced. | Other users receive only the profile fields allowed by the selected visibility setting. | Must-have | 2 | Baseline |
| `US-30` | Maintain a professional counsellor profile. | A counsellor can manage their photo, introduction, background, experience, base location, and default modality. | Must-have | 5 | Baseline |

**Epic total:** 11 SP

### Epic D - Counsellor Verification

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-31` | Submit a LinkedIn profile for verification. | A counsellor can submit a valid LinkedIn URL for Platform Owner review. | Must-have | 4 | Baseline |
| `US-32` | See the verification result. | Relevant counsellor views consistently show pending, verified, or rejected status. | Must-have | 3 | Baseline |
| `US-33` | Receive the outcome of an additional manual investigation. | Completing an additional review updates the counsellor's verification outcome consistently. | Should-have | 4 | Baseline |
| `US-58` | Review counsellor verification as a Platform Owner. | A Platform Owner can inspect a submission and approve, reject, or leave it pending. | Must-have | 4 | Baseline |

**Epic total:** 15 SP

### Epic E - Counsellor Service Management

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-34` | Create a counsellor service. | An eligible counsellor can open My Services and begin creating a service. | Must-have | 5 | Baseline |
| `US-35` | Describe and price a service. | The service form accepts required service information and rejects invalid or incomplete data. | Must-have | 4 | Baseline |
| `US-36` | Edit or remove future service offerings. | A counsellor can change active listings without corrupting historical orders. | Must-have | 3 | Baseline |
| `US-37` | Declare how a service is delivered. | A service requires online, in-person, or both as its supported modality. | Must-have | 2 | Baseline |
| `US-38` | Provide an area for in-person delivery. | An in-person service requires state and city/region meeting information before saving. | Must-have | 3 | Baseline |

**Epic total:** 17 SP

### Epic F - Availability and Booking

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-39` | Manage counsellor availability. | A counsellor can add, edit, and remove available slots in a weekly calendar view. | Must-have | 5 | Baseline |
| `US-40` | Select only an open booking slot. | A Job Seeker sees only currently open slots as selectable for the service. | Must-have | 3 | Baseline |
| `US-41` | Prevent double-booking. | Confirming or reserving a slot makes it unavailable, and conflicting requests are rejected safely. | Must-have | 3 | Baseline |
| `US-42` | View upcoming and past counsellor bookings. | My Bookings shows the service, Job Seeker, modality, time, and pre-session information. | Must-have | 4 | Baseline |
| `US-43` | Open a booking's working details. | An upcoming booking shows online or in-person delivery information and access to its conversation. | Must-have | 3 | Baseline |
| `US-68` | Receive a clear booking confirmation. | A confirmed booking displays its reference, participants, service, time, timezone, modality, payment status, delivery information, and next actions. | Must-have | 3 | Baseline |
| `US-69` | Reschedule an upcoming booking safely. | An authorised participant can move an eligible confirmed booking to another open slot without duplicating the order or losing the original booking on failure. | Should-have | 5 | Baseline |

**Epic total:** 26 SP

### Epic G - Marketplace Discovery

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-44` | Browse counsellors and services. | Public users can browse available counsellor and service listings. | Must-have | 4 | Baseline |
| `US-45` | Find relevant services efficiently. | Public search, filter, and sorting use supported fields such as keyword, category, price, rating, location, and modality. | Must-have | 4 | Baseline |
| `US-46` | Evaluate a service before purchase. | A public detail view shows service, counsellor, rating, modality/location, and booking information. | Must-have | 4 | Baseline |

**Epic total:** 12 SP

### Epic H - Payment, Orders, and After-Sales

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-47` | Complete a platform-supervised purchase. | Processing payment records the transaction state and its associated booking/order details without storing raw card data. | Must-have | 5 | Baseline |
| `US-48` | Inspect transaction progress as a Platform Owner. | A Platform Owner can see payment status, relevant participants, and order progress. | Must-have | 4 | Baseline |
| `US-51` | Submit an after-sales or dispute request. | A Job Seeker can create a case linked to a purchased order and see that it was recorded. | Must-have | 5 | Baseline |
| `US-52` | Resolve an after-sales case as a Platform Owner. | A Platform Owner can record the outcome and update the relevant dispute and order state. | Should-have | 4 | Baseline |

**Epic total:** 18 SP

### Epic I - Order-Linked Messaging

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-49` | Receive a conversation for a purchased service. | Successful order creation creates a conversation linked to the Job Seeker, counsellor, and order. | Must-have | 6 | Baseline |
| `US-50` | Exchange text messages about an order. | Both order participants can send and view text messages in the same order-linked thread. | Must-have | 3 | Baseline |
| `US-62` | Close messaging when the engagement ends. | A completed or cancelled order keeps history readable but disables new-message input. | Must-have | 3 | Baseline |
| `US-63` | Enforce conversation closure on the backend. | The backend rejects every send attempt against a closed conversation and the frontend shows the failure accurately. | Must-have | 2 | Baseline |

**Epic total:** 14 SP

### Epic J - Reviews and Ratings

| ID | User outcome | Acceptance summary | Priority | SP | Status |
|---|---|---|---:|---:|---|
| `US-53` | Review a completed purchased service. | An eligible buyer can submit a one-to-five-star rating and written comment from a completed order. | Must-have | 4 | Baseline |
| `US-54` | See updated service-level feedback. | A submitted review updates the service average, count, and review list consistently. | Must-have | 3 | Baseline |
| `US-55` | Judge a counsellor's overall service quality. | Counsellor profiles and Marketplace listings show a consistently calculated overall rating. | Must-have | 4 | Baseline |

**Epic total:** 11 SP

## 4. Stories Outside the Active Backlog

The following IDs are not included in the active 51-story backlog:

```text
US-09 US-10 US-11 US-12 US-13
US-23 US-24 US-25 US-26 US-29
US-56 US-57 US-59 US-60 US-61
US-64 US-65 US-66 US-67
```

`US-66` and `US-67` cover interface-language switching and saved language preference. They remain outside the active draft under the English-only working assumption, subject to `CLIENT-03`. Restoring any omitted story requires a traceable baseline change applied to both teams' requirements.

## 5. Client Decisions Affecting the Backlog

| ID | Decision required | Working assumption until confirmed | Affected backlog area |
|---|---|---|---|
| `CLIENT-01` | LinkedIn verification approach | LinkedIn URL submission plus manual Platform Owner review; no automated LinkedIn API verification. | `US-31`-`US-33`, `US-58` |
| `CLIENT-02` | Real payment API or sandbox/mock | Use a sandbox/test payment boundary and do not store raw card data. | `US-47`, `US-48`, booking confirmation and payment-dependent states |
| `CLIENT-03` | Whether language switching is necessary | English-only; keep `US-66` and `US-67` outside the active backlog. | Localisation scope and acceptance tests |

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
- the shared requirements and traceability records are updated if the delivered behaviour differs from the approved story.

