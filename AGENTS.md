# Travel Together development

- Address the user as 준세님 and use polite Korean for final reports.
- The user designated https://github.com/2junworld/Travel-Together as the source of truth for future development and version history. Default branch: main.
- Before editing, inspect the remote branch and existing changes. Preserve the original history; never force-push or replace user work.
- Commit each coherent change with a descriptive message. Include relevant code, tests, SQL migrations, and documentation. Verify the remote commit before reporting an upload as complete.
- As of 2026-11-22, the initial GitHub upload is pending: the GitHub connector returned 403 Resource not accessible by integration. Do not claim it is synchronized until the remote contains the source.
- Production URL: https://travel-together-theta.vercel.app. Vercel project: travel-together. Production builds use npm run build:production; build:preview is sample-only and must never be published to the production app.
- Keep .env files, credentials, access tokens, reservation identifiers, real database exports, node_modules, and build outputs out of Git. .env.example contains empty placeholders only.
- Run npm run typecheck and npm test for code changes, plus the appropriate build. Explain any validation limits.
- Record production deployments and meaningful changes in CHANGELOG.md.
- Do not buy credits, upgrade paid plans, or send real family invitation emails without a new explicit user instruction.
- Supabase URL configuration and a successful production email-link login were confirmed by the user. Avoid unnecessary authentication-setting changes.
