# Track_karo API

Single backend used by the Flutter app (`APP/`) and the website (`WEBSITE/`).

- Base URL: `<site origin>/api` (website calls it same-origin as `/api/...`).
- JSON in, JSON out. Auth header on everything except `/login`: `Authorization: Bearer <token>`.
- Errors: HTTP 4xx/5xx with `{ "error": "message" }`. `401` means token missing/expired -> log out.
- Timestamps are ISO-8601 UTC strings. `day` is `YYYY-MM-DD` in India time (Asia/Kolkata). If `day` is omitted it means today.
- Roles: `admin`, `branch_manager`, `field_officer`. Admin sees everything, a branch manager only sees their own branch, a field officer only their own data.
- Only field officers are tracked.

## Objects

```
user      { id, userid, name, role, branch_id, branch_name, phone, active }
settings  { office_start:"09:30", office_end:"18:30", lunch_allowed_min:60, stop_min:20,
            geofence_radius_m:60, meeting_min_officers:3, meeting_radius_m:50,
            meeting_min_minutes:15, no_signal_min:10 }
officer   { id, userid, name, phone, branch_id, branch_name,
            status: "off_duty"|"on_duty"|"on_lunch"|"location_off"|"no_signal"|"day_ended",
            lat, lng, last_point_at, battery, distance_m, started_at, ended_at,
            assignments_total, assignments_visited }
assignment{ id, officer_id, officer_name, day, name, kind:"center"|"village", address,
            lat, lng, radius_m, visited:bool, first_enter_at, time_spent_min }
customer  { id, name, village, phone, branch_id, branch_name, lat, lng, located_at, located_by_name }
alert     { id, type:"location_off"|"no_signal"|"geofence_missed"|"meeting"|"long_break",
            title, body, officer_id, officer_name, branch_id, branch_name, data, created_at, read_at }
```
`meeting` alerts go ONLY to admin. All other alert types go to the officer's branch manager (admin can also see them).

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/login` | `{userid, password}` | `{token, user}` (token valid 30 days) |
| GET | `/me` | | `{user, settings}` |

## Field officer (app)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/duty/today` | | `{day, duty: {started_at, ended_at, distance_m, location_on} or null, lunch:{active, started_at, minutes_today, allowed_min}, assignments:[assignment], customer_visits:[{id, customer_id, customer_name, ts, lat, lng}], settings}` |
| POST | `/duty/start` | `{lat?, lng?}` | `{duty}` |
| POST | `/duty/end` | `{lat?, lng?}` | `{duty, missed:[assignment names not visited]}` |
| POST | `/locations` | `{points:[{ts, lat, lng, accuracy, speed, heading, battery}]}` (batch, oldest first, max 500) | `{ok:true, accepted, distance_m}` |
| POST | `/events` | `{type:"location_off"|"location_on"|"permission_denied", ts, lat?, lng?}` | `{ok:true}` — `location_off` / `permission_denied` immediately alert the branch manager |
| POST | `/breaks/start` | `{lat?, lng?}` | `{break:{id, started_at}}` (lunch) |
| POST | `/breaks/end` | `{}` | `{break:{id, started_at, ended_at, minutes}}` |
| GET | `/customers/search?q=abc` | | `{customers:[{id, name, village, phone}]}` max 20, case-insensitive, names starting with q first. Only EXISTING customers can be chosen. |
| POST | `/customer-visits` | `{customer_id, lat, lng, accuracy}` | `{visit:{id, customer_id, customer_name, ts, lat, lng}}` — saves live coordinates against the customer |
| POST | `/device-token` | `{kind:"fcm", token}` | `{ok:true}` (register for push; any role) |

## Branch manager / admin
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/dashboard` | | `{officers_total, on_duty, on_lunch, location_off, day_ended, distance_km_today, assignments_total, assignments_visited, customers_total, customers_located, unread_alerts}` |
| GET | `/officers` | `?branch_id=` | `{officers:[officer]}` |
| GET | `/live` | | `{officers:[officer], branches:[{id, name, address, lat, lng, manager_names}], customers:[{id, name, village, lat, lng, located_at}]}` (customers = only those with coordinates). Map colours: officers BLUE, branches/branch managers RED, customers YELLOW. |
| GET | `/track` | `?officer_id=&day=` | `{officer:{id,name}, day, distance_m, points:[{ts, lat, lng, speed, accuracy}], assignments:[assignment], visits:[{assignment_id, name, kind, lat, lng, enter_at, exit_at, minutes}], stops:[{lat, lng, start, end, minutes, kind:"lunch"|"unexplained"|"visit"}], breaks:[{started_at, ended_at, minutes}], customer_visits:[{customer_name, ts, lat, lng}]}` — used for route replay |
| GET | `/assignments` | `?day=&officer_id=&branch_id=` | `{assignments:[assignment]}` |
| POST | `/assignments` | `{officer_id, day?, name, kind, address?, lat, lng, radius_m?}` (radius default 60 m) | `{assignment}` |
| DELETE | `/assignments/:id` | | `{ok:true}` |
| GET | `/geocode` | `?q=place name` | `{results:[{name, address, lat, lng}]}` (place search) |
| POST | `/resolve-link` | `{url}` (a Google Maps link, short or long) | `{lat, lng, name?}` |
| GET | `/alerts` | `?unread=1&type=&limit=50` | `{alerts:[alert], unread_count}` |
| POST | `/alerts/:id/read` | | `{ok:true}` |
| POST | `/alerts/read-all` | | `{ok:true}` |
| GET | `/reports/daily` | `?day=&branch_id=&officer_id=` | `{day, reports:[report]}` |
| GET | `/customer-visits` | `?day=&officer_id=` | `{visits:[{id, customer_id, customer_name, officer_id, officer_name, ts, lat, lng}]}` |
| GET | `/customers` | `?q=&branch_id=&limit=50&offset=0` | `{customers:[customer], total}` |
| POST | `/customers` | `{name, village, phone, branch_id}` | `{customer}` |
| POST | `/customers/import` | `{branch_id, customers:[{name, village, phone}]}` | `{inserted}` |
| PUT | `/customers/:id` | `{name, village, phone, branch_id}` | `{customer}` |
| DELETE | `/customers/:id` | | `{ok:true}` |
| GET | `/users` | `?role=&branch_id=` | `{users:[user]}` |
| POST | `/users` | `{userid, name, password, role, branch_id, phone}` (admin: any role; branch manager: only field officers in own branch) | `{user}` |
| PUT | `/users/:id` | `{name?, password?, branch_id?, phone?, active?}` | `{user}` |
| DELETE | `/users/:id` | | `{ok:true}` (deactivates) |
| GET | `/branches` | | `{branches:[{id, name, address, lat, lng, manager_names, officer_count}]}` |
| POST | `/branches` | `{name, address, lat, lng}` (admin) | `{branch}` |
| PUT | `/branches/:id` | same (admin) | `{branch}` |
| DELETE | `/branches/:id` | (admin) | `{ok:true}` |
| GET | `/settings` | | `settings` |
| PUT | `/settings` | any subset of settings (admin) | `settings` |
| GET | `/scrub-report` | (admin) latest credit-bureau scrub report | `{report: {id, report_date, title, data, created_at}}` |

### report (one per field officer per day)
```
{ officer_id, officer_name, branch_name, started_at, ended_at, duty_minutes, distance_km,
  centers_assigned, centers_visited, villages_assigned, villages_visited,
  visit_details:[{name, kind, visited, enter_at, exit_at, minutes}],
  time_at_locations_min, missed:[names],
  lunch_minutes, lunch_allowed_min, lunch_excess_min,
  unexplained_stops:[{lat, lng, start, end, minutes}], unexplained_stop_min,
  long_break: bool, customers_captured, location_off_count }
```

## Live push stream (database push, no polling)
`GET /api/stream?token=<jwt>` is a Server-Sent Events stream fed by database notifications.

```
event: location   data: {officer_id, name, lat, lng, ts, status, distance_m, branch_id}
event: customer   data: {id, name, village, lat, lng, located_at, branch_id}
event: alert      data: alert
event: ping       data: {}
```
The server ends the stream after about 4 minutes; the client reconnects (browser `EventSource` does this by itself).
Close the stream when the page/tab is hidden and reopen when it is visible again, to keep costs low.
Do not poll the list endpoints on a timer: load once, then apply stream events.
