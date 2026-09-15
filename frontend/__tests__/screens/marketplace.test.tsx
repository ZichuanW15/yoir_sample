import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, tick } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import MarketplaceScreen from '@/app/marketplace';
import { serviceFixture, sessionFixture } from '../fixtures';
import { Service } from '@/src/api/types';

const inPerson: Service = {
  ...serviceFixture, id: 'service-2', title: 'Graduate career plan', priceMinor: 5500, modalities: ['in_person'],
  location: { state: 'NSW', cityOrRegion: 'Sydney' }, averageRating: 4.1,
  counsellor: { ...serviceFixture.counsellor, id: 'counsellor-2', displayName: 'Jordan Lee' },
};
const catalogue = [serviceFixture, inPerson];
const listing = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title} by`) });
async function load() {
  reply('GET', '/services', jsonResponse(catalogue));
  renderPublic(<MarketplaceScreen />);
  await tick();
}

describe('Marketplace screen', () => {
  test('[QA-109] guests see loading then public services without authentication', async () => {
    const pending = deferred<Response>();
    reply('GET', '/services', pending.promise);
    renderPublic(<MarketplaceScreen />);
    expect(screen.getByText('Loading services')).toBeOnTheScreen();
    await act(async () => pending.resolve(jsonResponse(catalogue)));
    await tick();
    expect(listing(serviceFixture.title)).toBeOnTheScreen();
    expect(screen.getByText('2 of 2 services')).toBeOnTheScreen();
    expect(callsTo('GET', '/services')[0][1]?.headers).not.toHaveProperty('Authorization');
    fireEvent.press(listing(serviceFixture.title));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/services/[serviceId]', params: { serviceId: serviceFixture.id } });
  });

  test('[QA-109] a failed catalogue request shows a retry that restores the list', async () => {
    reply('GET', '/services', apiFailure('SERVER_ERROR', 'Catalogue is temporarily unavailable.', 503));
    renderPublic(<MarketplaceScreen />);
    await tick();
    expect(screen.getByText('Catalogue is temporarily unavailable.')).toBeOnTheScreen();
    reply('GET', '/services', jsonResponse(catalogue));
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Loading services')).toBeOnTheScreen();
    await tick();
    expect(listing(serviceFixture.title)).toBeOnTheScreen();
    expect(screen.queryByText('Catalogue is temporarily unavailable.')).toBeNull();
  });

  test('[QA-109] an empty catalogue has an explicit empty state', async () => {
    reply('GET', '/services', jsonResponse([]));
    renderPublic(<MarketplaceScreen />);
    await tick();
    expect(screen.getByText('No services match your search.')).toBeOnTheScreen();
    expect(screen.getByText('0 of 0 services')).toBeOnTheScreen();
  });

  // Current UI filters the loaded catalogue locally. The unconnected backend-driven
  // search requirements are archived in planned/public-search-and-selection.
  test('[QA-112 implemented local UI] local search and clearing render correctly', async () => {
    await load();
    fireEvent.changeText(screen.getByLabelText('Search services or counsellors'), '  JORDAN  ');
    expect(listing(inPerson.title)).toBeOnTheScreen();
    expect(screen.queryByText(serviceFixture.title)).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Search services or counsellors'), 'no such service');
    expect(screen.getByText('No services match your search.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(listing(serviceFixture.title)).toBeOnTheScreen();
  });

  test('[QA-112 implemented local UI] local filter controls narrow cards', async () => {
    await load();
    fireEvent.press(screen.getByRole('button', { name: 'Show filters' }));
    fireEvent.press(screen.getByRole('radio', { name: 'In person' }));
    fireEvent.press(screen.getByRole('radio', { name: 'NSW' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Under $75' }));
    fireEvent.press(screen.getByRole('radio', { name: '4.0+' }));
    expect(screen.getByText('1 of 2 services')).toBeOnTheScreen();
    expect(listing(inPerson.title)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('radio', { name: '4.5+' }));
    expect(screen.getByText('No services match your search.')).toBeOnTheScreen();
  });

  test('[QA-112 implemented local UI] local price sort changes card order', async () => {
    await load();
    fireEvent.press(screen.getByRole('button', { name: 'Show filters' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Price: low to high' }));
    expect(screen.getAllByRole('button', { name: / by .*\$/ }).map((node) => node.props.accessibilityLabel)).toEqual([
      'Graduate career plan by Jordan Lee, $55', 'Interview confidence coaching by Maya Chen, $95',
    ]);
  });

  test('[QA-106] a signed-in user can open the real account sheet and log out', async () => {
    reply('GET', '/services', jsonResponse(catalogue));
    reply('DELETE', '/auth/sessions/current', jsonResponse(undefined, 204));
    renderPublic(<MarketplaceScreen />, sessionFixture);
    await screen.findByRole('button', { name: 'Account, Alex Morgan' });
    fireEvent.press(screen.getByRole('button', { name: 'Account, Alex Morgan' }));
    fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    expect(navigation.replace).toHaveBeenCalledWith('/');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeOnTheScreen();
    expect(callsTo('DELETE', '/auth/sessions/current')).toHaveLength(1);
  });
});
