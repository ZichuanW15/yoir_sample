import { apiMock, renderCounsellor, setupCounsellorMocks } from './counsellor-screen-utils';
import { act, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import Onboarding from '@/app/counsellor/onboarding';

// Real mounted screen/provider; the router focus and API response are controlled.
const focused = new Map<() => void | (() => void), void | (() => void)>();
beforeEach(() => {
  setupCounsellorMocks();
  focused.clear();
  jest.spyOn(jest.requireMock<typeof import('expo-router')>('expo-router'), 'useFocusEffect').mockImplementation((callback) => {
    useEffect(() => {
      focused.set(callback, callback());
      return () => { focused.get(callback)?.(); focused.delete(callback); };
    }, [callback]);
  });
});

async function focusAgain() {
  await act(async () => {
    for (const [callback, dispose] of focused) { dispose?.(); focused.set(callback, callback()); }
  });
}

test('[QA-180] returning from each setup step refreshes the same mounted onboarding screen and opens the workspace only after both are confirmed', async () => {
  apiMock.getOnboardingState.mockResolvedValue({ profileComplete: false, verificationSubmitted: false, complete: false });
  await renderCounsellor(<Onboarding />);
  expect(await screen.findByLabelText('Professional profile, not done')).toBeOnTheScreen();
  expect(screen.getByLabelText('Verification submission, not done')).toBeOnTheScreen();

  apiMock.getOnboardingState.mockResolvedValue({ profileComplete: false, verificationSubmitted: true, complete: false });
  await focusAgain();
  expect(await screen.findByLabelText('Verification submission, done')).toBeOnTheScreen();
  expect(screen.getByText('Sent — your LinkedIn profile is with the Platform Owner.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Professional profile, not done')).toBeOnTheScreen();
  expect(screen.queryByTestId('redirect')).toBeNull();

  apiMock.getOnboardingState.mockResolvedValue({ profileComplete: true, verificationSubmitted: true, complete: true });
  await focusAgain();
  expect(await screen.findByTestId('redirect')).toHaveTextContent('/counsellor');
  expect(screen.queryByText('Finish setting up your workspace')).toBeNull();
  expect(apiMock.getOnboardingState).toHaveBeenCalledTimes(3);
  expect(apiMock.login).toHaveBeenCalledTimes(1);
});
