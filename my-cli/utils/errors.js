// utils/errors.js — фатальные ошибки и разница dev/prod
const chalk = require('chalk');

function handleFatal(err) {
    const isDev = process.env.NODE_ENV !== 'production';
    const message = err && err.message ? err.message : String(err);

    process.stderr.write(chalk.red('✖ Ошибка: ' + message) + '\n');

    if (isDev && err && err.stack) {
        process.stderr.write(chalk.gray(err.stack) + '\n');
    } else {
        process.stderr.write(chalk.gray('Подробности скрыты. Запустите с NODE_ENV=development для стектрейса.') + '\n');
    }

    process.exit(1);
}

// Обёртка для команд: ловит throw и передаёт в handleFatal
function withErrorHandling(fn) {
    return async (...args) => {
        try {
            await fn(...args);
        } catch (err) {
            handleFatal(err);
        }
    };
}

module.exports = { handleFatal, withErrorHandling };