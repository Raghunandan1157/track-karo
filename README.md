# Track_karo

Field-employee tracking: a Flutter app for field officers and branch managers, and a website for the admin and branch managers.

| Folder | What it is |
|---|---|
| `APP/` | Flutter app (Android + iOS) |
| `WEBSITE/` | Website (HTML/CSS/JS) and the backend API (`WEBSITE/api`), hosted on Vercel |
| `CRM/` | Customer calling CRM UI demo - feedback, call outcomes, positive/angry responses, blacklist and percentage reports. No server or database; data stays in the browser. |
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

## CRM UI demo (no backend)
`CRM/index.html` opens directly in a browser - no install, no server, no database. It covers customer
calling feedback, call outcomes (answered / not answered / not connected / switched off / busy / wrong
number), customer responses (positive / polite / neutral / angry / not interested), follow-ups,
blacklist and percentage reports. Data is saved in the browser's localStorage and can be reset from
the sidebar. See `CRM/README.md` for Android install and how to connect a real API later.
