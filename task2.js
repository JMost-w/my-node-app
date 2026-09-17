// Подключаем необходимые модули
const fs = require('fs').promises;         // Асинхронные операции с файловой системой
const path = require('path');              // Работа с путями

// Номер варианта (нечётный → дополнительные папки 1, 2, 3)
const VARIANT = 11;

// Корневая папка проекта
const PROJECT_DIR = path.join(__dirname, `project_${VARIANT}`);

/**
 * Описание назначения каждой папки
 */
const FOLDER_DESCRIPTIONS = {
    'src':                'Исходный код проекта',
    'src/modules':        'Модули приложения (логика)',
    'src/components':     'Переиспользуемые UI-компоненты',
    'src/utils':          'Вспомогательные утилиты и хелперы',
    'data':               'Данные проекта',
    'data/input':         'Входные данные',
    'data/output':        'Результаты обработки',
    'temp':               'Временные файлы'
};

/**
 * Главная функция программы
 */
async function main() {
    try {
        console.log(`\n=== Работа с каталогами (вариант ${VARIANT}) ===\n`);

        // 1. Создаём структуру каталогов
        await createDirectoryStructure();

        // 2. Создаём файлы info.txt в каждой папке
        await createInfoFiles();

        // 3. Дополнительное условие для нечётного варианта
        await createNumberedFolders();

        // 4. Выводим исходное дерево
        console.log('📁 ИСХОДНАЯ СТРУКТУРА КАТАЛОГОВ:\n');
        await printTree(PROJECT_DIR, '');

        // 5. Перемещаем temp внутрь data
        await moveDirectory(
            path.join(PROJECT_DIR, 'temp'),
            path.join(PROJECT_DIR, 'data', 'temp')
        );

        // 6. Переименовываем data/output → data/results
        await renameDirectory(
            path.join(PROJECT_DIR, 'data', 'output'),
            path.join(PROJECT_DIR, 'data', 'results')
        );

        // 7. Удаляем temp со всем содержимым
        await removeDirectory(path.join(PROJECT_DIR, 'data', 'temp'));

        // 8. Выводим обновлённое дерево
        console.log('\n📁 ОБНОВЛЁННАЯ СТРУКТУРА КАТАЛОГОВ:\n');
        await printTree(PROJECT_DIR, '');

        console.log('\n✅ Программа успешно завершена.\n');

    } catch (error) {
        console.error('❌ Ошибка выполнения программы:', error.message);
        process.exit(1);
    }
}

/**
 * Создаёт всю структуру каталогов
 */
async function createDirectoryStructure() {
    // Все папки, которые нужно создать (вложенные создадутся автоматически)
    const directories = [
        'src',
        'src/modules',
        'src/components',
        'src/utils',
        'data',
        'data/input',
        'data/output',
        'temp'
    ];

    for (const dir of directories) {
        const fullPath = path.join(PROJECT_DIR, dir);
        try {
            // recursive: true — создаёт все недостающие родительские папки
            await fs.mkdir(fullPath, { recursive: true });
        } catch (error) {
            throw new Error(`Не удалось создать папку "${dir}": ${error.message}`);
        }
    }
    console.log('✓ Структура каталогов создана');
}

/**
 * Создаёт файл info.txt в каждой папке с описанием её назначения
 */
async function createInfoFiles() {
    for (const [relativePath, description] of Object.entries(FOLDER_DESCRIPTIONS)) {
        const filePath = path.join(PROJECT_DIR, relativePath, 'info.txt');
        const content = `Назначение папки: ${relativePath}\nОписание: ${description}\n`;
        try {
            await fs.writeFile(filePath, content, 'utf8');
        } catch (error) {
            throw new Error(`Не удалось создать ${filePath}: ${error.message}`);
        }
    }
    console.log('✓ Файлы info.txt созданы во всех папках');
}

/**
 * Дополнительное условие для НЕЧЁТНОГО варианта:
 * создаём в src/components три папки: 1, 2, 3
 */
async function createNumberedFolders() {
    const componentsPath = path.join(PROJECT_DIR, 'src', 'components');
    for (let i = 1; i <= 3; i++) {
        const dirPath = path.join(componentsPath, String(i));
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            throw new Error(`Не удалось создать папку "${i}": ${error.message}`);
        }
    }
    console.log('✓ Созданы вложенные папки 1, 2, 3 в src/components');
}

/**
 * Перемещает каталог (переименование в пределах одной ФС)
 * @param {string} source - исходный путь
 * @param {string} destination - конечный путь
 */
async function moveDirectory(source, destination) {
    try {
        // Проверяем, что источник существует
        await checkExists(source);

        // Создаём родительскую папку назначения, если её нет
        await fs.mkdir(path.dirname(destination), { recursive: true });

        // fs.rename работает как "перемещение" в пределах одной файловой системы
        await fs.rename(source, destination);
        console.log(`✓ Перемещено: ${path.basename(source)} → ${path.relative(PROJECT_DIR, destination)}`);
    } catch (error) {
        throw new Error(`Не удалось переместить "${source}": ${error.message}`);
    }
}

/**
 * Переименовывает каталог
 */
async function renameDirectory(oldPath, newPath) {
    try {
        await checkExists(oldPath);
        await fs.rename(oldPath, newPath);
        console.log(`✓ Переименовано: ${path.relative(PROJECT_DIR, oldPath)} → ${path.relative(PROJECT_DIR, newPath)}`);
    } catch (error) {
        throw new Error(`Не удалось переименовать "${oldPath}": ${error.message}`);
    }
}

/**
 * Рекурсивно удаляет каталог со всем содержимым
 */
async function removeDirectory(dirPath) {
    try {
        await checkExists(dirPath);
        // rm с recursive и force — аналог rm -rf
        await fs.rm(dirPath, { recursive: true, force: true });
        console.log(`✓ Удалено: ${path.relative(PROJECT_DIR, dirPath)}`);
    } catch (error) {
        throw new Error(`Не удалось удалить "${dirPath}": ${error.message}`);
    }
}

/**
 * Проверяет существование пути
 */
async function checkExists(targetPath) {
    try {
        await fs.access(targetPath);
    } catch {
        throw new Error(`Путь "${targetPath}" не существует`);
    }
}

/**
 * Рекурсивно выводит дерево каталогов в консоль
 * @param {string} dirPath - путь к текущей папке
 * @param {string} prefix - префикс для отрисовки
 */
async function printTree(dirPath, prefix) {
    let entries;
    try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
        console.error(`  ⚠ Не удалось прочитать "${dirPath}": ${error.message}`);
        return;
    }

    // Сортируем: сначала папки, потом файлы, по алфавиту
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    entries.forEach((entry, index) => {
        const isLast = index === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const icon = entry.isDirectory() ? '📁' : '📄';

        console.log(`${prefix}${connector}${icon} ${entry.name}`);

        // Если это папка — заходим внутрь
        if (entry.isDirectory()) {
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            // Не заходим в служебные папки типа node_modules
            if (entry.name !== 'node_modules') {
                printTree(path.join(dirPath, entry.name), newPrefix);
            }
        }
    });
}

// Запуск
main();