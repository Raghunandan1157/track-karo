// Route replay data and the end-of-day report for one field officer.
import { q, q1, haversine, minutesBetween, istDay } from './core.js';

const STOP_RADIUS_M = 60;

// Stay-point detection: the officer stayed within 60 m for at least `minMinutes`.
export function findStops(points, minMinutes) {
  const stops = [];
  let i = 0;
  while (i < points.length) {
    let j = i + 1, sumLat = points[i].lat, sumLng = points[i].lng, n = 1;
    while (j < points.length && haversine(sumLat / n, sumLng / n, points[j].lat, points[j].lng) <= STOP_RADIUS_M) {
      sumLat += points[j].lat; sumLng += points[j].lng; n++; j++;
    }
    const start = points[i].ts, end = points[j - 1].ts;
    const minutes = (new Date(end) - new Date(start)) / 60000;
    if (minutes >= minMinutes) {
      stops.push({ lat: sumLat / n, lng: sumLng / n, start, end, minutes: Math.round(minutes) });
      i = j;
    } else i++;
  }
  return stops;
}

const overlapMin = (aStart, aEnd, bStart, bEnd) =>
  Math.max(0, (Math.min(new Date(aEnd), new Date(bEnd)) - Math.max(new Date(aStart), new Date(bStart))) / 60000);

export async function buildTrack(officerId, day, settings) {
  const [officer, duty, points, assignments, visits, breaks, customerVisits, offCount] = await Promise.all([
    q1(`SELECT u.id, u.name, u.branch_id, b.name AS branch_name FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.id = $1`, [officerId]),
    q1('SELECT * FROM duty_days WHERE officer_id = $1 AND day = $2', [officerId, day]),
    q('SELECT ts, lat, lng, speed, accuracy FROM location_points WHERE officer_id = $1 AND day = $2 ORDER BY ts', [officerId, day]),
    q(`SELECT id, officer_id, officer_name, day, name, kind, address, lat, lng, radius_m, visited, first_enter_at,
              last_exit_at, round(secs / 60.0)::int AS time_spent_min
       FROM assignment_status WHERE officer_id = $1 AND day = $2 ORDER BY id`, [officerId, day]),
    q(`SELECT v.assignment_id, a.name, a.kind, a.lat, a.lng, v.enter_at, v.exit_at
       FROM visits v JOIN assignments a ON a.id = v.assignment_id
       WHERE v.officer_id = $1 AND v.day = $2 ORDER BY v.enter_at`, [officerId, day]),
    q('SELECT started_at, ended_at, lat, lng FROM breaks WHERE officer_id = $1 AND day = $2 ORDER BY started_at', [officerId, day]),
    q(`SELECT cv.id, cv.customer_id, c.name AS customer_name, cv.ts, cv.lat, cv.lng
       FROM customer_visits cv JOIN customers c ON c.id = cv.customer_id
       WHERE cv.officer_id = $1 AND cv.day = $2 ORDER BY cv.ts`, [officerId, day]),
    q1(`SELECT count(*)::int AS n FROM officer_events WHERE officer_id = $1 AND day = $2 AND type IN ('location_off','permission_denied')`, [officerId, day]),
  ]);

  // an open lunch break runs until now (today) or until the day ended / last signal
  const openEnd = duty?.ended_at || (day === istDay() ? new Date().toISOString() : (duty?.last_point_at || duty?.started_at));
  const brks = breaks.map((b) => {
    const end = b.ended_at || openEnd || b.started_at;
    return { started_at: b.started_at, ended_at: b.ended_at, minutes: minutesBetween(b.started_at, end), _end: end };
  });

  const stops = findStops(points, settings.stop_min).map((s) => {
    const atTask = assignments.some((a) => haversine(a.lat, a.lng, s.lat, s.lng) <= a.radius_m + 40);
    const lunch = brks.reduce((m, b) => m + overlapMin(s.start, s.end, b.started_at, b._end), 0);
    const kind = atTask ? 'visit' : (lunch >= s.minutes / 2 ? 'lunch' : 'unexplained');
    return { ...s, kind };
  });

  return {
    officer, duty, day,
    distance_m: Math.round(duty?.distance_m || 0),
    points, assignments,
    visits: visits.map((v) => ({ ...v, minutes: minutesBetween(v.enter_at, v.exit_at) })).filter((v) => v.minutes >= 1),
    stops,
    breaks: brks.map(({ _end, ...b }) => b),
    customer_visits: customerVisits,
    location_off_count: offCount?.n || 0,
  };
}

export async function buildReport(officerId, day, settings) {
  const t = await buildTrack(officerId, day, settings);
  const centers = t.assignments.filter((a) => a.kind === 'center');
  const villages = t.assignments.filter((a) => a.kind === 'village');
  const lunchMinutes = t.breaks.reduce((m, b) => m + b.minutes, 0);
  const unexplained = t.stops.filter((s) => s.kind === 'unexplained').map(({ kind, ...s }) => s);
  const unexplainedMin = unexplained.reduce((m, s) => m + s.minutes, 0);
  const dutyEnd = t.duty?.ended_at || (day === istDay() ? new Date().toISOString() : t.duty?.last_point_at);
  return {
    officer_id: t.officer.id, officer_name: t.officer.name, branch_name: t.officer.branch_name,
    started_at: t.duty?.started_at || null, ended_at: t.duty?.ended_at || null,
    duty_minutes: t.duty?.started_at && dutyEnd ? minutesBetween(t.duty.started_at, dutyEnd) : 0,
    distance_km: Math.round((t.distance_m / 1000) * 100) / 100,
    centers_assigned: centers.length, centers_visited: centers.filter((a) => a.visited).length,
    villages_assigned: villages.length, villages_visited: villages.filter((a) => a.visited).length,
    visit_details: t.assignments.map((a) => ({
      name: a.name, kind: a.kind, visited: a.visited, enter_at: a.first_enter_at, exit_at: a.last_exit_at,
      minutes: a.time_spent_min,
    })),
    time_at_locations_min: t.assignments.reduce((m, a) => m + (a.time_spent_min || 0), 0),
    missed: t.assignments.filter((a) => !a.visited).map((a) => a.name),
    lunch_minutes: lunchMinutes, lunch_allowed_min: settings.lunch_allowed_min,
    lunch_excess_min: Math.max(0, lunchMinutes - settings.lunch_allowed_min),
    unexplained_stops: unexplained, unexplained_stop_min: unexplainedMin,
    // total break time (declared lunch + undeclared long stops) is more than the allowed lunch time
    long_break: lunchMinutes + unexplainedMin > settings.lunch_allowed_min,
    customers_captured: t.customer_visits.length,
    location_off_count: t.location_off_count,
  };
}
