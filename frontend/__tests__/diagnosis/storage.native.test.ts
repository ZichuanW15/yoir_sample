import * as SecureStore from 'expo-secure-store';
import { readDiagnosis, writeDiagnosis } from '@/src/diagnosis/storage';

// Wrapper behaviour only. A mocked SecureStore is not a device/keychain or restart test.
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

beforeEach(() => { jest.resetAllMocks(); });

test('uses the exact account-specific key and leaves serialized answers intact', async () => {
  const first = 'yoir.diagnosis.first';
  const second = 'yoir.diagnosis.second';
  const data = JSON.stringify({ answers: { now: 'other', other: { now: '职业转换' } }, step: 1 });
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(data).mockResolvedValueOnce(null);
  await writeDiagnosis(first, data);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(first, data);
  expect(await readDiagnosis(first)).toBe(data);
  expect(await readDiagnosis(second)).toBeNull();
  expect(SecureStore.getItemAsync).toHaveBeenNthCalledWith(1, first);
  expect(SecureStore.getItemAsync).toHaveBeenNthCalledWith(2, second);
});

test('an unreadable secure store returns no record without a fabricated saved answer', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('Keychain unavailable'));
  expect(await readDiagnosis('yoir.diagnosis.first')).toBeNull();
});

test('characterizes swallowed native write errors; resolution is not proof of persistence', async () => {
  jest.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('Storage full'));
  await expect(writeDiagnosis('yoir.diagnosis.first', 'draft')).resolves.toBeUndefined();
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('yoir.diagnosis.first', 'draft');
});
