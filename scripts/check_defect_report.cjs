#!/usr/bin/env node
'use strict';

// Defect assertions are advisory; incomplete/aborted reports are not. This does
// not certify the product or identify every fixture/beforeEach error: reporters
// can serialize those as ordinary failed tests, just like assertion failures.
// Callers must remove an old report before running the command being assessed.
const fs = require('node:fs');

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function array(value, label) {
  requireThat(Array.isArray(value), `${label} must be an array`);
}

function count(value, label) {
  requireThat(Number.isSafeInteger(value) && value >= 0, `${label} must be a nonnegative integer`);
  return value;
}

function text(value, label) {
  requireThat(typeof value === 'string' && value.trim().length > 0, `${label} must be nonempty text`);
}

function duration(value, label) {
  requireThat(Number.isFinite(value) && value >= 0, `${label} must be a finite nonnegative number`);
}

function timestamp(value, label) {
  requireThat(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label} must be a timestamp`);
}

function checkOutcome(outcome, failed) {
  requireThat(outcome === 'success' || outcome === 'failure', 'outcome must be success or failure');
  requireThat((outcome === 'failure') === (failed > 0), 'Step outcome disagrees with the reported final failures');
}

function validateJest(report, outcome) {
  object(report, 'Jest report');
  for (const key of [
    'numFailedTests', 'numPassedTests', 'numPendingTests', 'numTodoTests', 'numTotalTests',
    'numFailedTestSuites', 'numPassedTestSuites', 'numPendingTestSuites',
    'numRuntimeErrorTestSuites', 'numTotalTestSuites',
  ]) count(report[key], key);
  requireThat(report.wasInterrupted === false, 'Jest was interrupted or omitted completion status');
  requireThat(report.numRuntimeErrorTestSuites === 0 && !report.testExecError, 'Jest reports a runtime/runner error');
  requireThat(report.numPendingTests === 0 && report.numTodoTests === 0 && report.numPendingTestSuites === 0,
    'Jest skipped/pending/todo tests are not a completed defect run');
  requireThat(report.numTotalTests > 0 && report.numTotalTestSuites > 0, 'Jest did not run any tests');
  duration(report.startTime, 'Jest startTime');
  array(report.testResults, 'Jest testResults');
  requireThat(report.testResults.length === report.numTotalTestSuites, 'Jest suite count is inconsistent');
  if (report.openHandles !== undefined) {
    array(report.openHandles, 'Jest openHandles');
    requireThat(report.openHandles.length === 0, 'Jest reports open handles');
  }

  let passed = 0;
  let failed = 0;
  let passedSuites = 0;
  let failedSuites = 0;
  const suiteNames = new Set();
  for (const suite of report.testResults) {
    object(suite, 'Jest suite');
    text(suite.name, 'Jest suite name');
    requireThat(!suiteNames.has(suite.name), 'Jest reports a duplicate suite');
    suiteNames.add(suite.name);
    requireThat(!suite.testExecError, 'Jest suite reports testExecError');
    requireThat(suite.status === 'passed' || suite.status === 'failed', 'Jest suite did not complete');
    duration(suite.startTime, 'Jest suite startTime');
    duration(suite.endTime, 'Jest suite endTime');
    requireThat(suite.endTime >= suite.startTime, 'Jest suite endTime precedes startTime');
    array(suite.assertionResults, 'Jest assertionResults');
    requireThat(suite.assertionResults.length > 0, 'Jest suite has no test results');
    let suiteFailures = 0;
    for (const assertion of suite.assertionResults) {
      object(assertion, 'Jest assertion');
      text(assertion.fullName, 'Jest test fullName');
      requireThat(assertion.status === 'passed' || assertion.status === 'failed', 'Jest test was skipped/todo or did not complete');
      duration(assertion.duration, 'Jest test duration');
      array(assertion.failureMessages, 'Jest failureMessages');
      if (assertion.status === 'failed') {
        requireThat(assertion.failureMessages.length > 0, 'Jest failed test has no failure details');
        assertion.failureMessages.forEach(message => text(message, 'Jest failure message'));
        suiteFailures += 1;
        failed += 1;
      } else {
        requireThat(assertion.failureMessages.length === 0, 'Jest passed test contains failure messages');
        passed += 1;
      }
    }
    requireThat((suite.status === 'failed') === (suiteFailures > 0), 'Jest suite status disagrees with its test results');
    if (suiteFailures > 0) failedSuites += 1;
    else passedSuites += 1;
  }
  requireThat(passed === report.numPassedTests && failed === report.numFailedTests && passed + failed === report.numTotalTests,
    'Jest test totals disagree with individual results');
  requireThat(passedSuites === report.numPassedTestSuites && failedSuites === report.numFailedTestSuites,
    'Jest suite totals disagree with individual results');
  requireThat(report.success === (failed === 0), 'Jest success flag disagrees with its test results');
  checkOutcome(outcome, failed);
  return { format: 'jest', passed, failed, total: passed + failed, skipped: 0, flaky: 0, failedAttempts: failed };
}

function validatePlaywright(report, outcome) {
  object(report, 'Playwright report');
  array(report.errors, 'Playwright runner errors');
  requireThat(report.errors.length === 0, 'Playwright reports runner/global errors');
  object(report.stats, 'Playwright stats');
  for (const key of ['expected', 'unexpected', 'skipped', 'flaky']) count(report.stats[key], `Playwright stats.${key}`);
  requireThat(report.stats.skipped === 0, 'Playwright skipped tests are not a completed defect run');
  timestamp(report.stats.startTime, 'Playwright startTime');
  duration(report.stats.duration, 'Playwright duration');
  array(report.suites, 'Playwright suites');
  let passed = 0;
  let failed = 0;
  let flaky = 0;
  let failedAttempts = 0;
  const identities = new Set();

  function visit(suite) {
    object(suite, 'Playwright suite');
    text(suite.title, 'Playwright suite title');
    if (suite.suites !== undefined) {
      array(suite.suites, 'Playwright nested suites');
      suite.suites.forEach(visit);
    }
    if (suite.specs === undefined) return;
    array(suite.specs, 'Playwright specs');
    for (const spec of suite.specs) {
      object(spec, 'Playwright spec');
      text(spec.title, 'Playwright spec title');
      text(spec.id, 'Playwright spec id');
      requireThat(typeof spec.ok === 'boolean', 'Playwright spec omitted completion status');
      array(spec.tests, 'Playwright spec tests');
      requireThat(spec.tests.length > 0, 'Playwright spec has no test results');
      for (const test of spec.tests) {
        object(test, 'Playwright test');
        text(test.projectId, 'Playwright project id');
        const identity = JSON.stringify([spec.id, test.projectId, test.repeatEachIndex ?? 0]);
        requireThat(!identities.has(identity), 'Playwright reports a duplicate test');
        identities.add(identity);
        requireThat(test.expectedStatus === 'passed', 'Playwright skipped/expected-failure tests are not ordinary defect assertions');
        requireThat(['expected', 'unexpected', 'flaky'].includes(test.status), 'Playwright test did not complete');
        array(test.results, 'Playwright test results');
        requireThat(test.results.length > 0, 'Playwright test has no attempts');
        let priorFailures = 0;
        for (const [index, result] of test.results.entries()) {
          object(result, 'Playwright attempt');
          requireThat(result.status === 'passed' || result.status === 'failed', 'Playwright attempt timed out, was interrupted/skipped, or did not complete');
          requireThat(result.retry === index, 'Playwright retry sequence is incomplete');
          duration(result.duration, 'Playwright attempt duration');
          timestamp(result.startTime, 'Playwright attempt startTime');
          array(result.errors, 'Playwright attempt errors');
          if (result.status === 'failed') {
            requireThat(result.errors.length > 0, 'Playwright failed attempt has no failure details');
            for (const error of result.errors) {
              object(error, 'Playwright test error');
              requireThat(['message', 'value', 'stack'].some(key => typeof error[key] === 'string' && error[key].trim()),
                'Playwright failure details are empty');
            }
            priorFailures += 1;
            failedAttempts += 1;
          } else {
            requireThat(result.errors.length === 0 && !result.error, 'Playwright passed attempt contains errors');
            requireThat(index === test.results.length - 1, 'Playwright retried an already passed test');
          }
        }
        const finalFailed = test.results.at(-1).status === 'failed';
        const expectedStatus = finalFailed ? 'unexpected' : priorFailures > 0 ? 'flaky' : 'expected';
        requireThat(test.status === expectedStatus, 'Playwright test outcome disagrees with its attempts');
        if (finalFailed) failed += 1;
        else {
          passed += 1;
          if (priorFailures > 0) flaky += 1;
        }
      }
      requireThat(spec.ok === spec.tests.every(test => test.status !== 'unexpected'), 'Playwright spec status disagrees with its tests');
    }
  }
  report.suites.forEach(visit);
  requireThat(passed + failed > 0, 'Playwright did not run any tests');
  requireThat(report.stats.expected === passed - flaky && report.stats.unexpected === failed && report.stats.flaky === flaky,
    'Playwright totals disagree with individual results');
  checkOutcome(outcome, failed);
  return { format: 'playwright', passed, failed, total: passed + failed, skipped: 0, flaky, failedAttempts };
}

function validateReport(format, report, outcome) {
  requireThat(format === 'jest' || format === 'playwright', 'format must be jest or playwright');
  return format === 'jest' ? validateJest(report, outcome) : validatePlaywright(report, outcome);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    requireThat(['--format', '--report', '--outcome'].includes(flag), 'Usage: --format jest|playwright --report PATH --outcome success|failure');
    const key = flag.slice(2);
    requireThat(options[key] === undefined, `Duplicate option: ${flag}`);
    const value = args[index + 1];
    text(value, `${flag} value`);
    requireThat(!value.startsWith('--'), `Missing value for ${flag}`);
    options[key] = value;
  }
  for (const key of ['format', 'report', 'outcome']) text(options[key], `--${key}`);
  return options;
}

function main(args = process.argv.slice(2), env = process.env) {
  let summary;
  let exitCode = 0;
  try {
    const options = parseArgs(args);
    requireThat(fs.lstatSync(options.report).isFile(), 'Report path must be a regular file');
    const report = JSON.parse(fs.readFileSync(options.report, 'utf8').replace(/^\uFEFF/, ''));
    const result = validateReport(options.format, report, options.outcome);
    summary = `Defect report (${result.format}): ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped; `
      + `${result.flaky} flaky, ${result.failedAttempts} failed attempts.\n`
      + 'Advisory: completed defect assertions do not block CI; failed tests remain failed. '
      + 'This report check does not certify product acceptance or every fixture/setup failure.';
    process.stdout.write(`${summary}\n`);
  } catch (error) {
    exitCode = 1;
    summary = `Defect report health check FAILED: ${error.message}`;
    process.stderr.write(`${summary}\n`);
  }
  if (env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `\n### Defect report check\n\n${summary}\n`);
    } catch (error) {
      process.stderr.write(`Cannot write GitHub step summary: ${error.message}\n`);
      exitCode = 1;
    }
  }
  return exitCode;
}

module.exports = { validateReport, parseArgs, main };
if (require.main === module) process.exitCode = main();
