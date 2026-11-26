// http-body.js — чтение тела POST-запроса через data/end/error
const http = require('http');

const PORT = 3000;
const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';
const MAX_BODY_SIZE = 1024 * 1024; // 1 МБ

function timestamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---------- Чтение тела через события ----------
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let aborted = false;

        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                aborted = true;
                reject({ code: 413, message: 'Payload Too Large' });
                req.destroy(); // прекращаем приём
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            if (aborted) return;
            resolve(Buffer.concat(chunks));
        });

        req.on('error', err => {
            if (aborted) return;
            reject({ code: 400, message: err.message });
        });
    });
}

// ---------- Парсинг по Content-Type ----------
function parseBody(buffer, contentType = '') {
    const type = contentType.split(';')[0].trim().toLowerCase();

    if (type === 'application/json') {
        try {
            return { type, value: JSON.parse(buffer.toString('utf8')) };
        } catch (e) {
            return { type, error: 'Invalid JSON: ' + e.message };
        }
    }

    if (type === 'application/x-www-form-urlencoded') {
        const params = new URLSearchParams(buffer.toString('utf8'));
        const obj = {};
        for (const [k, v] of params) obj[k] = v;
        return { type, value: obj };
    }

    if (type === 'text/plain' || type === '') {
        return { type: 'text/plain', value: buffer.toString('utf8') };
    }

    // octet-stream и всё остальное — как есть
    return { type: type || 'application/octet-stream', value: buffer };
}

// ---------- Ответы ----------
function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Powered-By': 'Node.js',
        'X-Group': GROUP,
        'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(data, null, 2));
}

function sendText(res, status, text) {
    res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Powered-By': 'Node.js',
        'X-Group': GROUP
    });
    res.end(text);
}

// ============================================================
//  СЕРВЕР
// ============================================================
const server = http.createServer(async (req, res) => {
    const { method, url } = req;
    const start = Date.now();
    const contentType = req.headers['content-type'] || '';

    try {
        // ---------- POST /echo ----------
        if (url === '/echo' && method === 'POST') {
            const buffer = await readBody(req);

            console.log(`[${timestamp()}] POST /echo — размер тела: ${buffer.length} байт`);

            const parsed = parseBody(buffer, contentType);

            if (parsed.error) {
                return sendJSON(res, 400, { error: parsed.error, group: GROUP });
            }

            // JSON — добавляем group
            if (parsed.type === 'application/json') {
                const data = parsed.value;
                if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                    data.group = GROUP;
                }
                return sendJSON(res, 200, data);
            }

            // text/plain — как есть
            if (parsed.type === 'text/plain') {
                return sendText(res, 200, parsed.value);
            }

            // Остальное — JSON-обёртка
            return sendJSON(res, 200, {
                type: parsed.type,
                size: buffer.length,
                group: GROUP
            });
        }

        // ---------- POST /form ----------
        if (url === '/form' && method === 'POST') {
            const buffer = await readBody(req);
            console.log(`[${timestamp()}] POST /form — размер тела: ${buffer.length} байт`);

            const parsed = parseBody(buffer, contentType);

            if (parsed.type !== 'application/x-www-form-urlencoded') {
                return sendJSON(res, 400, {
                    error: 'Ожидался Content-Type: application/x-www-form-urlencoded',
                    got: contentType || '(не указан)',
                    group: GROUP
                });
            }

            return sendJSON(res, 200, { ...parsed.value, group: GROUP });
        }

        // ---------- GET / ----------
        if (url === '/' && method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Laba 20 — Body</title>
<style>
body{font-family:sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);
min-height:100vh;display:flex;justify-content:center;align-items:center;margin:0;padding:20px}
.container{background:#fff;border-radius:16px;padding:40px;max-width:600px;width:100%;
box-shadow:0 20px 50px rgba(0,0,0,.3)}
h1{color:#4a3f9f;border-bottom:3px solid #667eea;padding-bottom:12px}
p{line-height:1.7}code{background:#f0f0f0;padding:2px 6px;border-radius:4px}
footer{margin-top:24px;padding-top:16px;border-top:1px solid #eee;
text-align:center;font-size:.9em;color:#888}
</style></head><body><div class="container">
<h1>Лабораторная работа №20 — Body</h1>
<p><strong>Группа:</strong> ${GROUP}</p>
<p><strong>Студент:</strong> ${STUDENT}</p>
<h3>Эндпоинты:</h3>
<ul>
<li><code>POST /echo</code> — эхо тела (JSON/text/любое)</li>
<li><code>POST /form</code> — парсинг form-urlencoded</li>
</ul>
<p>Лимит тела: <strong>1 МБ</strong> (413 при превышении)</p>
<footer>Максим Мазан Борисович, группа ${GROUP}, ${UNIVERSITY}</footer>
</div></body></html>`);
            return;
        }

        // ---------- 404 ----------
        sendJSON(res, 404, { error: 'Not Found', path: url, status: 404 });

    } catch (err) {
        if (err.code === 413) {
            console.log(`[${timestamp()}] ${method} ${url} — 413 (тело > 1 МБ)`);
            return sendJSON(res, 413, {
                error: 'Payload Too Large',
                maxSize: `${MAX_BODY_SIZE / 1024} КБ`,
                group: GROUP
            });
        }
        console.error(`[${timestamp()}] Ошибка:`, err);
        sendJSON(res, 500, { error: 'Internal Server Error', group: GROUP });
    } finally {
        const duration = Date.now() - start;
        // Лог для всех, кроме уже залогированных POST
        if (method !== 'POST') {
            console.log(`[${timestamp()}] ${method} ${url} ${res.statusCode} (${duration}ms)`);
        }
    }
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Группа: ${GROUP}, студент: ${STUDENT}`);
    console.log(`Лимит тела: ${MAX_BODY_SIZE / 1024} КБ`);
    console.log(`Эндпоинты:`);
    console.log(`  POST http://localhost:${PORT}/echo`);
    console.log(`  POST http://localhost:${PORT}/form`);
});