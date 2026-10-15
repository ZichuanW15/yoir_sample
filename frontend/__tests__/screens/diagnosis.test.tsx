import { apiFailure, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import DiagnosisScreen from '@/app/job-seeker/diagnosis';
import { Answers } from '@/src/diagnosis/model';
import { readDiagnosis, writeDiagnosis } from '@/src/diagnosis/storage';
import { DiagnosisRecord } from '@/src/diagnosis/view';
import { counsellorProfileFixture, counsellorSessionFixture, serviceFixture, sessionFixture } from '../fixtures';

// Exercise the real screen, hook, model and UI. Persistence, HTTP, navigation
// and session storage use controlled boundaries; this is component evidence.
// toBeChecked observes native accessibilityState; exported-Web ARIA forwarding
// is independently checked in e2e/sprint3-accessibility.spec.ts.
jest.mock('@/src/diagnosis/storage', () => ({ readDiagnosis: jest.fn(), writeDiagnosis: jest.fn() }));
const read = jest.mocked(readDiagnosis);
const write = jest.mocked(writeDiagnosis);
const key = `yoir.diagnosis.${sessionFixture.user.id}`;
const saved = new Map<string, string>();
const answers: Answers = { now: 'job', goal: 'find_job', tried: [], stuck: 'interview', barriers: [] };
const stored = (): DiagnosisRecord => JSON.parse(saved.get(key)!);
const press = async (name: string) => {
  await act(async () => fireEvent.press(screen.getByRole('button', { name })));
};
const choose = (name: string, role: 'radio' | 'checkbox' = 'radio') => {
  fireEvent.press(screen.getByRole(role, { name }));
};
const open = async (record?: DiagnosisRecord) => {
  if (record) saved.set(key, JSON.stringify(record));
  return renderPublic(<DiagnosisScreen />, sessionFixture);
};

beforeEach(() => {
  saved.clear();
  read.mockReset().mockImplementation(async (name) => saved.get(name) ?? null);
  write.mockReset().mockImplementation(async (name, value) => { saved.set(name, value); });
  reply('GET', '/counsellors', jsonResponse([]));
  reply('GET', '/services', jsonResponse([]));
});

describe('diagnosis questions — local persistence boundary, QA-162/165/168', () => {
  test('a guest is sent to job-seeker login without reading or writing a diagnosis', async () => {
    await renderPublic(<DiagnosisScreen />);
    expect(navigation.replace).toHaveBeenCalledWith({ pathname: '/auth/login', params: { role: 'job_seeker' } });
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(screen.queryByText('Where are you now?')).toBeNull();
  });

  test.each([
    ['counsellor', counsellorSessionFixture, '/counsellor'],
    ['platform owner', { ...sessionFixture, user: { ...sessionFixture.user, role: 'platform_owner' as const } }, '/admin'],
  ] as const)('a %s account is routed to its own workspace', async (_role, session, destination) => {
    await renderPublic(<DiagnosisScreen />, session);
    expect(navigation.replace).toHaveBeenCalledWith(destination);
    expect(write).not.toHaveBeenCalled();
    expect(screen.queryByText('Where are you now?')).toBeNull();
  });

  test('questions stay hidden while saved progress loads, then resume at that question', async () => {
    const pending = deferred<string | null>();
    read.mockReturnValueOnce(pending.promise);
    await open();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.queryByText('Where are you now?')).toBeNull();
    await act(async () => pending.resolve(JSON.stringify({ answers, step: 3 })));
    expect(await screen.findByText('Where are you getting stuck?')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Interview' })).toBeChecked();
    expect(screen.getByText('Step 4 of 6')).toBeOnTheScreen();
  });

  test.each([
    [0, 'now', 'Where are you now?', 'Looking for a job'],
    [1, 'goal', 'What are you trying to achieve?', 'Find a job'],
    [3, 'stuck', 'Where are you getting stuck?', 'Interview'],
  ] as const)('question %s refuses an empty required answer without advancing or saving', async (step, field, title, option) => {
    await open({ answers: { ...answers, [field]: '' }, step });
    expect(await screen.findByText(title)).toBeOnTheScreen();
    await press('Continue');
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an option to continue.');
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(write).not.toHaveBeenCalled();
    choose(option);
    expect(screen.queryByRole('alert')).toBeNull();
    await press('Continue');
    expect(stored().step).toBe(step + 1);
    expect(stored().answers?.[field]).toBe(answers[field]);
  });

  test('editing an earlier answer preserves the furthest resume point across a remount', async () => {
    const page = await open({ answers, step: 3 });
    await screen.findByText('Where are you getting stuck?');
    await press('Back');
    await press('Back');
    choose('Improve my resume/application');
    await press('Continue');
    expect(stored()).toEqual({ answers: { ...answers, goal: 'resume' }, step: 3 });
    page.unmount();
    await open();
    expect(await screen.findByText('Where are you getting stuck?')).toBeOnTheScreen();
    await press('Back');
    await press('Back');
    expect(screen.getByRole('radio', { name: 'Improve my resume/application' })).toBeChecked();
  });

  test('skipping before the first answer records a skip and opens home', async () => {
    await open();
    await screen.findByText('Where are you now?');
    await press('Skip for now');
    expect(stored()).toEqual({ answers: null });
    expect(navigation.replace).toHaveBeenCalledWith('/job-seeker');
    expect(screen.queryByText('Your Yoir Direction')).toBeNull();
  });

  test('skipping part-way saves the current choice and resumes with it selected', async () => {
    const partial = { ...answers, goal: '', stuck: '' };
    const page = await open({ answers: partial, step: 1 });
    await screen.findByText('What are you trying to achieve?');
    choose('Prepare for interviews');
    await press('Skip for now');
    expect(stored()).toEqual({ answers: { ...partial, goal: 'interview' }, step: 1 });
    expect(navigation.replace).toHaveBeenCalledWith('/job-seeker');
    page.unmount();
    await open();
    expect(await screen.findByRole('radio', { name: 'Prepare for interviews' })).toBeChecked();
  });

  test('a full journey retains optional text and toggled choices, permits empty optional answers and opens Explore', async () => {
    await open();
    await screen.findByText('Where are you now?');
    choose('Something else');
    fireEvent.changeText(screen.getByLabelText('Tell us a little more (optional)'), 'Returning after caring for family');
    await press('Continue');
    choose('Prepare for interviews');
    await press('Continue');
    choose('Job applications', 'checkbox');
    choose('Networking', 'checkbox');
    choose('Job applications', 'checkbox');
    expect(screen.getByRole('checkbox', { name: 'Job applications' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Networking' })).toBeChecked();
    await press('Continue');
    choose('Interview');
    await press('Continue');
    // Barriers are optional: reaching the result does not require an invented answer.
    await press('See my Yoir Direction');
    expect(await screen.findByText('Your Yoir Direction')).toBeOnTheScreen();
    expect(screen.getByText('Interview skills')).toBeOnTheScreen();
    expect(stored()).toEqual({ answers: {
      now: 'other', goal: 'interview', tried: ['networking'], stuck: 'interview', barriers: [],
      other: { now: 'Returning after caring for family' },
    } });
    await press('View Career Professionals');
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/marketplace', params: { match: '1' } });
    await press('Go to my home');
    expect(navigation.replace).toHaveBeenCalledWith('/job-seeker');
  });

  test('abandoning a retake keeps the previous completed answers and direction', async () => {
    routeParams({ result: '1' });
    await open({ answers });
    await screen.findByText('Your Yoir Direction');
    await press('Retake the diagnosis');
    choose('Looking to upskill or study');
    await press('Continue');
    choose('Find the right course or study pathway');
    await press('Skip for now');
    expect(stored()).toEqual({ answers });
    expect(write).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith('/job-seeker');
  });

  test('a completed retake replaces the previous direction only at the final question', async () => {
    routeParams({ result: '1' });
    await open({ answers });
    await screen.findByText('Your Yoir Direction');
    await press('Retake the diagnosis');
    await press('Continue');
    await press('Continue');
    // Tried-so-far also accepts an empty multi-select.
    await press('Continue');
    choose('Course/study choice');
    await press('Continue');
    expect(write).not.toHaveBeenCalled();
    expect(stored()).toEqual({ answers });
    await press('See my Yoir Direction');
    expect(await screen.findByText('Study and upskilling pathway')).toBeOnTheScreen();
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(stored()).toEqual({ answers: { ...answers, stuck: 'study' } });
  });

  test('[QA-171/174] failed professional loading can be retried without losing the completed direction', async () => {
    routeParams({ result: '1' });
    reply('GET', '/counsellors', apiFailure('UNAVAILABLE', 'Professionals are temporarily unavailable.', 503));
    await open({ answers });
    expect(await screen.findByText('Professionals are temporarily unavailable.')).toBeOnTheScreen();
    expect(screen.getByText('Interview skills')).toBeOnTheScreen();
    reply('GET', '/counsellors', jsonResponse([counsellorProfileFixture]));
    reply('GET', '/services', jsonResponse([serviceFixture]));
    await press('Try again');
    expect(await screen.findByText('Best match')).toBeOnTheScreen();
    expect(screen.queryByText('Professionals are temporarily unavailable.')).toBeNull();
    await press('Maya Chen, Career Professional');
    expect(navigation.push).toHaveBeenCalledWith({
      pathname: '/professionals/[counsellorId]', params: { counsellorId: counsellorProfileFixture.id },
    });
    expect(stored()).toEqual({ answers });
    expect(write).not.toHaveBeenCalled();
  });
});
