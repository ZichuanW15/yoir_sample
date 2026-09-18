# Archived requirement probes

These files preserve earlier Sprint 2 requirement investigations. They are
**outside the current implemented-feature QA submission** and must not be
included in its pass/fail totals or treated as regressions in delivered code.

The current application implements local catalogue filters, form-wide validation
messages, a chronological availability list and an in-memory session. These probes
ask for additional behaviour that this revision does not implement. Moving them
here changes the evaluation scope; it does not implement or resolve the backlog.

| File | Cases | Archived expectation |
| --- | ---: | --- |
| `admin-landing.test.tsx` | 1 | Separate Platform Owner landing area |
| `auth-issue-acceptance.test.tsx` | 11 | Client-side email-format rejection and field-associated validation; includes 3 assertion-helper controls |
| `auth-policy.test.tsx` | 2 | Undecided local session expiry and restart persistence policy |
| `counsellor-discovery.test.tsx` | 2 | Public counsellor-list and counsellor-detail entries |
| `counsellor-features.test.tsx` | 4 | Qualifications/languages, combined default modality and weekly view |
| `counsellor-validation-ux.test.tsx` | 6 | Simultaneous/field-level validation, required labels and visible timezone label |
| `public-search-and-selection.test.tsx` | 5 | UI sends every search/filter change to the server; booking requires a fresh explicit modality choice |

Total: **31 archived cases**, comprising 28 feature/UX/policy probes and 3 helper
controls. They were not run as part of the current implemented-feature QA pass.

Current regression tests still exercise actual registration validation, local
filters/sorting, API query serialization, profile/edit component boundaries and
existing booking controls. Current correctness defects, including price sign
changes, false confirmation and false profile-save success, remain ordinary
failing assertions in `../defects/`.

Before promoting an archived case, confirm the feature has shipped and review
its fixtures against the real endpoint, accepted UX and runtime contract. A
mocked response for a missing endpoint is never backend persistence evidence.
