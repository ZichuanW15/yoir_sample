import { screen } from '@testing-library/react-native';
import { apiFailure, callsTo, jsonResponse, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import Reschedule from '@/app/bookings/[bookingId]/reschedule';
import { confirmationFixture, sessionFixture } from '../fixtures';

test('[S3-RESCHEDULE-SLOTS-READ][QA-225] a failed availability read reports the error without claiming no open times', async () => {
  const booking = confirmationFixture.booking;
  routeParams({ bookingId: booking.id });
  reply('GET', `/bookings/${booking.id}`, jsonResponse(booking));
  reply('GET', `/services/${booking.serviceId}/slots`, apiFailure('UNAVAILABLE', 'Availability temporarily unavailable.', 503));
  await renderPublic(<Reschedule />, sessionFixture);
  await tick();
  expect(callsTo('GET', `/bookings/${booking.id}`)).toHaveLength(1);
  expect(callsTo('GET', `/services/${booking.serviceId}/slots`)).toHaveLength(1);
  expect(screen.getByText('Pick a new time')).toBeOnTheScreen();
  // Original expected behavior remains a deliberately failing advisory assertion.
  // A refused GET cannot establish that the service has no available appointments.
  expect(screen.queryByText('No open times right now. Try again later.')).toBeNull();
  expect(screen.getByText('Availability temporarily unavailable.')).toBeOnTheScreen();
});
