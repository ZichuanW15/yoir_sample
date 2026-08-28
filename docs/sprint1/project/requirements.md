# Front-End Requirements (Aligned with Backend Baseline)

Purpose: define the front-end behaviour required to support exactly the same 48 product-backlog user stories selected by the backend baseline.

The following stories are excluded from the front end because they are excluded from the backend baseline:

```text
US-09 US-10 US-11 US-12 US-13
US-23 US-24 US-25 US-26 US-29
US-56 US-57 US-59 US-60 US-61
US-64 US-65 US-66 US-67
```

No home-screen/diagnose workflow, forum-to-profile or forum-to-marketplace linking, editable Job Seeker profile, forum moderation console, general user-management console, global notification centre, nearby discovery, or multi-language interface is required by this baseline.

## 1. Architectural Requirements

* The front end shall be implemented as a **native mobile application** for iOS and Android.
* The front end shall support three user roles:

  * Job Seeker
  * Career Counsellor
  * Platform Owner
* The front end shall provide role-specific screens, navigation, and permitted actions for the baseline stories listed below.
* The front end shall obtain and update persistent application data through the backend API (Real DB), rather than hard-coded production data.
* The front end shall represent backend authentication, verification, availability, booking, payment, order, dispute, conversation, and review states accurately.

---

## 2. Critical Requirements

* Job Seekers shall be able to browse counsellors and services, select an available service and time slot, provide a pre-session brief, purchase the service, and view the resulting booking and order.
* Career Counsellors shall be able to manage professional profiles, verification submissions, services, availability, and bookings.
* Service interfaces shall clearly display online/in-person modality and relevant meeting-area information.
* Purchased services shall provide order-linked text communication between the Job Seeker and Career Counsellor.
* Completed or cancelled orders shall close their conversations for new messages while preserving readable history.
* Platform Owners shall be provided with interfaces for counsellor verification, payment/order oversight, and dispute resolution included in the backend baseline.
* Users shall be able to participate in the basic Forum according to the role permissions included in `US-14` to `US-22`.

---

## 3. Functional Requirements

### Authentication and Accounts

* **US-01** — An unregistered Job Seeker shall be able to open a registration form which contains name, email, password, password confirmation, and the Job Seeker role.
* **US-02** — After valid Job Seeker registration, the interface shall show success and direct the user to the login screen.
* **US-03** — If the submitted email already exists, the interface shall keep the user on the registration form and show a clear duplicate-email error.
* **US-04** — An unregistered Career Counsellor shall be able to register using the shared registration flow and select the Career Counsellor role.
* **US-05** — A Career Counsellor logging in for the first time shall be directed to profile and verification setup before publishing services.
* **US-06** — A user with valid credentials shall be logged in and routed to an interface appropriate for their role.
* **US-07** — Invalid credentials shall produce a generic error without revealing which credential was incorrect.
* **US-08** — Logging out shall terminate the session, navigate away from authenticated screens, and prevent normal navigation back into them.

### Forum (Basic)

* **US-14** — Users shall be able to browse topic-based forum boards/categories.
* **US-15** — Selecting a board shall display its posts and provide the supported board-level search/filter controls.
* **US-16** — A logged-in Job Seeker shall be able to open a post form with title, content, and board/category fields.
* **US-17** — A successfully submitted post shall appear in the selected board without requiring the user to manually refresh the screen.
* **US-18** — A Career Counsellor shall be able to reply to an existing forum post.
* **US-19** — A Career Counsellor shall not be shown an enabled create-post action and shall see an explanatory message if creation is attempted.
* **US-20** — Eligible users shall be able to submit replies and see the reply author, timestamp, and content in the thread.
* **US-21** — Eligible users shall be able to like/unlike posts or replies and see the current like state and count.
* **US-22** — Users shall be able to search/filter forum content by the criteria supported by the backend, including keyword, board, and basic sorting.

### Privacy and Profiles

* **US-27** — Users shall be able to set their profile visibility to public, partially visible, or restricted.
* **US-28** — Profile views shall display only fields permitted by the selected privacy level and shall show a clear restricted state where appropriate.
* **US-30** — Career Counsellors shall be able to create and edit a professional profile containing photo, introduction, background, experience, base location, and default service modality.

### Counsellor Verification and Platform Owner Review

* **US-31** — Career Counsellors shall be able to submit a LinkedIn profile URL for verification and receive URL validation feedback.
* **US-32** — The interface shall display pending, verified, or rejected status on relevant counsellor profile and service-management views.
* **US-33** — When an additional manual review result is returned by the backend, the interface shall display the updated verification outcome.
* **US-58** — Platform Owners shall be able to view verification submissions and approve, reject, or leave a submission pending.

### Service Management and Delivery Modality

* **US-34** — An eligible Career Counsellor shall be able to create a service from a My Services interface.
* **US-35** — The service form shall support title, description, category, price, duration/delivery information, and validation feedback.
* **US-36** — Career Counsellors shall be able to view, edit, and remove active service listings without removing historical order information.
* **US-37** — Creating or editing a service shall require a modality selection of online, in-person, or both.
* **US-38** — A service containing an in-person modality shall require a base meeting area with state and city/region before it can be saved.

### Availability and Booking

* **US-39** — Career Counsellors shall be able to add, edit, and remove available time slots through a calendar-based availability interface.
* **US-40** — A Job Seeker booking a service shall be able to select only open slots; unavailable and reserved slots shall not be selectable.
* **US-41** — Once a booking reserves a slot, all relevant views shall display it as unavailable and shall handle a backend double-booking rejection clearly.
* **US-42** — Career Counsellors shall be able to view upcoming and past bookings with service, Job Seeker, modality, time, and pre-session brief information.
* **US-43** — Booking details shall display the online meeting link or in-person meeting address and provide access to the associated order conversation.
* The Job Seeker booking flow shall collect the selected service, modality, open slot, and a short pre-session brief before payment, then display the booking/order confirmation returned by the backend.
* Times shall be displayed with clear timezone information when the Job Seeker and Career Counsellor may be in different timezones.

### Marketplace Browsing

* **US-44** — Job Seekers shall be able to browse counsellor and/or service listings.
* **US-45** — Marketplace controls shall support only backend-supported search, filtering, and sorting fields, including keyword, category, price, rating, location, and modality where available.
* **US-46** — Counsellor/service detail views shall display service information, counsellor information, ratings/reviews, modality/location, and a purchase/booking action.

### Payment, Orders, and After-Sales

* **US-47** — The purchase flow shall display the selected service and booking information, process payment through the agreed backend/payment boundary, and show the returned transaction and order status.
* **US-48** — Platform Owners shall be able to view payment status, parties involved, and order progress for an order.
* **US-51** — A Job Seeker shall be able to submit an after-sales/dispute request linked to a purchased order and see that it was recorded.
* **US-52** — A Platform Owner shall be able to review a dispute, record an outcome, and see the resulting order/dispute status. This does not introduce the global notification centre excluded with `US-60` and `US-61`.

### Order-Linked Messaging and Access Control

* **US-49** — A successfully created order shall provide access to its automatically created conversation between the buyer and counsellor.
* **US-50** — Both order participants shall be able to send and view text messages in the same order-linked conversation.
* **US-62** — When an order is completed or cancelled, the conversation history shall remain readable, the message input shall be disabled, and a closed-conversation notice shall be shown.
* **US-63** — If a stale interface attempts to send to a closed conversation, the frontend shall show the backend rejection and shall not display the message as sent.

### Ratings and Reviews

* **US-53** — An eligible Job Seeker shall be able to submit a five-star rating and written review from a completed order.
* **US-54** — Service views shall display the updated average rating, review count, and review list returned by the backend.
* **US-55** — Counsellor profiles and marketplace listings shall display the backend-provided overall counsellor rating.

---

## 4. Non-Functional Requirements

* The interface shall adapt across the supported iOS and Android devices and screen sizes.
* The front end shall support the agreed minimum iOS and Android versions across the agreed device and screen-size matrix.
* The interface shall provide clear navigation, readable text, understandable controls, and form interactions accessible through touch and the on-screen keyboard.
* The front end shall respect user profile privacy settings and role-based access rules.
* Unauthorised actions and information shall not be exposed through the user interface, while the backend remains responsible for final authorisation enforcement.
* Verification, availability, booking, payment, order, dispute, conversation, and review states shall be displayed accurately.
* The interface shall provide clear feedback for validation errors, backend errors, successful actions, loading, and processing states.
* The interface shall provide a consistent and professional user experience across the Forum and Marketplace features retained in the backend baseline.
* The frontend shall not claim that a transaction, booking, verification review, dispute outcome, message, or review succeeded until the backend confirms success.

---

# Backend requirements (Baseline)

Purpose: list all product-backlog user stories that are required for the backend MVP. IDs reference `docs/Groomed Product Backlog.md`.

## Authentication & Accounts

- **US-01** Job Seeker Registration — register as job seeker (form with name, email, password, role). 
- **US-02** Job Seeker Registration — create account, password hashed, redirect after success.
- **US-03** Job Seeker Registration — handle duplicate email error.
- **US-04** Career Counsellor Registration — register as counsellor (role-based onboarding).
- **US-05** Career Counsellor Registration — first-login onboarding to setup profile & verification.
- **US-06** User Login — authenticate and route to the role-specific home screen.
- **US-07** User Login — incorrect credentials handling and rate-limiting considerations.
- **US-08** User Logout — session/token invalidation.

## Forum (Basic)

- **US-14** Forum structure — boards/categories.
- **US-15** Board listing & filtering.
- **US-16** Job Seeker creates forum post — post creation API and validation.
- **US-17** Publish post real-time visibility.
- **US-18** Counsellor answers forum post — reply API.
- **US-19** Prevent counsellors creating new posts — role enforcement.
- **US-20** Forum interactions — reply, search, filter.
- **US-21** Like posts/replies — like toggle API.
- **US-22** Search & filters for forum.

## Privacy & Profiles

- **US-27** User Profile Privacy Settings — set public/partial/restricted.
- **US-28** Enforce privacy when viewing profiles.
- **US-30** Career Counsellor Profile — create/edit professional profile, base location, modality.

## Provider Verification & Admin

- **US-31** Counsellor Verification — submit LinkedIn profile link for review.
- **US-32** Verification result status (pending/verified/rejected) visible on profile.
- **US-33** Manual investigation update to verification status (admin side).
- **US-58** Platform owner counsellor verification management (approve/reject workflow).

## Services (Marketplace)

- **US-34** Counsellor Service Management — add/edit/remove services.
- **US-35** Service fields: title, description, category, price, duration, modality.
- **US-36** Service list management (edit/delete applies to future purchases).
- **US-37** Service modality requirement (online/in-person/both).
- **US-38** In-person service must specify base meeting area (state/city).

## Availability, Booking & Orders

- **US-39** Provider availability calendar (create/edit time slots).
- **US-40** Only open slots selectable in booking flow.
- **US-41** Prevent double-booking (slot reserved/locked after booking).
- **US-42** Provider view of upcoming/past bookings (bookings list API).
- **US-43** Booking detail shows meeting link/address and messaging action.

## Marketplace Browsing

- **US-44** Browse counsellors and services listing endpoints.
- **US-45** Marketplace filters: keyword, category, price, rating, location, modality.
- **US-46** Service/counsellor detail API (includes ratings, reviews, CTA).

## Payment, Orders & After-sales

- **US-47** Platform-supervised payment: order payment processing and recordkeeping.
- **US-48** Admin visibility into payment status and order progress.
- **US-51** After-sales/dispute submission (create case linked to order).
- **US-52** Admin resolve dispute and update order status/notifications.

## Order-linked Messaging & Access Control

- **US-49** Create order-linked conversation automatically when order created.
- **US-50** Send/read messages in order conversation (basic messaging API).
- **US-62** Close conversation when order completed/cancelled (disable send UI & backend enforcement).
- **US-63** Backend must reject send attempts after conversation closed.

## Reviews & Ratings

- **US-53** Submit star rating & written review after order completion.
- **US-54** Aggregate review updates service screen (avg rating and list).
- **US-55** Compute provider overall rating from service reviews.

---

Architecture:

- **Python**
- **FastAPI**
- **PostgreSQL**
- **Redis** for cache and task queue
- **JWT** for authentication
- **RESTful API** with JSON responses

