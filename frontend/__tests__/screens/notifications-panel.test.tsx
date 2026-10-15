import { apiFailure, AuthStatusProbe, callsTo, deferred, jsonResponse, navigation, renderPublic, reply } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { NotificationsPanel } from '@/src/components/NotificationsPanel';
import { AppNotification, Session } from '@/src/api/types';
import { sessionFixture } from '../fixtures';

const path = '/me/notifications';
const close = jest.fn();
let account = 0;
let session: Session;
const unread: AppNotification = {
  id: 'notice-1', title: 'Your booking is confirmed', body: 'Interview coaching starts tomorrow.',
  createdAt: '2026-08-28T05:55:00Z', read: false, href: '/bookings/booking-1',
};
const read: AppNotification = { ...unread, id: 'notice-2', title: 'Meeting location updated', body: 'Join using the updated meeting address.', read: true };

beforeEach(() => {
  // The real hook has a per-account external store; unique users prevent earlier
  // test data from masquerading as this account's cached response.
  session = { ...sessionFixture, user: { ...sessionFixture.user, id: `notifications-qa-${++account}` } };
  reply('GET', path, jsonResponse([]));
  reply('PATCH', '/me/notifications/notice-1/read', jsonResponse(undefined, 204));
  reply('PATCH', '/me/notifications/notice-2/read', jsonResponse(undefined, 204));
});

// The notification endpoint is not deployed in this baseline. These tests use
// controlled HTTP responses to verify the implemented UI and client contract;
// they do not claim end-to-end notification delivery or server persistence.
describe('notification panel — implemented UI with controlled HTTP boundary', () => {
  test('guest state makes no authenticated request and can close the panel', async () => {
    await renderPublic(<NotificationsPanel onClose={close} />);
    expect(screen.getByText('You are all caught up')).toBeOnTheScreen();
    expect(callsTo('GET', path)).toHaveLength(0);
    // This is the pointer backdrop outside accessibilityViewIsModal, so it is
    // intentionally excluded from the modal's accessibility traversal.
    fireEvent.press(screen.getByLabelText('Close notifications', { includeHiddenElements: true }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  test('refreshes the signed-in account and shows an empty successful result without bulk-read action', async () => {
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    await waitFor(() => expect(callsTo('GET', path).length).toBeGreaterThan(0));
    expect(callsTo('GET', path)[0][1]?.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${session.accessToken}` }));
    expect(screen.getByText('You are all caught up')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
  });

  test('pending responses do not fabricate notifications; resolved rows distinguish read/unread and relative age', async () => {
    const pending = deferred<Response>();
    reply('GET', path, pending.promise);
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    expect(screen.queryByText(unread.title)).toBeNull();
    await act(async () => pending.resolve(jsonResponse([unread, read])));
    expect(await screen.findByRole('button', { name: `Unread: ${unread.title}` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: read.title })).toBeOnTheScreen();
    expect(screen.getByText(unread.body)).toBeOnTheScreen();
    expect(screen.getAllByText('5m')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeOnTheScreen();
  });

  test('opening a linked notification marks only that row read, closes and navigates to its route', async () => {
    reply('GET', path, jsonResponse([unread, read]));
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    fireEvent.press(await screen.findByRole('button', { name: `Unread: ${unread.title}` }));
    expect(screen.getByRole('button', { name: unread.title })).toBeOnTheScreen();
    expect(callsTo('PATCH', '/me/notifications/notice-1/read')).toHaveLength(1);
    expect(callsTo('PATCH', '/me/notifications/notice-2/read')).toHaveLength(0);
    expect(close).toHaveBeenCalledTimes(1);
    expect(navigation.push).toHaveBeenCalledWith(unread.href);
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(navigation.push.mock.invocationCallOrder[0]);
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
  });

  test('a notification without a destination is marked read while the panel stays open', async () => {
    reply('GET', path, jsonResponse([{ ...unread, href: null }]));
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    fireEvent.press(await screen.findByRole('button', { name: `Unread: ${unread.title}` }));
    expect(callsTo('PATCH', '/me/notifications/notice-1/read')).toHaveLength(1);
    expect(close).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: unread.title })).toBeOnTheScreen();
  });

  test('mark-all only submits unread IDs and removes the unread action after the local update', async () => {
    reply('GET', path, jsonResponse([unread, read, { ...unread, id: 'notice-3', title: 'Upcoming session reminder' }]));
    reply('PATCH', '/me/notifications/notice-3/read', jsonResponse(undefined, 204));
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    fireEvent.press(await screen.findByRole('button', { name: 'Mark all as read' }));
    expect(callsTo('PATCH', '/me/notifications/notice-1/read')).toHaveLength(1);
    expect(callsTo('PATCH', '/me/notifications/notice-3/read')).toHaveLength(1);
    expect(callsTo('PATCH', '/me/notifications/notice-2/read')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
    expect(close).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  test.each([404, 405, 501])('the intentionally missing endpoint HTTP %i degrades to the empty panel', async (status) => {
    reply('GET', path, apiFailure('UNAVAILABLE', 'Endpoint unavailable.', status));
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    await waitFor(() => expect(callsTo('GET', path).length).toBeGreaterThan(0));
    expect(screen.getByText('You are all caught up')).toBeOnTheScreen();
    expect(screen.queryByText('Endpoint unavailable.')).toBeNull();
  });

  test('a read-mark failure does not prevent opening the intended booking', async () => {
    reply('GET', path, jsonResponse([unread]));
    reply('PATCH', '/me/notifications/notice-1/read', new TypeError('offline'));
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    fireEvent.press(await screen.findByRole('button', { name: `Unread: ${unread.title}` }));
    await act(async () => undefined);
    expect(navigation.push).toHaveBeenCalledWith(unread.href);
    expect(close).toHaveBeenCalledTimes(1);
    // Optimistic UI evidence only: the failed request does not prove persistence.
    expect(screen.getByRole('button', { name: unread.title })).toBeOnTheScreen();
  });

  test('an unavailable notification service leaves the surrounding panel usable', async () => {
    reply('GET', path, new TypeError('offline'));
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    await act(async () => undefined);
    expect(callsTo('GET', path).length).toBeGreaterThan(0);
    expect(screen.getByText('Notifications')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
    fireEvent.press(screen.getByLabelText('Close notifications', { includeHiddenElements: true }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('opening the panel again refreshes cached rows from the current server response', async () => {
    reply('GET', path, jsonResponse([unread]));
    const first = await renderPublic(<NotificationsPanel onClose={close} />, session);
    await screen.findByRole('button', { name: `Unread: ${unread.title}` });
    const previousReads = callsTo('GET', path).length;
    first.unmount();
    reply('GET', path, jsonResponse([read]));
    await renderPublic(<NotificationsPanel onClose={close} />, session);
    expect(await screen.findByRole('button', { name: read.title })).toBeOnTheScreen();
    expect(screen.queryByText(unread.title)).toBeNull();
    expect(callsTo('GET', path).length).toBeGreaterThan(previousReads);
  });

  test('logout hides cached private notifications immediately', async () => {
    reply('GET', path, jsonResponse([unread]));
    reply('DELETE', '/auth/sessions/current', jsonResponse(undefined, 204));
    await renderPublic(<><NotificationsPanel onClose={close} /><AuthStatusProbe /></>, session);
    await screen.findByText(unread.title);
    fireEvent.press(screen.getByRole('button', { name: 'Log out probe' }));
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(screen.queryByText(unread.title)).toBeNull();
    expect(screen.getByText('You are all caught up')).toBeOnTheScreen();
  });
});
