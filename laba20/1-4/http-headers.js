// http-headers.js — чтение и установка HTTP-заголовков
const http = require('http');

const PORT = 3000;
const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

function timestamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function sendJSON(res, status, data) {
    const body = JSON.stringify(data, null, 2);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Powered-By': 'Node.js',
        'X-Group': GROUP,
        'Cache-Control': 'no-cache'
    });
    res.end(body);
}

function sendHTML(res, status, html) {
    res.writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Powered-By': 'Node.js',
        'X-Group': GROUP,
        'Cache-Control': 'no-cache'
    });
    res.end(html);
}

const server = http.createServer((req, res) => {
    const { method, url } = req;
    const start = Date.now();

    // ============================================================
    //  GET /headers — все заголовки запроса
    // ============================================================
    if (url === '/headers' && method === 'GET') {
        sendJSON(res, 200, {
            headers: req.headers,
            method,
            url,
            httpVersion: req.httpVersion
        });
    }

    // ============================================================
    //  GET /headers/set — установка кастомных заголовков
    // ============================================================
    else if (url === '/headers/set' && method === 'GET') {
        // Устанавливаем по одному через setHeader
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Powered-By', 'Node.js');
        res.setHeader('X-Group', GROUP);
        res.setHeader('X-Student', STUDENT);
        res.setHeader('Cache-Control', 'no-cache');

        // Проверяем через hasHeader / getHeader
        const hasXGroup = res.hasHeader('X-Group');
        const xGroupValue = res.getHeader('X-Group');

        // Удаляем один заголовок до отправки
        res.removeHeader('X-Student');

        const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Headers Set</title>
<style>
body{font-family:sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);
min-height:100vh;display:flex;justify-content:center;align-items:center;margin:0;padding:20px}
.container{background:#fff;border-radius:16px;padding:40px;max-width:600px;width:100%;
box-shadow:0 20px 50px rgba(0,0,0,.3)}
h1{color:#4a3f9f;border-bottom:3px solid #667eea;padding-bottom:12px}
p{line-height:1.7;color:#333}
code{background:#f0f0f0;padding:2px 6px;border-radius:4px}
footer{margin-top:24px;padding-top:16px;border-top:1px solid #eee;
text-align:center;font-size:.9em;color:#888}
</style></head><body><div class="container">
<h1>Заголовки установлены</h1>
<p><strong>X-Powered-By:</strong> Node.js</p>
<p><strong>X-Group:</strong> ${GROUP}</p>
<p><strong>Cache-Control:</strong> no-cache</p>
<p><strong>hasHeader('X-Group'):</strong> ${hasXGroup}</p>
<p><strong>getHeader('X-Group'):</strong> ${xGroupValue}</p>
<p><strong>X-Student:</strong> удалён через removeHeader()</p>
<p>Проверьте через <code>curl -I http://localhost:${PORT}/headers/set</code></p>
<footer>Максим Мазан Борисович, группа ${GROUP}, ${UNIVERSITY}</footer>
</div></body></html>`;
        res.writeHead(200);
        res.end(html);
    }

    // ============================================================
    //  GET /headers/check — проверка наличия заголовков
    // ============================================================
    else if (url === '/headers/check' && method === 'GET') {
        // Проверяем входящие заголовки запроса
        const hasUserAgent = 'user-agent' in req.headers;
        const hasAccept = 'accept' in req.headers;
        const hasXCustom = 'x-custom-header' in req.headers;
        const hasContentType = 'content-type' in req.headers;

        sendJSON(res, 200, {
            requestHeaders: {
                hasUserAgent,
                hasAccept,
                hasContentType,
                hasXCustom,
                userAgent: req.headers['user-agent'] || null,
                xCustom: req.headers['x-custom-header'] || null
            },
            responseHeaders: {
                hasContentType: true,
                hasXGroup: true,
                hasUnknown: false
            },
            hint: 'Добавьте заголовок через curl: -H "X-Custom-Header: test"'
        });
    }

    // ============================================================
    //  GET / — главная
    // ============================================================
    else if (url === '/' && method === 'GET') {
        sendHTML(res, 200, `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Laba 20 — Headers</title>
<style>
body{font-family:sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);
min-height:100vh;display:flex;justify-content:center;align-items:center;margin:0;padding:20px}
.container{background:#fff;border-radius:16px;padding:40px;max-width:600px;width:100%;
box-shadow:0 20px 50px rgba(0,0,0,.3)}
h1{color:#4a3f9f;border-bottom:3px solid #667eea;padding-bottom:12px}
p{line-height:1.7}
a{color:#667eea;text-decoration:none}
a:hover{text-decoration:underline}
ul{padding-left:24px}
footer{margin-top:24px;padding-top:16px;border-top:1px solid #eee;
text-align:center;font-size:.9em;color:#888}
</style></head><body><div class="container">
<h1>Лабораторная работа №20 — Заголовки</h1>
<p><strong>Группа:</strong> ${GROUP}</p>
<p><strong>Студент:</strong> ${STUDENT}</p>
<h3>Эндпоинты:</h3>
<ul>
<li><a href="/headers">/headers</a> — все заголовки запроса (JSON)</li>
<li><a href="/headers/set">/headers/set</a> — установка кастомных заголовков</li>
<li><a href="/headers/check">/headers/check</a> — проверка наличия заголовков</li>
</ul>
<footer>Максим Мазан Борисович, группа ${GROUP}, ${UNIVERSITY}</footer>
</div></body></html>`);
    }

    // ============================================================
    //  404
    // ============================================================
    else {
        sendJSON(res, 404, {
            error: 'Not Found',
            path: url,
            status: 404
        });
    }

    const duration = Date.now() - start;
    console.log(`[${timestamp()}] ${method} ${url} ${res.statusCode} (${duration}ms)`);
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Группа: ${GROUP}, студент: ${STUDENT}`);
    console.log(`Эндпоинты:`);
    console.log(`  GET http://localhost:${PORT}/headers`);
    console.log(`  GET http://localhost:${PORT}/headers/set`);
    console.log(`  GET http://localhost:${PORT}/headers/check`);
});