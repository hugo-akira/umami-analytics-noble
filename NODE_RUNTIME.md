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
- Vercel builds reported Node 24.22.0 on 2026-10-21 and 24.22.1 from
  2026-10-22. Do not weaken the guard to publish.
- Do not merge/redeploy until independent review, required CI, and the deployment
  owner's patch-availability check are complete. Never infer security from 24.x.
- Rollback: revert this PR as a unit, but do not restore production to an EOL or
  unpatched runtime; retain a verified patched release as the rollback target.

## Container image

`node:24.22.1-alpine` was an empty OCI index on 2026-10-21. On 2026-10-24 the
official index listed linux/amd64 and linux/arm64 manifests, and a pulled image
reported `v24.22.1` / Undici `7.30.1`
(`node@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53`).
No container deployment exists today; Vercel is the only host. Before any
container release, build the image and inspect Node in builder and runner.
The normal Umami build/start-docker includes DB checks/migrations: do not execute
it against production as a compatibility test.
