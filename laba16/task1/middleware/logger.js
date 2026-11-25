// middleware/logger.js — логгирование каждого запроса в файл и консоль
const fileLogger = require('../logger');

function pad(n) {
    return String(n).padStart(2, '0');
}

function formatDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function logger(req, res, next) {
    const start = process.hrtime.bigint();
    const startedAt = new Date();

    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;

        const line = `[${formatDate(startedAt)}] ${req.method} ${req.originalUrl} ` +
                     `${res.statusCode} - ${durationMs.toFixed(0)}ms`;

        // В консоль — кратко
        console.log(line);

        // В файл — с метаданными
        fileLogger.info('HTTP', {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            durationMs: Math.round(durationMs),
            ip: req.ip
        });
    });

    next();
}

module.exports = logger;