# US-09–13 delivery: Yoir Diagnosis, direction and matching

This document is the combined Sprint 3 delivery record for the Yoir Diagnosis journey. It connects
the five parent user stories to their frontend, backend and test evidence without duplicating the
layer-specific documentation.

- Frontend detail: [US-09–13 frontend delivery](frontend/us09-us13-yoir-diagnosis.md)
- Backend detail: [US-09–11 private progress API](backend/us09-us11-diagnosis.md)
- Visual evidence: [Sprint 3 feature walkthrough](walkthrough/sprint-3-feature-walkthrough.md),
  screens 11–21

## Scope and traceability

| Story | User outcome | Frontend task | Backend task | QA task |
|---|---|---|---|---|
| [US-09 #81](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/81) | Start or resume the Yoir Diagnosis after signing in | [#160](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/160) | [#161](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/161) | [#162](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/162) |
| [US-10 #78](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/78) | Complete the ordered six-step journey | [#163](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/163) | [#164](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/164) | [#165](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/165) |
| [US-11 #80](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/80) | Save progress, go back safely and continue later | [#166](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/166) | [#167](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/167) | [#168](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/168) |
| [US-12 #79](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/79) | Receive a Yoir Direction derived from confirmed answers | [#169](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/169) | [#170](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/170) | [#171](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/171) |
| [US-13 #76](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/76) | Continue to relevant Career Professionals and services | [#172](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/172) | [#173](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/173) | [#174](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/174) |

## Delivered journey

```text
sign in
  -> start or resume a private diagnosis
  -> answer five ordered questions
  -> save confirmed progress against the Job Seeker account
  -> receive step 6: Your Yoir Direction
  -> translate the direction into supported Explore criteria
  -> view relevant Career Professionals and services
  -> continue into the existing booking journey
```

The first five steps collect answers. Step 6 is the result and does not collect another answer. The
backend owns the versioned questionnaire and direction rules so the same confirmed answers do not
produce different results on different devices.

## Delivered behaviour

- The diagnosis is available only to an authenticated Job Seeker. Each account can read and update
  only its own diagnosis record.
- A first-time answer is saved before the interface advances. A returning Job Seeker resumes from
  the first unfinished step and sees previously confirmed answers.
- Required single-choice questions cannot be left blank. Multi-choice questions can be deliberately
  answered with an empty selection. Supported `Other` answers can include up to 200 characters.
- Saves use an expected revision and an atomic compare-and-swap update. If two clients edit the same
  diagnosis, the stale client receives a conflict instead of silently replacing newer answers.
- A direction is returned only after all five inputs are complete. It contains the main area,
  explanation, suggested next steps and weighted matching terms.
- The matching handoff uses the strongest supported term as the Explore search query. Additional
  signals are returned as related topics rather than being falsely presented as applied filters.
- A retake is kept as a local draft until its final question is submitted. Leaving or skipping an
  unfinished retake therefore preserves the last confirmed direction.
- Explore keeps the direction visible, marks only services returned by the matching query as fitting
  the direction, and handles the no-match case without hiding the result.

## API and implementation map

All routes below use the `/api/v1` prefix. Diagnosis routes require Job Seeker authentication;
discovery routes return only public, visibility-safe professional and service data.

| Operation | Purpose |
|---|---|
| `GET /me/diagnosis/questionnaire` | Load the supported versioned five-question flow and step-six descriptor |
| `POST /me/diagnosis` | Create once or resume the signed-in Job Seeker's record |
| `GET /me/diagnosis` | Retrieve the signed-in Job Seeker's saved progress |
| `PUT /diagnoses/{diagnosisId}/steps/{stepId}` | Validate and atomically confirm one ordered answer |
| `GET /diagnoses/{diagnosisId}/direction` | Derive a direction from one complete confirmed revision |
| `GET /diagnoses/{diagnosisId}/marketplace-criteria` | Convert the direction into criteria supported by Explore |
| `GET /counsellors`, `GET /services` | Return public Career Professionals and services matching those criteria |

Key implementation locations:

- [`frontend/app/job-seeker/diagnosis.tsx`](../../frontend/app/job-seeker/diagnosis.tsx): diagnosis
  route and navigation into the result.
- [`frontend/src/diagnosis/view.tsx`](../../frontend/src/diagnosis/view.tsx): state, validation,
  server-backed resume, direction card and matching presentation.
- [`frontend/app/marketplace/index.tsx`](../../frontend/app/marketplace/index.tsx): Explore handoff,
  matching order and fit labels.
- [`frontend/src/api/client.ts`](../../frontend/src/api/client.ts): typed diagnosis and discovery API
  calls.
- [`backend/app/routers/diagnosis.py`](../../backend/app/routers/diagnosis.py): private diagnosis,
  progress, direction and marketplace-criteria endpoints.
- [`backend/app/diagnosis.py`](../../backend/app/diagnosis.py): questionnaire validation,
  deterministic direction rules and keyword-weight matching.
- [`backend/app/routers/services.py`](../../backend/app/routers/services.py): public professional and
  service discovery.
- [`backend/migrations/versions/0009_diagnosis_progress.py`](../../backend/migrations/versions/0009_diagnosis_progress.py):
  persistent diagnosis records and account ownership constraint.
- [`docs/sprint1/executable-architecture/openapi.yaml`](../sprint1/executable-architecture/openapi.yaml):
  published API contract and requirement identifiers.

## Acceptance evidence by story

| Story | Evidence in the delivered system |
|---|---|
| US-09 | New Job Seekers enter the diagnosis after login; existing records resume without being reset; authentication, role and ownership are enforced by the API. |
| US-10 | The interface renders five questions followed by the direction, saves inputs in order and advances only after the server confirms each first-time save. |
| US-11 | Saved answers and current progress survive closing the app; Back preserves answers; validation and stale-revision errors do not discard the last confirmed record. |
| US-12 | The backend rejects incomplete records and deterministically derives the direction from the completed answers and source revision; the frontend displays that server result rather than calculating a separate result. |
| US-13 | The backend translates the confirmed direction into supported discovery criteria; the frontend applies those criteria to Best Matches and Explore while preserving the result on return and handling no matches honestly. |

## Verification

Backend coverage:

- [`backend/tests/test_diagnosis.py`](../../backend/tests/test_diagnosis.py): start/resume, privacy,
  ordered saves, validation and revision conflicts.
- [`backend/tests/test_diagnosis_direction.py`](../../backend/tests/test_diagnosis_direction.py):
  completion guard and deterministic direction results.
- [`backend/tests/test_diagnosis_marketplace_criteria.py`](../../backend/tests/test_diagnosis_marketplace_criteria.py):
  translation from direction signals to supported Explore criteria.
- [`backend/tests/test_diagnosis_contract.py`](../../backend/tests/test_diagnosis_contract.py): runtime
  and published-contract alignment.
- [`backend/tests/test_diagnosis_migration.py`](../../backend/tests/test_diagnosis_migration.py):
  migration and persistence behaviour.

Frontend coverage:

- [`frontend/__tests__/screens/diagnosis.test.tsx`](../../frontend/__tests__/screens/diagnosis.test.tsx):
  creation, resume, confirmed progress, results, matching handoff and safe retakes.
- [`frontend/__tests__/api/diagnosis-client.test.ts`](../../frontend/__tests__/api/diagnosis-client.test.ts):
  authenticated request and response boundary.
- [`frontend/e2e/web.spec.ts`](../../frontend/e2e/web.spec.ts): login-to-diagnosis journey in the web
  application.

## Known limits

- The current version uses one universal five-question route. The client's wider workbook of
  conditional topic-bank questions is not yet imported, so situation-specific branching remains
  future work.
- Direction and matching are deterministic rules, not AI or machine learning. Matching uses the
  highest-weighted supported keyword as a search query; it does not claim that every internal signal
  is an available Marketplace filter.
- Diagnosis ends by handing the Job Seeker into the existing Explore and booking journey. Payment,
  refund and payout behaviour is documented separately and is not part of US-09–13.
