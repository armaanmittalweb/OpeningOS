# Production security review checklist

This codebase includes security controls, but a commercial launch still requires an operator-led review.

## Implemented controls

- CSP in `index.html`
- backend schema validation with Zod
- rate limiting with Fastify rate-limit
- hashed passwords using scrypt
- refresh-token session storage and revocation
- password reset tokens and recovery codes stored as hashes
- audit logging with IP/user-agent fields
- Postgres RLS policy scaffolding
- account deletion endpoint
- share link revocation/expiry/access logs
- workspace permissions

## Must be configured before launch

- strong `JWT_SECRET`
- restricted `CORS_ORIGIN`
- HTTPS/TLS on all domains
- SMTP provider credentials
- OAuth provider credentials
- Stripe webhook verification implementation
- Stockfish worker sandboxing/rate limits
- Postgres backups and PITR
- dependency scanning in CI
- legal privacy policy and terms
- incident response contact

## Recommended external review

Before paid launch, perform a security review covering auth, sessions, billing webhooks, permission boundaries, share links, import job abuse, and engine-job rate limits.
