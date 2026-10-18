import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// The same isolated API and real Web export, at a phone viewport in Chromium.
// This provides responsive Web evidence; it is not a native-device execution.
export default defineConfig({
  ...base,
  projects: [{
    name: 'chromium-mobile-web',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    },
  }],
});
