import { CounsellorProfile, VerificationStatus } from '@/src/api/types';
import { Glyph } from '@/src/components/Glyph';
import { Tag } from '@/src/components/ui';
import { colors } from '@/src/theme';

/**
 * US-32 — one vocabulary for verification, so a Career Professional and the
 * Platform Owner read the same words on every screen that shows it.
 */

/** `unsubmitted` is a pending account that has given the Platform Owner nothing to review. */
export type VerificationState = VerificationStatus | 'unsubmitted';

export function verificationState(
  profile: Pick<CounsellorProfile, 'linkedinUrl' | 'verificationStatus'>,
): VerificationState {
  return profile.verificationStatus === 'pending' && !profile.linkedinUrl ? 'unsubmitted' : profile.verificationStatus;
}

export const verificationCopy: Record<VerificationState, { label: string; word: string; body: string; bg: string; fg: string }> = {
  unsubmitted: {
    label: 'Verification pending', word: 'Pending',
    body: 'Add your LinkedIn profile URL so the Platform Owner can verify you.',
    bg: colors.yellowTint, fg: colors.amberInk,
  },
  pending: {
    label: 'Verification pending', word: 'Pending',
    body: 'Your LinkedIn profile is with the Platform Owner for review.',
    bg: colors.yellowTint, fg: colors.amberInk,
  },
  verified: {
    label: 'Verified Career Professional', word: 'Verified',
    body: 'Your profile carries the verified mark across Yoir.',
    bg: colors.greenTint, fg: colors.greenDeep,
  },
  rejected: {
    label: 'Verification rejected', word: 'Rejected',
    body: 'The Platform Owner could not verify you from this profile. The reason was emailed to you.',
    bg: colors.dangerBg, fg: colors.dangerInk,
  },
};

/** What to say before the status is known. Never a guess at the status itself. */
export const unknownVerification = (failed: boolean) => (failed ? 'Status unavailable' : 'Checking status');

/**
 * The status pill. `state` is undefined while it is being read and null when it
 * could not be: neither shows a status. `short` is the one-word form for lists.
 */
export function VerificationTag({ state, short }: { state: VerificationState | null | undefined; short?: boolean }) {
  if (!state) return <Tag label={unknownVerification(state === null)} />;
  const copy = verificationCopy[state];
  return (
    <Tag
      label={short ? copy.word : copy.label}
      bg={copy.bg}
      fg={copy.fg}
      icon={state === 'verified' ? <Glyph name="shieldCheck" size={13} color={copy.fg} /> : undefined}
    />
  );
}

/**
 * US-31 — the Platform Owner verifies a Career Professional from their LinkedIn
 * profile. Anything whose host is linkedin.com (or a subdomain of it) is accepted,
 * typed with or without the scheme, and normalised to a full https:// URL.
 */
export function normaliseLinkedIn(raw: string): string | null {
  const match = /^(?:https?:\/\/)?([^/?#\s]+)([/?#]\S*)?$/i.exec(raw.trim());
  if (!match) return null;
  const host = match[1].toLowerCase().replace(/\.$/, '');
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;
  return `https://${host}${match[2] ?? ''}`;
}
