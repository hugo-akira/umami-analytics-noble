// Vercel selects a major only: fail the build if its actual patch is unpatched.
function assertSupportedNode(version = process.versions.node) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (major !== 24 || !(minor > 22 || (minor === 22 && patch >= 1))) {
    throw new Error(`Node 24.22.1 or newer within 24.x is required; actual: ${version}`);
  }
}

if (require.main === module) {
  console.info(`[node-runtime] node=${process.versions.node} undici=${process.versions.undici || 'unavailable'}`);
  assertSupportedNode();
}
module.exports = { assertSupportedNode };
