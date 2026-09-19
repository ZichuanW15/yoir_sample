import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const port = Number(process.env.WEB_QA_PORT ?? 43117);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid WEB_QA_PORT');
const baseURL = `http://127.0.0.1:${port}`;
const output = path.resolve(process.env.WEB_QA_OUTPUT_DIR ?? 'test-results/web');
const python = process.env.YOIR_QA_PYTHON ?? path.resolve('../backend/.venv/bin/python');

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  // Pending product policies and unimplemented acceptance proposals are kept as
  // reference material; they do not contribute to this implemented-feature run.
  testIgnore: ['**/planned/**'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30000,
  expect: { timeout: 5000 },
  outputDir: path.join(output, 'attachments'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(output, 'results.json') }],
    ['html', { outputFolder: path.join(output, 'html'), open: 'never' }],
  ],
  use: {
    baseURL,
    timezoneId: 'Australia/Melbourne',
    locale: 'en-AU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium-web', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${JSON.stringify(python)} e2e/serve.py`,
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 60000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    env: { WEB_QA_PORT: String(port) },
  },
});
