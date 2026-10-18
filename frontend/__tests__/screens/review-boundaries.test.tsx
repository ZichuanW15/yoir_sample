import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import ReviewScreen from '@/app/bookings/[bookingId]/review';
import { Booking, Review } from '@/src/api/types';
import { confirmationFixture, counsellorSessionFixture, serviceFixture, sessionFixture } from '../fixtures';
import { ownerSession } from './admin-screen-fixtures';

const completed: Booking = { ...confirmationFixture.booking, status: 'completed', counterpartyName: 'Maya Chen', counterpartyRole: 'counsellor' };
const stored: Review = {
  id: 'review-qa-1', bookingId: completed.id, serviceId: completed.serviceId, authorName: sessionFixture.user.name,
  rating: 4, comment: 'Actionable and thoughtful advice.', createdAt: '2026-08-28T05:00:00Z',
};
const readPath = `/bookings/${completed.id}`;
const writePath = `${readPath}/review`;
beforeEach(() => {
  routeParams({ bookingId: completed.id });
  reply('GET', readPath, jsonResponse(completed));
  reply('POST', writePath, jsonResponse(stored, 201));
});
async function open() {
  await renderPublic(<ReviewScreen />, sessionFixture);
  await screen.findByLabelText('Your review');
}
function fill() {
  fireEvent.press(screen.getByRole('radio', { name: '4 stars' }));
  fireEvent.changeText(screen.getByLabelText('Your review'), stored.comment);
}

describe('US-53 / QA-213 review boundaries (real client and components, controlled HTTP)', () => {
  test('a guest is returned to login without fetching a booking', async () => {
    await renderPublic(<ReviewScreen />);
    expect(navigation.replace).toHaveBeenCalledWith('/auth/login');
    expect(callsTo('GET', readPath)).toHaveLength(0);
    expect(screen.queryByLabelText('Your review')).toBeNull();
  });

  test.each([
    ['counsellor', counsellorSessionFixture, '/counsellor'],
    ['platform owner', ownerSession, '/admin'],
  ] as const)('a %s cannot use the Job Seeker review form', async (_role, session, home) => {
    await renderPublic(<ReviewScreen />, session);
    expect(navigation.replace).toHaveBeenCalledWith(home);
    expect(screen.queryByLabelText('Your review')).toBeNull();
    expect(callsTo('POST', writePath)).toHaveLength(0);
  });

  test.each(['confirmed', 'cancelled', 'refunded'] as const)('a %s booking cannot be submitted for review', async (status) => {
    reply('GET', readPath, jsonResponse({ ...completed, status }));
    await renderPublic(<ReviewScreen />, sessionFixture);
    expect(await screen.findByText('This session is not ready to review')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Your review')).toBeNull();
    expect(callsTo('POST', writePath)).toHaveLength(0);
    fireEvent.press(screen.getByRole('button', { name: 'Back to My sessions' }));
    expect(navigation.replace).toHaveBeenCalledWith('/bookings');
  });

  test('a paid-out session remains reviewable after payout', async () => {
    reply('GET', readPath, jsonResponse({ ...completed, status: 'paid_out' }));
    await open();
    fill();
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText('Review submitted')).toBeOnTheScreen();
    expect(callsTo('POST', writePath)).toHaveLength(1);
  });

  test('a previously stored review prevents a second review form', async () => {
    reply('GET', readPath, jsonResponse({ ...completed, review: stored }));
    await renderPublic(<ReviewScreen />, sessionFixture);
    expect(await screen.findByText('Review already submitted')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Submit review' })).toBeNull();
    expect(callsTo('POST', writePath)).toHaveLength(0);
  });

  test('a rating and non-blank written comment are both required before any request', async () => {
    await open();
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText('Choose a star rating from 1 to 5.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('radio', { name: '4 stars' }));
    fireEvent.changeText(screen.getByLabelText('Your review'), ' \n ');
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText('Write a short review before submitting.')).toBeOnTheScreen();
    expect(callsTo('POST', writePath)).toHaveLength(0);
  });

  test('while a review is storing the button blocks duplicate writes and success is not shown early', async () => {
    const pending = deferred<Response>();
    reply('POST', writePath, pending.promise);
    await open();
    fill();
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(callsTo('POST', writePath)).toHaveLength(1);
    expect(screen.queryByText('Review submitted')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(jsonResponse(stored, 201)); });
    expect(await screen.findByText('Review submitted')).toBeOnTheScreen();
    expect(navigation.replace).toHaveBeenCalledWith({ pathname: '/services/[serviceId]', params: { serviceId: serviceFixture.id } });
  });

  test.each([
    [409, 'REVIEW_EXISTS', 'A review already exists for this booking.'],
    [403, 'FORBIDDEN', 'Only the booking owner may review it.'],
  ])('a %s write refusal is visible, retains entered feedback and never claims success', async (status, code, message) => {
    reply('POST', writePath, apiFailure(String(code), String(message), Number(status)));
    await open();
    fill();
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText(String(message))).toBeOnTheScreen();
    expect(screen.getByDisplayValue(stored.comment)).toBeOnTheScreen();
    expect(screen.queryByText('Review submitted')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test('a temporary write failure is recoverable using the retained draft', async () => {
    reply('POST', writePath, apiFailure('UNAVAILABLE', 'Reviews temporarily unavailable.', 503));
    await open();
    fill();
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText('Reviews temporarily unavailable.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeEnabled();
    reply('POST', writePath, jsonResponse(stored, 201));
    fireEvent.press(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText('Review submitted')).toBeOnTheScreen();
    expect(callsTo('POST', writePath)).toHaveLength(2);
    expect(JSON.parse(String(callsTo('POST', writePath)[1][1]?.body))).toEqual({ rating: 4, comment: stored.comment });
  });

  test('booking read failure offers no review form or guessed eligibility', async () => {
    reply('GET', readPath, apiFailure('NOT_FOUND', 'Booking not found.', 404));
    await renderPublic(<ReviewScreen />, sessionFixture);
    expect(await screen.findByText('Booking not found.')).toBeOnTheScreen();
    expect(screen.queryByText('This session is not ready to review')).toBeNull();
    expect(screen.queryByLabelText('Your review')).toBeNull();
    expect(callsTo('POST', writePath)).toHaveLength(0);
  });
});
