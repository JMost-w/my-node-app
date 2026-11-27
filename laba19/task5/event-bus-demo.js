// event-bus-demo.js — демонстрация EventBus
const { EventBus, GROUP } = require('./event-bus');

const bus = new EventBus();

console.log(`=== EventBus (группа ${GROUP}) ===`);

// ============================================================
//  1. ПРИОРИТЕТЫ
// ============================================================
console.log('\n--- Приоритеты ---');

bus.on('priority-test', () => console.log('[priority 0] Низкий приоритет'), 0);
bus.on('priority-test', () => console.log('[priority 10] Высокий приоритет'), 10);
bus.on('priority-test', () => console.log('[priority 5] Средний приоритет'), 5);

bus.emit('priority-test');

// ============================================================
//  2. WILDCARD
// ============================================================
console.log('\n--- Wildcard ---');

bus.onAny((event, args) => {
    console.log(`[onAny] Событие "${event}" с аргументами: ${JSON.stringify(args)}`);
});

bus.on('greet', (name) => console.log(`[greet] Привет, ${name}!`));
bus.on('info', (group) => console.log(`[info] Группа: ${group}`));

bus.emit('greet', 'Иван');
bus.emit('info', GROUP);

// ============================================================
//  3. ONCE-КЭШ
// ============================================================
console.log('\n--- Once-кэш ---');

let onceCount = 0;
bus.once('tick', (n) => {
    onceCount++;
    console.log(`[tick] Once-слушатель вызван: ${n}`);
}, 100);

for (let i = 1; i <= 3; i++) {
    console.log(`[tick] Вызов ${i}`);
    bus.emit('tick', i);
}
console.log(`once-слушатель вызван: ${onceCount} раз`);

// ============================================================
//  4. ОБРАБОТКА ОШИБОК
// ============================================================
console.log('\n--- Обработка ошибок ---');

// error-слушатель с высоким приоритетом
bus.on('error', (err, event) => {
    console.log(`[ERROR-HANDLER] [${GROUP}] ${event}: ${err.message}`);
}, 100);

bus.on('test', () => {
    throw new Error('Сломался слушатель test');
});

bus.on('test2', () => {
    throw new Error('Сломался слушатель test2');
});

bus.emit('test');
bus.emit('test2');

// ============================================================
//  5. МЕТРИКИ
// ============================================================
console.log('\n--- Метрики ---');
const metrics = bus.getMetrics();
for (const [event, count] of Object.entries(metrics.events)) {
    const errors = metrics.errors[event] ? ` (${metrics.errors[event]} ошибок)` : '';
    console.log(`${event}: ${count} вызовов${errors}`);
}
console.log(`Всего событий: ${metrics.total}`);
console.log(`\nJSON для /metrics:`);
console.log(JSON.stringify(metrics, null, 2));

// ============================================================
//  6. ЭКСПОРТ ДЛЯ HTTP-СЕРВЕРА
// ============================================================
module.exports = bus;