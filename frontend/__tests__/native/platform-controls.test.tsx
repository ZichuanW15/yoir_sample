/** Native preset component evidence, NOT emulator/device acceptance.
 * Real auth forms, providers and confirmation sheet; only HTTP, routing and
 * device layout/timing boundaries come from the shared screen harness.
 */
import { renderPublic } from '../public-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Login from '@/app/auth/login';
import Register from '@/app/auth/register';
import { useChrome } from '@/src/chrome';
import { resolvedPlatform } from './platform-resolution';

declare const __QA_NATIVE_PLATFORM__: 'ios' | 'android';

function ConfirmationDriver() {
  const { confirm } = useChrome();
  const [decision, setDecision] = useState('undecided');
  return (
    <View>
      <Text>{decision}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Request confirmation" onPress={() => {
        void confirm({
          title: 'Confirm action', message: 'Proceed with this action?',
          confirmLabel: 'Proceed', cancelLabel: 'Keep draft', destructive: true,
        }).then((accepted) => setDecision(accepted ? 'accepted' : 'cancelled'));
      }}><Text>Request confirmation</Text></Pressable>
    </View>
  );
}

describe('native platform controls (Jest component scope)', () => {
  test('the preset really selects this platform and its source extensions', async () => {
    expect(Platform.OS).toBe(__QA_NATIVE_PLATFORM__);
    expect(resolvedPlatform).toBe(__QA_NATIVE_PLATFORM__);
    expect(Platform.select({ ios: 'ios', android: 'android', default: 'not-native' })).toBe(__QA_NATIVE_PLATFORM__);
  });

  test.each([['login', Login], ['register', Register]] as const)(
    '%s preserves native keyboard configuration and secure password entry', async (_name, Screen) => {
      await renderPublic(<Screen />);
      // This proves configuration, not that a real keyboard never obscures UI.
      expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior)
        .toBe(__QA_NATIVE_PLATFORM__ === 'ios' ? 'padding' : undefined);
      expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
      expect(screen.getByLabelText('Email')).toHaveProp('keyboardType', 'email-address');
      expect(screen.getByLabelText('Email')).toHaveProp('autoCapitalize', 'none');
      expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
    },
  );

  test.each(['Keep draft', 'Cancel'])('confirmation cancellation via %s resolves false without accepting', async (label) => {
    await renderPublic(<ConfirmationDriver />);
    fireEvent.press(screen.getByRole('button', { name: 'Request confirmation' }));
    expect(screen.getByText('Proceed with this action?')).toBeOnTheScreen();
    expect(screen.getByText('undecided')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(screen.getByText('cancelled')).toBeOnTheScreen());
    expect(screen.queryByText('accepted')).toBeNull();
    expect(screen.queryByText('Confirm action')).toBeNull();
  });

  test('the real cross-platform confirmation sheet requires explicit acceptance', async () => {
    await renderPublic(<ConfirmationDriver />);
    fireEvent.press(screen.getByRole('button', { name: 'Request confirmation' }));
    expect(screen.getByText('undecided')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Proceed' }));
    await waitFor(() => expect(screen.getByText('accepted')).toBeOnTheScreen());
    expect(screen.queryByText('Confirm action')).toBeNull();
  });
});
