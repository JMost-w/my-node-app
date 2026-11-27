// server.js — Express + REST API книг
const express = require('express');
const path = require('path');
const booksStore = require('./books');

const app = express();
const PORT = 3000;

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

// ---------- Middleware ----------
app.use(express.json());                            // парсинг JSON-тела
app.use(express.static(path.join(__dirname, 'public')));

// ---------- HTML ----------
function htmlTemplate(title, content) {
    return `<!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link rel="stylesheet" href="/style.css">
    </head>
    <body>
        <div class="container">
            ${content}
            <footer>${STUDENT}, группа ${GROUP}, ${UNIVERSITY}</footer>
        </div>
    </body>
    </html>`;
}

app.get('/', (req, res) => {
    const content = `
        <h1>Лабораторная работа №16 — Задание 2</h1>
        <h2>Группа: ${GROUP}</h2>
        <p><strong>Студент:</strong> ${STUDENT}</p>
        <p><strong>Текущая дата и время:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        <h3>REST API книг:</h3>
        <ul>
            <li><a href="/api/books">GET /api/books</a> — все книги</li>
            <li><a href="/api/books/1">GET /api/books/1</a> — книга по ID</li>
            <li><a href="/api/books/search?author=Толстой">GET /api/books/search?author=Толстой</a> — поиск</li>
            <li><code>POST /api/books</code> — создать</li>
            <li><code>PUT /api/books/:id</code> — обновить</li>
            <li><code>DELETE /api/books/:id</code> — удалить</li>
        </ul>
    `;
    res.send(htmlTemplate('Лабораторная работа №16', content));
});

// ---------- REST API ----------

// ВАЖНО: search ДО /:id
app.get('/api/books/search', (req, res, next) => {
    try {
        res.json(booksStore.searchByAuthor(req.query.author));
    } catch (e) { next(e); }
});

app.get('/api/books', (req, res) => {
    res.json(booksStore.getAll());
});

app.get('/api/books/:id', (req, res, next) => {
    try {
        res.json(booksStore.getById(req.params.id));
    } catch (e) { next(e); }
});

app.post('/api/books', (req, res, next) => {
    try {
        res.status(201).json(booksStore.create(req.body));
    } catch (e) { next(e); }
});

app.put('/api/books/:id', (req, res, next) => {
    try {
        res.json(booksStore.update(req.params.id, req.body));
    } catch (e) { next(e); }
});

app.delete('/api/books/:id', (req, res, next) => {
    try {
        const removed = booksStore.remove(req.params.id);
        res.json({ message: `Книга "${removed.title}" удалена`, id: removed.id });
    } catch (e) { next(e); }
});

// ---------- 404 ----------
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Маршрут не найден', path: req.path });
    }
    res.status(404).send(htmlTemplate('404', '<h1>404</h1><p>Страница не найдена</p>'));
});

// ---------- Централизованная обработка ошибок ----------
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const payload = { error: err.message, status };
    if (err.details) payload.details = err.details;
    res.status(status).json(payload);
});

// ---------- Запуск ----------
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
    console.log(`   Студент: ${STUDENT}, группа ${GROUP}, ${UNIVERSITY}`);
    console.log(`   API: /api/books`);
});