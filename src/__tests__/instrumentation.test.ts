describe('startup runtime observation', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  function loadRegister(runtime?: string) {
    jest.replaceProperty(process, 'env', {
      NODE_ENV: 'test',
      NEXT_RUNTIME: runtime,
      SECRET: 'must-not-log',
    });
    let register: () => Promise<void>;
    jest.isolateModules(() => {
      register = require('../instrumentation').register;
    });
    return register;
  }

  it('logs only allowlisted versions once for the Node runtime', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const register = loadRegister('nodejs');

    await register();
    await register();

    const zlib = require('node:zlib');
    expect(() => zlib.brotliDecompressSync(Buffer.alloc(0))).toThrow(
      expect.objectContaining({ code: 'ERR_BROTLI_CONTAINMENT' }),
    );

    expect(info.mock.calls).toEqual([
      [
        '[umami:runtime-startup]',
        {
          node: process.versions.node,
          brotli: process.versions.brotli,
          undici: process.versions.undici,
        },
      ],
    ]);
  });

  it('protects direct Node fetch calls outside the shared API helper', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    const register = loadRegister('nodejs');
    await register();
    const installed = global.fetch;
    await register();
    expect(global.fetch).toBe(installed);

    const signal = new AbortController().signal;
    const next = { tags: ['transport-regression'] };
    await global.fetch('https://example.invalid/direct', { signal, next } as RequestInit);
    const sent = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(sent?.headers).get('accept-encoding')).toBe('gzip, deflate');
    expect(sent?.signal).toBe(signal);
    expect((sent as RequestInit & { next: unknown }).next).toBe(next);
  });

  it.each(['edge', undefined])('does not log for runtime %s', async runtime => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const register = loadRegister(runtime);

    await register();
    await register();

    expect(info).not.toHaveBeenCalled();
  });
});
