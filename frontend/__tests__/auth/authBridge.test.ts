import {
  adoptSession, bindAuth, currentSession, platformClient, refreshOnce, resetAuthBridge,
} from '@/src/api/authBridge';

describe('the bridge between the HTTP client and the session', () => {
  beforeEach(() => resetAuthBridge());

  test('before anything binds, there is no session and adopting one is harmless', () => {
    // The client module loads before AuthProvider mounts, so these have to be safe.
    expect(currentSession()).toBeNull();
    expect(() => adoptSession(null)).not.toThrow();
  });

  test('binding wires the getter and setter through', () => {
    let held: unknown = null;
    bindAuth(() => held as never, (next) => { held = next; });

    adoptSession({ accessToken: 'a' } as never);

    expect(currentSession()).toEqual({ accessToken: 'a' });
  });

  test('one refresh is shared by everyone who asks while it is in flight', async () => {
    let started = 0;
    let release: (value: null) => void = () => {};
    const exchange = () => {
      started += 1;
      return new Promise<null>((resolve) => { release = resolve; });
    };

    const all = Promise.all([refreshOnce(exchange), refreshOnce(exchange), refreshOnce(exchange)]);
    release(null);
    await all;

    expect(started).toBe(1);
  });

  test('a later refresh starts afresh once the first has settled', async () => {
    let started = 0;
    const exchange = async () => { started += 1; return null; };

    await refreshOnce(exchange);
    await refreshOnce(exchange);

    expect(started).toBe(2);
  });

  test('a refresh that throws resolves to no session rather than escaping', async () => {
    // A rejection here would surface as an unhandled error inside an unrelated
    // request; the caller only needs to know it has no new token.
    await expect(refreshOnce(async () => { throw new Error('network'); })).resolves.toBeNull();
  });

  test('the platform identifier is one the API accepts', () => {
    expect(['web', 'native']).toContain(platformClient);
  });
});
