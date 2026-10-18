import { apiFailure, callsTo, deferred, jsonResponse, reply } from '../public-screen-utils';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/src/auth/AuthContext';
import { Session } from '@/src/api/types';
import { useDiagnosis } from '@/src/diagnosis/view';
import { sessionFixture, counsellorSessionFixture } from '../fixtures';
import { completeDiagnosis, diagnosisAnswers, diagnosisCriteria, diagnosisDirection, diagnosisQuestionnaire, diagnosisRecord } from '../diagnosis-fixtures';

jest.mock('@/src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
const auth = jest.mocked(useAuth);
const secondSession = { ...sessionFixture, accessToken: 'second-token', user: { ...sessionFixture.user, id: 'second-seeker' } };
function signedIn(session: Session | null) {
  auth.mockReturnValue({ session } as ReturnType<typeof useAuth>);
}
function setupComplete() {
  reply('GET', '/me/diagnosis', jsonResponse(completeDiagnosis));
  reply('GET', '/diagnoses/diagnosis-1/direction', jsonResponse(diagnosisDirection));
  reply('GET', '/diagnoses/diagnosis-1/marketplace-criteria', jsonResponse(diagnosisCriteria));
}
beforeEach(() => {
  signedIn(sessionFixture);
  reply('GET', '/me/diagnosis/questionnaire', jsonResponse(diagnosisQuestionnaire));
  reply('GET', '/me/diagnosis', jsonResponse(diagnosisRecord()));
});

describe('server-owned diagnosis state — QA-162/165/168/171/174', () => {
  test.each([null, counsellorSessionFixture, { ...sessionFixture, user: { ...sessionFixture.user, role: 'platform_owner' as const } }])('does not load private diagnosis for guests or other roles (%#)', async (session) => {
    signedIn(session);
    const { result } = renderHook(useDiagnosis);
    await act(async () => undefined);
    expect(result.current.record).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(callsTo('GET', '/me/diagnosis/questionnaire')).toHaveLength(0);
  });

  test('404 means no saved diagnosis; other read failures are errors, not a new user', async () => {
    reply('GET', '/me/diagnosis', apiFailure('NOT_FOUND', 'No diagnosis.', 404));
    const { result } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.record).toBeNull();
    expect(result.current.error).toBe('');
    reply('GET', '/me/diagnosis', apiFailure('UNAVAILABLE', 'Progress unavailable.', 503));
    await act(async () => result.current.refresh());
    expect(result.current.error).toBe('Progress unavailable.');
    expect(callsTo('POST', '/me/diagnosis')).toHaveLength(0);
  });

  test('a failed step retains the confirmed revision and supports an explicit retry', async () => {
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', apiFailure('UNAVAILABLE', 'Save unavailable.', 503));
    const { result } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await expect(result.current.saveStep('now', 'job')).rejects.toMatchObject({ status: 503 }); });
    expect(result.current.record).toEqual(diagnosisRecord());
    expect(result.current.error).toBe('Save unavailable.');
    expect(result.current.saving).toBe(false);
    const saved = diagnosisRecord({ revision: 1, currentStep: 2, completedSteps: ['now'], answers: { now: 'job', other: {} } });
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', jsonResponse(saved));
    await act(async () => { await result.current.saveStep('now', 'job'); });
    expect(result.current.record).toEqual(saved);
    expect(result.current.error).toBe('');
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now').map(([, init]) => JSON.parse(String(init?.body)).expectedRevision)).toEqual([0, 0]);
  });

  test('409 refreshes the latest confirmed revision before a user retries', async () => {
    const { result } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const latest = diagnosisRecord({ revision: 7, currentStep: 2, answers: { now: 'study', other: {} }, completedSteps: ['now'] });
    reply('GET', '/me/diagnosis', jsonResponse(latest));
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', apiFailure('REVISION_CONFLICT', 'Progress changed.', 409));
    await act(async () => { await expect(result.current.saveStep('now', 'job')).rejects.toMatchObject({ status: 409 }); });
    expect(result.current.record).toEqual(latest);
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', jsonResponse({ ...latest, revision: 8 }));
    await act(async () => { await result.current.saveStep('now', 'job'); });
    expect(JSON.parse(String(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')[1][1]?.body)).expectedRevision).toBe(7);
  });

  test('switching accounts immediately hides private answers and uses the second token', async () => {
    setupComplete();
    const { result, rerender } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.direction).toEqual(diagnosisDirection));
    const next = deferred<Response>();
    reply('GET', '/me/diagnosis', next.promise);
    signedIn(secondSession);
    rerender({});
    expect(result.current.record).toBeNull();
    expect(result.current.direction).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(callsTo('GET', '/me/diagnosis')).toHaveLength(2));
    await act(async () => next.resolve(jsonResponse(diagnosisRecord({ id: 'second-diagnosis' }))));
    expect(result.current.record?.id).toBe('second-diagnosis');
    expect(callsTo('GET', '/me/diagnosis')[1][1]?.headers).toMatchObject({ Authorization: 'Bearer second-token' });
  });

  test('late progress from a previous account cannot replace current progress', async () => {
    const old = deferred<Response>();
    reply('GET', '/me/diagnosis', old.promise);
    const { result, rerender } = renderHook(useDiagnosis);
    await waitFor(() => expect(callsTo('GET', '/me/diagnosis')).toHaveLength(1));
    reply('GET', '/me/diagnosis', jsonResponse(diagnosisRecord({ id: 'second-diagnosis' })));
    signedIn(secondSession);
    rerender({});
    await waitFor(() => expect(result.current.record?.id).toBe('second-diagnosis'));
    await act(async () => old.resolve(jsonResponse(completeDiagnosis)));
    expect(result.current.record?.id).toBe('second-diagnosis');
    expect(result.current.direction).toBeNull();
    expect(callsTo('GET', '/diagnoses/diagnosis-1/direction')).toHaveLength(0);
  });

  test('late derived results from a previous account cannot reveal the old direction', async () => {
    setupComplete();
    const old = deferred<Response>();
    reply('GET', '/diagnoses/diagnosis-1/direction', old.promise);
    const { result, rerender } = renderHook(useDiagnosis);
    await waitFor(() => expect(callsTo('GET', '/diagnoses/diagnosis-1/direction')).toHaveLength(1));
    reply('GET', '/me/diagnosis', jsonResponse(diagnosisRecord({ id: 'second-diagnosis' })));
    signedIn(secondSession); rerender({});
    await waitFor(() => expect(result.current.record?.id).toBe('second-diagnosis'));
    await act(async () => old.resolve(jsonResponse(diagnosisDirection)));
    expect(result.current.direction).toBeNull();
    expect(result.current.criteria).toBeNull();
  });

  test('logout during a save hides answers and ignores the late confirmed response', async () => {
    const pending = deferred<Response>();
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', pending.promise);
    const { result, rerender } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.loading).toBe(false));
    let save!: ReturnType<typeof result.current.saveStep>;
    act(() => { save = result.current.saveStep('now', 'job'); });
    expect(result.current.saving).toBe(true);
    signedIn(null); rerender({});
    expect(result.current.record).toBeNull();
    expect(result.current.saving).toBe(false);
    await act(async () => { pending.resolve(jsonResponse(completeDiagnosis)); await save; });
    expect(result.current.record).toBeNull();
    expect(result.current.direction).toBeNull();
  });

  test('reopening gets server-confirmed progress rather than a cached local draft', async () => {
    const first = renderHook(useDiagnosis);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();
    const savedElsewhere = diagnosisRecord({ revision: 3, currentStep: 4, answers: { now: 'study', goal: 'find_job', tried: ['networking'], other: {} } });
    reply('GET', '/me/diagnosis', jsonResponse(savedElsewhere));
    const next = renderHook(useDiagnosis);
    await waitFor(() => expect(next.result.current.record).toEqual(savedElsewhere));
    expect(callsTo('GET', '/me/diagnosis')).toHaveLength(2);
  });

  test('a partially confirmed retake failure reloads the server revision before retry', async () => {
    setupComplete();
    const { result } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const partial = { ...completeDiagnosis, revision: 6, answers: { ...diagnosisAnswers, now: 'study' } };
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', jsonResponse(partial));
    reply('PUT', '/diagnoses/diagnosis-1/steps/goal', apiFailure('UNAVAILABLE', 'Retake unavailable.', 503));
    reply('GET', '/me/diagnosis', jsonResponse(partial));
    await act(async () => { await expect(result.current.saveRetake(partial.answers)).rejects.toMatchObject({ status: 503 }); });
    expect(result.current.record?.revision).toBe(6);
    expect(result.current.saving).toBe(false);
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/tried')).toHaveLength(0);
    diagnosisQuestionnaire.steps.forEach((question, index) => reply('PUT', `/diagnoses/diagnosis-1/steps/${question.id}`, jsonResponse({ ...partial, revision: 7 + index })));
    await act(async () => { await result.current.saveRetake(partial.answers); });
    expect(JSON.parse(String(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')[1][1]?.body)).expectedRevision).toBe(6);
    expect(result.current.record?.revision).toBe(11);
  });
});
