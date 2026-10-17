import { screen } from '@testing-library/react-native';
import { jsonResponse, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import ServiceDetail from '@/app/services/[serviceId]';
import Professional from '@/app/professionals/[counsellorId]';
import Marketplace from '@/app/marketplace';
import { counsellorProfileFixture, serviceFixture } from '../fixtures';

describe('US-54/55 / QA-216/219 public feedback response contract', () => {
  test('a backend-shaped anonymous review retains its stars/comment without inventing an author name', async () => {
    routeParams({ serviceId: serviceFixture.id });
    reply('GET', `/services/${serviceFixture.id}`, jsonResponse({
      ...serviceFixture,
      averageRating: 3, reviewCount: 1,
      // The deployed API returns jobSeekerId, not the frontend-only authorName.
      reviews: [{
        id: 'review-wire-1', bookingId: 'booking-1', serviceId: serviceFixture.id,
        jobSeekerId: 'private-reviewer-identifier', rating: 3,
        comment: 'Useful next steps for my search.', createdAt: '2026-08-27T00:00:00Z',
      }],
    }));
    await renderPublic(<ServiceDetail />);
    expect(await screen.findByText('Useful next steps for my search.')).toBeOnTheScreen();
    expect(screen.getByText('3/5')).toBeOnTheScreen();
    expect(screen.getByText('Yoir member')).toBeOnTheScreen();
    expect(screen.getByText('★ 3.0 · 1 reviews')).toBeOnTheScreen();
    expect(screen.queryByText('private-reviewer-identifier')).toBeNull();
    expect(screen.queryByText('Alex Morgan')).toBeNull();
  });

  test('catalogue, service detail and profile render the same returned overall rating independently of the service average', async () => {
    const service = {
      ...serviceFixture, averageRating: 2.5, reviewCount: 2,
      counsellor: { ...serviceFixture.counsellor, overallRating: 4.25, reviewCount: 8 },
    };
    reply('GET', '/services', jsonResponse([service]));
    reply('GET', `/services/${service.id}`, jsonResponse(service));
    reply('GET', `/counsellors/${service.counsellor.id}`, jsonResponse({
      ...counsellorProfileFixture, overallRating: 4.25, reviewCount: 8,
    }));
    const catalogue = await renderPublic(<Marketplace />);
    await tick();
    expect(screen.getByText('Career Professional · ★ 4.3 (8)')).toBeOnTheScreen();
    catalogue.unmount();

    routeParams({ serviceId: service.id });
    const detail = await renderPublic(<ServiceDetail />);
    expect(await screen.findByText('4.3 · 8 reviews')).toBeOnTheScreen();
    expect(screen.getByText('★ 2.5 · 2 reviews')).toBeOnTheScreen();
    detail.unmount();

    routeParams({ counsellorId: service.counsellor.id });
    await renderPublic(<Professional />);
    expect(await screen.findByText('★ 4.3 · 8 reviews')).toBeOnTheScreen();
    expect(screen.queryByText('★ 2.5 · 2 reviews')).toBeNull();
  });
});
