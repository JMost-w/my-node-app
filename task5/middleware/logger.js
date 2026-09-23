'use strict';

// Форматирование даты в "YYYY-MM-DD HH:mm:ss"
function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    ' ' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds())
  );
}

/**
 * Middleware логирования запросов.
 * Логирует: время начала, метод, путь, статус ответа и время выполнения.
 */
async function logger(ctx, next) {
  const start = Date.now();
  const startTime = new Date();

  // Пробрасываем запрос дальше по цепочке middleware
  await next();

  const ms = Date.now() - start;
  const timestamp = formatDate(startTime);

  console.log(
    `[${timestamp}] ${ctx.method} ${ctx.url} - ${ms}ms ` +
    `→ ${ctx.status}`
  );
}

module.exports = logger;