# Planned browser acceptance checks

These checks were investigated in the earlier QA draft. They are preserved here
for a later scope decision and are excluded from the current implemented-feature
test run. Their absence is not counted as a passing test or a product defect.

## US06: automatic session restoration after a page reload

The account relaunch policy is not defined. The earlier investigative check:

1. Register a unique job seeker and log in through the real Web login form.
2. Confirm the account menu is visible and the server accepts the issued token.
3. Reload the page.
4. Propose that the account menu should still be visible.

Step 4 requires product approval of automatic restoration and its storage and
expiry policy before it becomes an acceptance assertion. The current suite does
verify login, logout, revocation, history navigation and protected deep links.

## US45: search requests must be sent to the backend

The implemented Web catalogue filters the fetched services locally. The earlier
architecture-specific check:

1. Open the catalogue and wait for services to appear.
2. Observe outgoing requests to `/api/v1/services`.
3. Enter `interview` into the search input.
4. Require a request with `query=interview`.

The current implemented-feature suite verifies actual matching results, no-match
feedback and clearing the search. Backend query filtering has separate API tests.
Wiring every Web query to the backend remains outside this submission's scope.
