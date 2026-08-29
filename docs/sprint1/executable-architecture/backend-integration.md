# Backend integration — first walking skeleton

## Scope

The frontend currently implements:

```text
public marketplace -> service detail -> login when required -> choose time -> stub payment -> confirmation
```

The backend needs to implement these operations first:

| operationId | Endpoint | Requirements |
|---|---|---|
| `register` | `POST /api/v1/auth/users` | `US-01`–`US-04` |
| `login` | `POST /api/v1/auth/sessions` | `US-06`, `US-07` |
| `listServices` | `GET /api/v1/services` | `US-44`, `US-45` |
| `getService` | `GET /api/v1/services/{serviceId}` | `US-46` |
| `listServiceSlots` | `GET /api/v1/services/{serviceId}/slots` | `US-40` |
| `createOrder` | `POST /api/v1/orders` | `US-41`, `US-47` |
| `completeStubPayment` | `POST /api/v1/orders/{orderId}/payments/stub` | `US-47`, `US-68` |

The source of truth for paths, fields, enums, responses and errors is [`openapi.yaml`](openapi.yaml). Coordinate a contract change before changing an endpoint or schema.

## Integration expectations

- Serve HTTPS REST/JSON from FastAPI under `/api/v1`.
- Use the OpenAPI camelCase fields, including `accessToken`, `expiresAt`, `priceMinor`, `averageRating` and `reviewCount`.
- Return the published `Error` shape for non-2xx responses.
- Hash passwords with Argon2 and issue JWT bearer sessions; never return password data.
- Allow the Expo development/deployment origins through a narrowly configured CORS policy.
- Seed at least one active counsellor and service so the public journey is demonstrable.
- Persist users and services in PostgreSQL; demo-only in-memory results are not integration evidence.

## Connect the frontend

In `frontend/`, create `.env` from `.env.example`, then set:

```env
EXPO_PUBLIC_API_URL=https://DEPLOYED_BACKEND/api/v1
EXPO_PUBLIC_USE_DEMO_API=false
```

Restart Expo after changing `.env`.

## Shared verification

1. Register a new Job Seeker and reject a duplicate email safely.
2. Log in successfully; use the same generic error for unknown email and wrong password.
3. Load Marketplace data from PostgreSQL.
4. Search services and open a service detail response from the API.
5. Repeat the flow on Android and iOS against the deployed backend.

The current payment boundary is an explicit backend stub: it accepts no card data and charges no real money. Stripe remains a conditional future adapter pending `CLIENT-02`. Messaging and reviews remain later slices.
