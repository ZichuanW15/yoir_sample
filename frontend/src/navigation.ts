import { Href, router } from 'expo-router';

/**
 * Go back, or go somewhere sensible when there is nowhere to go back to.
 *
 * On the web a screen is often the first entry in the history: someone opens a link
 * to /counsellor/profile, or reloads the page they were on. `router.back()` then has
 * no previous screen and the navigator reports an unhandled GO_BACK, leaving the
 * person stuck on a page whose back button does nothing.
 *
 * Each caller names the screen its back arrow means — the parent it would have
 * returned to had the journey started at the top — so the control always does
 * something, whether or not there is history behind it.
 */
export function goBack(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  // `replace`, not `push`: this stands in for a step backwards, so it should not
  // add another entry for the person to have to come back through.
  router.replace(fallback);
}
