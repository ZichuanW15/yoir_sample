import { callsTo, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import PrivacySettingsScreen from '@/app/settings/privacy';
import ReviewBookingScreen from '@/app/bookings/[bookingId]/review';
import MyBookingsScreen from '@/app/bookings';
import CareerProfessionalScreen from '@/app/professionals/[counsellorId]';
import { Booking } from '@/src/api/types';
import { counsellorProfileFixture, serviceFixture, sessionFixture } from '../fixtures';

describe('profile privacy — US-27/28', () => {
  test('loads all three choices and saves the selected visibility', async () => {
    reply('GET', '/me/profile-visibility', jsonResponse({ visibility: 'public' }));
    reply('PATCH', '/me/profile-visibility', jsonResponse({ visibility: 'partial' }));
    await renderPublic(<PrivacySettingsScreen />, sessionFixture);
    expect((await screen.findByRole('radio', { name: 'Public' })).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('radio', { name: 'Partially visible' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Restricted' })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('radio', { name: 'Partially visible' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save privacy settings' }));
    expect(await screen.findByText('Privacy settings saved')).toBeOnTheScreen();
    expect(JSON.parse(String(callsTo('PATCH', '/me/profile-visibility')[0][1]?.body))).toEqual({ visibility: 'partial' });
  });

  test('renders an explicit restricted profile without leaking hidden fields', async () => {
    routeParams({ counsellorId: 'counsellor-1' });
    reply('GET', '/counsellors/counsellor-1', jsonResponse({ ...counsellorProfileFixture, restricted: true }));
    reply('GET', '/services', jsonResponse([serviceFixture]));
    await renderPublic(<CareerProfessionalScreen />);
    expect(await screen.findByText('This profile is restricted')).toBeOnTheScreen();
    expect(screen.queryByText(counsellorProfileFixture.background)).toBeNull();
    expect(screen.queryByText(serviceFixture.title)).toBeNull();
  });
});

describe('completed-booking reviews — US-53', () => {
  const completed: Booking = {
    id: 'booking-1', orderId: 'order-1', serviceId: serviceFixture.id, serviceTitle: serviceFixture.title,
    startsAt: '2026-08-20T01:00:00Z', endsAt: '2026-08-20T02:00:00Z', timezone: 'Australia/Sydney',
    modality: 'online', status: 'completed', paymentStatus: 'paid', counterpartyName: 'Maya Chen', counterpartyRole: 'counsellor',
  };

  test('offers the review action only from a completed, unreviewed session', async () => {
    reply('GET', '/me/bookings', jsonResponse([completed]));
    reply('GET', '/me/notifications', jsonResponse([]));
    await renderPublic(<MyBookingsScreen />, sessionFixture);
    // A completed session sits under the Past tab, not the Coming up tab shown by default.
    fireEvent.press(await screen.findByRole('tab', { name: 'Past' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Write a review' }));
    expect(navigation.push).toHaveBeenCalledWith('/bookings/booking-1/review');
  });

  test('submits a 1–5 star rating and written comment, then returns to the service', async () => {
    routeParams({ bookingId: completed.id });
    reply('GET', '/bookings/booking-1', jsonResponse(completed));
    reply('POST', '/bookings/booking-1/review', jsonResponse({
      id: 'review-1', bookingId: completed.id, serviceId: completed.serviceId,
      authorName: 'Alex Morgan', rating: 5, comment: 'Clear and practical advice.', createdAt: '2026-08-21T00:00:00Z',
    }));
    await renderPublic(<ReviewBookingScreen />, sessionFixture);
    fireEvent.press(await screen.findByRole('radio', { name: '5 stars' }));
    fireEvent.changeText(screen.getByLabelText('Your review'), '  Clear and practical advice.  ');
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText('Review submitted')).toBeOnTheScreen();
    expect(JSON.parse(String(callsTo('POST', '/bookings/booking-1/review')[0][1]?.body))).toEqual({ rating: 5, comment: 'Clear and practical advice.' });
    expect(navigation.replace).toHaveBeenCalledWith({ pathname: '/services/[serviceId]', params: { serviceId: serviceFixture.id } });
  });
});
