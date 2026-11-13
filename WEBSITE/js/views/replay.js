// Route replay: full route (faint) + travelled part (blue), tasks with geofences, stops,
// customer visits, and a time-based player driven by requestAnimationFrame.
import { get } from '../api.js';
import {
  $, cloneTpl, fill, setEmpty, chip, label, toast, toastError, withLoading, todayIST,
  fmtTime, fmtDateTimeSec, fmtDuration, fmtKm, fmtWhen, KIND_LABELS, KIND_ICONS, hasCoords, num,
} from '../ui.js';
import { state, fillOfficerSelect } from '../state.js';
import {
  createMap, onStyleReady, set3D, markerEl, makeMarker, lazyPopup, popupContent, circlePolygon,
  haversine, featureCollection, setSource, addLayerOnce, fitTo, resizeMap,
} from '../maps.js';

let map = null;
let initialised = false;
let pending = null; // {officerId, day} requested from elsewhere
let markers = [];
let replayMarker = null;

// track data
let pts = [];      // [{t, c:[lng,lat]}]
let cum = [];      // cumulative metres at each point
let t0 = 0;
let maxSec = 0;
let cur = 0;       // seconds since t0
let playing = false;
let rafId = 0;
let lastFrame = 0;
let geo = { full: featureCollection(), done: featureCollection(), fences: featureCollection() };

const lineFeature = (coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });

/** Called from other views: go to replay with officer + day preselected and load. */
export function openReplay(officerId, day = todayIST()) {
  pending = { officerId: String(officerId), day };
  if (state.currentView === 'replay') applyPending();
  else location.hash = '#replay';
}

function addLayers(m) {
  setSource(m, 'tk-fences', geo.fences);
  setSource(m, 'tk-route-full', geo.full);
  setSource(m, 'tk-route-done', geo.done);
  addLayerOnce(m, {
    id: 'tk-fences-fill', type: 'fill', source: 'tk-fences',
    paint: { 'fill-color': ['case', ['get', 'visited'], '#16a34a', '#f59e0b'], 'fill-opacity': 0.18 },
  });
  addLayerOnce(m, {
    id: 'tk-fences-line', type: 'line', source: 'tk-fences',
    paint: { 'line-color': ['case', ['get', 'visited'], '#15803d', '#d97706'], 'line-width': 1.5 },
  });
  addLayerOnce(m, {
    id: 'tk-route-full-line', type: 'line', source: 'tk-route-full',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#64748b', 'line-width': 4, 'line-opacity': 0.35 },
  });
  addLayerOnce(m, {
    id: 'tk-route-done-line', type: 'line', source: 'tk-route-done',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#1d4ed8', 'line-width': 5, 'line-opacity': 0.95 },
  });
}

function ensureMap() {
  if (map) { resizeMap(map); return; }
  map = createMap($('replay-map'));
  if (!map) return;
  onStyleReady(map, addLayers);
}

function clearMarkers() {
  markers.forEach((m) => m.remove());
  markers = [];
  if (replayMarker) { replayMarker.remove(); replayMarker = null; }
}

function setPlaying(on) {
  playing = on;
  const btn = $('btn-play');
  btn.classList.toggle('is-playing', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  btn.querySelector('.icon-play').toggleAttribute('hidden', on); // SVG has no .hidden property
  btn.querySelector('.icon-pause').toggleAttribute('hidden', !on);
  if (on) {
    lastFrame = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(rafId);
  }
}

function tick(now) {
  if (!playing) return;
  const dt = Math.min(0.25, (now - lastFrame) / 1000); // clamp after tab switches
  lastFrame = now;
  const speed = Number($('replay-speed').value) || 1;
  cur += dt * 60 * speed; // 1x: 1 s of playback = 1 min of the day
  if (cur >= maxSec) {
    cur = maxSec;
    render(true);
    setPlaying(false);
    return;
  }
  render(true);
  rafId = requestAnimationFrame(tick);
}

/** Index i with pts[i].t <= t < pts[i+1].t (binary search). */
function indexAt(t) {
  let lo = 0, hi = pts.length - 1;
  if (t <= pts[0].t) return 0;
  if (t >= pts[hi].t) return hi;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t <= t) lo = mid; else hi = mid;
  }
  return lo;
}

function render(follow) {
  if (!pts.length) return;
  const t = t0 + cur * 1000;
  const i = indexAt(t);
  let pos = pts[i].c;
  let dist = cum[i];
  if (i < pts.length - 1 && t > pts[i].t) {
    const a = pts[i], b = pts[i + 1];
    const f = b.t > a.t ? Math.min(1, (t - a.t) / (b.t - a.t)) : 0;
    pos = [a.c[0] + (b.c[0] - a.c[0]) * f, a.c[1] + (b.c[1] - a.c[1]) * f];
    dist = cum[i] + (cum[i + 1] - cum[i]) * f;
  }
  const done = pts.slice(0, i + 1).map((p) => p.c);
  done.push(pos);
  geo.done = featureCollection([lineFeature(done)]);
  if (map) setSource(map, 'tk-route-done', geo.done);
  if (replayMarker) replayMarker.setLngLat(pos);
  if (map && follow && $('replay-follow').checked) map.setCenter(pos);
  $('replay-time').textContent = fmtDateTimeSec(new Date(t));
  $('replay-distance').textContent = fmtKm(dist);
  const slider = $('replay-slider');
  if (document.activeElement !== slider || playing) slider.value = String(Math.round(cur));
}

function seek(sec, follow = true) {
  cur = Math.max(0, Math.min(maxSec, sec));
  render(follow);
}

function resetPlayer() {
  setPlaying(false);
  pts = []; cum = []; t0 = 0; maxSec = 0; cur = 0;
  const slider = $('replay-slider');
  slider.max = '0'; slider.value = '0'; slider.disabled = true;
  $('btn-play').disabled = true;
  $('replay-time').textContent = '--:--:--';
  $('replay-distance').textContent = '0.00';
}

function setSummary(data) {
  const s = (id, v) => { $(id).textContent = v; };
  if (!data) {
    ['replay-sum-distance', 'replay-sum-start', 'replay-sum-end', 'replay-sum-points', 'replay-sum-visits', 'replay-sum-stops']
      .forEach((id) => s(id, '-'));
    return;
  }
  const p = data.points || [];
  s('replay-sum-distance', `${fmtKm(data.distance_m)} km`);
  s('replay-sum-start', p.length ? fmtTime(p[0].ts) : '-');
  s('replay-sum-end', p.length ? fmtTime(p[p.length - 1].ts) : '-');
  s('replay-sum-points', String(p.length));
  const assigned = (data.assignments || []).length;
  const visits = (data.visits || []).length;
  s('replay-sum-visits', assigned ? `${visits} / ${assigned}` : String(visits));
  s('replay-sum-stops', String((data.stops || []).filter((x) => x.kind !== 'visit').length));
}

function buildEvents(data) {
  const ev = [];
  for (const v of data.visits || []) {
    ev.push({ kind: 'visit', ts: v.enter_at, title: v.name || 'Visit', minutes: v.minutes, end: v.exit_at });
  }
  for (const st of data.stops || []) {
    if (st.kind === 'unexplained') ev.push({ kind: 'unexplained', ts: st.start, title: 'Unexplained stop', minutes: st.minutes, end: st.end });
  }
  const breaks = data.breaks || [];
  if (breaks.length) {
    for (const b of breaks) ev.push({ kind: 'lunch', ts: b.started_at, title: 'Lunch break', minutes: b.minutes, end: b.ended_at });
  } else {
    for (const st of data.stops || []) {
      if (st.kind === 'lunch') ev.push({ kind: 'lunch', ts: st.start, title: 'Lunch break', minutes: st.minutes, end: st.end });
    }
  }
  for (const c of data.customer_visits || []) {
    ev.push({ kind: 'customer', ts: c.ts, title: c.customer_name || 'Customer', minutes: null });
  }
  return ev.filter((e) => e.ts).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

function renderEvents(data) {
  const ul = $('replay-events');
  ul.textContent = '';
  const events = data ? buildEvents(data) : [];
  for (const e of events) {
    const li = cloneTpl('tpl-replay-event');
    li.dataset.ts = e.ts;
    li.dataset.kind = e.kind;
    const time = e.end ? `${fmtTime(e.ts)} - ${fmtTime(e.end)}` : fmtTime(e.ts);
    fill(li, {
      kind_icon: KIND_ICONS[e.kind] || '#i-visit',
      title: e.title,
      time,
      duration: e.kind === 'customer' ? 'Captured' : (e.minutes === null || e.minutes === undefined ? (e.end ? '-' : 'Ongoing') : fmtDuration(e.minutes)),
      kind: chip(label(KIND_LABELS, e.kind), e.kind),
    });
    ul.appendChild(li);
  }
  setEmpty('replay-events', events.length === 0);
}

function drawMarkers(data) {
  clearMarkers();
  if (!map) return;
  const fences = [];
  for (const a of data.assignments || []) {
    if (!hasCoords(a)) continue;
    const c = [num(a.lng), num(a.lat)];
    fences.push({ type: 'Feature', properties: { visited: !!a.visited }, geometry: circlePolygon(c, num(a.radius_m) || state.settings.geofence_radius_m || 60) });
    const el = markerEl('task', { visited: a.visited ? 'true' : 'false', kind: a.kind }, a.name);
    const popup = lazyPopup(() => popupContent(a.name, [
      ['Kind', label(KIND_LABELS, a.kind)],
      ['Radius', `${a.radius_m ?? '-'} m`],
      ['Visited', a.visited ? 'Yes' : 'No'],
      ['First entered', fmtWhen(a.first_enter_at)],
      ['Time spent', fmtDuration(a.time_spent_min)],
    ]));
    markers.push(makeMarker(el, c).setPopup(popup).addTo(map));
  }
  geo.fences = featureCollection(fences);
  setSource(map, 'tk-fences', geo.fences);

  for (const st of data.stops || []) {
    if (!hasCoords(st)) continue;
    const el = markerEl('stop', { kind: st.kind });
    const popup = lazyPopup(() => popupContent(label(KIND_LABELS, st.kind), [
      ['From', fmtTime(st.start)],
      ['To', fmtTime(st.end)],
      ['Duration', fmtDuration(st.minutes)],
    ]));
    markers.push(makeMarker(el, [num(st.lng), num(st.lat)]).setPopup(popup).addTo(map));
  }
  for (const cv of data.customer_visits || []) {
    if (!hasCoords(cv)) continue;
    const el = markerEl('customer', { kind: 'customer' });
    const popup = lazyPopup(() => popupContent(cv.customer_name || 'Customer', [['Located', fmtDateTimeSec(cv.ts)]]));
    markers.push(makeMarker(el, [num(cv.lng), num(cv.lat)]).setPopup(popup).addTo(map));
  }
  if (pts.length) {
    replayMarker = makeMarker(markerEl('replay', {}, data.officer?.name || ''), pts[0].c).addTo(map);
  }
}

async function loadTrack() {
  const officerId = $('replay-officer').value;
  const day = $('replay-day').value || todayIST();
  if (!officerId) { toast('Select an officer', 'Choose a field officer to replay.', 'info'); $('replay-officer').focus(); return; }
  ensureMap();
  await withLoading($('btn-replay-load'), async () => {
    try {
      const data = await get('/track', { officer_id: officerId, day });
      resetPlayer();
      pts = (data.points || [])
        .filter((p) => hasCoords(p) && p.ts)
        .map((p) => ({ t: Date.parse(p.ts), c: [num(p.lng), num(p.lat)] }))
        .filter((p) => Number.isFinite(p.t))
        .sort((a, b) => a.t - b.t);
      cum = [];
      let d = 0;
      pts.forEach((p, i) => { if (i) d += haversine(pts[i - 1].c, p.c); cum.push(d); });
      t0 = pts.length ? pts[0].t : 0;
      maxSec = pts.length ? Math.ceil((pts[pts.length - 1].t - t0) / 1000) : 0;

      geo.full = featureCollection(pts.length > 1 ? [lineFeature(pts.map((p) => p.c))] : []);
      geo.done = featureCollection();
      if (map) { setSource(map, 'tk-route-full', geo.full); setSource(map, 'tk-route-done', geo.done); }

      setSummary(data);
      renderEvents(data);
      drawMarkers(data);
      $('replay-empty').hidden = pts.length > 0;

      const slider = $('replay-slider');
      slider.max = String(maxSec);
      slider.value = '0';
      slider.disabled = !pts.length;
      $('btn-play').disabled = !pts.length;

      const coords = pts.map((p) => p.c)
        .concat((data.assignments || []).filter(hasCoords).map((a) => [num(a.lng), num(a.lat)]));
      if (map) fitTo(map, coords);
      if (pts.length) seek(0, false);
    } catch (err) {
      toastError(err, 'Could not load the route');
    }
  });
}

async function applyPending() {
  if (!pending) return;
  const { officerId, day } = pending;
  pending = null;
  await fillOfficerSelect($('replay-officer')).catch(() => {});
  const sel = $('replay-officer');
  if (!Array.from(sel.options).some((o) => o.value === officerId)) {
    const o = document.createElement('option');
    o.value = officerId;
    o.textContent = state.officers.get(officerId)?.name || `Officer ${officerId}`;
    sel.appendChild(o);
  }
  sel.value = officerId;
  $('replay-day').value = day;
  loadTrack();
}

function init() {
  $('replay-day').value = todayIST();
  $('replay-day').max = todayIST();
  resetPlayer();
  setSummary(null);
  setEmpty('replay-events', false);

  $('form-replay').addEventListener('submit', (e) => { e.preventDefault(); loadTrack(); });
  $('btn-play').addEventListener('click', () => {
    if (!pts.length) return;
    if (playing) { setPlaying(false); return; }
    if (cur >= maxSec) seek(0);
    setPlaying(true);
  });
  $('replay-slider').addEventListener('input', (e) => seek(Number(e.target.value)));
  $('replay-follow').addEventListener('change', (e) => { if (e.target.checked) render(true); });
  $('btn-replay-3d').addEventListener('click', () => { ensureMap(); set3D(map, !map?.tk3d, $('btn-replay-3d')); });

  const ul = $('replay-events');
  const pick = (li) => {
    if (!li || !pts.length) return;
    ul.querySelectorAll('.is-selected').forEach((x) => x.classList.remove('is-selected'));
    li.classList.add('is-selected');
    seek((Date.parse(li.dataset.ts) - t0) / 1000);
  };
  ul.addEventListener('click', (e) => pick(e.target.closest('li[data-ts]')));
  ul.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('li[data-ts]');
    if (li) { e.preventDefault(); pick(li); }
  });
}

export default {
  init,
  async show() {
    ensureMap();
    if (!initialised) {
      initialised = true;
      try { await fillOfficerSelect($('replay-officer')); } catch (err) { toastError(err, 'Could not load officers'); }
    }
    applyPending();
  },
  hide() { setPlaying(false); },
  async refresh() {
    try { await fillOfficerSelect($('replay-officer')); } catch { /* ignore */ }
  },
};
