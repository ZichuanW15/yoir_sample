import { apiFailure, callsTo, fetchMock, jsonResponse, navigation, renderPublic, reply, routeParams, tick } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import MarketplaceScreen from '@/app/marketplace';
import { Service } from '@/src/api/types';
import { completeDiagnosis, diagnosisCriteria, diagnosisDirection, diagnosisQuestionnaire } from '../diagnosis-fixtures';
import { serviceFixture, sessionFixture } from '../fixtures';

const other: Service = { ...serviceFixture, id: 'service-2', title: 'Career planning', counsellor: { ...serviceFixture.counsellor, id: 'counsellor-2', displayName: 'Jordan Lee' } };
const labels = () => screen.getAllByRole('button', { name: / by .*\$/ }).map((node) => node.props.accessibilityLabel);
beforeEach(() => {
  routeParams({ match: '1' });
  reply('GET', '/me/diagnosis/questionnaire', jsonResponse(diagnosisQuestionnaire));
  reply('GET', '/me/diagnosis', jsonResponse(completeDiagnosis));
  reply('GET', '/diagnoses/diagnosis-1/direction', jsonResponse(diagnosisDirection));
  reply('GET', '/diagnoses/diagnosis-1/marketplace-criteria', jsonResponse(diagnosisCriteria));
  // The HTTP boundary returns a different subset for server matching than for the full catalogue.
  reply('GET', '/services', () => {
    const last = callsTo('GET', '/services').at(-1)!;
    return jsonResponse(new URL(String(last[0])).searchParams.has('query') ? [other] : [serviceFixture, other]);
  });
  reply('GET', '/me/notifications', jsonResponse([]));
});

describe('Explore consumes backend diagnosis criteria — QA-174', () => {
  test('server matched IDs take precedence over local title keywords; toggle restores catalogue order', async () => {
    await renderPublic(<MarketplaceScreen />, sessionFixture);
    await tick();
    expect(await screen.findByText('Interview skills')).toBeOnTheScreen();
    expect(labels()).toEqual(['Career planning by Jordan Lee, $95', 'Interview confidence coaching by Maya Chen, $95']);
    const queries = callsTo('GET', '/services').map(([url]) => new URL(String(url)).search);
    expect(queries).toEqual(['', '?query=interview&modality=online']);
    expect(screen.getByText('Best for your direction')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Best matches first' }));
    expect(labels()).toEqual(['Interview confidence coaching by Maya Chen, $95', 'Career planning by Jordan Lee, $95']);
    fireEvent.press(screen.getByRole('button', { name: 'View my Yoir Direction' }));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/job-seeker/diagnosis', params: { result: '1' } });
  });

  test('an empty matched set keeps the full catalogue and explicitly states no match', async () => {
    reply('GET', '/services', () => jsonResponse(new URL(String(callsTo('GET', '/services').at(-1)![0])).searchParams.has('query') ? [] : [serviceFixture, other]));
    await renderPublic(<MarketplaceScreen />, sessionFixture);
    await tick();
    expect(await screen.findByText('No service listed here fits this direction yet, so the list is in its usual order.')).toBeOnTheScreen();
    expect(labels()).toEqual(['Interview confidence coaching by Maya Chen, $95', 'Career planning by Jordan Lee, $95']);
    expect(screen.queryByText('Best for your direction')).toBeNull();
  });

  test('a null query does not send an invented filter or mark ordinary services as matches', async () => {
    reply('GET', '/diagnoses/diagnosis-1/marketplace-criteria', jsonResponse({ ...diagnosisCriteria, query: null, modality: null, unsupportedSignals: ['location'] }));
    await renderPublic(<MarketplaceScreen />, sessionFixture);
    await tick();
    expect(await screen.findByText('Interview skills')).toBeOnTheScreen();
    expect(callsTo('GET', '/services')).toHaveLength(1);
    expect(screen.queryByText('Best for your direction')).toBeNull();
    expect(labels()).toHaveLength(2);
  });

  test('a failed matching request retains ordinary services with a visible error and no match claim', async () => {
    reply('GET', '/services', () => new URL(String(callsTo('GET', '/services').at(-1)![0])).searchParams.has('query')
      ? apiFailure('UNAVAILABLE', 'Matching search unavailable.', 503) : jsonResponse([serviceFixture, other]));
    await renderPublic(<MarketplaceScreen />, sessionFixture);
    await tick();
    expect(await screen.findByText('Matching search unavailable.')).toBeOnTheScreen();
    expect(labels()).toHaveLength(2);
    expect(screen.queryByText('Best for your direction')).toBeNull();
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes('/services?query=interview') && !Object.hasOwn(init?.headers ?? {}, 'Authorization'))).toBe(true);
  });

  test('incomplete diagnosis does not request derived criteria and still permits ordinary browsing', async () => {
    reply('GET', '/me/diagnosis', jsonResponse({ ...completeDiagnosis, status: 'in_progress', currentStep: 3 }));
    await renderPublic(<MarketplaceScreen />, sessionFixture);
    await tick();
    expect(labels()).toHaveLength(2);
    expect(callsTo('GET', '/diagnoses/diagnosis-1/direction')).toHaveLength(0);
    expect(callsTo('GET', '/diagnoses/diagnosis-1/marketplace-criteria')).toHaveLength(0);
    expect(screen.queryByText('Your Yoir Direction')).toBeNull();
  });
});
