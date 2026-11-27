// events-crash.js — что будет, если НЕ подписаться на error
const EventEmitter = require('events');

const emitter = new EventEmitter();

// Слушатель НЕ добавлен — Node.js выбросит исключение
console.log('Перед emit("error")');
emitter.emit('error', new Error('Тестовая ошибка без слушателя'));
console.log('После emit("error") — эта строка не выполнится');