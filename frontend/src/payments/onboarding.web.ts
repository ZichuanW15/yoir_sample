/**
 * Launching Stripe-hosted Connect onboarding in a browser.
 *
 * `WebBrowser.openAuthSessionAsync` is built around a native deep link closing a
 * system browser tab, which has no meaning here. The page navigates to Stripe
 * instead and Stripe navigates back, so onboarding is a round trip through the
 * address bar rather than a modal the caller awaits.
 */

export function onboardingReturnTo(): string {
  return `${window.location.origin}/counsellor/payouts`;
}

export async function openOnboarding(url: string): Promise<void> {
  // Never resolves in practice: the page is replaced before it could. `assign`
  // rather than `replace` so the browser Back button still works if Stripe is slow.
  window.location.assign(url);
  await new Promise<void>(() => {});
}
