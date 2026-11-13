# HRMS module (UI-only build)

A complete HR module for Track_karo, built as **UI only**: no server, no
database, no API keys. The website keeps its demo data in `localStorage`; the
Flutter app keeps it in memory for the session. Every screen is wired to a
single mock store, so connecting a real backend later is a contained change.

## What was added

| Area | Where |
|---|---|
| HR overview, Employees, Attendance, Leave, Recruitment, Payroll, Performance, Documents | `WEBSITE/app.html` (`#hr` … `#documents`) |
| HR views | `WEBSITE/js/hr/views/*.js` |
| Mock data + store | `WEBSITE/js/hr/seed.js`, `WEBSITE/js/hr/store.js` |
| HR presentation helpers | `WEBSITE/js/hr/ui.js` |
| HR styles | `WEBSITE/css/styles.css` (section 25) |
| Demo sign-in | `WEBSITE/index.html` + `js/login.js` |
| App self-service (profile, attendance, leave, payslips) | `APP/lib/screens/hr/hr_me_screen.dart` |
| App manager HR tab (directory, approvals, today) | `APP/lib/screens/hr/hr_team_screen.dart` |
| App mock store + models | `APP/lib/services/hr_store.dart`, `APP/lib/models/hr_models.dart` |
| App widgets | `APP/lib/widgets/hr_widgets.dart` |

## Trying it

The website uses ES modules, so it must be served over HTTP (not opened as a
`file://` page). Any static server works, for example VS Code Live Server, or:

```bash
cd WEBSITE && npx serve .
```

Then open the site, choose **Explore the HR demo** on the login page, and you
land on `app.html#hr`.

- Demo user: admin with access to every branch.
- The banner at the top confirms demo mode.
- **HR Overview → Reset demo data** restores the original sample data (it
  confirms first). Edits survive page reloads until you reset.

The app has no server dependency for HR. Sign in as usual (the tracking screens
still need the API), then:

- Field officer: badge icon in the top bar → **My HR**.
- Branch manager/admin: the **HR** tab in the bottom bar, plus **My HR profile**
  from the HR tab.

## Modules and behaviour

### 1. HR Overview
Headcount, new joiners in 30 days, people on leave today, present today,
headcount by department, attendance ring, current payroll summary, upcoming
birthdays/confirmations/document expiries/holidays, pending leave approvals and
onboarding progress.

### 2. Employees
- Search across name, code, email, designation.
- Filter by department, branch and status.
- Add/edit employee (personal, contact, emergency, employment, salary/statutory
  and bank details) with validation.
- Profile drawer with five tabs: Overview, Job, Pay & bank, Documents,
  Attendance (current-month summary + last 12 days).
- Mark inactive (soft delete), CSV export.

### 3. Attendance
- Daily register with in/out, worked hours, overtime, status and note.
- Manual marking/regularisation (present, late, half day, absent, leave, WFH,
  field).
- Monthly summary per employee (working days, present, late, half day, leave,
  absent, OT, attendance %).
- Shift roster with headcount per shift.
- CSV export for both views.

### 4. Leave & holidays
- Approval inbox with approve/reject.
- All requests with status/type/branch filters.
- Leave balances (casual 12, sick 10, earned 15) per employee.
- Company holiday calendar.
- Apply leave form with date validation; approved leave is reflected in
  attendance automatically.

### 5. Recruitment
- Open requisitions with openings/filled/status; post a job; close/reopen.
- Six-stage candidate pipeline (Applied → Screening → Interview → Offer → Hired,
  plus Rejected) with advance/reject actions, ratings, expected CTC and
  interview slots.
- Onboarding checklists for probation employees, tickable per task.
- CSV export of the candidate pipeline.

### 6. Payroll
- Month selector and branch filter.
- Run status: Draft → Processed → Paid, with confirmation dialogs.
- Totals: employees, gross, deductions, net payable, employer PF.
- Per-employee payslip preview: company header, employee details, attendance,
  earnings, deductions, net pay, print layout.
- Net pay by department and run history.
- CSV export.

### 7. Performance
- Review cycles (H1 completed, H2 in progress).
- Self/manager/final ratings, goals with weights and progress.
- Appraisal dialog to enter ratings and a manager note; saving a completed
  review updates the distribution and top-performer list.
- CSV export.

### 8. Documents
- Compliance stats: valid, expiring in 30 days, expired, employees with no
  health insurance.
- Document register with type/status/branch filters and search.
- Upload/update document metadata (number, issue/expiry dates). Files are **not**
  stored - only the file name is recorded, since there is no backend.
- Expiry attention list.

## Demo data

- 43 employees across 5 branches and 8 departments.
- Salary structures and payslips derived from CTC (basic 40%, HRA 20%,
  conveyance 5%, special allowance; PF 12% of basic, PT ₹200, simplified
  new-regime TDS).
- Attendance is deterministic per employee/date, so every reload matches, while
  respecting Sundays, approved leave and manual overrides.
- 38 leave requests, 7 jobs, 18 candidates, 282 documents, 2 review cycles and
  4 payroll runs.

Reset with **HR Overview → Reset demo data**, or clear the `tk_hr_v3`
`localStorage` key.

## Roles

- **Admin/HR** sees all branches and all modules.
- **Branch manager** is scoped to their own branch in every HR list (the branch
  filters are pre-set and locked by `hrScope()` in `js/hr/ui.js`).
- **Field officer** uses the app's self-service screens only.

The demo login is an admin. To exercise manager scoping you need a real manager
login once the API exists, or temporarily change `DEMO_USER` in `js/login.js`.

## Connecting a real backend

`WEBSITE/js/hr/store.js` is the only place that owns data. The views call plain
functions, so replacing their bodies with `fetch()` is enough:

| Store function | Suggested endpoint |
|---|---|
| `employees(filters)` | `GET /hr/employees?q=&department=&branch_id=&status=` |
| `employee(id)` | `GET /hr/employees/:id` |
| `upsertEmployee(payload)` | `POST /hr/employees`, `PUT /hr/employees/:id` |
| `attendanceFor(date, filters)` | `GET /hr/attendance?date=` |
| `markAttendance(payload)` | `PUT /hr/attendance/:employee_id/:date` |
| `monthSummary(month, filters)` | `GET /hr/attendance/summary?month=` |
| `leaveRequests(filters)` | `GET /hr/leaves?status=&type=&branch_id=` |
| `applyLeave(payload)` | `POST /hr/leaves` |
| `decideLeave(id, status)` | `PATCH /hr/leaves/:id` |
| `payrollTotals(month, branch)` | `GET /hr/payroll/:month` |
| `processPayroll(month)` | `POST /hr/payroll/:month/process` |
| `payslip(month, empId)` | `GET /hr/payroll/:month/:employee_id` |
| `jobs()`, `candidates()` | `GET /hr/jobs`, `GET /hr/candidates` |
| `setCandidateStage(id, stage)` | `PATCH /hr/candidates/:id` |
| `reviews(cycleId)`, `saveReview()` | `GET /hr/reviews`, `PATCH /hr/reviews/:id` |
| `documents(filters)`, `addDocument()` | `GET /hr/documents`, `POST /hr/documents` |

The app equivalent is `APP/lib/services/hr_store.dart`. Keep the method names
and return types and swap the bodies for `Api.instance` calls.

## Known limitations (by design, for now)

- No authentication/authorisation on HR data - demo mode trusts the stored user.
- No server-side validation, audit trail, notifications or approval e-mails.
- Payroll is a simplified illustration; no statutory filing, arrears, bonuses,
  reimbursements or PDF generation (payslip is print-ready in the browser).
- Document files are metadata only; no upload/storage.
- App demo data is in memory per session; the web demo persists in localStorage.
- Recruitment is web-only; the app focuses on employee self-service and
  manager approvals.
- The existing tracking screens still need the real API; in demo mode they show
  a "needs the tracking API" notice.

## Suggested next steps

1. Agree the data contract (fields, enums, role rules) and add `db/hr_*.sql`
   tables plus API routes.
2. Swap the two mock stores for API calls; keep the same UI.
3. Add auth rules: employee sees self, manager sees branch, HR/admin sees all;
   payroll restricted to HR/admin.
4. Real file storage for documents, PDF payslips, and push notifications for
   approvals.
5. Wire attendance to the existing GPS/duty data instead of manual marking.
