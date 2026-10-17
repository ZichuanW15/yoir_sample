import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import DiagnosisScreen from '@/app/job-seeker/diagnosis';
import { DiagnosisRecord } from '@/src/api/types';
import { counsellorSessionFixture, sessionFixture } from '../fixtures';
import { completeDiagnosis, diagnosisCriteria, diagnosisDirection, diagnosisQuestionnaire, diagnosisRecord } from '../diagnosis-fixtures';

const load = (record: DiagnosisRecord = diagnosisRecord()) => {
  reply('GET', '/me/diagnosis/questionnaire', jsonResponse(diagnosisQuestionnaire));
  reply('GET', '/me/diagnosis', jsonResponse(record));
  reply('GET', '/diagnoses/diagnosis-1/direction', jsonResponse(diagnosisDirection));
  reply('GET', '/diagnoses/diagnosis-1/marketplace-criteria', jsonResponse(diagnosisCriteria));
  reply('GET', '/counsellors', jsonResponse([]));
  reply('GET', '/services', jsonResponse([]));
};
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('diagnosis HTTP and screen acceptance — QA-162/165/168/171/174', () => {
  test.each([
    [undefined, { pathname: '/auth/login', params: { role: 'job_seeker' } }],
    [counsellorSessionFixture, '/counsellor'],
    [{ ...sessionFixture, user: { ...sessionFixture.user, role: 'platform_owner' as const } }, '/admin'],
  ])('guests and non-seekers are redirected without private API requests (%#)', async (session, destination) => {
    await renderPublic(<DiagnosisScreen />, session);
    expect(navigation.replace).toHaveBeenCalledWith(destination);
    expect(callsTo('GET', '/me/diagnosis')).toHaveLength(0);
    expect(callsTo('GET', '/me/diagnosis/questionnaire')).toHaveLength(0);
  });

  test('an initial questionnaire error offers recovery without creating empty progress', async () => {
    load();
    reply('GET', '/me/diagnosis/questionnaire', apiFailure('UNAVAILABLE', 'Questionnaire unavailable.', 503));
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    expect(await screen.findByText('Questionnaire unavailable.')).toBeOnTheScreen();
    expect(callsTo('GET', '/me/diagnosis')).toHaveLength(0);
    expect(callsTo('POST', '/me/diagnosis')).toHaveLength(0);
    reply('GET', '/me/diagnosis/questionnaire', jsonResponse(diagnosisQuestionnaire));
    press('Try again');
    expect(await screen.findByText('Where are you now?')).toBeOnTheScreen();
  });

  test('a failed start stays recoverable and retries creation only after an explicit action', async () => {
    load();
    reply('GET', '/me/diagnosis', apiFailure('NOT_FOUND', 'No diagnosis.', 404));
    reply('POST', '/me/diagnosis', apiFailure('UNAVAILABLE', 'Could not start diagnosis.', 503));
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    expect(await screen.findByText('Could not start diagnosis.')).toBeOnTheScreen();
    expect(callsTo('POST', '/me/diagnosis')).toHaveLength(1);
    reply('POST', '/me/diagnosis', jsonResponse(diagnosisRecord()));
    press('Try again');
    expect(await screen.findByText('Where are you now?')).toBeOnTheScreen();
    expect(callsTo('POST', '/me/diagnosis')).toHaveLength(2);
  });

  test('required single-choice validation does not save; busy saving prevents a duplicate Continue', async () => {
    load();
    const pending = deferred<Response>();
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', pending.promise);
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    await screen.findByText('Where are you now?');
    press('Continue');
    expect(screen.getByText('Choose an option to continue.')).toBeOnTheScreen();
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')).toHaveLength(0);
    fireEvent.press(screen.getByRole('radio', { name: 'Looking for a job' }));
    expect(screen.queryByText('Choose an option to continue.')).toBeNull();
    press('Continue');
    expect(screen.getByText('Where are you now?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    press('Continue');
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')).toHaveLength(1);
    await act(async () => pending.resolve(jsonResponse(diagnosisRecord({ revision: 1, currentStep: 2, answers: { now: 'job', other: {} } }))));
    expect(await screen.findByText('What are you trying to achieve?')).toBeOnTheScreen();
  });

  test('failed-save error retains the selected answer and step until a confirmed retry', async () => {
    load();
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', apiFailure('UNAVAILABLE', 'Answer not saved.', 503));
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    fireEvent.press(await screen.findByRole('radio', { name: 'Looking for a job' }));
    press('Continue');
    expect(await screen.findByText('Answer not saved.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Looking for a job' })).toBeChecked();
    expect(screen.queryByText('What are you trying to achieve?')).toBeNull();
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', jsonResponse(diagnosisRecord({ revision: 1, currentStep: 2, answers: { now: 'job', other: {} } })));
    press('Continue');
    expect(await screen.findByText('What are you trying to achieve?')).toBeOnTheScreen();
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')).toHaveLength(2);
    expect(screen.queryByText('Answer not saved.')).toBeNull();
  });

  test('other text is submitted with the selected value and a rejected answer does not advance', async () => {
    load();
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', apiFailure('VALIDATION_ERROR', 'Describe your situation.', 400));
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    fireEvent.press(await screen.findByRole('radio', { name: 'Other situation' }));
    fireEvent.changeText(screen.getByLabelText('Tell us a little more (optional)'), 'Returning after leave');
    press('Continue');
    expect(await screen.findByText('Describe your situation.')).toBeOnTheScreen();
    expect(JSON.parse(String(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')[0][1]?.body))).toMatchObject({ value: 'other', other: 'Returning after leave', expectedRevision: 0 });
    expect(screen.getByDisplayValue('Returning after leave')).toBeOnTheScreen();
  });

  test('server saved multi-choice answers reopen checked; toggle, Back and Skip do not write a draft', async () => {
    load(diagnosisRecord({ revision: 2, currentStep: 3, completedSteps: ['now', 'goal'], answers: { now: 'study', goal: 'find_job', tried: ['networking'], other: {} } }));
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    expect(await screen.findByText('What have you tried so far?')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Networking' })).toBeChecked();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Networking' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'Applications' }));
    expect(screen.getByRole('checkbox', { name: 'Networking' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Applications' })).toBeChecked();
    press('Back');
    expect(screen.getByText('What are you trying to achieve?')).toBeOnTheScreen();
    press('Skip for now');
    expect(navigation.replace).toHaveBeenCalledWith('/job-seeker');
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/tried')).toHaveLength(0);
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/goal')).toHaveLength(0);
  });

  test('a committed final answer with failed direction retrieval retries reads without resubmitting the answer', async () => {
    load(diagnosisRecord({ ...completeDiagnosis, status: 'in_progress', revision: 4, currentStep: 5 }));
    reply('PUT', '/diagnoses/diagnosis-1/steps/barriers', jsonResponse(completeDiagnosis));
    reply('GET', '/diagnoses/diagnosis-1/direction', apiFailure('UNAVAILABLE', 'Direction unavailable.', 503));
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    await screen.findByText('Are there any barriers affecting your next step?');
    press('See my Yoir Direction');
    expect(await screen.findByText('Your Yoir Direction')).toBeOnTheScreen();
    expect(screen.getByText('Direction unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('Server-confirmed advice.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View Career Professionals' })).toBeNull();
    reply('GET', '/me/diagnosis', jsonResponse(completeDiagnosis));
    reply('GET', '/diagnoses/diagnosis-1/direction', jsonResponse(diagnosisDirection));
    press('Try again');
    expect(await screen.findByText('Server-confirmed advice.')).toBeOnTheScreen();
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/barriers')).toHaveLength(1);
  });

  test('criteria failure does not fabricate matches; read retry recovers an empty match result and Explore handoff', async () => {
    load(completeDiagnosis);
    reply('GET', '/diagnoses/diagnosis-1/marketplace-criteria', apiFailure('UNAVAILABLE', 'Matching unavailable.', 503));
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    expect(await screen.findByText('Matching unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('Server-confirmed advice.')).toBeNull();
    expect(callsTo('GET', '/counsellors')).toHaveLength(0);
    reply('GET', '/diagnoses/diagnosis-1/marketplace-criteria', jsonResponse(diagnosisCriteria));
    press('Try again');
    expect(await screen.findByText('No Career Professionals currently match this direction. Explore all services or check back soon.')).toBeOnTheScreen();
    expect(screen.getByText('Server-confirmed advice.')).toBeOnTheScreen();
    press('View Career Professionals');
    expect(navigation.push).toHaveBeenLastCalledWith({ pathname: '/marketplace', params: { match: '1' } });
    press('Go to my home');
    expect(navigation.replace).toHaveBeenLastCalledWith('/job-seeker');
    await waitFor(() => expect(String(callsTo('GET', '/services')[0][0])).toContain('query=interview&modality=online'));
  });
});
