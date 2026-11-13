// Live Customers & Tracking: officers (blue), branches (red), customers (yellow).
// Loaded once from GET /api/live, then kept current by stream events.
import { get } from '../api.js';
import {
  $, cloneTpl, fill, setEmpty, chip, label, toast, toastError, todayIST,
  fmtKm, fmtWhen, fmtDateTime, STATUS_LABELS, hasCoords, num,
} from '../ui.js';
import { state, on, mergeOfficer, officersList, fillBranchSelect } from '../state.js';
import {
  createMap, onStyleReady, setMapStyle, set3D, markerEl, setMarkerLabel, makeMarker, lazyPopup,
  popupContent, featureCollection, setSource, addLayerOnce, fitTo, resizeMap,
} from '../maps.js';
import { openReplay } from './replay.js';

const DOM_CUSTOMER_LIMIT = 200; // above this, customers are drawn as a GeoJSON circle layer
const FEED_LIMIT = 30;
const CUSTOMER_COLOR = '#F5C518';

let map = null;
let loaded = false;
let loading = null;
let fittedOnce = false;
let branches = [];
const customers = new Map();          // id -> customer
const officerMarkers = new Map();     // id -> {marker, el, shown}
const branchMarkers = [];             // {marker, branch, shown}
const customerMarkers = new Map();    // id -> {marker, el}   (DOM mode only)
let customerPopup = null;

const branchFilter = () => $('live-branch-filter').value;
const inBranch = (obj) => {
  const bf = branchFilter();
  return !bf || obj.branch_id === undefined || obj.branch_id === null || String(obj.branch_id) === bf;
};
const lngLat = (o) => [num(o.lng), num(o.lat)];

// ---------- officers ----------
function officerPopup(o) {
  const link = document.createElement('a');
  link.href = '#replay';
  link.className = 'map-popup__link';
  link.textContent = 'Replay route';
  link.addEventListener('click', (e) => { e.preventDefault(); openReplay(o.id, todayIST()); });
  return popupContent(o.name, [
    ['Status', label(STATUS_LABELS, o.status)],
    ['Branch', o.branch_name || '-'],
    ['Last seen', fmtWhen(o.last_point_at)],
    ['Distance today', `${fmtKm(o.distance_m)} km`],
    ['Battery', o.battery === null || o.battery === undefined ? '-' : `${Math.round(Number(o.battery))}%`],
    ['Tasks', `${o.assignments_visited ?? 0} / ${o.assignments_total ?? 0}`],
    ['', link],
  ]);
}

function syncOfficerMarker(o) {
  if (!map) return;
  const key = String(o.id);
  let rec = officerMarkers.get(key);
  const show = $('toggle-officers').checked && inBranch(o) && hasCoords(o);
  if (!rec && hasCoords(o)) {
    const el = markerEl('officer', { status: o.status || 'off_duty', 'officer-id': o.id }, o.name);
    const marker = makeMarker(el, lngLat(o)).setPopup(lazyPopup(() => officerPopup(state.officers.get(key) || o)));
    rec = { marker, el, shown: false };
    officerMarkers.set(key, rec);
  }
  if (!rec) return;
  if (hasCoords(o)) rec.marker.setLngLat(lngLat(o));
  rec.el.dataset.status = o.status || 'off_duty';
  setMarkerLabel(rec.el, o.name);
  if (show && !rec.shown) { rec.marker.addTo(map); rec.shown = true; }
  if (!show && rec.shown) { rec.marker.remove(); rec.shown = false; }
}

function officerValues(o) {
  return {
    name: o.name,
    distance_km: fmtKm(o.distance_m),
    last_point_at: fmtWhen(o.last_point_at),
    status: chip(label(STATUS_LABELS, o.status), o.status || ''),
  };
}

function renderOfficerList() {
  const ul = $('live-officers');
  const selected = ul.querySelector('.is-selected')?.dataset.officerId;
  ul.textContent = '';
  const list = officersList().filter(inBranch);
  for (const o of list) {
    const li = cloneTpl('tpl-live-officer');
    li.dataset.officerId = o.id;
    if (String(o.id) === selected) li.classList.add('is-selected');
    fill(li, officerValues(o));
    ul.appendChild(li);
  }
  setEmpty('live-officers', list.length === 0);
  $('count-officers').textContent = String(list.filter(hasCoords).length);
}

function renderOfficers() {
  officersList().forEach(syncOfficerMarker);
  renderOfficerList();
}

function focusOfficer(id) {
  const o = state.officers.get(String(id));
  const ul = $('live-officers');
  ul.querySelectorAll('.is-selected').forEach((x) => x.classList.remove('is-selected'));
  ul.querySelector(`[data-officer-id="${CSS.escape(String(id))}"]`)?.classList.add('is-selected');
  if (!o || !hasCoords(o) || !map) {
    if (o && !hasCoords(o)) toast(o.name, 'No location received yet.', 'info');
    return;
  }
  if (!$('toggle-officers').checked) { $('toggle-officers').checked = true; renderOfficers(); }
  const rec = officerMarkers.get(String(id));
  map.flyTo({ center: lngLat(o), zoom: Math.max(map.getZoom(), 15) });
  if (rec) {
    if (!rec.shown) { rec.marker.addTo(map); rec.shown = true; }
    const p = rec.marker.getPopup();
    if (p && !p.isOpen()) rec.marker.togglePopup();
  }
}

// ---------- branches ----------
function renderBranches() {
  if (!map) return;
  branchMarkers.forEach((r) => r.marker.remove());
  branchMarkers.length = 0;
  const showLayer = $('toggle-branches').checked;
  let count = 0;
  for (const b of branches) {
    if (!hasCoords(b)) continue;
    const bf = branchFilter();
    if (bf && String(b.id) !== bf) continue;
    count++;
    const el = markerEl('branch', { 'branch-id': b.id }, b.name);
    const managers = Array.isArray(b.manager_names) ? b.manager_names.join(', ') : b.manager_names;
    const marker = makeMarker(el, lngLat(b)).setPopup(lazyPopup(() => popupContent(b.name, [
      ['Managers', managers || '-'],
      ['Address', b.address || '-'],
    ])));
    if (showLayer) marker.addTo(map);
    branchMarkers.push({ marker, branch: b });
  }
  $('count-branches').textContent = String(count);
}

// ---------- customers ----------
function customerPopupContent(c) {
  return popupContent(c.name, [
    ['Village', c.village || '-'],
    ['Located', fmtDateTime(c.located_at)],
  ]);
}

function visibleCustomers() {
  return Array.from(customers.values()).filter((c) => hasCoords(c) && inBranch(c));
}

function addCustomerLayer(m) {
  setSource(m, 'tk-customers', featureCollection());
  addLayerOnce(m, {
    id: 'tk-customers-circles', type: 'circle', source: 'tk-customers',
    paint: {
      'circle-color': CUSTOMER_COLOR,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3.5, 12, 6, 16, 8],
      'circle-stroke-color': '#3b3000',
      'circle-stroke-width': 1.5,
    },
  });
}

function renderCustomers() {
  const list = visibleCustomers();
  $('count-customers').textContent = String(list.length);
  if (!map) return;
  const show = $('toggle-customers').checked;
  const useDom = list.length <= DOM_CUSTOMER_LIMIT;

  // GeoJSON layer (many customers)
  const features = show && !useDom ? list.map((c) => ({
    type: 'Feature',
    properties: { id: String(c.id) },
    geometry: { type: 'Point', coordinates: lngLat(c) },
  })) : [];
  setSource(map, 'tk-customers', featureCollection(features));

  // DOM markers (few customers)
  const want = new Set(show && useDom ? list.map((c) => String(c.id)) : []);
  for (const [id, rec] of customerMarkers) {
    if (!want.has(id)) { rec.marker.remove(); customerMarkers.delete(id); }
  }
  for (const c of show && useDom ? list : []) {
    const id = String(c.id);
    const rec = customerMarkers.get(id);
    if (rec) { rec.marker.setLngLat(lngLat(c)); continue; }
    const el = markerEl('customer', { 'customer-id': c.id });
    const marker = makeMarker(el, lngLat(c))
      .setPopup(lazyPopup(() => customerPopupContent(customers.get(id) || c)))
      .addTo(map);
    customerMarkers.set(id, { marker, el });
  }
}

function feedItem(c) {
  const li = cloneTpl('tpl-live-customer');
  li.dataset.customerId = c.id;
  fill(li, { name: c.name, village: c.village, located_at: fmtWhen(c.located_at) });
  return li;
}

function renderFeed() {
  const ul = $('live-customers-feed');
  ul.textContent = '';
  const list = Array.from(customers.values())
    .filter((c) => c.located_at && inBranch(c))
    .sort((a, b) => Date.parse(b.located_at) - Date.parse(a.located_at))
    .slice(0, FEED_LIMIT);
  list.forEach((c) => ul.appendChild(feedItem(c)));
  setEmpty('live-customers-feed', list.length === 0);
}

function focusCustomer(id) {
  const c = customers.get(String(id));
  if (!c || !hasCoords(c) || !map) return;
  map.flyTo({ center: lngLat(c), zoom: Math.max(map.getZoom(), 16) });
  const rec = customerMarkers.get(String(id));
  if (rec) { if (!rec.marker.getPopup().isOpen()) rec.marker.togglePopup(); return; }
  customerPopup?.remove();
  customerPopup = new window.maplibregl.Popup({ offset: 10 }).setLngLat(lngLat(c)).setDOMContent(customerPopupContent(c)).addTo(map);
}

// ---------- map ----------
function ensureMap() {
  if (map) { resizeMap(map); return; }
  map = createMap($('live-map'), { style: $('live-style').value || 'streets' });
  if (!map) { toast('Map unavailable', 'The map library could not be loaded.', 'error'); return; }
  onStyleReady(map, (m) => { addCustomerLayer(m); renderCustomers(); });
  map.on('click', 'tk-customers-circles', (e) => {
    const f = e.features && e.features[0];
    const c = f && customers.get(String(f.properties.id));
    if (!c) return;
    customerPopup?.remove();
    customerPopup = new window.maplibregl.Popup({ offset: 8 }).setLngLat(f.geometry.coordinates).setDOMContent(customerPopupContent(c)).addTo(map);
  });
  map.on('mouseenter', 'tk-customers-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'tk-customers-circles', () => { map.getCanvas().style.cursor = ''; });
}

function fitAll(animate = true) {
  if (!map) return;
  const coords = [];
  if ($('toggle-officers').checked) officersList().filter((o) => inBranch(o) && hasCoords(o)).forEach((o) => coords.push(lngLat(o)));
  if ($('toggle-branches').checked) branchMarkers.forEach((r) => coords.push(lngLat(r.branch)));
  if ($('toggle-customers').checked) visibleCustomers().forEach((c) => coords.push(lngLat(c)));
  fitTo(map, coords, { animate });
}

function renderAll() {
  renderOfficers();
  renderBranches();
  renderCustomers();
  renderFeed();
}

async function load() {
  if (loading) return loading;
  const wrap = $('live-map');
  wrap.classList.add('is-loading');
  loading = (async () => {
    try {
      const data = await get('/live');
      (data.officers || []).forEach(mergeOfficer);
      branches = data.branches || [];
      customers.clear();
      (data.customers || []).forEach((c) => customers.set(String(c.id), { ...c }));
      loaded = true;
      renderAll();
      if (!fittedOnce) { fittedOnce = true; fitAll(false); }
    } catch (err) {
      toastError(err, 'Could not load live data');
    } finally {
      wrap.classList.remove('is-loading');
      loading = null;
    }
  })();
  return loading;
}

function init() {
  fillBranchSelect($('live-branch-filter')).catch(() => {});
  $('live-branch-filter').addEventListener('change', () => { renderAll(); fitAll(); });
  $('toggle-officers').addEventListener('change', renderOfficers);
  $('toggle-branches').addEventListener('change', renderBranches);
  $('toggle-customers').addEventListener('change', renderCustomers);
  $('live-style').addEventListener('change', (e) => { if (map) setMapStyle(map, e.target.value); });
  $('btn-live-3d').addEventListener('click', () => { if (map) set3D(map, !map.tk3d, $('btn-live-3d')); });
  $('btn-live-fit').addEventListener('click', () => fitAll());

  const bindList = (ul, attr, fn) => {
    ul.addEventListener('click', (e) => { const li = e.target.closest(`[${attr}]`); if (li) fn(li.getAttribute(attr)); });
    ul.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const li = e.target.closest(`[${attr}]`);
      if (li) { e.preventDefault(); fn(li.getAttribute(attr)); }
    });
  };
  bindList($('live-officers'), 'data-officer-id', focusOfficer);
  bindList($('live-customers-feed'), 'data-customer-id', focusCustomer);

  on('location', ({ officer }) => {
    if (!loaded || !officer) return;
    syncOfficerMarker(officer);
    const li = $('live-officers').querySelector(`[data-officer-id="${CSS.escape(String(officer.id))}"]`);
    if (li) fill(li, officerValues(officer));
    else renderOfficerList();
    $('count-officers').textContent = String(officersList().filter((o) => inBranch(o) && hasCoords(o)).length);
  });

  on('customer', (c) => {
    if (!loaded || !c || c.id === undefined) return;
    const id = String(c.id);
    customers.set(id, { ...(customers.get(id) || {}), ...c });
    renderCustomers();
    const merged = customers.get(id);
    if (inBranch(merged)) {
      const ul = $('live-customers-feed');
      ul.querySelector(`[data-customer-id="${CSS.escape(id)}"]`)?.remove();
      ul.prepend(feedItem(merged));
      while (ul.children.length > FEED_LIMIT) ul.lastElementChild.remove();
      setEmpty('live-customers-feed', false);
    }
    if (state.currentView === 'live') {
      toast('Customer located', [c.name, c.village].filter(Boolean).join(', '), 'info');
    }
  });
}

export default {
  init,
  show() {
    ensureMap();
    if (!loaded) load();
  },
  refresh: load,
};
