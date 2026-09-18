import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import ServiceDetailScreen from '@/app/services/[serviceId]';
import { counsellorSessionFixture, serviceFixture, sessionFixture } from '../fixtures';

describe('service detail screen', () => {
  beforeEach(() => routeParams({ serviceId: serviceFixture.id }));

  test('[QA-115] loads the selected public service, counsellor and delivery information', async () => {
    const pending = deferred<Response>();
    reply('GET', '/services/service-1', pending.promise);
    await renderPublic(<ServiceDetailScreen />);
    expect(screen.queryByText(serviceFixture.title)).toBeNull();
    await act(async () => pending.resolve(jsonResponse({ ...serviceFixture, modalities: ['online', 'in_person'], location: { state: 'VIC', cityOrRegion: 'Melbourne' } })));
    expect(await screen.findByText(serviceFixture.title)).toBeOnTheScreen();
    expect(screen.getByText(serviceFixture.description)).toBeOnTheScreen();
    expect(screen.getByText('Maya Chen')).toBeOnTheScreen();
    expect(screen.getByText('Melbourne, VIC')).toBeOnTheScreen();
    expect(screen.getByText('Verified counsellor')).toBeOnTheScreen();
    expect(callsTo('GET', '/services/service-1')[0][1]?.headers).not.toHaveProperty('Authorization');
  });

  test('[QA-115] not-found errors offer a retry and never expose a booking button', async () => {
    reply('GET', '/services/service-1', apiFailure('NOT_FOUND', 'Service not found.', 404));
    await renderPublic(<ServiceDetailScreen />);
    expect(await screen.findByText('Service not found.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Book this service' })).toBeNull();
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Book this service' })).toBeOnTheScreen();
  });

  test('[QA-100/115] guest booking continues through login with the service ID', async () => {
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
    await renderPublic(<ServiceDetailScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Book this service' }));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/auth/login', params: { serviceId: serviceFixture.id } });
  });

  test('[QA-118] a signed-in job seeker continues to available times', async () => {
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
    await renderPublic(<ServiceDetailScreen />, sessionFixture);
    fireEvent.press(await screen.findByRole('button', { name: 'Book this service' }));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/services/[serviceId]/timeslots', params: { serviceId: serviceFixture.id } });
  });

  test('[QA-100] counsellors cannot continue into the buyer booking flow', async () => {
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
    await renderPublic(<ServiceDetailScreen />, counsellorSessionFixture);
    fireEvent.press(await screen.findByRole('button', { name: 'Book this service' }));
    expect(screen.getByText('Only Job Seekers can book a service.')).toBeOnTheScreen();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  test('[QA-115] unrated pending counsellors do not acquire invented ratings or verification', async () => {
    reply('GET', '/services/service-1', jsonResponse({ ...serviceFixture, averageRating: null, reviewCount: 0, counsellor: { ...serviceFixture.counsellor, verificationStatus: 'pending', overallRating: null, reviewCount: 0 } }));
    await renderPublic(<ServiceDetailScreen />);
    expect(await screen.findByText('New on Yoir')).toBeOnTheScreen();
    expect(screen.getByText('No reviews yet')).toBeOnTheScreen();
    expect(screen.getByText('Verification pending')).toBeOnTheScreen();
  });
});
