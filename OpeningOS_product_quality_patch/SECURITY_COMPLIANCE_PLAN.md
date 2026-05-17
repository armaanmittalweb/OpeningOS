# Security and Compliance Plan

OpeningOS now includes secure-by-default implementation surfaces, but production launch still requires operational verification.

## Implemented in code

- Scrypt password hashing.
- Short-lived access tokens.
- Refresh sessions stored server-side.
- Session revocation.
- Password reset flow.
- OAuth flow.
- Passkeys/WebAuthn endpoints.
- Zod validation for API payloads.
- Rate limiting.
- CSP on frontend.
- Row-level security migration policies.
- Audit events.
- Account deletion endpoint.
- Share link revocation and access logs.
- Data deletion through Postgres cascades.

## Must be done before paid launch

- Legal review of `PRIVACY.md` and terms text for your jurisdiction.
- Penetration testing of auth, sharing, billing, imports, and coach permissions.
- Dependency scanning in CI.
- Secrets stored only in hosting provider secret manager.
- Stripe webhook signature verification with raw body middleware.
- Backups and restore drills for Postgres.
- Incident response policy.
- Data processing agreements with email/OAuth/billing providers.

## Recommended CI additions

- `npm audit --omit=dev` for server.
- Dependabot for npm dependencies.
- Playwright E2E on every PR.
- Postgres migration validation in CI.
