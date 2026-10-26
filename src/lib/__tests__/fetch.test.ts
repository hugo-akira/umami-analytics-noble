import { request } from '../fetch';

type RuntimeProcess = {
  env: Record<string, string | undefined>;
};

const runtimeProcess = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;

describe('server fetch compression negotiation', () => {
  const originalRuntime = runtimeProcess?.env.NEXT_RUNTIME;

  afterEach(() => {
    jest.restoreAllMocks();
    if (runtimeProcess) {
      if (originalRuntime === undefined) delete runtimeProcess.env.NEXT_RUNTIME;
      else runtimeProcess.env.NEXT_RUNTIME = originalRuntime;
    }
  });

  it('limits Node server requests to gzip/deflate', async () => {
    if (!runtimeProcess) throw new Error('Node process is required for this test');
    runtimeProcess.env.NEXT_RUNTIME = 'nodejs';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    } as Response);

    await request('GET', 'https://example.invalid/api');

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('accept-encoding')).toBe(
      'gzip, deflate',
    );
  });

  it.each([
    { 'accept-encoding': 'br' },
    { 'AcCePt-EnCoDiNg': 'br, gzip' },
    { 'Accept-Encoding': 'identity', 'accept-encoding': 'br' },
  ])('replaces caller encoding case-insensitively: %j', async headers => {
    if (!runtimeProcess) throw new Error('Node process is required for this test');
    runtimeProcess.env.NEXT_RUNTIME = 'nodejs';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    } as Response);

    await request('GET', 'https://example.invalid/api', undefined, {
      ...headers,
      'X-Request-ID': 'case-casing',
    });

    const sent = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(sent.get('accept-encoding')).toBe('gzip, deflate');
    expect(sent.get('x-request-id')).toBe('case-casing');
    expect(sent.get('accept')).toBe('application/json');
    expect(sent.get('content-type')).toBe('application/json');
  });

  it('leaves browser and Edge negotiation to the runtime', async () => {
    if (!runtimeProcess) throw new Error('Node process is required for this test');
    runtimeProcess.env.NEXT_RUNTIME = 'edge';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    } as Response);

    await request('GET', 'https://example.invalid/api');

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('accept-encoding')).toBeNull();
  });
});
