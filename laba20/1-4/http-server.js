// http-server.js — HTTP-сервер на чистом модуле http
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

function page(title, body) {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #667eea, #764ba2); min-height: 100vh; display: flex; justify-content: center; align-items: center; margin: 0; }
        .container { background: #fff; border-radius: 16px; padding: 40px; max-width: 600px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
        h1 { color: #4a3f9f; border-bottom: 3px solid #667eea; padding-bottom: 12px; }
        p { line-height: 1.7; color: #333; }
        a { color: #667eea; text-decoration: none; }
        a:hover { text-decoration: underline; }
        footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; font-size: .9em; color: #888; }
    </style>
</head>
<body>
    <div class="container">
        ${body}
        <footer>Максим Мазан Борисович, группа ${GROUP}, ${UNIVERSITY}</footer>
    </div>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    const start = Date.now();
    const { method, url } = req;

    // ---------- Маршрутизация ----------
    let status = 200;
    let html = '';

    if (url === '/' && method === 'GET') {
        html = page('Лабораторная работа №20', `
            <h1>=== Лабораторная работа №20 ===</h1>
            <p><strong>Группа:</strong> ${GROUP}</p>
            <p><strong>Студент:</strong> ${STUDENT}</p>
            <p><strong>Метод:</strong> ${method}</p>
            <p><strong>URL:</strong> ${url}</p>
            <p><a href="/about">/about</a> — о студенте</p>
        `);
    } else if (url === '/about' && method === 'GET') {
        html = page('О студенте', `
            <h1>=== О студенте ===</h1>
            <p><strong>Группа:</strong> ${GROUP}</p>
            <p><strong>Студент:</strong> ${STUDENT}</p>
            <p><strong>Университет:</strong> ${UNIVERSITY}</p>
            <p><a href="/">/</a> — на главную</p>
        `);
    } else {
        status = 404;
        html = page('404 Not Found', `
            <h1>=== 404 Not Found ===</h1>
            <p>Путь <code>${url}</code> не найден</p>
            <p><a href="/">/</a> — на главную</p>
        `);
    }

    // ---------- Ответ ----------
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);

    // ---------- Логирование ----------
    const duration = Date.now() - start;
    console.log(`[${timestamp()}] ${method} ${url} ${status} (${duration}ms)`);
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Группа: ${GROUP}, студент: ${STUDENT}`);
    console.log(`Откройте: http://localhost:${PORT}/`);
});