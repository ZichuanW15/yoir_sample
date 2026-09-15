/** The implemented slot picker must explain an empty successful response. */
import { callsTo, jsonResponse, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import { screen } from '@testing-library/react-native';
import TimeSlotsScreen from '@/app/services/[serviceId]/timeslots';
import { serviceFixture, sessionFixture } from '../fixtures';

describe('implemented slot picker empty-response feedback', () => {
  test('[QA-118][US40-AC4] no open slots has an explicit empty state, not an unexplained blank picker', async () => {
    routeParams({ serviceId: serviceFixture.id });
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
    reply('GET', '/services/service-1/slots', jsonResponse([]));
    renderPublic(<TimeSlotsScreen />, sessionFixture);
    await tick();
    expect(callsTo('GET', '/services/service-1/slots')).toHaveLength(1);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    expect(screen.queryByText(/no (?:\w+ ){0,3}(?:slots|times|sessions)|fully booked/i)).not.toBeNull();
  });
});
