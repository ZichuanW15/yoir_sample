import { fireEvent, screen } from '@testing-library/react-native';
import { apiFailure, callsTo, jsonResponse, navigation, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import RescheduleBookingScreen from '@/app/bookings/[bookingId]/reschedule';
import BookingDetailScreen from '@/app/bookings/[bookingId]/index';
import { Booking } from '@/src/api/types';
import { counsellorSessionFixture, sessionFixture } from '../fixtures';

/** Always ahead of "now", whenever the suite actually runs. */
const future = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();

const upcomingBooking: Booking = {
  id: 'booking-1', orderId: 'order-1', serviceId: 'service-1',
  serviceTitle: 'Interview confidence coaching',
  startsAt: future(24), endsAt: future(25),
  timezone: 'Australia/Melbourne', modality: 'online',
  status: 'confirmed', paymentStatus: 'paid',
  counterpartyName: 'Maya Chen', counterpartyRole: 'counsellor',
};

const openSlot = { startsAt: future(48), endsAt: future(49) };

const bookingPath = (id: string) => `/bookings/${id}`;
const slotsPath = (id: string) => `/services/${id}/slots`;
const reschedulePath = (id: string) => `/bookings/${id}/reschedule`;

function available(booking: Booking = upcomingBooking) {
  reply('GET', bookingPath(booking.id), jsonResponse(booking));
  reply('GET', slotsPath(booking.serviceId), jsonResponse([openSlot]));
}

const choose = () => fireEvent.press(screen.getByRole('radio', { name: /60 min$/ }));
const confirm = () => fireEvent.press(screen.getByRole('button', { name: 'Confirm new time' }));

describe('reschedule a booking — US-69', () => {
  beforeEach(() => routeParams({ bookingId: upcomingBooking.id }));

  test('AT-US-69-1: the Job Seeker picks an open slot and the booking moves, keeping the same reference', async () => {
    available();
    reply('POST', reschedulePath(upcomingBooking.id), jsonResponse({ ...upcomingBooking, startsAt: openSlot.startsAt, endsAt: openSlot.endsAt }));
    await renderPublic(<RescheduleBookingScreen />, sessionFixture);
    const slot = await screen.findByRole('radio', { name: /60 min$/ });
    expect(screen.getByRole('button', { name: 'Confirm new time' })).toBeDisabled();

    fireEvent.press(slot);
    expect(slot).toBeChecked();
    expect(screen.getByRole('button', { name: 'Confirm new time' })).toBeEnabled();
    confirm();
    await tick();

    const [, init] = callsTo('POST', reschedulePath(upcomingBooking.id))[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      startsAt: openSlot.startsAt, modality: 'online', timezone: expect.any(String),
    });
    expect(navigation.replace).toHaveBeenCalledWith({ pathname: '/bookings/[bookingId]', params: { bookingId: 'booking-1' } });
  });

  test('the counsellor delivering the session can reschedule it too', async () => {
    available();
    reply('POST', reschedulePath(upcomingBooking.id), jsonResponse(upcomingBooking));
    await renderPublic(<RescheduleBookingScreen />, counsellorSessionFixture);
    choose();
    confirm();
    await tick();
    expect(callsTo('POST', reschedulePath(upcomingBooking.id))).toHaveLength(1);
  });

  test('AT-US-69-2: a slot taken out from under the request is rejected, the move is not shown as done, and the original is reloaded', async () => {
    available();
    reply('POST', reschedulePath(upcomingBooking.id), apiFailure('SLOT_UNAVAILABLE', 'This time is no longer available.', 409));
    await renderPublic(<RescheduleBookingScreen />, sessionFixture);
    await screen.findByRole('radio', { name: /60 min$/ });
    choose();
    reply('GET', slotsPath(upcomingBooking.serviceId), jsonResponse([]));
    confirm();
    await tick();

    expect(screen.getByText('This time is no longer available.')).toBeOnTheScreen();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Confirm new time' })).toBeDisabled();
    // Availability was re-read, not assumed, after the failed attempt.
    expect(callsTo('GET', slotsPath(upcomingBooking.serviceId)).length).toBeGreaterThan(1);
  });

  test('AT-US-69-3: a cancelled booking cannot be rescheduled and no slot picker is offered', async () => {
    const cancelled: Booking = { ...upcomingBooking, status: 'cancelled' };
    routeParams({ bookingId: cancelled.id });
    reply('GET', bookingPath(cancelled.id), jsonResponse(cancelled));
    await renderPublic(<RescheduleBookingScreen />, sessionFixture);

    expect(await screen.findByText("This session can't be rescheduled")).toBeOnTheScreen();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(callsTo('GET', slotsPath(cancelled.serviceId))).toHaveLength(0);
  });

  test('AT-US-69-3: a past booking cannot be rescheduled', async () => {
    const past: Booking = { ...upcomingBooking, startsAt: future(-48), endsAt: future(-47) };
    routeParams({ bookingId: past.id });
    reply('GET', bookingPath(past.id), jsonResponse(past));
    await renderPublic(<RescheduleBookingScreen />, sessionFixture);

    expect(await screen.findByText("This session can't be rescheduled")).toBeOnTheScreen();
  });

  test('AT-US-69-3: a non-participant is rejected by the backend and sees no picker', async () => {
    reply('GET', bookingPath(upcomingBooking.id), apiFailure('NOT_FOUND', 'Booking not found.', 404));
    await renderPublic(<RescheduleBookingScreen />, sessionFixture);

    expect(await screen.findByText('Booking not found.')).toBeOnTheScreen();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('the Reschedule action on booking detail', () => {
  test('an upcoming confirmed booking offers Reschedule, which opens the picker for that booking', async () => {
    routeParams({ bookingId: upcomingBooking.id });
    reply('GET', bookingPath(upcomingBooking.id), jsonResponse(upcomingBooking));
    await renderPublic(<BookingDetailScreen />, sessionFixture);
    await screen.findByText('Interview confidence coaching');

    fireEvent.press(screen.getByRole('button', { name: 'Reschedule' }));
    expect(navigation.push).toHaveBeenCalledWith({
      pathname: '/bookings/[bookingId]/reschedule', params: { bookingId: 'booking-1' },
    });
  });

  test('a cancelled booking offers no Reschedule action', async () => {
    const cancelled: Booking = { ...upcomingBooking, status: 'cancelled' };
    routeParams({ bookingId: cancelled.id });
    reply('GET', bookingPath(cancelled.id), jsonResponse(cancelled));
    await renderPublic(<BookingDetailScreen />, sessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.queryByRole('button', { name: 'Reschedule' })).toBeNull();
  });
});
