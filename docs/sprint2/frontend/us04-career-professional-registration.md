# US-04 frontend: Career Professional registration

Issue: [#89](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/89),
under [US-04 #7](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/7).

A visitor can register as a Career Professional on the same registration screen Job Seekers use: the same
four fields, the same checks, the same success and duplicate-email behaviour. The parent issue calls this
role "Career Counsellor". The app shows "Career Professional", and the value sent is still `counsellor`.
This document covers only what differs for this role. For the shared form, outcome and duplicate-email
behaviour, see [US-01](us01-job-seeker-registration.md), [US-02](us02-registration-outcome.md) and
[US-03](us03-duplicate-email.md). The backend accepts `counsellor` on the same endpoint
([backend](../backend/us01-registration.md)).

## Screens and flow

| Step | Route | File | What the user sees |
|---|---|---|---|
| 1 | `/` | [index.tsx](../../../frontend/app/index.tsx) | Card **I am a Career Professional**: "Publish services, set availability and take bookings." |
| 2 | `/auth/welcome?role=counsellor` | [welcome.tsx](../../../frontend/app/auth/welcome.tsx) | Tag "Career Professional", headline "Take bookings on Yoir", **Log in** and **Create an account**. There is no **Continue as a guest** button for this role. |
| 3 | `/auth/register?role=counsellor` | [register.tsx](../../../frontend/app/auth/register.tsx) | The shared form with the **Career Professional** card preselected |
| 4 | `/auth/login?role=counsellor&email=…` | [login.tsx](../../../frontend/app/auth/login.tsx) | Reached with **Continue to log in** after success |

A visitor who reaches the form by another route, where Job Seeker is preselected, can tap the **Career
Professional** card before submitting. The selection is a radio group, so only one role can be chosen.

## Behaviour and states

- The fields, the three device checks and their messages, the busy state, the success panel and the error
  banner are the same as for Job Seekers. There are no professional fields at registration. Profile,
  services and verification come after first login and belong to other stories.
- The selected role is sent as `role: "counsellor"`, and after success the same value is passed to the
  login screen as the `role` parameter. Where a Career Professional ends up after logging in is
  documented in [US-06](us06-login-role-navigation.md).
- **Platform Owner cannot be chosen.** The entry and welcome screens offer only the two public roles.
  The register screen maps any `role` parameter other than `counsellor` to `job_seeker` (in its
  `useState` initialiser), and `RegisterRequest.role` in [types.ts](../../../frontend/src/api/types.ts)
  allows only `'job_seeker' | 'counsellor'`. The welcome screen does the same: `role=platform_owner`
  shows the Job Seeker choices.
- A duplicate email for this role shows the same banner and keeps the values, including the selected role.

Accessibility labels: the entry card `I am a Career Professional`, the welcome buttons `Log in`,
`Create an account` and `Back`, and the radio `Career Professional`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.register({ …, role: "counsellor" })` | `POST /auth/users` | Same request as US-01. The backend rejects `platform_owner` and unknown roles ([backend](../backend/us01-registration.md)). |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| AC1: a signed-out visitor sees Career Professional offered alongside Job Seeker, with the same name, email, password and confirmation fields | **Met.** Both radio cards appear on one screen above the same four inputs. | `register.test.tsx` "[QA-91] the user can change the role before submitting"; "[QA-87/91] registers %s and retains the booking on the login continuation" (with `role=counsellor`, checks the Career Professional radio); `welcome.test.tsx` "[QA-91] counsellor welcome preserves the role and requires an account"; `navigation.test.tsx` "[QA-87/91] %s opens its role welcome" |
| AC2: completing the form as a Career Professional with an unused email creates a `counsellor` account with a hashed password; the app shows success and goes to login | **Met in the frontend** (login after the user taps **Continue to log in**, as in [US-02](us02-registration-outcome.md)). Hashing is backend work. | `register.test.tsx` "[QA-87/91] registers %s…" (`counsellor` case: body `role`, success panel, `replace` to `/auth/login` with `role: 'counsellor'`); Playwright `US01/04 Web registration persists counsellor` (logging in through the API returns `user.role === 'counsellor'`); backend `tests/test_sprint2_counsellor_acceptance.py` (QA [#91](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/91)) |
| AC3: a Career Professional registration with an already-registered email creates no account and shows the same form-level error as US-03 | **Met.** Same banner, values and role kept. | `register.test.tsx` "[QA-97/91] duplicate email for %s retains every field and succeeds after correction" (`counsellor` case). The Playwright duplicate test uses the Job Seeker form only. |

## Tests

| File | Covers |
|---|---|
| [`__tests__/screens/register.test.tsx`](../../../frontend/__tests__/screens/register.test.tsx) | Role preselection, role switch, `counsellor` success and duplicate paths |
| [`__tests__/screens/welcome.test.tsx`](../../../frontend/__tests__/screens/welcome.test.tsx) | Career Professional welcome: no guest option; Create an account passes `role` |
| [`__tests__/screens/navigation.test.tsx`](../../../frontend/__tests__/screens/navigation.test.tsx) | Entry card opens the matching welcome |
| [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts) | `US01/04 Web registration persists counsellor` |

```bash
# from frontend/
npm test -- __tests__/screens/register.test.tsx __tests__/screens/welcome.test.tsx __tests__/screens/navigation.test.tsx
```

These suites passed on 18 September 2026 at `dev` `64cb324` (24 tests). The Playwright case was not
rerun for this document.

## Known gaps

- QA [#91](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/91) is still open.
  Native case N01 is "not run" on iOS and Android in the
  [native acceptance plan](../qa/native-acceptance-delta.md). The role-selector screenshots listed in the
  parent issue do not exist.
- The parent issue still says "Career Counsellor", and so does the 16 September
  [native device report](../qa/native-device-results-20260916.md), which records the account sheet from
  an older build. The app now says "Career Professional" everywhere.
- LinkedIn sign-in during registration was left undecided in the parent story (CLIENT-01) and is not
  implemented.
- The [QA matrix](../qa/qa-matrix.md) records that a newly registered Career Professional's account is
  pending and currently gets a 403 when publishing. That is outside this story, but it is the first thing
  such a user runs into after registering.
