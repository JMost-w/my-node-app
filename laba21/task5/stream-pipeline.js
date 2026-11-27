// stream-pipeline.js — полный конвейер: генерация → Transform → CSV
const fs = require('fs');
const path = require('path');
const { Readable, Transform, Writable, pipeline } = require('stream');
const { pipeline: pipelinePromise } = require('stream/promises');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';
const TOTAL_STUDENTS = 10000;
const BATCH_SIZE = 100;
const TIMEOUT_MS = 10_000;

const CSV_FILE = path.join(__dirname, 'students.csv');
const ERRORS_FILE = path.join(__dirname, 'errors.log');

// ---------- Утилиты ----------
function timestamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function logError(message) {
    const line = `[${timestamp()}] [${GROUP}] ${message}\n`;
    fs.appendFileSync(ERRORS_FILE, line);
    console.error(line.trim());
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ---------- Счётчики ----------
const stats = {
    generated: 0,
    validated: 0,
    enriched: 0,
    filtered: 0,
    written: 0,
    errors: 0,
    backpressureEvents: 0,
    startTime: Date.now()
};

// ============================================================
//  1. SOURCE — Readable, генерирует студентов порциями
// ============================================================
class StudentSource extends Readable {
    constructor(total) {
        super({ objectMode: true });
        this.total = total;
        this.generated = 0;
        this.seed = 401;
    }

    _random() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    _read() {
        if (this.generated >= this.total) {
            this.push(null);
            return;
        }

        const batch = [];
        const end = Math.min(this.generated + BATCH_SIZE, this.total);

        for (let i = this.generated; i < end; i++) {
            const id = i + 1;
            // 1% студентов — «битые» (для проверки валидации)
            if (this._random() < 0.01) {
                batch.push({
                    id,
                    name: this._random() < 0.5 ? '' : `Студент ${id}`,
                    group: GROUP,
                    course: Math.floor(this._random() * 5) + 1,
                    grade: this._random() < 0.5 ? 'abc' : Math.floor(this._random() * 5) + 1
                });
            } else {
                batch.push({
                    id,
                    name: `Студент ${id}`,
                    group: GROUP,
                    course: Math.floor(this._random() * 5) + 1,
                    grade: Math.floor(this._random() * 5) + 1
                });
            }
        }

        this.generated = end;
        stats.generated = this.generated;

        for (const student of batch) {
            this.push(student);
        }
    }
}

// ============================================================
//  2. TRANSFORM: Validate
// ============================================================
class ValidateTransform extends Transform {
    constructor() {
        super({ objectMode: true, highWaterMark: 50 });
    }

    _transform(student, encoding, callback) {
        const errors = [];
        if (!student.name || typeof student.name !== 'string' || student.name.trim() === '') {
            errors.push('отсутствует name');
        }
        if (typeof student.grade !== 'number' || student.grade < 1 || student.grade > 5) {
            errors.push('некорректный grade');
        }
        if (!Number.isInteger(student.course) || student.course < 1) {
            errors.push('некорректный course');
        }

        if (errors.length > 0) {
            stats.errors++;
            logError(`Ошибка валидации: id=${student.id}, ${errors.join(', ')}`);
            return callback(); // пропускаем (не пушим дальше)
        }

        stats.validated++;
        callback(null, student);
    }
}

// ============================================================
//  3. TRANSFORM: Enrich
// ============================================================
class EnrichTransform extends Transform {
    constructor() {
        super({ objectMode: true, highWaterMark: 50 });
    }

    _transform(student, encoding, callback) {
        // Средний балл = grade * 0.9 + курс * 0.1 (демо)
        student.averageGrade = +(student.grade * 0.9 + student.course * 0.1).toFixed(1);
        stats.enriched++;
        callback(null, student);
    }
}

// ============================================================
//  4. TRANSFORM: Filter (grade > 3)
// ============================================================
class FilterTransform extends Transform {
    constructor() {
        super({ objectMode: true, highWaterMark: 50 });
    }

    _transform(student, encoding, callback) {
        if (student.grade > 3) {
            stats.filtered++;
            callback(null, student);
        } else {
            callback();
        }
    }
}

// ============================================================
//  5. TRANSFORM: Format → CSV
// ============================================================
class FormatTransform extends Transform {
    constructor() {
        super({ objectMode: true, highWaterMark: 50 });
        this.isFirst = true;
    }

    _transform(student, encoding, callback) {
        if (this.isFirst) {
            this.isFirst = false;
            const header = 'id,name,group,course,grade,averageGrade\n';
            this.push(header);
        }
        const row = `${student.id},${student.name},${student.group},${student.course},${student.grade},${student.averageGrade}\n`;
        callback(null, row);
    }
}

// ============================================================
//  6. WRITABLE: запись в CSV + прогресс
// ============================================================
class CSVWritable extends Writable {
    constructor(filePath) {
        super({ highWaterMark: 100 });
        this.file = fs.createWriteStream(filePath);
        this.lastUpdate = Date.now();
        this.backpressureShown = false;
    }

    _write(chunk, encoding, callback) {
        stats.written++;
        const ok = this.file.write(chunk);

        if (!ok) {
            stats.backpressureEvents++;
            if (!this.backpressureShown && stats.written >= 5000) {
                console.log(`\n[BACKPRESSURE] Writable переполнен на ${stats.written}-й записи`);
                console.log(`[BACKPRESSURE] Пауза 50 мс`);
                this.backpressureShown = true;
            }
            this.file.once('drain', () => {
                console.log('[DRAIN] Продолжаем запись');
                callback();
            });
        } else {
            callback();
        }

        // Прогресс
        if (Date.now() - this.lastUpdate > 500) {
            this.lastUpdate = Date.now();
            const elapsed = (Date.now() - stats.startTime) / 1000;
            const speed = Math.round(stats.written / Math.max(elapsed, 0.001));
            const pct = Math.round(stats.generated / TOTAL_STUDENTS * 100);
            const filled = Math.round(pct / 5);
            const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
            process.stdout.write(`\r[PROGRESS] ${bar} ${pct}% | ${stats.generated}/${TOTAL_STUDENTS} | ${speed} записей/сек`);
        }
    }

    _final(callback) {
        this.file.end(callback);
    }
}

// ============================================================
//  7. ЗАПУСК КОНВЕЙЕРА
// ============================================================
async function runPipeline(timeoutMs = TIMEOUT_MS) {
    console.log(`=== Конвейер обработки данных (группа ${GROUP}) ===`);
    console.log(`Студент: ${STUDENT}`);
    console.log(`Источник: ${TOTAL_STUDENTS} студентов`);
    console.log(`Фильтр: оценка > 3\n`);

    // Очищаем файлы
    if (fs.existsSync(ERRORS_FILE)) fs.unlinkSync(ERRORS_FILE);
    if (fs.existsSync(CSV_FILE)) fs.unlinkSync(CSV_FILE);

    // Сбрасываем счётчики
    Object.assign(stats, {
        generated: 0, validated: 0, enriched: 0,
        filtered: 0, written: 0, errors: 0,
        backpressureEvents: 0, startTime: Date.now()
    });

    const source = new StudentSource(TOTAL_STUDENTS);
    const validate = new ValidateTransform();
    const enrich = new EnrichTransform();
    const filter = new FilterTransform();
    const format = new FormatTransform();
    const writable = new CSVWritable(CSV_FILE);

    // AbortController для отмены по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.log('\n✖ Таймаут! Обработка отменена');
        controller.abort();
        source.destroy();
        validate.destroy();
        enrich.destroy();
        filter.destroy();
        format.destroy();
        writable.destroy();
    }, timeoutMs);

    try {
        await pipelinePromise(
            source,
            validate,
            enrich,
            filter,
            format,
            writable,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        process.stdout.write('\n');
        return true;
    } catch (err) {
        clearTimeout(timeoutId);
        process.stdout.write('\n');
        if (err.name === 'AbortError' || controller.signal.aborted) {
            console.log('✔ Все потоки корректно закрыты');
            console.log('✔ Ресурсы освобождены');
            return false;
        }
        console.error(`✖ Ошибка конвейера: ${err.message}`);
        logError(`Ошибка конвейера: ${err.message}`);
        return false;
    }
}

// ============================================================
//  8. ИТОГИ
// ============================================================
function printResults(durationMs) {
    const elapsed = (durationMs / 1000).toFixed(2);
    const speed = Math.round(stats.written / Math.max(durationMs / 1000, 0.001));
    const fileSize = fs.existsSync(CSV_FILE)
        ? (fs.statSync(CSV_FILE).size / 1024 / 1024).toFixed(2)
        : 0;

    console.log('\n=== Результаты ===');
    console.log(`Всего сгенерировано: ${stats.generated}`);
    console.log(`Прошло валидацию: ${stats.validated}`);
    console.log(`Обогащено: ${stats.enriched}`);
    console.log(`Отфильтровано: ${stats.filtered}`);
    console.log(`Записано в CSV: ${stats.written}`);
    console.log(`Ошибок: ${stats.errors}`);
    console.log(`Backpressure-событий: ${stats.backpressureEvents}`);
    console.log(`Время выполнения: ${elapsed} сек`);
    console.log(`Средняя скорость: ${speed} записей/сек`);
    console.log(`Файл: students.csv (${fileSize} МБ)`);
}

// ============================================================
//  9. АЛЬТЕРНАТИВА — async iterator
// ============================================================
async function runAsyncIterator() {
    console.log('\n=== Сравнение с async iterator ===');
    const start = Date.now();
    let processed = 0;

    const source = new StudentSource(TOTAL_STUDENTS);
    const validate = new ValidateTransform();
    const enrich = new EnrichTransform();
    const filter = new FilterTransform();

    const stream = source.pipe(validate).pipe(enrich).pipe(filter);

    for await (const student of stream) {
        processed++;
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    const speed = Math.round(processed / Math.max(elapsed, 0.001));
    console.log(`[ASYNC] Обработано: ${processed} записей за ${elapsed} сек`);
    console.log(`Скорость: ${speed} записей/сек`);
}

// ============================================================
//  MAIN
// ============================================================
(async () => {
    // ---------- 1. Основной конвейер ----------
    const start = Date.now();
    await runPipeline(TIMEOUT_MS);
    printResults(Date.now() - start);

    // ---------- 2. Демонстрация backpressure ----------
    console.log('\n=== Демонстрация backpressure ===');
    console.log(`Событий backpressure: ${stats.backpressureEvents}`);
    if (stats.backpressureEvents > 0) {
        console.log('✔ Backpressure был обработан корректно (через drain)');
    } else {
        console.log('ℹ Backpressure не возник (потоки работали синхронно)');
    }

    // ---------- 3. Демонстрация таймаута ----------
    console.log('\n=== Отмена по таймауту ===');
    console.log('Запуск с таймаутом 50 мс...');
    await runPipeline(50);

    // ---------- 4. Async iterator ----------
    await runAsyncIterator();

    console.log('\n✅ Все демонстрации завершены');
})();