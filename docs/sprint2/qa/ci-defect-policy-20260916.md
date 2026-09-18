# CI policy for defect assertions — 16 September 2026

The user requested that defect assertions no longer block this QA submission. The frontend, iOS-component, Android-component and Chromium defect-only steps now run as **advisory** checks. Their tests and expected product behavior are unchanged; failed assertions remain failures in the original JSON, logs and uploaded artifacts.

## What controls the CI result

| Check | Policy |
| --- | --- |
| Normal regression, coverage, lint, typecheck, Web build and critical dependency audit | Must pass |
| Backend, live integration, repository evidence and QA-tooling tests | Must pass; existing backend strict xfails remain separately reported |
| Completed assertions inside the explicitly selected defect suites | Advisory, regardless of the number or signature of failures |
| Defect runner/report health | Must pass: missing/malformed/empty results, inconsistent totals/outcome, skipped/incomplete tests and reported runner failures block |
| Manual native cases not yet executed | Remain NOT RUN; they are not converted into passing evidence |

Each defect step has `continue-on-error: true` and is followed by a required report-health check. Only these three workflow step definitions (shared, native matrix and browser) receive that setting. Normal test steps have no such exception. Each step removes its own old result JSON before running to prevent stale output from standing in for a failed invocation.

The Node validator at `scripts/check_defect_report.cjs` reads the actual Jest or Playwright report, verifies its execution structure and GitHub step outcome, and writes the real pass/fail totals to the Actions job summary. It does not match a fixed defect count or mark the failing test cases as passed. A normal Playwright `expect` assertion may wait and fail; a runner-reported `timedOut` or `interrupted` test is an execution problem.

**Boundary:** result formats cannot reliably distinguish every error raised inside a test or hook from a product assertion. This policy accepts completed failures in the designated defect suites. It is not a promise that every possible fixture/environment problem is identified by root cause. Installation/build failures and report-level execution problems still fail their required steps.

## Meaning of a green workflow

A green workflow means the required regression/tooling checks and report-health checks meet the current CI policy. It does not mean outstanding defects were fixed or all parent-story/native acceptance criteria passed. The defect register and original failure reports stay available for development follow-up. No issue is automatically closed by this policy change.

The local `scripts/run_sprint2_qa.py` remains a strict evidence recorder: it preserves suite exit codes and returns nonzero if any suite fails. Only the CI aggregation policy changes. Historical results, source fingerprints and artifact hashes are not rewritten.

## Repeatable checks

From the repository root with Node 20 and the project's Python environment:

```sh
node --test scripts/tests/test_defect_report.cjs
python3 -B -m unittest discover -s scripts/tests -v
python3 -B scripts/check_sprint2_qa_traceability.py --verify-local-artifacts
```

To verify classification against an existing artifact without rerunning application tests:

```sh
node scripts/check_defect_report.cjs --format jest \
  --report docs/sprint2/qa/evidence/20260916-multiplatform/frontend-defects.json \
  --outcome failure
node scripts/check_defect_report.cjs --format playwright \
  --report docs/sprint2/qa/evidence/20260916-multiplatform/browser-web-defects/results.json \
  --outcome failure
```

Execution results for this change are recorded in [policy validation](ci-defect-policy-validation-20260916.json). The subsequent GitHub Actions run is separate remote evidence; its raw defect results retain their original failure status.
