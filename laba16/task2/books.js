// books.js — данные и бизнес-логика книг
let books = [
    { id: 1, title: 'Война и мир', author: 'Толстой', year: 1869 },
    { id: 2, title: 'Преступление и наказание', author: 'Достоевский', year: 1866 },
    { id: 3, title: 'Мастер и Маргарита', author: 'Булгаков', year: 1967 }
];

let nextId = 4;

// ---------- Валидация ----------
function validateBook(data, { partial = false } = {}) {
    const errors = [];

    if (!partial || data.title !== undefined) {
        if (typeof data.title !== 'string' || !data.title.trim()) {
            errors.push('Поле "title" обязательно и должно быть непустой строкой');
        }
    }
    if (!partial || data.author !== undefined) {
        if (typeof data.author !== 'string' || !data.author.trim()) {
            errors.push('Поле "author" обязательно и должно быть непустой строкой');
        }
    }
    if (!partial || data.year !== undefined) {
        const y = data.year;
        if (typeof y !== 'number' || !Number.isInteger(y) || y < 0 || y > new Date().getFullYear()) {
            errors.push(`Поле "year" должно быть целым числом от 0 до ${new Date().getFullYear()}`);
        }
    }
    return errors;
}

function parseId(raw) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
        const e = new Error('ID должен быть положительным целым числом');
        e.status = 400;
        throw e;
    }
    return id;
}

// ---------- CRUD ----------
module.exports = {
    getAll: () => books,

    getById: (rawId) => {
        const id = parseId(rawId);
        const book = books.find(b => b.id === id);
        if (!book) {
            const e = new Error(`Книга с ID=${id} не найдена`);
            e.status = 404;
            throw e;
        }
        return book;
    },

    searchByAuthor: (author) => {
        if (!author || !author.trim()) {
            const e = new Error('Параметр "author" обязателен');
            e.status = 400;
            throw e;
        }
        return books.filter(b => b.author.toLowerCase().includes(author.toLowerCase()));
    },

    create: (data) => {
        const errors = validateBook(data || {});
        if (errors.length) {
            const e = new Error('Невалидные данные');
            e.status = 400;
            e.details = errors;
            throw e;
        }
        const book = {
            id: nextId++,
            title: data.title.trim(),
            author: data.author.trim(),
            year: data.year
        };
        books.push(book);
        return book;
    },

    update: (rawId, data) => {
        const id = parseId(rawId);
        const book = books.find(b => b.id === id);
        if (!book) {
            const e = new Error(`Книга с ID=${id} не найдена`);
            e.status = 404;
            throw e;
        }
        if (!data || Object.keys(data).length === 0) {
            const e = new Error('Тело запроса пустое');
            e.status = 400;
            throw e;
        }
        const errors = validateBook(data, { partial: true });
        if (errors.length) {
            const e = new Error('Невалидные данные');
            e.status = 400;
            e.details = errors;
            throw e;
        }
        if (data.title  !== undefined) book.title  = data.title.trim();
        if (data.author !== undefined) book.author = data.author.trim();
        if (data.year   !== undefined) book.year   = data.year;
        return book;
    },

    remove: (rawId) => {
        const id = parseId(rawId);
        const idx = books.findIndex(b => b.id === id);
        if (idx === -1) {
            const e = new Error(`Книга с ID=${id} не найдена`);
            e.status = 404;
            throw e;
        }
        const removed = books.splice(idx, 1)[0];
        return removed;
    }
};