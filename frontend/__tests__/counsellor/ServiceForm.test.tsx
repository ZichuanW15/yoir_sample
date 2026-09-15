import { apiMock, deferred, fillService, renderCounsellor, serviceFixture, setupCounsellorMocks, settle } from '../screens/counsellor-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import ServiceForm from '@/src/counsellor/ServiceForm';
import { apiError } from '@/src/api/errors';
const form = (editing = false) => <ServiceForm counsellorId="counsellor-1" accessToken="counsellor-access-token" service={editing ? serviceFixture : undefined} />;
beforeEach(setupCounsellorMocks);
describe('ServiceForm UI — QA #133 #136 #139 #142 (mocked API/HTTP boundary)', () => {
  test('creates a trimmed online service and announces success only after the API confirms', async () => {
    const real = jest.requireActual('@/src/api/client') as typeof import('@/src/api/client');
    expect(real.isDemoApi).toBe(false); apiMock.createService.mockImplementation(real.api.createService);
    const pending = deferred<Response>(); const fetchMock = jest.spyOn(global, 'fetch').mockReturnValueOnce(pending.promise);
    await renderCounsellor(form()); fillService({ title: '  Interview coaching  ' });
    fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    expect(apiMock.createService).toHaveBeenCalledWith('counsellor-1', { title: 'Interview coaching', description: 'A practical coaching session with individual interview feedback.', priceMinor: 9525, currency: 'AUD', modalities: ['online'], location: null }, 'counsellor-access-token');
    expect(screen.getByRole('button', { name: 'Publish service' })).toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled(); expect(screen.queryByText('Service published')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Publish service' })); expect(apiMock.createService).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/me\/services$/), expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer counsellor-access-token' }), body: JSON.stringify({ title: 'Interview coaching', description: 'A practical coaching session with individual interview feedback.', priceMinor: 9525, currency: 'AUD', modalities: ['online'], location: null }) }));
    await settle(pending, { ok: true, status: 201, json: async () => serviceFixture } as Response); expect(router.replace).toHaveBeenCalledWith('/counsellor'); expect(screen.getByText('Service published')).toBeTruthy();
  });
  test.each([
    [{ title: 'abcd' }, 'Give the service a clear title of at least 5 characters.'],
    [{ description: 'too short' }, 'Describe what the buyer gets in at least 30 characters.'],
    [{ price: '' }, 'Enter a price greater than zero.'], [{ price: '0' }, 'Enter a price greater than zero.'],
    [{ price: 'not a price' }, 'Enter a price greater than zero.'], [{ price: '1.2.3' }, 'Enter a price greater than zero.'],
    [{ price: '100000.01' }, 'Enter a price under $100,000.'],
  ])('rejects incomplete or invalid input %j without creating a listing', async (input, message) => {
    await renderCounsellor(form()); fillService(input); fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    expect(screen.getByText(message)).toBeTruthy(); expect(apiMock.createService).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
  });
  test('requires at least one modality after deselecting online', async () => {
    await renderCounsellor(form()); fillService(); fireEvent.press(screen.getByRole('checkbox', { name: 'Online' }));
    fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    expect(screen.getByText('Choose at least one way you deliver this service.')).toBeTruthy(); expect(apiMock.createService).not.toHaveBeenCalled();
  });
  test.each(['in_person', 'both'])('requires state and city for %s, then saves the selected meeting area', async (mode) => {
    await renderCounsellor(form()); fillService(); fireEvent.press(screen.getByRole('checkbox', { name: 'In person' }));
    if (mode === 'in_person') fireEvent.press(screen.getByRole('checkbox', { name: 'Online' }));
    fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    expect(screen.getByText('In-person delivery needs the state and city where you meet.')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'VIC' })); fireEvent.press(screen.getByRole('button', { name: 'Publish service' })); expect(apiMock.createService).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('City or region'), '  Melbourne  '); fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    await screen.findByText('Service published'); expect(apiMock.createService).toHaveBeenCalledWith('counsellor-1', expect.objectContaining({ modalities: mode === 'both' ? ['online', 'in_person'] : ['in_person'], location: { state: 'VIC', cityOrRegion: 'Melbourne' } }), 'counsellor-access-token');
  });
  test('switching an in-person edit to online clears its meeting area in the submitted update', async () => {
    await renderCounsellor(<ServiceForm counsellorId="counsellor-1" accessToken="counsellor-access-token" service={{ ...serviceFixture, modalities: ['in_person'], location: { state: 'VIC', cityOrRegion: 'Melbourne' } }} />);
    expect(screen.getByDisplayValue(serviceFixture.title)).toBeTruthy(); fireEvent.press(screen.getByRole('checkbox', { name: 'Online' })); fireEvent.press(screen.getByRole('checkbox', { name: 'In person' }));
    expect(screen.queryByLabelText('City or region')).toBeNull(); fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Service updated'); expect(apiMock.updateService).toHaveBeenCalledWith('service-1', expect.objectContaining({ modalities: ['online'], location: null }), 'counsellor-access-token');
  });
  test('preserves form values and permits retry after a server rejection', async () => {
    apiMock.createService.mockRejectedValueOnce(apiError(403, 'NOT_VERIFIED', 'Your counsellor profile must be verified before publishing services.'));
    await renderCounsellor(form()); fillService(); fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    await screen.findByText('Your counsellor profile must be verified before publishing services.'); expect(screen.getByDisplayValue('Interview coaching')).toBeTruthy(); expect(screen.queryByText('Service published')).toBeNull(); expect(router.replace).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Publish service' })); await screen.findByText('Service published');
  });
  test('deletion needs confirmation and returns only after mocked API success', async () => {
    await renderCounsellor(form(true)); fireEvent.press(screen.getByRole('button', { name: 'Delete service' })); expect(screen.getByText('Delete this service?')).toBeTruthy();
    fireEvent.press(screen.getAllByRole('button', { name: 'Cancel' })[1]); expect(apiMock.deleteService).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Delete service' })); fireEvent.press(screen.getByRole('button', { name: 'Delete' })); await screen.findByText('Service deleted');
    expect(apiMock.deleteService).toHaveBeenCalledWith('service-1', 'counsellor-access-token'); expect(router.replace).toHaveBeenCalledWith('/counsellor');
  });
  test('failed deletion keeps the service editable and does not announce success', async () => {
    apiMock.deleteService.mockRejectedValueOnce(apiError(409, 'BOOKINGS_EXIST', 'This service has active bookings.'));
    await renderCounsellor(form(true)); fireEvent.press(screen.getByRole('button', { name: 'Delete service' })); fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('This service has active bookings.'); expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled(); expect(screen.queryByText('Service deleted')).toBeNull(); expect(router.replace).not.toHaveBeenCalled();
  });
});
