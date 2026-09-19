import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

/**
 * Launching Stripe-hosted Connect onboarding on a device.
 *
 * The hosted flow runs outside the app, so where Stripe returns the counsellor to
 * has to be stated rather than assumed — a browser cannot follow a `yoir://` link
 * and a device cannot usefully land on the web build. `returnTo` is sent to the
 * backend, which honours it only for our own scheme or an origin it serves.
 */

/** Where this platform wants the counsellor back. */
export function onboardingReturnTo(): string {
  return Linking.createURL('/counsellor/payouts');
}

/**
 * Opens onboarding and resolves once the counsellor comes back. An auth session
 * keeps them inside the app and closes itself on the return deep link, so the
 * caller can immediately re-read payout status.
 */
export async function openOnboarding(url: string): Promise<void> {
  await WebBrowser.openAuthSessionAsync(url, onboardingReturnTo());
}
