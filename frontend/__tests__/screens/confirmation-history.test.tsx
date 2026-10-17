import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import {
  apiFailure, callsTo, deferred, jsonResponse, renderPublic, reply, routeParams,
} from '../public-screen-utils';
import { confirmationFixture, serviceFixture, sessionFixture } from '../fixtures';
import ConfirmationScreen from '@/app/bookings/confirmation';
import { api } from '@/src/api/client';
import { Booking, Service } from '@/src/api/types';

// Real screen, AuthProvider and API client. HTTP response bodies and delivery
// order are controlled at fetch; persisted order snapshots are tested by the
// US-36 backend/API suites, not by this component fixture.
const purchasedTitle = 'Purchased Melbourne coaching';
const currentTitle = 'Current Geelong offering';
const purchased: Booking = {
  ...confirmationFixture.booking, serviceTitle: purchasedTitle,
  modality: 'in_person', meetingArea: 'Melbourne, VIC', meetingUrl: null,
};
const currentService: Service = {
  ...serviceFixture, title: currentTitle, modalities: ['in_person'],
  location: { state: 'VIC', cityOrRegion: 'Geelong' },
};
const bookingPath = `/bookings/${purchased.id}`;
const servicePath = `/services/${serviceFixture.id}`;

function setup(booking: Booking = purchased) {
  routeParams({
    bookingId: booking.id, paymentId: confirmationFixture.paymentId,
    serviceId: serviceFixture.id, modality: booking.modality,
    startsAt: booking.startsAt, endsAt: booking.endsAt, amountMinor: '9500',
  });
  reply('GET', servicePath, jsonResponse(currentService));
  reply('GET', bookingPath, jsonResponse(booking));
  reply('GET', `${bookingPath}/receipt`, jsonResponse({ receiptNumber: 'QA-201-RECEIPT' }));
}

async function expectPurchasedDetails() {
  expect(await screen.findByText(purchasedTitle)).toBeOnTheScreen();
  expect(screen.queryByText(currentTitle)).not.toBeOnTheScreen();
  const note = screen.getByText(/^In person(?: ·|\.)/);
  // RNTL's string matcher is exact. Regex checks the area inside the full note,
  // including the negative assertion: both must inspect the actual rendered text.
  expect(note).toHaveTextContent(/^In person · Melbourne, VIC\./);
  expect(note).not.toHaveTextContent(/Geelong, VIC/);
}

test('[QA-201][US-36] confirmation reads the purchased title and area instead of the edited listing', async () => {
  setup();
  const read = jest.spyOn(api, 'getBooking'); // Call-through observer, not an API substitute.
  await renderPublic(<ConfirmationScreen />, sessionFixture);
  await expectPurchasedDetails();
  expect(read).toHaveBeenCalledWith(purchased.id, sessionFixture.accessToken);
  const requests = callsTo('GET', bookingPath);
  expect(requests).toHaveLength(1);
  expect(requests[0][1]?.headers).toMatchObject({
    Authorization: `Bearer ${sessionFixture.accessToken}`,
  });
  expect(await screen.findByText('QA-201-RECEIPT')).toBeOnTheScreen();
});

test('[QA-201][US-36] delayed booking response replaces the already-visible listing fallback', async () => {
  setup();
  const delayed = deferred<Response>();
  reply('GET', bookingPath, delayed.promise);
  await renderPublic(<ConfirmationScreen />, sessionFixture);
  expect(await screen.findByText(currentTitle)).toBeOnTheScreen();
  expect(screen.getByText(/^In person(?: ·|\.)/)).toHaveTextContent(/^In person · Geelong, VIC\./);
  await waitFor(() => expect(callsTo('GET', bookingPath)).toHaveLength(1));
  await act(async () => { delayed.resolve(jsonResponse(purchased)); });
  await expectPurchasedDetails();
});

test('[QA-201][US-36] a later listing response cannot overwrite an already-loaded purchase', async () => {
  setup();
  const delayed = deferred<Response>();
  reply('GET', servicePath, delayed.promise);
  const readService = jest.spyOn(api, 'getService');
  await renderPublic(<ConfirmationScreen />, sessionFixture);
  await expectPurchasedDetails();
  await act(async () => {
    delayed.resolve(jsonResponse(currentService));
    await expect(readService.mock.results[0].value).resolves.toMatchObject({ title: currentTitle });
  });
  await expectPurchasedDetails();
  expect(screen.getByText(`with ${serviceFixture.counsellor.displayName}`)).toBeOnTheScreen();
});

test.each(['empty', 'omitted'] as const)(
  '[QA-201][US-36] a loaded booking with %s area never borrows the current listing location',
  async (variant) => {
    const booking = { ...purchased };
    if (variant === 'empty') booking.meetingArea = '';
    else delete booking.meetingArea;
    setup(booking);
    await renderPublic(<ConfirmationScreen />, sessionFixture);
    // A distinct purchased title proves the booking response was consumed.
    expect(await screen.findByText(purchasedTitle)).toBeOnTheScreen();
    const note = screen.getByText(/^In person(?: ·|\.)/);
    expect(note).toHaveTextContent(/^In person\. Your Career Professional/);
    expect(note).not.toHaveTextContent(/Geelong|Melbourne|In person ·/);
    expect(screen.queryByText(currentTitle)).not.toBeOnTheScreen();
  },
);

test('[QA-201][US-36] an unavailable listing does not hide a successfully read purchased title or area', async () => {
  setup();
  reply('GET', servicePath, apiFailure('NOT_FOUND', 'Service not found.', 404));
  const readService = jest.spyOn(api, 'getService');
  await renderPublic(<ConfirmationScreen />, sessionFixture);
  await expectPurchasedDetails();
  await expect(readService.mock.results[0].value).rejects.toMatchObject({ status: 404 });
  expect(screen.getByText(purchased.id)).toBeOnTheScreen();
});

test('[QA-201][US-36] a failed booking read retains the supported listing fallback', async () => {
  setup();
  reply('GET', bookingPath, apiFailure('TEMPORARILY_UNAVAILABLE', 'Please retry later.', 503));
  const read = jest.spyOn(api, 'getBooking');
  await renderPublic(<ConfirmationScreen />, sessionFixture);
  await waitFor(() => expect(read).toHaveBeenCalledWith(purchased.id, sessionFixture.accessToken));
  // Establish a settled failed read, not only the initial loading fallback.
  await expect(read.mock.results[0].value).rejects.toMatchObject({ status: 503 });
  expect(await screen.findByText(currentTitle)).toBeOnTheScreen();
  expect(screen.queryByText(purchasedTitle)).not.toBeOnTheScreen();
  const note = screen.getByText(/^In person(?: ·|\.)/);
  expect(note).toHaveTextContent(/^In person · Geelong, VIC\./);
  expect(note).not.toHaveTextContent(/Melbourne, VIC/);
});

test('[QA-201][US-36] an online purchase preserves its returned meeting link while using its frozen title', async () => {
  const meetingUrl = 'https://meet.example.test/purchased-booking-room';
  setup({ ...purchased, modality: 'online', meetingArea: '', meetingUrl });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await renderPublic(<ConfirmationScreen />, sessionFixture);
  expect(await screen.findByText(purchasedTitle)).toBeOnTheScreen();
  expect(screen.queryByText(currentTitle)).not.toBeOnTheScreen();
  const note = screen.getByText(/^Online\. The same joining link/);
  expect(note).toHaveTextContent(/^Online\. The same joining link is in your confirmation email\./);
  expect(note).not.toHaveTextContent(/Geelong|Melbourne|In person/);
  fireEvent.press(screen.getByRole('button', { name: 'Open the meeting room' }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(meetingUrl);
});
