// books.js — CRUD + отзывы + экспорт/импорт + рекомендации
const { HttpError } = require('./middleware/errorHandler');
const fileLogger = require('./logger');
const { generateBooks } = require('./dataGenerator');
const Joi = require('joi');

let books = generateBooks(100, 401);
let nextId = 101;

const bookSchema = Joi.object({
    title: Joi.string().min(1).max(200).required(),
    author: Joi.string().min(1).max(100).required(),
    year: Joi.number().integer().min(0).max(new Date().getFullYear()).required(),
    genre: Joi.string().min(1).max(50).default('не указан'),
    isbn: Joi.string().optional(),
    totalCopies: Joi.number().integer().min(1).default(1),
    availableCopies: Joi.number().integer().min(0).optional()
});

const bookUpdateSchema = Joi.object({
    title: Joi.string().min(1).max(200),
    author: Joi.string().min(1).max(100),
    year: Joi.number().integer().min(0).max(new Date().getFullYear()),
    genre: Joi.string().min(1).max(50),
    isbn: Joi.string(),
    totalCopies: Joi.number().integer().min(1),
    availableCopies: Joi.number().integer().min(0)
}).min(1);

const reviewSchema = Joi.object({
    readerName: Joi.string().min(1).max(100).required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    text: Joi.string().max(1000).allow('', null).default('')
});

function validate(schema, data) {
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
        const e = new HttpError(400, 'Невалидные данные');
        e.details = error.details.map(d => d.message);
        throw e;
    }
    return value;
}

function isValidISBN(isbn) {
    const digits = String(isbn).replace(/[-\s]/g, '');
    if (!/^\d{13}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10 === parseInt(digits[12]);
}

function applyQuery(list, query) {
    let result = [...list];
    if (query.author) {
        const a = String(query.author).toLowerCase();
        result = result.filter(b => b.author.toLowerCase().includes(a));
    }
    if (query.year !== undefined) {
        const y = Number(query.year);
        if (Number.isInteger(y)) result = result.filter(b => b.year === y);
    }
    if (query.genre) {
        const g = String(query.genre).toLowerCase();
        result = result.filter(b => b.genre && b.genre.toLowerCase().includes(g));
    }
    if (query.search) {
        const s = String(query.search).toLowerCase();
        result = result.filter(b =>
            b.title.toLowerCase().includes(s) ||
            b.author.toLowerCase().includes(s) ||
            (b.isbn && b.isbn.includes(s))
        );
    }
    if (query.available === 'true') result = result.filter(b => b.availableCopies > 0);

    if (query.sort) {
        const raw = String(query.sort);
        const desc = raw.startsWith('-');
        const field = desc ? raw.slice(1) : raw;
        const allowed = ['title','author','year','genre','id'];
        if (!allowed.includes(field)) throw new HttpError(400, `Сортировка по "${field}" невозможна`);
        result.sort((a, b) => {
            const va = a[field], vb = b[field];
            let cmp;
            if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
            else cmp = String(va).localeCompare(String(vb), 'ru');
            return desc ? -cmp : cmp;
        });
    }

    const total = result.length;
    const limit = query.limit !== undefined ? Number(query.limit) : undefined;
    const page = query.page !== undefined ? Number(query.page) : 1;
    let data = result;
    let meta = { total };
    if (limit && limit > 0) {
        const start = (page - 1) * limit;
        data = result.slice(start, start + limit);
        meta = { total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    return { data, meta };
}

module.exports = {
    list: (query) => applyQuery(books, query),

    getById: (rawId) => {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'ID должен быть целым числом');
        const book = books.find(b => b.id === id);
        if (!book) throw new HttpError(404, `Книга с ID=${id} не найдена`);
        return book;
    },

    stats: () => {
        const byAuthor = {}, byGenre = {};
        let oldest = Infinity, newest = -Infinity;
        for (const b of books) {
            byAuthor[b.author] = (byAuthor[b.author] || 0) + 1;
            if (b.genre) byGenre[b.genre] = (byGenre[b.genre] || 0) + 1;
            if (b.year < oldest) oldest = b.year;
            if (b.year > newest) newest = b.year;
        }
        return {
            totalBooks: books.length, byAuthor, byGenre,
            oldestYear: oldest === Infinity ? null : oldest,
            newestYear: newest === -Infinity ? null : newest
        };
    },

    create: (raw) => {
        const data = validate(bookSchema, raw);
        if (data.isbn && !isValidISBN(data.isbn))
            throw new HttpError(400, 'Невалидный ISBN');
        if (books.some(b =>
            b.title.toLowerCase() === data.title.toLowerCase() &&
            b.author.toLowerCase() === data.author.toLowerCase()
        )) throw new HttpError(409, 'Книга с таким названием и автором уже существует');

        const book = { id: nextId++, ...data, isbn: data.isbn || null, reviews: [] };
        if (book.availableCopies === undefined) book.availableCopies = book.totalCopies;
        books.push(book);
        fileLogger.info('Создана книга', { book });
        return book;
    },

    update: (rawId, raw) => {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'ID должен быть целым числом');
        const book = books.find(b => b.id === id);
        if (!book) throw new HttpError(404, `Книга с ID=${id} не найдена`);
        const data = validate(bookUpdateSchema, raw);
        if (data.isbn && !isValidISBN(data.isbn)) throw new HttpError(400, 'Невалидный ISBN');
        Object.assign(book, data);
        if (book.availableCopies > book.totalCopies) book.availableCopies = book.totalCopies;
        fileLogger.info('Обновлена книга', { book });
        return book;
    },

    remove: (rawId) => {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'ID должен быть целым числом');
        const idx = books.findIndex(b => b.id === id);
        if (idx === -1) throw new HttpError(404, `Книга с ID=${id} не найдена`);
        const removed = books.splice(idx, 1)[0];
        fileLogger.info('Удалена книга', { book: removed });
        return removed;
    },

    addReview: (rawId, raw) => {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'ID должен быть целым числом');
        const book = books.find(b => b.id === id);
        if (!book) throw new HttpError(404, `Книга с ID=${id} не найдена`);
        const review = validate(reviewSchema, raw);
        const newReview = {
            id: (book.reviews.length ? Math.max(...book.reviews.map(r => r.id)) : 0) + 1,
            ...review, createdAt: new Date().toISOString()
        };
        book.reviews.push(newReview);
        fileLogger.info('Добавлен отзыв', { bookId: id, review: newReview });
        return newReview;
    },

    exportCSV: () => {
        const headers = ['id','title','author','year','genre','isbn','totalCopies','availableCopies'];
        const escape = (v) => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [headers.join(',')];
        for (const b of books) lines.push(headers.map(h => escape(b[h])).join(','));
        return lines.join('\n');
    },

    importCSV: (csvText) => {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length < 2) throw new HttpError(400, 'CSV пуст');
        const headers = lines[0].split(',').map(h => h.trim());
        for (const r of ['title','author','year']) {
            if (!headers.includes(r)) throw new HttpError(400, `В CSV нет колонки "${r}"`);
        }
        let imported = 0;
        const errors = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const row = {};
            headers.forEach((h, idx) => row[h] = values[idx]);
            try {
                const data = validate(bookSchema, {
                    title: row.title, author: row.author,
                    year: Number(row.year), genre: row.genre || 'не указан',
                    isbn: row.isbn || undefined,
                    totalCopies: row.totalCopies ? Number(row.totalCopies) : 1
                });
                books.push({
                    id: nextId++, ...data, isbn: data.isbn || null,
                    availableCopies: data.totalCopies, reviews: []
                });
                imported++;
            } catch (e) {
                errors.push({ line: i + 1, error: e.message });
            }
        }
        fileLogger.info('Импорт CSV', { imported, errors: errors.length });
        return { imported, errors };
    },

    recommendations: (rawId) => {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'ID должен быть целым числом');
        const source = books.find(b => b.id === id);
        if (!source) throw new HttpError(404, `Книга с ID=${id} не найдена`);
        return books
            .filter(b => b.id !== id && b.genre === source.genre)
            .sort((a, b) => Math.abs(a.year - source.year) - Math.abs(b.year - source.year))
            .slice(0, 10);
    }
};