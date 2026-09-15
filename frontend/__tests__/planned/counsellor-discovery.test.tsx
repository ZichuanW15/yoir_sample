/** Historical requirement probes: counsellor list/detail routes do not exist.
 * Excluded from the current implemented-feature QA scope. */
import { jsonResponse, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import { screen } from '@testing-library/react-native';
import MarketplaceScreen from '@/app/marketplace';
import DetailScreen from '@/app/services/[serviceId]';
import { serviceFixture } from '../fixtures';

describe('planned public counsellor discovery routes', () => {
  test('[QA-109][US44-AC2] public marketplace offers a separate counsellor-list entry', async () => {
    reply('GET', '/services', jsonResponse([serviceFixture]));
    renderPublic(<MarketplaceScreen />);
    await tick();
    const entries = (['button', 'tab', 'link'] as const).flatMap(role => screen.queryAllByRole(role, { name: /^(browse |view |all )?counsellors$/i }));
    expect(entries.length).toBeGreaterThan(0);
  });

  test('[QA-115][US46-AC2] service detail exposes an actionable counsellor-detail entry', async () => {
    routeParams({ serviceId: serviceFixture.id });
    reply('GET', '/services/service-1', jsonResponse(serviceFixture));
    renderPublic(<DetailScreen />);
    await screen.findByText(serviceFixture.counsellor.displayName);
    const entries = (['button', 'link'] as const).flatMap(role => [
      ...screen.queryAllByRole(role, { name: serviceFixture.counsellor.displayName }),
      ...screen.queryAllByRole(role, { name: /(?:view|open|meet|about).*(?:profile|counsellor)|counsellor (?:profile|details)/i }),
    ]);
    expect(entries.length).toBeGreaterThan(0);
    // This asserts the missing entry only. The absent detail route/contract
    // remains BLOCKED; arbitrary navigation is not proof of the destination.
  });
});
