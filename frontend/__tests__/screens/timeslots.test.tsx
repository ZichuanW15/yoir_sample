import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import TimeSlotsScreen from '@/app/services/[serviceId]/timeslots';
import { counsellorSessionFixture, orderFixture, serviceFixture, sessionFixture, slotFixture } from '../fixtures';

const orderPath = '/orders';
const slotsPath = '/services/service-1/slots';
function available() {
  reply('GET', '/services/service-1', jsonResponse(serviceFixture));
  reply('GET', slotsPath, jsonResponse([slotFixture]));
}
const choose = () => fireEvent.press(screen.getByRole('radio', { name: /60 min$/ }));
const reserve = () => fireEvent.press(screen.getByRole('button', { name: 'Continue to payment' }));

describe('time-slot selection', () => {
  beforeEach(() => routeParams({ serviceId: serviceFixture.id }));

  test('[QA-118] a guest deep link returns to login before reading slots', async () => {
    await renderPublic(<TimeSlotsScreen />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith({ pathname: '/auth/login', params: { serviceId: 'service-1' } }));
    expect(callsTo('GET', slotsPath)).toHaveLength(0);
  });

  test('[QA-118] server-derived starts are selectable and payment requires a selection', async () => {
    available();
    reply('GET', slotsPath, jsonResponse([slotFixture]));
    await renderPublic(<TimeSlotsScreen />, sessionFixture);
    const slot = await screen.findByRole('radio', { name: /60 min$/ });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    fireEvent.press(slot);
    expect(slot).toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
  });

  test('[QA-118/121] selection reserves through the real client with identity and passes server order data', async () => {
    available();
    reply('GET', '/services/service-1', jsonResponse({ ...serviceFixture, modalities: ['online', 'in_person'], location: { state: 'VIC', cityOrRegion: 'Melbourne' } }));
    reply('POST', orderPath, jsonResponse({ ...orderFixture, amountMinor: 10500 }, 201));
    await renderPublic(<TimeSlotsScreen />, sessionFixture);
    await screen.findByRole('radio', { name: /60 min$/ });
    fireEvent.press(screen.getByRole('radio', { name: 'In person' }));
    expect(screen.getByText('Meeting area: Melbourne, VIC')).toBeOnTheScreen();
    choose();
    reserve();
    await tick();
    const [, init] = callsTo('POST', orderPath)[0];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-access-token' });
    expect(JSON.parse(init?.body as string)).toEqual({ serviceId: 'service-1', startsAt: slotFixture.startsAt, modality: 'in_person', timezone: expect.any(String) });
    expect(navigation.push).toHaveBeenCalledWith({
      pathname: '/bookings/checkout', params: { orderId: 'order-1', serviceId: 'service-1', modality: 'in_person', amountMinor: '10500', startsAt: slotFixture.startsAt, endsAt: slotFixture.endsAt, holdExpiresAt: '' },
    });
  });

  test('[QA-121] a reservation conflict refreshes availability, clears selection and keeps the reason', async () => {
    available();
    reply('POST', orderPath, apiFailure('SLOT_UNAVAILABLE', 'That time was just reserved.', 409, { startsAt: 'Choose another available slot.' }));
    await renderPublic(<TimeSlotsScreen />, sessionFixture);
    await screen.findByRole('radio', { name: /60 min$/ });
    choose();
    reply('GET', slotsPath, jsonResponse([]));
    reserve();
    await tick();
    expect(screen.getByText('That time was just reserved. Choose another available slot.')).toBeOnTheScreen();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    expect(callsTo('GET', slotsPath)).toHaveLength(3);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  test('[QA-121] double press while the reservation is pending sends one order', async () => {
    available();
    const pending = deferred<Response>();
    reply('POST', orderPath, pending.promise);
    await renderPublic(<TimeSlotsScreen />, sessionFixture);
    await screen.findByRole('radio', { name: /60 min$/ });
    choose();
    reserve();
    expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    reserve();
    expect(callsTo('POST', orderPath)).toHaveLength(1);
    await act(async () => pending.resolve(jsonResponse(orderFixture, 201)));
    await tick();
    expect(navigation.push).toHaveBeenCalledTimes(1);
  });

  test('[QA-118] connection failures are displayed without enabling an unselected booking', async () => {
    available();
    reply('GET', slotsPath, new TypeError('offline'));
    await renderPublic(<TimeSlotsScreen />, sessionFixture);
    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  });

  test('[QA-100/121] a server role rejection cannot advance to checkout', async () => {
    available();
    reply('POST', orderPath, apiFailure('FORBIDDEN', 'Only Job Seekers can book services.', 403));
    await renderPublic(<TimeSlotsScreen />, counsellorSessionFixture);
    await screen.findByRole('radio', { name: /60 min$/ });
    choose();
    reserve();
    await tick();
    expect(screen.getByText('Only Job Seekers can book services.')).toBeOnTheScreen();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
