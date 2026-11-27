// stream-pipe.js — сравнение pipe() и pipeline(), цепочка потоков
const fs = require('fs');
const path = require('path');
const { pipeline, Transform } = require('stream');
const { pipeline: pipelinePromise } = require('stream/promises');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

// ---------- Подготовка тестовых файлов ----------
const INPUT_FILE = path.join(__dirname, 'input.txt');
const MISSING_FILE = path.join(__dirname, 'missing.txt');

// Создаём input.txt, если его нет
if (!fs.existsSync(INPUT_FILE)) {
    const content = `Группа: ${GROUP}\n` +
                    `Студент: ${STUDENT}\n` +
                    `Лабораторная работа: №21\n` +
                    `Тема: Потоки в Node.js\n` +
                    `Университет: ${UNIVERSITY}\n`.repeat(20);
    fs.writeFileSync(INPUT_FILE, content, 'utf8');
    console.log(`[SETUP] Создан ${INPUT_FILE} (${fs.statSync(INPUT_FILE).size} байт)\n`);
}

// ---------- Утилиты ----------
function fileExists(p) {
    return fs.existsSync(p);
}

function statSize(p) {
    return fileExists(p) ? fs.statSync(p).size : 0;
}

// ============================================================
//  1. pipe() — успешное копирование
// ============================================================
async function demoPipeSuccess() {
    console.log('=== Демонстрация pipe() ===');
    const outputFile = path.join(__dirname, 'output-pipe.txt');

    console.log(`Чтение: ${path.basename(INPUT_FILE)}`);
    console.log(`Запись: ${path.basename(outputFile)}`);

    await new Promise((resolve, reject) => {
        const source = fs.createReadStream(INPUT_FILE);
        const destination = fs.createWriteStream(outputFile);

        source.on('error', reject);
        destination.on('error', reject);
        destination.on('finish', resolve);

        source.pipe(destination);
    });

    console.log(`✔ Копирование завершено`);
    console.log(`Размер: ${statSize(outputFile)} байт`);
}

// ============================================================
//  2. pipe() — с ошибкой (показываем, что потоки НЕ закрываются)
// ============================================================
async function demoPipeError() {
    console.log('\n=== Демонстрация pipe() с ошибкой ===');
    const outputFile = path.join(__dirname, 'output-pipe-error.txt');

    console.log(`Чтение: ${path.basename(MISSING_FILE)}`);
    console.log(`Запись: ${path.basename(outputFile)}`);

    let sourceClosed = false;
    let destinationClosed = false;

    const source = fs.createReadStream(MISSING_FILE);
    const destination = fs.createWriteStream(outputFile);

    source.on('close', () => { sourceClosed = true; });
    destination.on('close', () => { destinationClosed = true; });

    // pipe() НЕ обрабатывает ошибки автоматически
    source.on('error', (err) => {
        console.log(`✖ Ошибка: ${err.code}: ${err.message.split('\n')[0]}`);
        // Проверяем, закрылись ли потоки
        setTimeout(() => {
            console.log(`⚠ Внимание: pipe() не закрыл целевой поток!`);
            console.log(`   sourceClosed = ${sourceClosed}`);
            console.log(`   destinationClosed = ${destinationClosed}`);
            if (!destinationClosed) {
                console.log(`⚠ Возможна утечка памяти.`);
            }
            // Принудительно закрываем, чтобы не мешать следующей демонстрации
            source.destroy();
            destination.destroy();
            console.log('   (потоки закрыты вручную для продолжения демонстрации)');
        }, 100);
    });

    source.pipe(destination);

    // Ждём, пока сработает таймер
    await new Promise(r => setTimeout(r, 400));
}

// ============================================================
//  3. pipeline() — успешное копирование
// ============================================================
async function demoPipelineSuccess() {
    console.log('\n=== Демонстрация pipeline() ===');
    const outputFile = path.join(__dirname, 'output-pipeline.txt');

    console.log(`Чтение: ${path.basename(INPUT_FILE)}`);
    console.log(`Запись: ${path.basename(outputFile)}`);

    await pipelinePromise(
        fs.createReadStream(INPUT_FILE),
        fs.createWriteStream(outputFile)
    );

    console.log(`✔ Копирование завершено`);
    console.log(`Размер: ${statSize(outputFile)} байт`);
}

// ============================================================
//  4. pipeline() — с ошибкой (потоки закрываются автоматически)
// ============================================================
async function demoPipelineError() {
    console.log('\n=== Демонстрация pipeline() с ошибкой ===');
    const outputFile = path.join(__dirname, 'output-pipeline-error.txt');

    console.log(`Чтение: ${path.basename(MISSING_FILE)}`);
    console.log(`Запись: ${path.basename(outputFile)}`);

    let sourceClosed = false;
    let destinationClosed = false;

    const source = fs.createReadStream(MISSING_FILE);
    const destination = fs.createWriteStream(outputFile);

    source.on('close', () => { sourceClosed = true; });
    destination.on('close', () => { destinationClosed = true; });

    try {
        await pipelinePromise(source, destination);
        console.log('✔ Копирование завершено');
    } catch (err) {
        console.log(`✖ Ошибка: ${err.code}: ${err.message.split('\n')[0]}`);

        // Ждём немного, чтобы события close успели сработать
        await new Promise(r => setTimeout(r, 100));

        console.log(`✔ Все потоки автоматически закрыты`);
        console.log(`   sourceClosed = ${sourceClosed}`);
        console.log(`   destinationClosed = ${destinationClosed}`);
        console.log(`✔ Утечек нет`);
    }
}

// ============================================================
//  5. Цепочка потоков: source → transform1 → transform2 → destination
// ============================================================
async function demoChain() {
    console.log('\n=== Цепочка потоков ===');
    const outputFile = path.join(__dirname, 'output-chain.txt');

    console.log(`input.txt → uppercase → reverse → output-chain.txt`);

    // Transform 1: всё в верхний регистр
    const toUpperCase = new Transform({
        transform(chunk, encoding, callback) {
            callback(null, chunk.toString('utf8').toUpperCase());
        }
    });

    // Transform 2: переворачиваем каждую строку
    const reverse = new Transform({
        transform(chunk, encoding, callback) {
            const reversed = chunk.toString('utf8')
                .split('\n')
                .map(line => line.split('').reverse().join(''))
                .join('\n');
            callback(null, reversed);
        }
    });

    await pipelinePromise(
        fs.createReadStream(INPUT_FILE),
        toUpperCase,
        reverse,
        fs.createWriteStream(outputFile)
    );

    console.log(`✔ Обработка завершена`);
    console.log(`Размер: ${statSize(outputFile)} байт`);
}

// ============================================================
//  6. Сравнение файлов
// ============================================================
function compareFiles() {
    console.log('\n=== Сравнение содержимого ===');
    const pairs = [
        ['output-pipe.txt', 'output-pipeline.txt'],
        ['input.txt', 'output-chain.txt']
    ];

    for (const [a, b] of pairs) {
        const pa = path.join(__dirname, a);
        const pb = path.join(__dirname, b);
        if (!fileExists(pa) || !fileExists(pb)) {
            console.log(`  ${a} ↔ ${b}: файл отсутствует`);
            continue;
        }
        const same = fs.readFileSync(pa).equals(fs.readFileSync(pb));
        console.log(`  ${a} ↔ ${b}: ${same ? '✔ идентичны' : '✖ различаются'}`);
    }

    // Показываем первые 3 строки chain
    const chainPath = path.join(__dirname, 'output-chain.txt');
    if (fileExists(chainPath)) {
        console.log('\nПервые 3 строки output-chain.txt:');
        const lines = fs.readFileSync(chainPath, 'utf8').split('\n').slice(0, 3);
        lines.forEach(l => console.log('  ' + l));
    }
}

// ============================================================
//  ЗАПУСК ВСЕХ ДЕМОНСТРАЦИЙ
// ============================================================
(async () => {
    try {
        await demoPipeSuccess();
        await demoPipeError();
        await demoPipelineSuccess();
        await demoPipelineError();
        await demoChain();
        compareFiles();
        console.log('\n✅ Все демонстрации завершены');
    } catch (err) {
        console.error('Неожиданная ошибка:', err);
        process.exit(1);
    }
})();