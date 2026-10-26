let observed = false;

// Install Node-only containment before application requests; do not swallow failure.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { install } = await import('./lib/security/brotli-guard.cjs');
    const { install: installNegotiation } = await import('./lib/security/fetch-negotiation.cjs');
    installNegotiation();
    install();
    if (observed) return;
    observed = true;
    console.info('[umami:runtime-startup]', {
      node: process.versions.node,
      brotli: process.versions.brotli,
      undici: process.versions.undici,
    });
  }
}
