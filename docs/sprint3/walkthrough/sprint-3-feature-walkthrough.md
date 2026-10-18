<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Sprint 3 Feature Walkthrough
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough
  Wiki commit: 4567462 (2026-10-18)
  Exported:    2026-10-18
-->

# Sprint 3 Feature Walkthrough

**Captured:** 18 October 2026 · **Build:** `dev` at `813347e` · **View:** web build at phone size (393 × 852, Chromium) · **Back end:** same build, run locally against a fresh database loaded with the seed data

This page shows every feature in the current build, screen by screen, in the web build at phone size: 83 screens across the Job Seeker, Career Professional and Platform Owner roles. It records what the build does on 18 October. It is not client acceptance and not a device end-to-end test run. Story IDs refer to the [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements). The same screens at desktop size are on [Sprint 3 Feature Walkthrough (Desktop)](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough-Desktop).

The earlier 8 October capture on the iOS simulator (Expo Go, iPhone 17 Pro) is in this page's history.

## How the screens were captured

- The FastAPI back end served the exported Expo web build and the API from one local address, against a new SQLite database loaded with the repository's seed data on start-up: seed Job Seekers, Career Professionals, services and availability. The Platform Owner account was created at start-up from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, set to throwaway local values.
- No Stripe keys were set, so checkout used the labelled payment stub and no money moved. No Mailgun key was set, so no email was sent; the local launcher saved outgoing messages to a file instead, and the password-reset link in 10b was opened from there.
- A Playwright script drove the app in Chromium at 393 × 852 with touch input, in the Australia/Melbourne time zone. The desktop page used the same script at 1440 × 900 against its own fresh database, so both pages show the same steps and walkthrough data.
- Seed availability is stored in UTC office hours, so open times show in Melbourne as evenings and early mornings.
- Data made for the walkthrough, all through the app's screens unless noted:
  - Alex Rivera completed the diagnosis and booked four sessions: one online (later rescheduled), one with a pre-session brief, one in person, and one that was moved a week into the past and marked completed in the local database, so that it could be reviewed.
  - Maya Chen published a new service, and Jordan Lee added the meeting address for the in-person booking.
  - Riley Nguyen registered as a new Career Professional, submitted a LinkedIn profile and was approved by the Platform Owner.
  - Sam Taylor reset their password from the emailed link.
  - Maya Chen set her profile to Partially visible and then Restricted, to show what other members see, and set it back to Public afterwards.

**Gaps the screens show:**

- Notifications are always empty, because US-60 and US-61 are deferred.
- Seed Career Professionals have not set up payouts, because Stripe Connect needs real onboarding. On the payment stub their services can still be booked, although the workspace (45), Payouts (56) and the Platform Owner screens (61, 70) say services stay hidden or cannot be booked until payouts are set up; that wording describes the Stripe set-up.
- The job that marks a past session completed only runs when Stripe is configured, so on the stub a session never becomes reviewable by itself. The completed session in 37 was set up in the local database.
- Seed ratings and review counts are demo figures with no written reviews behind them, so a service can show 4.9 from 28 reviews with “No written reviews yet”. The first real review replaces the seed figures: Priya Nair's profile went from 4.7 (21 seed reviews) to 5.0 from the one review submitted here (39b).

Not shown: card payment and Stripe Connect payouts (no Stripe keys locally) and the email confirmation link (US-02).

## 1. Public screens, no login

| <img src="screenshots/01-welcome.png" width="200" alt="Welcome: choose Job Seeker or Career Professional, or browse as a guest"> | <img src="screenshots/02-explore.png" width="200" alt="Explore lists every published service with its Career Professional, price and rating"> | <img src="screenshots/03-explore-filters.png" width="200" alt="Filters for delivery, location, price and rating, and sorting; here, in-person services only"> |
|---|---|---|
| **01** Welcome: choose Job Seeker or Career Professional, or browse as a guest · *US-01, US-04* | **02** Explore lists every published service with its Career Professional, price and rating · *US-44* | **03** Filters for delivery, location, price and rating, and sorting; here, in-person services only · *US-45* |
| <img src="screenshots/04-service-detail.png" width="200" alt="Service detail with the verified Career Professional card"> | <img src="screenshots/05-professional-profile.png" width="200" alt="Career Professional profile: verified badge, rating, location, LinkedIn, qualifications, skills"> | <img src="screenshots/06-professional-profile-details.png" width="200" alt="Languages, background and experience, then the Career Professional’s services"> |
| **04** Service detail with the verified Career Professional card · *US-46* | **05** Career Professional profile: verified badge, rating, location, LinkedIn, qualifications, skills · *US-46, US-30* | **06** Languages, background and experience, then the Career Professional’s services · *US-46, US-30* |
| <img src="screenshots/08-register-job-seeker.png" width="200" alt="Registration with the role choice"> | <img src="screenshots/09-login-failed.png" width="200" alt="A wrong password gives one generic error, with no hint which field was wrong"> | <img src="screenshots/10-forgot-password.png" width="200" alt="Forgot password: request a reset link"> |
| **08** Registration with the role choice · *US-01* | **09** A wrong password gives one generic error, with no hint which field was wrong · *US-07* | **10** Forgot password: request a reset link · *US-70* |
| <img src="screenshots/10a-forgot-password-sent.png" width="200" alt="Link requested: the same answer whether or not the address has an account"> | <img src="screenshots/10b-reset-password.png" width="200" alt="The emailed link opens Choose a new password"> | <img src="screenshots/10c-reset-password-done.png" width="200" alt="Password changed; every other session is ended and the person logs in again"> |
| **10a** Link requested: the same answer whether or not the address has an account · *US-70* | **10b** The emailed link opens Choose a new password · *US-70* | **10c** Password changed; every other session is ended and the person logs in again · *US-70* |

## 2. Yoir Diagnosis and Direction

| <img src="screenshots/11-diagnosis-step1.png" width="200" alt="A new Job Seeker starts at step 1 of 6: Where are you now?"> | <img src="screenshots/12-diagnosis-step1-answered.png" width="200" alt="One answer chosen; Continue saves it and moves on"> | <img src="screenshots/13-diagnosis-step2.png" width="200" alt="Step 2: What are you trying to achieve?"> |
|---|---|---|
| **11** A new Job Seeker starts at step 1 of 6: Where are you now? · *US-09, US-10* | **12** One answer chosen; Continue saves it and moves on · *US-10, US-11* | **13** Step 2: What are you trying to achieve? · *US-10* |
| <img src="screenshots/14-diagnosis-step3.png" width="200" alt="Step 3: What have you tried so far? More than one answer allowed"> | <img src="screenshots/14a-diagnosis-resumed.png" width="200" alt="Answers are saved to the account: logging in on another browser offers to pick up at step 4"> | <img src="screenshots/15-diagnosis-step4.png" width="200" alt="Step 4: Where are you getting stuck?"> |
| **14** Step 3: What have you tried so far? More than one answer allowed · *US-10* | **14a** Answers are saved to the account: logging in on another browser offers to pick up at step 4 · *US-09, US-11* | **15** Step 4: Where are you getting stuck? · *US-10* |
| <img src="screenshots/16-diagnosis-step5.png" width="200" alt="Step 5: barriers, more than one answer allowed"> | <img src="screenshots/17-diagnosis-direction.png" width="200" alt="Step 6, Your Yoir Direction, worked out by the back end from the saved answers: the main area to work on and suggested next steps"> | <img src="screenshots/18-diagnosis-matches.png" width="200" alt="Relevant Career Professionals for the direction, best match first"> |
| **16** Step 5: barriers, more than one answer allowed · *US-10* | **17** Step 6, Your Yoir Direction, worked out by the back end from the saved answers: the main area to work on and suggested next steps · *US-12* | **18** Relevant Career Professionals for the direction, best match first · *US-12, US-13* |
| <img src="screenshots/19-diagnosis-to-explore.png" width="200" alt="Explore opened from the direction, with the matches first"> |  |  |
| **19** Explore opened from the direction, with the matches first · *US-13* |  |  |

## 3. Job Seeker home, profile and privacy

| <img src="screenshots/20-js-home.png" width="200" alt="Home after the diagnosis: best matches and retake"> | <img src="screenshots/22-js-profile.png" width="200" alt="Edit profile"> | <img src="screenshots/23-js-profile-filled.png" width="200" alt="Current role and career goals filled in"> |
|---|---|---|
| **20** Home after the diagnosis: best matches and retake · *US-06, US-13* | **22** Edit profile · *US-29* | **23** Current role and career goals filled in · *US-29* |
| <img src="screenshots/24-privacy-settings.png" width="200" alt="Profile privacy: three visibility levels"> | <img src="screenshots/25-privacy-partially-visible.png" width="200" alt="Partially visible chosen and saved"> | <img src="screenshots/26-notifications.png" width="200" alt="Notifications: empty, because the back end is deferred"> |
| **24** Profile privacy: three visibility levels · *US-27* | **25** Partially visible chosen and saved · *US-27* | **26** Notifications: empty, because the back end is deferred · *US-60, US-61 (deferred)* |
| <img src="screenshots/27-account-sheet.png" width="200" alt="Account sheet: edit profile, my sessions, log out"> |  |  |
| **27** Account sheet: edit profile, my sessions, log out · *US-08* |  |  |

## 4. Booking and payment

| <img src="screenshots/28-choose-time.png" width="200" alt="Choose a time: only open times are offered"> | <img src="screenshots/29-time-selected.png" width="200" alt="A time chosen; the summary shows the date, time and price"> | <img src="screenshots/29a-pre-session-brief.png" width="200" alt="An optional pre-session brief for the Career Professional, added before paying"> |
|---|---|---|
| **28** Choose a time: only open times are offered · *US-40* | **29** A time chosen; the summary shows the date, time and price · *US-40* | **29a** An optional pre-session brief for the Career Professional, added before paying · *US-42* |
| <img src="screenshots/30-checkout.png" width="200" alt="Review and pay: the time is held for 15 minutes; total and cancellation policy"> | <img src="screenshots/31-confirmation.png" width="200" alt="Booked: session, delivery, payment status and references. The stub is labelled: no real money moved"> | <img src="screenshots/32-my-sessions.png" width="200" alt="My sessions: coming up, with join, receipt and cancel"> |
| **30** Review and pay: the time is held for 15 minutes; total and cancellation policy · *US-41, US-47* | **31** Booked: session, delivery, payment status and references. The stub is labelled: no real money moved · *US-47, US-68* | **32** My sessions: coming up, with join, receipt and cancel · *US-43, US-68* |
| <img src="screenshots/33-booking-detail.png" width="200" alt="Booking detail with the online meeting link and Reschedule"> | <img src="screenshots/33a-reschedule.png" width="200" alt="Reschedule: pick another open time; the order and payment stay the same"> | <img src="screenshots/33b-rescheduled.png" width="200" alt="Rescheduled: the booking shows the new time"> |
| **33** Booking detail with the online meeting link and Reschedule · *US-43, US-69* | **33a** Reschedule: pick another open time; the order and payment stay the same · *US-69* | **33b** Rescheduled: the booking shows the new time · *US-69* |
| <img src="screenshots/34-receipt.png" width="200" alt="Receipt"> | <img src="screenshots/35-cancel-confirm.png" width="200" alt="Cancelling shows the refund rule before it is confirmed"> | <img src="screenshots/36-in-person-meeting-address.png" width="200" alt="In-person booking: the meeting address the Career Professional added"> |
| **34** Receipt · *US-47* | **35** Cancelling shows the refund rule before it is confirmed · *Cancellation policy* | **36** In-person booking: the meeting address the Career Professional added · *US-43* |
| <img src="screenshots/37-my-sessions-past.png" width="200" alt="Past sessions: a completed session can be reviewed"> | <img src="screenshots/38-review.png" width="200" alt="Review: star rating and written review"> | <img src="screenshots/39-review-submitted.png" width="200" alt="Submitted: the review is saved and the service page opens with the new rating"> |
| **37** Past sessions: a completed session can be reviewed · *US-53* | **38** Review: star rating and written review · *US-53* | **39** Submitted: the review is saved and the service page opens with the new rating · *US-53, US-54* |
| <img src="screenshots/39a-service-reviews.png" width="200" alt="The service’s reviews: average rating, review count and the written review"> | <img src="screenshots/39b-professional-rating.png" width="200" alt="The Career Professional’s overall rating, now worked out from submitted reviews"> |  |
| **39a** The service’s reviews: average rating, review count and the written review · *US-54* | **39b** The Career Professional’s overall rating, now worked out from submitted reviews · *US-55* |  |

## 5. Becoming a Career Professional

| <img src="screenshots/40-register-career-professional.png" width="200" alt="Registering as a Career Professional"> | <img src="screenshots/41-register-success.png" width="200" alt="Account created; continue to log in"> | <img src="screenshots/42-cp-onboarding.png" width="200" alt="First login: finish the profile and verification before publishing"> |
|---|---|---|
| **40** Registering as a Career Professional · *US-04* | **41** Account created; continue to log in · *US-02* | **42** First login: finish the profile and verification before publishing · *US-05* |
| <img src="screenshots/43-cp-verification-start.png" width="200" alt="Verification: submit a LinkedIn profile URL"> | <img src="screenshots/44-cp-verification-pending.png" width="200" alt="Submitted: verification pending"> | <img src="screenshots/44a-cp-onboarding-progress.png" width="200" alt="Onboarding shows the verification step as done; the profile step is still to finish"> |
| **43** Verification: submit a LinkedIn profile URL · *US-31* | **44** Submitted: verification pending · *US-31, US-32* | **44a** Onboarding shows the verification step as done; the profile step is still to finish · *US-05* |

## 6. Career Professional workspace

| <img src="screenshots/45-cp-workspace.png" width="200" alt="Workspace: verification status, payouts, sessions and profile"> | <img src="screenshots/46-cp-my-services.png" width="200" alt="My services, with edit and delete"> | <img src="screenshots/47-cp-profile.png" width="200" alt="Professional profile form"> |
|---|---|---|
| **45** Workspace: verification status, payouts, sessions and profile · *US-32* | **46** My services, with edit and delete · *US-34, US-36* | **47** Professional profile form · *US-30* |
| <img src="screenshots/48-cp-profile-details.png" width="200" alt="Experience, qualifications, skills and expertise"> | <img src="screenshots/49-cp-new-service.png" width="200" alt="New service: title, description and price"> | <img src="screenshots/50-cp-new-service-delivery.png" width="200" alt="Duration, delivery and the meeting area an in-person service needs"> |
| **48** Experience, qualifications, skills and expertise · *US-30* | **49** New service: title, description and price · *US-34, US-35* | **50** Duration, delivery and the meeting area an in-person service needs · *US-37, US-38* |
| <img src="screenshots/51-cp-service-published.png" width="200" alt="The new service in My services"> | <img src="screenshots/52-cp-edit-service.png" width="200" alt="Edit a service"> | <img src="screenshots/53-cp-delete-confirm.png" width="200" alt="Delete a service: bookings already made are not affected"> |
| **51** The new service in My services · *US-34* | **52** Edit a service · *US-36* | **53** Delete a service: bookings already made are not affected · *US-36* |
| <img src="screenshots/54-cp-availability.png" width="200" alt="Availability calendar"> | <img src="screenshots/55-cp-verification-verified.png" width="200" alt="Verification status: verified"> | <img src="screenshots/56-cp-payouts.png" width="200" alt="Payouts and tax details through Stripe Connect"> |
| **54** Availability calendar · *US-39* | **55** Verification status: verified · *US-32* | **56** Payouts and tax details through Stripe Connect · *US-47* |
| <img src="screenshots/57-cp-bookings.png" width="200" alt="Sessions you are delivering, with the pre-session brief"> | <img src="screenshots/58-cp-booking-detail-brief.png" width="200" alt="Booking detail: the brief, the time zone and the joining link"> | <img src="screenshots/59-cp-add-meeting-address.png" width="200" alt="In-person booking: add a meeting address"> |
| **57** Sessions you are delivering, with the pre-session brief · *US-42* | **58** Booking detail: the brief, the time zone and the joining link · *US-42, US-43* | **59** In-person booking: add a meeting address · *US-43* |
| <img src="screenshots/60-cp-meeting-address-saved.png" width="200" alt="The address saved, shown to both participants"> | <img src="screenshots/60a-cp-privacy-partial.png" width="200" alt="A Career Professional sets their profile to Partially visible"> | <img src="screenshots/60b-privacy-partial-view.png" width="200" alt="What a Job Seeker sees of a Partially visible profile: name, summary, rating and services; background, qualifications and languages are hidden"> |
| **60** The address saved, shown to both participants · *US-43* | **60a** A Career Professional sets their profile to Partially visible · *US-27* | **60b** What a Job Seeker sees of a Partially visible profile: name, summary, rating and services; background, qualifications and languages are hidden · *US-28* |
| <img src="screenshots/60c-privacy-restricted-view.png" width="200" alt="Restricted: other members see only that the profile is restricted"> |  |  |
| **60c** Restricted: other members see only that the profile is restricted · *US-28* |  |  |

## 7. Platform Owner

| <img src="screenshots/61-admin-overview.png" width="200" alt="Overview: people, sessions and money"> | <img src="screenshots/62-admin-overview-money.png" width="200" alt="Where the money went: payouts, commission and GST"> | <img src="screenshots/63-admin-verification-queue.png" width="200" alt="Verification queue, oldest first"> |
|---|---|---|
| **61** Overview: people, sessions and money · *US-48, US-71* | **62** Where the money went: payouts, commission and GST · *US-48* | **63** Verification queue, oldest first · *US-58* |
| <img src="screenshots/64-admin-verification-detail.png" width="200" alt="A submission: open the LinkedIn profile, then approve, reject or leave pending"> | <img src="screenshots/65-admin-approve-confirm.png" width="200" alt="Confirm the approval"> | <img src="screenshots/66-admin-verification-approved.png" width="200" alt="Approved; an additional-investigation outcome can be recorded"> |
| **64** A submission: open the LinkedIn profile, then approve, reject or leave pending · *US-58* | **65** Confirm the approval · *US-58* | **66** Approved; an additional-investigation outcome can be recorded · *US-33* |
| <img src="screenshots/66a-admin-reject-reason.png" width="200" alt="Rejecting needs a reason, which the Career Professional reads (not confirmed here)"> | <img src="screenshots/67-admin-payments.png" width="200" alt="Payments, with the amount split for each order"> | <img src="screenshots/68-admin-payment-detail.png" width="200" alt="Order detail: progress, who and when, then the money breakdown"> |
| **66a** Rejecting needs a reason, which the Career Professional reads (not confirmed here) · *US-58, US-32* | **67** Payments, with the amount split for each order · *US-48* | **68** Order detail: progress, who and when, then the money breakdown · *US-48* |
| <img src="screenshots/69-admin-bookings.png" width="200" alt="Every booking on the platform"> | <img src="screenshots/70-admin-users.png" width="200" alt="Users: Career Professionals and Job Seekers with their status"> | <img src="screenshots/70a-admin-users-job-seekers.png" width="200" alt="Users: the Job Seekers list"> |
| **69** Every booking on the platform · *US-48* | **70** Users: Career Professionals and Job Seekers with their status · *US-71* | **70a** Users: the Job Seekers list · *US-71* |
