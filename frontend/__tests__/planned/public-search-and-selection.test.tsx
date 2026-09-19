/** Historical backend-driven search and explicit-choice UX requirement probes.
 * Not implemented in this revision; excluded from current implemented-feature QA.
 * Missing contract fields/operations remain BLOCKED in acceptance-traceability.md;
 * this suite does not invent their wire format or manufacture a passing response.
 */
import { apiFailure, callsTo, fetchMock, jsonResponse, navigation, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import MarketplaceScreen from '@/app/marketplace';
import TimeSlotsScreen from '@/app/services/[serviceId]/timeslots';
import { orderFixture, serviceFixture, sessionFixture, slotFixture } from '../fixtures';

function listingRequests() {
  return fetchMock.mock.calls.filter(([url, init]) =>
    (init?.method ?? 'GET') === 'GET' && new URL(String(url)).pathname.endsWith('/services'));
}

describe('planned public search integration and explicit delivery choice', () => {
  test('[QA-112][US45-AC1] keyword is sent to the backend and only its response is displayed', async () => {
    reply('GET', '/services', jsonResponse([serviceFixture]));
    await renderPublic(<MarketplaceScreen />);
    await tick();
    const serverResult = { ...serviceFixture, id: 'server-result', title: 'Server-selected coaching' };
    reply('GET', '/services', jsonResponse([serverResult]));
    fireEvent.changeText(screen.getByLabelText('Search services or Career Professionals'), 'coaching');
    await tick();
    const requested = listingRequests().filter(([url]) => new URL(String(url)).searchParams.get('query') === 'coaching');
    expect(requested.length).toBeGreaterThan(0);
    expect(screen.getByText(serverResult.title)).toBeOnTheScreen();
    expect(screen.queryByText(serviceFixture.title)).toBeNull();
  });

  test('[QA-112][US45-AC2] supported modality filter is sent to the backend', async () => {
    reply('GET', '/services', jsonResponse([serviceFixture]));
    await renderPublic(<MarketplaceScreen />);
    await tick();
    reply('GET', '/services', jsonResponse([]));
    fireEvent.press(screen.getByRole('button', { name: 'Show filters' }));
    fireEvent.press(screen.getByRole('radio', { name: 'In person' }));
    await tick();
    // `modality` is the implemented backend parameter; no invented sort/filter keys.
    expect(listingRequests().some(([url]) => new URL(String(url)).searchParams.get('modality') === 'in_person')).toBe(true);
    expect(screen.getByRole('radio', { name: 'In person' })).toBeChecked();
  });

  test('[QA-112][US45-AC6] failed search reports the server error, not a locally filtered old catalogue', async () => {
    reply('GET', '/services', jsonResponse([serviceFixture]));
    await renderPublic(<MarketplaceScreen />);
    await tick();
    reply('GET', '/services', apiFailure('UNAVAILABLE', 'Search service is unavailable.', 503));
    fireEvent.changeText(screen.getByLabelText('Search services or Career Professionals'), 'coaching');
    await tick();
    expect(screen.queryByText('Search service is unavailable.')).not.toBeNull();
    expect(screen.queryByText(serviceFixture.title)).toBeNull();
  });

  test('[QA-112][US45-AC5] server-confirmed empty search retains criteria without an error', async () => {
    reply('GET', '/services', jsonResponse([serviceFixture]));
    await renderPublic(<MarketplaceScreen />);
    await tick();
    reply('GET', '/services', jsonResponse([]));
    fireEvent.changeText(screen.getByLabelText('Search services or Career Professionals'), 'no matching result');
    await tick();
    expect(listingRequests().some(([url]) => new URL(String(url)).searchParams.get('query') === 'no matching result')).toBe(true);
    expect(screen.getByLabelText('Search services or Career Professionals')).toHaveProp('value', 'no matching result');
    expect(screen.getByText('No services match your search.')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });



  test('[QA-118][US40-AC3] both-modality booking requires an explicit delivery choice before continuing', async () => {
    routeParams({ serviceId: serviceFixture.id });
    reply('GET', '/services/service-1', jsonResponse({ ...serviceFixture, modalities: ['online', 'in_person'], location: { state: 'VIC', cityOrRegion: 'Melbourne' } }));
    reply('GET', '/services/service-1/slots', jsonResponse([slotFixture]));
    reply('POST', '/orders', jsonResponse(orderFixture, 201));
    await renderPublic(<TimeSlotsScreen />, sessionFixture);
    await tick();
    fireEvent.press(screen.getByRole('radio', { name: /60 min$/ }));
    // Both disabled controls and click-time validation are valid implementations.
    fireEvent.press(screen.getByRole('button', { name: 'Continue to payment' }));
    await tick();
    expect(callsTo('POST', '/orders')).toHaveLength(0);
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('radio', { name: 'In person' }));
    fireEvent.press(screen.getByRole('button', { name: 'Continue to payment' }));
    await tick();
    expect(callsTo('POST', '/orders')).toHaveLength(1);
    expect(JSON.parse(String(callsTo('POST', '/orders')[0][1]?.body))).toMatchObject({ modality: 'in_person' });
    expect(navigation.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/bookings/checkout' }));
  });
});
