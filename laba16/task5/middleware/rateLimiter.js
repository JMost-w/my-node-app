// middleware/rateLimiter.js — 100 запросов в минуту с одного IP
function createRateLimiter({ windowMs = 60_000, max = 100 } = {}) {
    const hits = new Map(); // ip -> { count, resetAt }

    // Раз в минуту чистим просроченные записи
    setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(ip);
        }
    }, windowMs).unref();

    return function rateLimiter(req, res, next) {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();

        let entry = hits.get(ip);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(ip, entry);
        }
        entry.count++;

        const remaining = Math.max(0, max - entry.count);
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

        // Информация о лимите в заголовках ответа
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

        if (entry.count > max) {
            res.setHeader('Retry-After', retryAfter);
            return res.status(429).json({
                error: 'Слишком много запросов. Попробуйте позже.',
                status: 429,
                retryAfter
            });
        }

        next();
    };
}

module.exports = createRateLimiter;