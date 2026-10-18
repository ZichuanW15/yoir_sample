import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Component tests observe React Native accessibilityState. This independent
// exported-Web check verifies that the selected state reaches browser ARIA.
// It is an advisory defect assertion; no missing integration is mocked as present.
test('DEF-DIAGNOSIS-WEB-CHECKED: a selected diagnosis radio exposes its checked state @defect', async ({ page, request }, info) => {
  const email = `sprint3-accessibility-${randomUUID()}@example.com`;
  const password = 'sprint3-accessibility-password';
  const registered = await request.post('/api/v1/auth/users', { data: {
    name: 'Diagnosis accessibility QA', email, password, passwordConfirmation: password, role: 'job_seeker',
  } });
  expect(registered.status()).toBe(201);
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const signedIn = page.waitForResponse(response => response.url().endsWith('/auth/sessions')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  expect((await signedIn).status()).toBe(200);
  await expect(page).toHaveURL(/\/job-seeker\/diagnosis/);

  const option = page.getByRole('radio', { name: 'Something else', exact: true });
  await option.click();
  // Establish that the choice really changed before checking its accessible state.
  await expect(page.getByLabel('Tell us a little more (optional)', { exact: true })).toBeVisible();
  await info.attach('diagnosis-radio-state', {
    body: JSON.stringify({
      option: 'Something else',
      role: await option.getAttribute('role'),
      ariaChecked: await option.getAttribute('aria-checked'),
      ariaSelected: await option.getAttribute('aria-selected'),
      optionalFieldVisible: true,
    }, null, 2),
    contentType: 'application/json',
  });
  await info.attach('diagnosis-selected-option', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
  await expect(option).toHaveAttribute('aria-checked', 'true');
});
