// stream-transform.js — Transform-потоки, Object Mode, async iterators
const { Readable, Writable, Transform } = require('stream');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

// ============================================================
//  1. UpperCaseTransform — строки → UPPERCASE + префикс группы
// ============================================================
class UpperCaseTransform extends Transform {
    constructor() {
        super({ decodeStrings: false }); // важно: не превращать строки в Buffer
    }

    _transform(chunk, encoding, callback) {
        const text = chunk.toString('utf8');
        const result = `[${GROUP}] ${text.toUpperCase()}`;
        // Push в кодировке utf8, чтобы в 'data' получить строку
        this.push(Buffer.from(result, 'utf8'));
        callback();
    }
}

// ============================================================
//  2. JsonParserTransform — строки с JSON → объекты (objectMode)
// ============================================================
class JsonParserTransform extends Transform {
    constructor() {
        super({ readableObjectMode: true }); // на выходе — объекты
    }

    _transform(chunk, encoding, callback) {
        try {
            const obj = JSON.parse(chunk.toString('utf8'));
            this.push(obj);
            callback();
        } catch (err) {
            callback(err);
        }
    }
}

// ============================================================
//  3. FilterTransform — фильтрация объектов по условию
// ============================================================
class FilterTransform extends Transform {
    constructor(predicate) {
        super({ objectMode: true }); // и вход, и выход — объекты
        this.predicate = predicate;
    }

    _transform(obj, encoding, callback) {
        if (this.predicate(obj)) {
            this.push(obj);
        }
        callback();
    }
}

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
function section(title) {
    console.log(`\n=== ${title} ===`);
}

// ============================================================
//  1. ДЕМОНСТРАЦИЯ UpperCaseTransform
// ============================================================
async function demoUpperCase() {
    section('Демонстрация Transform-потока');

    const inputs = [
        `группа ббмо-01-23`,
        `студент иванов`
    ];

    for (const text of inputs) {
        console.log(`Вход: "${text}"`);
        await new Promise((resolve, reject) => {
            const upper = new UpperCaseTransform();
            upper.on('data', (chunk) => {
                console.log(`Выход: "${chunk.toString('utf8')}"`);
            });
            upper.on('end', resolve);
            upper.on('error', reject);
            upper.end(Buffer.from(text, 'utf8'));
        });
    }
}

// ============================================================
//  2. ДЕМОНСТРАЦИЯ Object Mode + JsonParser + Filter
// ============================================================
async function demoObjectMode() {
    section('Демонстрация Object Mode');

    // Входные JSON-строки (по одной на строку)
    const students = [
        { id: 1, name: 'Иван', group: GROUP },
        { id: 2, name: 'Мария', group: '402' },
        { id: 3, name: 'Петр', group: GROUP }
    ];

    // Сначала покажем "сырые" объекты
    for (const s of students) {
        console.log(`[OBJECT] ${JSON.stringify(s)}`);
    }

    // Теперь прогоним через JsonParserTransform → FilterTransform
    const jsonStrings = students.map(s => JSON.stringify(s));

    const readable = Readable.from(jsonStrings);

    const parser = new JsonParserTransform();
    const filter = new FilterTransform(obj => obj.group === GROUP);

    const results = [];

    await new Promise((resolve, reject) => {
        readable
            .pipe(parser)
            .pipe(filter)
            .on('data', (obj) => results.push(obj))
            .on('end', resolve)
            .on('error', reject);
    });

    console.log(`\nПосле фильтрации (только группа ${GROUP}):`);
    for (const obj of results) {
        console.log(`[OBJECT] ${JSON.stringify(obj)}`);
    }
}

// ============================================================
//  3. ДЕМОНСТРАЦИЯ async iterator (for await ... of)
// ============================================================
async function demoAsyncIterator() {
    section('Демонстрация async iterator');

    // Создаём Readable, который генерирует 3 чанка
    let counter = 0;
    const readable = new Readable({
        read() {
            counter++;
            if (counter <= 3) {
                this.push(Buffer.from(`Данные ${counter}`, 'utf8'));
            } else {
                this.push(null);
            }
        }
    });

    // Читаем через for await ... of — императивный стиль
    let chunkNumber = 0;
    for await (const chunk of readable) {
        chunkNumber++;
        console.log(`[ASYNC] Получен чанк ${chunkNumber}: "${chunk.toString('utf8')}"`);
    }
    console.log('[ASYNC] Поток завершён');
}

// ============================================================
//  4. ЦЕПОЧКА TRANSFORM: readable → UpperCase → Filter → Writable
// ============================================================
async function demoChain() {
    section('Цепочка Transform');

    console.log(`Читаем → UpperCase → Filter → Записываем`);

    // Генерируем 10 строк
    const lines = [];
    for (let i = 1; i <= 10; i++) {
        // Чётные — содержат "ГРУППА 401", нечётные — "ГРУППА 402"
        const group = i % 2 === 0 ? GROUP : '402';
        lines.push(`строка ${i} группа ${group}`);
    }

    const readable = Readable.from(lines);

    // UpperCase — делает строки большими
    const upper = new Transform({
        transform(chunk, encoding, callback) {
            callback(null, chunk.toString('utf8').toUpperCase());
        }
    });

    // Filter — оставляет только строки с группой 401
    const filter = new Transform({
        transform(chunk, encoding, callback) {
            const text = chunk.toString('utf8');
            if (text.includes(GROUP)) {
                callback(null, chunk);
            } else {
                callback(); // не пропускаем дальше
            }
        }
    });

    // Writable — собирает результаты
    const results = [];
    const writable = new Writable({
        write(chunk, encoding, callback) {
            results.push(chunk.toString('utf8'));
            callback();
        }
    });

    await new Promise((resolve, reject) => {
        readable
            .pipe(upper)
            .pipe(filter)
            .pipe(writable)
            .on('finish', resolve)
            .on('error', reject);
    });

    console.log(`\nРезультат (${results.length} строк):`);
    results.forEach(r => console.log(`  ${r}`));

    console.log(`\n✔ Обработано ${lines.length} строк, отфильтровано ${lines.length - results.length}`);
}

// ============================================================
//  ЗАПУСК
// ============================================================
(async () => {
    try {
        await demoUpperCase();
        await demoObjectMode();
        await demoAsyncIterator();
        await demoChain();
        console.log('\n✅ Все демонстрации завершены');
    } catch (err) {
        console.error('Ошибка:', err);
        process.exit(1);
    }
})();