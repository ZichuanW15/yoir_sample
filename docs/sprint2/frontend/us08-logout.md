# US-08 frontend: Log out, clear the stored session and leave the signed-in area

Issue: [#104](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/104),
under [US-08 #11](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/11).

Every role has a **Log out** action in the account sheet. It drops the session on the device straight away,
deletes the stored copy, asks the server to revoke the session in the background, and returns the user to
the public entry screen. Server-side revocation and replay rejection are backend work
([US-06–08 backend doc](../backend/us06-us08-auth-sessions.md)). The screen guards that keep signed-out
users off role screens are listed in [US-06](us06-login-role-navigation.md).

## Screens and flow

The account sheet is `AccountSheet` in [chrome.tsx](../../../frontend/src/chrome.tsx). It opens from the
avatar button labelled `Account, <name>`, which appears in these places:

| Role | Where the avatar is |
|---|---|
| Job Seeker | `TopBar` on `/job-seeker`, `/marketplace` (Explore) and `/bookings` |
| Career Professional | Workspace header on `/counsellor`, and `TopBar` on `/counsellor/profile` and `/bookings` |
| Platform Owner | `AdminShell` top bar on every `/admin` screen ([shell.tsx](../../../frontend/src/admin/shell.tsx)) |

The sheet shows the user's name and role label (Job Seeker, Career Professional or Platform Owner), some
role-specific buttons, and then **Log out**. Tapping outside the sheet (`Close`) dismisses it. Tapping
**Log out**:

1. closes the sheet;
2. calls `logout()` from [AuthContext.tsx](../../../frontend/src/auth/AuthContext.tsx);
3. calls `router.replace('/')`;
4. shows the toast `Logged out`.

With no session, `/` ([index.tsx](../../../frontend/app/index.tsx)) shows the entry screen: the two role
cards, guest browsing and "Already have an account? Log in". There is no confirmation step.

## Behaviour and states

- `logout()` reads the current access and refresh tokens, sets the session to `null`, and calls
  `clearSession()` without waiting for it. That deletes `yoir.session` from `expo-secure-store` on a
  device, or from `localStorage` on the web. If there was an access token, it then calls
  `api.logout(token, refreshToken)` without waiting.
- `api.logout` sends the DELETE with the bearer token and a body naming the refresh token, so the server
  can revoke the whole refresh family. **Any error is swallowed** (`.catch(() => undefined)`). Local
  sign-out never depends on the server. The parent story left the offline case open, and `dev` chooses to
  sign out locally anyway. If the request never arrives, the server-side tokens stay valid until they
  expire, but the device no longer holds them.
- If the access token has already expired when **Log out** is tapped, the DELETE gets a 401. `request()`
  does not refresh `/auth/` paths, so the refresh family is not revoked either. This follows from the code;
  no test covers it.
- **Navigation:** `router.replace('/')` replaces only the current screen. The stack or browser history is
  not cleared (there is no `dismissAll`). Going back relies on each screen's guard: Career Professional
  and admin screens redirect, and the Job Seeker profile, diagnosis and bookings screens send the user to
  login. `/job-seeker` shows its guest version and Explore is public, so neither exposes account data.
- Because `AuthProvider` state is shared, every mounted screen re-renders signed out at the same moment.

Accessibility labels: `Account, <name>`, `Log out`, `Close` (the sheet backdrop). The `Logged out` toast
is plain text with no accessibility role.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.logout(accessToken, refreshToken?)` | `DELETE /auth/sessions/current` | `Authorization: Bearer <accessToken>` and body `{ "refreshToken": <token or null> }`. The server returns `204`. A 401 or a network error is ignored. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| AC1: tapping Log out sends the logout request, removes the token from device secure storage and navigates to the public entry or login screen | **Met.** Local state and the stored copy are cleared first, the DELETE is sent, and the screen is replaced with `/`. | `marketplace.test.tsx` "[QA-106] a signed-in user can open the real account sheet and log out" (`replace('/')`, one DELETE, **Log in** visible); `AuthContext.test.tsx` "logout clears the in-memory session state" and "logging out removes it, so a refresh does not bring it back" (`clearSession` called); `AuthContext.http.test.tsx` "[QA-106] logout drops local identity immediately while server invalidation is pending" (bearer header); `sessionStore.web.test.ts` "clearing removes it, so a refresh does not bring the session back"; Playwright `US06/08 Web login, logout and server-side revoked-token replay` (DELETE returns 204, account button gone). The native SecureStore delete has no test. |
| AC2: after logout, any request with the old token is rejected as unauthenticated | Backend. The browser tests confirm it end to end. | Playwright `US06/08 Web login, logout …` (the old token gets 401 from `/orders/…/payments/stub`); `[QA-106][US08-AC3] …` (the old token gets 401 from `GET /me/services`); `backend/tests/test_logout_sessions.py` |
| AC3: after logout, the device back gesture or button shows no authenticated screen | **Met on the web; partly observed on devices.** | Playwright `[QA-106][US08-AC3] logout prevents browser history and protected deep-link access` (back and forward, plus four `/counsellor` deep links). On 16 September, iOS: a `/--/counsellor` deep link after logout showed the signed-out Home. Android: Back from a signed-out role page returned to Home ([native results](../qa/native-device-results-20260916.md), earlier build). No Jest test covers the native stack. |

Failure handling is also tested: `AuthContext.http.test.tsx` "[QA-106] failed server invalidation does not
restore the local identity" and "[QA-106] logout without a session sends no authenticated request".

## Tests

```bash
# from frontend/
npm test -- __tests__/screens/marketplace.test.tsx __tests__/auth/AuthContext.test.tsx __tests__/auth/AuthContext.http.test.tsx __tests__/auth/sessionStore.web.test.ts
npm run test:web -- -g "US06/08|QA-106"   # needs the web export and backend, see e2e/README.md
```

The Jest suites passed on 18 September 2026 at `dev` `64cb324` (37 tests). The Playwright cases were not
rerun for this document.
[`e2e/native/counsellor-login-logout.yaml`](../../../frontend/e2e/native/counsellor-login-logout.yaml)
covers logout and a post-logout deep link, but it is marked "Authored only" and has never been run.

## Known gaps

- Native case N03 in the [native acceptance plan](../qa/native-acceptance-delta.md): the iOS back gesture
  after logout and the Android protected deep link after logout are "not run". The logout recordings
  listed in the parent issue do not exist.
- QA [#106](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/106) says secure-storage
  removal "cannot be certified against the current in-memory session". That was written before the session
  store existed (`70232ce`). Removal is now tested for the web store only. On a device it is unverified.
- An offline logout, or a logout with an expired access token, does not revoke the session on the server,
  and the user is not told.
- The navigation stack is not reset. Protection after logout depends on every protected screen keeping
  its guard.
