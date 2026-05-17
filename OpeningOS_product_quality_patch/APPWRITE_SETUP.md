# Appwrite Cloud Sync Setup

OpeningOS is fully usable without cloud sync. The Appwrite adapter is optional and is meant for users who want authenticated cloud backup/device restore while keeping the app deployable as a static GitHub Pages site.

## Why Appwrite

Appwrite has an Education program tied to the GitHub Student Developer Pack. With a verified student account, you can use Appwrite Cloud during your student career. This makes it a practical next step after the GitHub Pages deployment.

## 1. Create the Appwrite project

1. Open the Appwrite Education sign-up page and sign in with GitHub.
2. Create a new Appwrite Cloud project, for example `OpeningOS`.
3. Copy the project ID.
4. Add your deployed site as a Web platform origin. For GitHub Pages this usually looks like:

```text
https://YOUR_USERNAME.github.io
```

For a project site, also add the full site origin if Appwrite asks for it:

```text
https://YOUR_USERNAME.github.io/openingos
```

## 2. Enable account login

In the Appwrite console, enable email/password account login for the project. OpeningOS uses Appwrite's client-side Account REST endpoints and session cookies.

## 3. Create the database and collection

Create a database, for example:

```text
Database ID: openingos
```

Create a collection, for example:

```text
Collection ID: snapshots
```

Add these attributes:

| Attribute | Type | Required | Suggested size |
|---|---|---:|---:|
| `kind` | String | Yes | 64 |
| `schema` | String | Yes | 64 |
| `clientVersion` | String | Yes | 32 |
| `updatedAt` | String | Yes | 64 |
| `payload` | String | Yes | As large as Appwrite allows for your plan |

OpeningOS stores one JSON snapshot in `payload`. Serious users with huge PGN libraries should still keep manual backups from **Settings -> Backup / Restore**.

## 4. Permissions

For a simple student deployment:

1. Allow authenticated users to create documents in the collection.
2. Keep document-level access private to the current user.
3. Do not make snapshots publicly readable.

The default Appwrite behavior for client-created documents is suitable for private user-owned documents when your collection permissions are set correctly.

## 5. Configure OpeningOS

In the hosted OpeningOS app:

1. Open **Settings**.
2. Scroll to **Cloud Sync**.
3. Click **Configure**.
4. Enter:

```text
Endpoint: https://cloud.appwrite.io
Project ID: your_project_id
Database ID: openingos
Collection ID: snapshots
Document ID: openingos_default
```

For regional Appwrite endpoints, use the regional endpoint shown in your Appwrite console.

## 6. Sign in and test

1. Click **Sign up** or **Sign in** in the Cloud Sync settings.
2. Click **Test connection**.
3. Click **Push to cloud**.
4. On another browser/device, configure the same project, sign in, and click **Pull from cloud**.

## Important security notes

- Cloud sync sends a full OpeningOS backup snapshot to your Appwrite project.
- Users should only enable it when they understand that their private repertoire leaves the browser.
- Transport is HTTPS, but OpeningOS does not add client-side end-to-end encryption in this static build.
- Keep the project private and do not grant public read permissions to the snapshot collection.
- For a paid SaaS, move to the backend design in `BACKEND_MIGRATION.md` with proper per-user records, audit logs, and server-side validation.
