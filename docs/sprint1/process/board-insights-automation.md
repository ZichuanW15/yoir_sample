# Board Insights automation

The `Board Insights` GitHub Actions workflow regenerates one marker-delimited
section of the
[Process Documentation and Insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights)
Wiki page from organisation Project Board 6. It never rewrites the rest of the
page and never treats board placement as proof that acceptance criteria passed.

## Repository files

- `.github/scripts/board-insights.py` reads ProjectV2 through GitHub GraphQL and
  atomically updates only the generated block.
- `.github/scripts/tests/` contains credential-free JSON fixtures and offline
  unit tests for pagination, malformed data, escaping, sprint boundaries,
  network retry behaviour, stable output and file replacement.
- `.github/mermaid/puppeteer.json` supplies the existing Linux runner browser
  flags used by the repository's Mermaid tooling; the offline suite checks that
  the referenced file exists and remains valid JSON.
- `.github/workflows/board-insights.yml` separates offline validation from Wiki
  publication, validates Mermaid before committing, and pushes only an actual
  page change.

## Required Wiki markers

The existing `Process-Documentation-and-Insights.md` page must contain exactly
one correctly ordered marker pair:

```markdown
<!-- board-insights:start -->
<!-- board-insights:end -->
```

Missing, duplicate, reversed or non-standalone markers stop the job. The
generated section must also contain exactly one marker pair and no content
outside it. Labels returned
by ProjectV2 are treated as untrusted: control characters are removed,
Markdown syntax is escaped, Mermaid labels are reduced to safe single-line
text, and long values are bounded.

The final file is written to a temporary file in the same directory, flushed,
and replaced atomically. If the resulting bytes are unchanged, the original
file is not replaced and the workflow creates no Wiki commit.

## Data-integrity controls

The generator follows every ProjectV2 item page and refuses to publish when:

- an item cursor is missing, repeated or exceeds the 1,000-page safety limit;
- `totalCount` does not equal the number of fetched items;
- a Project item has no ID or an ID is repeated across pages;
- the Project title, fields, update timestamp or item count changes during
  pagination;
- Project fields have duplicate names and therefore ambiguous field values;
- more than 100 Project fields are present; or
- any Issue has more than 100 field values.

The last two cases deliberately fail closed instead of silently publishing a
truncated snapshot. The current board is well below those limits. If it grows
beyond either limit, the GraphQL reader must be extended with the corresponding
nested-connection query before publication is re-enabled.

GraphQL requests have a 20-second timeout and at most three attempts. Only
transport failures, HTTP 429 and HTTP 5xx responses are retried, with capped
backoff and `Retry-After` support. Authentication and other permanent 4xx
responses fail immediately. API error text is bounded, control-cleaned and has
the active token removed before it can reach a log.

Story Points support non-negative fractional values without forcing them to one
decimal place. Null Story Points remain visible as unpointed work. Empty boards,
missing optional fields and missing iteration data render explicit warnings;
malformed dates, durations, counts and non-finite or negative Story Points stop
publication.

Iteration boundaries use `Australia/Melbourne` for the default snapshot date.
The end date is exclusive when selecting the active iteration. If no iteration
spans the date, the most recently started iteration is clearly labelled as a
historical fallback rather than as active. An item assigned to another
iteration is not pulled into the selected sprint merely because its Status has
a similarly named done column.

Output order is deterministic. The displayed source-update timestamp comes
from Project/Issue `updatedAt`, not from the workflow clock, so repeated runs
against the same board state on the same sprint date remain byte-identical.

## Validation and publication events

The workflow's `validate` job runs without secrets for relevant pull requests
and pushes, and also gates every publishing event. It compiles the generator and
runs the offline test suite. Pull requests and ordinary pushes cannot enter the
publishing job.

The `publish` job runs only:

- daily at 19:15 UTC (05:15 the next day in AEST; 06:15 in AEDT);
- when a repository Issue is opened, closed, reopened or edited; or
- manually through `workflow_dispatch`.

All publishing jobs share one non-cancelling concurrency group, so Wiki updates
are serialised. The job:

1. checks that the publishing secret is non-empty;
2. clones `${GITHUB_REPOSITORY}.wiki.git` with `GIT_ASKPASS`;
3. updates `wiki/Process-Documentation-and-Insights.md`;
4. renders every Mermaid block with
   `@mermaid-js/mermaid-cli@11.16.0` and the repository Puppeteer config;
5. verifies that no other Wiki file changed;
6. exits successfully without a commit when the page is unchanged; and
7. commits the one page and pushes the checked-out Wiki branch with
   `git push origin HEAD`.

Repository checkout credentials are not persisted. The token is never embedded
in a clone URL, command-line argument or Git configuration. The workflow's
official GitHub actions are pinned to owner-verified commit SHAs.

## Required repository secret

An administrator must add `BOARD_INSIGHTS_TOKEN` under **Settings → Secrets and
variables → Actions**. The credential must be able to read the organisation's
ProjectV2 and read/push this private repository's Wiki. Use the narrowest access
that the organisation and GitHub token type support. A classic PAT generally
needs the relevant Project access and `repo` access; a fine-grained credential
must receive equivalent supported access. If the organisation enforces SAML
SSO, the credential must also be authorised for the organisation.

Never print, commit or paste the token. Rotate it immediately if it is exposed.

## Local verification

The complete deterministic suite is offline and requires no token:

```sh
python3 -m py_compile .github/scripts/board-insights.py
python3 -B .github/scripts/tests/test_board_insights.py -v
```

A read-only live snapshot can be written outside the repository without
changing the Wiki:

```sh
GH_TOKEN="$(gh auth token)" \
  .github/scripts/board-insights.py --out /tmp/board-insights.md
```

To exercise strict marker replacement on a disposable copy, pass that copy to
`--wiki`. Do not point a local command at the real Wiki checkout unless an
authorised reviewer intends to inspect the resulting diff.

## Known trigger and metric limitations

Repository `issues` events do not fire for every ProjectV2-only change. A change
only to Status, Sprint or Story Points may wait for the scheduled run unless a
team member starts the workflow manually. Immediate refresh for every
organisation ProjectV2 field change would require a webhook receiver or GitHub
App.

Scheduled workflows use the workflow file on the default branch, so the
schedule is inactive until this change is reviewed and merged there.

The burndown is indicative. GitHub's standard ProjectV2 item query provides
current field values plus Issue creation and closure timestamps, not the full
historical sequence of Status or Story Points changes. The automation therefore
does not claim to reconstruct historical scope or acceptance.
