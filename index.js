const http = require('http');
const EventEmitter = require('events');

class OrderHandler extends EventEmitter {
    processOrder(orderId) {
        this.emit('order:start', orderId);

        setTimeout(() => {
            this.emit('order:processing', orderId, 'Идёт обработка...');

            setTimeout(() => {
                const sum = Math.floor(Math.random() * 901) + 100;
                this.emit('order:complete', orderId, sum);
            }, 2000);
        }, 2000);
    }
}

function calculatePi(iterations = 1000000) {
    let sum = 0;
    for (let i = 0; i < iterations; i++) {
        const sign = i % 2 === 0 ? 1 : -1;
        sum += sign / (2 * i + 1);
    }
    return (4 * sum).toFixed(7);
}

class UserTracker extends EventEmitter {
    trackAction(userId, action, metadata) {
        this.emit('user:action', {
            userId: userId,
            action: action,
            timestamp: new Date().toISOString(),
            metadata: metadata,
            id: Math.random().toString(36).substr(2, 9)
        });
    }
}

class AppServer extends EventEmitter {
    constructor(orderHandler) {
        super();
        this.server = null;
        this.orderHandler = orderHandler;
    }

    start(port) {
        this.server = http.createServer((req, res) => {
            this.emit('request:received', {
                method: req.method,
                url: req.url
            });

            const orderMatch = req.url.match(/^\/order\/(\d+)$/);
            if (req.method === 'GET' && orderMatch) {
                const orderId = orderMatch[1];
                this.orderHandler.processOrder(orderId);
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Заказ #${orderId} принят в обработку\n`);
                return;
            }

            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Hello from EventEmitter Server!');
        });

        this.server.listen(port, () => {
            this.emit('server:started', port);
        });
    }

    stop() {
        if (this.server) {
            this.server.close(() => {
                this.emit('server:stopped');
            });
        }
    }
}

const orderHandler = new OrderHandler();
const app = new AppServer(orderHandler);

orderHandler.on('order:start', (orderId) => {
    console.log(`[order:start] Заказ #${orderId} начат`);
});

orderHandler.on('order:processing', (orderId, text) => {
    console.log(`[order:processing] Заказ #${orderId}: ${text}`);
});

orderHandler.on('order:complete', (orderId, sum) => {
    const pi = calculatePi();
    console.log(`💰 Заказ #${orderId} завершён на сумму ${sum} руб. PI = ${pi}`);
});

app.on('server:started', (port) => {
    console.log(`Сервер запущен на порту ${port}`);
});

app.on('request:received', ({ method, url }) => {
    console.log(`Получен запрос: ${method} ${url}`);
});

app.on('server:stopped', () => {
    console.log('Сервер остановлен');
});

app.start(3000);

const tracker = new UserTracker();

tracker.on('user:action', (event) => {
    console.log(`👤 Пользователь ${event.userId} совершил действие "${event.action}"`);
    console.log(`   Время: ${event.timestamp}`);
    console.log(`   ID события: ${event.id}`);
    console.log(`   Доп. данные: ${JSON.stringify(event.metadata)}`);
});

tracker.trackAction(1, 'login', { ip: '192.168.1.1', browser: 'Chrome' });
tracker.trackAction(42, 'purchase', { amount: 500, currency: 'BYN' });
tracker.trackAction(7, 'logout', { reason: 'timeout' });