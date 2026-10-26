import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(__dirname, '../security/fetch-negotiation.cjs'), 'utf8');

function setup() {
  const original = jest.fn(async (_input: unknown, _options: RequestInit) => ({ ok: true }));
  const extension = () => 'framework-extension';
  Object.defineProperty(original, '__nextGetStaticStore', { value: extension });
  const realm = {
    fetch: original as unknown as typeof fetch,
    Headers,
    Request,
    module: { exports: {} as { install: () => void } },
  };
  vm.runInNewContext(source, realm);
  realm.module.exports.install();
  return { realm, original, extension };
}

describe('Node global fetch negotiation', () => {
  it.each([
    [undefined, 'gzip, deflate'],
    ['br', 'identity'],
    ['BR;q=1, gzip;q=0.7, identity;q=0.5', 'gzip;q=0.7, identity;q=0.5'],
    ['*', 'identity'],
    ['br;q=0, *;q=0, identity;q=0', 'identity;q=0'],
    ['identity', 'identity'],
    ['gzip, deflate', 'gzip, deflate'],
    ['', ''],
  ])('normalizes %s without enabling refused codecs', async (encoding, expected) => {
    const { realm, original } = setup();
    const headers: Record<string, string> = { 'X-Request-ID': 'global-transport' };
    if (encoding !== undefined) headers['aCcEpT-eNcOdInG'] = encoding;
    await realm.fetch('https://example.invalid/direct', { headers });
    const sent = new Headers(original.mock.calls[0][1].headers);
    expect(sent.get('accept-encoding')).toBe(expected);
    expect(sent.get('x-request-id')).toBe('global-transport');
    expect(headers['aCcEpT-eNcOdInG']).toBe(encoding);
  });

  it('preserves frozen options, method/body/signal/cache and framework metadata', async () => {
    const { realm, original } = setup();
    const signal = new AbortController().signal;
    const next = { tags: ['transport-regression'], revalidate: 600 };
    const init = Object.freeze({
      method: 'POST',
      body: 'body-contract',
      signal,
      cache: 'no-store' as RequestCache,
      next,
    });
    await realm.fetch('https://example.invalid/direct', init);
    const sent = original.mock.calls[0][1] as RequestInit & { next: unknown };
    expect(sent.method).toBe(init.method);
    expect(sent.body).toBe(init.body);
    expect(sent.signal).toBe(signal);
    expect(sent.cache).toBe(init.cache);
    expect(sent.next).toBe(next);
  });

  it('inherits Request headers but respects an explicit init header replacement', async () => {
    const { realm, original } = setup();
    const input = new Request('https://example.invalid/request', {
      method: 'POST',
      body: 'body-contract',
      headers: { 'Accept-Encoding': 'br', 'X-Caller': 'request' },
    });
    await realm.fetch(input);
    expect(original.mock.calls[0][0]).toBe(input);
    const inherited = new Headers(original.mock.calls[0][1].headers);
    expect(inherited.get('accept-encoding')).toBe('identity');
    expect(inherited.get('x-caller')).toBe('request');
    await realm.fetch(input, { headers: { 'X-Override': 'init' } });
    const replaced = new Headers(original.mock.calls[1][1].headers);
    expect(replaced.get('accept-encoding')).toBe('gzip, deflate');
    expect(replaced.get('x-caller')).toBeNull();
    expect(replaced.get('x-override')).toBe('init');
  });

  it('retains inherited/nonenumerable options and original getter receivers', async () => {
    const { realm, original } = setup();
    class Options {
      #body = 'inherited-body';
      get method() {
        return 'POST';
      }
      get body() {
        return this.#body;
      }
      get headers() {
        return { 'Accept-Encoding': 'identity' };
      }
    }
    const init = new Options();
    const next = { tags: ['nonenumerable'] };
    Object.defineProperty(init, 'next', { value: next });
    Object.freeze(init);
    await realm.fetch('https://example.invalid/direct', init);
    const sent = original.mock.calls[0][1] as RequestInit & { next: unknown };
    expect(sent.method).toBe('POST');
    expect(sent.body).toBe('inherited-body');
    expect(sent.next).toBe(next);
    expect(new Headers(sent.headers).get('accept-encoding')).toBe('identity');
  });

  it('preserves downstream framework option mutation semantics', async () => {
    const { realm, original } = setup();
    let observed: unknown[] = [];
    original.mockImplementation(async (_input, options) => {
      delete options.cache;
      options.method = 'POST';
      observed = [options.cache, options.method];
      return { ok: true };
    });
    const init = { cache: 'no-store' as RequestCache, method: 'GET' };
    await realm.fetch('https://example.invalid/direct', init);
    expect(observed).toEqual([undefined, 'POST']);
    expect(init.method).toBe('POST');
    expect(init.cache).toBeUndefined();
  });

  it('is idempotent and retains framework fetch descriptors', () => {
    const { realm, extension } = setup();
    const installed = realm.fetch;
    realm.module.exports.install();
    expect(realm.fetch).toBe(installed);
    expect(Object.getOwnPropertyDescriptor(installed, '__nextGetStaticStore')?.value).toBe(
      extension,
    );
  });

  it('turns invalid header validation into a rejected promise, not a synchronous throw', async () => {
    const { realm, original } = setup();
    const result = realm.fetch('https://example.invalid/direct', {
      headers: { 'bad\nname': 'value' },
    });
    await expect(result).rejects.toThrow();
    expect(original).not.toHaveBeenCalled();
  });
});
