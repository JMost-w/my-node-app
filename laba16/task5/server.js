// server.js — Express + JWT + Swagger + кэш
const express = require('express');
const path = require('path');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');

const booksStore = require('./books');
const auth = require('./auth');
const fileLogger = require('./logger');
const logger = require('./middleware/logger');
const createRateLimiter = require('./middleware/rateLimiter');
const { cacheMiddleware, invalidateCache } = require('./middleware/cache');
const { HttpError, notFound, errorHandler } = require('./middleware/errorHandler');
const swaggerSpec = require('./swagger');

const app = express();
const PORT = 3000;
const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';

// ---------- Middleware ----------
app.use(logger);
app.use(compression());
app.use(createRateLimiter({ windowMs: 60_000, max: 100 }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

// ============================================================
//  AUTH
// ============================================================
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Регистрация
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, example: user@lib.com }
 *               password: { type: string, example: secret123 }
 *               name: { type: string, example: Иван }
 *     responses:
 *       201: { description: Пользователь создан }
 *       409: { description: Email занят }
 */
app.post('/auth/register', (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) throw new HttpError(400, 'Поля email, password, name обязательны');
    const user = auth.register({ email, password, name });
    fileLogger.info('Регистрация', { user });
    res.status(201).json({ message: 'Регистрация успешна', user });
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Вход и получение JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: admin@lib.com }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200: { description: JWT токен }
 *       401: { description: Неверные данные }
 */
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw new HttpError(400, 'Поля email, password обязательны');
    const result = auth.login({ email, password });
    fileLogger.info('Логин', { email });
    res.json(result);
});

// ============================================================
//  BOOKS (JWT)
// ============================================================
/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: Список книг с фильтрацией
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: author, schema: { type: string } }
 *       - { in: query, name: year, schema: { type: integer } }
 *       - { in: query, name: genre, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: page, schema: { type: integer } }
 *     responses:
 *       200: { description: Список книг }
 */
app.get('/api/books', auth.authenticate, cacheMiddleware, (req, res) => {
    res.json(booksStore.list(req.query));
});

app.get('/api/books/stats', auth.authenticate, cacheMiddleware, (req, res) => {
    res.json(booksStore.stats());
});

app.get('/api/books/available', auth.authenticate, cacheMiddleware, (req, res) => {
    const { data } = booksStore.list({ available: 'true', limit: 100 });
    res.json({ data, meta: { total: data.length } });
});

app.get('/api/books/export', auth.authenticate, (req, res) => {
    const format = req.query.format || 'csv';
    if (format === 'json') return res.json(booksStore.list({}));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="books.csv"');
    res.send(booksStore.exportCSV());
});

app.post('/api/books/import', auth.authenticate, auth.requireAdmin, (req, res) => {
    const csv = req.body?.csv || req.body?.data;
    if (!csv) throw new HttpError(400, 'Передайте CSV в поле "csv"');
    const result = booksStore.importCSV(csv);
    invalidateCache();
    res.json(result);
});

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Книга по ID с отзывами
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Книга }
 *       404: { description: Не найдена }
 */
app.get('/api/books/:id', auth.authenticate, (req, res) => {
    res.json(booksStore.getById(req.params.id));
});

app.get('/api/books/:id/recommendations', auth.authenticate, (req, res) => {
    res.json(booksStore.recommendations(req.params.id));
});

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Добавить книгу (только админ)
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, author, year]
 *             properties:
 *               title: { type: string }
 *               author: { type: string }
 *               year: { type: integer }
 *               genre: { type: string }
 *               isbn: { type: string }
 *               totalCopies: { type: integer }
 *     responses:
 *       201: { description: Создана }
 *       403: { description: Только админ }
 */
app.post('/api/books', auth.authenticate, auth.requireAdmin, (req, res) => {
    const book = booksStore.create(req.body);
    invalidateCache();
    res.status(201).json(book);
});

app.put('/api/books/:id', auth.authenticate, auth.requireAdmin, (req, res) => {
    const book = booksStore.update(req.params.id, req.body);
    invalidateCache();
    res.json(book);
});

app.delete('/api/books/:id', auth.authenticate, auth.requireAdmin, (req, res) => {
    const removed = booksStore.remove(req.params.id);
    invalidateCache();
    res.json({ message: `Книга "${removed.title}" удалена`, id: removed.id });
});

/**
 * @swagger
 * /api/books/{id}/reviews:
 *   post:
 *     summary: Добавить отзыв
 *     tags: [Reviews]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [readerName, rating]
 *             properties:
 *               readerName: { type: string }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               text: { type: string }
 *     responses:
 *       201: { description: Отзыв добавлен }
 */
app.post('/api/books/:id/reviews', auth.authenticate, (req, res) => {
    const review = booksStore.addReview(req.params.id, req.body);
    invalidateCache();
    res.status(201).json(review);
});

// ============================================================
//  ADMIN
// ============================================================
app.get('/api/admin/users', auth.authenticate, auth.requireAdmin, (req, res) => {
    res.json(auth.users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role })));
});

// ============================================================
//  HTML
// ============================================================
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
    <title>Лабораторная работа №16 — Задание 5</title>
    <link rel="stylesheet" href="/style.css"></head>
    <body><div class="container">
    <h1>Лабораторная работа №16 — Задание 5</h1>
    <h2>Группа: ${GROUP}</h2>
    <p><strong>Студент:</strong> ${STUDENT}</p>
    <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
    <h3>Маршруты:</h3>
    <ul>
        <li><a href="/api-docs">/api-docs</a> — Swagger</li>
        <li><code>POST /auth/register</code>, <code>POST /auth/login</code></li>
        <li><code>GET /api/books</code> (JWT)</li>
        <li><code>GET /api/books/stats</code>, <code>/available</code>, <code>/export</code></li>
    </ul>
    <p>Админ: <code>admin@lib.com</code> / <code>admin123</code></p>
    </div></body></html>`);
});

// ============================================================
//  ОШИБКИ
// ============================================================
app.use(notFound);
app.use(errorHandler);

// ============================================================
//  ЗАПУСК
// ============================================================
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
    console.log(`   Swagger: http://localhost:${PORT}/api-docs`);
    console.log(`   Студент: ${STUDENT}, группа ${GROUP}`);
    console.log(`   Админ: admin@lib.com / admin123`);
});