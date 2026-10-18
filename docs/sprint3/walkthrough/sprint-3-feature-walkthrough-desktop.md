<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Sprint 3 Feature Walkthrough (Desktop)
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough-Desktop
  Wiki commit: 4567462 (2026-10-18)
  Exported:    2026-10-18
-->

# Sprint 3 Feature Walkthrough (Desktop)

**Captured:** 18 October 2026 · **Build:** `dev` at `813347e` · **View:** web build at desktop size (1440 × 900) · **Back end:** same build, run locally against a fresh database loaded with the seed data

This page shows the same walkthrough as [Sprint 3 Feature Walkthrough](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough) in the web build at desktop width: 79 screens across the Job Seeker, Career Professional and Platform Owner roles. From 1024 px wide the web app switches to its desktop layout, with a brand panel beside the welcome, log-in, registration and password screens and a sidebar for each role elsewhere. Story IDs refer to the [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements).

## How the screens were captured

- The same Playwright script as the phone page ran in Chromium at 1440 × 900, against its own fresh local database loaded with the seed data, the labelled payment stub and no email sending. The phone page lists the data made for the walkthrough and the gaps the screens show.
- Numbers match the phone page. Scrolled shots of screens that fit without scrolling at this width are left out (06, 07, 21, 39a, 46, 62).

## 1. Public screens, no login

| <img src="desktop-screenshots/01-welcome.png" width="480" alt="Welcome: choose Job Seeker or Career Professional, or browse as a guest"> | <img src="desktop-screenshots/02-explore.png" width="480" alt="Explore lists every published service with its Career Professional, price and rating"> |
|---|---|
| **01** Welcome: choose Job Seeker or Career Professional, or browse as a guest · *US-01, US-04* | **02** Explore lists every published service with its Career Professional, price and rating · *US-44* |
| <img src="desktop-screenshots/03-explore-filters.png" width="480" alt="Filters for delivery, location, price and rating, and sorting; here, in-person services only"> | <img src="desktop-screenshots/04-service-detail.png" width="480" alt="Service detail with the verified Career Professional card"> |
| **03** Filters for delivery, location, price and rating, and sorting; here, in-person services only · *US-45* | **04** Service detail with the verified Career Professional card · *US-46* |
| <img src="desktop-screenshots/05-professional-profile.png" width="480" alt="Career Professional profile on one screen: verified badge, rating, LinkedIn, qualifications, skills, languages, background, experience and services"> | <img src="desktop-screenshots/08-register-job-seeker.png" width="480" alt="Registration with the role choice"> |
| **05** Career Professional profile on one screen: verified badge, rating, LinkedIn, qualifications, skills, languages, background, experience and services · *US-46, US-30* | **08** Registration with the role choice · *US-01* |
| <img src="desktop-screenshots/09-login-failed.png" width="480" alt="A wrong password gives one generic error, with no hint which field was wrong"> | <img src="desktop-screenshots/10-forgot-password.png" width="480" alt="Forgot password: request a reset link"> |
| **09** A wrong password gives one generic error, with no hint which field was wrong · *US-07* | **10** Forgot password: request a reset link · *US-70* |
| <img src="desktop-screenshots/10a-forgot-password-sent.png" width="480" alt="Link requested: the same answer whether or not the address has an account"> | <img src="desktop-screenshots/10b-reset-password.png" width="480" alt="The emailed link opens Choose a new password"> |
| **10a** Link requested: the same answer whether or not the address has an account · *US-70* | **10b** The emailed link opens Choose a new password · *US-70* |
| <img src="desktop-screenshots/10c-reset-password-done.png" width="480" alt="Password changed; every other session is ended and the person logs in again"> |  |
| **10c** Password changed; every other session is ended and the person logs in again · *US-70* |  |

## 2. Yoir Diagnosis and Direction

| <img src="desktop-screenshots/11-diagnosis-step1.png" width="480" alt="A new Job Seeker starts at step 1 of 6: Where are you now?"> | <img src="desktop-screenshots/12-diagnosis-step1-answered.png" width="480" alt="One answer chosen; Continue saves it and moves on"> |
|---|---|
| **11** A new Job Seeker starts at step 1 of 6: Where are you now? · *US-09, US-10* | **12** One answer chosen; Continue saves it and moves on · *US-10, US-11* |
| <img src="desktop-screenshots/13-diagnosis-step2.png" width="480" alt="Step 2: What are you trying to achieve?"> | <img src="desktop-screenshots/14-diagnosis-step3.png" width="480" alt="Step 3: What have you tried so far? More than one answer allowed"> |
| **13** Step 2: What are you trying to achieve? · *US-10* | **14** Step 3: What have you tried so far? More than one answer allowed · *US-10* |
| <img src="desktop-screenshots/14a-diagnosis-resumed.png" width="480" alt="Answers are saved to the account: logging in on another browser offers to pick up at step 4"> | <img src="desktop-screenshots/15-diagnosis-step4.png" width="480" alt="Step 4: Where are you getting stuck?"> |
| **14a** Answers are saved to the account: logging in on another browser offers to pick up at step 4 · *US-09, US-11* | **15** Step 4: Where are you getting stuck? · *US-10* |
| <img src="desktop-screenshots/16-diagnosis-step5.png" width="480" alt="Step 5: barriers, more than one answer allowed"> | <img src="desktop-screenshots/17-diagnosis-direction.png" width="480" alt="Step 6, Your Yoir Direction, worked out by the back end from the saved answers: the main area to work on and suggested next steps"> |
| **16** Step 5: barriers, more than one answer allowed · *US-10* | **17** Step 6, Your Yoir Direction, worked out by the back end from the saved answers: the main area to work on and suggested next steps · *US-12* |
| <img src="desktop-screenshots/18-diagnosis-matches.png" width="480" alt="Relevant Career Professionals for the direction, best match first"> | <img src="desktop-screenshots/19-diagnosis-to-explore.png" width="480" alt="Explore opened from the direction, with the matches first"> |
| **18** Relevant Career Professionals for the direction, best match first · *US-12, US-13* | **19** Explore opened from the direction, with the matches first · *US-13* |

## 3. Job Seeker home, profile and privacy

| <img src="desktop-screenshots/20-js-home.png" width="480" alt="Home after the diagnosis: best matches and retake"> | <img src="desktop-screenshots/22-js-profile.png" width="480" alt="Edit profile"> |
|---|---|
| **20** Home after the diagnosis: best matches and retake · *US-06, US-13* | **22** Edit profile · *US-29* |
| <img src="desktop-screenshots/23-js-profile-filled.png" width="480" alt="Current role and career goals filled in"> | <img src="desktop-screenshots/24-privacy-settings.png" width="480" alt="Profile privacy: three visibility levels"> |
| **23** Current role and career goals filled in · *US-29* | **24** Profile privacy: three visibility levels · *US-27* |
| <img src="desktop-screenshots/25-privacy-partially-visible.png" width="480" alt="Partially visible chosen and saved"> | <img src="desktop-screenshots/26-notifications.png" width="480" alt="Notifications: empty, because the back end is deferred"> |
| **25** Partially visible chosen and saved · *US-27* | **26** Notifications: empty, because the back end is deferred · *US-60, US-61 (deferred)* |
| <img src="desktop-screenshots/27-account-sheet.png" width="480" alt="Account menu: edit profile, my sessions, profile privacy, log out"> |  |
| **27** Account menu: edit profile, my sessions, profile privacy, log out · *US-08* |  |

## 4. Booking and payment

| <img src="desktop-screenshots/28-choose-time.png" width="480" alt="Choose a time: only open times are offered"> | <img src="desktop-screenshots/29-time-selected.png" width="480" alt="A time chosen; the summary shows the date, time and price"> |
|---|---|
| **28** Choose a time: only open times are offered · *US-40* | **29** A time chosen; the summary shows the date, time and price · *US-40* |
| <img src="desktop-screenshots/29a-pre-session-brief.png" width="480" alt="An optional pre-session brief for the Career Professional, added before paying"> | <img src="desktop-screenshots/30-checkout.png" width="480" alt="Review and pay: the time is held for 15 minutes; total and cancellation policy"> |
| **29a** An optional pre-session brief for the Career Professional, added before paying · *US-42* | **30** Review and pay: the time is held for 15 minutes; total and cancellation policy · *US-41, US-47* |
| <img src="desktop-screenshots/31-confirmation.png" width="480" alt="Booked: session, delivery, payment status and references. The stub is labelled: no real money moved"> | <img src="desktop-screenshots/32-my-sessions.png" width="480" alt="My sessions: coming up, with join, receipt and cancel"> |
| **31** Booked: session, delivery, payment status and references. The stub is labelled: no real money moved · *US-47, US-68* | **32** My sessions: coming up, with join, receipt and cancel · *US-43, US-68* |
| <img src="desktop-screenshots/33-booking-detail.png" width="480" alt="Booking detail with the online meeting link and Reschedule"> | <img src="desktop-screenshots/33a-reschedule.png" width="480" alt="Reschedule: pick another open time; the order and payment stay the same"> |
| **33** Booking detail with the online meeting link and Reschedule · *US-43, US-69* | **33a** Reschedule: pick another open time; the order and payment stay the same · *US-69* |
| <img src="desktop-screenshots/33b-rescheduled.png" width="480" alt="Rescheduled: the booking shows the new time"> | <img src="desktop-screenshots/34-receipt.png" width="480" alt="Receipt"> |
| **33b** Rescheduled: the booking shows the new time · *US-69* | **34** Receipt · *US-47* |
| <img src="desktop-screenshots/35-cancel-confirm.png" width="480" alt="Cancelling shows the refund rule before it is confirmed"> | <img src="desktop-screenshots/36-in-person-meeting-address.png" width="480" alt="In-person booking: the meeting address the Career Professional added"> |
| **35** Cancelling shows the refund rule before it is confirmed · *Cancellation policy* | **36** In-person booking: the meeting address the Career Professional added · *US-43* |
| <img src="desktop-screenshots/37-my-sessions-past.png" width="480" alt="Past sessions: a completed session can be reviewed"> | <img src="desktop-screenshots/38-review.png" width="480" alt="Review: star rating and written review"> |
| **37** Past sessions: a completed session can be reviewed · *US-53* | **38** Review: star rating and written review · *US-53* |
| <img src="desktop-screenshots/39-review-submitted.png" width="480" alt="Submitted: the service page shows the new rating, the review count and the written review"> | <img src="desktop-screenshots/39b-professional-rating.png" width="480" alt="The Career Professional’s overall rating, now worked out from submitted reviews"> |
| **39** Submitted: the service page shows the new rating, the review count and the written review · *US-53, US-54* | **39b** The Career Professional’s overall rating, now worked out from submitted reviews · *US-55* |

## 5. Becoming a Career Professional

| <img src="desktop-screenshots/40-register-career-professional.png" width="480" alt="Registering as a Career Professional"> | <img src="desktop-screenshots/41-register-success.png" width="480" alt="Account created; continue to log in"> |
|---|---|
| **40** Registering as a Career Professional · *US-04* | **41** Account created; continue to log in · *US-02* |
| <img src="desktop-screenshots/42-cp-onboarding.png" width="480" alt="First login: finish the profile and verification before publishing"> | <img src="desktop-screenshots/43-cp-verification-start.png" width="480" alt="Verification: submit a LinkedIn profile URL"> |
| **42** First login: finish the profile and verification before publishing · *US-05* | **43** Verification: submit a LinkedIn profile URL · *US-31* |
| <img src="desktop-screenshots/44-cp-verification-pending.png" width="480" alt="Submitted: verification pending"> | <img src="desktop-screenshots/44a-cp-onboarding-progress.png" width="480" alt="Onboarding shows the verification step as done; the profile step is still to finish"> |
| **44** Submitted: verification pending · *US-31, US-32* | **44a** Onboarding shows the verification step as done; the profile step is still to finish · *US-05* |

## 6. Career Professional workspace

| <img src="desktop-screenshots/45-cp-workspace.png" width="480" alt="Workspace: verification status, payouts, sessions, profile and My services with edit and delete"> | <img src="desktop-screenshots/47-cp-profile.png" width="480" alt="Professional profile form"> |
|---|---|
| **45** Workspace: verification status, payouts, sessions, profile and My services with edit and delete · *US-32, US-34, US-36* | **47** Professional profile form · *US-30* |
| <img src="desktop-screenshots/48-cp-profile-details.png" width="480" alt="Experience, qualifications, skills and expertise"> | <img src="desktop-screenshots/49-cp-new-service.png" width="480" alt="New service: title, description and price"> |
| **48** Experience, qualifications, skills and expertise · *US-30* | **49** New service: title, description and price · *US-34, US-35* |
| <img src="desktop-screenshots/50-cp-new-service-delivery.png" width="480" alt="Duration, delivery and the meeting area an in-person service needs"> | <img src="desktop-screenshots/51-cp-service-published.png" width="480" alt="The new service in My services"> |
| **50** Duration, delivery and the meeting area an in-person service needs · *US-37, US-38* | **51** The new service in My services · *US-34* |
| <img src="desktop-screenshots/52-cp-edit-service.png" width="480" alt="Edit a service"> | <img src="desktop-screenshots/53-cp-delete-confirm.png" width="480" alt="Delete a service: bookings already made are not affected"> |
| **52** Edit a service · *US-36* | **53** Delete a service: bookings already made are not affected · *US-36* |
| <img src="desktop-screenshots/54-cp-availability.png" width="480" alt="Availability calendar"> | <img src="desktop-screenshots/55-cp-verification-verified.png" width="480" alt="Verification status: verified"> |
| **54** Availability calendar · *US-39* | **55** Verification status: verified · *US-32* |
| <img src="desktop-screenshots/56-cp-payouts.png" width="480" alt="Payouts and tax details through Stripe Connect"> | <img src="desktop-screenshots/57-cp-bookings.png" width="480" alt="Sessions you are delivering, with the pre-session brief"> |
| **56** Payouts and tax details through Stripe Connect · *US-47* | **57** Sessions you are delivering, with the pre-session brief · *US-42* |
| <img src="desktop-screenshots/58-cp-booking-detail-brief.png" width="480" alt="Booking detail: the brief, the time zone and the joining link"> | <img src="desktop-screenshots/59-cp-add-meeting-address.png" width="480" alt="In-person booking: add a meeting address"> |
| **58** Booking detail: the brief, the time zone and the joining link · *US-42, US-43* | **59** In-person booking: add a meeting address · *US-43* |
| <img src="desktop-screenshots/60-cp-meeting-address-saved.png" width="480" alt="The address saved, shown to both participants"> | <img src="desktop-screenshots/60a-cp-privacy-partial.png" width="480" alt="A Career Professional sets their profile to Partially visible"> |
| **60** The address saved, shown to both participants · *US-43* | **60a** A Career Professional sets their profile to Partially visible · *US-27* |
| <img src="desktop-screenshots/60b-privacy-partial-view.png" width="480" alt="What a Job Seeker sees of a Partially visible profile: name, summary, rating and services; background, qualifications and languages are hidden"> | <img src="desktop-screenshots/60c-privacy-restricted-view.png" width="480" alt="Restricted: other members see only that the profile is restricted"> |
| **60b** What a Job Seeker sees of a Partially visible profile: name, summary, rating and services; background, qualifications and languages are hidden · *US-28* | **60c** Restricted: other members see only that the profile is restricted · *US-28* |

## 7. Platform Owner

| <img src="desktop-screenshots/61-admin-overview.png" width="480" alt="Overview: people, sessions and money, including where the money went"> | <img src="desktop-screenshots/63-admin-verification-queue.png" width="480" alt="Verification queue, oldest first"> |
|---|---|
| **61** Overview: people, sessions and money, including where the money went · *US-48, US-71* | **63** Verification queue, oldest first · *US-58* |
| <img src="desktop-screenshots/64-admin-verification-detail.png" width="480" alt="A submission: open the LinkedIn profile, then approve, reject or leave pending"> | <img src="desktop-screenshots/65-admin-approve-confirm.png" width="480" alt="Confirm the approval"> |
| **64** A submission: open the LinkedIn profile, then approve, reject or leave pending · *US-58* | **65** Confirm the approval · *US-58* |
| <img src="desktop-screenshots/66-admin-verification-approved.png" width="480" alt="Approved; an additional-investigation outcome can be recorded"> | <img src="desktop-screenshots/66a-admin-reject-reason.png" width="480" alt="Rejecting needs a reason, which the Career Professional reads (not confirmed here)"> |
| **66** Approved; an additional-investigation outcome can be recorded · *US-33* | **66a** Rejecting needs a reason, which the Career Professional reads (not confirmed here) · *US-58, US-32* |
| <img src="desktop-screenshots/67-admin-payments.png" width="480" alt="Payments, with the amount split for each order"> | <img src="desktop-screenshots/68-admin-payment-detail.png" width="480" alt="Order detail: progress, who and when, then the money breakdown"> |
| **67** Payments, with the amount split for each order · *US-48* | **68** Order detail: progress, who and when, then the money breakdown · *US-48* |
| <img src="desktop-screenshots/69-admin-bookings.png" width="480" alt="Every booking on the platform"> | <img src="desktop-screenshots/70-admin-users.png" width="480" alt="Users: Career Professionals and Job Seekers with their status"> |
| **69** Every booking on the platform · *US-48* | **70** Users: Career Professionals and Job Seekers with their status · *US-71* |
| <img src="desktop-screenshots/70a-admin-users-job-seekers.png" width="480" alt="Users: the Job Seekers list"> |  |
| **70a** Users: the Job Seekers list · *US-71* |  |
