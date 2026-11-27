// server.js — Express + middleware + REST API
const express = require('express');
const path = require('path');
const compression = require('compression');

const booksStore = require('./books');
const logger = require('./middleware/logger');
const createRateLimiter = require('./middleware/rateLimiter');
const { HttpError, notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = 3000;

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

// ============================================================
//  MIDDLEWARE (порядок важен!)
// ============================================================
app.use(logger);                                     // 1. логгер первым
app.use(compression({ level: 6 }));                   // 2. сжатие
app.use(createRateLimiter({ windowMs: 60_000, max: 100 })); // 3. лимит
app.use(express.json());                              // 4. парсинг JSON
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
//  HTML
// ============================================================
function htmlTemplate(title, content) {
    return `<!DOCTYPE html>
    <html lang="ru">
    <head><meta charset="UTF-8"><title>${title}</title>
    <link rel="stylesheet" href="/style.css"></head>
    <body><div class="container">${content}
        <footer>${STUDENT}, группа ${GROUP}, ${UNIVERSITY}</footer>
    </div></body></html>`;
}

app.get('/', (req, res) => {
    res.send(htmlTemplate('Лабораторная работа №16 — Задание 3', `
        <h1>Лабораторная работа №16 — Задание 3</h1>
        <h2>Группа: ${GROUP}</h2>
        <p><strong>Студент:</strong> ${STUDENT}</p>
        <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        <h3>Middleware:</h3>
        <ul>
            <li>Logger — логирование запросов</li>
            <li>Compression — gzip/deflate</li>
            <li>Rate Limiter — 100 запросов/мин</li>
            <li>Error Handler — централизованная обработка</li>
        </ul>
        <h3>Тест ошибок:</h3>
        <ul>
            <li><a href="/error">/error</a> — синхронная ошибка (500)</li>
            <li><a href="/async-error">/async-error</a> — асинхронная ошибка (503)</li>
            <li><a href="/api/books/999">/api/books/999</a> — 404</li>
        </ul>
    `));
});

// ============================================================
//  REST API
// ============================================================
app.get('/api/books/search', (req, res) => {
    res.json(booksStore.searchByAuthor(req.query.author));
});
app.get('/api/books', (req, res) => res.json(booksStore.getAll()));
app.get('/api/books/:id', (req, res) => res.json(booksStore.getById(req.params.id)));
app.post('/api/books', (req, res) => res.status(201).json(booksStore.create(req.body)));
app.put('/api/books/:id', (req, res) => res.json(booksStore.update(req.params.id, req.body)));
app.delete('/api/books/:id', (req, res) => {
    const removed = booksStore.remove(req.params.id);
    res.json({ message: `Книга "${removed.title}" удалена`, id: removed.id });
});

// ============================================================
//  ТЕСТОВЫЕ МАРШРУТЫ ДЛЯ ОШИБОК
// ============================================================
app.get('/error', (req, res) => {
    throw new HttpError(500, 'Тестовая синхронная ошибка');
});

// Express 4 не ловит reject из async — нужна обёртка
function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get('/async-error', asyncHandler(async (req, res) => {
    await new Promise((_, reject) =>
        setTimeout(() => reject(new HttpError(503, 'Тестовая асинхронная ошибка')), 300)
    );
}));

// ============================================================
//  ОБРАБОТКА ОШИБОК — В КОНЦЕ
// ============================================================
app.use(notFound);
app.use(errorHandler);

// ============================================================
//  ЗАПУСК
// ============================================================
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
    console.log(`   Студент: ${STUDENT}, группа ${GROUP}, ${UNIVERSITY}`);
    console.log(`   Middleware: logger + compression + rateLimiter + errorHandler`);
    console.log(`   Тест ошибок: /error  /async-error`);
});