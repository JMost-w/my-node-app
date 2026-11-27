// server.js — HTTP-сервер, эмитит событие request и отдаёт /metrics
const http = require('http');
const os = require('os');
const { EventBus, GROUP } = require('./event-bus');

const bus = new EventBus();

// error-слушатель
bus.on('error', (err, event) => {
    console.error(`[ERROR-HANDLER] [${GROUP}] ${event}: ${err.message}`);
}, 100);

// Логируем каждый request через wildcard
bus.onAny((event, args) => {
    if (event === 'request') {
        const [req] = args;
        console.log(`[REQUEST] ${req.method} ${req.url}`);
    }
});

// Метрики системы через os
function systemMetrics() {
    const cpus = os.cpus();
    const total = os.totalmem();
    const free = os.freemem();
    return {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: cpus.length,
        cpuModel: cpus[0].model.trim(),
        ramTotalGB: (total / 1024 ** 3).toFixed(2),
        ramFreeGB: (free / 1024 ** 3).toFixed(2),
        ramUsedPercent: (((total - free) / total) * 100).toFixed(1),
        loadavg: os.loadavg().map(n => n.toFixed(2)),
        uptime: Math.floor(os.uptime())
    };
}

const server = http.createServer((req, res) => {
    // Эмитим request при каждом запросе
    bus.emit('request', req);

    if (req.url === '/metrics') {
        const payload = {
            ...bus.getMetrics(),
            system: systemMetrics()
        };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(payload, null, 2));
        return;
    }

    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
            <title>EventBus — Laba 19</title>
            <style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:20px}
            h1{color:#4a3f9f}code{background:#f0f0f0;padding:2px 6px;border-radius:4px}</style>
            </head><body>
            <h1>EventBus — группа ${GROUP}</h1>
            <p>Студент: Максим Мазан Борисович</p>
            <p><a href="/metrics">/metrics</a> — метрики EventBus + системы</p>
            <p>Сервер эмитит событие <code>request</code> при каждом запросе.</p>
            <footer>Максим Мазан Борисович, группа 401, БТК</footer>
            </body></html>
        `);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`✅ HTTP-сервер запущен: http://localhost:${PORT}`);
    console.log(`   Метрики: http://localhost:${PORT}/metrics`);
    console.log(`   Группа: ${GROUP}`);
    console.log(`   Студент: Максим Мазан Борисович, БТК`);
});