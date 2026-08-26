# Yoir Mobile — Executable Architecture Frontend

React Native + Expo + TypeScript frontend for the first Yoir walking skeleton:

```text
register -> login -> browse marketplace -> service detail
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

## Implemented slice

- Public Marketplace service list (`US-44`, `US-45`)
- Public service detail and counsellor summary (`US-46`)
- Job Seeker/Career Counsellor registration (`US-01`–`US-04`)
- Login with generic safe failure handling (`US-06`, `US-07`)
- In-memory bearer session and role-aware signed-in state
- Loading, empty, validation, offline and retry states
- Accessible labels, touch targets and English system copy

## Contract decisions

- The client never chooses an acting user ID; identity comes from the bearer token.
- API errors follow the S1-02 `Error` schema and clients branch on stable `code` values.
- Money uses integer minor units plus ISO currency.
- Stripe PaymentSheet and booking flows are follow-on slices and are not represented as implemented here.

## Project structure

```text
app/                 expo-router screens
src/api/             typed API boundary and demo adapter
src/auth/            session provider
src/components/      reusable accessible UI
src/theme.ts         design tokens
```
