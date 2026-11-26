// http-router.js — полноценная маршрутизация без фреймворков
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

// ---------- Хранилище студентов ----------
let students = [
    { id: 1, name: 'Иван', group: GROUP },
    { id: 2, name: 'Мария', group: GROUP },
    { id: 3, name: 'Пётр', group: GROUP }
];
let nextId = 4;

// ---------- Чтение тела ----------
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > 1024 * 1024) {
                reject({ code: 413, message: 'Payload Too Large' });
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

// ---------- Ответы ----------
function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Powered-By': 'Node.js',
        'X-Group': GROUP
    });
    res.end(JSON.stringify(data, null, 2));
}

function sendText(res, status, text) {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Group': GROUP });
    res.end(text);
}

// ============================================================
//  ПАРСИНГ URL
// ============================================================
function parseUrl(rawUrl) {
    const u = new URL(rawUrl, `http://localhost:${PORT}`);
    const query = {};
    for (const [k, v] of u.searchParams) query[k] = v;
    return { pathname: u.pathname, query };
}

// ============================================================
//  ТАБЛИЦА МАРШРУТОВ
//  pattern — RegExp с именованными группами
// ============================================================
const routes = [
    // GET /api/students
    {
        method: 'GET',
        pattern: /^\/api\/students\/?$/,
        handler: (req, res, { query }) => {
            let result = [...students];
            if (query.group) {
                result = result.filter(s => s.group === query.group);
            }
            if (query.search) {
                const q = query.search.toLowerCase();
                result = result.filter(s => s.name.toLowerCase().includes(q));
            }
            sendJSON(res, 200, result);
        }
    },

    // GET /api/students/:id
    {
        method: 'GET',
        pattern: /^\/api\/students\/(?<id>\d+)\/?$/,
        handler: (req, res, { params }) => {
            const id = Number(params.id);
            const student = students.find(s => s.id === id);
            if (!student) return sendJSON(res, 404, { error: 'Студент не найден', id });
            sendJSON(res, 200, student);
        }
    },

    // POST /api/students
    {
        method: 'POST',
        pattern: /^\/api\/students\/?$/,
        handler: async (req, res) => {
            const body = await readBody(req);
            let data;
            try { data = JSON.parse(body); }
            catch { return sendJSON(res, 400, { error: 'Невалидный JSON' }); }

            if (!data.name || typeof data.name !== 'string') {
                return sendJSON(res, 400, { error: 'Поле "name" обязательно' });
            }

            const student = {
                id: nextId++,
                name: data.name.trim(),
                group: data.group || GROUP
            };
            students.push(student);
            console.log(`[${timestamp()}] [${GROUP}] Создан студент: ${student.name} (id=${student.id})`);
            sendJSON(res, 201, student);
        }
    },

    // PUT /api/students/:id
    {
        method: 'PUT',
        pattern: /^\/api\/students\/(?<id>\d+)\/?$/,
        handler: async (req, res, { params }) => {
            const id = Number(params.id);
            const student = students.find(s => s.id === id);
            if (!student) return sendJSON(res, 404, { error: 'Студент не найден', id });

            const body = await readBody(req);
            let data;
            try { data = JSON.parse(body); }
            catch { return sendJSON(res, 400, { error: 'Невалидный JSON' }); }

            if (data.name !== undefined) student.name = String(data.name).trim();
            if (data.group !== undefined) student.group = String(data.group).trim();

            console.log(`[${timestamp()}] [${GROUP}] Обновлён студент: id=${id}`);
            sendJSON(res, 200, student);
        }
    },

    // DELETE /api/students/:id
    {
        method: 'DELETE',
        pattern: /^\/api\/students\/(?<id>\d+)\/?$/,
        handler: (req, res, { params }) => {
            const id = Number(params.id);
            const idx = students.findIndex(s => s.id === id);
            if (idx === -1) return sendJSON(res, 404, { error: 'Студент не найден', id });
            students.splice(idx, 1);
            console.log(`[${timestamp()}] [${GROUP}] Удалён студент: id=${id}`);
            sendJSON(res, 200, { deleted: true, id });
        }
    },

    // GET /users/:id — демонстрация параметра пути
    {
        method: 'GET',
        pattern: /^\/users\/(?<id>\d+)\/?$/,
        handler: (req, res, { params }) => {
            sendJSON(res, 200, { userId: Number(params.id), message: 'Параметр пути извлечён' });
        }
    },

    // GET /users/:userId/posts/:postId — несколько параметров
    {
        method: 'GET',
        pattern: /^\/users\/(?<userId>\d+)\/posts\/(?<postId>\d+)\/?$/,
        handler: (req, res, { params }) => {
            sendJSON(res, 200, {
                userId: Number(params.userId),
                postId: Number(params.postId),
                message: 'Два параметра извлечены'
            });
        }
    },

    // GET /search?q=...&limit=...
    {
        method: 'GET',
        pattern: /^\/search\/?$/,
        handler: (req, res, { query }) => {
            const q = query.q || '';
            const limit = Math.min(Number(query.limit) || 10, 100);
            sendJSON(res, 200, {
                query: q,
                limit,
                decoded: decodeURIComponent(q),
                message: 'Query-параметры распарсены'
            });
        }
    },

    // GET / — главная
    {
        method: 'GET',
        pattern: /^\/?$/,
        handler: (req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Laba 20 — Router</title>
<style>
body{font-family:sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);
min-height:100vh;display:flex;justify-content:center;align-items:center;margin:0;padding:20px}
.container{background:#fff;border-radius:16px;padding:40px;max-width:600px;width:100%;
box-shadow:0 20px 50px rgba(0,0,0,.3)}
h1{color:#4a3f9f;border-bottom:3px solid #667eea;padding-bottom:12px}
p{line-height:1.7}code{background:#f0f0f0;padding:2px 6px;border-radius:4px}
a{color:#667eea;text-decoration:none}a:hover{text-decoration:underline}
footer{margin-top:24px;padding-top:16px;border-top:1px solid #eee;
text-align:center;font-size:.9em;color:#888}
</style></head><body><div class="container">
<h1>Лабораторная работа №20 — Router</h1>
<p><strong>Группа:</strong> ${GROUP}</p>
<p><strong>Студент:</strong> ${STUDENT}</p>
<h3>REST API:</h3>
<ul>
<li><a href="/api/students">/api/students</a> — все студенты</li>
<li><a href="/api/students?group=${GROUP}">/api/students?group=${GROUP}</a> — фильтр</li>
<li><a href="/api/students/1">/api/students/1</a> — один студент</li>
</ul>
<p>Методы: GET, POST, PUT, DELETE. PATCH → 405.</p>
<footer>Максим Мазан Борисович, группа ${GROUP}, ${UNIVERSITY}</footer>
</div></body></html>`);
        }
    }
];

// ============================================================
//  ПОИСК МАРШРУТА
// ============================================================
function findRoute(method, pathname) {
    const pathMatches = [];
    for (const route of routes) {
        const m = pathname.match(route.pattern);
        if (m) {
            pathMatches.push({ route, match: m });
            if (route.method === method) {
                return { route, match: m };
            }
        }
    }
    // Путь есть, но метод другой → 405
    if (pathMatches.length > 0) {
        const allowed = [...new Set(pathMatches.map(r => r.route.method))];
        return { methodNotAllowed: true, allowed };
    }
    return null;
}

// ============================================================
//  СЕРВЕР
// ============================================================
const server = http.createServer(async (req, res) => {
    const { method } = req;
    const { pathname, query } = parseUrl(req.url);
    const start = Date.now();

    const found = findRoute(method, pathname);

    if (!found) {
        sendJSON(res, 404, { error: 'Not Found', path: pathname, method });
        console.log(`[${timestamp()}] [${GROUP}] ${method} ${pathname} 404 (${Date.now() - start}ms)`);
        return;
    }

    if (found.methodNotAllowed) {
        res.setHeader('Allow', found.allowed.join(', '));
        sendText(res, 405, `405 Method Not Allowed. Допустимые методы: ${found.allowed.join(', ')}`);
        console.log(`[${timestamp()}] [${GROUP}] ${method} ${pathname} 405 (${Date.now() - start}ms)`);
        return;
    }

    try {
        const params = found.match.groups || {};
        await found.route.handler(req, res, { params, query });
        console.log(`[${timestamp()}] [${GROUP}] ${method} ${pathname} ${res.statusCode} (${Date.now() - start}ms)`);
    } catch (err) {
        if (err.code === 413) {
            sendJSON(res, 413, { error: 'Payload Too Large' });
        } else {
            console.error(err);
            sendJSON(res, 500, { error: 'Internal Server Error' });
        }
        console.log(`[${timestamp()}] [${GROUP}] ${method} ${pathname} 500 (${Date.now() - start}ms)`);
    }
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Группа: ${GROUP}, студент: ${STUDENT}`);
    console.log(`REST API: http://localhost:${PORT}/api/students`);
});