// stream-writable.js — Writable-поток, обработка чанков, backpressure
const { Writable } = require('stream');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

// ---------- Чанки для записи ----------
const CHUNKS = [
    `Группа: ${GROUP}`,
    `Студент: ${STUDENT}`,
    `Лабораторная работа: №21`,
    `Тема: Потоки в Node.js`
];

// ---------- Статистика ----------
let writtenChunks = 0;
let writtenBytes = 0;

// ---------- Создание Writable-потока ----------
const writable = new Writable({
    // Маленький буфер — чтобы продемонстрировать backpressure
    highWaterMark: 16,

    write(chunk, encoding, callback) {
        const text = chunk.toString('utf8');

        // Эмуляция «медленной» обработки (запись в файл, БД и т.п.)
        setTimeout(() => {
            writtenChunks++;
            writtenBytes += chunk.length;
            console.log(`[WRITE] ${text}`);
            // callback() — сообщаем, что чанк обработан
            callback();
        }, 100);
    }
});

// ============================================================
//  ДЕМОНСТРАЦИЯ
// ============================================================
console.log('=== Демонстрация Writable-потока ===');

// ---------- События ----------
writable.on('drain', () => {
    console.log('[DRAIN] Буфер освобождён, продолжаем запись');
});

writable.on('finish', () => {
    console.log('[FINISH] Все данные записаны');
    console.log(`Всего записано: ${writtenChunks} чанка`);
    console.log(`Общий размер: ${writtenBytes} байт`);
});

writable.on('error', (err) => {
    console.error('[ERROR]', err.message);
});

// ============================================================
//  ЗАПИСЬ ЧАНКОВ С ОБРАБОТКОЙ BACKPRESSURE
// ============================================================
async function writeAll() {
    for (let i = 0; i < CHUNKS.length; i++) {
        const chunk = CHUNKS[i];
        const ok = writable.write(Buffer.from(chunk, 'utf8'));

        console.log(`write() вернул: ${ok}${ok ? '' : ' ← буфер переполнен!'}`);

        // Если буфер переполнен — ждём drain
        if (!ok) {
            await new Promise(resolve => writable.once('drain', resolve));
        }
    }

    // Сигнал «больше данных не будет» — после обработки всех чанков
    // сработает событие finish
    writable.end();
}

writeAll();