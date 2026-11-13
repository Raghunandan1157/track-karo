# Track_karo

Field-employee tracking: a Flutter app for field officers and branch managers, and a website for the admin and branch managers.

| Folder | What it is |
|---|---|
| `APP/` | Flutter app (Android + iOS) |
| `WEBSITE/` | Website (HTML/CSS/JS) and the backend API (`WEBSITE/api`), hosted on Vercel |
| `db/schema.sql` | Neon Postgres schema, database-push triggers and seed |
| `API.md` | API contract shared by the app and the website |

## How it fits together
- The app sends GPS points to the API, which stores every point with its timestamp in Neon.
- Database triggers announce every change (`NOTIFY`); `/api/stream` forwards them to the website as a live push stream, so the website never polls the database.
- Vercel deploys automatically on every push to `main` (project root: `WEBSITE`). Do not deploy by hand.

## Run the website locally
```bash
cd WEBSITE && npm install && npm run dev   # http://localhost:3100, needs WEBSITE/.env.local
```
`.env.local` needs `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, `CRON_SECRET` (same names as the Vercel environment variables).

## Build the app
```bash
cd APP && flutter pub get && flutter build apk --release
```
The API address is the single constant in `APP/lib/config.dart`.

## Recovery module (UI demo)

The recovery desk is a UI-only module for a `recovery_manager` role. It uses static sample data and does not call the API or database.

- **Website**: open `index.html` and choose **Open as Recovery Manager (demo)**.
- **App**: on the login screen choose **Preview Recovery Module (demo)**.

The module covers the 28-stage workflow (pre-legal, legal and final recovery), case workspace, notices, settlement calculator/approvals, reports and stage setup. Stage changes, payments, notices and proposals stay in memory and reset on reload/restart.
