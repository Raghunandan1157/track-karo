// Live push stream (Server-Sent Events). The database announces every change with NOTIFY
// (see the triggers in db/schema.sql); this function listens and forwards it to the browser/app.
// Nothing is polled: when nothing changes, nothing is sent and nothing is queried.
import pg from 'pg';
import { verifyToken, loadUser } from './_lib/core.js';

export const config = { maxDuration: 300 };
const STREAM_MS = 240000; // end before the platform limit; the client reconnects by itself

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const claims = verifyToken(url.searchParams.get('token') || '');
  const user = claims && await loadUser(claims.id).catch(() => null);
  if (!user || user.role === 'field_officer') { res.statusCode = 401; return res.end('Unauthorized'); }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*',
  });
  let closed = false;
  const write = (event, data) => {
    if (closed || res.writableEnded || res.destroyed) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* client went away */ }
  };
  res.write('retry: 2000\n\n');

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
  let ping, timer;
  const close = () => {
    if (closed) return;
    closed = true; clearInterval(ping); clearTimeout(timer);
    client.end().catch(() => {});
    try { res.end(); } catch { /* already closed */ }
  };
  req.on('close', close);
  res.on('error', close);
  client.on('error', close);

  try {
    await client.connect();
    client.on('notification', (msg) => {
      let m;
      try { m = JSON.parse(msg.payload); } catch { return; }
      if (user.role === 'branch_manager') {
        if (m.branch_id !== user.branch_id) return;                       // only their own branch
        if (m.t === 'alert' && m.target_role !== 'branch_manager') return; // meeting alerts are admin-only
      }
      write(m.t, m.d);
    });
    await client.query('LISTEN track_events');
    write('ping', {});
    ping = setInterval(() => write('ping', {}), 25000);
    timer = setTimeout(close, STREAM_MS);
  } catch (e) {
    console.error('stream failed', e.message);
    close();
  }
}
