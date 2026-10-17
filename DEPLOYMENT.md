# Render backend + Vercel frontend

Preparation only: this change does not deploy either service or run database migrations.

Use repository root for both services. Node.js 24 is required. Render uses `render.yaml`, installs development tools intentionally (Prisma/tsx/TypeScript), generates Prisma Client, checks types and starts Express + Socket.IO. HOST must be `0.0.0.0`; Render supplies PORT. Keep one backend instance because realtime presence and controller coordination are process-local.

Set **DATABASE_URL** as a secret on Render using the existing Neon connection string with TLS; never put it in Git or Vercel/frontend variables. Set **FRONTEND_ORIGIN** on Render to the exact Vercel HTTPS origin without trailing slash; comma separated origins are supported. Arbitrary preview domains are not automatically permitted. The existing Neon schema is already migrated; for later migrations run `npx prisma migrate deploy --schema server/prisma/schema.prisma` with DATABASE_URL injected into the environment. The local `db:migrate` script instead loads server/.env.

Vercel uses `vercel.json`: Vite, `npm run build`, output `dist`. Set **VITE_API_URL** to the public HTTPS Render backend origin before building, e.g. `https://your-backend.onrender.com`. It is public and contains no credentials. Both fetch and Socket.IO connect directly to that backend; WebSocket traffic does not depend on a Vercel rewrite. Changing VITE_API_URL requires a new frontend build. Without this variable, local development uses the Vite proxy.

Check `/api/health` on Render, then verify create/join/start, four clients, sealed bids and reconnect with the deployed frontend origin. Health confirms HTTP process readiness; startup connects Prisma before opening the port. Hosting account settings, TLS domains, real cross-origin browser checks and live deployment remain to be performed by the owner.

Local verification: `npm run typecheck`, `npm run test:neon` (private server/.env), `npm run build`. Database tests only touch their own new rooms. Keep other gameplay idle while running the existing-room integrity check. No rules changes are part of deployment preparation.

References: [Render Blueprint](https://render.com/docs/blueprint-spec), [health checks](https://render.com/docs/health-checks), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json).
