import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import DiagnosisScreen from '@/app/job-seeker/diagnosis';
import {
  DiagnosisDirection,
  DiagnosisMarketplaceCriteria,
  DiagnosisQuestionnaire,
  DiagnosisRecord,
} from '@/src/api/types';
import {
  apiFailure, callsTo, jsonResponse, renderPublic, reply,
} from '../public-screen-utils';
import {
  counsellorProfileFixture, serviceFixture, sessionFixture,
} from '../fixtures';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const questionnaire: DiagnosisQuestionnaire = {
  version: 'yoir-six-step-v1',
  totalSteps: 6,
  steps: [
    {
      id: 'now', step: 1, title: 'Where are you now?',
      hint: 'Choose the one that best describes your situation today.', multiple: false,
      otherAllowed: true, options: [{ id: 'job', label: 'Looking for a job' }],
    },
    {
      id: 'goal', step: 2, title: 'What are you trying to achieve?',
      hint: 'Pick your most immediate goal.', multiple: false, otherAllowed: true,
      options: [{ id: 'find_job', label: 'Find a job' }],
    },
    {
      id: 'tried', step: 3, title: 'What have you tried so far?',
      hint: 'Choose any that apply.', multiple: true, otherAllowed: true, options: [],
    },
    {
      id: 'stuck', step: 4, title: 'Where are you getting stuck?',
      hint: 'Pick the main challenge.', multiple: false, otherAllowed: false,
      options: [{ id: 'interview', label: 'Interview' }],
    },
    {
      id: 'barriers', step: 5, title: 'Are there any barriers affecting your next step?',
      hint: 'Choose any that apply.', multiple: true, otherAllowed: true, options: [],
    },
  ],
  resultStep: { step: 6, title: 'Your Yoir Direction', requiresAnswers: true },
};

const record = (changes: Partial<DiagnosisRecord> = {}): DiagnosisRecord => ({
  id: 'diagnosis-1', questionnaireVersion: questionnaire.version, revision: 0,
  status: 'in_progress', currentStep: 1, totalSteps: 6, completedSteps: [],
  answers: { other: {} }, createdAt: '2026-10-16T00:00:00Z',
  updatedAt: '2026-10-16T00:00:00Z', ...changes,
});

describe('server-backed Yoir Diagnosis', () => {
  test('creates missing progress, confirms a step on the backend, then advances', async () => {
    reply('GET', '/me/diagnosis/questionnaire', jsonResponse(questionnaire));
    reply('GET', '/me/diagnosis', apiFailure('NOT_FOUND', 'Diagnosis not found.', 404));
    reply('POST', '/me/diagnosis', jsonResponse(record()));
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', jsonResponse(record({
      revision: 1, currentStep: 2, completedSteps: ['now'], answers: { now: 'job', other: {} },
    })));

    await renderPublic(<DiagnosisScreen />, sessionFixture);
    expect(await screen.findByText('Where are you now?')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('radio', { name: 'Looking for a job' }));
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('What are you trying to achieve?')).toBeOnTheScreen();
    expect(callsTo('POST', '/me/diagnosis')).toHaveLength(1);
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')).toHaveLength(1);
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')[0][1]?.body).toBe(JSON.stringify({
      questionnaireVersion: questionnaire.version,
      expectedRevision: 0,
      value: 'job',
      other: null,
    }));
  });

  test('renders only the backend-confirmed direction and backend-filtered professionals', async () => {
    const complete = record({
      revision: 5, status: 'answers_complete', currentStep: 6,
      completedSteps: ['now', 'goal', 'tried', 'stuck', 'barriers'],
      answers: {
        now: 'job', goal: 'find_job', tried: [], stuck: 'interview', barriers: [], other: {},
      },
    });
    const direction: DiagnosisDirection = {
      diagnosisId: complete.id, questionnaireVersion: questionnaire.version,
      sourceRevision: 5, ruleVersion: 'yoir-direction-v1', area: 'Interview skills',
      summary: 'Practise clear, structured answers.',
      suggestedSteps: ['Prepare examples.', 'Practise aloud.', 'Ask for feedback.'],
      matchingWeights: { interview: 10 },
    };
    const criteria: DiagnosisMarketplaceCriteria = {
      diagnosisId: complete.id, area: direction.area, query: 'interview', modality: null,
      unsupportedSignals: [],
    };
    reply('GET', '/me/diagnosis/questionnaire', jsonResponse(questionnaire));
    reply('GET', '/me/diagnosis', jsonResponse(complete));
    reply('GET', '/diagnoses/diagnosis-1/direction', jsonResponse(direction));
    reply('GET', '/diagnoses/diagnosis-1/marketplace-criteria', jsonResponse(criteria));
    reply('GET', '/counsellors', jsonResponse([counsellorProfileFixture]));
    reply('GET', '/services', jsonResponse([serviceFixture]));

    await renderPublic(<DiagnosisScreen />, sessionFixture);

    expect(await screen.findByText('Interview skills')).toBeOnTheScreen();
    expect(screen.getByText('Practise clear, structured answers.')).toBeOnTheScreen();
    expect(screen.getByText('Maya Chen')).toBeOnTheScreen();
    await waitFor(() => {
      expect(String(callsTo('GET', '/counsellors')[0][0])).toContain('?query=interview');
      expect(String(callsTo('GET', '/services')[0][0])).toContain('?query=interview');
    });
  });
});
