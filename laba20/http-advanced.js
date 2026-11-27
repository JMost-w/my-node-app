// http-advanced.js — HTTP + HTTPS + middleware + статика + кэш + стриминг
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';
const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;
const CACHE_TTL_MS = 60_000; // 60 секунд

const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'access.log');
const CERTS_DIR = path.join(__dirname, 'certs');

// ---------- Инициализация директорий ----------
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true });

// ---------- Логирование ----------
function timestamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function log(message) {
    const line = `[${timestamp()}] [${GROUP}] ${message}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

// ---------- Метрики ----------
const metrics = {
    total: 0,
    byMethod: {},
    byStatus: {},
    startTime: Date.now()
};

function recordMetric(method, status) {
    metrics.total++;
    metrics.byMethod[method] = (metrics.byMethod[method] || 0) + 1;
    metrics.byStatus[status] = (metrics.byStatus[status] || 0) + 1;
}

// ---------- Кэш ----------
const cache = new Map(); // key -> { body, headers, expiresAt }

function cacheKey(req) {
    return req.method + ':' + req.url;
}

function getFromCache(req) {
    const entry = cache.get(cacheKey(req));
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        cache.delete(cacheKey(req));
        return null;
    }
    return entry;
}

function setCache(req, body, headers) {
    cache.set(cacheKey(req), {
        body,
        headers,
        expiresAt: Date.now() + CACHE_TTL_MS
    });
}

function invalidateCache() {
    cache.clear();
    log('Кэш инвалидирован');
}

// ---------- MIME-типы ----------
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.zip': 'application/zip',
    '.pdf': 'application/pdf'
};

function getMime(filePath) {
    return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// ---------- Базовые заголовки (ТОЛЬКО ASCII) ----------
function baseHeaders(extra = {}) {
    return {
        'X-Group': GROUP,
        'X-Powered-By': 'Node.js',
        ...extra
    };
}

// ---------- Ответы ----------
function sendJSON(res, status, data, extraHeaders = {}) {
    const body = JSON.stringify(data, null, 2);
    res.writeHead(status, baseHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        ...extraHeaders
    }));
    res.end(body);
    if (res.req) recordMetric(res.req.method, status);
}

function sendText(res, status, text) {
    res.writeHead(status, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end(text);
    if (res.req) recordMetric(res.req.method, status);
}

// ============================================================
//  MIDDLEWARE-СИСТЕМА
// ============================================================
const middlewares = [];

function use(fn) {
    middlewares.push(fn);
}

function runMiddlewares(req, res, done) {
    let i = 0;
    function next(err) {
        if (err) {
            if (!res.headersSent) {
                sendJSON(res, err.status || 500, {
                    error: err.message || 'Internal Server Error',
                    status: err.status || 500
                });
            }
            return;
        }
        const mw = middlewares[i++];
        if (!mw) return done();
        try {
            mw(req, res, next);
        } catch (e) {
            next(e);
        }
    }
    next();
}

// ---------- 1. Middleware: префикс группы ----------
use((req, res, next) => {
    res.setHeader('X-Group', GROUP);
    next();
});

// ---------- 2. Middleware: замер времени ----------
use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        log(`${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ---------- 3. Middleware: кэш для GET ----------
use((req, res, next) => {
    if (req.method !== 'GET') return next();

    const cached = getFromCache(req);
    if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.writeHead(200, { ...cached.headers, ...baseHeaders() });
        res.end(cached.body);
        recordMetric(req.method, 200);
        return;
    }
    res.setHeader('X-Cache', 'MISS');
    next();
});

// ============================================================
//  ОБРАБОТЧИКИ
// ============================================================

// ---------- GET / ----------
function handleRoot(req, res) {
    const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Laba 20 — Advanced</title>
<style>
body{font-family:sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);
min-height:100vh;display:flex;justify-content:center;align-items:center;margin:0;padding:20px}
.container{background:#fff;border-radius:16px;padding:40px;max-width:700px;width:100%;
box-shadow:0 20px 50px rgba(0,0,0,.3)}
h1{color:#4a3f9f;border-bottom:3px solid #667eea;padding-bottom:12px}
p,li{line-height:1.7}a{color:#667eea;text-decoration:none}a:hover{text-decoration:underline}
code{background:#f0f0f0;padding:2px 6px;border-radius:4px}
footer{margin-top:24px;padding-top:16px;border-top:1px solid #eee;
text-align:center;font-size:.9em;color:#888}
</style></head><body><div class="container">
<h1>Лабораторная работа №20 — Advanced</h1>
<p><strong>Группа:</strong> ${GROUP}</p>
<p><strong>Студент:</strong> ${STUDENT}</p>
<h3>Эндпоинты:</h3>
<ul>
<li><a href="/static/index.html">/static/index.html</a> — статика</li>
<li><a href="/metrics">/metrics</a> — метрики сервера</li>
<li><a href="/stream">/stream</a> — стриминг большого файла</li>
<li><a href="/cache-demo">/cache-demo</a> — демонстрация кэша</li>
</ul>
<p>HTTPS: <code>https://localhost:${HTTPS_PORT}/</code></p>
<footer>Максим Мазан Борисович, группа ${GROUP}, ${UNIVERSITY}</footer>
</div></body></html>`;

    res.writeHead(200, baseHeaders({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
    }));
    res.end(html);
    recordMetric(req.method, 200);
}

// ---------- GET /static/* ----------
function handleStatic(req, res) {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const relative = urlPath.replace(/^\/static\/?/, '');

    if (relative.includes('..')) {
        return sendJSON(res, 403, { error: 'Forbidden', reason: 'Path traversal detected' });
    }

    const filePath = path.join(PUBLIC_DIR, relative || 'index.html');
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
        return sendJSON(res, 403, { error: 'Forbidden' });
    }

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return sendJSON(res, 404, { error: 'File not found', path: urlPath });
    }

    const stat = fs.statSync(resolved);
    const etag = '"' + crypto.createHash('md5')
        .update(fs.readFileSync(resolved))
        .digest('hex') + '"';

    if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, baseHeaders({
            'ETag': etag,
            'Cache-Control': 'max-age=60'
        }));
        res.end();
        recordMetric(req.method, 304);
        return;
    }

    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince && new Date(ifModifiedSince) >= stat.mtime) {
        res.writeHead(304, baseHeaders({
            'ETag': etag,
            'Cache-Control': 'max-age=60'
        }));
        res.end();
        recordMetric(req.method, 304);
        return;
    }

    const content = fs.readFileSync(resolved);
    const mime = getMime(resolved);

    res.writeHead(200, baseHeaders({
        'Content-Type': mime,
        'Content-Length': content.length,
        'ETag': etag,
        'Last-Modified': stat.mtime.toUTCString(),
        'Cache-Control': 'max-age=60'
    }));
    res.end(content);
    recordMetric(req.method, 200);
}

// ---------- GET /cache-demo ----------
function handleCacheDemo(req, res) {
    const data = {
        message: 'Этот ответ закэширован на 60 секунд',
        timestamp: new Date().toISOString(),
        group: GROUP,
        hint: 'Повторный запрос в течение 60 сек вернётся из кэша (X-Cache: HIT)'
    };

    const body = JSON.stringify(data, null, 2);
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'max-age=60',
        'X-Group': GROUP
    };

    setCache(req, body, headers);

    res.writeHead(200, baseHeaders(headers));
    res.end(body);
    recordMetric(req.method, 200);
}

// ---------- GET /metrics ----------
function handleMetrics(req, res) {
    const data = {
        group: GROUP,
        student: STUDENT,
        total: metrics.total,
        byMethod: metrics.byMethod,
        byStatus: metrics.byStatus,
        cacheSize: cache.size,
        uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
        memory: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
        }
    };
    sendJSON(res, 200, data);
}

// ---------- GET /stream ----------
function handleStream(req, res) {
    const bigFile = path.join(__dirname, 'big-file.bin');
    if (!fs.existsSync(bigFile)) {
        log('Создание тестового файла big-file.bin (10 МБ)...');
        const fd = fs.openSync(bigFile, 'w');
        const chunk = Buffer.alloc(1024 * 1024, 'A');
        for (let i = 0; i < 10; i++) fs.writeSync(fd, chunk);
        fs.closeSync(fd);
    }

    const stat = fs.statSync(bigFile);
    res.writeHead(200, baseHeaders({
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="big-file.bin"'
    }));

    const stream = fs.createReadStream(bigFile);
    stream.pipe(res);

    stream.on('error', (err) => {
        log(`Ошибка стриминга: ${err.message}`);
        if (!res.headersSent) {
            res.writeHead(500, baseHeaders({ 'Content-Type': 'text/plain' }));
        }
        res.end('Stream error');
    });

    stream.on('end', () => {
        recordMetric(req.method, 200);
    });
}

// ============================================================
//  ГЛАВНЫЙ ОБРАБОТЧИК
// ============================================================
async function router(req, res) {
    const urlPath = req.url.split('?')[0];

    if (urlPath === '/' && req.method === 'GET') return handleRoot(req, res);
    if (urlPath.startsWith('/static/') && req.method === 'GET') return handleStatic(req, res);
    if (urlPath === '/cache-demo' && req.method === 'GET') return handleCacheDemo(req, res);
    if (urlPath === '/metrics' && req.method === 'GET') return handleMetrics(req, res);
    if (urlPath === '/stream' && req.method === 'GET') return handleStream(req, res);

    sendJSON(res, 404, { error: 'Not Found', path: urlPath, method: req.method });
}

// ============================================================
//  СОЗДАНИЕ СЕРВЕРОВ
// ============================================================
function createHandler() {
    return (req, res) => {
        res.req = req;
        runMiddlewares(req, res, () => {
            router(req, res).catch(err => {
                if (!res.headersSent) {
                    sendJSON(res, 500, { error: 'Internal Server Error' });
                }
            });
        });
    };
}

// ---------- HTTP-сервер ----------
const httpServer = http.createServer(createHandler());

httpServer.on('clientError', (err, socket) => {
    if (socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
});

httpServer.on('error', (err) => {
    log(`Ошибка HTTP-сервера: ${err.message}`);
});

// ---------- HTTPS-сервер ----------
function ensureCerts() {
    const keyPath = path.join(CERTS_DIR, 'key.pem');
    const certPath = path.join(CERTS_DIR, 'cert.pem');

    // Проверяем, что файлы существуют И не пустые
    if (fs.existsSync(keyPath) && fs.existsSync(certPath) && 
        fs.statSync(keyPath).size > 0 && fs.statSync(certPath).size > 0) {
        return { keyPath, certPath };
    }

    log('Генерация самоподписанного сертификата...');
    try {
        execSync(
            `openssl req -x509 -newkey rsa:2048 -nodes -days 365 ` +
            `-keyout "${keyPath}" -out "${certPath}" ` +
            `-subj "/C=BY/ST=Minsk/L=Minsk/O=BTK/CN=localhost"`,
            { stdio: 'pipe' }
        );
    } catch (e) {
        log('Не удалось сгенерировать сертификат: ' + e.message);
        log('Сгенерируйте вручную: openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost"');
        return null;
    }
    return { keyPath, certPath };
}

const certs = ensureCerts();
let httpsServer = null;

if (certs) {
    try {
        const httpsOptions = {
            key: fs.readFileSync(certs.keyPath),
            cert: fs.readFileSync(certs.certPath)
        };
        httpsServer = https.createServer(httpsOptions, createHandler());

        httpsServer.on('error', (err) => {
            log(`Ошибка HTTPS-сервера: ${err.message}`);
        });
    } catch (e) {
        log(`Не удалось создать HTTPS-сервер: ${e.message}`);
    }
}

// ============================================================
//  ЗАПУСК
// ============================================================
httpServer.listen(HTTP_PORT, () => {
    console.log(`[INFO] HTTP-сервер запущен на порту ${HTTP_PORT}`);
    console.log(`[INFO] Группа: ${GROUP}`);
    console.log(`[INFO] Студент: ${STUDENT}`);
    console.log(`[INFO] Статика: http://localhost:${HTTP_PORT}/static/index.html`);
    console.log(`[INFO] Метрики: http://localhost:${HTTP_PORT}/metrics`);
    console.log(`[INFO] Стриминг: http://localhost:${HTTP_PORT}/stream`);
});

if (httpsServer) {
    httpsServer.listen(HTTPS_PORT, () => {
        console.log(`[INFO] HTTPS-сервер запущен на порту ${HTTPS_PORT}`);
        console.log(`[INFO] HTTPS: https://localhost:${HTTPS_PORT}/ (сертификат самоподписанный)`);
    });
}

// ============================================================
//  КОРРЕКТНОЕ ЗАВЕРШЕНИЕ
// ============================================================
function shutdown(signal) {
    log(`Получен ${signal}, завершение...`);
    httpServer.close(() => {
        log('HTTP-сервер остановлен');
        if (httpsServer) {
            httpsServer.close(() => {
                log('HTTPS-сервер остановлен');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
    setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));