import { render } from '@testing-library/react-native';
import Index from '@/app/index';
import RootLayout from '@/app/_layout';

const mockRedirect = jest.fn();
const mockStack = jest.fn();
const mockStackScreen = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: (props: unknown) => {
    mockRedirect(props);
    return null;
  },
  Stack: Object.assign(
    ({ children }: { children: React.ReactNode }) => {
      mockStack();
      return children;
    },
    {
      Screen: (props: unknown) => {
        mockStackScreen(props);
        return null;
      },
    },
  ),
}));

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('application navigation', () => {
  test('redirects the root route to the marketplace', () => {
    render(<Index />);

    expect(mockRedirect).toHaveBeenCalledWith({ href: '/marketplace' });
  });

  test('registers the executable booking routes and prevents confirmation back navigation', () => {
    render(<RootLayout />);

    const routes = mockStackScreen.mock.calls.map(([props]) => props as {
      name: string;
      options: Record<string, unknown>;
    });
    expect(routes.map(({ name }) => name)).toEqual([
      'index',
      'marketplace/index',
      'services/[serviceId]',
      'services/[serviceId]/timeslots',
      'bookings/confirmation',
      'auth/login',
      'auth/register',
    ]);
    expect(routes.find(({ name }) => name === 'services/[serviceId]/timeslots')).toMatchObject({
      options: { title: 'Choose a time' },
    });
    expect(routes.find(({ name }) => name === 'bookings/confirmation')).toMatchObject({
      options: { title: 'Payment confirmation', headerBackVisible: false },
    });
    expect(mockStack).toHaveBeenCalledTimes(1);
  });
});
