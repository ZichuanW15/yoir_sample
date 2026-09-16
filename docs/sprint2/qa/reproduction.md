# Reproduce the implemented-feature QA run

Use Node 20.20.2, npm 10.8.2, Python 3.12, locked `backend/uv.lock` and `frontend/package-lock.json`. CI uses PostgreSQL 16 and Chromium. The exact local versions are in the run's `runtime-versions.log` and live database evidence.

## 1. Install once from the repository root

**Do not reinstall or run the full suites just for the 16 September issue
reconciliation.** Reuse unchanged-baseline evidence; only its new tooling check
and tests need execution:

```sh
python3 -B scripts/check_sprint2_qa_traceability.py --verify-local-artifacts
python3 -B -m unittest discover -s scripts/tests -p test_qa_traceability.py -v
```

The artifact flag verifies the retained summary's checksum without executing any
product tests. In a fresh checkout lacking ignored local artifacts, omit that
flag; the resulting check proves record consistency only, not access to the raw
run. The full-run instructions below are for a separately needed new baseline or
targeted product change, not a requirement to repeat existing work.

```sh
uv sync --locked --project backend
npm --prefix frontend ci --no-audit
cd frontend
npx playwright install chromium
cd ..
```

On Linux, use `npx playwright install --with-deps chromium` when browser system libraries are missing. CI includes that command. No real account credentials are required: all accounts belong to disposable local fixtures.

## 2. Choose isolated databases

For a quick SQLite check, omit `--postgres-url`. The backend fixture creates/deletes its own temporary database; PostgreSQL concurrency and timezone cases will be skipped and cannot be claimed as passed.

For full evidence, provide **two separately owned PostgreSQL databases** on localhost whose names end in `_test`, for example `yoir_qa_test` and `yoir_live_test`. The test fixture deletes rows and drops tables in the first. The seeded live API uses the second. Never point either command at a shared development or production database. The recorder rejects remote hosts and non-test database names, and clears inherited database/reset variables.

Example setup on an existing *disposable local* PostgreSQL server:

```sh
createdb -h 127.0.0.1 -p 55435 -U yoir_qa yoir_qa_test
createdb -h 127.0.0.1 -p 55435 -U yoir_qa yoir_live_test
```

The host, port and role must match your own temporary server; these commands do not start PostgreSQL. Choose unused database names, because live journeys intentionally persist records. Browser suites start a third, automatically owned temporary SQLite API/database and terminate it after each run.

## 3. Start the separate live API

In terminal A, from the repository root:

```sh
DATABASE_URL=postgresql://yoir_qa@127.0.0.1:55435/yoir_live_test \
SEED_ON_STARTUP=true \
JWT_SECRET=local-qa-test-secret-at-least-32-characters \
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend \
  --host 127.0.0.1 --port 58005
```

Wait for `/api/v1/health` to return `{"status":"ok"}`. Stop this owned server with Ctrl-C after the run. Shut down your temporary PostgreSQL server when finished. Do not reuse a live database for the destructive in-process suite.

## 4. Record the full run

In terminal B, from the repository root:

```sh
backend/.venv/bin/python scripts/run_sprint2_qa.py \
  --postgres-url postgresql://yoir_qa@127.0.0.1:55435/yoir_qa_test \
  --live-api-url http://127.0.0.1:58005/api/v1
```

The runner creates a new `artifacts/qa/sprint2/<UTC-run-id>/` folder, runs every check even after a defect failure, and writes `summary.json` incrementally. It runs iOS and Android Expo-preset component and defect suites separately, preserving four JSON outputs. These are not simulator/device runs. It exports Web with `EXPO_PUBLIC_API_URL=/api/v1` and `EXPO_PUBLIC_USE_DEMO_API=false`, then tests that build. No build or dependency installation is copied into the proposed commit.

The current expected exit is **1**, because correct frontend/browser defect assertions fail. Inspect every nonzero check rather than treating any exit 1 as acceptable. The accepted snapshot has no unexpected infrastructure failures; see [results](test-results.md). Xfails and skipped tests remain separate in the backend XML.

If your Python or browser cache is elsewhere, use `--backend-python /absolute/path/to/python` and `PLAYWRIGHT_BROWSERS_PATH=/absolute/path/to/cache`. `WEB_QA_PORT` selects an unused local browser-server port (default 43117). Existing servers are never reused. `--output` must be a new/empty directory, so prior evidence is not overwritten.

## 5. Suite commands for a future run — not the reconciliation delta

```sh
# Fast current backend checks; uses temporary SQLite
cd backend
env -u DATABASE_URL .venv/bin/python -m pytest tests -m 'not live and not future_contract' -ra
cd ../frontend
npm run test:coverage
npm run test:defects
npm run test:ios
npm run test:ios:defects
npm run test:android
npm run test:android:defects
# Build before browser runs
EXPO_PUBLIC_API_URL=/api/v1 EXPO_PUBLIC_USE_DEMO_API=false npm run build:web
WEB_QA_OUTPUT_DIR=test-results/web-normal npm run test:web
WEB_QA_OUTPUT_DIR=test-results/web-defects npm run test:web:defects
cd ..
```

To reproduce one defect, append `-- -t 'exact case name'` to Jest, use pytest `file.py::test_name`, or Playwright `--grep 'case title'`. Backend strict xfails require `--runxfail` to display an ordinary assertion failure. Only do that for a specifically selected defect. See [defect selectors](defects.md).

Do not run this whole command block for an unchanged test or documentation-only
edit. Select changed/new cases and document why; preserve old timestamps and
outcomes. For device gaps use the [remaining-only plan](native-acceptance-delta.md).

Archived frontend proposals (`npm run test:planned`) and backend `-m future_contract` are separate optional investigations, not part of this submission's executed counts. The browser proposals are documentary only.

See the [browser harness guide](../../../frontend/e2e/README.md) for its SQLite timestamp adaptation and screenshot/trace inspection.

See the [platform matrix](platform-test-matrix.md) before recording iOS/Android sign-off. Native component results cannot replace device build, keyboard, permission-dialog or navigation-gesture evidence.

## 6. Inspect and retain evidence

`summary.json` links raw per-check logs; Jest JSON and JUnit XML identify every executed assertion. Coverage JSON includes numerator/denominator details. Playwright JSON, screenshot, error context and trace identify real browser failures. Full raw runs stay under ignored `artifacts/`; the compact report stores selected raw files without duplicate HTML libraries.

After reviewing the change set, an optional local archive can be produced with:

```sh
backend/.venv/bin/python scripts/package_sprint2_qa.py --output /tmp/sprint2-qa-review
```

Use a new directory outside the repository. The packager validates the QA-only file boundary and hashes, and refuses overwrite, symlinks, deletions and unrecognized changes. It never stages, commits or pushes files. The local untracked `.idea/` is unrelated IDE configuration and will deliberately make this strict packager refuse the mixed working tree. Do not delete or silently package that directory; use an explicitly reviewed QA-only checkout for packaging, or submit only the reviewed QA paths as described in the submission guide.
