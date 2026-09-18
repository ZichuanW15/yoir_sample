# US-30 frontend: Career Professional profile

Issue: [#128](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/128),
under [US-30 #24](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/24).

This slice lets a signed-in Career Professional create and edit their professional profile on one
screen. The profile covers photo, LinkedIn URL, introduction, background, experience,
qualifications, skills and expertise, languages, default delivery and base location. How Job Seekers
see these details on the public profile page belongs to [US-46](us46-service-evaluation.md). LinkedIn review belongs to US-31/US-32,
and payouts (US-47) are documented separately. The workspace that links here is described in
[US-34](us34-create-a-service.md).

## Screens and flow

- Route `/counsellor/profile`: [profile.tsx](../../../frontend/app/counsellor/profile.tsx), registered
  in [_layout.tsx](../../../frontend/app/_layout.tsx).
- Entry points: the workspace card "Professional profile" in
  [index.tsx](../../../frontend/app/counsellor/index.tsx), and the **Profile** tab of the
  Career Professional bottom navigation in
  [CounsellorNav.tsx](../../../frontend/src/components/CounsellorNav.tsx), which was added in `0dd0d24`.
  Navigation tabs use `router.replace`. The workspace card shows `n/5` completed sections
  (LinkedIn URL, introduction, background, experience, base-location state) and a pill reading "Set up" when
  none is complete, otherwise "Edit". There is no separate first-login step: a Career Professional lands on
  `/counsellor` after login (`homeFor` in [navigation.ts](../../../frontend/src/navigation.ts)).
- From top to bottom, the screen contains:
  - the shared `TopBar` and the heading "Professional profile";
  - a photo (or initials avatar), the pencil "Edit profile photo", the name and a verification tag;
  - "Remove photo" (when a photo is set) and "Paste an image URL instead", which reveals an "Image URL" field;
  - **How you introduce yourself**: LinkedIn profile URL, Introduction, Background and Experience;
  - **What Job Seekers check before booking**: Qualifications (one per line), Skills and expertise
    (comma-separated) and Languages you work in (comma-separated);
  - **Default delivery**: Online or In person chips, one of which is selected;
  - **Where you are based**: state chips `NSW VIC QLD WA SA TAS ACT NT` (tap again to clear) and City or region;
  - a fixed **Save profile** button, followed by the bottom navigation.

## Behaviour and states

- **Role guard:** with no session, or a role other than `counsellor`, the screen renders `<Redirect href="/" />`.
- **Load:** every focus (`useFocusEffect`) calls `getOwnCounsellorProfile`. Qualifications are joined
  with newlines; expertise and languages are joined with `, `. There is no loading indicator: fields are
  empty until the read resolves. A load failure shows the error in the banner.
- **Verification tag:** "Verified Career Professional" when `verificationStatus` is `verified`, otherwise
  "Verification pending", including for `rejected`. The status never blocks editing.
- **Client validation** runs on Save. Only the first failing rule is reported, in a single `ErrorBanner`
  (`accessibilityRole="alert"`) above the cards. Nothing is sent while a rule fails.

| Rule (in order) | Message |
|---|---|
| LinkedIn URL empty | Add your LinkedIn profile URL so the Platform Owner can verify you. |
| Host is not `linkedin.com` or a subdomain | Enter a LinkedIn profile URL, for example https://www.linkedin.com/in/your-name. |
| Introduction under 20 characters (trimmed) | Write at least 20 characters so buyers know who they are booking. |
| Background blank | Describe your professional background. |
| Experience blank | Describe the experience you bring to a session. |
| Default In person without state or city | An in-person default needs the state and city you usually meet clients in. |
| State chosen, city blank | Add the city or region for the state you chose. |

- **Normalisation:** the LinkedIn URL can be entered with or without a scheme. It is sent as `https://<host><path>`,
  and after a successful save the field shows that normalised form. Text fields are trimmed. List fields
  are trimmed, with blanks and duplicates removed (`listOf`). `baseLocation` is sent only when a state is
  chosen: a city entered without a state is dropped silently. An empty photo becomes `photoUrl: null`.
- **Saving:** while the request is pending, the button is busy and disabled. The toast "Your profile is saved
  and visible on your listings." appears only after the PATCH resolves. The returned profile is not
  written back into the form; the next focus reads the profile again.
- **Failure:** `userFacingError` puts the API's `message` in the banner. On a network `TypeError`, it shows "We
  could not reach Yoir. Check your connection and try again." Entered values are kept, and Save is
  enabled again. `fieldErrors` are not mapped onto individual fields.
- **Photo:** tapping the pencil requests media-library permission.
  - If permission is denied, the flash reads "Allow photo access, or paste an image URL instead."
  - If the picker throws, it reads "The photo library is unavailable — paste an image URL instead."
  - Cancelling changes nothing.
  - A picked image (square crop, quality 0.8) replaces the preview. Its local `uri` is later sent as
    `photoUrl`, and nothing uploads the file. The code comment says the pasted URL is "the one that
    survives a reload".
- **Labels tests rely on:** the field labels above ("LinkedIn profile URL", "Introduction", "Background",
  "Experience", "Qualifications", "Skills and expertise", "Languages you work in", "City or region",
  "Image URL"). Buttons are labelled "Save profile", "Edit profile photo", "Remove photo" and "Paste an image URL
  instead" / "Hide image URL" (`expanded` state). Chips have `radio` role and are named by their label.
  The photo is labelled `<name>, profile photo`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getOwnCounsellorProfile(user, token)` | `GET /counsellors/{id}` | Public profile route, called with the bearer token. Also read by the workspace. |
| `api.updateOwnCounsellorProfile(id, update, token)` | `PATCH /me/counsellor-profile` | Sends the whole profile: `photoUrl`, `linkedinUrl`, `introduction`, `background`, `experience`, `qualifications`, `expertise`, `languages`, `baseLocation`, `defaultModality`. The id argument is not used in the request; the backend writes the caller's own record. |

The backend route in [counsellor.py](../../../backend/app/routers/counsellor.py) requires the
`counsellor` role. It rejects a non-LinkedIn host with `400` and `fieldErrors.linkedinUrl`, and it
forbids unknown fields. [schemas.py](../../../backend/app/schemas.py) caps text fields at 5,000
characters, each list at 20 items and `photoUrl` at 2,000 characters.

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| New profile: provide all fields, success only after the backend confirms, and reopening shows the saved values | Every listed field is editable. Success waits for the PATCH, and each focus reads the profile again. The photo is stored as a URI string and is not uploaded. | `counsellor-profile.test.tsx`: "submits implemented profile fields and reloads values from the mocked API response" and "pending verification permits editing and success waits for the mocked API promise" (mocked API). Planned probes "[QA-130][US30-AC1/2] profile offers an editable qualifications field" / "…spoken languages field" pass on `64cb324`. Backend: `test_counsellor_profile_details.py::test_details_are_saved_and_shown_on_the_public_profile`. **Partial:** no browser or device save test; photo upload absent. |
| Edit any field, backend stores it, updated values returned | Same PATCH as for a new profile; values are re-read on focus | Same component tests; "an API-boundary rejection retains edits and enables retry". **Partial:** mocked API only |
| Default modality offers only online, in-person or both | Offers **Online** and **In person** as mutually exclusive chips, with no "both" | Planned "[QA-130][US30-AC3] default delivery supports both online and in-person" **fails**. **Not met** |
| Backend validation error: shown against the relevant field(s), values kept, no success | Shows the backend `message` in one banner, keeps values and shows no toast. Field mapping is not implemented. | "an API-boundary rejection retains edits and enables retry" passes. Planned "[QA-130][US30-AC4] displays each backend field error while retaining profile edits" **fails**. **Partial** |
| Job Seeker or another Career Professional cannot update this profile | The screen redirects other roles. The endpoint has no profile id, so a caller can only write their own profile. | "does not expose profile controls to an unauthorized role (%j)". The backend route uses `require_counsellor`, but no backend test sends a wrong-role request to `PATCH /me/counsellor-profile` (it is absent from `COUNSELLOR_OPERATIONS` in `test_sprint2_counsellor_acceptance.py`). **Gap** |
| Pending verification does not block create/edit | No status gate on this screen | "pending verification permits editing and success waits for the mocked API promise" |

## Tests

- [counsellor-profile.test.tsx](../../../frontend/__tests__/screens/counsellor-profile.test.tsx): 18 cases
  covering role guard, prefill, save, validation table, in-person default, load failure, retry, and photo
  permission, failure, cancel, URL and remove paths.
- [counsellor-issue-acceptance.test.tsx](../../../frontend/__tests__/defects/counsellor-issue-acceptance.test.tsx)
  (defect suite): three "[QA-130][US30-AC1] … cannot announce a durable saved profile" cases.
- [counsellor-features.test.tsx](../../../frontend/__tests__/planned/counsellor-features.test.tsx) and
  [counsellor-validation-ux.test.tsx](../../../frontend/__tests__/planned/counsellor-validation-ux.test.tsx)
  (archived probes, not a release gate).
- [web.spec.ts](../../../frontend/e2e/web.spec.ts): "[QA-106][US08-AC3] logout prevents browser history
  and protected deep-link access" opens the profile and checks that signed-out users cannot reach it. It does
  not save a profile.

From `frontend/`:

```bash
npm test -- __tests__/screens/counsellor-profile.test.tsx
npm run test:defects -- __tests__/defects/counsellor-issue-acceptance.test.tsx
npm run test:planned -- __tests__/planned/counsellor-features.test.tsx
```

Run locally on `dev` at `64cb324` on 18 September 2026: all 18 regression cases and all 3 defect cases passed.
In the planned files, the two field probes passed and the "both" default probe failed.

## Known gaps

- **"Both" default delivery:** it cannot be expressed, so US30-AC3 is not met.
- **Field-level errors:** neither client nor server errors are shown against individual fields.
- **Photo upload:** there is none. A picked image's local URI is saved as `photoUrl`, so other devices cannot load it, and a long URI can exceed the 2,000-character limit.
- **Verification tag:** a `rejected` status shows as "Verification pending".
- **Silent data loss:** a city entered without a state is not saved, and no message says so.
- **QA records:** [qa-matrix.md](../qa/qa-matrix.md) and [issue-evidence.json](../qa/issue-evidence.json)
  (16 September) still describe profile persistence as absent and list a false-success defect.
  [dev-sync-review-20260918.md](../qa/dev-sync-review-20260918.md) says profile fallbacks no longer
  reproduce, and those defect cases pass on `dev`.
- **Device evidence:** native case N08 (photo picker) is not run on iOS, and only picker open and cancel were observed on Android.
  There is no iOS or Android save recording.
- **Navigation tests:** no test covers `CounsellorNav`.
