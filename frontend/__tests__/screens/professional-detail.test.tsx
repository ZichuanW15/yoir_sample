import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import Professional from '@/app/professionals/[counsellorId]';
import { counsellorProfileFixture as profile, serviceFixture } from '../fixtures';

beforeEach(() => {
  routeParams({ counsellorId: profile.id });
  reply('GET', `/counsellors/${profile.id}`, jsonResponse(profile));
  reply('GET', '/services', jsonResponse([serviceFixture]));
});

describe('public professional detail — QA-186/219', () => {
  test('waits for profile and services before presenting identity or booking navigation', async () => {
    const pending = deferred<Response>();
    reply('GET', `/counsellors/${profile.id}`, pending.promise);
    await renderPublic(<Professional />);
    expect(screen.queryByText(profile.displayName)).toBeNull();
    expect(screen.queryByRole('button', { name: serviceFixture.title })).toBeNull();
    await act(async () => pending.resolve(jsonResponse(profile)));
    expect(await screen.findByText(profile.displayName)).toBeOnTheScreen();
    expect(callsTo('GET', `/counsellors/${profile.id}`)).toHaveLength(1);
  });

  test('renders returned qualifications, location and rating, and only this professional’s services', async () => {
    reply('GET', '/services', jsonResponse([serviceFixture, {
      ...serviceFixture, id: 'foreign-service', title: 'Another professional service',
      counsellor: { ...serviceFixture.counsellor, id: 'foreign-owner' },
    }]));
    await renderPublic(<Professional />);
    expect(await screen.findByText(profile.displayName)).toBeOnTheScreen();
    expect(screen.getByText('★ 4.9 · 46 reviews')).toBeOnTheScreen();
    expect(screen.getByText(profile.qualifications[0])).toBeOnTheScreen();
    expect(screen.getByText(profile.background)).toBeOnTheScreen();
    expect(screen.getByText(profile.experience)).toBeOnTheScreen();
    expect(screen.getByText(/Melbourne, VIC/)).toBeOnTheScreen();
    expect(screen.queryByText('Another professional service')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: serviceFixture.title }));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/services/[serviceId]', params: { serviceId: serviceFixture.id } });
  });

  test('requests the exact external LinkedIn URL without claiming an OS handoff', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderPublic(<Professional />);
    fireEvent.press(await screen.findByRole('button', { name: 'View LinkedIn profile' }));
    expect(open).toHaveBeenCalledWith(profile.linkedinUrl);
  });

  test.each(['profile', 'services'] as const)('a failed %s read hides profile data until a successful retry', async (boundary) => {
    const path = boundary === 'profile' ? `/counsellors/${profile.id}` : '/services';
    reply('GET', path, apiFailure('UNAVAILABLE', 'Profile information unavailable.', 503));
    await renderPublic(<Professional />);
    expect(await screen.findByText('Profile information unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText(profile.background)).toBeNull();
    reply('GET', path, jsonResponse(boundary === 'profile' ? profile : [serviceFixture]));
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(profile.displayName)).toBeOnTheScreen();
    expect(screen.queryByText('Profile information unavailable.')).toBeNull();
  });

  test.each([
    { restricted: true }, { visibility: 'restricted' },
  ])('a restricted response never reconstructs private content from services: %j', async (restriction) => {
    reply('GET', `/counsellors/${profile.id}`, jsonResponse({ ...profile, ...restriction }));
    await renderPublic(<Professional />);
    expect(await screen.findByText('This profile is restricted')).toBeOnTheScreen();
    expect(screen.queryByText(profile.background)).toBeNull();
    expect(screen.queryByText(profile.displayName)).toBeNull();
    expect(screen.queryByRole('button', { name: serviceFixture.title })).toBeNull();
    navigation.canGoBack.mockReturnValue(false);
    fireEvent.press(screen.getByRole('button', { name: 'Back to Explore' }));
    expect(navigation.replace).toHaveBeenCalledWith('/marketplace');
  });

  test('a sparse partially visible response omits unavailable sections and external links', async () => {
    reply('GET', `/counsellors/${profile.id}`, jsonResponse({
      ...profile, visibility: 'partial', background: '', experience: '', introduction: '', linkedinUrl: '',
      qualifications: undefined, expertise: undefined, languages: undefined, baseLocation: null,
    }));
    reply('GET', '/services', jsonResponse([]));
    await renderPublic(<Professional />);
    expect(await screen.findByText('No services are listed right now.')).toBeOnTheScreen();
    for (const title of ['Qualifications', 'Skills and expertise', 'Languages', 'Background', 'Experience']) {
      expect(screen.queryByText(title)).toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'View LinkedIn profile' })).toBeNull();
    expect(screen.queryByText(profile.background)).toBeNull();
  });

  test('an unrated pending profile does not fabricate a score or verified badge', async () => {
    reply('GET', `/counsellors/${profile.id}`, jsonResponse({
      ...profile, verificationStatus: 'pending', overallRating: null, reviewCount: 0,
    }));
    await renderPublic(<Professional />);
    expect(await screen.findByText('Verification pending')).toBeOnTheScreen();
    expect(screen.queryByText('Verified Career Professional')).toBeNull();
    expect(screen.queryByText(/★/)).toBeNull();
    // No invented rating is covered here. Explicit "unrated" copy remains a separate acceptance gap.
  });
});
