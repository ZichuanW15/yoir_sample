'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { validateReport, parseArgs } = require('../check_defect_report.cjs');
const script = path.resolve(__dirname, '../check_defect_report.cjs');

function jestReport(statuses = ['failed']) {
  const failed = statuses.filter(status => status === 'failed').length;
  return {
    numFailedTests: failed, numPassedTests: statuses.length - failed, numPendingTests: 0,
    numTodoTests: 0, numTotalTests: statuses.length, numFailedTestSuites: failed ? 1 : 0,
    numPassedTestSuites: failed ? 0 : 1, numPendingTestSuites: 0,
    numRuntimeErrorTestSuites: 0, numTotalTestSuites: 1,
    wasInterrupted: false, success: failed === 0, startTime: 1, openHandles: [],
    testResults: [{
      name: '/qa/defects.test.ts', status: failed ? 'failed' : 'passed', startTime: 1, endTime: 10,
      assertionResults: statuses.map((status, index) => ({
        fullName: `defect ${index}`, status, duration: 1,
        failureMessages: status === 'failed' ? ['Expected a valid result; received invalid data'] : [],
      })),
    }],
  };
}

function playwrightReport(statuses = ['failed']) {
  const failed = statuses.filter(status => status === 'failed').length;
  return {
    errors: [],
    stats: { expected: statuses.length - failed, unexpected: failed, skipped: 0, flaky: 0,
      startTime: '2026-09-16T00:00:00Z', duration: 20 },
    suites: [{ title: 'defects.spec.ts', specs: statuses.map((status, index) => ({
      title: `defect ${index}`, id: `spec-${index}`, ok: status === 'passed',
      tests: [{
        projectId: 'chromium', expectedStatus: 'passed', status: status === 'passed' ? 'expected' : 'unexpected',
        results: [{ status, retry: 0, duration: 10, startTime: '2026-09-16T00:00:00Z',
          errors: status === 'failed' ? [{ message: 'expect(locator).toBeVisible failed; Timeout: 5000ms' }] : [] }],
      }],
    })) }],
  };
}

const pwTest = report => report.suites[0].specs[0].tests[0];
const pwAttempt = report => pwTest(report).results[0];

for (const [format, makeReport] of [['jest', jestReport], ['playwright', playwrightReport]]) {
  test(`${format}: arbitrary completed failures remain failed and are advisory`, () => {
    // No hardcoded failure count, test identity or issue signature is required.
    const statuses = ['failed', 'passed', 'failed', 'failed'];
    const result = validateReport(format, makeReport(statuses), 'failure');
    assert.deepEqual({ passed: result.passed, failed: result.failed, total: result.total },
      { passed: 1, failed: 3, total: 4 });
  });
  test(`${format}: fixed assertions may all pass without changing a baseline`, () => {
    assert.equal(validateReport(format, makeReport(['passed']), 'success').failed, 0);
  });
  test(`${format}: failure outcome with an all-passing report is not ignored`, () => {
    assert.throws(() => validateReport(format, makeReport(['passed']), 'failure'), /outcome disagrees/);
  });
  test(`${format}: success outcome cannot hide failed assertions`, () => {
    assert.throws(() => validateReport(format, makeReport(), 'success'), /outcome disagrees/);
  });
  test(`${format}: omitted, skipped or cancelled outcome is rejected`, () => {
    for (const outcome of [undefined, 'skipped', 'cancelled']) {
      assert.throws(() => validateReport(format, makeReport(), outcome), /outcome must/);
    }
  });
}

const badJest = [
  ['runtime error suite', report => { report.numRuntimeErrorTestSuites = 1; }, /runtime/],
  ['suite execution error', report => { report.testResults[0].testExecError = { message: 'Cannot find module' }; }, /testExecError/],
  ['top-level execution error', report => { report.testExecError = { message: 'worker crashed' }; }, /runtime/],
  ['interrupted', report => { report.wasInterrupted = true; }, /interrupted/],
  ['completion field missing', report => { delete report.wasInterrupted; }, /completion/],
  ['pending count', report => { report.numPendingTests = 1; }, /skipped/],
  ['todo count', report => { report.numTodoTests = 1; }, /todo/],
  ['pending suite', report => { report.numPendingTestSuites = 1; }, /pending/],
  ['skipped assertion despite totals', report => { report.testResults[0].assertionResults[0].status = 'pending'; }, /skipped/],
  ['todo assertion despite totals', report => { report.testResults[0].assertionResults[0].status = 'todo'; }, /todo/],
  ['empty run', report => { report.numTotalTests = 0; }, /any tests/],
  ['missing assertions', report => { delete report.testResults[0].assertionResults; }, /assertionResults/],
  ['empty suite', report => { report.testResults[0].assertionResults = []; }, /no test results/],
  ['missing failure details', report => { report.testResults[0].assertionResults[0].failureMessages = []; }, /failure details/],
  ['missing suite result', report => { report.numTotalTestSuites = 2; }, /suite count/],
  ['inconsistent total', report => { report.numTotalTests = 2; }, /test totals/],
  ['inconsistent passed count', report => { report.numPassedTests = 1; }, /test totals/],
  ['inconsistent suite count', report => { report.numFailedTestSuites = 0; }, /suite totals/],
  ['inconsistent suite status', report => { report.testResults[0].status = 'passed'; }, /suite status/],
  ['inconsistent success flag', report => { report.success = true; }, /success flag/],
  ['duplicate suite', report => { report.testResults.push(structuredClone(report.testResults[0])); report.numTotalTestSuites = 2; }, /duplicate suite/],
  ['open handles', report => { report.openHandles = [{ message: 'TCPSERVERWRAP' }]; }, /open handles/],
  ['missing counter', report => { delete report.numTodoTests; }, /integer/],
  ['invalid duration', report => { report.testResults[0].assertionResults[0].duration = null; }, /duration/],
];
for (const [name, mutate, error] of badJest) {
  test(`Jest rejects ${name}`, () => {
    const report = jestReport();
    mutate(report);
    assert.throws(() => validateReport('jest', report, 'failure'), error);
  });
}

const badPlaywright = [
  ['global runner error', report => { report.errors = [{ message: 'webServer failed to start' }]; }, /runner/],
  ['missing runner error list', report => { delete report.errors; }, /runner errors/],
  ['test timeout', report => { pwAttempt(report).status = 'timedOut'; }, /timed out/],
  ['interrupted test', report => { pwAttempt(report).status = 'interrupted'; }, /interrupted/],
  ['skipped attempt', report => { pwAttempt(report).status = 'skipped'; }, /skipped/],
  ['skipped test', report => { pwTest(report).status = 'skipped'; }, /complete/],
  ['skipped counter', report => { report.stats.skipped = 1; }, /skipped/],
  ['expected failure annotation', report => { pwTest(report).expectedStatus = 'failed'; }, /expected-failure/],
  ['no suites', report => { report.suites = []; }, /any tests/],
  ['no attempts', report => { pwTest(report).results = []; }, /no attempts/],
  ['no test results', report => { report.suites[0].specs[0].tests = []; }, /no test results/],
  ['no failure details', report => { pwAttempt(report).errors = []; }, /failure details/],
  ['empty failure details', report => { pwAttempt(report).errors = [{}]; }, /details are empty/],
  ['missing stats', report => { delete report.stats; }, /stats/],
  ['missing stats field', report => { delete report.stats.flaky; }, /integer/],
  ['wrong total', report => { report.stats.unexpected = 2; }, /totals/],
  ['wrong test outcome', report => { pwTest(report).status = 'expected'; }, /outcome disagrees/],
  ['wrong spec status', report => { report.suites[0].specs[0].ok = true; }, /spec status/],
  ['truncated retries', report => { pwAttempt(report).retry = 1; }, /retry sequence/],
  ['duplicate test', report => { report.suites[0].specs[0].tests.push(structuredClone(pwTest(report))); }, /duplicate/],
  ['invalid start timestamp', report => { pwAttempt(report).startTime = 'never'; }, /timestamp/],
];
for (const [name, mutate, error] of badPlaywright) {
  test(`Playwright rejects ${name}`, () => {
    const report = playwrightReport();
    mutate(report);
    assert.throws(() => validateReport('playwright', report, 'failure'), error);
  });
}

test('Playwright reports failed retries separately when the final attempt passes', () => {
  const report = playwrightReport();
  const attempt = structuredClone(pwAttempt(report));
  Object.assign(attempt, { status: 'passed', errors: [], retry: 1 });
  pwTest(report).results.push(attempt);
  pwTest(report).status = 'flaky';
  report.suites[0].specs[0].ok = true;
  Object.assign(report.stats, { unexpected: 0, flaky: 1 });
  assert.deepEqual(validateReport('playwright', report, 'success'), {
    format: 'playwright', passed: 1, failed: 0, total: 1, skipped: 0, flaky: 1, failedAttempts: 1,
  });
});

test('Playwright recursively validates nested suites', () => {
  const report = playwrightReport();
  report.suites = [{ title: 'parent', suites: report.suites }];
  assert.equal(validateReport('playwright', report, 'failure').failed, 1);
});

test('per-test fixture exceptions cannot always be distinguished from assertions', () => {
  const report = playwrightReport();
  pwAttempt(report).errors = [{ message: 'Failure from a beforeEach helper' }];
  // This is an explicit boundary of report-only classification, not a claim
  // that arbitrary test/fixture exceptions prove a healthy environment.
  assert.equal(validateReport('playwright', report, 'failure').failed, 1);
});

test('CLI rejects unknown, incomplete and duplicate arguments', () => {
  for (const args of [[], ['--format'], ['--format', '--report'], ['--unknown', 'x'],
    ['--format', 'jest', '--format', 'jest']]) {
    assert.throws(() => parseArgs(args));
  }
  assert.throws(() => validateReport('unknown', {}, 'success'), /format must/);
});

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-defect-report-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runCli(reportPath, summaryPath, extraArgs = []) {
  const env = { ...process.env };
  delete env.GITHUB_STEP_SUMMARY;
  if (summaryPath) env.GITHUB_STEP_SUMMARY = summaryPath;
  return spawnSync(process.execPath, [script, '--format', 'jest', '--report', reportPath,
    '--outcome', 'failure', ...extraArgs], { encoding: 'utf8', env });
}

test('CLI preserves raw failures and appends an honest advisory summary', t => {
  const directory = temporaryDirectory(t);
  const reportPath = path.join(directory, 'report.json');
  const summaryPath = path.join(directory, 'summary.md');
  const original = JSON.stringify(jestReport(['failed', 'passed']));
  fs.writeFileSync(reportPath, original);
  fs.writeFileSync(summaryPath, 'Existing job summary\n');
  const result = runCli(reportPath, summaryPath);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 passed, 1 failed, 0 skipped/);
  assert.match(result.stdout, /Advisory/);
  assert.match(result.stdout, /failed tests remain failed/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /^Existing job summary\n[\s\S]*1 passed, 1 failed/);
  assert.equal(fs.readFileSync(reportPath, 'utf8'), original);
});

for (const problem of ['missing', 'malformed', 'empty', 'directory', 'symlink']) {
  test(`CLI fails closed for a ${problem} report`, t => {
    const directory = temporaryDirectory(t);
    const reportPath = path.join(directory, 'report.json');
    const summaryPath = path.join(directory, 'summary.md');
    if (problem === 'malformed') fs.writeFileSync(reportPath, '{');
    if (problem === 'empty') fs.writeFileSync(reportPath, '');
    if (problem === 'directory') fs.mkdirSync(reportPath);
    if (problem === 'symlink') {
      const actual = path.join(directory, 'actual.json');
      fs.writeFileSync(actual, JSON.stringify(jestReport()));
      fs.symlinkSync(actual, reportPath);
    }
    const result = runCli(reportPath, summaryPath);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /health check FAILED/);
    assert.match(fs.readFileSync(summaryPath, 'utf8'), /health check FAILED/);
  });
}

test('CLI fails if the requested GitHub step summary cannot be recorded', t => {
  const directory = temporaryDirectory(t);
  const reportPath = path.join(directory, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(jestReport()));
  const result = runCli(reportPath, path.join(directory, 'missing-parent', 'summary.md'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot write GitHub step summary/);
});
