'use strict';

// Node-only global fetch negotiation. Decoder containment remains a separate guard.
const MARKER = Symbol.for('umami.fetch-negotiation.v1');

function install() {
  const original = globalThis.fetch;
  if (typeof original !== 'function') throw new Error('Node fetch is unavailable');
  if (original[MARKER]) return;

  const wrapped = async function (input, init) {
    // Leave invalid dictionary arguments to native fetch's own validation.
    if (init != null && !['object', 'function'].includes(typeof init)) {
      return original.call(this, input, init);
    }
    const base = init ?? {};
    let sourceHeaders = base.headers;
    if (sourceHeaders === undefined && typeof Request === 'function' && input instanceof Request) {
      sourceHeaders = input.headers;
    }
    const headers = new Headers(sourceHeaders);
    const encoding = headers.get('accept-encoding');
    if (encoding === null) {
      headers.set('accept-encoding', 'gzip, deflate');
    } else {
      const parts = encoding.split(',');
      const safe = parts.filter(part => {
        const name = part.split(';', 1)[0].trim().toLowerCase();
        return name !== 'br' && name !== '*';
      });
      if (safe.length !== parts.length) {
        headers.set('accept-encoding', safe.join(',').trim() || 'identity');
      }
    }
    // A separate extensible target permits frozen inputs; delegate every other
    // lookup with the original receiver (including inherited/private getters).
    const options = new Proxy(
      { headers },
      {
        get(target, key) {
          return key === 'headers' ? target.headers : Reflect.get(base, key, base);
        },
        has(_target, key) {
          return key === 'headers' || Reflect.has(base, key);
        },
        set(target, key, value) {
          return key === 'headers'
            ? Reflect.set(target, key, value)
            : Reflect.set(base, key, value, base);
        },
        deleteProperty(target, key) {
          return key === 'headers'
            ? Reflect.deleteProperty(target, key)
            : Reflect.deleteProperty(base, key);
        },
        ownKeys() {
          return [...new Set([...Reflect.ownKeys(base), 'headers'])];
        },
        getOwnPropertyDescriptor(target, key) {
          if (key === 'headers') return Reflect.getOwnPropertyDescriptor(target, key);
          const descriptor = Reflect.getOwnPropertyDescriptor(base, key);
          return descriptor && { ...descriptor, configurable: true };
        },
      },
    );
    return original.call(this, input, options);
  };
  // Preserve framework fetch markers/extensions if registration follows a patch.
  Object.defineProperties(wrapped, Object.getOwnPropertyDescriptors(original));
  Object.defineProperty(wrapped, MARKER, { value: true });
  globalThis.fetch = wrapped;
}

module.exports = { install };
