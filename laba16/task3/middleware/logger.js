// middleware/logger.js — логирование каждого запроса
function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function logger(req, res, next) {
    const start = process.hrtime.bigint();
    const startedAt = new Date();

    // Логируем, когда ответ уже отправлен (statusCode финальный)
    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        console.log(
            `[${formatDate(startedAt)}] ${req.method} ${req.originalUrl} ` +
            `${res.statusCode} - ${durationMs.toFixed(0)}ms`
        );
    });

    next();
}

module.exports = logger;