import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/src/auth/AuthContext';
import { Answers } from '@/src/diagnosis/model';
import { readDiagnosis, writeDiagnosis } from '@/src/diagnosis/storage';
import { finishedAnswers, useDiagnosis } from '@/src/diagnosis/view';
import { sessionFixture } from '../fixtures';

jest.mock('@/src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/src/diagnosis/storage', () => ({ readDiagnosis: jest.fn(), writeDiagnosis: jest.fn() }));
const auth = jest.mocked(useAuth);
const read = jest.mocked(readDiagnosis);
const write = jest.mocked(writeDiagnosis);
const firstSession = sessionFixture;
const secondSession = { ...sessionFixture, user: { ...sessionFixture.user, id: 'second-seeker' } };
const answers: Answers = { now: 'job', goal: 'find_job', tried: [], stuck: 'interview', barriers: [] };

function signedIn(session: typeof firstSession | null) {
  // Only the session is consumed by this hook; no login or storage API is faked as a product result.
  auth.mockReturnValue({ session } as ReturnType<typeof useAuth>);
}

function pendingRead() {
  let resolve!: (value: string | null) => void;
  const promise = new Promise<string | null>((finish) => { resolve = finish; });
  return { promise, resolve };
}

beforeEach(() => {
  signedIn(firstSession);
  read.mockReset().mockResolvedValue(null);
  write.mockReset().mockResolvedValue(undefined);
});

describe('diagnosis ownership on one device — QA-162/165/168', () => {
  test('switching accounts hides the first record until the second account finishes loading', async () => {
    read.mockResolvedValueOnce(JSON.stringify({ answers }));
    const { result, rerender } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.record).toEqual({ answers }));
    const second = pendingRead();
    read.mockReturnValueOnce(second.promise);
    signedIn(secondSession);
    rerender({});
    expect(result.current.record).toBeUndefined();
    expect(read).toHaveBeenLastCalledWith('yoir.diagnosis.second-seeker');
    await act(async () => second.resolve(null));
    expect(result.current.record).toBeNull();
    await act(async () => result.current.save({ answers: null }));
    expect(write).toHaveBeenCalledWith('yoir.diagnosis.second-seeker', '{"answers":null}');
    expect(write).not.toHaveBeenCalledWith('yoir.diagnosis.user-1', expect.anything());
  });

  test('a late read from the previous account cannot replace the current account record', async () => {
    const first = pendingRead();
    read.mockReturnValueOnce(first.promise).mockResolvedValueOnce(JSON.stringify({ answers: null }));
    const { result, rerender } = renderHook(useDiagnosis);
    signedIn(secondSession);
    rerender({});
    await waitFor(() => expect(result.current.record).toEqual({ answers: null }));
    await act(async () => first.resolve(JSON.stringify({ answers })));
    expect(result.current.record).toEqual({ answers: null });
  });

  test('signing out hides private answers immediately and never reads a guest record', async () => {
    read.mockResolvedValueOnce(JSON.stringify({ answers }));
    const { result, rerender } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.record).toEqual({ answers }));
    signedIn(null);
    rerender({});
    expect(result.current.record).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalledWith('yoir.diagnosis.guest');
  });

  test('unreadable stored JSON becomes a new diagnosis instead of a completed direction', async () => {
    read.mockResolvedValueOnce('{bad stored JSON');
    const { result } = renderHook(useDiagnosis);
    await waitFor(() => expect(result.current.record).toBeNull());
    expect(finishedAnswers(result.current.record)).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});
