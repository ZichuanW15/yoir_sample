import { apiFailure, callsTo, jsonResponse, navigation, renderPublic, reply } from '../public-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Home from '@/app/job-seeker';
import DiagnosisScreen from '@/app/job-seeker/diagnosis';
import { completeDiagnosis, diagnosisCriteria, diagnosisDirection, diagnosisQuestionnaire } from '../diagnosis-fixtures';
import { sessionFixture } from '../fixtures';

beforeEach(() => {
  reply('GET', '/me/diagnosis/questionnaire', jsonResponse(diagnosisQuestionnaire));
  reply('GET', '/me/diagnosis', jsonResponse(completeDiagnosis));
  reply('GET', '/diagnoses/diagnosis-1/direction', jsonResponse(diagnosisDirection));
  reply('GET', '/diagnoses/diagnosis-1/marketplace-criteria', jsonResponse(diagnosisCriteria));
  reply('GET', '/counsellors', jsonResponse([]));
  reply('GET', '/services', jsonResponse([]));
});

describe('Sprint 3 server-backed diagnosis recovery acceptance', () => {
  test('[S3-DIAGNOSIS-HOME-READ-RECOVERY][QA-162] a failed initial progress read offers an error and retry instead of an endless spinner', async () => {
    reply('GET', '/me/diagnosis', apiFailure('UNAVAILABLE', 'Saved progress unavailable.', 503));
    await renderPublic(<Home />, sessionFixture);
    await waitFor(() => expect(callsTo('GET', '/me/diagnosis')).toHaveLength(1));
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(callsTo('GET', '/counsellors')).toHaveLength(0);
    expect(await screen.findByText('Saved progress unavailable.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });

  test('[S3-DIAGNOSIS-RETAKE-ERROR][QA-165/168] a failed retake submission keeps its failure visible after refreshing the confirmed revision', async () => {
    reply('PUT', '/diagnoses/diagnosis-1/steps/now', apiFailure('UNAVAILABLE', 'Retake was not saved.', 503));
    await renderPublic(<DiagnosisScreen />, sessionFixture);
    fireEvent.press(await screen.findByRole('button', { name: 'Retake the diagnosis' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Studying' }));
    for (let i = 0; i < 4; i += 1) fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.press(screen.getByRole('button', { name: 'See my Yoir Direction' }));
    await waitFor(() => expect(callsTo('GET', '/me/diagnosis')).toHaveLength(2));
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/now')).toHaveLength(1);
    expect(callsTo('PUT', '/diagnoses/diagnosis-1/steps/goal')).toHaveLength(0);
    expect(await screen.findByText('Are there any barriers affecting your next step?')).toBeOnTheScreen();
    expect(await screen.findByText('Retake was not saved.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'See my Yoir Direction' })).toBeEnabled();
  });
});
