# DigitalOcean Postgres TLS fix

This patch makes the backend database connection robust for DigitalOcean Managed PostgreSQL.

What changed:

- `server/src/db.ts` strips PostgreSQL SSL query parameters such as `sslmode=require` before creating the pg Pool.
- TLS is configured explicitly with `ssl: { rejectUnauthorized: false }` unless `DATABASE_SSL_CA` is supplied.
- `.do/app.yaml` now sets `PGSSLMODE=require` and `DATABASE_SSL_REJECT_UNAUTHORIZED=false` for the App Platform runtime.
- `/health/db` was added so deployment can verify the backend can actually read from Postgres.

After deploying, test:

```powershell
Invoke-RestMethod "https://monkfish-app-yxidj.ondigitalocean.app/health/db"
```

Expected:

```json
{
  "ok": true,
  "service": "openingos-backend",
  "database": "connected"
}
```
