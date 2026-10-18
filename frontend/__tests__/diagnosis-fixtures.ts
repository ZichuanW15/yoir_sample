import { DiagnosisAnswers, DiagnosisDirection, DiagnosisMarketplaceCriteria, DiagnosisQuestionnaire, DiagnosisRecord } from '@/src/api/types';

/** Controlled HTTP responses, not an implementation of diagnosis rules. */
export const diagnosisQuestionnaire: DiagnosisQuestionnaire = {
  version: 'yoir-six-step-v1', totalSteps: 6,
  steps: [
    { id: 'now', step: 1, title: 'Where are you now?', hint: 'Choose one.', multiple: false, otherAllowed: true,
      options: [{ id: 'job', label: 'Looking for a job' }, { id: 'study', label: 'Studying' }, { id: 'other', label: 'Other situation' }] },
    { id: 'goal', step: 2, title: 'What are you trying to achieve?', hint: 'Choose one.', multiple: false, otherAllowed: true,
      options: [{ id: 'find_job', label: 'Find a job' }, { id: 'other', label: 'Other goal' }] },
    { id: 'tried', step: 3, title: 'What have you tried so far?', hint: 'Choose any.', multiple: true, otherAllowed: true,
      options: [{ id: 'applications', label: 'Applications' }, { id: 'networking', label: 'Networking' }, { id: 'other', label: 'Other approach' }] },
    { id: 'stuck', step: 4, title: 'Where are you getting stuck?', hint: 'Choose one.', multiple: false, otherAllowed: false,
      options: [{ id: 'interview', label: 'Interview' }] },
    { id: 'barriers', step: 5, title: 'Are there any barriers affecting your next step?', hint: 'Choose any.', multiple: true, otherAllowed: true,
      options: [{ id: 'time', label: 'Limited time' }, { id: 'other', label: 'Other barrier' }] },
  ],
  resultStep: { step: 6, title: 'Your Yoir Direction', requiresAnswers: true },
};
export const diagnosisAnswers: DiagnosisAnswers = {
  now: 'job', goal: 'find_job', tried: [], stuck: 'interview', barriers: [], other: {},
};
export const diagnosisRecord = (changes: Partial<DiagnosisRecord> = {}): DiagnosisRecord => ({
  id: 'diagnosis-1', questionnaireVersion: diagnosisQuestionnaire.version, revision: 0,
  status: 'in_progress', currentStep: 1, totalSteps: 6, completedSteps: [], answers: { other: {} },
  createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', ...changes,
});
export const completeDiagnosis = diagnosisRecord({
  revision: 5, currentStep: 6, status: 'answers_complete',
  completedSteps: ['now', 'goal', 'tried', 'stuck', 'barriers'], answers: diagnosisAnswers,
});
export const diagnosisDirection: DiagnosisDirection = {
  diagnosisId: 'diagnosis-1', questionnaireVersion: diagnosisQuestionnaire.version, sourceRevision: 5,
  ruleVersion: 'yoir-direction-v1', area: 'Interview skills', summary: 'Server-confirmed advice.',
  suggestedSteps: ['Prepare examples.', 'Practise aloud.', 'Ask for feedback.'], matchingWeights: { interview: 10 },
};
export const diagnosisCriteria: DiagnosisMarketplaceCriteria = {
  diagnosisId: 'diagnosis-1', area: 'Interview skills', query: 'interview', modality: 'online', unsupportedSignals: [],
};
