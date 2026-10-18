import { api } from '@/src/api/client';
import {
  DiagnosisDirection,
  DiagnosisMarketplaceCriteria,
  DiagnosisQuestionnaire,
  DiagnosisRecord,
} from '@/src/api/types';

const TOKEN = 'diagnosis-access-token';
const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

const jsonResponse = (body: unknown, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
} as unknown as Response);

const questionnaire: DiagnosisQuestionnaire = {
  version: 'yoir-six-step-v1',
  totalSteps: 6,
  steps: [{
    id: 'now', step: 1, title: 'Where are you now?', hint: 'Choose one.',
    multiple: false, otherAllowed: true, options: [{ id: 'job', label: 'Looking for a job' }],
  }],
  resultStep: { step: 6, title: 'Your Yoir Direction', requiresAnswers: true },
};

const record: DiagnosisRecord = {
  id: 'diagnosis/one', questionnaireVersion: questionnaire.version, revision: 1,
  status: 'in_progress', currentStep: 2, totalSteps: 6, completedSteps: ['now'],
  answers: { now: 'job', other: {} },
  createdAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z',
};

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as typeof fetch;
});

afterAll(() => { global.fetch = originalFetch; });

describe('diagnosis API client', () => {
  test('reads the questionnaire and owned progress with authentication', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(questionnaire))
      .mockResolvedValueOnce(jsonResponse(record));

    await expect(api.getDiagnosisQuestionnaire(TOKEN)).resolves.toEqual(questionnaire);
    await expect(api.getOwnDiagnosis(TOKEN)).resolves.toEqual(record);

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:8000/api/v1/me/diagnosis/questionnaire',
      'http://localhost:8000/api/v1/me/diagnosis',
    ]);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  test('starts and saves against the server revision before advancing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ...record, revision: 0, currentStep: 1, completedSteps: [], answers: { other: {} } }))
      .mockResolvedValueOnce(jsonResponse(record));

    await api.startDiagnosis(questionnaire.version, TOKEN);
    await api.saveDiagnosisStep(
      record.id,
      'now',
      {
        questionnaireVersion: questionnaire.version,
        expectedRevision: 0,
        value: 'job',
        other: null,
      },
      TOKEN,
    );

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST', body: JSON.stringify({ questionnaireVersion: questionnaire.version }),
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain('/diagnoses/diagnosis%2Fone/steps/now');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({
        questionnaireVersion: questionnaire.version,
        expectedRevision: 0,
        value: 'job',
        other: null,
      }),
    });
  });

  test('reads backend direction and Marketplace criteria for the confirmed revision', async () => {
    const direction: DiagnosisDirection = {
      diagnosisId: record.id, questionnaireVersion: questionnaire.version,
      sourceRevision: 5, ruleVersion: 'yoir-direction-v1', area: 'Interview skills',
      summary: 'Practise interview skills.', suggestedSteps: ['One', 'Two', 'Three'],
      matchingWeights: { interview: 10 },
    };
    const criteria: DiagnosisMarketplaceCriteria = {
      diagnosisId: record.id, area: direction.area, query: 'interview', modality: null,
      unsupportedSignals: [],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(direction))
      .mockResolvedValueOnce(jsonResponse(criteria));

    await expect(api.getDiagnosisDirection(record.id, TOKEN)).resolves.toEqual(direction);
    await expect(api.getDiagnosisMarketplaceCriteria(record.id, TOKEN)).resolves.toEqual(criteria);

    expect(String(fetchMock.mock.calls[0][0])).toContain('/diagnoses/diagnosis%2Fone/direction');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/diagnoses/diagnosis%2Fone/marketplace-criteria');
  });

  test('submits diagnosis criteria to both public Marketplace endpoints', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await api.listServices(' interview ', 'online');
    await api.listCounsellors(' interview ');

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:8000/api/v1/services?query=interview&modality=online',
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      'http://localhost:8000/api/v1/counsellors?query=interview',
    );
  });

  test.each([
    [400, 'VALIDATION_ERROR', 'Answer is invalid.'],
    [409, 'REVISION_CONFLICT', 'Progress changed on another device.'],
    [503, 'UNAVAILABLE', 'Save unavailable.'],
  ])('preserves save rejection %s without fabricating a confirmed revision', async (status, code, message) => {
    fetchMock.mockResolvedValue(jsonResponse({ code, message, requestId: 'diagnosis-save' }, status));
    await expect(api.saveDiagnosisStep(record.id, 'tried', {
      questionnaireVersion: questionnaire.version, expectedRevision: 7,
      value: ['applications', 'other'], other: 'Volunteering',
    }, TOKEN)).rejects.toMatchObject({ status, body: { code, message } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      questionnaireVersion: questionnaire.version, expectedRevision: 7,
      value: ['applications', 'other'], other: 'Volunteering',
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  test.each([403, 404])('preserves restricted or absent direction status %s', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'NOT_AVAILABLE', message: 'Direction unavailable.', requestId: 'direction' }, status));
    await expect(api.getDiagnosisDirection(record.id, TOKEN)).rejects.toMatchObject({ status });
    await expect(api.getDiagnosisMarketplaceCriteria(record.id, TOKEN)).rejects.toMatchObject({ status });
    expect(fetchMock.mock.calls.every(([, init]) => (init?.headers as Record<string, string>).Authorization === `Bearer ${TOKEN}`)).toBe(true);
  });

  test('encodes matching query characters and omits empty filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await api.listServices('  CV & interview / practice  ', 'online');
    await api.listServices('  ', null);
    await api.listCounsellors('  ');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:8000/api/v1/services?query=CV%20%26%20interview%20%2F%20practice&modality=online',
      'http://localhost:8000/api/v1/services',
      'http://localhost:8000/api/v1/counsellors',
    ]);
  });

});
