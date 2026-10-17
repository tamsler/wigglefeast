// Static file server for the repo, used by tests that need http(s) (service worker,
// updates). setVersion() changes the VERSION served in sw.js to simulate a new release.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { REPO } = require('./browser');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

function serve() {
  let version = null;
  let online = true;
  const server = http.createServer((req, res) => {
    if (!online) { req.socket.destroy(); return; }
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(REPO, rel);
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    let body = fs.readFileSync(file);
    if (rel === 'sw.js' && version) body = body.toString().replace(/^const VERSION = '[^']*';/m, `const VERSION = '${version}';`);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}/`,
    setVersion(v) { version = v; },
    setOnline(v) { online = v; },
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
  })));
}

module.exports = { serve };
