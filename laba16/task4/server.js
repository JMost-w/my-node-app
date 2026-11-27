// server.js — Express + фильтры + статистика + логирование
const express = require('express');
const path = require('path');
const compression = require('compression');

const booksStore = require('./books');
const fileLogger = require('./logger');
const logger = require('./middleware/logger');
const createRateLimiter = require('./middleware/rateLimiter');
const { HttpError, notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = 3000;

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

// ---------- Middleware ----------
app.use(logger);
app.use(compression({ level: 6 }));
app.use(createRateLimiter({ windowMs: 60_000, max: 100 }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- HTML ----------
function htmlTemplate(title, content) {
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
    <title>${title}</title><link rel="stylesheet" href="/style.css"></head>
    <body><div class="container">${content}
        <footer>${STUDENT}, группа ${GROUP}, ${UNIVERSITY}</footer>
    </div></body></html>`;
}

app.get('/', (req, res) => {
    res.send(htmlTemplate('Лабораторная работа №16 — Задание 4', `
        <h1>Лабораторная работа №16 — Задание 4</h1>
        <h2>Группа: ${GROUP}</h2>
        <p><strong>Студент:</strong> ${STUDENT}</p>
        <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        <h3>REST API:</h3>
        <ul>
            <li><a href="/api/books">/api/books</a> — все книги</li>
            <li><a href="/api/books/stats">/api/books/stats</a> — статистика</li>
            <li><a href="/api/books?author=Толстой">?author=Толстой</a></li>
            <li><a href="/api/books?yearFrom=1800&yearTo=1900">?yearFrom=1800&yearTo=1900</a></li>
            <li><a href="/api/books?sort=-year&limit=5">?sort=-year&limit=5</a></li>
            <li><a href="/api/books?search=война">?search=война</a></li>
        </ul>
    `));
});

// ---------- REST API ----------
app.get('/api/books/stats', (req, res) => res.json(booksStore.stats()));

app.get('/api/books/search', (req, res) => {
    res.json(booksStore.search(req.query.author));
});

app.get('/api/books', (req, res) => {
    const { data, meta } = booksStore.list(req.query);
    res.json({ data, meta });
});

app.get('/api/books/:id', (req, res) => res.json(booksStore.getById(req.params.id)));

app.post('/api/books', (req, res) => {
    res.status(201).json(booksStore.create(req.body));
});

app.put('/api/books/:id', (req, res) => {
    res.json(booksStore.update(req.params.id, req.body));
});

app.delete('/api/books/:id', (req, res) => {
    const removed = booksStore.remove(req.params.id);
    res.json({ message: `Книга "${removed.title}" удалена`, id: removed.id });
});

// ---------- Ошибки ----------
app.use(notFound);
app.use(errorHandler);

// ---------- Запуск ----------
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
    console.log(`   Студент: ${STUDENT}, группа ${GROUP}, ${UNIVERSITY}`);
    console.log(`   Логи: ${fileLogger.LOG_FILE}`);
    console.log(`   Параметры: ?author= ?year= ?yearFrom=&yearTo= ?search= ?sort= ?limit=&page=`);
});