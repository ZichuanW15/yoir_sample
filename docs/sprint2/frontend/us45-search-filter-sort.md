# US-45 frontend: search, filter and sort on Explore

Issue: [#110](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/110),
under [US-45 #42](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/42).

This slice adds a keyword search box, a filter panel and a sort control to Explore.
Signed-in and guest users get the same controls. All three work **on the client**,
over the catalogue that [US-44](us44-browse-explore.md) has already loaded. Changing
a control sends no request. The parent story asks for backend query parameters, so
most of its criteria are not met (see Known gaps). The Explore list, its loading and
error states, and the card layout are described in [US-44](us44-browse-explore.md).

## Screens and flow

All controls live on `/marketplace`
([marketplace/index.tsx](../../../frontend/app/marketplace/index.tsx)). The filtering
and sorting rules are in [filters.ts](../../../frontend/src/marketplace/filters.ts).

- **Search.** A text field labelled "Search services or Career Professionals", with
  the placeholder "Search services or people". Typing narrows the list at once. The
  field matches, case-insensitively, the trimmed query against
  `"{title} {counsellor display name}"`.
- **Filter button.** A round button beside the search field toggles the filter
  panel. When closed, its accessibility label is "Show filters", or "Show filters,
  {n} applied" when filters are applied. When open, it is "Hide filters". It also
  reports `accessibilityState.expanded`. A yellow badge shows the number of
  narrowing filters applied; sort order is not counted.
- **Filter panel.** Each option is a `Chip` with `accessibilityRole="radio"` and
  `selected`/`checked` state:
  - Delivery: "Any", "Online", "In person". A service offering both modes matches either.
  - Location: "Anywhere", plus one chip per state found among the current search
    results. The group is hidden when no result has a `location`.
  - Price: "Any price", "Under $75", "Under $120", "Under $200". These are maximum
    prices of 7500, 12000 and 20000 minor units.
  - Rating: "Any rating", "4.0+", "4.5+". An unrated service counts as 0, so any rating filter excludes it.
  - Sort by: "Recommended", "Price: low to high", "Price: high to low", "Highest rated".
  - A "Clear filters" button, which resets every filter and also clears the search text.
- **Result row.** "{shown} of {total} services", beside the label of the active sort.

"Recommended" ranks verified Career Professionals first, then by average rating,
then by review count (capped at 9). This is `rank()` in `filters.ts`. "Highest rated"
places unrated services last.

## Behaviour and states

- Filters apply after search: `applyServiceFilters(searched, filters)`. The combined
  result is then sorted.
- **No match.** The screen shows "No services match your search." and "Try a
  different keyword, or widen the filters you have applied.", with a second "Clear
  filters" button. The search text and the selected chips stay as they were, and no
  error is shown.
- **Visible criteria.** The search text stays in the field. The filter chips show
  their selected state only while the panel is open. When it is closed, the applied
  filters are shown only as the badge count and the sort label in the result row.
- **Errors.** Search, filter and sort make no network requests, so they cannot fail
  on their own. The only request is the initial catalogue load, whose error and
  retry behaviour is described in [US-44](us44-browse-explore.md).

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listServices()` | `GET /services` | Called once per load with no parameters. |
| `api.listServices(query)` (not used by Explore) | `GET /services?query=…` | The client trims and URL-encodes the query. No screen passes one on `dev`. |

The backend's `GET /services` accepts only `query` and `modality`
([services.py](../../../backend/app/routers/services.py)). It has no parameters for
category, price, rating, state, city or region, spoken language, or sort. The
frontend `listServices` has no `modality` argument.

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| A keyword search requests the listing endpoint with that keyword and shows only what it returns | Not met. The keyword filters the loaded list on the client and sends no request. | `marketplace.test.tsx` "[QA-112 implemented local UI] local search and clearing render correctly" (local behaviour); planned `public-search-and-selection.test.tsx` "[QA-112][US45-AC1] keyword is sent to the backend and only its response is displayed" fails. |
| Category, price, location (state and city/region), language and modality filters return the backend's result, and applied filters stay visibly selected | Partly met, and only on the client. Delivery, state, maximum price and minimum rating filters exist. There is no category, city/region or spoken-language filter. Selected chips are visible while the panel is open. | `marketplace.test.tsx` "[QA-112 implemented local UI] local filter controls narrow cards"; `filters.test.ts` (10 cases); planned "[QA-112][US45-AC2] supported modality filter is sent to the backend" fails. |
| Each sort shows exactly the backend's order | Not met. Sorting is done on the client. | `marketplace.test.tsx` "[QA-112 implemented local UI] local price sort changes card order"; `filters.test.ts` "sorts by price in both directions", "sorts by rating with unrated services last". |
| Every control maps to a documented backend parameter | Not met. Price, rating, state and sort have no backend parameter. The two parameters the backend supports (`query`, `modality`) are not sent. | Code comparison of the Explore screen with [services.py](../../../backend/app/routers/services.py). QA #112 records this criterion as excluded. |
| An empty result shows an empty state with criteria still applied and no error | Met for local results. Not tested against an empty backend response, because none is requested. | `marketplace.test.tsx` "[QA-112 implemented local UI] local search and clearing render correctly"; `web.spec.ts` "US45 implemented Web keyword search shows matching results and a recoverable empty state"; planned "[QA-112][US45-AC5] server-confirmed empty search retains criteria without an error" fails. |
| A failed search or filter request shows the backend error, not the previous results | Not applicable as built: no search or filter request exists. | Planned "[QA-112][US45-AC6] failed search reports the server error, not a locally filtered old catalogue" fails. |

## Tests

- [marketplace.test.tsx](../../../frontend/__tests__/screens/marketplace.test.tsx): the three
  "[QA-112 implemented local UI]" cases.
- [filters.test.ts](../../../frontend/__tests__/marketplace/filters.test.ts): default
  recommended order, each filter, both sorts, combined filters, the applied-filter
  count, and the offered states.
- [client.test.ts](../../../frontend/__tests__/api/client.test.ts): "listServices trims and
  URL-encodes a query without adding authentication".
- Archived requirement probes, not part of the regression suite:
  [public-search-and-selection.test.tsx](../../../frontend/__tests__/planned/public-search-and-selection.test.tsx).
- Playwright: [web.spec.ts](../../../frontend/e2e/web.spec.ts), "US45 implemented Web
  keyword search shows matching results and a recoverable empty state".

From `frontend/`:

```bash
npm test -- __tests__/screens/marketplace.test.tsx __tests__/marketplace/filters.test.ts
npm run test:planned -- __tests__/planned/public-search-and-selection.test.tsx
```

The planned command exits non-zero by design. On 18 September 2026 at `64cb324`,
its four US-45 probes all failed.

## Known gaps

- The parent story's backend integration is not built. Search, filter and sort run
  on the client over a single `GET /services` response. The four criteria that
  depend on backend parameters are unmet (see the [QA matrix](../qa/qa-matrix.md), QA #112).
- The category, city/region and spoken-language filters are missing. The `Service`
  type has no category field, and spoken languages exist only on the Career
  Professional profile.
- There is no explicit "both" delivery option. "Online" and "In person" each match
  services that offer both.
- On the backend, an unknown `modality` value returns HTTP 200 with an empty list
  instead of a validation error (strict xfail B01,
  `test_marketplace_rejects_invalid_modality`). The frontend does not send
  `modality`, so users cannot hit it today.
- Native coverage: only a keyword search on iOS has been observed. Case N04 in the
  [native plan](../qa/native-acceptance-delta.md) (filters, sort and empty recovery
  on both platforms) has not been run.
