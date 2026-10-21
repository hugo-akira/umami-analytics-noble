# Node.js security runtime policy

- Local development and CI: Node **24.22.1**, pinned in `.nvmrc` and Actions.
- Hosting: `engines.node = 24.x` selects the Vercel major, not a patched minor.
- `scripts/check-node-version.cjs` prints actual Node/Undici and rejects Node
  below 24.22.1 or outside major 24 before dev/build/start. Run its dependency-free
  regression checks with `node --test scripts/check-node-version-check.cjs`.
- Vercel serverless functions do not execute `npm start`. The build guard proves
  only the build runtime; production acceptance still requires `process.version`
  and `process.versions.undici` from a real invocation of the exact deployment.
  A successful build/preview is NOT proof of the production function runtime.
- Parent observed F.T.R.E-web PR95 Preview build Node 24.22.0 on 2026-10-21;
  this is below the fixed patch. Treat Vercel release as HOLD until 24.22.1
  is available and measured. Do not weaken the guard to publish.
- Do not merge/redeploy until independent review, required CI, and the deployment
  owner's patch-availability check are complete. Never infer security from 24.x.
- Rollback: revert this PR as a unit, but do not restore production to an EOL or
  unpatched runtime; retain a verified patched release as the rollback target.

## Container release hold

Docker tag `node:24.22.1-alpine` is an intended patch pin, NOT a verified
usable image. The official registry returned an empty OCI index (zero platform
manifests). No digest was pinned because it would pin an unusable index.
Before merge/container release require a nonempty official platform manifest,
pin its verified digest, build the image, and inspect Node in builder and runner.
The normal Umami build/start-docker includes DB checks/migrations: do not execute
it against production as a compatibility test.
