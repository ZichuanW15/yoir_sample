import { jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import ConfirmationScreen from '@/app/bookings/confirmation';
import { confirmationFixture, serviceFixture } from '../fixtures';

function receiptParams(modality = 'online') {
  return { bookingId: confirmationFixture.booking.id, paymentId: confirmationFixture.paymentId, serviceId: serviceFixture.id, modality, startsAt: confirmationFixture.booking.startsAt, endsAt: confirmationFixture.booking.endsAt, amountMinor: '9500' };
}

// Layout/legacy-route characterization, not US68 acceptance. Correct authority
// assertions live in defects/public-acceptance and the forged-URL browser test.
describe('confirmation route rendering characterization (not authoritative receipt acceptance)', () => {
  beforeEach(() => {
    routeParams(receiptParams());
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
  });

  test('[characterization] renders route-provided confirmation references and stub disclosure', async () => {
    renderPublic(<ConfirmationScreen />);
    await screen.findByText(serviceFixture.title);
    expect(screen.getByText("You're booked")).toBeOnTheScreen();
    expect(screen.getByText('booking-1')).toBeOnTheScreen();
    expect(screen.getByText('stub-payment-1')).toBeOnTheScreen();
    expect(screen.getByText('$95 · Paid')).toBeOnTheScreen();
    expect(screen.getByText(/No real money was charged/)).toBeOnTheScreen();
    expect(screen.getByText('Confirmed')).toBeOnTheScreen();
  });

  test('[characterization] an in-person route includes the meeting area', async () => {
    routeParams(receiptParams('in_person'));
    reply('GET', '/services/service-1', jsonResponse({ ...serviceFixture, location: { state: 'VIC', cityOrRegion: 'Melbourne' } }));
    renderPublic(<ConfirmationScreen />);
    expect(await screen.findByText(/In person · Melbourne, VIC/)).toBeOnTheScreen();
  });

  test('[characterization] unavailable service copy retains route references', async () => {
    reply('GET', '/services/service-1', new TypeError('offline'));
    renderPublic(<ConfirmationScreen />);
    expect(await screen.findByText('booking-1')).toBeOnTheScreen();
    expect(screen.getByText('stub-payment-1')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Back to Marketplace' }));
    expect(navigation.push).toHaveBeenCalledWith('/marketplace');
  });

  test('[QA-127] leaving confirmation clears an existing booking stack before browsing', async () => {
    navigation.canDismiss.mockReturnValue(true);
    renderPublic(<ConfirmationScreen />);
    await screen.findByText(serviceFixture.title);
    fireEvent.press(screen.getByRole('button', { name: 'Back to Marketplace' }));
    expect(navigation.dismissAll).toHaveBeenCalledTimes(1);
    expect(navigation.push).toHaveBeenCalledWith('/marketplace');
    expect(navigation.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(navigation.push.mock.invocationCallOrder[0]);
  });
});
