// Tasks & Geofence: branch manager assigns each officer's locations for the day.
import { get, post, del } from '../api.js';
import {
  $, cloneTpl, fill, setEmpty, chip, label, toast, toastError, withLoading, showError, debounce,
  confirmDialog, todayIST, fmtWhen, fmtDay, KIND_LABELS, googleMapsUrl, hasCoords, num,
} from '../ui.js';
import { state, fillOfficerSelect } from '../state.js';
import {
  createMap, onStyleReady, markerEl, makeMarker, lazyPopup, popupContent, circlePolygon,
  featureCollection, setSource, addLayerOnce, fitTo, resizeMap,
} from '../maps.js';

let map = null;
let initialised = false;
let pin = null;
let assignments = [];
let assignmentMarkers = [];
let geo = { draft: featureCollection(), existing: featureCollection() };
let searchSeq = 0;

const latEl = () => $('assignment-lat');
const lngEl = () => $('assignment-lng');
const radiusEl = () => $('assignment-radius');

function defaultRadius() { return Number(state.settings.geofence_radius_m) || 60; }

function currentPoint() {
  const lat = num(latEl().value);
  const lng = num(lngEl().value);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
}

function addLayers(m) {
  setSource(m, 'tk-task-existing', geo.existing);
  setSource(m, 'tk-task-draft', geo.draft);
  addLayerOnce(m, {
    id: 'tk-task-existing-fill', type: 'fill', source: 'tk-task-existing',
    paint: { 'fill-color': ['case', ['get', 'visited'], '#16a34a', '#2563eb'], 'fill-opacity': 0.12 },
  });
  addLayerOnce(m, {
    id: 'tk-task-existing-line', type: 'line', source: 'tk-task-existing',
    paint: { 'line-color': ['case', ['get', 'visited'], '#15803d', '#1d4ed8'], 'line-width': 1.2, 'line-dasharray': [2, 1] },
  });
  addLayerOnce(m, {
    id: 'tk-task-draft-fill', type: 'fill', source: 'tk-task-draft',
    paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.18 },
  });
  addLayerOnce(m, {
    id: 'tk-task-draft-line', type: 'line', source: 'tk-task-draft',
    paint: { 'line-color': '#b91c1c', 'line-width': 2 },
  });
}

function ensureMap() {
  if (map) { resizeMap(map); return; }
  map = createMap($('task-map'));
  if (!map) return;
  onStyleReady(map, addLayers);
  map.on('click', (e) => setPoint(e.lngLat.lng, e.lngLat.lat, { fly: false }));
}

function updateGmapsLink() {
  const a = $('link-open-gmaps');
  const p = currentPoint();
  if (p) {
    a.href = googleMapsUrl(p[1].toFixed(6), p[0].toFixed(6));
    a.removeAttribute('aria-disabled');
  } else {
    a.href = '#';
    a.setAttribute('aria-disabled', 'true');
  }
}

/** Sync pin + geofence preview + Google Maps link with the lat/lng/radius inputs. */
function updatePreview({ fly = false } = {}) {
  updateGmapsLink();
  const p = currentPoint();
  const r = num(radiusEl().value) || defaultRadius();
  if (!map) return;
  if (!p) {
    if (pin) { pin.remove(); pin = null; }
    geo.draft = featureCollection();
    setSource(map, 'tk-task-draft', geo.draft);
    return;
  }
  if (!pin) {
    const el = markerEl('task', { draft: 'true' });
    pin = makeMarker(el, p, { draggable: true }).addTo(map);
    pin.on('dragend', () => {
      const ll = pin.getLngLat();
      setPoint(ll.lng, ll.lat, { fly: false });
    });
  } else pin.setLngLat(p);
  geo.draft = featureCollection([{ type: 'Feature', properties: {}, geometry: circlePolygon(p, r) }]);
  setSource(map, 'tk-task-draft', geo.draft);
  if (fly) map.flyTo({ center: p, zoom: Math.max(map.getZoom(), 16) });
}

function setPoint(lng, lat, { fly = true } = {}) {
  latEl().value = Number(lat).toFixed(6);
  lngEl().value = Number(lng).toFixed(6);
  updatePreview({ fly });
}

// ---------- assignments table + map ----------
function rowValues(a) {
  return {
    officer_name: a.officer_name,
    name: a.name,
    kind: chip(label(KIND_LABELS, a.kind), a.kind || ''),
    address: a.address,
    radius_m: a.radius_m ?? defaultRadius(),
    status: a.visited ? chip('Visited', 'visited') : chip('Pending', 'pending'),
    first_enter_at: fmtWhen(a.first_enter_at),
    time_spent_min: a.time_spent_min ?? 0,
  };
}

function drawExisting() {
  assignmentMarkers.forEach((m) => m.remove());
  assignmentMarkers = [];
  const feats = [];
  for (const a of assignments) {
    if (!hasCoords(a)) continue;
    const c = [num(a.lng), num(a.lat)];
    feats.push({ type: 'Feature', properties: { visited: !!a.visited }, geometry: circlePolygon(c, num(a.radius_m) || defaultRadius()) });
    if (map) {
      const el = markerEl('task', { visited: a.visited ? 'true' : 'false', kind: a.kind }, a.name);
      const popup = lazyPopup(() => popupContent(a.name, [
        ['Officer', a.officer_name || '-'],
        ['Kind', label(KIND_LABELS, a.kind)],
        ['Radius', `${a.radius_m ?? defaultRadius()} m`],
        ['Status', a.visited ? 'Visited' : 'Pending'],
      ]));
      assignmentMarkers.push(makeMarker(el, c).setPopup(popup).addTo(map));
    }
  }
  geo.existing = featureCollection(feats);
  if (map) setSource(map, 'tk-task-existing', geo.existing);
}

function renderTable() {
  const tbody = $('assignments-table');
  tbody.textContent = '';
  for (const a of assignments) {
    const tr = cloneTpl('tpl-assignment');
    tr.dataset.assignmentId = a.id;
    fill(tr, rowValues(a));
    tbody.appendChild(tr);
  }
  setEmpty('assignments', assignments.length === 0);
}

async function loadAssignments({ fit = true } = {}) {
  const tbody = $('assignments-table');
  tbody.classList.add('is-loading');
  try {
    const r = await get('/assignments', { day: $('tasks-day').value || todayIST(), officer_id: $('tasks-officer').value });
    assignments = r.assignments || [];
    renderTable();
    drawExisting();
    if (fit && map && !currentPoint()) {
      fitTo(map, assignments.filter(hasCoords).map((a) => [num(a.lng), num(a.lat)]));
    }
  } catch (err) {
    toastError(err, 'Could not load assigned locations');
  } finally {
    tbody.classList.remove('is-loading');
  }
}

// ---------- place search ----------
function hideResults() {
  $('place-results').hidden = true;
  $('place-results-empty').hidden = true;
}

async function searchPlaces(q) {
  q = (q || '').trim();
  if (q.length < 3) { hideResults(); return; }
  const seq = ++searchSeq;
  const btn = $('btn-place-search');
  btn.classList.add('is-loading');
  try {
    const r = await get('/geocode', { q });
    if (seq !== searchSeq) return;
    const ul = $('place-results');
    ul.textContent = '';
    const results = r.results || [];
    results.forEach((p, i) => {
      const li = cloneTpl('tpl-place-result');
      li.dataset.index = String(i);
      fill(li, { name: p.name, address: p.address });
      ul.appendChild(li);
    });
    ul.hidden = results.length === 0;
    $('place-results-empty').hidden = results.length > 0;
    ul.tkResults = results;
  } catch (err) {
    if (seq === searchSeq) toastError(err, 'Place search failed');
  } finally {
    if (seq === searchSeq) btn.classList.remove('is-loading');
  }
}

function pickPlace(li) {
  const ul = $('place-results');
  const p = (ul.tkResults || [])[Number(li.dataset.index)];
  if (!p) return;
  ul.querySelectorAll('.is-selected').forEach((x) => x.classList.remove('is-selected'));
  li.classList.add('is-selected');
  if (p.address) $('assignment-address').value = p.address;
  if (!$('assignment-name').value.trim() && p.name) $('assignment-name').value = p.name;
  if (hasCoords(p)) setPoint(num(p.lng), num(p.lat));
  hideResults();
}

async function resolveLink() {
  const url = $('maps-link').value.trim();
  if (!url) { $('maps-link').focus(); return; }
  await withLoading($('btn-resolve-link'), async () => {
    try {
      const r = await post('/resolve-link', { url });
      if (!hasCoords(r)) throw new Error('No coordinates found in that link.');
      if (r.name && !$('assignment-name').value.trim()) $('assignment-name').value = r.name;
      setPoint(num(r.lng), num(r.lat));
      toast('Location found', `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`, 'success');
    } catch (err) {
      toastError(err, 'Could not read that Google Maps link');
    }
  });
}

// ---------- submit / delete ----------
async function submit(e) {
  e.preventDefault();
  const err = $('assignment-error');
  showError(err, '');
  const officer_id = $('assignment-officer').value;
  const name = $('assignment-name').value.trim();
  const p = currentPoint();
  if (!officer_id) { showError(err, 'Select an officer.'); $('assignment-officer').focus(); return; }
  if (!name) { showError(err, 'Enter a name for the location.'); $('assignment-name').focus(); return; }
  if (!p) { showError(err, 'Set the location: search a place, paste a link or click the map.'); latEl().focus(); return; }
  const radius = num(radiusEl().value) || defaultRadius();
  const day = $('assignment-day').value || $('tasks-day').value || todayIST();
  const body = {
    officer_id: num(officer_id) ?? officer_id,
    day,
    name,
    kind: $('assignment-kind').value || 'center',
    address: $('assignment-address').value.trim() || undefined,
    lat: p[1],
    lng: p[0],
    radius_m: Math.round(radius),
  };
  await withLoading($('btn-save-assignment'), async () => {
    try {
      await post('/assignments', body);
      toast('Location added', `${name} for ${$('assignment-officer').selectedOptions[0]?.textContent || 'officer'} on ${fmtDay(day)}`, 'success');
      ['assignment-name', 'assignment-address', 'place-search', 'maps-link', 'assignment-lat', 'assignment-lng'].forEach((id) => { $(id).value = ''; });
      hideResults();
      updatePreview();
      // Show the day/officer just assigned.
      $('tasks-day').value = day;
      if ($('tasks-officer').value && $('tasks-officer').value !== String(officer_id)) $('tasks-officer').value = String(officer_id);
      await loadAssignments({ fit: true });
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

async function removeAssignment(id) {
  const a = assignments.find((x) => String(x.id) === String(id));
  const ok = await confirmDialog({
    title: 'Delete location?',
    message: `Remove "${a?.name || 'this location'}"${a?.officer_name ? ` from ${a.officer_name}` : ''}? This cannot be undone.`,
    okText: 'Delete',
  });
  if (!ok) return;
  try {
    await del(`/assignments/${encodeURIComponent(id)}`);
    toast('Location deleted', a?.name || '', 'success');
    await loadAssignments({ fit: false });
  } catch (err) {
    toastError(err, 'Could not delete the location');
  }
}

function init() {
  const today = todayIST();
  $('tasks-day').value = today;
  $('assignment-day').value = today;
  radiusEl().value = String(defaultRadius());
  updateGmapsLink();

  $('tasks-day').addEventListener('change', () => {
    $('assignment-day').value = $('tasks-day').value;
    loadAssignments();
  });
  $('tasks-officer').addEventListener('change', () => {
    if ($('tasks-officer').value) $('assignment-officer').value = $('tasks-officer').value;
    loadAssignments();
  });

  const debounced = debounce((q) => searchPlaces(q), 450);
  $('place-search').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length >= 3) debounced(q); else { debounced.cancel(); hideResults(); }
  });
  $('place-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); debounced.cancel(); searchPlaces(e.target.value); }
    if (e.key === 'Escape') hideResults();
    if (e.key === 'ArrowDown') { const first = $('place-results').querySelector('li'); if (first) { e.preventDefault(); first.focus(); } }
  });
  $('btn-place-search').addEventListener('click', () => { debounced.cancel(); searchPlaces($('place-search').value); });
  $('place-results').addEventListener('click', (e) => { const li = e.target.closest('[data-action="pick"]'); if (li) pickPlace(li); });
  $('place-results').addEventListener('keydown', (e) => {
    const li = e.target.closest('[data-action="pick"]');
    if (!li) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickPlace(li); }
    if (e.key === 'ArrowDown') { e.preventDefault(); li.nextElementSibling?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (li.previousElementSibling || $('place-search')).focus(); }
  });

  $('btn-resolve-link').addEventListener('click', resolveLink);
  $('maps-link').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); resolveLink(); } });

  for (const el of [latEl(), lngEl()]) el.addEventListener('input', () => updatePreview());
  for (const el of [latEl(), lngEl()]) el.addEventListener('change', () => updatePreview({ fly: true }));
  radiusEl().addEventListener('input', () => updatePreview());

  $('link-open-gmaps').addEventListener('click', (e) => {
    if ($('link-open-gmaps').getAttribute('aria-disabled') === 'true') e.preventDefault();
  });

  $('form-assignment').addEventListener('submit', submit);
  $('assignments-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    const tr = btn?.closest('tr[data-assignment-id]');
    if (tr) removeAssignment(tr.dataset.assignmentId);
  });
}

export default {
  init,
  async show() {
    ensureMap();
    if (!initialised) {
      initialised = true;
      if (!radiusEl().value || radiusEl().value === '60') radiusEl().value = String(defaultRadius());
      try {
        await Promise.all([fillOfficerSelect($('tasks-officer')), fillOfficerSelect($('assignment-officer'))]);
      } catch (err) { toastError(err, 'Could not load officers'); }
      await loadAssignments();
      updatePreview();
    }
  },
  async refresh() {
    try { await Promise.all([fillOfficerSelect($('tasks-officer')), fillOfficerSelect($('assignment-officer'))]); } catch { /* ignore */ }
    await loadAssignments({ fit: false });
  },
};
