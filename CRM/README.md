# Track_karo CRM - UI demo

A customer-calling CRM interface for **web and Android**, built with plain HTML, CSS and JavaScript.
There is **no database and no server**: all demo data lives in the browser's `localStorage`, so the UI
works offline and can be opened by double-clicking `index.html`.

## What it covers

| Area | What you get |
|---|---|
| Dashboard | Calls made, answered %, positive-response %, not reachable, blacklist % and follow-ups due. Outcome bars, response donut, 7-day trend, recent calls. |
| Call log | Every call with customer, agent, outcome, response, feedback and follow-up. Search and filter by outcome, response and period. |
| Log a call | Customer picker, call outcome (Answered, Not Answered, Not Connected, Switched Off, Busy, Wrong Number), customer response (Positive, Polite, Neutral, Angry, Not Interested), feedback notes and follow-up date. |
| Customers | Searchable customer base, latest response filter, per-customer call history drawer, add customer, blacklist / unblacklist. |
| Reports | Percentage-wise report for every call outcome, response category, agent and branch. Blacklist report and CSV export + print. |
| Blacklist | Do-not-call list with reasons, share of customer base, and "needs review" customers with repeated angry calls. |

## Run it

**Web (desktop):** double-click `index.html`. Everything runs from the file, no install needed.

**Optional local server** (useful for testing the Android install):

```bash
cd CRM
npx serve .
# or: python -m http.server 8080
```

Then open the printed URL.

**Android:** open the same URL in Chrome and use **Add to Home screen**. The app has a web app
manifest and a service worker, so it installs like an app and keeps working offline.
For a Play Store build, this UI can later be wrapped with Capacitor or loaded in a WebView from
the existing Flutter app.

## Demo data

- The first load seeds 46 customers, their calling history, responses, follow-ups and 4 blacklisted customers.
- Every change (new call, new customer, blacklist) is saved in `localStorage` under `trackkaro.crm.v1`.
- Use the reset button at the bottom of the sidebar to restore fresh demo data.
- Clearing browser site data also resets the demo.

## Files

```
CRM/
  index.html              app shell and navigation
  css/crm.css             all styling, responsive + print
  js/store.js             local demo data, seed and queries (no server)
  js/ui.js                badges, charts, modal, toast, CSV helpers
  js/app.js               router and shared actions
  js/views/dashboard.js   dashboard
  js/views/calls.js       call log + log-a-call form
  js/views/customers.js   customers, add customer, blacklist forms
  js/views/reports.js     percentage reports and CSV export
  js/views/blacklist.js   blacklist and risk review
  manifest.webmanifest    Android/home-screen metadata
  sw.js                   optional offline service worker
```

## Connect a real backend later

The UI reads and writes through one place: `js/store.js` (`CRM.store`). Replace its functions with
`fetch()` calls to the real API and every screen keeps working. The data shapes are:

```
customer { id, name, phone, area, branch, agent, product, language,
           createdAt, blacklisted, blacklistReason, blacklistedAt }
call     { id, customerId, agent, ts, outcome, sentiment, feedback, followUp }
```

Suggested API endpoints: `GET/POST /customers`, `GET/POST /calls`, `PUT /customers/:id/blacklist`,
`GET /reports/summary?period=&branch=&agent=`.
