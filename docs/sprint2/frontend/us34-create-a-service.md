# US-34 frontend: My services and creating a service

Issue: [#131](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/131),
under [US-34 #29](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/29).

This slice gives a Career Professional a workspace that lists their own services and a
**New service** form that publishes one through the backend. The service fields and their rules are
covered in [US-35](us35-describe-and-price-a-service.md). Delivery mode is covered in
[US-37](us37-service-delivery-modality.md) and the in-person area in [US-38](us38-in-person-meeting-area.md).
Editing and deleting a service (US-36) reuse the same form and are mentioned here only where they appear
on the workspace. Availability is covered in [US-39](us39-availability.md); payouts (US-47) are documented separately.

## Screens and flow

- **`/counsellor` (workspace):** [index.tsx](../../../frontend/app/counsellor/index.tsx). A Career Professional
  lands here after login (`homeFor` in [navigation.ts](../../../frontend/src/navigation.ts)). They can
  also reach it through the account sheet's "Open my workspace" button
  ([chrome.tsx](../../../frontend/src/chrome.tsx)) and the **Workspace** tab of
  [CounsellorNav.tsx](../../../frontend/src/components/CounsellorNav.tsx). The tabs are
  Workspace / Bookings / Profile, added in `0dd0d24`. Workspace is highlighted only on `/counsellor` itself.
- **Workspace contents, top to bottom:**
  - the wordmark and the account button (`Account, <name>`);
  - the greeting "Your workspace" / "Good to see you, <first name>" and the error banner;
  - the verification card;
  - the payouts prompt, which appears when payouts are not enabled: "Set up payouts" or "Finish payout setup",
    with "Your services stay hidden from Explore until Stripe can pay you.";
  - "Confirm your email to publish a service"
    ([VerifyEmailBanner.tsx](../../../frontend/src/components/VerifyEmailBanner.tsx)), for an unconfirmed email;
  - the "My sessions", "Professional profile" ([US-30](us30-professional-profile.md)) and
    "Payouts" (when enabled) cards;
  - the **My services** section, then the **Availability** card, then the bottom navigation.
- **My services** has the heading "`n` published" or "No services yet" and a **New** button. Each
  service card shows:
  - the title, the price (`money()`) and a two-line description;
  - one tag per delivery mode and a `City, STATE` tag when an area is set;
  - an "`n` available" tag;
  - **Edit** and **Delete** buttons.

  When the load has succeeded and there are no services, a dashed "Publish your first service" card appears.
- **`/counsellor/services/new`:** [new.tsx](../../../frontend/app/counsellor/services/new.tsx) renders
  [ServiceForm.tsx](../../../frontend/src/counsellor/ServiceForm.tsx) with no service. It has a Back button
  (`goBack('/counsellor')`), the title "New service", the heading "What are you offering?" and a
  **Publish service** footer button. On success it runs `router.replace('/counsellor')` and flashes "Service
  published". This screen has no bottom navigation.

## Behaviour and states

- **Role guard:** the workspace, new-service and edit routes all render `<Redirect href="/" />` without a
  `counsellor` session. `CounsellorNav` returns `null` for any other role.
- **Workspace load:** each focus runs a `Promise.all` of the profile, `GET /me/services` and the availability windows.
  - The payout-status call is caught separately, so a failure there hides only the payout cards.
  - Any other failure shows the message in the banner. No service cards or empty-state card are rendered.
  - There is no spinner. Until data arrives, and after a failed load, the heading reads "No services yet".
- **Services shown:** only services with `active: true`. `GET /me/services` also returns withdrawn
  services, per the code comment and the backend docstring.
- **The "`n` available" tag** counts every availability window the backend returns. The count is the same on every card,
  because availability belongs to the Career Professional, not the service. The backend list is not filtered by date.
- **Publishing:**
  - While the request is pending, the button is busy and disabled, so a second tap sends nothing.
  - The app navigates away only after `createService` resolves.
  - On failure the banner shows the API `message` (or the network message). The form keeps every value, and
    **Publish service** is enabled again for a retry.
- **Eligibility:** `POST /me/services` uses `require_publishing_counsellor`, which requires a `verified`
  Career Professional and a confirmed email.
  - The frontend does not check either condition in advance; it shows the backend's 403 message.
  - The two possible messages are "Your Career Professional account must be verified before you can create a
    service." and "Confirm your email address to continue. Check your inbox for the link."
  - The verification card and the email banner are advance prompts only.
- **Payouts:** payouts do not block publishing. When payments are enabled, the public `GET /services` lists only
  services whose Career Professional has payouts enabled and a Stripe account (`_bookable` in
  [services.py](../../../backend/app/routers/services.py)).
- **Delete from a card:** a confirmation reads "Delete this service?" with the message "It will no longer appear in Explore or
  in your own list. Bookings already made against it are not affected." and the button "Delete". The workspace calls `DELETE`
  and then reloads. If the call fails, the error appears in the banner and the card stays visible.
- **Labels tests rely on:** "New", "Publish your first service", `Edit <title>`, `Delete <title>`,
  "Professional profile", "Availability", "Sessions you are delivering", "Set up payouts",
  "Payouts and tax details", "Publish service", "Back".

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listOwnServices(id, token)` | `GET /me/services` | Workspace list; also used by the edit route to find a service by id |
| `api.createService(id, draft, token)` | `POST /me/services` | Returns `201` with the owned service. The id argument is not sent; the backend records the caller as owner |
| `api.getOwnCounsellorProfile(user, token)` | `GET /counsellors/{id}` | Verification card and profile completion |
| `api.listOwnAvailabilityWindows(id, token)` | `GET /me/availability-windows` | Availability card and the "available" tag |
| `api.getPayoutStatus(token)` | `GET /me/payout-status` | Failure is tolerated (`.catch(() => null)`) |
| `api.deleteService(serviceId, token)` | `DELETE /me/services/{id}` | Soft delete (US-36) |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| My Services shows only the Career Professional's own services (or an empty state) with a create action | Lists the active services from `GET /me/services`; shows the empty-state card and the **New** button | `counsellor-dashboard.test.tsx`: "loads the signed-in counsellor services, profile completion and availability window counts", "shows the first-service entry and missing LinkedIn guidance for an empty pending profile". Backend: `test_owner_lists_never_include_another_counsellors_services_or_calendar` |
| A new service appears only after a successful create response | Navigates and flashes only after `createService` resolves; the workspace then re-reads the list | `ServiceForm.test.tsx`: "creates a trimmed online service and announces success only after the API confirms". `counsellor-edit-service.test.tsx`: "new route submits through the real form with the authenticated owner and token". `web.spec.ts`: "US34/35/37/38 counsellor Web publishing validates area and persists both delivery modes" |
| Rejected or unreachable backend: error shown, service not shown as created | Banner, values kept, no navigation | "preserves form values and permits retry after a server rejection". `web.spec.ts`: "US34 counsellor publishing preserves the draft after a transport failure and retries once @injected-network". `integrity.spec.ts`: "CURRENT-IMPLEMENTATION: newly registered counsellor receives publish 403 with no saved or falsely successful service". Dashboard: "renders API load failure without fabricating a published service" |
| Job Seeker: backend rejects creation, and the app offers no My Services or create action | Redirect on every Career Professional route; no Career Professional tab bar | "hides the workspace from anonymous or job-seeker users (%j)", "does not expose a service form to a Job Seeker". Backend: `test_every_counsellor_operation_rejects_anonymous_and_wrong_roles` |
| After closing and reopening, the service is still listed | The workspace always reads from the API on focus; nothing is cached locally | `web.spec.ts` US34/35/37/38 logs in again in a new browser context and sees the title. Native reopen (N06) **not run** |

## Tests

- [counsellor-dashboard.test.tsx](../../../frontend/__tests__/screens/counsellor-dashboard.test.tsx) (7 cases)
- [counsellor-edit-service.test.tsx](../../../frontend/__tests__/screens/counsellor-edit-service.test.tsx) (6 cases)
- [ServiceForm.test.tsx](../../../frontend/__tests__/counsellor/ServiceForm.test.tsx) (15 cases, shared with US-35/37/38)
- [counsellor-client.test.ts](../../../frontend/__tests__/api/counsellor-client.test.ts): "listOwnServices reads
  the counsellor-scoped service collection", "createService POSTs the service draft"
- [web.spec.ts](../../../frontend/e2e/web.spec.ts) and [integrity.spec.ts](../../../frontend/e2e/integrity.spec.ts)
  (Chromium against a real local API)

From `frontend/`:

```bash
npm test -- __tests__/screens/counsellor-dashboard.test.tsx __tests__/screens/counsellor-edit-service.test.tsx __tests__/counsellor/ServiceForm.test.tsx
npm run test:web -- -g "US34"   # after the setup in docs/sprint2/qa/reproduction.md
```

The Jest files passed locally on `dev` at `64cb324` on 18 September 2026. Browser results are those
reported in [dev-sync-review-20260918.md](../qa/dev-sync-review-20260918.md) (15 Chromium passes); they were not rerun
for this document.

## Known gaps

- **Publishing eligibility:** it is enforced as verified-only by the backend. The parent story leaves the
  policy for pending accounts to the Product Owner, and QA #133 records it as undecided.
- **Loading states:** there is no loading indicator, and "No services yet" shows while loading and after a failed load.
- **Price display:** `money()` rounds prices to whole dollars (defect F01, "F01 / QA #115 #124: displayed AUD prices
  preserve the charged cents", which still fails).
- **"`n` available" tag:** it counts all windows, including past ones, and is identical on every service.
- **Device evidence:** native N06 (service creation) is not run on either platform. Only an existing two-service workspace was
  read on iOS and Android ([qa-matrix.md](../qa/qa-matrix.md)).
- **Navigation tests:** no test covers `CounsellorNav`.
