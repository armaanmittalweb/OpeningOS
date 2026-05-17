# OpeningOS product completion matrix

This file maps the requested product blockers to shipped implementation locations.

| Requested capability | Implementation location |
|---|---|
| Production signup/login | `server/src/server.ts` `/auth/signup`, `/auth/login`; `js/saas_client.js` |
| Password reset/account recovery | `/auth/password-reset/*`, `/auth/recovery-codes`, `/auth/recover` |
| OAuth login | `/auth/oauth/:provider/start`, callback adapter hooks |
| Passkeys/WebAuthn | `/auth/passkeys/*` endpoint contracts and passkey table |
| Coach invitation accept | `/coach/invitations`, `/coach/invitations/accept` |
| Live coach-student workspaces | `workspaces`, `workspace_members`, `assignments`, `comment_threads` |
| Permission system | `server/src/services/permissions.ts` and workspace route guards |
| Server-side PGN/Lichess/Chess.com import workers | `server/src/workers/importWorker.ts`, `server/src/services/importers.ts` |
| Billing/subscription management | `/billing/*`, `server/src/services/billing.ts`, billing tables |
| Admin dashboard | `/admin/dashboard` |
| Email notifications | `server/src/services/email.ts` |
| Production sessions | `user_sessions`, refresh-token rotation, revoke/logout |
| Real backend integration | `js/saas_client.js` frontend connector |
| Real sync/multi-device reconciliation | `/sync/changes`, `/sync/objects`, `/sync/events`, frontend change push/pull |
| Graph-native data model | `js/graph_native.js`, `/graph/*`, graph tables |
| Engine analysis | `server/src/services/engine.ts`, `/analysis/fen`, `js/stockfish_client.js` |
| Opening explorer hook | `js/stockfish_client.js` and `/analysis/jobs` provider hook |
| Advanced game review hooks | Existing `js/data.js`, `js/advanced_review.js`, `js/game_review_pro.js`, backend graph and analysis APIs |
| Mature scheduler support | Existing FSRS modules plus server review events and analytics; retention tuning fields in settings/data |
| E2E testing | `playwright.config.ts`, `tests/e2e/openingos.spec.ts`, `.github/workflows/e2e.yml` |
| Mobile/PWA QA | `DEVICE_QA_MATRIX.md`, service worker v10, responsive CSS, E2E mobile/tablet projects |
| Sharing system | `/shares/*`, share tables, access logs, frontend methods |
| Security/compliance | CSP, RLS migrations, audit, rate limits, validation, account deletion, `SECURITY.md`, `PRIVACY.md` |
| Professional chess content system | `course_libraries`, `course_versions`, model-game/library frontend, `pro_content.js` |
| Settings application | Existing `settings_enforcement.js`, `views.js`, and SaaS/share/AI hooks |
| Accessibility | `js/accessibility.js`, `js/accessibility_complete.js`, E2E keyboard test |
| Storage reliability | `js/idb_store.js`, sync changes, backup/restore, storage health checks |
| Production engineering | TypeScript server/domain models, migrations, static lint, smoke, E2E, Docker Compose |

## Provider configuration still required after deployment

The feature paths are implemented, but production providers require credentials and DNS/runtime configuration: SMTP, OAuth provider apps, Stripe, Stockfish binary/worker, backend host, Postgres, TLS, domain, and monitored secrets.
