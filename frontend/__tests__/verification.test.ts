import { normaliseLinkedIn, verificationCopy, verificationState } from '@/src/verification';

describe('verification vocabulary — US-31, US-32', () => {
  test('a LinkedIn address is accepted with or without its scheme, and nothing else is', () => {
    expect(normaliseLinkedIn(' WWW.LinkedIn.COM/in/maya ')).toBe('https://www.linkedin.com/in/maya');
    expect(normaliseLinkedIn('https://au.linkedin.com/in/maya')).toBe('https://au.linkedin.com/in/maya');
    for (const wrong of ['', 'maya chen', 'https://notlinkedin.com/in/maya', 'linkedin.com.example.io/in/maya']) {
      expect(normaliseLinkedIn(wrong)).toBeNull();
    }
  });

  test('pending with nothing sent is told apart from pending in review, in the same words', () => {
    expect(verificationState({ verificationStatus: 'pending', linkedinUrl: '' })).toBe('unsubmitted');
    expect(verificationState({ verificationStatus: 'pending', linkedinUrl: 'https://linkedin.com/in/m' })).toBe('pending');
    expect(verificationState({ verificationStatus: 'rejected', linkedinUrl: '' })).toBe('rejected');
    expect(verificationCopy.unsubmitted.label).toBe(verificationCopy.pending.label);
    expect(verificationCopy.unsubmitted.body).not.toBe(verificationCopy.pending.body);
  });
});
