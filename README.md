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

## HRMS module (UI-only)
The HR module is built end to end as UI, with no database or server:

- Website: an **HR** group in the sidebar (Overview, Employees, Attendance, Leave & Holidays, Recruitment, Payroll, Performance, Documents).
- App: **My HR** self-service (profile, attendance, leave, payslips) for field officers, and an **HR** tab (team, approvals, today) for branch managers/admins.
- Demo data: 43 employees, attendance, leave, recruitment pipeline, payroll and documents. The website persists it in `localStorage`; **HR Overview -> Reset demo data** restores it.
- Try it: serve `WEBSITE` over HTTP (ES modules need it), then choose **Explore the HR demo** on the sign-in page.

Full details, the mock store contract and the backend migration notes are in
[`HR_MODULE.md`](HR_MODULE.md).

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
