import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply,
  routeParams, tick,
} from '../public-screen-utils';
import EditService from '@/app/counsellor/services/[serviceId]/edit';
import BookingDetail from '@/app/bookings/[bookingId]/index';
import Reschedule from '@/app/bookings/[bookingId]/reschedule';
import { Booking } from '@/src/api/types';
import { confirmationFixture, counsellorSessionFixture, serviceFixture, sessionFixture } from '../fixtures';

// The public harness fixes the clock before these dates. Each request passes
// through the real client; HTTP replies and navigation are controlled boundaries.
const booking: Booking = {
  ...confirmationFixture.booking,
  modality: 'in_person',
  meetingArea: 'Melbourne, VIC',
  meetingAddress: 'Level 1, 20 Collins Street',
};
const bookingPath = `/bookings/${booking.id}`;
const addressPath = `${bookingPath}/meeting-address`;
const slotsPath = `/services/${booking.serviceId}/slots`;
const movePath = `${bookingPath}/reschedule`;
const slot = { startsAt: '2026-09-02T00:00:00Z', endsAt: '2026-09-02T01:00:00Z' };

async function openAddress() {
  routeParams({ bookingId: booking.id });
  reply('GET', bookingPath, jsonResponse(booking));
  await renderPublic(<BookingDetail />, counsellorSessionFixture);
  fireEvent.press(await screen.findByRole('button', { name: 'Edit address' }));
}

async function openReschedule() {
  routeParams({ bookingId: booking.id });
  reply('GET', bookingPath, jsonResponse(booking));
  reply('GET', slotsPath, jsonResponse([slot]));
  await renderPublic(<Reschedule />, sessionFixture);
  fireEvent.press(await screen.findByRole('radio', { name: /60 min$/ }));
}

describe('US-36 / QA-201 existing-service update recovery', () => {
  test('a rejected PATCH retains the edit and retry waits for confirmation before leaving', async () => {
    routeParams({ serviceId: serviceFixture.id });
    const path = `/me/services/${serviceFixture.id}`;
    reply('GET', '/me/services', jsonResponse([serviceFixture]));
    reply('PATCH', path, apiFailure('UNAVAILABLE', 'Service update unavailable.', 503));
    await renderPublic(<EditService />, counsellorSessionFixture);
    fireEvent.changeText(await screen.findByLabelText('Service title'), 'Updated interview coaching');
    fireEvent.changeText(screen.getByLabelText('Price (AUD)'), '123.45');
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Service update unavailable.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Updated interview coaching')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('123.45')).toBeOnTheScreen();
    expect(screen.queryByText('Service updated')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(callsTo('POST', '/me/services')).toHaveLength(0);

    const retry = deferred<Response>();
    reply('PATCH', path, retry.promise);
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    expect(callsTo('PATCH', path)).toHaveLength(2);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.queryByText('Service updated')).toBeNull();
    const writes = callsTo('PATCH', path);
    expect(writes[1][1]?.body).toBe(writes[0][1]?.body);
    expect(JSON.parse(String(writes[1][1]?.body))).toEqual({
      title: 'Updated interview coaching', description: serviceFixture.description,
      priceMinor: 12345, durationMinutes: serviceFixture.durationMinutes,
      currency: 'AUD', modalities: ['online'], location: null,
    });
    expect(writes[1][1]?.headers).toEqual(expect.objectContaining({
      Authorization: `Bearer ${counsellorSessionFixture.accessToken}`,
    }));
    await act(async () => retry.resolve(jsonResponse({
      ...serviceFixture, title: 'Updated interview coaching', priceMinor: 12345,
    })));
    expect(await screen.findByText('Service updated')).toBeOnTheScreen();
    expect(navigation.replace).toHaveBeenCalledWith('/counsellor');
  });
});

describe('US-43 / QA-207 meeting-address edits', () => {
  test('cancelling an address draft preserves the stored address and reopening starts from it', async () => {
    await openAddress();
    fireEvent.changeText(screen.getByLabelText('Meeting address'), 'Unsubmitted meeting point');
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(booking.meetingAddress!)).toBeOnTheScreen();
    expect(screen.queryByText('Unsubmitted meeting point')).toBeNull();
    expect(callsTo('PATCH', addressPath)).toHaveLength(0);
    expect(screen.queryByText('Meeting address saved')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Edit address' }));
    expect(screen.getByLabelText('Meeting address')).toHaveProp('value', booking.meetingAddress);
  });

  test('clearing an address sends null and replaces the display only after the server confirms', async () => {
    const pending = deferred<Response>();
    reply('PATCH', addressPath, pending.promise);
    await openAddress();
    fireEvent.changeText(screen.getByLabelText('Meeting address'), '  \n ');
    fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
    expect(screen.getByRole('button', { name: 'Save address' })).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
    expect(callsTo('PATCH', addressPath)).toHaveLength(1);
    expect(JSON.parse(String(callsTo('PATCH', addressPath)[0][1]?.body))).toEqual({ meetingAddress: null });
    expect(screen.getByText(booking.meetingAddress!)).toBeOnTheScreen();
    expect(screen.queryByText('Meeting address saved')).toBeNull();
    await act(async () => pending.resolve(jsonResponse({ ...booking, meetingAddress: null })));
    expect(await screen.findByText("You haven't added a specific meeting address yet.")).toBeOnTheScreen();
    expect(screen.queryByText(booking.meetingAddress!)).toBeNull();
    expect(screen.getByText('Meeting address saved')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Meeting address')).toBeNull();
  });

  test('a refused address write keeps the saved display and draft, then retries the trimmed address', async () => {
    reply('PATCH', addressPath, apiFailure('UNAVAILABLE', 'Address update unavailable.', 503));
    await openAddress();
    fireEvent.changeText(screen.getByLabelText('Meeting address'), '  Level 2, 30 Collins Street  ');
    fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Address update unavailable.')).toBeOnTheScreen();
    expect(screen.getByText(booking.meetingAddress!)).toBeOnTheScreen();
    expect(screen.getByLabelText('Meeting address')).toHaveProp('value', '  Level 2, 30 Collins Street  ');
    expect(screen.queryByText('Meeting address saved')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save address' })).toBeEnabled();
    reply('PATCH', addressPath, jsonResponse({ ...booking, meetingAddress: 'Level 2, 30 Collins Street' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Meeting address saved')).toBeOnTheScreen();
    expect(screen.getByText('Level 2, 30 Collins Street')).toBeOnTheScreen();
    expect(screen.queryByText(booking.meetingAddress!)).toBeNull();
    expect(callsTo('PATCH', addressPath)).toHaveLength(2);
    expect(callsTo('PATCH', addressPath)[1][1]?.body).toBe(callsTo('PATCH', addressPath)[0][1]?.body);
    expect(JSON.parse(String(callsTo('PATCH', addressPath)[1][1]?.body))).toEqual({
      meetingAddress: 'Level 2, 30 Collins Street',
    });
  });
});

describe('US-69 / QA-225 reschedule acknowledgement and retry', () => {
  test('an in-flight move sends one request and keeps the same booking until acknowledgement', async () => {
    const pending = deferred<Response>();
    reply('POST', movePath, pending.promise);
    await openReschedule();
    fireEvent.press(screen.getByRole('button', { name: 'Confirm new time' }));
    await tick();
    expect(screen.getByRole('button', { name: 'Confirm new time' })).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: 'Confirm new time' }));
    expect(callsTo('POST', movePath)).toHaveLength(1);
    expect(callsTo('POST', '/orders')).toHaveLength(0);
    expect(screen.queryByText('Session rescheduled')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => pending.resolve(jsonResponse({ ...booking, ...slot })));
    expect(await screen.findByText('Session rescheduled')).toBeOnTheScreen();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: '/bookings/[bookingId]', params: { bookingId: booking.id },
    });
    expect(JSON.parse(String(callsTo('POST', movePath)[0][1]?.body))).toEqual({
      startsAt: slot.startsAt, modality: 'in_person', timezone: expect.any(String),
    });
  });

  test('a server failure reloads the original booking and requires a new selection before retry', async () => {
    reply('POST', movePath, apiFailure('UNAVAILABLE', 'Rescheduling unavailable.', 503));
    await openReschedule();
    const refreshedSlot = { startsAt: '2026-09-03T00:00:00Z', endsAt: '2026-09-03T01:00:00Z' };
    reply('GET', slotsPath, jsonResponse([refreshedSlot]));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm new time' }));
    await tick();
    expect(await screen.findByText('Rescheduling unavailable.')).toBeOnTheScreen();
    expect(callsTo('GET', bookingPath)).toHaveLength(2);
    expect(callsTo('GET', slotsPath)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Confirm new time' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /60 min$/ })).not.toBeChecked();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.queryByText('Session rescheduled')).toBeNull();
    fireEvent.press(screen.getByRole('radio', { name: /60 min$/ }));
    reply('POST', movePath, jsonResponse({ ...booking, ...refreshedSlot }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm new time' }));
    await tick();
    expect(await screen.findByText('Session rescheduled')).toBeOnTheScreen();
    expect(callsTo('POST', movePath)).toHaveLength(2);
    expect(JSON.parse(String(callsTo('POST', movePath)[1][1]?.body))).toEqual({
      startsAt: refreshedSlot.startsAt, modality: booking.modality, timezone: expect.any(String),
    });
    expect(callsTo('POST', '/orders')).toHaveLength(0);
  });
});
