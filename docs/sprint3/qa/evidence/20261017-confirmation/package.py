"""Package completed confirmation QA runs; do not start or repeat application tests."""
import base64
import datetime
import hashlib
import json
import pathlib
import platform
import re
import subprocess

ROOT = pathlib.Path('/Users/zhouzhny/Desktop/SWEN90014-2026-CSD-Koala')
TMP = pathlib.Path('/private/tmp/yoir-pr246-20261017')
SRC = ROOT / 'artifacts/qa/sprint3-confirmation-20261017'
OUT = ROOT / 'docs/sprint3/qa/evidence/20261017-confirmation'
PREVIOUS = ROOT / 'docs/sprint3/qa/evidence/20261017-meeting-area'
EXPECTED_BASELINE = '8713b38d63ccb969dcc69a44a02f888fd65caa9a'
REQUIRED_RUNS = {
    'frontend-regression', 'ios-regression', 'android-regression',
    'frontend-defects', 'ios-defects', 'android-defects',
    'frontend-lint', 'frontend-typecheck', 'web-build',
    'browser-desktop-regression', 'browser-desktop-defects',
    'browser-phone-regression', 'browser-phone-defects',
    'browser-desktop-regression-final', 'browser-desktop-defects-final',
    'browser-phone-regression-final', 'browser-phone-defects-final',
    'quality-lint', 'quality-typecheck',
    'browser-desktop-admin-followup', 'browser-phone-admin-followup',
    'quality-lint-final', 'quality-typecheck-final',
}
INITIAL_BROWSER_RUNS = {
    'browser-desktop-regression', 'browser-desktop-defects',
    'browser-phone-regression', 'browser-phone-defects',
}
SECOND_FULL_BROWSER_RUNS = {
    'browser-desktop-regression-final', 'browser-desktop-defects-final',
    'browser-phone-regression-final', 'browser-phone-defects-final',
}
ADMIN_FOLLOWUP_RUNS = {
    'browser-desktop-admin-followup', 'browser-phone-admin-followup',
}
PRE_FOLLOWUP_QUALITY_RUNS = {'quality-lint', 'quality-typecheck'}
RESPONSIVE_SOURCE = 'frontend/e2e/sprint3-responsive.spec.ts'
INITIAL_BROWSER_SOURCE_CHANGES = {
    'frontend/e2e/sprint3-responsive.spec.ts',
    'frontend/e2e/sprint3-workflows.spec.ts',
}
LIVE_FRONTEND_EXACT = {
    'frontend/__tests__/integration/live-client.test.ts',
    'frontend/jest.config.live.js',
    'frontend/jest.live-fetch-capture.js',
    'frontend/jest.live-fetch-restore.js',
    'frontend/package.json', 'frontend/package-lock.json',
    'frontend/tsconfig.json', 'frontend/babel.config.js', 'frontend/babel.config.cjs',
}
AUTHORING = {
    'original-assertion-fixed-product': {
        'productBaseline': '04ff6d47cef270c2ceabbff878e255bc17cc1600',
        'scope': 'Original exact-string assertion against original PR #246 product.',
    },
    'corrected-assertion-base-product': {
        'productBaseline': 'bad7a8ba78c64b794fdbbbb22381673f1a3e4784',
        'scope': 'Corrected regex assertion against pre-fix dev.',
    },
    'corrected-assertion-fixed-product': {
        'productBaseline': '04ff6d47cef270c2ceabbff878e255bc17cc1600',
        'scope': 'Corrected regex assertion against original PR #246 product.',
    },
    'existing-regression-fixed-product': {
        'productBaseline': '04ff6d47cef270c2ceabbff878e255bc17cc1600',
        'scope': 'Existing confirmation, checkout, root-layout and desktop regression on original PR head.',
    },
    **{
        f'confirmation-history-{preset}': {
            'productBaseline': '04ff6d47cef270c2ceabbff878e255bc17cc1600',
            'scope': f'Eight authored confirmation-history cases on original PR head; {preset} preset.',
        } for preset in ('shared', 'ios', 'android')
    },
    **{
        f'final-confirmation-history-{preset}': {
            'productBaseline': EXPECTED_BASELINE,
            'scope': f'Eight confirmation-history cases on the integrated main working tree; {preset} preset.',
        } for preset in ('shared', 'ios', 'android')
    },
}


def sha(payload):
    return hashlib.sha256(payload).hexdigest()


def command(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def source_name(path):
    path = pathlib.Path(path)
    return str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)


def scrub(text):
    # Preserve diagnostics and outcomes while removing auth material even when
    # a runner printed only a truncated JWT, bearer value, or token JSON field.
    text = re.sub(r'eyJ[A-Za-z0-9_.-]+', '[REDACTED_TEST_AUTH_FRAGMENT]', text)
    text = re.sub(r'(?i)(Bearer\s+)[A-Za-z0-9._~+/-]{8,}', r'\1[REDACTED_TEST_AUTH]', text)
    text = re.sub(
        r'(?i)("(?:accessToken|refreshToken|clientSecret)"\s*:\s*")[^"]+(")',
        r'\1[REDACTED_TEST_AUTH]\2', text,
    )
    clean = '\n'.join(line.rstrip() for line in text.splitlines()).rstrip()
    return clean + '\n' if clean else ''


def scrub_object(value):
    if isinstance(value, str):
        return scrub(value).rstrip('\n')
    if isinstance(value, list):
        return [scrub_object(item) for item in value]
    if isinstance(value, dict):
        return {key: ('[REDACTED_TEST_AUTH]' if key.lower() in {
            'accesstoken', 'refreshtoken', 'clientsecret',
        } and isinstance(item, str) and item else scrub_object(item)) for key, item in value.items()}
    return value


def in_scope(label, path):
    # These predicates deliberately match run.py. Backend files are not absent
    # from a frontend-only recording: they are outside that recording's scope.
    if label.startswith(('frontend-', 'ios-', 'android-')):
        return path.startswith('frontend/') and not path.startswith('frontend/e2e/') and 'playwright' not in path
    if label == 'web-build':
        return path.startswith('frontend/') and not path.startswith(
            ('frontend/__tests__/', 'frontend/e2e/')) and 'playwright' not in path
    return True


def scope_description(label):
    if label.startswith(('frontend-', 'ios-', 'android-')):
        return {
            'include': ['frontend/'],
            'exclude': ['frontend/e2e/', 'paths containing playwright'],
            'note': 'Frontend source/config/test snapshot; unrelated backend and browser files are not applicable.',
        }
    if label == 'web-build':
        return {
            'include': ['frontend/'],
            'exclude': ['frontend/__tests__/', 'frontend/e2e/', 'paths containing playwright'],
            'note': 'Build input snapshot; application tests and backend source are not build inputs.',
        }
    return {
        'include': ['frontend/', 'backend/', 'scripts/', '.github/workflows/'],
        'exclude': ['artifacts', 'coverage', '__pycache__'],
        'note': (
            'Complete repository input snapshot for final quality checks; command and cwd identify the actual checked scope.'
            if label.startswith('quality-') else
            'Repository input snapshot for isolated real-API browser runs; this is not a backend-suite execution claim.'
        ),
    }


def retained_client_path(path):
    return path.startswith('frontend/src/api/') or path in LIVE_FRONTEND_EXACT


def final_sources():
    paths = sorted(set(command(
        'git', 'ls-files', '--cached', '--others', '--exclude-standard',
        'frontend', 'backend', 'scripts', '.github/workflows',
    ).splitlines()))
    return {path: sha((ROOT / path).read_bytes()) for path in paths
            if (ROOT / path).is_file() and not any(
                part in ('artifacts', 'coverage', '__pycache__') for part in pathlib.Path(path).parts)}


class Package:
    def __init__(self):
        self.files = []
        self.names = set()
        self.omitted_screenshots = []

    def save(self, name, payload, source=None, transformation=None, **extra):
        assert name not in self.names, f'Duplicate packaged file: {name}'
        self.names.add(name)
        original = pathlib.Path(source).read_bytes() if source else None
        data = payload if isinstance(payload, bytes) else (
            json.dumps(scrub_object(payload), ensure_ascii=False, indent=2) + '\n').encode()
        destination = OUT / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        record = {'path': name, 'sha256': sha(data), 'bytes': len(data)}
        if source:
            record.update(source=source_name(source), sourceSha256=sha(original), sourceBytes=len(original))
        if transformation:
            record['transformation'] = transformation
        record.update(extra)
        self.files.append(record)

    def copy_text(self, name, source):
        original = source.read_bytes()
        self.save(name, scrub(original.decode('utf-8')).encode(), source,
                  'Trailing whitespace/extra EOF blank lines normalized; authentication fragments redacted if present; outcomes unchanged.')

    def jest(self, source):
        data = json.loads(source.read_text())
        if 'numTotalTests' not in data:
            return
        keys = [
            'startTime', 'success', 'wasInterrupted', 'numPassedTests', 'numFailedTests',
            'numPendingTests', 'numTotalTests', 'numPassedTestSuites', 'numFailedTestSuites',
            'numRuntimeErrorTestSuites',
        ]
        reduced = {key: data[key] for key in keys}
        reduced['cases'] = [{
            'file': source_name(suite['name']),
            **{key: case[key] for key in ('fullName', 'status', 'duration')},
            'failureMessages': case['failureMessages'],
        } for suite in data['testResults'] for case in suite['assertionResults']]
        self.save(source.parent.name + '.json', reduced, source,
                  'Runner report reduced to counts, per-case identities, timings and failures; authentication fragments redacted if present.')

    def browser(self, source):
        data = json.loads(source.read_text())
        cases = []

        def walk(suite):
            for spec in suite.get('specs', []):
                for test in spec.get('tests', []):
                    case = {key: spec[key] for key in ('file', 'line', 'title')}
                    case.update(project=test['projectName'], status=test['status'],
                                expectedStatus=test['expectedStatus'], results=[])
                    case_number = len(cases) + 1
                    for attempt, result in enumerate(test.get('results', [])):
                        reduced = {key: result[key] for key in ('status', 'duration', 'startTime', 'retry') if key in result}
                        reduced['errors'] = result.get('errors', [])
                        reduced['attachments'] = []
                        reduced['omittedAttachments'] = []
                        for index, attachment in enumerate(result.get('attachments', [])):
                            if attachment.get('contentType') not in ('application/json', 'image/png'):
                                continue
                            attachment_source = source
                            if 'body' in attachment:
                                original = base64.b64decode(attachment['body'])
                            else:
                                attachment_source = pathlib.Path(attachment['path'])
                                if not attachment_source.is_absolute():
                                    attachment_source = ROOT / 'frontend' / attachment_source
                                assert attachment_source.is_file(), f'Missing selected attachment: {attachment_source}'
                                original = attachment_source.read_bytes()
                            suffix = 'json' if attachment['contentType'] == 'application/json' else 'png'
                            keep_screenshot = (
                                pathlib.Path(spec['file']).name in {
                                    'sprint3-meeting-area.spec.ts', 'sprint3-responsive.spec.ts',
                                }
                                or result.get('status') != 'passed'
                            )
                            if suffix == 'png' and not keep_screenshot:
                                omitted = {
                                    'name': attachment.get('name'),
                                    'source': source_name(attachment_source),
                                    'sourceReport': source_name(source),
                                    'originalAttachmentSha256': sha(original),
                                    'originalAttachmentBytes': len(original),
                                    'reason': 'Passed unchanged browser case: per-case outcome and original screenshot hash retained; duplicate image bytes omitted.',
                                }
                                reduced['omittedAttachments'].append(omitted)
                                self.omitted_screenshots.append(omitted)
                                continue
                            name = f'attachments/{source.parent.name}-{case_number:03d}-{attempt}-{index}.{suffix}'
                            payload = scrub(original.decode('utf-8')).encode() if suffix == 'json' else original
                            if suffix == 'json':
                                json.loads(payload)
                            self.save(
                                name, payload, attachment_source,
                                'Original screenshot retained.' if suffix == 'png' else 'Original JSON attachment normalized/redacted; outcomes unchanged.',
                                originalAttachmentSha256=sha(original), originalAttachmentBytes=len(original),
                                sourceReport=source_name(source), sourceAttachmentName=attachment.get('name'),
                            )
                            reduced['attachments'].append({'name': attachment.get('name'), 'path': name})
                        case['results'].append(reduced)
                    cases.append(case)
            for child in suite.get('suites', []):
                walk(child)

        for suite in data['suites']:
            walk(suite)
        self.save(source.parent.name + '.json', {
            'stats': data['stats'], 'errors': data.get('errors', []), 'cases': cases,
            'projects': data.get('config', {}).get('projects', []),
        }, source, 'Browser report reduced to per-case outcomes and selected original attachments; regenerable HTML/traces omitted.')


def prepare_retained(final, baseline):
    previous_manifest = json.loads((PREVIOUS / 'manifest.json').read_text())
    original_index = {entry['path']: entry for entry in previous_manifest['files']}

    def reference(name):
        path = PREVIOUS / name
        digest = sha(path.read_bytes())
        assert original_index[name]['sha256'] == digest, f'Prior packaged file changed: {path}'
        return {'path': source_name(path), 'sha256': digest}

    source_reference = reference('source-manifest.json')
    old = json.loads((PREVIOUS / 'source-manifest.json').read_text())
    previous = old['finalSourceSha256']
    backend_paths = {path for path in previous.keys() | final.keys() if path.startswith('backend/')}
    client_paths = {path for path in previous.keys() | final.keys() if retained_client_path(path)}
    relevant = backend_paths | client_paths
    changed = {
        path: {'previous': previous.get(path), 'current': final.get(path)}
        for path in sorted(relevant) if previous.get(path) != final.get(path)
    }
    assert not changed, f'Retained backend/live inputs changed: {changed}'
    required_client = LIVE_FRONTEND_EXACT - {'frontend/babel.config.js', 'frontend/babel.config.cjs'}
    assert required_client <= client_paths, f'Missing live client input hashes: {required_client - client_paths}'
    frontend_changes = {
        path: {'previous': previous.get(path), 'current': final.get(path)}
        for path in sorted(previous.keys() | final.keys())
        if path.startswith('frontend/') and previous.get(path) != final.get(path)
    }
    executions_reference = reference('executions.json')
    original_executions = json.loads((PREVIOUS / 'executions.json').read_text())
    retained = []
    for label in ('backend-postgres', 'httpx-live', 'typescript-live'):
        execution = next(item for item in original_executions if item['label'] == label)
        assert execution['exitCode'] == 0
        assert not [path for path in execution['changedDuringRun'] if path in relevant]
        assert not [path for path in execution['sourceDifferenceFromFinal'] if path in relevant]
        assert not [path for path in execution['finalFilesAbsentAtStart'] if path in relevant]
        report_reference = reference(label + '.json')
        report = json.loads((PREVIOUS / (label + '.json')).read_text())
        if label == 'backend-postgres':
            assert report['counts'] == {'pass': 916, 'fail': 0, 'error': 0, 'xfail': 18, 'skip': 0}
            outcome = report['counts']
        elif label == 'httpx-live':
            assert report['counts'] == {'pass': 2, 'fail': 0, 'error': 0, 'xfail': 0, 'skip': 0}
            outcome = report['counts']
        else:
            assert (report['numPassedTests'], report['numFailedTests'], report['numPendingTests']) == (2, 0, 0)
            outcome = {'pass': 2, 'fail': 0, 'skip': 0}
        retained.append({
            **{key: execution[key] for key in ('label', 'startedAt', 'finishedAt', 'exitCode', 'originalExecutionSha256')},
            'recordedProductBaseline': execution['productBaseline'], 'outcome': outcome,
            'report': report_reference, 'log': reference(execution['log']),
            'freshExecutionInThisPackage': False,
        })
    return {
        'previousProductBaseline': old['productBaseline'], 'currentProductBaseline': baseline,
        'previousSourceManifest': source_reference, 'previousExecutions': executions_reference,
        'backendFilesVerified': len(backend_paths), 'frontendLiveClientFilesVerified': len(client_paths),
        'verifiedSha256': {path: final[path] for path in sorted(relevant)},
        'relevantInputDifferences': changed, 'allFrontendChangesFromPreviousPackage': frontend_changes,
        'retainedExecutions': retained, 'backendCoverage': reference('backend-coverage.json'),
        'recordedEnvironment': reference('environment.json'),
        'note': 'Backend/PostgreSQL and live HTTPX/TypeScript results retain their original execution times. All backend source, tests, migration/config/dependency files and relevant TypeScript client/test/config/dependency hashes match. Changed frontend screens and browser tests are outside these retained suites; fresh browser API journeys are reported separately. No backend or live-client suite was rerun for this package.',
    }


def main():
    baseline = command('git', 'rev-parse', 'origin/dev')
    assert baseline == EXPECTED_BASELINE, f'Unexpected dev baseline: {baseline}'
    final = final_sources()
    differences = command(
        'git', 'diff', 'origin/dev', '--name-only', '--', 'frontend/app', 'frontend/src',
        'backend/app', 'backend/migrations', 'frontend/package.json', 'frontend/package-lock.json',
        'backend/pyproject.toml', 'backend/uv.lock', '.github/workflows',
    ).splitlines()
    assert not differences, f'Product/dependency/workflow overlay: {differences}'
    execution_sources = sorted(SRC.glob('*/execution.json'))
    labels = {path.parent.name for path in execution_sources}
    assert REQUIRED_RUNS <= labels, f'Wait for completed executions: {REQUIRED_RUNS - labels}'
    records = [json.loads(path.read_text()) for path in execution_sources]
    assert all('finishedAt' in record and 'exitCode' in record for record in records)
    for label in REQUIRED_RUNS:
        if label in {'frontend-lint', 'frontend-typecheck', 'web-build'} or label.startswith('quality-'):
            continue
        assert (SRC / label / 'results.json').is_file(), f'Missing results for {label}'
    retained = prepare_retained(final, baseline)
    # No output directory is touched until all required reports and retained-source
    # checks have passed. The caller controls when documentation edits are complete.
    package = Package()
    package.save('source-manifest.json', {
        'productBaseline': baseline, 'qaHeadBeforeFinalOverlay': command('git', 'rev-parse', 'HEAD'),
        'finalSourceSha256': final, 'productDependencyWorkflowDifferencesFromDev': differences,
        'note': 'QA overlay hashes identify actual final sources. Every execution records its applicable source scope; frontend-only runs do not claim backend coverage.',
    })
    executions = []
    for source, record in zip(execution_sources, records):
        original = record.pop('sourceSha256')
        label = record['label']
        assert all(in_scope(label, path) for path in original), f'Unexpected source scope: {label}'
        scoped_final = {path: digest for path, digest in final.items() if in_scope(label, path)}
        record['recordedSourceScope'] = scope_description(label)
        record['recordedSourceFileCount'] = len(original)
        record['sourceDifferenceFromFinal'] = {path: digest for path, digest in original.items() if final.get(path) != digest}
        record['finalFilesAbsentAtStart'] = sorted(scoped_final.keys() - original.keys())
        allowed_differences = (
            INITIAL_BROWSER_SOURCE_CHANGES if label in INITIAL_BROWSER_RUNS else
            {RESPONSIVE_SOURCE} if label in SECOND_FULL_BROWSER_RUNS | PRE_FOLLOWUP_QUALITY_RUNS else
            set()
        )
        assert set(record['sourceDifferenceFromFinal']) <= allowed_differences, (
            f'Unexpected source differences for {label}: {record["sourceDifferenceFromFinal"]}')
        assert not record['finalFilesAbsentAtStart'], (
            f'Final applicable files missing at start of {label}: {record["finalFilesAbsentAtStart"]}')
        assert not record['changedDuringRun'], f'Inputs changed during {label}: {record["changedDuringRun"]}'
        if label.startswith('browser-'):
            if label in INITIAL_BROWSER_RUNS:
                record['executionPhase'] = 'initial-full'
                record['phaseNote'] = (
                    'Initial complete browser execution retained with its original outcomes. '
                    'Responsive/navigation authoring corrections have separate subsequent executions.')
            elif label in SECOND_FULL_BROWSER_RUNS:
                record['executionPhase'] = 'second-full'
                record['phaseNote'] = (
                    'Second complete browser execution, before the final admin logout URL assertion correction. '
                    'Its original counts and failure remain unchanged. The later focused follow-up is not another full-suite run.')
            elif label in ADMIN_FOLLOWUP_RUNS:
                record['executionPhase'] = 'admin-focused-followup'
                record['phaseNote'] = (
                    'One admin navigation/logout case rerun after accepting the valid post-logout login URL. '
                    'This validates the corrected assertion only; it is not a fresh complete browser regression total.')
            else:
                raise AssertionError(f'Unclassified browser execution: {label}')
        elif label in PRE_FOLLOWUP_QUALITY_RUNS:
            record['executionPhase'] = 'quality-before-admin-followup'
            record['phaseNote'] = 'Quality checks before the final responsive admin logout URL assertion correction.'
        elif label in {'quality-lint-final', 'quality-typecheck-final'}:
            record['executionPhase'] = 'quality-after-admin-followup'
            record['phaseNote'] = 'Quality checks for the final sources including the corrected admin logout URL assertion.'
        record['sourceReference'] = 'source-manifest.json#finalSourceSha256'
        record['originalExecutionSha256'] = sha(source.read_bytes())
        record['log'] = 'logs/' + label + '.txt'
        package.copy_text(record['log'], source.parent / 'console.txt')
        executions.append(record)
    package.save('executions.json', executions)
    for source in sorted(SRC.glob('*/results.json')):
        if source.parent.name.startswith('browser-'):
            package.browser(source)
        else:
            package.jest(source)
    coverage = SRC / 'frontend-regression/coverage/coverage-summary.json'
    assert coverage.is_file()
    package.save('frontend-coverage.json', {
        source_name(key) if key != 'total' else key: value
        for key, value in json.loads(coverage.read_text()).items()
    }, coverage, 'Coverage totals/per-file metrics retained; absolute source paths made repository-relative.')
    package.save('retained-backend-evidence.json', retained)
    authoring = []
    for name, context in AUTHORING.items():
        source = TMP / (name + '.json')
        assert source.is_file(), f'Missing selected authoring result: {source}'
        report = json.loads(source.read_text())
        authoring.append({
            'name': name, **context,
            **{key: report[key] for key in ('startTime', 'numPassedTests', 'numFailedTests', 'numTotalTests')},
            'report': f'authoring/{name}.json', 'log': f'authoring/{name}.log',
            'note': 'Focused authoring/comparison evidence; not added to fresh full-suite totals.',
        })
        for suffix in ('json', 'log'):
            package.copy_text(f'authoring/{name}.{suffix}', TMP / f'{name}.{suffix}')
    package.save('authoring/index.json', {
        'executions': authoring,
        'selection': 'Explicit original-PR and main-overlay comparisons only. Unpublished scratch product-patch experiments are not included.',
    })
    for name in ('run.py', 'execute.py', 'browser.py', 'browser-final.py', 'browser-admin-followup.py', 'health.py', 'package.py'):
        package.copy_text(name, TMP / name)
    for name in ('report-health.json', 'remote-ci.json', 'merge-record.json',
                 'run-index-components.json', 'run-index-browser.json', 'run-index-browser-final.json',
                 'run-index-admin-followup.json', 'run-index-quality-final.json'):
        source = SRC / name
        if source.exists():
            package.save(name, json.loads(source.read_text()), source)
    package.save('environment.json', {
        'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'python': platform.python_version(), 'platform': platform.platform(),
        'node': command('node', '--version'), 'npm': command('npm', '--version'),
        'timezone': 'Australia/Melbourne',
        'browser': 'Chromium desktop and phone-viewport responsive Web, fresh Expo export; separate exclusively owned SQLite APIs.',
        'browserEnvironments': {item['label']: item['environment'] for item in executions if item['label'].startswith('browser-')},
        'frontend': 'Fresh shared/iOS/Android platform-preset component runs; not device execution.',
        'backend': 'Retained 20261017-meeting-area PostgreSQL and live-client evidence; see retained-backend-evidence.json.',
        'providers': 'Synthetic fixtures, stub payment and controlled email transport; no external provider acceptance claimed.',
    })
    if (OUT / 'README.md').exists():
        package.copy_text('README.md', OUT / 'README.md')
    extra = sorted(str(path.relative_to(OUT)) for path in OUT.rglob('*')
                   if path.is_file() and str(path.relative_to(OUT)) not in package.names | {'manifest.json'})
    assert not extra, f'Unexpected stale/unmanifested package files: {extra}'
    (OUT / 'manifest.json').write_text(json.dumps({
        'packagedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'files': package.files,
        'omitted': [
            'Regenerable browser HTML/trace archives and full raw Jest/Playwright reports.',
            'Full HTML/LCOV/per-line frontend coverage; per-file and total metrics retained.',
            'Old backend/live report copies: unchanged original files are linked and hash-verified instead.',
            'Screenshots for passed unchanged browser cases: original hashes/references remain in each browser report. All failures and meeting-area/responsive screenshots are included.',
        ],
        'omittedScreenshotCount': len(package.omitted_screenshots),
        'browserRunPolicy': (
            'Initial full, second full and focused admin follow-up runs are separate executions. '
            'Both complete-run outcomes remain unchanged, including the second-run admin URL assertion failure. '
            'The later one-case follow-ups validate corrected assertions against final sources. '
            'Do not combine complete and focused results into a new full-suite passing total.'
        ),
        'originalArtifacts': source_name(SRC),
        'note': 'Per-case outcomes, execution times, original-source/published hashes, diagnostic logs and selected screenshots retained. Publication normalization/redaction creates no new test execution.',
    }, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'files': len(package.files), 'bytes': sum(item['bytes'] for item in package.files),
                      'freshExecutions': len(executions), 'retainedExecutions': len(retained['retainedExecutions'])}))


if __name__ == '__main__':
    main()
