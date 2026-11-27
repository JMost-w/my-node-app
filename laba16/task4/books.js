// books.js — CRUD + фильтры + пагинация + сортировка + статистика
const { HttpError } = require('./middleware/errorHandler');
const fileLogger = require('./logger');

let books = [
    { id: 1, title: 'Война и мир', author: 'Толстой', year: 1869, genre: 'роман' },
    { id: 2, title: 'Преступление и наказание', author: 'Достоевский', year: 1866, genre: 'роман' },
    { id: 3, title: 'Мастер и Маргарита', author: 'Булгаков', year: 1967, genre: 'роман' },
    { id: 4, title: 'Анна Каренина', author: 'Толстой', year: 1877, genre: 'роман' },
    { id: 5, title: 'Идиот', author: 'Достоевский', year: 1869, genre: 'роман' },
    { id: 6, title: 'Отцы и дети', author: 'Тургенев', year: 1862, genre: 'роман' },
    { id: 7, title: 'Мёртвые души', author: 'Гоголь', year: 1842, genre: 'поэма' },
    { id: 8, title: 'Ревизор', author: 'Гоголь', year: 1836, genre: 'комедия' },
    { id: 9, title: 'Герой нашего времени', author: 'Лермонтов', year: 1840, genre: 'роман' },
    { id: 10, title: 'Евгений Онегин', author: 'Пушкин', year: 1833, genre: 'роман в стихах' },
    { id: 11, title: 'Тихий Дон', author: 'Шолохов', year: 1940, genre: 'роман-эпопея' },
    { id: 12, title: 'Собачье сердце', author: 'Булгаков', year: 1925, genre: 'повесть' }
];

let nextId = 13;

// ---------- Валидация ----------
function validateBook(data, { partial = false } = {}) {
    const errors = [];
    if (!partial || data.title !== undefined) {
        if (typeof data.title !== 'string' || !data.title.trim())
            errors.push('Поле "title" обязательно и должно быть непустой строкой');
    }
    if (!partial || data.author !== undefined) {
        if (typeof data.author !== 'string' || !data.author.trim())
            errors.push('Поле "author" обязательно и должно быть непустой строкой');
    }
    if (!partial || data.year !== undefined) {
        const y = data.year;
        if (typeof y !== 'number' || !Number.isInteger(y) || y < 0 || y > new Date().getFullYear())
            errors.push(`Поле "year" должно быть целым числом от 0 до ${new Date().getFullYear()}`);
    }
    if (data.genre !== undefined) {
        if (typeof data.genre !== 'string' || !data.genre.trim())
            errors.push('Поле "genre" должно быть непустой строкой');
    }
    return errors;
}

function parseId(raw) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1)
        throw new HttpError(400, 'ID должен быть положительным целым числом');
    return id;
}

function parseIntParam(raw, name) {
    if (raw === undefined) return undefined;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0)
        throw new HttpError(400, `Параметр "${name}" должен быть неотрицательным целым числом`);
    return n;
}

// ---------- Фильтрация, сортировка, пагинация ----------
function applyQuery(list, query) {
    let result = [...list];

    if (query.author) {
        const a = String(query.author).toLowerCase();
        result = result.filter(b => b.author.toLowerCase().includes(a));
    }
    if (query.year !== undefined) {
        const y = parseIntParam(query.year, 'year');
        result = result.filter(b => b.year === y);
    }
    const yearFrom = parseIntParam(query.yearFrom, 'yearFrom');
    const yearTo   = parseIntParam(query.yearTo,   'yearTo');
    if (yearFrom !== undefined) result = result.filter(b => b.year >= yearFrom);
    if (yearTo   !== undefined) result = result.filter(b => b.year <= yearTo);

    if (query.search) {
        const s = String(query.search).toLowerCase();
        result = result.filter(b =>
            b.title.toLowerCase().includes(s) || b.author.toLowerCase().includes(s)
        );
    }

    if (query.sort) {
        const raw = String(query.sort);
        const desc = raw.startsWith('-');
        const field = desc ? raw.slice(1) : raw;
        const allowed = ['title', 'author', 'year', 'genre', 'id'];
        if (!allowed.includes(field)) {
            throw new HttpError(400,
                `Сортировка по полю "${field}" невозможна. Допустимые: ${allowed.join(', ')}`);
        }
        result.sort((a, b) => {
            const va = a[field], vb = b[field];
            let cmp;
            if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
            else cmp = String(va).localeCompare(String(vb), 'ru');
            return desc ? -cmp : cmp;
        });
    }

    const total = result.length;
    const limit = parseIntParam(query.limit, 'limit');
    const page  = parseIntParam(query.page,  'page') || 1;

    let data = result;
    let meta = { total };
    if (limit && limit > 0) {
        const start = (page - 1) * limit;
        data = result.slice(start, start + limit);
        meta = { total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    return { data, meta };
}

// ---------- Статистика ----------
function buildStats() {
    if (books.length === 0) {
        return { totalBooks: 0, byAuthor: {}, byGenre: {}, oldestYear: null, newestYear: null };
    }
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
}

// ---------- CRUD ----------
function isDuplicate(title, author, excludeId = null) {
    return books.some(b =>
        b.id !== excludeId &&
        b.title.toLowerCase() === title.toLowerCase() &&
        b.author.toLowerCase() === author.toLowerCase()
    );
}

module.exports = {
    list: (query) => applyQuery(books, query),

    getById: (rawId) => {
        const id = parseId(rawId);
        const book = books.find(b => b.id === id);
        if (!book) throw new HttpError(404, `Книга с ID=${id} не найдена`);
        return book;
    },

    search: (author) => {
        if (!author || !author.trim())
            throw new HttpError(400, 'Параметр "author" обязателен');
        return books.filter(b => b.author.toLowerCase().includes(author.toLowerCase()));
    },

    stats: () => buildStats(),

    create: (data) => {
        const errors = validateBook(data || {});
        if (errors.length) {
            const e = new HttpError(400, 'Невалидные данные');
            e.details = errors;
            throw e;
        }
        const title  = data.title.trim();
        const author = data.author.trim();
        if (isDuplicate(title, author)) {
            throw new HttpError(409, `Книга "${title}" автора ${author} уже существует`);
        }
        const book = {
            id: nextId++,
            title, author, year: data.year,
            genre: data.genre ? data.genre.trim() : 'не указан'
        };
        books.push(book);
        fileLogger.info('Создана книга', { book });
        return book;
    },

    update: (rawId, data) => {
        const id = parseId(rawId);
        const book = books.find(b => b.id === id);
        if (!book) throw new HttpError(404, `Книга с ID=${id} не найдена`);
        if (!data || Object.keys(data).length === 0)
            throw new HttpError(400, 'Тело запроса пустое');
        const errors = validateBook(data, { partial: true });
        if (errors.length) {
            const e = new HttpError(400, 'Невалидные данные');
            e.details = errors;
            throw e;
        }
        const newTitle  = data.title  !== undefined ? data.title.trim()  : book.title;
        const newAuthor = data.author !== undefined ? data.author.trim() : book.author;
        if (isDuplicate(newTitle, newAuthor, id)) {
            throw new HttpError(409, `Книга "${newTitle}" автора ${newAuthor} уже существует`);
        }
        if (data.title  !== undefined) book.title  = newTitle;
        if (data.author !== undefined) book.author = newAuthor;
        if (data.year   !== undefined) book.year   = data.year;
        if (data.genre  !== undefined) book.genre  = data.genre.trim();
        fileLogger.info('Обновлена книга', { book });
        return book;
    },

    remove: (rawId) => {
        const id = parseId(rawId);
        const idx = books.findIndex(b => b.id === id);
        if (idx === -1) throw new HttpError(404, `Книга с ID=${id} не найдена`);
        const removed = books.splice(idx, 1)[0];
        fileLogger.info('Удалена книга', { book: removed });
        return removed;
    }
};