import { act, screen, waitFor } from '@testing-library/react-native';
import { callsTo, deferred, jsonResponse, renderPublic, reply, routeParams } from '../public-screen-utils';
import ConfirmationScreen from '@/app/bookings/confirmation';
import { api } from '@/src/api/client';
import { Booking } from '@/src/api/types';
import { confirmationFixture, serviceFixture, sessionFixture } from '../fixtures';

// Real screen, auth provider and HTTP client; the transport supplies distinct
// booked/current locations. Backend persistence is covered by the US-36 API tests.
test('[S3-CONFIRMATION-AREA][QA-201] confirmation retains the booked meeting area after the listing moves', async () => {
  const booked: Booking = {
    ...confirmationFixture.booking,
    modality: 'in_person',
    meetingArea: 'Melbourne, VIC',
    meetingUrl: null,
  };
  routeParams({
    bookingId: booked.id, paymentId: confirmationFixture.paymentId,
    serviceId: serviceFixture.id, modality: 'in_person',
    startsAt: booked.startsAt, endsAt: booked.endsAt, amountMinor: '9500',
  });
  reply('GET', `/services/${serviceFixture.id}`, jsonResponse({
    ...serviceFixture, modalities: ['in_person'],
    location: { state: 'VIC', cityOrRegion: 'Geelong' },
  }));
  const bookingReply = deferred<Response>();
  reply('GET', `/bookings/${booked.id}`, bookingReply.promise);
  reply('GET', `/bookings/${booked.id}/receipt`, jsonResponse({ receiptNumber: 'QA-201-RECEIPT' }));
  const originalGetBooking = api.getBooking.bind(api);
  let received: Booking | undefined;
  const getBooking = jest.spyOn(api, 'getBooking').mockImplementation(async (...args) => {
    const result = await originalGetBooking(...args);
    received = result;
    return result;
  });

  await renderPublic(<ConfirmationScreen />, sessionFixture);
  await screen.findByText(serviceFixture.title);
  expect(callsTo('GET', `/services/${serviceFixture.id}`)).toHaveLength(1);
  await waitFor(() => expect(callsTo('GET', `/bookings/${booked.id}`)).toHaveLength(1));
  await act(async () => { bookingReply.resolve(jsonResponse(booked)); });
  await waitFor(() => expect(received?.meetingArea).toBe('Melbourne, VIC'));
  expect(getBooking).toHaveBeenCalledWith(booked.id, sessionFixture.accessToken);
  expect(await screen.findByText('QA-201-RECEIPT')).toBeOnTheScreen();

  // The response has completed; a stale note is not an unloaded-booking result.
  // Keep the correct acceptance assertion so a product fix makes this pass.
  const deliveryNote = screen.getByText(/^In person ·/);
  expect(deliveryNote).toHaveTextContent('In person · Melbourne, VIC');
  expect(deliveryNote).not.toHaveTextContent('Geelong, VIC');
});
