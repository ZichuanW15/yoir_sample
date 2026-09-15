/** Product failures stay ordinary failing correctness tests, outside the normal regression suite. */
import { jsonResponse, navigation, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import ConfirmationScreen from '@/app/bookings/confirmation';
import CheckoutScreen from '@/app/bookings/checkout';
import { confirmationFixture, serviceFixture, sessionFixture, slotFixture } from '../fixtures';

describe('known booking confirmation acceptance gaps', () => {
  test('[QA-127][DEF-CONFIRM-UNVERIFIED] a direct confirmation URL without a receipt cannot claim payment success', async () => {
    routeParams({ serviceId: serviceFixture.id, startsAt: slotFixture.startsAt, endsAt: slotFixture.endsAt, modality: 'online', amountMinor: '9500' });
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
    renderPublic(<ConfirmationScreen />);
    await screen.findByText(serviceFixture.title);
    expect(screen.queryByText("You're booked")).toBeNull();
    expect(screen.queryByText(/Payment successful/)).toBeNull();
  });

  test('[QA-127][DEF-CONFIRM-RECEIPT] confirmation uses the server-confirmed booking time and modality', async () => {
    routeParams({ orderId: 'order-1', slotId: 'slot-1', serviceId: serviceFixture.id, startsAt: slotFixture.startsAt, endsAt: slotFixture.endsAt, modality: 'online', amountMinor: '9500' });
    const receipt = { ...confirmationFixture, booking: { ...confirmationFixture.booking, startsAt: '2026-09-02T02:00:00Z', endsAt: '2026-09-02T03:00:00Z', modality: 'in_person' } };
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
    reply('POST', '/orders/order-1/payments/stub', jsonResponse(receipt));
    renderPublic(<CheckoutScreen />, sessionFixture);
    await screen.findByText(serviceFixture.title);
    fireEvent.press(screen.getByRole('button', { name: 'Pay $95' }));
    await tick();
    expect(navigation.replace).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ startsAt: receipt.booking.startsAt, endsAt: receipt.booking.endsAt, modality: receipt.booking.modality }) }));
  });
});
