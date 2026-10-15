import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import Home from '@/app/job-seeker';
import { readDiagnosis, writeDiagnosis } from '@/src/diagnosis/storage';
import { Answers } from '@/src/diagnosis/model';
import { counsellorProfileFixture, counsellorSessionFixture, serviceFixture, sessionFixture } from '../fixtures';

// Real home, diagnosis hook/ranking and API client; storage and transport controlled.
jest.mock('@/src/diagnosis/storage', () => ({ readDiagnosis: jest.fn(), writeDiagnosis: jest.fn() }));
const read = jest.mocked(readDiagnosis);
const answers: Answers = { now: 'job', goal: 'interview', tried: [], stuck: 'interview', barriers: [] };

beforeEach(() => {
  read.mockReset().mockResolvedValue(null);
  jest.mocked(writeDiagnosis).mockReset();
  reply('GET', '/counsellors', jsonResponse([counsellorProfileFixture]));
  reply('GET', '/services', jsonResponse([serviceFixture]));
  reply('GET', '/me/notifications', jsonResponse([]));
});

describe('job seeker home — QA-162/174 and entry navigation', () => {
  test('guests can browse and register without reading a private diagnosis', async () => {
    await renderPublic(<Home />);
    expect(await screen.findByText('Welcome to Yoir')).toBeOnTheScreen();
    expect(await screen.findByText('Maya Chen')).toBeOnTheScreen();
    expect(read).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/auth/register', params: { role: 'job_seeker' } });
    fireEvent.press(screen.getByRole('tab', { name: 'Bookings' }));
    expect(navigation.push).toHaveBeenLastCalledWith({ pathname: '/auth/login', params: { role: 'job_seeker' } });
  });

  test.each([
    [counsellorSessionFixture, '/counsellor'],
    [{ ...sessionFixture, user: { ...sessionFixture.user, role: 'platform_owner' as const } }, '/admin'],
  ])('a non-seeker goes to the correct workspace', async (session, destination) => {
    await renderPublic(<Home />, session);
    expect(navigation.replace).toHaveBeenCalledWith(destination);
    expect(callsTo('GET', '/counsellors')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Take the Yoir Diagnosis' })).toBeNull();
  });

  test('no question or match is fabricated while progress loads; a new user enters diagnosis', async () => {
    const pending = deferred<string | null>();
    read.mockReturnValueOnce(pending.promise);
    await renderPublic(<Home />, sessionFixture);
    expect(screen.queryByText('Your best matches')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(callsTo('GET', '/counsellors')).toHaveLength(0);
    await act(async () => pending.resolve(null));
    expect(navigation.replace).toHaveBeenCalledWith('/job-seeker/diagnosis');
  });

  test('a skipped diagnosis offers a fresh start without claiming completed results', async () => {
    read.mockResolvedValue(JSON.stringify({ answers: null }));
    await renderPublic(<Home />, sessionFixture);
    expect(await screen.findByText('Welcome back, Alex')).toBeOnTheScreen();
    expect(screen.getByText('Top rated Career Professionals')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Take the Yoir Diagnosis' }));
    expect(navigation.push).toHaveBeenCalledWith('/job-seeker/diagnosis');
    expect(screen.queryByText('Your best matches')).toBeNull();
  });

  test('unfinished answers expose the actual resume step and continue action', async () => {
    read.mockResolvedValue(JSON.stringify({ answers, step: 3 }));
    await renderPublic(<Home />, sessionFixture);
    expect(await screen.findByLabelText('Step 4 of 6')).toBeOnTheScreen();
    expect(screen.getByText('Pick up where you left off')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Continue the Yoir Diagnosis' }));
    expect(navigation.push).toHaveBeenCalledWith('/job-seeker/diagnosis');
    expect(writeDiagnosis).not.toHaveBeenCalled();
  });

  test('completed answers offer result, retake, professional detail and Explore navigation', async () => {
    read.mockResolvedValue(JSON.stringify({ answers }));
    await renderPublic(<Home />, sessionFixture);
    fireEvent.press(await screen.findByRole('button', { name: 'View my Yoir Direction: Interview skills' }));
    expect(navigation.push).toHaveBeenLastCalledWith({ pathname: '/job-seeker/diagnosis', params: { result: '1' } });
    fireEvent.press(screen.getByRole('button', { name: 'Retake diagnosis' }));
    expect(navigation.push).toHaveBeenLastCalledWith('/job-seeker/diagnosis');
    fireEvent.press(await screen.findByRole('button', { name: 'Maya Chen, Career Professional' }));
    expect(navigation.push).toHaveBeenLastCalledWith({ pathname: '/professionals/[counsellorId]', params: { counsellorId: 'counsellor-1' } });
    fireEvent.press(screen.getByRole('button', { name: 'View all Career Professionals' }));
    expect(navigation.replace).toHaveBeenLastCalledWith('/marketplace');
    fireEvent.press(screen.getByRole('tab', { name: 'Bookings' }));
    expect(navigation.replace).toHaveBeenLastCalledWith('/bookings');
  });

  test('a failed catalogue keeps the local result and retry recovers real client data', async () => {
    read.mockResolvedValue(JSON.stringify({ answers }));
    reply('GET', '/counsellors', apiFailure('UNAVAILABLE', 'Career Professionals could not be loaded.', 503));
    await renderPublic(<Home />, sessionFixture);
    expect(await screen.findByText('Career Professionals could not be loaded.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'View my Yoir Direction: Interview skills' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Maya Chen, Career Professional' })).toBeNull();
    reply('GET', '/counsellors', jsonResponse([counsellorProfileFixture]));
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Maya Chen')).toBeOnTheScreen();
    expect(screen.queryByText('Career Professionals could not be loaded.')).toBeNull();
  });

  test('an empty catalogue preserves the completed direction and retake action', async () => {
    read.mockResolvedValue(JSON.stringify({ answers }));
    reply('GET', '/counsellors', jsonResponse([]));
    reply('GET', '/services', jsonResponse([]));
    await renderPublic(<Home />, sessionFixture);
    expect(await screen.findByText('No Career Professionals are listed yet. Check back soon.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retake diagnosis' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'View my Yoir Direction: Interview skills' })).toBeOnTheScreen();
  });
});
