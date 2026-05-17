# Security Notes

OpeningOS stores private opening preparation, so the default product posture is private and local-first.

## Current protections

- Critical chess logic is bundled locally.
- Content Security Policy is included in `index.html` and deployment configs.
- User markdown is rendered without allowing raw HTML.
- Appwrite cloud sync is opt-in.
- Passwords are not stored by OpeningOS.
- Backup/export actions are explicit.

## Sensitive data

Opening prep can include private tournament work, opponent prep, and coach notes. Users should not enable cloud sync unless they trust the configured Appwrite project.

## Reporting issues

Until a public repository is created, track security issues privately. Once hosted, add a security contact email and GitHub Security Advisories.

## SaaS hardening before paid launch

Before charging users, add:

- backend auth and authorization
- server-side validation
- database row-level permissions
- audit logs for sharing and coach access
- rate limits for imports and auth
- account deletion/export controls
- abuse prevention
- dependency scanning
- regular backups
