import { readDiagnosis, writeDiagnosis } from '@/src/diagnosis/storage.web';

const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
const replaceStorage = (storage: Partial<Storage>) => {
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
};

afterEach(() => {
  if (original) Object.defineProperty(window, 'localStorage', original);
  else Reflect.deleteProperty(window, 'localStorage');
});

describe('browser diagnosis persistence — QA-162/165/168', () => {
  test('two accounts keep separate answers, and a retake replaces only its owner’s record', async () => {
    const values = new Map<string, string>();
    replaceStorage({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } });
    await writeDiagnosis('yoir.diagnosis.alex', '{"answers":null}');
    await writeDiagnosis('yoir.diagnosis.sam', '{"answers":{"now":"study"},"step":1}');
    await writeDiagnosis('yoir.diagnosis.alex', '{"answers":{"now":"job"},"step":1}');
    expect(await readDiagnosis('yoir.diagnosis.alex')).toBe('{"answers":{"now":"job"},"step":1}');
    expect(await readDiagnosis('yoir.diagnosis.sam')).toBe('{"answers":{"now":"study"},"step":1}');
    expect(await readDiagnosis('yoir.diagnosis.new-account')).toBeNull();
  });

  test('blocked site data returns no saved diagnosis and does not throw while saving', async () => {
    const refuse = () => { throw new Error('SecurityError: site data is blocked'); };
    replaceStorage({ getItem: refuse, setItem: refuse });
    await expect(readDiagnosis('yoir.diagnosis.alex')).resolves.toBeNull();
    await expect(writeDiagnosis('yoir.diagnosis.alex', '{"answers":null}')).resolves.toBeUndefined();
  });

  test('a full storage quota leaves the previous saved value readable', async () => {
    const previous = '{"answers":null}';
    replaceStorage({
      getItem: () => previous,
      setItem: () => { throw new Error('QuotaExceededError'); },
    });
    await expect(writeDiagnosis('yoir.diagnosis.alex', '{"answers":{"now":"job"}}')).resolves.toBeUndefined();
    expect(await readDiagnosis('yoir.diagnosis.alex')).toBe(previous);
  });
});
