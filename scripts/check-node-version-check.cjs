const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertSupportedNode } = require('./check-node-version.cjs');

test('only patched Node 24 releases are accepted', () => {
  for (const version of ['20.20.2', '22.23.4', '24.21.0', '24.22.0', '26.12.1']) {
    assert.throws(() => assertSupportedNode(version), /Node 24.22.1/);
  }
  for (const version of ['24.22.1', '24.22.2', '24.23.0']) {
    assert.doesNotThrow(() => assertSupportedNode(version));
  }
});
