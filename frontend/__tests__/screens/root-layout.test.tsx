import { autoHideCallsOnImport, fontsMock, nativeQaPlatform, RootLayout, routeRegistration, SplashScreen } from './root-layout-utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

describe('shared root layout startup (mocked component boundary, not browser/device acceptance)', () => {
  test('does not mount application screens while fonts are still loading', async () => {
    const result = render(<RootLayout />);
    expect(result.toJSON()).toBeNull();
    expect(routeRegistration).not.toHaveBeenCalled();
  });

  test('font readiness reveals the application with usable real authentication and chrome providers', async () => {
    const result = render(<RootLayout />);
    fontsMock.mockReturnValue([true, null]);
    result.rerender(<RootLayout />);
    expect(await screen.findByTestId('application-stack')).toBeOnTheScreen();
    expect(screen.getByText('Guest application')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Show startup notice' }));
    expect(screen.getByText('Application is ready')).toBeOnTheScreen();
  });

  test('a cached-font launch registers authentication and booking destinations', async () => {
    fontsMock.mockReturnValue([true, null]);
    render(<RootLayout />);
    await waitFor(() => expect(routeRegistration).toHaveBeenCalled());
    const registered = routeRegistration.mock.calls.map(([props]) => props);
    expect(registered).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'index' }),
      expect.objectContaining({ name: 'auth/login' }),
      expect.objectContaining({ name: 'auth/register' }),
      expect.objectContaining({ name: 'marketplace/index' }),
      expect.objectContaining({ name: 'counsellor/index' }),
      expect.objectContaining({ name: 'bookings/checkout' }),
      expect.objectContaining({ name: 'bookings/confirmation' }),
    ]));
  });
});

// Preserve native configuration checks, but never report them as Web or actual
// gesture/splash rendering evidence. The native presets resolve native modules.
if (nativeQaPlatform) {
  describe(`${nativeQaPlatform} startup configuration (mocked native boundaries)`, () => {
    beforeEach(() => { expect(Platform.OS).toBe(nativeQaPlatform); });

    test('holds the native splash while fonts are loading', async () => {
      render(<RootLayout />);
      expect(autoHideCallsOnImport).toBe(1);
      expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    });

    test('releases the native splash once fonts become ready', async () => {
      const result = render(<RootLayout />);
      fontsMock.mockReturnValue([true, null]);
      result.rerender(<RootLayout />);
      expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
      await screen.findByTestId('application-stack');
      result.rerender(<RootLayout />);
      expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    });

    test('registers confirmation with the native back gesture disabled', async () => {
      fontsMock.mockReturnValue([true, null]);
      render(<RootLayout />);
      await waitFor(() => expect(routeRegistration).toHaveBeenCalled());
      expect(routeRegistration.mock.calls.map(([props]) => props)).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'bookings/confirmation', options: { gestureEnabled: false } }),
      ]));
    });
  });
}
