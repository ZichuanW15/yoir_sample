import { apiMock, deferred, fillService, renderCounsellor, serviceFixture, setupCounsellorMocks, settle } from './counsellor-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import EditService from '@/app/counsellor/services/[serviceId]/edit';
import NewService from '@/app/counsellor/services/new';
import { apiError } from '@/src/api/errors';
import { sessionFixture } from '../fixtures';
beforeEach(() => { setupCounsellorMocks(); (useLocalSearchParams as jest.Mock).mockReturnValue({ serviceId: 'service-1' }); });
describe('Counsellor service route UI — QA #133 #136 (mocked API boundary)', () => {
  test.each([NewService, EditService])('does not expose a service form to a Job Seeker', async (Component) => {
    await renderCounsellor(<Component />, sessionFixture); expect(screen.getByTestId('redirect')).toBeTruthy(); expect(screen.queryByLabelText('Service title')).toBeNull();
  });
  test('new route submits through the real form with the authenticated owner and token', async () => {
    await renderCounsellor(<NewService />); fillService(); fireEvent.press(screen.getByRole('button', { name: 'Publish service' })); await screen.findByText('Service published');
    expect(apiMock.createService).toHaveBeenCalledWith('counsellor-1', expect.objectContaining({ title: 'Interview coaching' }), 'counsellor-access-token');
  });
  test('does not show editable values until loading finishes, then pre-fills the matching owned service', async () => {
    const pending = deferred<typeof serviceFixture[]>(); apiMock.listOwnServices.mockReturnValueOnce(pending.promise);
    await renderCounsellor(<EditService />); expect(screen.queryByLabelText('Service title')).toBeNull();
    await settle(pending, [{ ...serviceFixture, id: 'other', title: 'Another listing' }, serviceFixture]);
    expect(screen.getByDisplayValue(serviceFixture.title)).toBeTruthy(); expect(screen.getByDisplayValue('95')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Service title'), 'Updated interview session'); fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Service updated'); expect(apiMock.updateService).toHaveBeenCalledWith('service-1', expect.objectContaining({ title: 'Updated interview session' }), 'counsellor-access-token');
  });
  test('a missing service shows a recoverable error instead of an unrelated service', async () => {
    apiMock.listOwnServices.mockResolvedValue([{ ...serviceFixture, id: 'someone-else' }]); await renderCounsellor(<EditService />);
    await screen.findByText('This service is no longer available.'); expect(screen.queryByLabelText('Service title')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Back to workspace' })); expect(router.replace).toHaveBeenCalledWith('/counsellor');
  });
  test('a failed load displays the server error and supports leaving the screen', async () => {
    apiMock.listOwnServices.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Could not load your services.')); await renderCounsellor(<EditService />);
    await screen.findByText('Could not load your services.'); fireEvent.press(screen.getByRole('button', { name: 'Back' })); expect(router.back).toHaveBeenCalled(); expect(apiMock.updateService).not.toHaveBeenCalled();
  });
});
