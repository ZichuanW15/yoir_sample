import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { apiFailure, callsTo, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import BookingDetailScreen from '@/app/bookings/[bookingId]/index';
import { Booking } from '@/src/api/types';
import { deviceTimezone } from '@/src/format';
import { counsellorSessionFixture, sessionFixture } from '../fixtures';

const bookingPath = (id: string) => `/bookings/${id}`;
const addressPath = (id: string) => `/bookings/${id}/meeting-address`;

const onlineBooking: Booking = {
  id: 'booking-online', orderId: 'order-1', serviceId: 'service-1',
  serviceTitle: 'Interview confidence coaching',
  startsAt: '2026-09-01T01:00:00.000Z', endsAt: '2026-09-01T02:00:00.000Z',
  timezone: 'Australia/Melbourne', modality: 'online',
  status: 'confirmed', paymentStatus: 'paid',
  counterpartyName: 'Priya Sharma', counterpartyRole: 'job_seeker',
  preSessionBrief: 'Keen to go over salary negotiation.',
  meetingUrl: 'https://meet.jit.si/yoir-booking-online',
};

const inPersonBooking: Booking = {
  ...onlineBooking,
  id: 'booking-in-person',
  modality: 'in_person',
  meetingUrl: null,
  meetingArea: 'Melbourne, VIC',
  meetingAddress: '',
};

beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('booking detail — US-43', () => {
  test('AT-US-43-1: an online booking shows the service, Job Seeker, time with timezone, pre-session brief and the meeting link, which opens outside the app', async () => {
    routeParams({ bookingId: onlineBooking.id });
    reply('GET', bookingPath(onlineBooking.id), jsonResponse(onlineBooking));
    await renderPublic(<BookingDetailScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.getByText('For Priya Sharma')).toBeOnTheScreen();
    expect(screen.getByText(deviceTimezone(), { exact: false })).toBeOnTheScreen();
    expect(screen.getByText('Before the session')).toBeOnTheScreen();
    expect(screen.getByText('Keen to go over salary negotiation.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Join the session' }));
    expect(Linking.openURL).toHaveBeenCalledWith('https://meet.jit.si/yoir-booking-online');
  });

  test('AT-US-43-2: an in-person booking with no address yet shows a not-yet-provided state, and the counsellor can add one', async () => {
    routeParams({ bookingId: inPersonBooking.id });
    reply('GET', bookingPath(inPersonBooking.id), jsonResponse(inPersonBooking));
    reply('PATCH', addressPath(inPersonBooking.id), jsonResponse({ ...inPersonBooking, meetingAddress: 'Level 4, 123 Collins St' }));
    await renderPublic(<BookingDetailScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.getByText('General area: Melbourne, VIC')).toBeOnTheScreen();
    expect(screen.getByText("You haven't added a specific meeting address yet.")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Add address' }));
    fireEvent.changeText(screen.getByLabelText('Meeting address'), 'Level 4, 123 Collins St');
    fireEvent.press(screen.getByRole('button', { name: 'Save address' }));

    expect(await screen.findByText('Level 4, 123 Collins St')).toBeOnTheScreen();
    expect(JSON.parse(String(callsTo('PATCH', addressPath(inPersonBooking.id))[0][1]?.body))).toEqual({ meetingAddress: 'Level 4, 123 Collins St' });
  });

  test('an existing address can be edited', async () => {
    routeParams({ bookingId: inPersonBooking.id });
    reply('GET', bookingPath(inPersonBooking.id), jsonResponse({ ...inPersonBooking, meetingAddress: 'Wrong building' }));
    reply('PATCH', addressPath(inPersonBooking.id), jsonResponse({ ...inPersonBooking, meetingAddress: 'Corrected address' }));
    await renderPublic(<BookingDetailScreen />, counsellorSessionFixture);
    await screen.findByText('Wrong building');

    fireEvent.press(screen.getByRole('button', { name: 'Edit address' }));
    expect(screen.getByLabelText('Meeting address')).toHaveProp('value', 'Wrong building');
    fireEvent.changeText(screen.getByLabelText('Meeting address'), 'Corrected address');
    fireEvent.press(screen.getByRole('button', { name: 'Save address' }));

    expect(await screen.findByText('Corrected address')).toBeOnTheScreen();
  });

  test('a Job Seeker sees the address once added, but has no edit controls', async () => {
    routeParams({ bookingId: inPersonBooking.id });
    reply('GET', bookingPath(inPersonBooking.id), jsonResponse({
      ...inPersonBooking, meetingAddress: 'Level 4, 123 Collins St', counterpartyName: 'Maya Chen', counterpartyRole: 'counsellor',
    }));
    await renderPublic(<BookingDetailScreen />, sessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.getByText('Level 4, 123 Collins St')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Edit address' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add address' })).toBeNull();
  });

  test('a Job Seeker with no address yet sees a Career-Professional-facing message instead', async () => {
    routeParams({ bookingId: inPersonBooking.id });
    reply('GET', bookingPath(inPersonBooking.id), jsonResponse({
      ...inPersonBooking, counterpartyName: 'Maya Chen', counterpartyRole: 'counsellor',
    }));
    await renderPublic(<BookingDetailScreen />, sessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.getByText("Your Career Professional hasn't added a specific address yet.")).toBeOnTheScreen();
    expect(screen.queryByText("You haven't added a specific meeting address yet.")).toBeNull();
  });

  test('AT-US-43-3: a non-participant is rejected by the backend and sees no delivery information', async () => {
    routeParams({ bookingId: onlineBooking.id });
    reply('GET', bookingPath(onlineBooking.id), apiFailure('NOT_FOUND', 'Booking not found.', 404));
    await renderPublic(<BookingDetailScreen />, sessionFixture);

    expect(await screen.findByText('Booking not found.')).toBeOnTheScreen();
    expect(screen.queryByText('Interview confidence coaching')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Join the session' })).toBeNull();
  });

  test('AC4: a confirmed online booking with no link recorded shows a clear not-yet-provided state', async () => {
    routeParams({ bookingId: onlineBooking.id });
    reply('GET', bookingPath(onlineBooking.id), jsonResponse({ ...onlineBooking, meetingUrl: null }));
    await renderPublic(<BookingDetailScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.getByText("A meeting link hasn't been set up yet.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Join the session' })).toBeNull();
  });

  test('a load failure shows an error with a working retry', async () => {
    routeParams({ bookingId: onlineBooking.id });
    reply('GET', bookingPath(onlineBooking.id), apiFailure('UNAVAILABLE', 'Booking could not be loaded.', 503));
    await renderPublic(<BookingDetailScreen />, counsellorSessionFixture);
    await screen.findByText('Booking could not be loaded.');

    reply('GET', bookingPath(onlineBooking.id), jsonResponse(onlineBooking));
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Interview confidence coaching');
  });

  test('back returns to My Bookings', async () => {
    routeParams({ bookingId: onlineBooking.id });
    reply('GET', bookingPath(onlineBooking.id), jsonResponse(onlineBooking));
    await renderPublic(<BookingDetailScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    fireEvent.press(screen.getByRole('button', { name: /back/i }));
    expect(navigation.replace).toHaveBeenCalledWith('/bookings');
  });
});
