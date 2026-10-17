# US-27, US-28 and US-29 frontend: profile privacy

Issues: front-end sub-issues [#181](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/181),
[#184](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/184) and
[#187](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/187), under
[US-27 #22](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/22),
[US-28 #23](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/23) and
[US-29 #82](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/82).

A Job Seeker or Career Professional chooses who can see their profile: Public, Partially visible or
Restricted. Another person's view of a Career Professional then shows only what the back end returns,
and a restricted profile says so instead of showing an empty page. The screen, the restricted state and
an app-wide floating error reached `dev` on 7 October 2026 in
[PR #234](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/234) (commits `ce745fe`
and `767d99f`). The back end that decides which fields are sent is documented in
[US-27–US-29 back end](../backend/us27-us29-profile-privacy.md); its final, "absent, not empty" filter
reached `dev` on 16 October in [PR #237](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/237).

US-29's own screen is unchanged from Sprint 2 apart from a Profile privacy button. Its 12 screen tests
(commit `9e43997`, pushed directly to `dev` on 7 October) are recorded in the [US-29 Sprint 2 document](../../sprint2/frontend/us29-job-seeker-profile.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 22–25.
Public profile and privacy transitions are also captured in the [QA browser evidence](../qa/evidence/20261017-final/browser-final.json).

## Screens and flow

| Route | File | What the user sees |
|---|---|---|
| `/settings/privacy` | [`app/settings/privacy.tsx`](../../../frontend/app/settings/privacy.tsx) | New. "Profile privacy": the three options and Save. |
| `/job-seeker/profile` | [`app/job-seeker/profile.tsx`](../../../frontend/app/job-seeker/profile.tsx) | US-29. A "Profile privacy" button under Career goals opens the screen. |
| `/counsellor/profile` | [`app/counsellor/profile.tsx`](../../../frontend/app/counsellor/profile.tsx) | A "Profile privacy" button under the photo controls opens the screen. |
| `/professionals/[counsellorId]` | [`app/professionals/[counsellorId].tsx`](../../../frontend/app/professionals/[counsellorId].tsx) | US-28. Another person's view of a Career Professional: the fields returned, or the restricted state. |

The privacy screen is reached only from the two profile screens. Back returns to the role's home when
there is no history.

## Behaviour and states

### Privacy settings (US-27)

- **Who:** no session redirects to log-in. A Platform Owner is sent to their own home, since they have
  no profile.
- **Heading:** "Who can see your profile?", then "Choose how your profile appears to other Yoir
  members. You can change this at any time."
- **Loading:** a spinner until `GET /me/profile-visibility` answers. The stored option is then
  pre-selected.
- **Options** (radio buttons with their checked state announced):

| Option | Value sent | Description shown |
|---|---|---|
| Public | `public` | People can see your complete profile. |
| Partially visible | `partial` | People see your name and summary, while personal details stay hidden. |
| Restricted | `restricted` | People see only that this profile is restricted. |

- **Save privacy settings** is disabled until an option other than the stored one is chosen. While the
  request runs it shows busy.
- **Saved:** the stored option becomes the one the back end returned, and a toast says "Privacy
  settings saved". Nothing claims success before the response.
- **Failed save or load:** the back end's message as an error, with no toast. See Recorded behaviour and findings for what
  stays selected.

### Another person's view of a Career Professional (US-28)

- **Restricted** (`restricted: true` or `visibility: "restricted"` in the response): a lock, "This
  profile is restricted", "This Career Professional has chosen not to share their profile details."
  and "Back to Explore". Their services are not listed on this screen.
- **Otherwise** the screen renders only what is present. The location line, the introduction, "View
  LinkedIn profile", and the Qualifications, Skills and expertise, Languages, Background and Experience
  sections each appear only when the response carries them. Nothing is rebuilt from service listings.
- **Partially visible** therefore shows the name, the verification tag, the rating when there is one,
  "<delivery> sessions", the introduction and the services, and nothing else.
- **Service detail:** the Career Professional card shows the introduction only when the listing carries
  one. A restricted Career Professional's listing sends `null`, so the card keeps the name,
  verification and rating but no introduction.
- The screen reads the profile each time it opens, so a changed setting shows on the next visit.

### The owner's own profile (US-28)

The Career Professional's own profile screen now reads `GET /me/counsellor-profile` instead of the
public `GET /counsellors/{id}`. The owner always sees, and autosaves from, their complete profile
whatever their setting, so a filtered copy is never saved back over hidden fields.

### Floating errors (all screens)

`ErrorBanner` now hands its message to one floating card above the current screen
([`src/floatingError.tsx`](../../../frontend/src/floatingError.tsx), mounted in
[`app/_layout.tsx`](../../../frontend/app/_layout.tsx)). It sits at the top on a phone and at the
bottom right on a web window 768 px or wider. A newer error replaces the older one rather than
stacking. "Dismiss error" closes it, and it is announced as an alert. Outside the provider, as in some
isolated tests, the inline banner is used instead.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getPrivacySettings` | `GET /me/profile-visibility` | New. Read each time the screen opens. |
| `api.updateProfileVisibility(visibility)` | `PATCH /me/profile-visibility` | New. Body `{visibility}`; the screen keeps the value the response returns. |
| `api.getCounsellorProfile(id)` | `GET /counsellors/{counsellorId}` | Filtered by the back end. Sent without a token, so a guest and a signed-in viewer see the same thing. A missing `overallRating` becomes `null` (`767d99f`). |
| `api.listServices()` | `GET /services` | The profile screen's own service list, not shown when restricted. |
| `api.getOwnCounsellorProfile` | `GET /me/counsellor-profile` | Was `GET /counsellors/{id}` before this PR. The owner's complete profile. |
| `api.listCounsellors(query)` | `GET /counsellors` | Best matches on the Job Seeker home and the direction step; filtered the same way. See Recorded behaviour and findings. |

## Executed acceptance coverage

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-27: choosing an option and Save shows it saved only after the back end confirms; pre-selected on reopening | Toast and stored value from the `PATCH` response; `GET` on every opening | `privacy-settings-boundaries.test.tsx` checks acknowledgement, duplicate blocking and a fresh reopen read; `sprint3-completion.spec.ts` checks actual persistence and public refresh |
| US-27: a stored Restricted is pre-selected, not a default | The `GET` value is selected | `privacy-settings-boundaries.test.tsx` checks stored Partial/Restricted for both member roles; back end `test_career_professional_can_save_and_read_privacy` |
| US-27: a rejected or failed update shows an English error, keeps the stored option, shows no success | Error and no toast; the failed choice stays selected | `sprint3-privacy-acceptance.test.tsx` retains the failing rollback assertion; API transaction rollback passes in `test_sprint3_completion_qa.py` |
| US-27: no session or an invalid value is rejected | No session redirects to log-in; the app can only send the three values | Back end `test_invalid_visibility_is_rejected_without_changing_the_saved_value` |
| US-27: another user's setting cannot be changed | `/me` only, no account ID sent | Back end `test_visibility_route_cannot_target_another_account` |
| US-28: Public shows every public field | Full profile | `professional-detail.test.tsx` asserts returned qualifications, location, rating and owner-specific services; walkthrough 05–06 |
| US-28: Partially visible shows only the permitted fields, absent from the response | Renders only fields present | `professional-detail.test.tsx` checks a sparse partial response; `sprint3-completion.spec.ts` checks actual omitted fields and refreshed UI; back end `test_partial_profile_keeps_summary_but_hides_personal_details` |
| US-28: Restricted shows a clear restricted state; no restricted fields returned | Restricted state; services not listed | `privacy-reviews.test.tsx` "renders an explicit restricted profile without leaking hidden fields"; back end `test_restricted_career_professional_profile_does_not_leak_details` |
| US-28: the owner sees their full profile | Own profile reads `/me/counsellor-profile` | `counsellor-client.test.ts` "getOwnCounsellorProfile reads the token owner with Bearer authentication"; back end `test_owner_still_receives_the_complete_profile_when_restricted` |
| US-28: a changed level shows on the next read with nothing carried over | Read on every opening; no copy kept in the app | `sprint3-completion.spec.ts` checks an already-open visitor view after partial/restricted/public changes; back end `test_visibility_change_removes_previously_public_fields_on_the_next_read` |
| US-29 | Unchanged apart from the Profile privacy button | [US-29 Sprint 2 document](../../sprint2/frontend/us29-job-seeker-profile.md); `job-seeker-profile.test.tsx` "opens profile privacy settings" |

## Tests

- [`__tests__/screens/privacy-reviews.test.tsx`](../../../frontend/__tests__/screens/privacy-reviews.test.tsx),
  "profile privacy — US-27/28": two tests. The other two in the file are US-53.
- [`__tests__/screens/floating-error.test.tsx`](../../../frontend/__tests__/screens/floating-error.test.tsx):
  "moves a page-level error into the overlay and lets the user dismiss it" and "shows only the newest
  error instead of stacking messages".
- [`__tests__/screens/job-seeker-profile.test.tsx`](../../../frontend/__tests__/screens/job-seeker-profile.test.tsx):
  12 tests for US-29, including "opens profile privacy settings".
- [`__tests__/api/counsellor-client.test.ts`](../../../frontend/__tests__/api/counsellor-client.test.ts):
  the owner's profile is read from `/me/counsellor-profile` and ignores a caller-supplied ID.
- [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts): "Career
  Professionals are listed and read publicly, without authentication", including the missing
  `overallRating`.

Run from `frontend/`: `npx jest __tests__/screens/privacy-reviews.test.tsx __tests__/screens/floating-error.test.tsx
__tests__/screens/job-seeker-profile.test.tsx __tests__/api/client.test.ts __tests__/api/counsellor-client.test.ts`.
**Original dev-only execution:** `0df4068`, 17 October 2026, Node 22.14.0: 5 suites, 54 passed.

The refresh adds ten [privacy-settings boundary cases](../../../frontend/__tests__/screens/privacy-settings-boundaries.test.tsx):
stored Partial/Restricted for both member roles, loading, authoritative PATCH
acknowledgement, duplicate prevention, reopen, initial-read failure, refused-save
retry and guest redirection. Their focused execution passed.

Two separate [private-match assertions](../../../frontend/__tests__/defects/sprint3-private-matches.test.tsx)
use [payloads generated by the actual backend mapper](../../../frontend/__tests__/privacy-profile-fixtures.json)
for Partial and Restricted profiles, preserving omitted private keys. Both
reproduced `S3-PRIVACY-MATCH-CRASH`; the render-error boundary records an ordinary
failed correctness assertion and keeps the runner/report healthy.

## QA branch evidence

The preceding dev-only counts identify the original source-document execution.
The `sprint3-qa` overlay adds executed API, component and browser coverage. Its
[17 October report](../qa/test-results-final-20261017.md) records the tested
`0df4068` product, and the [dev refresh report](../qa/test-results-dev-refresh-20261017.md)
records reconciliation with `972caee`. That dev update adds documentation; product
code is unchanged. Suite counts belong to their dated executions and are not added
together. The [meeting-area report](../qa/test-results-meeting-area-20261017.md)
retains the subsequent `9cce973` baseline from PR #244. The
[latest confirmation report](../qa/test-results-confirmation-20261017.md) records
`8713b38d63ccb969dcc69a44a02f888fd65caa9a`, including the desktop layout update
and PR #246. Fresh full component runs passed 610 shared and 619 per native
preset. Confirmation now consumes a successfully read purchase snapshot; its
corrected regression and fallback boundaries have their own evidence. The older
06:33 UTC frontend figures retain their original execution date and source set.
The [QA matrix](../qa/qa-matrix.md) links these results to the QA tasks.

## Recorded behaviour and findings

- **Best matches and a private Career Professional:** `BestMatches` in
  [`src/diagnosis/view.tsx`](../../../frontend/src/diagnosis/view.tsx) reads `profile.expertise.length`
  and `profile.languages.length`. Since PR #237, `GET /counsellors` leaves both out for a partially
  visible or restricted Career Professional, while the app's `CounsellorProfile` type still declares
  them required. One such bookable Career Professional makes the list throw while rendering, on the
  Job Seeker home and the direction step. Both visibility values reproduce
  `S3-PRIVACY-MATCH-CRASH` in the executed advisory suite.
- **Failed save:** the option that failed stays selected, not the stored one that US-27 asks for. Save
  stays enabled, so it can be tried again.
- **Failed load:** the error shows with no Try again, and the options show with none selected. Choosing
  one and saving still sends it.
- **Partially visible is not labelled:** the profile reads as a sparse public one; nothing tells the
  viewer that details are hidden.
- **A Job Seeker's setting has no effect yet:** Job Seekers are offered all three options, but no
  screen shows a Job Seeker's profile to anyone else. Bookings and the Platform Owner's screens name
  them whatever they chose.
- **Executed privacy coverage:** [professional detail tests](../../../frontend/__tests__/screens/professional-detail.test.tsx)
  exercise sparse partial responses, both restricted flags, pending/error states and successful retry.
  [Browser transitions](../../../frontend/e2e/sprint3-completion.spec.ts) use actual API saves and a
  separate public viewer. [The advisory rollback case](../../../frontend/__tests__/defects/sprint3-privacy-acceptance.test.tsx)
  asserts the required stored-choice restoration and retains its actual failure.
