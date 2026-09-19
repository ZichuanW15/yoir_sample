# Frontend: navigation, notifications, terminology and branding

Sources: the client's 17 September feedback, recorded as FB05 and FB06 in the
[Sprint 2 review](../client-feedback/sprint-2-review-and-client-feedback.md); the backlog's notification
stories US-60 and US-61, which the client ranked lower priority.

These changes reached `dev` on 18 September 2026. They do not belong to one user story: they reshape the
app's navigation around the Job Seeker, add a notifications dropdown that waits for its backend, apply
the client's wording and bring the look closer to the Yoir logo. FB06 asks for branding changes to be
recorded and reviewed with the Product Owner and client, so the branding here is a proposal, not an
agreed design.

## Screens and flow

### Top bar

[`src/components/TopBar.tsx`](../../../frontend/src/components/TopBar.tsx) sits on Home (`/job-seeker`),
Explore (`/marketplace`), My sessions (`/bookings`) and the Career Professional profile. It shows the Yoir
wordmark and, for a signed-in user, their avatar (their photo when they have one). A Job Seeker also gets
a notifications bell with an unread count ("9+" above nine). A guest sees **Log in** instead.

Tapping the avatar opens the account sheet in [`src/chrome.tsx`](../../../frontend/src/chrome.tsx): the
person's photo or initials, name and role ("Job Seeker", "Career Professional" or "Platform Owner"), then
**Open my workspace** (Career Professionals), **Edit profile** (Job Seekers), **My sessions** (everyone
but the Platform Owner) and **Log out**.

### Bottom navigation

One component, [`src/components/BottomNav.tsx`](../../../frontend/src/components/BottomNav.tsx), draws
every role's bar: a white floating pill with the active tab tinted green.

| Role | Component | Tabs |
|---|---|---|
| Job Seeker (and guests) | [`JobSeekerNav.tsx`](../../../frontend/src/components/JobSeekerNav.tsx) | Home, Explore, Bookings |
| Career Professional | [`CounsellorNav.tsx`](../../../frontend/src/components/CounsellorNav.tsx) | Workspace, Bookings, Profile |
| Platform Owner | [`src/admin/shell.tsx`](../../../frontend/src/admin/shell.tsx) | Overview, Verify, Professionals, Bookings, Payments |

A guest tapping Bookings is sent to log in. Profile and notifications are not tabs: they open from the top
bar, as in most apps.

### Notifications dropdown

The bell opens [`src/components/NotificationsPanel.tsx`](../../../frontend/src/components/NotificationsPanel.tsx),
drawn by the chrome layer above every screen so it overlays content the same way on web, iOS and Android.
Tapping outside closes it. It lists notifications newest first with an unread dot, title, two lines of
body and a relative time ("5m", "3h", "2d", then the date). **Mark all as read** appears when anything is
unread. Tapping a notification marks it read and, if it links somewhere, opens that screen. With none:
"You are all caught up. Booking updates and messages from your Career Professionals will appear here."

## Behaviour and states

- The badge and the dropdown share one store, [`src/notifications.ts`](../../../frontend/src/notifications.ts):
  fetched once per signed-in person and again whenever the dropdown opens.
- A failed fetch leaves the bell quiet; it never takes the screen down.
- Marking read updates the list at once and tells the backend in the background.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listNotifications(token)` | `GET /me/notifications` | **Not built on the backend yet.** A 404, 405 or 501 reads as no notifications, so switching the backend on needs no frontend change. Other failures still surface. |
| `api.markNotificationRead(id, token)` | `PATCH /me/notifications/{id}/read` | Not built yet; failures are ignored. |

The contract the backend should serve, from `AppNotification` in
[`src/api/types.ts`](../../../frontend/src/api/types.ts):

```json
[
  {
    "id": "n1",
    "title": "Booking confirmed",
    "body": "Your session with Maya Chen is on Tuesday at 3 pm.",
    "createdAt": "2026-09-18T05:00:00Z",
    "read": false,
    "href": "/bookings"
  }
]
```

`href` is optional: an app route to open when the notification is tapped.

## Terminology (FB05)

Every user-facing string says **Career Professional** instead of counsellor, and **Explore** instead of
Marketplace: 41 strings in the app, plus the backend's error messages, email subjects and email
templates. Routes (`/counsellor`, `/marketplace`), role values (`counsellor`), API paths and code names
are unchanged, so no link or contract broke. The admin tab reads "Professionals" because the full term
does not fit a five-tab bar.

## Branding and typography (FB06)

Based on the Yoir logo, since the pitch-night reference is not in the repository:

- **Display type:** DM Serif Display, the free typeface closest to the heavy, high-contrast wordmark. It
  replaced Instrument Serif; display sizes run a step smaller because it sets wider
  ([`src/theme.ts`](../../../frontend/src/theme.ts)).
- **Colour:** the logo's green (`#1E3A27`) and gold (`#B07C30`) were already the theme's; the page colour
  is now the logo's cream (`#F4F0E9`).
- **Home:** a green brand panel with gold and cream carries the greeting and the Job Seeker's direction.

## Acceptance criteria

These changes answer client feedback rather than a story's criteria.

| Feedback | Frontend behaviour | Evidence |
|---|---|---|
| FB05: Career Professional, not Career Counsellor, throughout | All user-facing copy and backend messages renamed | Jest, Playwright and Maestro specs updated to the new wording; the Jest and Chromium suites pass in CI |
| FB05: avoid Marketplace in user-facing wording | Explore everywhere | Same |
| FB06: closer to Yoir branding | Logo-derived type, colour and Home panel | Checked in the browser, 18 Sep; awaiting PO and client review |
| US-60/61: in-app notifications (lower priority) | Dropdown ready; backend endpoints pending | `__tests__/api/client.test.ts`: "notifications read as none until the backend serves them; other failures still surface", "a notification is marked read by its URL-encoded id" |

## Tests

- [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts): the two notification
  tests above.
- The screen tests' router mocks provide `usePathname`, which the bottom bars need
  ([`__tests__/public-screen-utils.tsx`](../../../frontend/__tests__/public-screen-utils.tsx),
  [`__tests__/screens/counsellor-screen-utils.tsx`](../../../frontend/__tests__/screens/counsellor-screen-utils.tsx)).

## Known gaps

- The notifications backend (`GET /me/notifications`, `PATCH /me/notifications/{id}/read`) does not exist,
  so the dropdown is always empty. Until it does, the browser console logs a 404 for the fetch.
- The branding is not yet reviewed against the pitch-night reference.
- The documentation outside `docs/sprint2/frontend/` still says "counsellor" in many places.
