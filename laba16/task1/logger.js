// logger.js — запись логов в файл logs/app.log
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Создаём папку logs, если её нет
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function timestamp() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Записать строку в лог-файл
 * @param {string} level  INFO | WARN | ERROR
 * @param {string} message
 * @param {object} [meta]  дополнительные данные
 */
function log(level, message, meta) {
    const line = `[${timestamp()}] [${level}] ${message}` +
        (meta ? ' ' + JSON.stringify(meta) : '') + '\n';

    // Пишем в файл асинхронно (не блокируем event loop)
    fs.appendFile(LOG_FILE, line, err => {
        if (err) console.error('Ошибка записи лога:', err.message);
    });

    // Дублируем в консоль
    const consoleFn = level === 'ERROR' ? console.error :
                      level === 'WARN'  ? console.warn  : console.log;
    consoleFn(line.trim());
}

module.exports = {
    info:  (msg, meta) => log('INFO',  msg, meta),
    warn:  (msg, meta) => log('WARN',  msg, meta),
    error: (msg, meta) => log('ERROR', msg, meta),
    LOG_FILE
};