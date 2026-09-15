/** Historical probes for stricter field-error and timezone-label UX.
 * Not implemented in this revision; excluded from current implemented-feature QA.
 * Missing fields and the weekly calendar are archived under ../planned/. */
import { apiMock, counsellorProfileFixture, fillService, renderCounsellor, serviceFixture, setupCounsellorMocks } from '../screens/counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Profile from '@/app/counsellor/profile';
import Availability from '@/app/counsellor/availability';
import ServiceForm from '@/src/counsellor/ServiceForm';
import { apiError } from '@/src/api/errors';

beforeEach(setupCounsellorMocks);
const form = () => <ServiceForm counsellorId="counsellor-1" accessToken="counsellor-access-token" />;
async function openProfile() {
  await renderCounsellor(<Profile />);
  await screen.findByDisplayValue(counsellorProfileFixture.introduction);
}

describe('planned counsellor validation and timezone UX', () => {



  test('[QA-130][US30-AC4] displays each backend field error while retaining profile edits', async () => {
    apiMock.updateOwnCounsellorProfile.mockRejectedValueOnce(apiError(400, 'VALIDATION_ERROR',
      'The request could not be validated.', {
        introduction: 'Introduction needs the requested correction.',
        experience: 'Experience needs the requested correction.',
      }));
    await openProfile();
    fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled());
    expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue(counsellorProfileFixture.introduction)).toBeTruthy();
    expect(screen.queryByText('Your profile is saved and visible on your listings.')).toBeNull();
    expect(screen.queryByText('Introduction needs the requested correction.')).not.toBeNull();
    expect(screen.queryByText('Experience needs the requested correction.')).not.toBeNull();
  });

  test('[QA-136][US35-AC2] identifies every missing implemented service field in one submission', async () => {
    await renderCounsellor(form());
    fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    expect(apiMock.createService).not.toHaveBeenCalled();
    // Use the form's existing messages; assert all missing fields, not merely
    // its first generic banner. Category/duration remain separately blocked.
    expect(screen.queryByText('Give the service a clear title of at least 5 characters.')).not.toBeNull();
    expect(screen.queryByText('Describe what the buyer gets in at least 30 characters.')).not.toBeNull();
    expect(screen.queryByText('Enter a price greater than zero.')).not.toBeNull();
  });

  test('[QA-136][US35-AC5] retains and renders backend fieldErrors rather than only the summary', async () => {
    apiMock.createService.mockRejectedValueOnce(apiError(400, 'VALIDATION_ERROR',
      'The request could not be validated.', {
        title: 'This title needs correction.', priceMinor: 'This price needs correction.',
      }));
    await renderCounsellor(form());
    fillService();
    fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish service' })).toBeEnabled());
    expect(apiMock.createService).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Interview coaching')).toBeTruthy();
    expect(screen.queryByText('Service published')).toBeNull();
    expect(screen.queryByText('This title needs correction.')).not.toBeNull();
    expect(screen.queryByText('This price needs correction.')).not.toBeNull();
  });

  test.each(['in_person', 'both'])('[QA-142][US38-AC1] %s visibly marks state and city/region required', async (modality) => {
    await renderCounsellor(form());
    fireEvent.press(screen.getByRole('checkbox', { name: 'In person' }));
    if (modality === 'in_person') fireEvent.press(screen.getByRole('checkbox', { name: 'Online' }));
    expect(screen.getByLabelText('City or region')).toBeTruthy();
    // Allow a shared instruction, separate labels, or conventional asterisks.
    // No requirement is placed on whether state uses a list or free text.
    const shared = screen.queryAllByText(/(?:state.*(?:city|region)|(?:city|region).*state).*(?:required|must)|(?:required|must).*(?:state.*(?:city|region)|(?:city|region).*state)/i).length > 0;
    const stateMarked = screen.queryAllByText(/state.*(?:required|\*)/i).length > 0;
    const cityMarked = screen.queryAllByText(/(?:city|region).*(?:required|\*)/i).length > 0;
    expect(shared || (stateMarked && cityMarked)).toBe(true);
  });

  test('[QA-145][US39-AC1] availability times include a visible timezone', async () => {
    const start = new Date(Date.now() + 86400000);
    apiMock.listOwnAvailabilitySlots.mockResolvedValue([{
      id: 'zone-slot', serviceId: serviceFixture.id, status: 'open',
      startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600000).toISOString(),
    }]);
    await renderCounsellor(<Availability />);
    await screen.findByText(serviceFixture.title);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const abbreviation = new Intl.DateTimeFormat('en-AU', { timeZoneName: 'short' })
      .formatToParts(start).find(part => part.type === 'timeZoneName')?.value;
    const accepted = [timezone, abbreviation].filter((value): value is string => Boolean(value));
    const labelVisible = accepted.some(value => screen.queryAllByText(
      new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    ).length > 0);
    expect(labelVisible).toBe(true);
  });
});
