# Render backend + Vercel frontend

**Task 06C:** [root-cause audit, clean verification and step-by-step Render settings](server/TASK_06C_REPORT.md).

Preparation only: this change does not deploy either service or run database migrations.

Use repository root for both services, not server/. Node.js 24.21.0 is pinned. Render build: `npm ci --include=dev && npm run db:generate && npm run server:build`. Start: `npm run server:start`, which executes the compiled `server/dist/index.mjs` using Node. Backend build never runs Vite; Vercel alone uses `npm run build`. Prisma's location is server/prisma/schema.prisma. HOST must be `0.0.0.0`; Render supplies PORT. Keep one backend instance because realtime presence/controller coordination are process-local. Auto deploy is off in the Blueprint; do not trigger a manual deployment until the owner approves Task 06C.

Set **DATABASE_URL** as a secret on Render using the existing Neon connection string with TLS; never put it in Git or Vercel/frontend variables. Set **FRONTEND_ORIGIN** on Render to the exact Vercel HTTPS origin without trailing slash; comma separated origins are supported. Arbitrary preview domains are not automatically permitted. The existing Neon schema is already migrated; for later migrations run `npx prisma migrate deploy --schema server/prisma/schema.prisma` with DATABASE_URL injected into the environment. The local `db:migrate` script instead loads server/.env.

Vercel uses `vercel.json`: Vite, `npm run build`, output `dist`. Set **VITE_API_URL** to the public HTTPS Render backend origin before building, e.g. `https://your-backend.onrender.com`. It is public and contains no credentials. Both fetch and Socket.IO connect directly to that backend; WebSocket traffic does not depend on a Vercel rewrite. Changing VITE_API_URL requires a new frontend build. Without this variable, local development uses the Vite proxy.

Check `/api/health` on Render, then verify create/join/start, four clients, sealed bids and reconnect with the deployed frontend origin. Health confirms HTTP process readiness; startup connects Prisma before opening the port. Hosting account settings, TLS domains, real cross-origin browser checks and live deployment remain to be performed by the owner.

Clean verification: `npm run verify:render` (private server/.env required); this installs from lockfile into a fresh ignored directory, generates Prisma, builds/starts the compiled backend against Neon, checks HTTP/CORS, types, full tests and frontend build, then verifies existing database rows are unchanged. Individual commands: `npm run typecheck`, `npm run test:neon`, `npm run server:build`, `npm run build`. Keep other gameplay idle during the database integrity check. No rules changes are part of deployment preparation.

References: [Render Blueprint](https://render.com/docs/blueprint-spec), [health checks](https://render.com/docs/health-checks), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json).
