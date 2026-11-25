// middleware/cache.js — простой in-memory кэш для GET-запросов
const cache = new Map(); // key -> { data, expiresAt }
const TTL_MS = 5 * 60 * 1000; // 5 минут

function cacheMiddleware(req, res, next) {
    if (req.method !== 'GET') return next();

    const key = req.originalUrl;
    const entry = cache.get(key);

    if (entry && entry.expiresAt > Date.now()) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(entry.data);
    }

    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json.bind(res);
    res.json = (body) => {
        cache.set(key, { data: body, expiresAt: Date.now() + TTL_MS });
        return originalJson(body);
    };

    next();
}

function invalidateCache() {
    cache.clear();
}

module.exports = { cacheMiddleware, invalidateCache };