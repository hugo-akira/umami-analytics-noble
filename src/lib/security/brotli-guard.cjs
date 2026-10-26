'use strict';
// TEMPORARY containment: install before application HTTP clients load.
// Not a Node patch; captured pre-install functions/native addons remain out of scope.
const zlib = require('node:zlib');
const { Transform } = require('node:stream');
const { syncBuiltinESMExports } = require('node:module');
const marker = Symbol.for('hugo.brotli-containment.v1');
function blocked() {
  return Object.assign(new Error('Brotli decoding disabled by temporary containment'), { code: 'ERR_BROTLI_CONTAINMENT' });
}
class DeniedBrotliDecompress extends Transform {
  constructor() { super(); }
  _transform(_chunk, _encoding, callback) { setImmediate(callback, blocked()); }
  _flush(callback) { setImmediate(callback, blocked()); }
}
function denySync() { throw blocked(); }
function denyAsync(...args) {
  const callback = args.at(-1);
  if (typeof callback !== 'function') throw blocked();
  process.nextTick(callback, blocked());
}
function denyStream() { return new DeniedBrotliDecompress(); }
const replacements = {
  BrotliDecompress: DeniedBrotliDecompress,
  createBrotliDecompress: denyStream,
  brotliDecompress: denyAsync,
  brotliDecompressSync: denySync,
};
function install() {
  if (zlib[marker]) return;
  // Verify all entries before mutation. Throw => startup must not proceed unguarded.
  for (const key of Object.keys(replacements)) {
    if (!Object.getOwnPropertyDescriptor(zlib, key)?.configurable) {
      throw new Error(`Cannot install Brotli containment: ${key}`);
    }
  }
  for (const [key, value] of Object.entries(replacements)) {
    Object.defineProperty(zlib,key,{value,enumerable:true,writable:false,configurable:false});
  }
  syncBuiltinESMExports();
  Object.defineProperty(zlib,marker,{value:true});
  // Self-check invokes only denied JS; never constructs a native decoder.
  try { zlib.brotliDecompressSync(Buffer.alloc(0)); }
  catch (error) { if (error.code === 'ERR_BROTLI_CONTAINMENT') return; throw error; }
  throw new Error('Brotli containment self-check failed');
}
module.exports = {install};
// --require startup support (prefer earliest bootstrap over late instrumentation).
if (process.env.HUGO_BROTLI_PRELOAD === '1') install();
