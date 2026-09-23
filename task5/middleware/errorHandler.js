'use strict';

/**
 * Глобальный обработчик ошибок.
 * Перехватывает любые исключения в downstream-middleware
 * и возвращает унифицированный JSON-ответ.
 */
async function errorHandler(ctx, next) {
  try {
    await next();

    // Если маршрут не найден и статус остался 404 —
    // формируем JSON-ответ вместо стандартного "Not Found"
    if (ctx.status === 404 && !ctx.body) {
      ctx.status = 404;
      ctx.body = {
        error: 'Маршрут не найден',
        status: 404,
        path: ctx.path,
      };
    }
  } catch (err) {
    // Определяем статус: из ошибки или 500 по умолчанию
    const status = err.status || err.statusCode || 500;

    ctx.status = status;
    ctx.type = 'application/json; charset=utf-8';
    ctx.body = {
      error: err.expose || status < 500
        ? err.message
        : 'Внутренняя ошибка сервера',
      status,
    };

    // Дублируем ошибку в консоль для отладки
    console.error(`❌ [${new Date().toISOString()}] Ошибка ${status}: ${err.message}`);
    if (status >= 500) {
      console.error(err.stack);
    }

    // Сообщаем Koa о проблеме (чтобы сработали глобальные листенеры)
    ctx.app.emit('error', err, ctx);
  }
}

module.exports = errorHandler;