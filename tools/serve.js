// Tiny local web server: `npm start` -> http://localhost:5173
// Google sign-in (needed for the optional Drive backup) does not work from a file:// page, but it does from
// http://localhost. It serves index.html only and listens on the loopback interface only.
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = Number(process.env.PORT || 5173);
const FILE = path.join(__dirname, '..', 'index.html');

http.createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(FILE).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log('ToDoTree is running at http://localhost:' + PORT + '  (Ctrl+C to stop)'));
