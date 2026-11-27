// events-class.js — собственный класс, расширяющий EventEmitter
const EventEmitter = require('events');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';

// ============================================================
//  КЛАСС DatabaseConnection extends EventEmitter
// ============================================================
class DatabaseConnection extends EventEmitter {
    constructor(name = 'default') {
        super(); // обязательно — инициализация EventEmitter
        this.name = name;
        this.connected = false;
    }

    connect() {
        this.emit('connecting', { name: this.name });
        // имитация задержки
        setTimeout(() => {
            this.connected = true;
            this.emit('connect', { name: this.name, at: new Date() });
        }, 100);
        return this;
    }

    query(sql) {
        if (!this.connected) {
            this.emit('error', new Error('Нет соединения с БД'));
            return this;
        }

        this.emit('query', { sql, at: new Date() });

        // имитация результата
        let result;
        if (/^select/i.test(sql)) {
            result = { rows: 50, message: '50 записей' };
        } else if (/^insert/i.test(sql)) {
            result = { rows: 1, message: '1 запись добавлена' };
        } else if (/^update/i.test(sql)) {
            result = { rows: 3, message: '3 записи обновлены' };
        } else if (/^delete/i.test(sql)) {
            result = { rows: 2, message: '2 записи удалены' };
        } else {
            result = { rows: 0, message: 'OK' };
        }

        setTimeout(() => {
            this.emit('query-result', { sql, result });
        }, 50);
        return this;
    }

    close() {
        this.emit('closing', { name: this.name });
        setTimeout(() => {
            this.connected = false;
            this.emit('close', { name: this.name, at: new Date() });
        }, 50);
        return this;
    }

    // Метод для демонстрации ошибки
    fail(message = 'Connection timeout') {
        this.emit('error', new Error(message));
        return this;
    }
}

// ============================================================
//  ДЕМОНСТРАЦИЯ
// ============================================================
console.log(`=== DatabaseConnection (группа ${GROUP}) ===`);
console.log(`Студент: ${STUDENT}\n`);

const db = new DatabaseConnection('main');

// ---------- Подписка на все события ----------
db.on('connecting', ({ name }) => {
    console.log(`[EVENT] Подключение к БД "${name}"...`);
});

db.on('connect', ({ name }) => {
    console.log(`[EVENT] Соединение с "${name}" установлено`);
});

db.on('query', ({ sql }) => {
    console.log(`[EVENT] Выполнение запроса: ${sql}`);
});

db.on('query-result', ({ result }) => {
    console.log(`[EVENT] Результат: ${result.message}`);
});

db.on('closing', ({ name }) => {
    console.log(`[EVENT] Закрытие соединения "${name}"`);
});

db.on('close', ({ name }) => {
    console.log(`[EVENT] Соединение с "${name}" закрыто`);
});

// ---------- Обработчик ошибок ----------
db.on('error', (err) => {
    console.log(`[EVENT] Ошибка: ${err.message}`);
});

// ============================================================
//  ПОСЛЕДОВАТЕЛЬНОСТЬ ОПЕРАЦИЙ
// ============================================================
async function run() {
    db.connect();

    // ждём подключения
    await new Promise(r => db.once('connect', r));

    // выполняем запросы
    db.query('SELECT * FROM students');
    await new Promise(r => db.once('query-result', r));

    db.query('INSERT INTO students VALUES (...)');
    await new Promise(r => db.once('query-result', r));

    // закрываем
    db.close();
    await new Promise(r => db.once('close', r));

    // ============================================================
    //  ДЕМОНСТРАЦИЯ ОШИБКИ
    // ============================================================
    console.log('\n=== Демонстрация ошибки ===');
    db.fail('Connection timeout');
    console.log('(со слушателем error — процесс не упал)');
}

run();