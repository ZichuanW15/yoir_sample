# 16 September automated QA evidence

These are publication copies of the existing run **20260916T043532.423770Z**, executed **2026-09-16 04:35:32–04:38:36 UTC** (14:35–14:38 AEST). No application tests were rerun to prepare this directory. The original run used QA HEAD `3e7f4b348c03504360af04d438202e37a5428e83` with its recorded working-tree fingerprints; the product baseline is `0ffa565e47d60fc2783a4618e5dce6cfe73a4b08`.

## Start here

- [Complete original run summary](summary.json): timestamps, commands, exit codes and source fingerprints.
- [Publication manifest](manifest.json): every original source path, source/publication SHA-256, size, retained outcome, sensitive-data review and omitted artifact.
- [Shared component regression](frontend-tests.json) and [defect assertions](frontend-defects.json).
- [iOS component regression](ios-components.json) / [defects](ios-defects.json); [Android component regression](android-components.json) / [defects](android-defects.json).
- [Chromium regression](browser-web/results.json) and [defects](browser-web-defects/results.json), with five original failure screenshots and their error-context files under `browser-web-defects/attachments/`.
- [PostgreSQL JUnit](backend-tests.xml), [HTTPX live JUnit](httpx-live.xml), and [real TypeScript client](typescript-live.json).
- [Frontend per-file coverage summary](frontend-coverage/coverage-summary.json), [frontend line/branch coverage](frontend-coverage/lcov.info), and [backend coverage](backend-coverage.json).

The component results retain **265 passed / 24 defect failures** for shared execution and **274 passed / 25 defect failures per native preset**. Chromium retains **14 passed / 5 defect failures**. PostgreSQL retains **347 passed / 19 strict xfails**. HTTPX and the TypeScript client retain **2 passes each**. These are separate executions/layers, not additive unique capabilities or a clean product acceptance result. Failure logs are kept unchanged alongside the structured files.

## What is published

There are **47 byte-for-byte original files**, approximately **2.50 MB**, plus this README and the manifest. Files were copied from ignored `artifacts/qa/sprint2/20260916-multiplatform-final/`; this reviewed directory is intended to travel with the QA commit. After it is pushed, reviewers can use ordinary repository/PR links without access to that local ignored directory.

Original absolute paths and attachment references inside JSON/logs are preserved for provenance. The directory structure here preserves retained relative paths. Large trace archives, generated HTML reports/assets and runner cache files are explicitly omitted in the manifest. A reference to an omitted trace is not a claim that it was published. No database, dependency tree, video, environment file or transient native-server files are included. All original source/publication file hashes match; no selected content was sanitized or rewritten.

Sensitive-content review covered all selected text and the five screenshots. Pattern matches were limited to test descriptions, malformed credential labels and known source-declared local fixtures. No JWT, real account credential, private key, service token or password-bearing connection URL was selected. Disposable example.com seed identities, fixture passwords, a mock token, local workspace paths and machine provenance remain in the unaltered evidence.

## Native boundary

The iOS/Android JSON files are **Expo preset component executions with mocked device boundaries**. The later [manual native report](../../native-device-results-20260916.md) separately describes limited Expo Go simulator journeys and read-only booking verification. Its original screenshot/accessibility observations are in the task conversation; there are no independent native screenshot/video files in this bundle. Publishing this evidence does not turn that limited smoke into full native acceptance or release-build sign-off.

The historical [15 September evidence](../latest/summary.json) is unchanged. See the [multi-platform report](../../test-results-multiplatform.md) and [QA issue mapping](../../qa-matrix.md) for interpretation.

## Verify publication integrity

From the repository root, this read-only check validates the copied files without running tests:

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
folder = Path('docs/sprint2/qa/evidence/20260916-multiplatform')
manifest = json.loads((folder / 'manifest.json').read_text())
for entry in manifest['files']:
    data = (folder / entry['path']).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    assert digest == entry['publishedSha256'] == entry['sourceSha256'], entry['path']
    assert len(data) == entry['bytes'], entry['path']
print(f"Verified {len(manifest['files'])} original evidence files")
PY
```
