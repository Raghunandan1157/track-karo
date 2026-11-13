// Local test server: serves the static site and runs the same API code Vercel runs.
//   cd WEBSITE && npm run dev      (needs WEBSITE/.env.local with DATABASE_URL etc.)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
for (const line of (fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const api = (await import('./api/index.js')).default;
const stream = (await import('./api/stream.js')).default;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/api/stream') return stream(req, res);
  if (p.startsWith('/api/')) return api(req, res);
  const file = path.normalize(path.join(root, p === '/' ? 'index.html' : p));
  if (!file.startsWith(root) || file.includes('node_modules') || file.includes(`${path.sep}api${path.sep}`) || path.basename(file).startsWith('.')
      || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3100, () => console.log(`Track_karo dev server on http://localhost:${process.env.PORT || 3100}`));
