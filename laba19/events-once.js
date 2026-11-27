// events-once.js — on vs once, управление подписками, порядок вызова
const EventEmitter = require('events');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';

const emitter = new EventEmitter();

// ============================================================
//  1. СРАВНЕНИЕ on И once
// ============================================================
console.log('=== Сравнение on и once ===');

let onCount = 0;
let onceCount = 0;

const onListener = (n) => {
    onCount++;
    console.log(`[tick #${n}] on-слушатель`);
};

const onceListener = (n) => {
    onceCount++;
    console.log(`[tick #${n}] once-слушатель`);
};

emitter.on('tick', onListener);
emitter.once('tick', onceListener);

emitter.emit('tick', 1);
emitter.emit('tick', 2);
emitter.emit('tick', 3);

console.log(`on-слушатель вызван: ${onCount} раза`);
console.log(`once-слушатель вызван: ${onceCount} раз`);

// ============================================================
//  2. УПРАВЛЕНИЕ ПОДПИСКАМИ
// ============================================================
console.log('\n=== Управление подписками ===');

const emitter2 = new EventEmitter();

const listenerA = () => console.log('  [A] сработал');
const listenerB = () => console.log('  [B] сработал');
const listenerC = () => console.log('  [C] сработал');

// addListener — синоним on
emitter2.addListener('test', listenerA);
emitter2.on('test', listenerB);
emitter2.on('test', listenerC);

console.log(`Слушателей до удаления: ${emitter2.listenerCount('test')}`);

// Массив слушателей
const listeners = emitter2.listeners('test');
console.log(`Массив слушателей: [${listeners.map(l => l.name || 'anonymous').join(', ')}]`);

// Удаляем один
emitter2.removeListener('test', listenerB);
console.log(`Слушателей после удаления одного: ${emitter2.listenerCount('test')}`);

// Проверяем, что B больше не вызывается
emitter2.emit('test');

// Удаляем все
emitter2.removeAllListeners('test');
console.log(`Слушателей после removeAllListeners: ${emitter2.listenerCount('test')}`);

// ============================================================
//  3. ПОРЯДОК ВЫЗОВА СЛУШАТЕЛЕЙ
// ============================================================
console.log('\n=== Порядок вызова ===');

const emitter3 = new EventEmitter();

// Слушатели вызываются в порядке добавления
emitter3.on('order', () => console.log(`1. Первый слушатель (группа ${GROUP})`));
emitter3.on('order', () => console.log('2. Второй слушатель'));
emitter3.on('order', () => console.log('3. Третий слушатель'));

emitter3.emit('order');