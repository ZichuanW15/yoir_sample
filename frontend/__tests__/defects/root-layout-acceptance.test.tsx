import { fontsMock, nativeQaPlatform, RootLayout, SplashScreen } from '../screens/root-layout-utils';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

describe('shared font-error recovery (mocked component risk, not browser/device white-screen proof)', () => {
  test('DEF-STARTUP-FONT: a font error leaves a rendered application or recovery tree', () => {
    const result = render(<RootLayout />);
    fontsMock.mockReturnValue([false, new Error('Font asset could not be loaded')]);
    result.rerender(<RootLayout />);
    // Avoid prescribing a particular fallback screen or font. A failed optional
    // asset must not suppress the entire shared tree. Real DOM visibility and
    // device splash behaviour require separate browser/device validation.
    expect(result.toJSON()).not.toBeNull();
  });
});

if (nativeQaPlatform) {
  describe(`${nativeQaPlatform} font-error splash recovery (mocked native boundary)`, () => {
    test('DEF-STARTUP-FONT: a font error releases the native splash for recovery', () => {
      expect(Platform.OS).toBe(nativeQaPlatform);
      const result = render(<RootLayout />);
      fontsMock.mockReturnValue([false, new Error('Font asset could not be loaded')]);
      result.rerender(<RootLayout />);
      expect(SplashScreen.hideAsync).toHaveBeenCalled();
    });
  });
}
