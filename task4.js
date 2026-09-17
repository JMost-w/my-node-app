// Подключаем необходимые модули
const fs = require('fs').promises;        // Для асинхронных операций (stat, writeFile)
const fsSync = require('fs');             // Для создания потоков (createReadStream/WriteStream)
const path = require('path');             // Работа с путями
const readline = require('readline');     // Построчное чтение потока

// ─────────────────────────── КОНФИГУРАЦИЯ ───────────────────────────
const VARIANT = 11;
const TOTAL_LINES = 100_000;              // Минимум 100 000 строк
const MIN_NUMBER = 1;
const MAX_NUMBER = 1000;
const HIGH_THRESHOLD = 500;               // Порог для варианта 11 (> 500)
const BUFFER_SIZE = 64 * 1024;            // 64 КБ — размер буфера потока

// Имена файлов
const DATA_FILE      = path.join(__dirname, `data_${VARIANT}.txt`);
const PROCESSED_FILE = path.join(__dirname, `processed_${VARIANT}.txt`);
const FILTERED_FILE  = path.join(__dirname, `filtered_${VARIANT}.txt`);

// ─────────────────────────── ТОЧКА ВХОДА ───────────────────────────
async function main() {
    const startTime = Date.now();

    try {
        // 1. Генерируем файл, если он не существует
        await ensureDataFileExists();

        // 2. Смотрим размер
        const stats = await fs.stat(DATA_FILE);
        console.log(`📊 Обработка файла: ${path.basename(DATA_FILE)}`);
        console.log(`Размер файла: ${formatSize(stats.size)}\n`);

        // 3. Обрабатываем через потоки
        const result = await processFileWithStreams(stats.size);

        // 4. Сохраняем результаты в processed_N.txt
        await saveResults(result);

        // 5. Выводим итоговую статистику
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        printSummary(result, elapsed);

    } catch (error) {
        console.error('\n❌ Ошибка:', error.message);
        process.exit(1);
    }
}

// ─────────────────────────── 1. ГЕНЕРАЦИЯ ───────────────────────────
/**
 * Проверяет наличие файла data_N.txt; если его нет — генерирует 100 000 строк.
 * Генерация тоже потоковая — не держим весь текст в памяти.
 */
async function ensureDataFileExists() {
    try {
        await fs.access(DATA_FILE);
        console.log(`ℹ Файл ${path.basename(DATA_FILE)} уже существует, генерация пропущена.\n`);
        return;
    } catch {
        console.log(`⚙ Генерация ${path.basename(DATA_FILE)} (${TOTAL_LINES.toLocaleString('en-US')} строк)...`);
    }

    // Поток записи с буфером 64 КБ
    const writeStream = fsSync.createWriteStream(DATA_FILE, {
        encoding: 'utf8',
        highWaterMark: BUFFER_SIZE
    });

    // Промис, который резолвится, когда поток допишет файл
    const finished = new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    // Пишем строки порциями, обрабатывая backpressure
    let buffer = '';
    for (let i = 1; i <= TOTAL_LINES; i++) {
        const randomNumber = Math.floor(Math.random() * (MAX_NUMBER - MIN_NUMBER + 1)) + MIN_NUMBER;
        buffer += `${i}, ${randomNumber}, Вариант ${VARIANT}\n`;

        // Сбрасываем буфер по 64 КБ, если поток не успевает
        if (buffer.length >= BUFFER_SIZE) {
            if (!writeStream.write(buffer)) {
                // Ждём события 'drain' — поток готов принять ещё данные
                await new Promise(resolve => writeStream.once('drain', resolve));
            }
            buffer = '';

            // Показываем прогресс генерации каждые 10%
            if (i % Math.floor(TOTAL_LINES / 10) === 0) {
                const percent = Math.round((i / TOTAL_LINES) * 100);
                process.stdout.write(`   Генерация: ${percent}%\r`);
            }
        }
    }

    // Дописываем остаток
    if (buffer.length > 0) {
        writeStream.write(buffer);
    }

    writeStream.end();
    await finished;

    console.log(`✓ Генерация завершена: ${path.basename(DATA_FILE)}\n`);
}

// ─────────────────────── 2. ПОТОКОВАЯ ОБРАБОТКА ───────────────────────
/**
 * Читает файл построчно через поток, собирает статистику.
 * Не загружает весь файл в память — работает с буфером 64 КБ.
 *
 * @param {number} totalSize - размер файла в байтах (для расчёта прогресса)
 * @returns {Promise<Object>} объект с результатами
 */
function processFileWithStreams(totalSize) {
    return new Promise((resolve, reject) => {
        // Поток чтения с буфером 64 КБ
        const readStream = fsSync.createReadStream(DATA_FILE, {
            encoding: 'utf8',
            highWaterMark: BUFFER_SIZE
        });

        // readline разбивает поток на строки без загрузки в память целиком
        const rl = readline.createInterface({
            input: readStream,
            crlfDelay: Infinity    // корректно обрабатывает \r\n
        });

        // Поток записи для отфильтрованных строк (числа > 500) — вариант 11
        const filteredStream = fsSync.createWriteStream(FILTERED_FILE, {
            encoding: 'utf8',
            highWaterMark: BUFFER_SIZE
        });

        // Аккумуляторы статистики
        let lineCount    = 0;
        let sum          = 0;
        let min          = Infinity;
        let max          = -Infinity;
        let bytesRead    = 0;         // для подсчёта прогресса
        let lastPercent  = 0;
        let filteredCount = 0;

        // Обработка каждой строки
        rl.on('line', (line) => {
            // Приблизительно оцениваем прочитанные байты (учёт \n)
            bytesRead += Buffer.byteLength(line, 'utf8') + 1;

            // Парсим строку формата "1, 847, Вариант 11"
            // Разбиваем по запятой, берём второй элемент — число
            const parts = line.split(',');
            if (parts.length < 2) return;   // пропускаем битые строки

            const num = Number(parts[1].trim());
            if (!Number.isFinite(num)) return; // пропускаем невалидные

            // Обновляем аккумуляторы
            lineCount++;
            sum += num;
            if (num < min) min = num;
            if (num > max) max = num;

            // Доп. условие варианта 11: сохраняем строки с числом > 500
            if (num > HIGH_THRESHOLD) {
                filteredCount++;
                if (!filteredStream.write(line + '\n')) {
                    // Пауза для обработки backpressure
                    rl.pause();
                    filteredStream.once('drain', () => rl.resume());
                }
            }

            // Прогресс каждые 10% — по прочитанным байтам
            const percent = Math.min(100, Math.floor((bytesRead / totalSize) * 100));
            const rounded = Math.floor(percent / 10) * 10;
            if (rounded >= lastPercent + 10) {
                lastPercent = rounded;
                process.stdout.write(
                    `⏳ Прогресс: ${rounded}% (${lineCount.toLocaleString('en-US')} строк обработано)\n`
                );
            }
        });

        // Ошибки чтения
        rl.on('error', reject);
        readStream.on('error', reject);
        filteredStream.on('error', reject);

        // Конец потока — собираем результаты
        rl.on('close', () => {
            filteredStream.end();

            // Финальный прогресс
            process.stdout.write(`⏳ Прогресс: 100% (${lineCount.toLocaleString('en-US')} строк обработано)\n`);

            // Ждём, пока filteredStream допишет данные
            filteredStream.on('finish', () => {
                // Защита от деления на ноль (на случай пустого файла)
                if (lineCount === 0) {
                    return reject(new Error('Файл пуст или не содержит валидных строк'));
                }

                resolve({
                    lineCount,
                    sum,
                    average: sum / lineCount,
                    min,
                    max,
                    filteredCount,   // только для варианта 11
                    threshold: HIGH_THRESHOLD
                });
            });
        });
    });
}

// ─────────────────────── 3. СОХРАНЕНИЕ РЕЗУЛЬТАТОВ ───────────────────────
/**
 * Записывает результаты обработки в processed_N.txt
 */
async function saveResults(result) {
    const content = [
        '========================================',
        `  РЕЗУЛЬТАТЫ ОБРАБОТКИ (Вариант ${VARIANT})`,
        '========================================',
        `Всего строк:         ${result.lineCount.toLocaleString('en-US')}`,
        `Сумма чисел:         ${result.sum.toLocaleString('en-US')}`,
        `Среднее значение:    ${result.average.toFixed(2)}`,
        `Максимальное число:  ${result.max}`,
        `Минимальное число:   ${result.min}`,
        '',
        `Строк с числом > ${result.threshold}: ${result.filteredCount.toLocaleString('en-US')}`,
        `(подробный список в файле ${path.basename(FILTERED_FILE)})`,
        '========================================',
        `Сгенерировано: ${new Date().toLocaleString('ru-RU')}`
    ].join('\n') + '\n';

    await fs.writeFile(PROCESSED_FILE, content, 'utf8');
}

// ─────────────────────── 4. ВЫВОД В КОНСОЛЬ ───────────────────────
function printSummary(r, elapsed) {
    console.log('\n✅ Обработка завершена!');
    console.log('📊 Результаты:');
    console.log(`- Всего строк:          ${r.lineCount.toLocaleString('en-US')}`);
    console.log(`- Сумма чисел:          ${r.sum.toLocaleString('en-US')}`);
    console.log(`- Среднее значение:     ${r.average.toFixed(2)}`);
    console.log(`- Максимальное число:   ${r.max}`);
    console.log(`- Минимальное число:    ${r.min}`);
    console.log(`- Строк с числом > 500: ${r.filteredCount.toLocaleString('en-US')}`);
    console.log(`\n📄 Результаты сохранены в: ${path.basename(PROCESSED_FILE)}`);
    console.log(`📄 Отфильтрованные строки:  ${path.basename(FILTERED_FILE)}`);
    console.log(`⏱ Время выполнения: ${elapsed} сек`);
}

// ─────────────────────── УТИЛИТЫ ───────────────────────
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
}

// Запуск
main();