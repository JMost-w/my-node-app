// server.js — точка входа
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

// ============================================================
//  MIDDLEWARE
// ============================================================
app.use(logger);
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    },
    level: 6
}));
app.use(createRateLimiter({ windowMs: 60_000, max: 100 }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
//  HTML-СТРАНИЦЫ
// ============================================================
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
            <footer>Максим Мазан Борисович, группа 401, БТК</footer>
        </div>
    </body>
    </html>`;
}

app.get('/', (req, res) => {
    const content = `
        <h1>Лабораторная работа №16</h1>
        <h2>Группа: 401</h2>
        <p><strong>Студент:</strong> Максим Мазан Борисович</p>
        <p><strong>Текущая дата и время:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        <p class="greeting">Добро пожаловать! 👋</p>
        <h3>Доступные маршруты:</h3>
        <ul>
            <li><a href="/">/</a> — Главная</li>
            <li><a href="/about">/about</a> — О разработчике</li>
            <li><a href="/contacts">/contacts</a> — Контакты</li>
            <li><a href="/api/books">/api/books</a> — Книги</li>
            <li><a href="/api/books/stats">/api/books/stats</a> — Статистика</li>
            <li><a href="/api/books/1">/api/books/1</a> — Книга по ID</li>
            <li><a href="/api/books?author=Толстой">/api/books?author=Толстой</a></li>
            <li><a href="/api/books?sort=-year&limit=5&page=1">/api/books?sort=-year&limit=5&page=1</a></li>
            <li><a href="/error">/error</a> — Тест ошибки</li>
            <li><a href="/async-error">/async-error</a> — Тест асинхронной ошибки</li>
        </ul>
    `;
    res.send(htmlTemplate('Главная — Лабораторная работа №16', content));
});

app.get('/about', (req, res) => {
    const content = `
        <h1>О разработчике</h1>
        <p><strong>Студент:</strong> Максим Мазан Борисович</p>
        <p><strong>Группа:</strong> 401</p>
        <p><strong>ВУЗ:</strong> БТК</p>
        <p><strong>Специальность:</strong> Безопасность информационных систем</p>
        <p>Данный сервер разработан в рамках выполнения лабораторной работы №16.</p>
    `;
    res.send(htmlTemplate('О разработчике', content));
});

app.get('/contacts', (req, res) => {
    const content = `
        <h1>Контактная информация</h1>
        <ul>
            <li><strong>Студент:</strong> Максим Мазан Борисович</li>
            <li><strong>Группа:</strong> 401</li>
            <li><strong>Email:</strong> mazan@example.com</li>
            <li><strong>Телефон:</strong> +7 (999) 123-45-67</li>
            <li><strong>Telegram:</strong> @mazan</li>
            <li><strong>GitHub:</strong> github.com/mazan</li>
        </ul>
    `;
    res.send(htmlTemplate('Контакты', content));
});

// ============================================================
//  REST API КНИГ
// ============================================================

// Статистика — ДО /:id
app.get('/api/books/stats', (req, res) => {
    res.json(booksStore.stats());
});

// Поиск по автору — ДО /:id
app.get('/api/books/search', (req, res) => {
    res.json(booksStore.search(req.query.author));
});

// Список с фильтрами, сортировкой, пагинацией
app.get('/api/books', (req, res) => {
    const { data, meta } = booksStore.list(req.query);
    res.json({ data, meta });
});

// Конкретная книга
app.get('/api/books/:id', (req, res) => {
    res.json(booksStore.getById(req.params.id));
});

// Создание
app.post('/api/books', (req, res) => {
    const book = booksStore.create(req.body);
    res.status(201).json(book);
});

// Обновление
app.put('/api/books/:id', (req, res) => {
    res.json(booksStore.update(req.params.id, req.body));
});

// Удаление
app.delete('/api/books/:id', (req, res) => {
    const removed = booksStore.remove(req.params.id);
    res.json({
        message: `Книга "${removed.title}" (ID=${removed.id}) успешно удалена`,
        id: removed.id
    });
});

// ============================================================
//  ТЕСТОВЫЕ МАРШРУТЫ ДЛЯ ОШИБОК
// ============================================================
app.get('/error', (req, res) => {
    throw new HttpError(500, 'Тестовая синхронная ошибка');
});

function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get('/async-error', asyncHandler(async (req, res) => {
    await new Promise((_, reject) =>
        setTimeout(() => reject(new HttpError(503, 'Тестовая асинхронная ошибка')), 300)
    );
}));

// ============================================================
//  ОБРАБОТКА ОШИБОК
// ============================================================
app.use(notFound);
app.use(errorHandler);

// ============================================================
//  ЗАПУСК
// ============================================================
app.listen(PORT, () => {
    const msg = `✅ Сервер запущен: http://localhost:${PORT}`;
    console.log(msg);
    console.log(`   Студент: Максим Мазан Борисович, группа 401, БТК`);
    console.log(`   Логи: ${fileLogger.LOG_FILE}`);
    console.log(`   API: /api/books, /api/books/:id, /api/books/stats`);
    console.log(`   Параметры: ?author= ?year= ?yearFrom=&yearTo= ?search= ?sort= ?limit=&page=`);
    fileLogger.info('Сервер запущен', { port: PORT });
});