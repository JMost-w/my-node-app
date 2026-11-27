// events-basic.js — демонстрация EventEmitter
const EventEmitter = require('events');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';

const emitter = new EventEmitter();

// ---------- Слушатели ----------
emitter.on('greet', (name) => {
    console.log(`[greet] Привет, ${name}!`);
});

emitter.on('info', () => {
    console.log(`[info] Группа: ${GROUP}`);
    console.log(`[info] Студент: ${STUDENT}`);
});

emitter.on('bye', () => {
    console.log(`[bye] До свидания!`);
});

// ---------- Демонстрация ----------
console.log('=== Демонстрация EventEmitter ===');

emitter.emit('greet', 'Иван');
emitter.emit('info');
emitter.emit('bye');

// ---------- Возвращаемое значение emit() ----------
console.log('');
const unknownResult = emitter.emit('unknown');
console.log(`Событие "unknown" без слушателей: ${unknownResult}`);

const greetResult = emitter.emit('greet', 'Пётр');
console.log(`Событие "greet" со слушателями: ${greetResult}`);