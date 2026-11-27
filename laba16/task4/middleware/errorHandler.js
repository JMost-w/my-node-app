// middleware/errorHandler.js — централизованная обработка ошибок
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function notFound(req, res, next) {
    next(new HttpError(404, `Маршрут ${req.method} ${req.originalUrl} не найден`));
}

// Обработчик ошибок — обязательно 4 аргумента
function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    const status = err.status || err.statusCode || 500;
    const message = status === 500 ? 'Внутренняя ошибка сервера' : err.message;

    console.error(`❗ [${status}] ${req.method} ${req.originalUrl} — ${err.message}`);
    if (status >= 500) console.error(err.stack);

    // JSON для API, HTML для страниц
    if (req.path.startsWith('/api/') || req.accepts(['json', 'html']) === 'json') {
        const payload = { error: message, status };
        if (err.details) payload.details = err.details;
        return res.status(status).json(payload);
    }

    res.status(status).type('html').send(`
        <!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
        <title>Ошибка ${status}</title><link rel="stylesheet" href="/style.css"></head>
        <body><div class="container">
            <h1>Ошибка ${status}</h1>
            <p>${message}</p>
            <p><a href="/">← На главную</a></p>
            <footer>Максим Мазан Борисович, группа 401, БТК</footer>
        </div></body></html>
    `);
}

module.exports = { HttpError, notFound, errorHandler };