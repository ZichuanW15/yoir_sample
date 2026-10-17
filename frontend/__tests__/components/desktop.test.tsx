import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useDesktop } from '@/src/desktop';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dimensions = require('react-native/Libraries/Utilities/useWindowDimensions').default as jest.Mock;

const at = (width: number) => dimensions.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

/**
 * The desktop layout is a browser at desktop width and nothing else. The phone apps
 * and phone browsers must never take it, or the mobile layout stops being the one
 * the mobile tests describe.
 */
describe('desktop layout switch', () => {
  test('a native app never takes the desktop layout, however wide', () => {
    expect(Platform.OS).not.toBe('web');
    at(1440);
    expect(renderHook(() => useDesktop()).result.current).toBe(false);
  });

  test.each([
    [390, false],
    [1023, false],
    [1024, true],
    [1440, true],
  ])('a browser %ipx wide takes the desktop layout: %s', (width, expected) => {
    jest.replaceProperty(Platform, 'OS', 'web');
    at(width);
    expect(renderHook(() => useDesktop()).result.current).toBe(expected);
  });
});
