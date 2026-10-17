# US-30 frontend: the professional profile saves itself

Issue: [US-30 #24](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/24). No Sprint 3
sub-issue; this changes the Sprint 2 screen documented in
[US-30 (Sprint 2)](../../sprint2/frontend/us30-professional-profile.md).

The Save profile button is gone. A short pause after any change sends the profile, and a status bar
where the button was says where it stands. Fields, validation rules and their messages are unchanged
from Sprint 2. It reached `dev` on 5 October 2026 in
[PR #232](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232) (commit `783bed8`).
The verification pill on this screen now uses the shared wording from
[US-32](us31-us32-linkedin-verification.md) and opens the Verification screen.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 47 and 48.

## Screens and flow

| Route | File | Change |
|---|---|---|
| `/counsellor/profile` | [`app/counsellor/profile.tsx`](../../../frontend/app/counsellor/profile.tsx) | Save button replaced by an autosave status bar. |

## Behaviour and states

- **When it saves:** 800 ms (`SAVE_AFTER_MS`) after the last change. Leaving the screen inside that
  pause still saves the last change.
- **Status bar** (`accessibilityLiveRegion="polite"`):

| State | Shows |
|---|---|
| Idle | Changes save automatically. |
| Saving | Spinner and "Saving…" |
| Saved | Your profile is saved and visible on your listings. |
| Not saved yet | The first validation message the draft fails, for example "Describe your professional background." Nothing is sent. |
| Could not save | The back-end error and a Try again link. Edits are kept. |

- **Last edit wins:** edits made while a save is in flight are sent next, in a loop, until what was
  sent matches what is on screen.
- **No overwrite after a failed load:** until the profile has been read, nothing is saved, so a blank
  form never replaces a profile that failed to load.
- **No reload over unsaved edits:** returning to the screen does not replace edits that have not been
  saved yet.
- **Undo to saved:** changing a field back to what the back end holds sends nothing and shows Saved.
- **LinkedIn field:** what was typed is left on screen; only the request carries the `https://` form.
- A "Profile privacy" button (added by the privacy work in `ce745fe`) sits on the same screen.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getOwnCounsellorProfile` | `GET /me/counsellor-profile` | Read on every focus. |
| `api.updateOwnCounsellorProfile` | `PATCH /me/counsellor-profile` | The same body as Sprint 2, now sent by the timer instead of a button. |

## Acceptance criteria

US-30's criteria are those in the Sprint 2 document. What this change adds:

| Behaviour | Evidence |
|---|---|
| Edits save without a button and reload from the back end | `counsellor-profile.test.tsx` "saves implemented profile fields by itself and reloads values from the mocked API response" |
| Leaving within the pause saves | "leaving the screen inside the pause still saves the last change" |
| A failed load is never saved over | "a profile that could not be loaded is never saved over" |
| Invalid drafts are held back with the reason | "requires an area for in-person default and saves it once corrected" |
| A rejected save keeps edits and offers retry | "an API-boundary rejection retains edits and offers a retry" |

## Tests

- [`__tests__/screens/counsellor-profile.test.tsx`](../../../frontend/__tests__/screens/counsellor-profile.test.tsx),
  21 tests, rewritten for autosave.
- The planned probe [`__tests__/planned/counsellor-validation-ux.test.tsx`](../../../frontend/__tests__/planned/counsellor-validation-ux.test.tsx)
  and two guards in [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts) that looked for the Save
  button now use an edit and the photo control instead.

Run from `frontend/`: `npx jest __tests__/screens/counsellor-profile.test.tsx`. Local run on `dev` at
`d3b7026`, 16 October 2026, Node 22.14.0: 21 passed.

## Known gaps

- Only the first failing rule is shown, as in Sprint 2.
- No device run checks a save fired as the app is backgrounded.
