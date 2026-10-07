import { apiFailure, callsTo, jsonResponse, navigation, renderPublic, reply } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import MyBookingsScreen from '@/app/bookings';
import { Booking } from '@/src/api/types';
import { deviceTimezone } from '@/src/format';
import { counsellorSessionFixture, sessionFixture } from '../fixtures';

const BOOKINGS = '/me/bookings';
const pastTab = () => fireEvent.press(screen.getByRole('tab', { name: 'Past' }));

const upcoming: Booking = {
  id: 'booking-upcoming', orderId: 'order-1', serviceId: 'service-1',
  serviceTitle: 'Interview confidence coaching',
  startsAt: '2026-09-01T01:00:00.000Z', endsAt: '2026-09-01T02:00:00.000Z',
  timezone: 'Australia/Melbourne', modality: 'online',
  status: 'confirmed', paymentStatus: 'paid',
  counterpartyName: 'Priya Sharma', counterpartyRole: 'job_seeker',
  preSessionBrief: 'Keen to go over salary negotiation.',
};

const past: Booking = {
  ...upcoming,
  id: 'booking-past',
  startsAt: '2026-08-01T01:00:00.000Z', endsAt: '2026-08-01T02:00:00.000Z',
  status: 'completed',
};

describe('Career Professional bookings — US-42', () => {
  test('AT-US-42-1: upcoming shows the service, Job Seeker, modality, time with timezone and the pre-session brief', async () => {
    reply('GET', BOOKINGS, jsonResponse([upcoming]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.getByText('For Priya Sharma')).toBeOnTheScreen();
    expect(screen.getByText('Online')).toBeOnTheScreen();
    expect(screen.getByText(deviceTimezone(), { exact: false })).toBeOnTheScreen();
    expect(screen.getByText('Before the session')).toBeOnTheScreen();
    expect(screen.getByText('Keen to go over salary negotiation.')).toBeOnTheScreen();
  });

  test('US-43: tapping a booking opens its detail screen', async () => {
    reply('GET', BOOKINGS, jsonResponse([upcoming]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    fireEvent.press(screen.getByRole('button', { name: 'Interview confidence coaching, booking details' }));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/bookings/[bookingId]', params: { bookingId: 'booking-upcoming' } });
  });

  test('AT-US-42-2: a booking whose slot time has passed appears under the Past tab, not Coming up', async () => {
    reply('GET', BOOKINGS, jsonResponse([past]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);

    // Coming up is the default tab: a past-only booking does not show there —
    // it reads as a confirmed empty state, not a missing/broken section.
    expect(await screen.findByText('Nothing booked yet')).toBeOnTheScreen();
    expect(screen.queryByText('Interview confidence coaching')).toBeNull();

    pastTab();
    expect(await screen.findByText('Interview confidence coaching')).toBeOnTheScreen();
  });

  test('both tabs stay visible and selectable regardless of which one has data', async () => {
    reply('GET', BOOKINGS, jsonResponse([upcoming]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.getByRole('tab', { name: 'Coming up' })).toBeOnTheScreen();
    const past = screen.getByRole('tab', { name: 'Past' });
    expect(past).toBeOnTheScreen();
    expect(past.props.accessibilityState).toMatchObject({ selected: false });
  });

  test('a Past tab with nothing in it says so explicitly, instead of just disappearing', async () => {
    reply('GET', BOOKINGS, jsonResponse([upcoming]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    pastTab();
    expect(await screen.findByText('No past sessions')).toBeOnTheScreen();
    expect(screen.getByText("Sessions you've completed will appear here.")).toBeOnTheScreen();
  });

  test('the pre-session brief is not shown once a booking is in the past', async () => {
    reply('GET', BOOKINGS, jsonResponse([past]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);
    await screen.findByText('Nothing booked yet');
    pastTab();
    await screen.findByText('Interview confidence coaching');

    expect(screen.queryByText('Before the session')).toBeNull();
  });

  test('a booking with no pre-session brief shows none', async () => {
    reply('GET', BOOKINGS, jsonResponse([{ ...upcoming, preSessionBrief: '' }]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.queryByText('Before the session')).toBeNull();
  });

  test('a Job Seeker viewing their own upcoming booking also sees the brief they wrote (US-43)', async () => {
    // So they can check it against what they remember writing, not just the counsellor.
    reply('GET', BOOKINGS, jsonResponse([{ ...upcoming, counterpartyName: 'Maya Chen', counterpartyRole: 'counsellor' }]));
    await renderPublic(<MyBookingsScreen />, sessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(screen.getByText('With Maya Chen')).toBeOnTheScreen();
    expect(screen.getByText('Before the session')).toBeOnTheScreen();
    expect(screen.getByText('Keen to go over salary negotiation.')).toBeOnTheScreen();
  });

  test('AC3: no bookings at all shows an explicit empty state on each tab, without an error', async () => {
    reply('GET', BOOKINGS, jsonResponse([]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);

    expect(await screen.findByText('Nothing booked yet')).toBeOnTheScreen();
    expect(screen.getByText('Sessions job seekers book with you will appear here.')).toBeOnTheScreen();

    pastTab();
    expect(await screen.findByText('No past sessions')).toBeOnTheScreen();
  });

  test('AT-US-42-3: the app asks for bookings with only this Career Professional\'s own token', async () => {
    reply('GET', BOOKINGS, jsonResponse([upcoming]));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);
    await screen.findByText('Interview confidence coaching');

    expect(callsTo('GET', BOOKINGS)).toHaveLength(1);
    expect(callsTo('GET', BOOKINGS)[0][1]?.headers).toMatchObject({ Authorization: 'Bearer counsellor-access-token' });
    // Ownership itself — that this token can never come back with another
    // Career Professional's bookings — is enforced and tested server-side:
    // backend/tests/test_my_bookings.py::test_the_list_holds_only_the_callers_own_bookings.
  });

  test('AT-US-42-4: the backend being unreachable shows an error state rather than an empty list', async () => {
    reply('GET', BOOKINGS, new TypeError('offline'));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);

    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
  });

  test('a backend error response also shows the error state rather than an empty list', async () => {
    reply('GET', BOOKINGS, apiFailure('UNAVAILABLE', 'Bookings are temporarily unavailable.', 503));
    await renderPublic(<MyBookingsScreen />, counsellorSessionFixture);

    expect(await screen.findByText('Bookings are temporarily unavailable.')).toBeOnTheScreen();
  });
});
