import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import CheckoutScreen from '@/app/bookings/checkout';
import { confirmationFixture, orderFixture, serviceFixture, sessionFixture, slotFixture } from '../fixtures';

const paymentPath = '/orders/order-1/payments/stub';
const pay = () => fireEvent.press(screen.getByRole('button', { name: 'Pay $95' }));

function checkoutParams() {
  return { orderId: orderFixture.id, serviceId: serviceFixture.id, modality: 'online', amountMinor: '9500', startsAt: slotFixture.startsAt, endsAt: slotFixture.endsAt };
}

describe('checkout screen', () => {
  beforeEach(() => {
    routeParams(checkoutParams());
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
  });

  test('[QA-124] shows the selected order, session details and explicit test-mode payment', async () => {
    await renderPublic(<CheckoutScreen />, sessionFixture);
    await screen.findByText(serviceFixture.title);
    expect(screen.getByText('Test-mode payment')).toBeOnTheScreen();
    expect(screen.getByText('Yoir test payment')).toBeOnTheScreen();
    expect(screen.getByText('order-1')).toBeOnTheScreen();
    expect(screen.getByText('Online')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/card number/i)).toBeNull();
    expect(callsTo('POST', paymentPath)).toHaveLength(0);
  });

  test('[QA-124/127] successful payment submits the held order token and replaces checkout with confirmation', async () => {
    reply('POST', paymentPath, jsonResponse(confirmationFixture));
    await renderPublic(<CheckoutScreen />, sessionFixture);
    await screen.findByText(serviceFixture.title);
    pay();
    await tick();
    expect(callsTo('POST', paymentPath)[0][1]?.headers).toMatchObject({ Authorization: 'Bearer test-access-token' });
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: '/bookings/confirmation', params: { bookingId: 'booking-1', paymentId: 'stub-payment-1', serviceId: 'service-1', modality: 'online', startsAt: slotFixture.startsAt, endsAt: slotFixture.endsAt, amountMinor: '9500', pending: '' },
    });
    expect(callsTo('POST', '/orders')).toHaveLength(0);
  });

  test('[QA-124] duplicate pay presses while pending send only one payment request', async () => {
    const pending = deferred<Response>();
    reply('POST', paymentPath, pending.promise);
    await renderPublic(<CheckoutScreen />, sessionFixture);
    await screen.findByText(serviceFixture.title);
    pay();
    expect(screen.getByRole('button', { name: 'Pay $95' })).toBeDisabled();
    pay();
    expect(callsTo('POST', paymentPath)).toHaveLength(1);
    await act(async () => pending.resolve(jsonResponse(confirmationFixture)));
    await tick();
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  test('[QA-124] a failed payment remains on checkout and retry uses the same order', async () => {
    reply('POST', paymentPath, apiFailure('PAYMENT_FAILED', 'The test payment could not be completed.', 402));
    await renderPublic(<CheckoutScreen />, sessionFixture);
    await screen.findByText(serviceFixture.title);
    pay();
    await tick();
    expect(screen.getByText('The test payment could not be completed.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pay $95' })).toBeEnabled();
    expect(navigation.replace).not.toHaveBeenCalled();
    reply('POST', paymentPath, jsonResponse(confirmationFixture));
    pay();
    await tick();
    expect(callsTo('POST', paymentPath)).toHaveLength(2);
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  test('[QA-124] a network failure shows recovery guidance without displaying success', async () => {
    reply('POST', paymentPath, new TypeError('offline'));
    await renderPublic(<CheckoutScreen />, sessionFixture);
    await screen.findByText(serviceFixture.title);
    pay();
    await tick();
    expect(screen.getByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test('[QA-124] an unauthenticated checkout cannot send a payment', async () => {
    await renderPublic(<CheckoutScreen />);
    await screen.findByText(serviceFixture.title);
    pay();
    expect(callsTo('POST', paymentPath)).toHaveLength(0);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test('[QA-127] in-person checkout shows the meeting area and supports returning to the previous screen', async () => {
    routeParams({ ...checkoutParams(), modality: 'in_person' });
    reply('GET', '/services/service-1', jsonResponse({ ...serviceFixture, modalities: ['in_person'], location: { state: 'VIC', cityOrRegion: 'Melbourne' } }));
    await renderPublic(<CheckoutScreen />, sessionFixture);
    expect(await screen.findByText('Melbourne, VIC')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });
});
