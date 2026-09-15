import { fontsMock, RootLayout, SplashScreen } from '../screens/root-layout-utils';
import { render } from '@testing-library/react-native';

describe('root layout startup availability', () => {
  test('DEF-STARTUP-FONT: a font load error releases the splash and leaves a visible application or recovery screen', () => {
    const result = render(<RootLayout />);
    fontsMock.mockReturnValue([false, new Error('Font asset could not be loaded')]);
    result.rerender(<RootLayout />);
    // Avoid prescribing a particular fallback screen or font. A failed optional
    // asset must not leave a permanently blank root behind the native splash.
    expect({ visibleRoot: result.toJSON() !== null, splashReleased: jest.mocked(SplashScreen.hideAsync).mock.calls.length > 0 }).toEqual({
      visibleRoot: true, splashReleased: true,
    });
  });
});
