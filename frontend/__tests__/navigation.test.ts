import { router } from 'expo-router';
import { goBack, homeFor } from '@/src/navigation';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const canGoBack = router.canGoBack as jest.MockedFunction<typeof router.canGoBack>;
const back = router.back as jest.MockedFunction<typeof router.back>;
const replace = router.replace as jest.MockedFunction<typeof router.replace>;

describe('going back', () => {
  beforeEach(() => jest.clearAllMocks());

  test('steps back when there is history behind the screen', () => {
    canGoBack.mockReturnValue(true);

    goBack('/counsellor');

    expect(back).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  test('goes to the parent when the screen was opened directly', () => {
    // On the web this is the common case: someone follows a link to a deep page, or
    // reloads it. router.back() would report an unhandled GO_BACK and do nothing,
    // leaving them on a page whose back arrow is dead.
    canGoBack.mockReturnValue(false);

    goBack('/counsellor');

    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/counsellor');
  });

  test('a parametrised parent is passed through as given', () => {
    canGoBack.mockReturnValue(false);
    const parent = { pathname: '/services/[serviceId]', params: { serviceId: 'svc_1' } } as const;

    goBack(parent);

    expect(replace).toHaveBeenCalledWith(parent);
  });

  test('replaces rather than pushes, so back does not stack up entries', () => {
    canGoBack.mockReturnValue(false);

    goBack('/marketplace');

    // A step backwards should not add another entry to walk back through.
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe('where a role starts', () => {
  test('a Platform Owner opens on the dashboard, not the marketplace', () => {
    // There is nothing for them to browse or book, and the administration screens
    // are the whole of their app — so logging in should land them there directly.
    expect(homeFor('platform_owner')).toBe('/admin');
  });

  test('a counsellor opens on their workspace and a job seeker on their home', () => {
    expect(homeFor('counsellor')).toBe('/counsellor');
    expect(homeFor('job_seeker')).toBe('/job-seeker');
  });
});
