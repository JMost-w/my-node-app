// Подключаем необходимые модули
const fs = require('fs').promises;   // Асинхронные операции с файловой системой
const path = require('path');        // Работа с путями

// Номер варианта
const VARIANT = 11;

// Дополнительное условие для варианта 11: только эти расширения
const ALLOWED_EXTENSIONS = ['.js', '.json', '.txt', '.md'];

/**
 * Главная функция
 */
async function main() {
    try {
        // 1. Получаем путь к директории из аргументов командной строки
        //    process.argv[0] = node, [1] = путь к скрипту, [2] = первый аргумент
        const argPath = process.argv[2];
        const targetDir = argPath
            ? path.resolve(process.cwd(), argPath)   // относительный путь → абсолютный от cwd
            : process.cwd();                          // если не указан — текущая директория

        console.log(`📊 Анализ директории: ${targetDir}\n`);

        // Проверяем, что путь существует и это директория
        await validateDirectory(targetDir);

        // 2. Рекурсивно сканируем директорию
        const stats = await scanDirectory(targetDir);

        // 3. Считаем агрегированные показатели
        const report = buildReport(targetDir, stats);

        // 4. Выводим статистику в консоль
        printStatistics(report);

        // 5. Сохраняем отчёт в report_11.json
        await saveReport(report);

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    }
}

/**
 * Проверяет, что путь существует и является директорией
 * @param {string} dirPath
 */
async function validateDirectory(dirPath) {
    let stat;
    try {
        stat = await fs.stat(dirPath);
    } catch {
        throw new Error(`Путь "${dirPath}" не существует`);
    }
    if (!stat.isDirectory()) {
        throw new Error(`Путь "${dirPath}" не является директорией`);
    }
}

/**
 * Рекурсивно обходит директорию и собирает информацию о файлах и папках
 * @param {string} dirPath - текущая директория
 * @returns {Promise<{files: Array, foldersCount: number}>}
 */
async function scanDirectory(dirPath) {
    const files = [];        // массив объектов с информацией о файлах
    let foldersCount = 0;

    // Читаем содержимое директории
    let entries;
    try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
        // Не падаем, если нет доступа к отдельной папке — просто пропускаем
        console.warn(`  ⚠ Не удалось прочитать "${dirPath}": ${error.message}`);
        return { files, foldersCount };
    }

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            // Считаем папку и заходим внутрь рекурсивно
            foldersCount++;
            const sub = await scanDirectory(fullPath);
            files.push(...sub.files);
            foldersCount += sub.foldersCount;

        } else if (entry.isFile()) {
            // Проверяем расширение: для варианта 11 берём только .js, .json, .txt, .md
            const ext = path.extname(entry.name).toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                continue; // пропускаем файлы с другими расширениями
            }

            // Получаем размер файла
            try {
                const stat = await fs.stat(fullPath);
                files.push({
                    name: entry.name,
                    path: fullPath,
                    relativePath: path.relative(process.cwd(), fullPath),
                    ext: ext,
                    size: stat.size,
                    modified: stat.mtime.toISOString()
                });
            } catch (error) {
                console.warn(`  ⚠ Не удалось получить размер "${fullPath}": ${error.message}`);
            }
        }
        // Симлинки и прочее игнорируем
    }

    return { files, foldersCount };
}

/**
 * Формирует объект отчёта со всей статистикой
 */
function buildReport(targetDir, { files, foldersCount }) {
    // Общий размер
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    // Группировка по расширениям
    const byExt = {};
    for (const file of files) {
        if (!byExt[file.ext]) {
            byExt[file.ext] = { count: 0, size: 0 };
        }
        byExt[file.ext].count++;
        byExt[file.ext].size += file.size;
    }

    // Сортировка расширений по размеру (убывание)
    const extensions = Object.entries(byExt)
        .map(([ext, data]) => ({ ext, ...data }))
        .sort((a, b) => b.size - a.size);

    // Топ-5 самых больших файлов
    const biggest = [...files]
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .map(f => ({ name: f.name, size: f.size, path: f.relativePath }));

    // Топ-5 самых маленьких файлов
    const smallest = [...files]
        .sort((a, b) => a.size - b.size)
        .slice(0, 5)
        .map(f => ({ name: f.name, size: f.size, path: f.relativePath }));

    return {
        analyzedDirectory: targetDir,
        variant: VARIANT,
        allowedExtensions: ALLOWED_EXTENSIONS,
        generatedAt: new Date().toISOString(),
        summary: {
            totalFiles: files.length,
            totalFolders: foldersCount,
            totalSizeBytes: totalSize,
            totalSizeKB: +(totalSize / 1024).toFixed(2),
            totalSizeMB: +(totalSize / (1024 * 1024)).toFixed(2)
        },
        extensions,
        topBiggest: biggest,
        topSmallest: smallest,
        allFiles: files.map(f => ({
            name: f.name,
            path: f.relativePath,
            ext: f.ext,
            size: f.size,
            modified: f.modified
        }))
    };
}

/**
 * Утилита: форматирует размер в человекочитаемый вид
 */
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}

/**
 * Выводит статистику в консоль
 */
function printStatistics(report) {
    const s = report.summary;

    console.log(`📁 Общее количество папок: ${s.totalFolders}`);
    console.log(`📄 Общее количество файлов: ${s.totalFiles}`);
    console.log(`💾 Общий размер: ${s.totalSizeMB} МБ (${s.totalSizeBytes.toLocaleString('en-US')} байт)\n`);

    console.log('📂 Расширения файлов:');
    if (report.extensions.length === 0) {
        console.log('  (нет подходящих файлов)');
    } else {
        for (const { ext, count, size } of report.extensions) {
            console.log(`  ${ext}: ${count} ${pluralize(count, 'файл', 'файла', 'файлов')} (${formatSize(size)})`);
        }
    }
    console.log();

    console.log('🏆 Топ-5 самых больших файлов:');
    if (report.topBiggest.length === 0) {
        console.log('  (нет файлов)');
    } else {
        report.topBiggest.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.name} (${formatSize(f.size)}) — ${f.path}`);
        });
    }
    console.log();

    console.log('🔍 Топ-5 самых маленьких файлов:');
    if (report.topSmallest.length === 0) {
        console.log('  (нет файлов)');
    } else {
        report.topSmallest.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.name} (${formatSize(f.size)}) — ${f.path}`);
        });
    }
    console.log();
}

/**
 * Склонение русских слов по числам
 */
function pluralize(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}

/**
 * Сохраняет отчёт в JSON-файл report_11.json в текущей директории
 */
async function saveReport(report) {
    const reportPath = path.join(process.cwd(), `report_${VARIANT}.json`);
    try {
        await fs.writeFile(
            reportPath,
            JSON.stringify(report, null, 2),
            'utf8'
        );
        console.log(`📄 Отчет сохранен: ${path.relative(process.cwd(), reportPath) || reportPath}`);
    } catch (error) {
        throw new Error(`Не удалось сохранить отчёт: ${error.message}`);
    }
}

// Запускаем программу
main();