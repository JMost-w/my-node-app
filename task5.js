// ─────────────────────────── МОДУЛИ ───────────────────────────
const fs       = require('fs').promises;   // Асинхронные операции (stat, readdir, mkdir, writeFile)
const fsSync   = require('fs');            // Для создания потоков
const path     = require('path');          // Работа с путями
const crypto   = require('crypto');        // Для MD5 (используется в sync)

// ─────────────────────────── КОНФИГУРАЦИЯ ───────────────────────────
const VARIANT         = 11;
const SOURCE_DIR      = path.join(__dirname, `source_${VARIANT}`);
const BACKUP_DIR      = path.join(__dirname, `backup_${VARIANT}`);
const MANIFEST_FILE   = path.join(SOURCE_DIR, 'manifest.json');
const SYNC_REPORT     = path.join(__dirname, `sync_report_${VARIANT}.txt`);

// Расширения, которые копируем через потоки
const STREAM_EXTENSIONS = ['.txt', '.js', '.json'];
// Расширения изображений — обычное копирование
const IMAGE_EXTENSIONS  = ['.jpg', '.png', '.gif'];
// Порог разбиения на чанки (1 МБ)
const CHUNK_THRESHOLD   = 1024 * 1024;     // 1 МБ
const CHUNK_SIZE        = 512 * 1024;      // 512 КБ
const BUFFER_SIZE       = 64 * 1024;       // 64 КБ — буфер потоков

// ─────────────────────────── ТОЧКА ВХОДА ───────────────────────────
async function main() {
    const startTime = Date.now();

    try {
        // 1. Создаём тестовую структуру
        await createTestStructure();

        // 2. Копируем с фильтрацией (вариант 11 → инкрементально)
        const copyStats = await copyWithFilter();

        // 3. Синхронизация: сравниваем source и backup
        const syncStats = await synchronize();

        // 4. Создаём sync_report_N.txt
        await createSyncReport(syncStats);

        // 5. Итоговая статистика
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        printSummary(copyStats, syncStats, elapsed);

    } catch (error) {
        console.error('\n❌ Ошибка:', error.message);
        process.exit(1);
    }
}

// ═══════════════════════════════════════════════════════════════════
// ЭТАП 1. СОЗДАНИЕ ТЕСТОВОЙ СТРУКТУРЫ
// ═══════════════════════════════════════════════════════════════════
/**
 * Создаёт source_N с 20 файлами в корне, 3 подпапками с файлами и manifest.json
 */
async function createTestStructure() {
    // Если уже существует — не пересоздаём
    try {
        await fs.access(SOURCE_DIR);
        console.log(`ℹ Структура ${path.basename(SOURCE_DIR)} уже существует. Пропускаем создание.\n`);
        return;
    } catch { /* не существует — создаём */ }

    console.log(`⚙ Создание тестовой структуры ${path.basename(SOURCE_DIR)}...`);

    // Перечень 20 файлов в корне: разные расширения и размеры
    const rootFiles = [
        // 12 маленьких текстовых / js / json
        { name: 'readme.txt',          size: 2   * 1024 },
        { name: 'notes.txt',           size: 5   * 1024 },
        { name: 'index.js',            size: 8   * 1024 },
        { name: 'app.js',              size: 15  * 1024 },
        { name: 'utils.js',            size: 12  * 1024 },
        { name: 'config.json',         size: 4   * 1024 },
        { name: 'data.json',           size: 25  * 1024 },
        { name: 'package.json',        size: 2   * 1024 },
        { name: 'log.txt',             size: 30  * 1024 },
        { name: 'changelog.txt',       size: 10  * 1024 },
        { name: 'helper.js',           size: 6   * 1024 },
        { name: 'settings.json',       size: 3   * 1024 },
        // 4 средних бинарных (.jpg/.png/.gif)
        { name: 'photo1.jpg',          size: 250 * 1024 },
        { name: 'photo2.png',          size: 400 * 1024 },
        { name: 'anim.gif',            size: 150 * 1024 },
        { name: 'icon.png',            size: 80  * 1024 },
        // 4 крупных (> 1 МБ) — попадут в чанки
        { name: 'big_data.txt',        size: 2   * 1024 * 1024 + 500 },
        { name: 'large_log.txt',       size: 1   * 1024 * 1024 + 200 },
        { name: 'huge_image.jpg',      size: 3   * 1024 * 1024 },
        { name: 'archive.gif',         size: 1   * 1024 * 1024 + 100 }
    ];

    // 3 подпапки с файлами внутри
    const subFolders = {
        'docs':       ['guide.txt', 'manual.md', 'faq.txt'],
        'scripts':    ['main.js', 'build.js', 'test.js'],
        'assets':     ['logo.png', 'banner.jpg', 'bg.gif']
    };

    // Создаём корень
    await fs.mkdir(SOURCE_DIR, { recursive: true });

    // Создаём файлы в корне
    for (const file of rootFiles) {
        const filePath = path.join(SOURCE_DIR, file.name);
        await createFileWithSize(filePath, file.size);
    }

    // Создаём подпапки с файлами
    for (const [folder, files] of Object.entries(subFolders)) {
        const folderPath = path.join(SOURCE_DIR, folder);
        await fs.mkdir(folderPath, { recursive: true });

        for (const name of files) {
            const ext = path.extname(name).toLowerCase();
            // Разные размеры для тестов
            let size;
            if (ext === '.jpg' || ext === '.png' || ext === '.gif') {
                size = 50 * 1024 + Math.floor(Math.random() * 200 * 1024);
            } else {
                size = 1 * 1024 + Math.floor(Math.random() * 20 * 1024);
            }
            await createFileWithSize(path.join(folderPath, name), size);
        }
    }

    // Создаём manifest.json
    await createManifest();

    console.log(`✓ Создано ${rootFiles.length} файлов + 3 подпапки + manifest.json\n`);
}

/**
 * Создаёт файл заданного размера со случайным содержимым
 */
async function createFileWithSize(filePath, sizeInBytes) {
    const stream = fsSync.createWriteStream(filePath, { highWaterMark: BUFFER_SIZE });

    const finish = new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
    });

    let written = 0;
    const chunk = Buffer.alloc(8 * 1024); // 8 КБ за раз

    while (written < sizeInBytes) {
        // Заполняем случайными байтами
        crypto.randomFillSync(chunk);
        const toWrite = Math.min(chunk.length, sizeInBytes - written);

        if (!stream.write(chunk.subarray(0, toWrite))) {
            await new Promise(resolve => stream.once('drain', resolve));
        }
        written += toWrite;
    }

    stream.end();
    await finish;
}

/**
 * Собирает информацию обо всех файлах source_N в manifest.json
 */
async function createManifest() {
    const files = await listAllFiles(SOURCE_DIR);

    const manifest = {
        generatedAt: new Date().toISOString(),
        variant: VARIANT,
        sourceDir: path.relative(__dirname, SOURCE_DIR),
        totalFiles: files.length,
        totalSize: files.reduce((s, f) => s + f.size, 0),
        files: files.map(f => ({
            path: f.relativePath,
            size: f.size,
            ext: f.ext,
            modified: f.modified
        }))
    };

    await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
}

// ═══════════════════════════════════════════════════════════════════
// ЭТАП 2. КОПИРОВАНИЕ С ФИЛЬТРАЦИЕЙ
// ═══════════════════════════════════════════════════════════════════
/**
 * Копирует все файлы из source_N в backup_N, соблюдая правила:
 *  - .txt/.js/.json — через потоки
 *  - .jpg/.png/.gif — обычное копирование
 *  - > 1 МБ — разделение на чанки по 512 КБ
 *  - вариант 11 — ИНКРЕМЕНТАЛЬНО (только новые/изменённые файлы)
 */
async function copyWithFilter() {
    console.log('═'.repeat(60));
    console.log('📂 ЭТАП 2. Копирование с фильтрацией');
    console.log('═'.repeat(60));
    console.log(`📂 Источник:  ${path.basename(SOURCE_DIR)}`);
    console.log(`📂 Назначение: ${path.basename(BACKUP_DIR)}\n`);

    // Создаём backup
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Собираем все файлы источника
    const allFiles = await listAllFiles(SOURCE_DIR);

    // Группируем по расширению для вывода статистики
    const grouped = groupByExtension(allFiles);
    console.log(`📋 Обнаружено файлов: ${allFiles.length}`);
    for (const [ext, group] of Object.entries(grouped)) {
        const totalSize = group.reduce((s, f) => s + f.size, 0);
        const method = STREAM_EXTENSIONS.includes(ext) ? 'потоковое копирование'
                     : IMAGE_EXTENSIONS.includes(ext)  ? 'обычное копирование'
                     : 'обычное копирование';
        console.log(`  ${ext || '(без расширения)'}: ${group.length} файлов (${formatSize(totalSize)}) — ${method}`);
    }
    console.log();

    // Статистика
    const stats = {
        total: allFiles.length,
        streamCopied: 0,
        plainCopied: 0,
        chunked: 0,
        skipped: 0,            // для инкрементального режима
        totalSize: 0,
        errors: []
    };

    // Копируем файлы по одному
    let processed = 0;
    for (const file of allFiles) {
        processed++;
        const relativePath = file.relativePath;             // путь внутри source_N
        const destPath = path.join(BACKUP_DIR, relativePath);

        // Создаём родительские папки
        await fs.mkdir(path.dirname(destPath), { recursive: true });

        // ── ИНКРЕМЕНТАЛЬНОЕ КОПИРОВАНИЕ (вариант 11) ──
        // Пропускаем файлы, которые уже есть в backup и не изменились
        const shouldCopy = await shouldCopyFile(file.absolutePath, destPath);
        if (!shouldCopy) {
            stats.skipped++;
            continue;
        }

        try {
            // Выбор метода копирования
            if (file.size > CHUNK_THRESHOLD) {
                // Большие файлы — разбиваем на чанки
                await copyInChunks(file.absolutePath, destPath);
                stats.chunked++;
                stats.totalSize += file.size;
            } else if (STREAM_EXTENSIONS.includes(file.ext)) {
                // Потоковое копирование
                await copyWithStream(file.absolutePath, destPath);
                stats.streamCopied++;
                stats.totalSize += file.size;
            } else {
                // Обычное копирование (fs.copyFile)
                await fs.copyFile(file.absolutePath, destPath);
                stats.plainCopied++;
                stats.totalSize += file.size;
            }
        } catch (error) {
            stats.errors.push(`${relativePath}: ${error.message}`);
        }

        // Прогресс
        process.stdout.write(`⏳ Прогресс копирования: ${processed}/${allFiles.length} файлов\r`);
    }
    process.stdout.write(`⏳ Прогресс копирования: ${allFiles.length}/${allFiles.length} файлов\n`);
    console.log('✅ Копирование завершено!\n');

    return stats;
}

/**
 * Инкрементальная проверка: нужно ли копировать файл?
 * Файл копируется, если:
 *  - его нет в backup
 *  - размер отличается
 *  - дата изменения новее, чем у копии
 */
async function shouldCopyFile(srcPath, destPath) {
    try {
        const [srcStat, dstStat] = await Promise.all([
            fs.stat(srcPath),
            fs.stat(destPath)
        ]);
        // Файлы идентичны по размеру и времени (с точностью до секунды)
        return srcStat.size !== dstStat.size ||
               Math.floor(srcStat.mtimeMs / 1000) !== Math.floor(dstStat.mtimeMs / 1000);
    } catch {
        // Файла назначения нет → копируем
        return true;
    }
}

/**
 * Потоковое копирование файла
 */
function copyWithStream(src, dest) {
    return new Promise((resolve, reject) => {
        const readStream  = fsSync.createReadStream(src,  { highWaterMark: BUFFER_SIZE });
        const writeStream = fsSync.createWriteStream(dest, { highWaterMark: BUFFER_SIZE });

        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        readStream.pipe(writeStream);
    });
}

/**
 * Копирование большого файла с разбиением на чанки по 512 КБ.
 * Результат: рядом с целевым файлом появляются чанки dest.part1, dest.part2, ...
 * и пустой маркер-файл dest (для соблюдения структуры).
 */
async function copyInChunks(src, dest) {
    // Удаляем старые чанки, если они остались от предыдущего запуска
    await cleanChunks(dest);

    const readStream = fsSync.createReadStream(src, { highWaterMark: CHUNK_SIZE });

    let chunkIndex = 1;
    let currentChunkSize = 0;
    let currentStream = null;
    let pendingFinish = null;

    // Открывает новый чанк
    const openChunk = () => {
        const chunkPath = `${dest}.part${chunkIndex}`;
        currentStream = fsSync.createWriteStream(chunkPath, { highWaterMark: BUFFER_SIZE });
        currentStreamSize = 0;
        pendingFinish = new Promise((resolve, reject) => {
            currentStream.on('finish', resolve);
            currentStream.on('error', reject);
        });
    };

    let currentStreamSize = 0;

    openChunk();

    // Читаем исходный файл и перекладываем данные по чанкам
    for await (const dataChunk of readStream) {
        let offset = 0;

        while (offset < dataChunk.length) {
            const space = CHUNK_SIZE - currentStreamSize;
            const toWrite = Math.min(space, dataChunk.length - offset);

            if (!currentStream.write(dataChunk.subarray(offset, offset + toWrite))) {
                await new Promise(resolve => currentStream.once('drain', resolve));
            }

            currentStreamSize += toWrite;
            offset += toWrite;

            // Чанк заполнен — закрываем и открываем следующий
            if (currentStreamSize >= CHUNK_SIZE) {
                currentStream.end();
                await pendingFinish;
                chunkIndex++;
                openChunk();
            }
        }
    }

    // Закрываем последний чанк
    if (currentStreamSize > 0) {
        currentStream.end();
        await pendingFinish;
    } else {
        // Если файл был пуст (не должно случиться), закрываем поток
        currentStream.end();
        await pendingFinish;
    }

    // Создаём пустой маркер-файл по исходному пути (для структуры)
    await fs.writeFile(dest, Buffer.alloc(0));
}

/**
 * Удаляет старые .part-чанки для указанного целевого пути
 */
async function cleanChunks(dest) {
    try {
        const dir = path.dirname(dest);
        const prefix = path.basename(dest) + '.part';
        const entries = await fs.readdir(dir);
        for (const entry of entries) {
            if (entry.startsWith(prefix)) {
                await fs.unlink(path.join(dir, entry));
            }
        }
    } catch { /* папки нет — ничего не делаем */ }
}

// ═══════════════════════════════════════════════════════════════════
// ЭТАП 3. СИНХРОНИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════════
/**
 * Сравнивает source_N и backup_N
 */
async function synchronize() {
    console.log('═'.repeat(60));
    console.log('🔄 ЭТАП 3. Сравнение директорий');
    console.log('═'.repeat(60));

    const srcFiles = await listAllFiles(SOURCE_DIR);
    const dstFiles = await listAllFiles(BACKUP_DIR);

    // Индексируем по относительному пути
    const srcMap = new Map(srcFiles.map(f => [f.relativePath, f]));
    const dstMap = new Map(dstFiles.map(f => [f.relativePath, f]));

    const result = {
        identical: 0,
        modified:  [],   // изменённые
        added:     [],   // новые (есть в source, нет в backup)
        deleted:   []    // удалённые (есть в backup, нет в source)
    };

    // Проверяем все файлы источника
    for (const [rel, srcFile] of srcMap) {
        const dstFile = dstMap.get(rel);
        if (!dstFile) {
            result.added.push({ path: rel, size: srcFile.size });
        } else if (srcFile.size !== dstFile.size ||
                   srcFile.modified !== dstFile.modified) {
            result.modified.push({
                path: rel,
                srcSize: srcFile.size,
                dstSize: dstFile.size,
                srcModified: srcFile.modified,
                dstModified: dstFile.modified
            });
        } else {
            result.identical++;
        }
    }

    // Проверяем удалённые (есть в backup, нет в source)
    for (const [rel, dstFile] of dstMap) {
        if (!srcMap.has(rel)) {
            result.deleted.push({ path: rel, size: dstFile.size });
        }
    }

    console.log(`  Совпадают:  ${result.identical} файлов`);
    console.log(`  Изменены:   ${result.modified.length} файлов`);
    console.log(`  Добавлены:  ${result.added.length} файлов`);
    console.log(`  Удалены:    ${result.deleted.length} файлов\n`);

    return result;
}

// ═══════════════════════════════════════════════════════════════════
// ЭТАП 4. ОТЧЁТ
// ═══════════════════════════════════════════════════════════════════
async function createSyncReport(syncStats) {
    const lines = [
        '═'.repeat(60),
        `  ОТЧЁТ О СИНХРОНИЗАЦИИ (Вариант ${VARIANT})`,
        '═'.repeat(60),
        `Источник:   ${path.basename(SOURCE_DIR)}`,
        `Назначение: ${path.basename(BACKUP_DIR)}`,
        `Дата:       ${new Date().toLocaleString('ru-RU')}`,
        '',
        `Совпадают:  ${syncStats.identical} файлов`,
        `Изменены:   ${syncStats.modified.length} файлов`,
        `Добавлены:  ${syncStats.added.length} файлов`,
        `Удалены:    ${syncStats.deleted.length} файлов`,
        ''
    ];

    if (syncStats.added.length) {
        lines.push('─── ДОБАВЛЕННЫЕ ───');
        syncStats.added.forEach(f => lines.push(`  + ${f.path} (${formatSize(f.size)})`));
        lines.push('');
    }
    if (syncStats.modified.length) {
        lines.push('─── ИЗМЕНЁННЫЕ ───');
        syncStats.modified.forEach(f =>
            lines.push(`  ~ ${f.path} (было ${formatSize(f.dstSize)} → стало ${formatSize(f.srcSize)})`));
        lines.push('');
    }
    if (syncStats.deleted.length) {
        lines.push('─── УДАЛЁННЫЕ ───');
        syncStats.deleted.forEach(f => lines.push(`  - ${f.path} (${formatSize(f.size)})`));
        lines.push('');
    }

    lines.push('═'.repeat(60));

    await fs.writeFile(SYNC_REPORT, lines.join('\n'), 'utf8');
    console.log(`📄 Отчет сохранен: ${path.basename(SYNC_REPORT)}\n`);
}

// ═══════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════
/**
 * Рекурсивно собирает список всех файлов в директории
 * @returns {Promise<Array<{name, absolutePath, relativePath, ext, size, modified}>>}
 */
async function listAllFiles(rootDir) {
    const result = [];

    async function walk(dir) {
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch { return; }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile()) {
                // Пропускаем manifest.json в корне (он служебный)
                if (fullPath === MANIFEST_FILE) continue;

                const stat = await fs.stat(fullPath);
                result.push({
                    name: entry.name,
                    absolutePath: fullPath,
                    relativePath: path.relative(rootDir, fullPath),
                    ext: path.extname(entry.name).toLowerCase(),
                    size: stat.size,
                    modified: stat.mtime.toISOString()
                });
            }
        }
    }

    await walk(rootDir);
    return result;
}

function groupByExtension(files) {
    const groups = {};
    for (const f of files) {
        const key = f.ext || '(none)';
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
    }
    return groups;
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
}

function printSummary(copyStats, syncStats, elapsed) {
    console.log('═'.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('═'.repeat(60));
    console.log(`- Всего файлов в источнике:  ${copyStats.total}`);
    console.log(`- Потоковое копирование:     ${copyStats.streamCopied} файлов`);
    console.log(`- Обычное копирование:       ${copyStats.plainCopied} файлов`);
    console.log(`- Разбито на чанки (> 1 МБ): ${copyStats.chunked} файлов`);
    console.log(`- Пропущено (без изменений): ${copyStats.skipped} файлов (инкрементально)`);
    console.log(`- Общий размер скопированного: ${formatSize(copyStats.totalSize)}`);
    console.log(`- Ошибок:                    ${copyStats.errors.length}`);
    if (copyStats.errors.length) {
        copyStats.errors.forEach(e => console.log(`   ⚠ ${e}`));
    }
    console.log();
    console.log('🔄 Сравнение директорий:');
    console.log(`- Совпадают:  ${syncStats.identical}`);
    console.log(`- Изменены:   ${syncStats.modified.length}`);
    console.log(`- Добавлены:  ${syncStats.added.length}`);
    console.log(`- Удалены:    ${syncStats.deleted.length}`);
    console.log();
    console.log(`⏱ Время выполнения: ${elapsed} сек`);
}

// ─────────────────────────── ЗАПУСК ───────────────────────────
main();