import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT ?? 4173);
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/material.html', ['material.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/chat.js', ['chat.js', 'text/javascript; charset=utf-8']],
  ['/demo-data.js', ['demo-data.js', 'text/javascript; charset=utf-8']],
  ['/templates.js', ['templates.js', 'text/javascript; charset=utf-8']],
  ['/ui.js', ['ui.js', 'text/javascript; charset=utf-8']],
  ['/material.js', ['material.js', 'text/javascript; charset=utf-8']],
  ['/mark.png', ['mark.png', 'image/png']],
  ['/favicon.ico', ['mark.png', 'image/png']],
]);

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const file = files.get(request.url?.split('?')[0]);
  if (!file) {
    response.writeHead(404).end();
    return;
  }

  const [name, type] = file;
  try {
    const body = await readFile(new URL(name, import.meta.url));
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error(error.message);
    response.writeHead(500).end();
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Нейро-мед: http://127.0.0.1:${server.address().port}`);
});
