// Place search (free OpenStreetMap search) and Google Maps link -> coordinates.
import { bad } from './core.js';

const UA = { 'user-agent': 'Track_karo/1.0 (field staff tracking)', 'accept-language': 'en' };
const COORD_PAIR = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export async function geocode(text) {
  if (text.length < 2) return [];
  const pair = text.match(COORD_PAIR);
  if (pair) return [{ name: 'Typed coordinates', address: `${pair[1]}, ${pair[2]}`, lat: Number(pair[1]), lng: Number(pair[2]) }];
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=in&q=${encodeURIComponent(text)}`,
      { headers: UA, signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const list = await r.json();
      if (list.length) {
        return list.map((p) => ({
          name: p.name || String(p.display_name).split(',')[0], address: p.display_name,
          lat: Number(p.lat), lng: Number(p.lon),
        }));
      }
    }
  } catch { /* fall through to the second search service */ }
  try {
    const r = await fetch(`https://photon.komoot.io/api/?limit=6&lat=15.3&lon=76.5&q=${encodeURIComponent(text)}`,
      { headers: UA, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.features || []).map((f) => {
      const p = f.properties || {};
      return {
        name: p.name || p.city || p.county || text,
        address: [p.name, p.district, p.city, p.county, p.state, p.country].filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
      };
    });
  } catch { return []; }
}

const GOOGLE_HOST = /(^|\.)google\.[a-z.]{2,6}$|(^|\.)goo\.gl$|(^|\.)g\.co$/i;
function coordsFrom(text) {
  const s = decodeURIComponent(String(text).replace(/\+/g, ' '));
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)                                      // the place pin
    || s.match(/[?&](?:q|query|ll|sll|destination|daddr|center)=(?:loc:)?(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
    || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)                                               // map centre
    || s.match(/\/(?:search|place|dir)\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
function nameFrom(url) {
  const m = String(url).match(/\/place\/([^/@]+)/);
  if (!m) return undefined;
  try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).slice(0, 120); } catch { return undefined; }
}

export async function resolveMapsLink(input) {
  const pair = input.match(COORD_PAIR);
  if (pair) return { lat: Number(pair[1]), lng: Number(pair[2]) };
  let url;
  try { url = new URL(input.trim()); } catch { throw bad('Paste a Google Maps link'); }
  let name;
  for (let hop = 0; hop < 6; hop++) {
    if (!/^https?:$/.test(url.protocol) || !GOOGLE_HOST.test(url.hostname)) throw bad('Only Google Maps links are supported');
    name = name || nameFrom(url.href);
    const direct = coordsFrom(url.href);
    if (direct) return { ...direct, name };
    let r;
    try {
      r = await fetch(url.href, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Track_karo link resolver)' }, signal: AbortSignal.timeout(7000) });
    } catch { throw bad('Could not open this link. Try the search box or click on the map.'); }
    const next = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && next) { url = new URL(next, url.href); continue; }
    const found = coordsFrom((await r.text()).slice(0, 400000));
    if (found) return { ...found, name };
    break;
  }
  throw bad('Could not read the location from this link. Try the search box or click on the map.');
}
