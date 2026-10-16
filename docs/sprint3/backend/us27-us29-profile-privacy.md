# US-27, US-28 and US-29 backend: profile visibility, its enforcement, and the Job Seeker profile

Issues: back-end sub-issues [#182](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/182),
[#185](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/185) and
[#188](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/188), under
[US-27 #22](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/22),
[US-28 #23](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/23) and
[US-29 #82](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/82).

This slice lets a Job Seeker or Career Professional choose how much of their profile other people
can see, and makes the backend, not the app, decide what is sent. It also tightens the Job Seeker's
own profile routes. The visibility setting and a first, empty-string version of the filtering reached
`dev` on 7 October 2026 in [PR #234](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/234).
The enforcement described here reached `dev` on 16 October 2026 in
[PR #237](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/237), implemented by
Jared040514; its review found that a restricted Career Professional's introduction still reached the
Marketplace through the service listings, and commit `94987e3` closed that before merge.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 22, 23,
24 and 25.

## Endpoints and flow

| Endpoint | Code | What it does |
|---|---|---|
| `GET /me/profile-visibility` | [`app/routers/profile.py`](../../../backend/app/routers/profile.py) | The caller's own setting; `public` if never set. |
| `PATCH /me/profile-visibility` | same | Saves `public`, `partial` or `restricted` for the caller only. |
| `GET /counsellors`, `GET /counsellors/{counsellorId}` | `list_counsellors`, `get_counsellor_profile` in [`app/routers/services.py`](../../../backend/app/routers/services.py) | Other people's view of a Career Professional, filtered by that person's setting. |
| `GET /services`, `GET /services/{serviceId}` | `service_to_out` in `app/routers/services.py` | The summary of the Career Professional on each listing; a restricted introduction is withheld. |
| `GET /me/counsellor-profile` | `get_own_counsellor_profile` in [`app/routers/counsellor.py`](../../../backend/app/routers/counsellor.py) | The owner's own view: always complete. |
| `GET` / `PATCH /me/job-seeker-profile` | [`app/routers/job_seeker.py`](../../../backend/app/routers/job_seeker.py) | US-29: the Job Seeker's own name, photo, headline and career goals. |

## Behaviour and states

- **Who has a setting:** `require_profile_owner` allows Job Seekers and Career Professionals; a
  Platform Owner is `403`, because an administration account has no public profile.
- **Saving:** the body accepts `visibility` only. Any other value, a missing value or an extra field
  such as `userId` is `400 VALIDATION_ERROR`, and the stored setting is unchanged. There is no account
  ID in the path, so one user cannot change another's setting.
- **What other people receive** (`counsellor_profile_out(..., enforce_visibility=True)`):

| Setting | Fields returned to other users |
|---|---|
| `public` | Everything: photo, LinkedIn URL, introduction, background, experience, qualifications, expertise, languages, base location, default modality, verification status and ratings. |
| `partial` | ID, display name, introduction, default modality, verification status, overall rating, review count. |
| `restricted` | ID, display name, verification status, overall rating, review count, and `restricted: true`. |

- **Absent, not empty:** hidden fields are left out of the JSON (`response_model_exclude_unset`), not
  sent as `""` or `[]` for the app to interpret. This replaced PR #234's empty-string version.
- **Service listings:** `service_to_out` withholds a restricted Career Professional's introduction by
  default (`"introduction": null`). `own_service_to_out` opts out, so the owner's My Services still
  shows it.
- **Owner exception:** `GET /me/counsellor-profile` never applies the filter.
- **A change applies on the next read:** nothing is cached, and every privacy-sensitive response is
  `Cache-Control: private, no-store`.
- **Failed writes:** a failed commit rolls back and returns `500 INTERNAL_ERROR` without the database
  error text; the previous setting or profile stays in place.
- **US-29, the Job Seeker profile:** `require_job_seeker` on both routes. The body is the whole form
  (`name`, `photoUrl`, `headline`, `careerGoals`); `photoUrl` must be an inline JPEG, PNG or WebP data
  URI or `null`. Unknown fields such as a `userId` are rejected.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getPrivacySettings` | `GET /me/profile-visibility` | Pre-selects the stored option. |
| `api.updateProfileVisibility(visibility)` | `PATCH /me/profile-visibility` | Body `{visibility}`; the app shows success only on `200`. |
| `api.listCounsellors`, `api.getCounsellorProfile` | `GET /counsellors`, `GET /counsellors/{counsellorId}` | Render what is present; a `restricted: true` profile shows the restricted state. |
| `api.getOwnCounsellorProfile` | `GET /me/counsellor-profile` | Always the full profile. |
| `api.getJobSeekerProfile`, `api.updateJobSeekerProfile` | `GET` / `PATCH /me/job-seeker-profile` | US-29. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| US-27: saved option persists and is returned | Stored on the user; returned by `GET` | `test_career_professional_can_save_and_read_privacy`, `test_job_seeker_can_save_and_read_privacy` |
| US-27: a stored Restricted is returned, not a default | `GET` reads the stored value | `test_career_professional_can_save_and_read_privacy` |
| US-27: a failed update keeps the previous option | Rollback | `test_failed_visibility_commit_keeps_the_previous_setting` |
| US-27: no session or an invalid value is rejected, setting unchanged | `401`; `400` | Invalid value: `test_invalid_visibility_is_rejected_without_changing_the_saved_value` (4 cases). No session: enforced by `get_current_user`, not covered by a test here |
| US-27: another user's account cannot be changed | `/me` only; extra fields refused | `test_visibility_route_cannot_target_another_account` |
| US-28: Public returns every public field | Full profile | `test_visibility_change_removes_previously_public_fields_on_the_next_read` (public read before the change) |
| US-28: Partial returns only partial fields, others absent | Partial branch | `test_partial_profile_keeps_summary_but_hides_personal_details` |
| US-28: Restricted returns none of the restricted fields | Restricted branch, on profile, list and service listings | `test_restricted_career_professional_profile_does_not_leak_details`, `test_counsellor_list_applies_the_same_restricted_filter`, `test_restricted_introduction_is_hidden_from_public_service_list_and_detail` |
| US-28: the owner always sees their full profile | No filter on `/me` | `test_owner_still_receives_the_complete_profile_when_restricted`, `test_restricted_owner_still_sees_introduction_on_owned_services` |
| US-28: a change applies with nothing carried over | Read fresh; `no-store` | `test_visibility_change_removes_previously_public_fields_on_the_next_read` |
| US-29: the Job Seeker reads and saves their own profile | `GET` / `PATCH` | `test_job_seeker_saves_profile_and_photo` |
| US-29: invalid data or failure claims no success | `400`, or rollback | `test_profile_photo_must_be_an_inline_raster_image`, `test_invalid_profile_update_does_not_change_the_stored_profile`, `test_failed_profile_commit_keeps_the_previous_profile` |
| US-29: another user or role is refused | `require_job_seeker`; `/me` only | `test_only_a_job_seeker_has_a_job_seeker_profile`, `test_job_seeker_profile_route_cannot_target_another_account` |

## Tests

- [`tests/test_profile_visibility.py`](../../../backend/tests/test_profile_visibility.py): 16 tests
  (13 functions; the invalid-value test runs 4 cases).
- [`tests/test_job_seeker_profile.py`](../../../backend/tests/test_job_seeker_profile.py): 10 tests
  (6 functions, some parametrised).

Run from `backend/`:

```bash
env -u DATABASE_URL pytest tests/test_profile_visibility.py tests/test_job_seeker_profile.py -q
```

Local run on `dev` at `03978fd`, 16 October 2026, Python 3.12.8, temporary SQLite database: 26 passed.

## Known gaps

- No endpoint shows a Job Seeker's profile to anyone else, so a Job Seeker's setting is stored and
  returned but has nothing to filter yet. Booking and Platform Owner views name the Job Seeker
  regardless of the setting.
- The two filtered shapes differ slightly: a hidden field is absent on `/counsellors`, but a withheld
  introduction on a service listing is sent as `null`.
- Which fields belong at `partial` is the team's reading of the Privacy screen; it is not recorded as
  a client decision.
