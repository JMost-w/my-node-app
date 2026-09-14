const fs = require('fs');
const path = require('path');
const util = require('util');

const writeFileAsync = util.promisify(fs.writeFile);
const readFileAsync = util.promisify(fs.readFile);
const unlinkAsync = util.promisify(fs.unlink);
const mkdirAsync = util.promisify(fs.mkdir);

const TEST_DIR = './perf-test-data';
const FILE_COUNT = 100;
const CONTENT = 'x'.repeat(1024); // 1 КБ содержимого

// ============================================================
// УТИЛИТЫ
// ============================================================

function ensureDir() {
    if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
    }
}

function cleanDir() {
    if (fs.existsSync(TEST_DIR)) {
        const files = fs.readdirSync(TEST_DIR);
        files.forEach((f) => fs.unlinkSync(path.join(TEST_DIR, f)));
    }
}

function formatTime(ms) {
    return `${ms.toFixed(2)} мс`;
}

// ============================================================
// 1. СИНХРОННЫЙ ПОДХОД
// ============================================================

function testSync() {
    return new Promise((resolve) => {
        console.log('\n--- 1. СИНХРОННЫЙ (fs.writeFileSync) ---');
        cleanDir();

        const start = process.hrtime.bigint();

        for (let i = 0; i < FILE_COUNT; i++) {
            const filePath = path.join(TEST_DIR, `sync-${i}.txt`);
            fs.writeFileSync(filePath, CONTENT, 'utf8');
        }

        for (let i = 0; i < FILE_COUNT; i++) {
            const filePath = path.join(TEST_DIR, `sync-${i}.txt`);
            fs.readFileSync(filePath, 'utf8');
        }

        const end = process.hrtime.bigint();
        const elapsedMs = Number(end - start) / 1_000_000;

        console.log(`Записано и прочитано файлов: ${FILE_COUNT}`);
        console.log(`Время: ${formatTime(elapsedMs)}`);

        resolve(elapsedMs);
    });
}

// ============================================================
// 2. АСИНХРОННЫЙ ПОДХОД (КОЛБЭКИ)
// ============================================================

function writeFileCallback(filePath, content) {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, 'utf8', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function readFileCallback(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

function testCallbacks() {
    return new Promise(async (resolve) => {
        console.log('\n--- 2. АСИНХРОННЫЙ (КОЛБЭКИ) ---');
        cleanDir();

        const start = process.hrtime.bigint();

        // Последовательно, как в реальных колбэках
        for (let i = 0; i < FILE_COUNT; i++) {
            const filePath = path.join(TEST_DIR, `cb-${i}.txt`);
            await writeFileCallback(filePath, CONTENT);
        }

        for (let i = 0; i < FILE_COUNT; i++) {
            const filePath = path.join(TEST_DIR, `cb-${i}.txt`);
            await readFileCallback(filePath);
        }

        const end = process.hrtime.bigint();
        const elapsedMs = Number(end - start) / 1_000_000;

        console.log(`Записано и прочитано файлов: ${FILE_COUNT}`);
        console.log(`Время: ${formatTime(elapsedMs)}`);
        console.log(`(Последовательные колбэки — каждый ждёт предыдущего)`);

        resolve(elapsedMs);
    });
}

// ============================================================
// 3. АСИНХРОННЫЙ ПОДХОД (ПРОМИСЫ + ПАРАЛЛЕЛЬНО)
// ============================================================

async function testPromises() {
    console.log('\n--- 3. АСИНХРОННЫЙ (ПРОМИСЫ, ПАРАЛЛЕЛЬНО) ---');
    cleanDir();

    const start = process.hrtime.bigint();

    // Параллельная запись всех файлов
    await Promise.all(
        Array.from({ length: FILE_COUNT }, (_, i) => {
            const filePath = path.join(TEST_DIR, `promise-${i}.txt`);
            return writeFileAsync(filePath, CONTENT, 'utf8');
        })
    );

    // Параллельное чтение всех файлов
    await Promise.all(
        Array.from({ length: FILE_COUNT }, (_, i) => {
            const filePath = path.join(TEST_DIR, `promise-${i}.txt`);
            return readFileAsync(filePath, 'utf8');
        })
    );

    const end = process.hrtime.bigint();
    const elapsedMs = Number(end - start) / 1_000_000;

    console.log(`Записано и прочитано файлов: ${FILE_COUNT}`);
    console.log(`Время: ${formatTime(elapsedMs)}`);
    console.log(`(Параллельно — все операции запускаются одновременно)`);

    return elapsedMs;
}

// ============================================================
// 4. АСИНХРОННЫЙ ПОДХОД (ПРОМИСЫ + ПОСЛЕДОВАТЕЛЬНО)
// ============================================================

async function testPromisesSequential() {
    console.log('\n--- 4. АСИНХРОННЫЙ (ПРОМИСЫ, ПОСЛЕДОВАТЕЛЬНО) ---');
    cleanDir();

    const start = process.hrtime.bigint();

    for (let i = 0; i < FILE_COUNT; i++) {
        const filePath = path.join(TEST_DIR, `seq-${i}.txt`);
        await writeFileAsync(filePath, CONTENT, 'utf8');
    }

    for (let i = 0; i < FILE_COUNT; i++) {
        const filePath = path.join(TEST_DIR, `seq-${i}.txt`);
        await readFileAsync(filePath, 'utf8');
    }

    const end = process.hrtime.bigint();
    const elapsedMs = Number(end - start) / 1_000_000;

    console.log(`Записано и прочитано файлов: ${FILE_COUNT}`);
    console.log(`Время: ${formatTime(elapsedMs)}`);
    console.log(`(Последовательно через await)`);

    return elapsedMs;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

async function runAll() {
    ensureDir();

    console.log('============================================================');
    console.log('ИССЛЕДОВАНИЕ ПРОИЗВОДИТЕЛЬНОСТИ');
    console.log(`Файлов: ${FILE_COUNT}, размер каждого: 1 КБ`);
    console.log('============================================================');

    const results = {};

    results.sync = await testSync();
    results.callbacks = await testCallbacks();
    results.promisesParallel = await testPromises();
    results.promisesSequential = await testPromisesSequential();

    // Итоговая таблица
    console.log('\n============================================================');
    console.log('ИТОГОВАЯ ТАБЛИЦА');
    console.log('============================================================');
    console.log(`1. Синхронный:                ${formatTime(results.sync)}`);
    console.log(`2. Колбэки (последовательно): ${formatTime(results.callbacks)}`);
    console.log(`3. Промисы (последовательно): ${formatTime(results.promisesSequential)}`);
    console.log(`4. Промисы (параллельно):     ${formatTime(results.promisesParallel)}`);
    console.log('============================================================');

    // Выводы
    const fastest = Object.entries(results).sort((a, b) => a[1] - b[1])[0];
    const slowest = Object.entries(results).sort((a, b) => b[1] - a[1])[0];

    console.log('\n📊 ВЫВОДЫ:');
    console.log(`   Самый быстрый: ${fastest[0]} (${formatTime(fastest[1])})`);
    console.log(`   Самый медленный: ${slowest[0]} (${formatTime(slowest[1])})`);
    console.log('');
    console.log('   Почему параллельные промисы быстрее:');
    console.log('   → Все операции запускаются одновременно,');
    console.log('     и время ожидания I/O перекрывается.');
    console.log('');
    console.log('   Почему синхронный подход медленнее:');
    console.log('   → Блокирует Event Loop, не даёт обрабатывать');
    console.log('     другие задачи, каждая операция ждёт завершения.');
    console.log('');
    console.log('   Почему колбэки (последовательно) медленнее промисов:');
    console.log('   → Каждая операция ждёт завершения предыдущей,');
    console.log('     хотя Event Loop при этом свободен.');

    // Очистка
    cleanDir();
    console.log('\n✅ Тестовые файлы удалены.');
}

runAll().catch((err) => {
    console.error('❌ Ошибка:', err);
    cleanDir();
});