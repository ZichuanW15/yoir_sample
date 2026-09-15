import { autoHideCallsOnImport, fontsMock, RootLayout, routeRegistration, SplashScreen } from './root-layout-utils';
import { fireEvent, render, screen } from '@testing-library/react-native';

describe('root layout startup', () => {
  test('holds the native splash and does not mount application screens while fonts load', () => {
    const result = render(<RootLayout />);
    expect(autoHideCallsOnImport).toBe(1);
    expect(result.toJSON()).toBeNull();
    expect(routeRegistration).not.toHaveBeenCalled();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  test('font readiness reveals the application with usable real authentication and chrome providers', () => {
    const result = render(<RootLayout />);
    fontsMock.mockReturnValue([true, null]);
    result.rerender(<RootLayout />);
    expect(screen.getByTestId('application-stack')).toBeOnTheScreen();
    expect(screen.getByText('Guest application')).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: 'Show startup notice' }));
    expect(screen.getByText('Application is ready')).toBeOnTheScreen();
    result.rerender(<RootLayout />);
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  test('a cached-font launch registers authentication and booking destinations and disables the confirmation back gesture', () => {
    fontsMock.mockReturnValue([true, null]);
    render(<RootLayout />);
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    const registered = routeRegistration.mock.calls.map(([props]) => props);
    expect(registered).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'index' }),
      expect.objectContaining({ name: 'auth/login' }),
      expect.objectContaining({ name: 'auth/register' }),
      expect.objectContaining({ name: 'marketplace/index' }),
      expect.objectContaining({ name: 'counsellor/index' }),
      expect.objectContaining({ name: 'bookings/checkout' }),
      expect.objectContaining({ name: 'bookings/confirmation', options: { gestureEnabled: false } }),
    ]));
  });
});
