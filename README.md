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

## Internal audit (UI preview)
`WEBSITE/js/views/audit.js` and the `#view-audit` section in `WEBSITE/app.html` are a
front-end prototype of the branch internal audit module: audit cycles, findings
(automatic and manual), corrective actions, evidence, an audit trail of every
change, sign-off with a score and a branch scorecard. It runs on demo data — no
database and no API calls. By default the data lives in memory, so a page reload
restores the examples; tick **Keep my changes in this browser** to save them to
this browser's localStorage, and use **Reset demo data** to start over.

Open it from the sidebar (**Internal Audit**) after signing in, or use the
standalone preview which needs no login and no backend:

```bash
cd WEBSITE && npm run dev   # then open http://localhost:3100/audit-demo.html
```

## Build the app
```bash
cd APP && flutter pub get && flutter build apk --release
```
The API address is the single constant in `APP/lib/config.dart`.
