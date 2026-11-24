// Tiny local web server: `npm start` -> http://localhost:5173
// Google sign-in (needed for the optional Drive backup) does not work from a file:// page, but it does from
// http://localhost. It serves index.html only and listens on the loopback interface only.
//
// It also lets browsers that cannot write to a folder themselves (Firefox) keep the automatic folder backup:
// the page sends the backup here and this server writes it into a folder chosen in the app (or set with the
// BACKUP_DIR environment variable). The chosen folder is remembered in .backup-dir.json (not committed).
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = Number(process.env.PORT || 5173);
const FILE = path.join(__dirname, '..', 'index.html');
const CFG = path.join(__dirname, '..', '.backup-dir.json');
const MAX_BODY = 20 * 1024 * 1024;

let backupDir = process.env.BACKUP_DIR || '';
if (!backupDir) { try { backupDir = JSON.parse(fs.readFileSync(CFG, 'utf8')).dir || ''; } catch (e) { /* not set yet */ } }

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

// Only the page served by this very server may use the backup endpoints (blocks other sites and DNS rebinding)
const allowedHosts = new Set(['localhost:' + PORT, '127.0.0.1:' + PORT]);
const trusted = req => allowedHosts.has(req.headers.host || '') && (!req.headers.origin || allowedHosts.has(req.headers.origin.replace(/^http:\/\//, '')));

function readBody(req, res, cb) {
  const chunks = []; let size = 0, dead = false;
  req.on('data', c => { size += c.length; if (size > MAX_BODY) { dead = true; send(res, 413, { error: 'Too large' }); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { if (!dead) cb(Buffer.concat(chunks).toString('utf8')); });
}
function writeAtomic(dir, name, text) {
  const target = path.join(dir, name), tmp = target + '.tmp';
  fs.writeFileSync(tmp, text); fs.renameSync(tmp, target);
}

http.createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(FILE).pipe(res);
  } else if (p === '/backup' || p === '/backup/dir') {
    if (!trusted(req)) return send(res, 403, { error: 'Forbidden' });
    if (p === '/backup' && req.method === 'GET') return send(res, 200, { dir: backupDir });
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    readBody(req, res, text => {
      try {
        if (p === '/backup/dir') {                                   // choose (or clear) the folder
          const dir = String(JSON.parse(text).dir || '').trim();
          if (dir) {
            if (!path.isAbsolute(dir)) return send(res, 400, { error: 'Enter the full path of the folder, for example C:\\Backups\\ToDo' });
            fs.mkdirSync(dir, { recursive: true });
            const probe = path.join(dir, '.write-test'); fs.writeFileSync(probe, ''); fs.unlinkSync(probe);
          }
          backupDir = dir; fs.writeFileSync(CFG, JSON.stringify({ dir }));
          return send(res, 200, { dir });
        }
        if (!backupDir) return send(res, 409, { error: 'No folder chosen' });
        const j = JSON.parse(text);
        if (!j || j.app !== 'trees' || !Array.isArray(j.trees)) return send(res, 400, { error: 'Not a trees backup' });
        fs.mkdirSync(backupDir, { recursive: true });
        writeAtomic(backupDir, 'todotree-backup.json', text);
        send(res, 200, { ok: true });
      } catch (e) { send(res, 500, { error: e.code === 'EACCES' || e.code === 'EPERM' ? 'No permission to write in that folder' : e.message }); }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log('ToDoTree is running at http://localhost:' + PORT + '  (Ctrl+C to stop)'));
