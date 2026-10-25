let observed = false;

// Next.js calls register on server startup; never collect request or environment values.
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || observed) {
    return;
  }

  observed = true;
  console.info('[umami:runtime-startup]', {
    node: process.versions.node,
    brotli: process.versions.brotli,
    undici: process.versions.undici,
  });
}
