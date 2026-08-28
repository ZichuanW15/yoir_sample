# Yoir Mobile — Executable Architecture Frontend

React Native + Expo + TypeScript frontend for the first Yoir walking skeleton:

```text
public marketplace -> service detail -> login when required -> choose time -> stub payment -> confirmation
```

The app consumes the published S1-02 contract in [`docs/api/openapi.yaml`](docs/api/openapi.yaml). It is designed for Android and iOS and communicates with the deployed FastAPI backend over HTTPS REST/JSON.

Backend contributors should start with [`docs/backend-integration.md`](docs/backend-integration.md). Human-readable control rules and requirement traceability are published under [`docs/architecture`](docs/architecture/interface-contract.md) and [`docs/traceability`](docs/traceability/interface-traceability.csv).

## Run

Prerequisites: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
npm start
```

Set the deployed backend origin in `.env`:

```text
EXPO_PUBLIC_API_URL=https://your-api.example.com/api/v1
```

For UI-only development while the backend is unavailable:

```text
EXPO_PUBLIC_USE_DEMO_API=true
```

Demo mode is visibly labelled in the app and must not be used as evidence that the deployed backend works.

## Quality assurance and CI

- [`docs/sprint1/test-approach.md`](docs/sprint1/test-approach.md) defines the
  executable-architecture test levels, database safeguards, evidence rules and
  clean-clone reproduction procedure.
- [`docs/sprint1/test-results.md`](docs/sprint1/test-results.md) records results
  against exact product and QA commits; Todo, strict XFail, Skip and Not Run are
  reported separately from Pass.
- [`docs/board-insights-automation.md`](docs/board-insights-automation.md)
  documents the credential and operating boundaries for the ProjectV2-to-Wiki
  automation.
- [Application CI](.github/workflows/app-ci.yml) checks the frontend, FastAPI,
  PostgreSQL, live HTTP boundary and repository contracts.
- [Board Insights](.github/workflows/board-insights.yml) tests the generator on
  pull requests and publishes only from explicitly authorised events once the
  workflow is present on the default branch.

The repository currently uses a handwritten typed API client. The target
architecture's generated `openapi-typescript` client remains an explicit
conformance gap; mocked frontend tests do not count as deployed cross-stack
evidence.

## Implemented slice

- Public Marketplace service list (`US-44`, `US-45`)
- Public service detail and counsellor summary (`US-46`)
- Job Seeker/Career Counsellor registration (`US-01`–`US-04`)
- Login with generic safe failure handling (`US-06`, `US-07`)
- Public service browsing with authenticated booking continuation
- Available time selection, persisted order and backend payment stub (`US-40`, `US-41`, `US-47`, `US-68`)
- English payment-success confirmation with booking and payment references
- In-memory bearer session and role-aware signed-in state
- Loading, empty, validation, offline and retry states
- Accessible labels, touch targets and English system copy

## Contract decisions

- The client never chooses an acting user ID; identity comes from the bearer token.
- API errors follow the S1-02 `Error` schema and clients branch on stable `code` values.
- Money uses integer minor units plus ISO currency.
- The current executable slice uses a clearly labelled backend payment stub. It collects no card details and charges no real money while `CLIENT-02` remains unresolved.

## Project structure

```text
app/                 expo-router screens
src/api/             typed API boundary and demo adapter
src/auth/            session provider
src/components/      reusable accessible UI
src/theme.ts         design tokens
```
