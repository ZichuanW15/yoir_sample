# US-29 frontend: Job Seeker profile

Issue: [US-29 #82](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/82)
(Product Backlog; no front-end sub-issue yet).

A signed-in Job Seeker can open their profile from the account sheet, edit their name, current role or
study and career goals, and add, change or remove a photo. Everything saves to the backend. The photo
then appears on the top bar and in the account sheet. US-29 was not part of the committed Sprint 2
scope; the client listed Job Seeker profiles as an initial MVP priority, and this slice reached `dev` on
18 September 2026 with its backend.

## Screens and flow

| Route | File | Reached from |
|---|---|---|
| `/job-seeker/profile` | [`app/job-seeker/profile.tsx`](../../../frontend/app/job-seeker/profile.tsx) | Account sheet (tap the avatar on the top bar) → **Edit profile** |

The screen has a back bar titled "Edit profile" (back returns to Home when there is no history). One card
holds the photo, name and email, then three fields and **Save profile**. The email is shown but cannot
be edited here.

The account sheet lives in [`src/chrome.tsx`](../../../frontend/src/chrome.tsx); the top bar in
[`src/components/TopBar.tsx`](../../../frontend/src/components/TopBar.tsx) (see
[navigation and branding](client-feedback-navigation-notifications-and-branding.md)).

## Behaviour and states

- **Loading:** a spinner until the profile arrives. If loading fails, an error banner and **Try again**.
- **Fields:** Name (required; saving without one shows "Add your name."), Current role or study (up to
  200 characters), Career goals (multi-line, up to 2,000).
- **Photo:** tap the avatar or "Add a photo" / "Change photo"; "Remove" clears it. There is no file
  storage behind the app, so the photo is sent as an inline image:
  - on a phone the system picker crops it square and compresses it (quality 0.5);
  - on the web the picker does neither, so the app crops it square and scales it to 480 px (JPEG);
  - anything over 2,000,000 characters is refused with "That photo is too large. Try a smaller one.";
  - no permission: "Allow photo access to add a profile photo."; no picker: "The photo library is
    unavailable."
- **Saving:** the whole profile is sent. Success shows the toast "Profile saved" only after the backend
  answers. If the name changed, the stored session is updated so greetings use the new name. The shared
  photo store ([`src/profilePhoto.ts`](../../../frontend/src/profilePhoto.ts)) is updated so every avatar
  shows the new photo.
- **Failure:** the backend's message in an error banner; entered values stay in the form.
- **Guards:** no session redirects to `/auth/login?role=job_seeker`; other roles go to their own home.

The photo is deliberately not part of the stored session: an inline image is far larger than
SecureStore holds. `useProfilePhoto` fetches it once per signed-in Job Seeker instead.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getJobSeekerProfile(token)` | `GET /me/job-seeker-profile` | Job Seeker only (403 for other roles, 401 without a token). |
| `api.updateJobSeekerProfile(update, token)` | `PATCH /me/job-seeker-profile` | Whole profile: `name`, `photoUrl` (data URI or `null`), `headline`, `careerGoals`. |

The backend trims and limits the fields (name 1–120, headline 200, goals 2,000) and accepts only JPEG,
PNG or WebP data URIs up to about 1.5 MB; an SVG is refused because it can carry script. Migration
`0004` added the `headline` and `career_goals` columns; the photo uses the existing `photo_url`.

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| Opening the profile shows the values returned by the backend | Loads with a spinner, then fills the form | Client and screen tests below; checked in the browser 18 Sep, including after a reload |
| Success only after the backend stores the update | Toast after `PATCH` resolves | Client and screen tests below |
| Invalid data or failure: error shown, values kept, no success | Error banner; form unchanged | Backend returns `400 VALIDATION_ERROR`; screen test below |
| Another user's or role's session is rejected | `/me/…` only ever reads the caller; other roles get 403 | `backend/tests/test_job_seeker_profile.py`; screen test below covers the frontend's own role redirect |

## Tests

- [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts): "the job seeker
  profile is read and replaced with the bearer token".
- [`__tests__/screens/job-seeker-profile.test.tsx`](../../../frontend/__tests__/screens/job-seeker-profile.test.tsx):
  screen-level coverage of all four acceptance criteria — loading and prefill, the login/home redirects
  for a missing session or a non-Job-Seeker role, the required-name check, a save toast that only
  appears once the mocked `PATCH` resolves, a rejected save that keeps the typed values and surfaces the
  backend's message, the load-failure retry, and the photo add/remove round trip.
- [`backend/tests/test_job_seeker_profile.py`](../../../backend/tests/test_job_seeker_profile.py):
  `test_job_seeker_saves_profile_and_photo`, `test_profile_photo_must_be_an_inline_raster_image`,
  `test_only_a_job_seeker_has_a_job_seeker_profile`.

Run from `frontend/`: `npm test -- __tests__/screens/job-seeker-profile.test.tsx __tests__/api/client.test.ts`.

## Known gaps

- Photos live in the database as data URIs, capped at about 1.5 MB, until the project has file storage.
- US-29 has no Front-end, Back-end or QA sub-issues on the board yet.
