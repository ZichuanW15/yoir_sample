import { fireEvent, render, screen } from '@testing-library/react-native';
import { ErrorBanner } from '@/src/components/ui';
import { FloatingErrorProvider } from '@/src/floatingError';

describe('global floating errors', () => {
  test('moves a page-level error into the overlay and lets the user dismiss it', async () => {
    render(
      <FloatingErrorProvider>
        <ErrorBanner message="The service returned an unexpected response." />
      </FloatingErrorProvider>,
    );

    expect(await screen.findByText('The service returned an unexpected response.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(screen.queryByText('The service returned an unexpected response.')).toBeNull();
  });

  test('shows only the newest error instead of stacking messages', async () => {
    render(
      <FloatingErrorProvider>
        <ErrorBanner message="First error" />
        <ErrorBanner message="Latest error" />
      </FloatingErrorProvider>,
    );

    expect(await screen.findByText('Latest error')).toBeOnTheScreen();
    expect(screen.queryByText('First error')).toBeNull();
  });
});
