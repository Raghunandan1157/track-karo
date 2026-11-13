// Track_karo - MapLibre helpers (global `maplibregl` from app.html).

export const DEFAULT_CENTER = [77.59, 12.97];
export const DEFAULT_ZOOM = 6;

export const STREETS_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const SATELLITE_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri' }],
};

const BUILDINGS_LAYER = 'tk-3d-buildings';

export const mapsAvailable = () => typeof window.maplibregl !== 'undefined';

/**
 * Create a map with navigation + scale controls. Each map keeps:
 *  map.tkStyle ('streets'|'satellite'), map.tk3d (bool), map.tkReady (style loaded),
 *  map.tkStyleHandlers (re-run after every style load to re-add custom sources/layers).
 */
export function createMap(container, { style = 'streets', center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM } = {}) {
  if (!mapsAvailable() || !container) return null;
  const gl = window.maplibregl;
  const map = new gl.Map({
    container,
    style: style === 'satellite' ? SATELLITE_STYLE : STREETS_STYLE,
    center,
    zoom,
    attributionControl: { compact: true },
    maxPitch: 75,
  });
  map.tkStyle = style;
  map.tk3d = false;
  map.tkReady = false;
  map.tkStyleHandlers = [];
  map.addControl(new gl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new gl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  map.on('style.load', () => {
    map.tkReady = true;
    if (map.tk3d) addBuildings(map);
    for (const fn of map.tkStyleHandlers) {
      try { fn(map); } catch (err) { console.error('map style handler', err); }
    }
  });
  map.on('error', (e) => { if (e && e.error) console.warn('map:', e.error.message || e.error); });
  return map;
}

/** Run fn now (if the style is ready) and again after every style switch. */
export function onStyleReady(map, fn) {
  if (!map) return;
  map.tkStyleHandlers.push(fn);
  if (map.tkReady) fn(map);
}

/** Run fn once the style is loaded (no re-run on style switch). */
export function whenReady(map, fn) {
  if (!map) return;
  if (map.tkReady) fn(map);
  else map.once('style.load', () => fn(map));
}

export function setMapStyle(map, name) {
  if (!map || map.tkStyle === name) return;
  map.tkStyle = name;
  map.tkReady = false;
  map.setStyle(name === 'satellite' ? SATELLITE_STYLE : STREETS_STYLE, { diff: false });
}

function hasOwnBuildingExtrusion(map) {
  const layers = map.getStyle()?.layers || [];
  return layers.some((l) => l.id !== BUILDINGS_LAYER && l.type === 'fill-extrusion' && l['source-layer'] === 'building');
}

function addBuildings(map) {
  if (map.tkStyle !== 'streets' || map.getLayer(BUILDINGS_LAYER)) return;
  if (!map.getSource('openmaptiles') || hasOwnBuildingExtrusion(map)) return;
  // Insert below the first symbol layer so labels stay on top.
  const firstSymbol = (map.getStyle().layers || []).find((l) => l.type === 'symbol')?.id;
  map.addLayer({
    id: BUILDINGS_LAYER,
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': '#d9d4cc',
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.85,
    },
  }, firstSymbol);
}

function removeBuildings(map) {
  if (map.getLayer(BUILDINGS_LAYER)) map.removeLayer(BUILDINGS_LAYER);
}

/** 3D on: pitch ~60, bearing ~-20 and extruded buildings (streets style). */
export function set3D(map, on, button) {
  if (!map) return;
  map.tk3d = !!on;
  if (on) {
    if (map.tkReady) addBuildings(map);
    map.easeTo({ pitch: 60, bearing: -20, duration: 900 });
  } else {
    if (map.tkReady) removeBuildings(map);
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
  }
  if (button) {
    button.classList.toggle('is-3d', !!on);
    button.classList.toggle('is-active', !!on);
    button.setAttribute('aria-pressed', String(!!on));
  }
}

// ---------- markers & popups ----------
/** <div class="map-marker map-marker--KIND" data-*>[<span class="map-marker__label">]</div> */
export function markerEl(kind, data = {}, labelText = '') {
  const el = document.createElement('div');
  el.className = `map-marker map-marker--${kind}`;
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) el.setAttribute('data-' + k, String(v));
  }
  if (labelText) {
    const s = document.createElement('span');
    s.className = 'map-marker__label';
    s.textContent = labelText;
    el.appendChild(s);
  }
  return el;
}
export function setMarkerLabel(el, text) {
  let s = el.querySelector('.map-marker__label');
  if (!text) { s?.remove(); return; }
  if (!s) { s = document.createElement('span'); s.className = 'map-marker__label'; el.appendChild(s); }
  s.textContent = text;
}

export function makeMarker(el, lngLat, { draggable = false, anchor = 'center' } = {}) {
  return new window.maplibregl.Marker({ element: el, draggable, anchor }).setLngLat(lngLat);
}

/**
 * Popup content: rows = [[label, value]] where value is a string or a Node.
 * Returns <div class="map-popup">.
 */
export function popupContent(title, rows = []) {
  const box = document.createElement('div');
  box.className = 'map-popup';
  const t = document.createElement('div');
  t.className = 'map-popup__title';
  t.textContent = title || '';
  box.appendChild(t);
  for (const [lbl, val] of rows) {
    const r = document.createElement('div');
    r.className = 'map-popup__row';
    const s = document.createElement('span');
    s.textContent = lbl;
    const v = document.createElement('strong');
    if (val instanceof Node) v.appendChild(val);
    else v.textContent = val === null || val === undefined || val === '' ? '-' : String(val);
    r.append(s, v);
    box.appendChild(r);
  }
  return box;
}

/** Popup whose content is rebuilt each time it opens (always fresh data). */
export function lazyPopup(build, opts = {}) {
  const p = new window.maplibregl.Popup({ offset: 16, maxWidth: '300px', closeButton: true, ...opts });
  p.on('open', () => p.setDOMContent(build()));
  p.setDOMContent(document.createElement('div'));
  return p;
}

// ---------- geometry ----------
/** GeoJSON Polygon approximating a circle of radiusM around [lng, lat]. */
export function circlePolygon(lngLat, radiusM, steps = 64) {
  const [lng, lat] = lngLat;
  const R = 6378137;
  const coords = [];
  const latR = (lat * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const dx = radiusM * Math.cos(a);
    const dy = radiusM * Math.sin(a);
    const dLat = (dy / R) * (180 / Math.PI);
    const dLng = (dx / (R * Math.cos(latR))) * (180 / Math.PI);
    coords.push([lng + dLng, lat + dLat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

export function haversine(a, b) {
  const R = 6371008.8;
  const toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR;
  const dLng = (b[0] - a[0]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const featureCollection = (features = []) => ({ type: 'FeatureCollection', features });

/** Add or update a GeoJSON source. */
export function setSource(map, id, data) {
  if (!map || !map.tkReady) return;
  const src = map.getSource(id);
  if (src) src.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}

export function addLayerOnce(map, layer, beforeId) {
  if (!map || !map.tkReady || map.getLayer(layer.id)) return;
  map.addLayer(layer, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
}

/** Fit to [lng, lat] coordinates; default Karnataka view when empty. */
export function fitTo(map, coords, { padding = 60, maxZoom = 16, animate = true } = {}) {
  if (!map) return;
  const pts = (coords || []).filter((c) => c && Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (!pts.length) { map.jumpTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }); return; }
  if (pts.length === 1) { map[animate ? 'flyTo' : 'jumpTo']({ center: pts[0], zoom: Math.min(15, maxZoom) }); return; }
  const b = new window.maplibregl.LngLatBounds(pts[0], pts[0]);
  pts.forEach((p) => b.extend(p));
  const c = map.getContainer();
  const pad = Math.min(padding, Math.floor(Math.min(c.clientWidth, c.clientHeight) / 4) || padding);
  map.fitBounds(b, { padding: pad, maxZoom, animate, duration: animate ? 800 : 0 });
}

export function resizeMap(map) {
  if (!map) return;
  requestAnimationFrame(() => map.resize());
}
