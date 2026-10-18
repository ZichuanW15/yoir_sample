<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Client Meeting Minutes
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes
  Wiki commit: c6cceb7 (2026-10-16)
  Exported:    2026-10-18
-->

# Week 11
# Meeting Minutes - Client Meeting (CSD Koala)

| Field | Detail |
|---|---|
| Date | 16-10-2026 |
| Time | To confirm (about 26 minutes) |
| Location | Microsoft Teams |
| Meeting type | Client meeting / Sprint 3 progress review and demo |
| Client | Saumil Macwan (Sam) |
| Supervisor | Not present |
| Chairs | Jared Cheng and Manushresth Krishnan |
| Minuted by | Manushresth Krishnan, prepared from the meeting transcript |

**Participants identified in the transcript**

| Name | Role |
|---|---|
| Saumil Macwan (Sam) | Client / Yoir founder / career counsellor |
| Jared Cheng | Product Owner, CSD Koala |
| Manushresth Krishnan | Scrum Master, CSD Koala |
| Jashan Arora | Backend, CSD Koala |

---

## Discussion

| Topic | Notes |
|---|---|
| Koala and Quokka | Sam asked whether the two teams are building one product. Jared confirmed that CSD Koala and CSD Quokka each deliver their own version of the same brief, and will present separately in the same final meeting. |
| Terminology | Manu noted that, following Sam's earlier feedback, "counsellor" has been replaced with "Career Professional" throughout the app. |
| Guest browsing | A guest can browse Career Professionals, their services, each service's detail and its reviews. Booking a service requires logging in as a Job Seeker. |
| Booking and payment | After logging in, a Job Seeker picks an open slot and pays through a Stripe sandbox that simulates a card payment. The confirmation shows a booking number, a payment reference and a receipt. An "Open the meeting room" button lets the Job Seeker and the Career Professional join the live session from the app. |
| My bookings and reviews | A Job Seeker sees upcoming and past bookings, and can leave a star rating and a written review for a completed session. |
| Profile privacy | Job Seekers choose their profile visibility: public (name and reviews visible), partially visible (name and summary visible, personal details hidden) or restricted (profile hidden). Manu presented this as a non-functional requirement the team had addressed. |
| Platform Owner administration | The Overview shows money taken through Yoir, active sessions, payment holds, Career Professional payouts against Yoir commission, and sessions by status. The Platform Owner verifies Career Professionals from their LinkedIn URL and summary, approving or rejecting with a reason. Users lists Job Seekers and Career Professionals with their status. Bookings shows every session, including refunds and payouts. Payments opens each order to show payment progress, the Job Seeker and Career Professional involved and the session time, so the evidence for an order is on one screen. |
| Career Professional profile | Manu showed the Career Professional view: verification status, LinkedIn URL, introduction, background, experience, what Job Seekers check before booking (qualifications, skills and expertise, languages), default delivery and location, and upcoming and past bookings. |
| Demo conditions | Log-in and screen-sharing problems slowed the live demo. The app is deployed, and Sam can test it with his own accounts. |
| Yoir Diagnosis (key feedback) | Sam stressed that the diagnosis is "the heart and soul" of the app: it establishes why someone has come to Yoir (for example, not getting a job or an interview), in the way he questions a client in a counselling session. He is working on the questions himself and will send his version after reviewing the team's work. Manu explained that a new Job Seeker takes the diagnosis right after logging in: where they are now, what they are trying to achieve, what they have tried, where they are stuck and what barriers they face, followed by a Yoir Direction with relevant Career Professionals. It was not shown live because the demo account had already completed it. Jared explained that the diagnosis front end and back end are built but not yet integrated, and expected integration to take one to two days. |
| Screenshots and demo video | Sam asked for screenshots or a PDF of the work, as previous student teams had provided. Manu said the team has a GitHub page with screenshots of every user story worked on (the Sprint 3 Feature Walkthrough) and a demo video, and can send both. |
| Access to the live app | The deployment is a demo: anyone with the URL can reach it, but the URL is not public. Sam asked that it stay private and that nothing be launched. The team will keep updating the same link. |
| Handover | Jared restated the two options from the earlier email: Sam creates an empty GitHub repository and the team copies everything into it, history and documents included; or the team sends a zip file of the final version without history. The current repository cannot be transferred, because it belongs to the account that created it. Sam's concern is that he can keep developing without waiting on the team, which both options allow. It was agreed to do both. |
| Next steps | Sam will review the app and email his feedback. The team will incorporate it before the final session, which will include a product demo and a discussion of what is handed over (source code and set-up). |

---

## Confirmed Decisions

| # | Decision |
|---|---|
| 1 | The Yoir Diagnosis is the client's top priority. The team completes its front-end and back-end integration and updates the live link. |
| 2 | The demo deployment stays private, reachable only by URL. There is no public launch. |
| 3 | Handover uses both options: a full copy of the repository into an empty GitHub repository created by Sam, and a zip file of the final version. |
| 4 | The final session is the acceptance session on Friday 23-10-2026, 5:30-6:30 pm, with about 30 minutes for each team and the subject coordinator and mentor attending to assess. |
| 5 | Sam sends feedback by email after reviewing the app, and the team incorporates it before the final session. |

---

## Actions

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| 1 | Integrate the diagnosis front end with its back end and deploy it to the live link | Jared, Manu | 17-10-2026 | Open |
| 2 | Email Sam once the diagnosis is live so he can try it | Jared | 17-10-2026 | Open |
| 3 | Send Sam the screenshots page as a PDF and the demo video | Jared, Manu | With the update email | Open |
| 4 | Send this week's minutes and transcript to Sam | Jared | After the meeting | Open |
| 5 | Create an empty GitHub repository for the handover and share it with the team | Sam | Before the handover | Open |
| 6 | Copy the repository into Sam's repository and prepare the zip file, with set-up documentation | Jared | 23-10-2026 | Open |
| 7 | Review the live app and email feedback, including the revised diagnosis questions | Sam | Weekend of 17-18 Oct | Open |
| 8 | Incorporate Sam's feedback before the acceptance session | Whole team | 23-10-2026 | Open |

### Carried over from Week 8

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| 1 | Send Week 8 minutes, transcript and recording to Sam, CC Erfan | Jared | After the Week 8 meeting | Closed |
| 2 | Send weekly progress email to Sam | Jared | Weekly | Closed |
