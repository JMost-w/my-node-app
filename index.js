// Подключаем необходимые модули
const fs = require('fs').promises; // Используем промисы для асинхронной работы с файлами
const path = require('path'); // Модуль для работы с путями
const fsSync = require('fs'); // Синхронный fs для проверки размера файла

/**
 * Основная функция программы
 */
async function main() {
    try {
        // Формируем имя файла согласно варианту (11)
        const variantNumber = 11;
        const fileName = `student_${variantNumber}.txt`;
        
        // Получаем полный путь к файлу относительно текущей директории
        const filePath = path.join(__dirname, fileName);
        
        console.log(`Работаем с файлом: ${filePath}\n`);
        
        // 1. Создаем файл и записываем в него информацию
        await createStudentFile(filePath, variantNumber);
        
        // 2. Добавляем строку с количеством записей
        await appendRecordsCount(filePath);
        
        // 3. Читаем файл и выводим содержимое
        await readAndDisplayFile(filePath);
        
    } catch (error) {
        console.error('Критическая ошибка в работе программы:', error.message);
        process.exit(1);
    }
}

/**
 * Создает файл и записывает в него начальные данные
 * @param {string} filePath - путь к файлу
 * @param {number} variantNumber - номер варианта
 */
async function createStudentFile(filePath, variantNumber) {
    try {
        // Получаем текущую дату и время в отформатированном виде
        const now = new Date();
        const formattedDate = now.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Список любимых книг/фильмов
        const favorites = [
            '1. Мастер и Маргарита (М. Булгаков)',
            '2. Преступление и наказание (Ф. Достоевский)',
            '3. Интерстеллар (фильм)',
            '4. 1984 (Дж. Оруэлл)',
            '5. Игра престолов (сериал)'
        ];
        
        // Формируем содержимое файла
        const content = [
            '========================================',
            'ИНФОРМАЦИЯ О СТУДЕНТЕ',
            '========================================',
            'Фамилия и имя: Мазан Максим',
            'Номер группы: 401',
            `Номер варианта: ${variantNumber}`,
            `Текущая дата и время: ${formattedDate}`,
            '',
            'Любимые книги/фильмы:',
            ...favorites,
            '========================================'
        ].join('\n') + '\n';
        
        // Записываем данные в файл (флаг 'w' перезаписывает файл)
        await fs.writeFile(filePath, content, 'utf8');
        console.log('✓ Файл успешно создан и заполнен начальными данными');
        
    } catch (error) {
        throw new Error(`Ошибка при создании файла "${filePath}": ${error.message}`);
    }
}

/**
 * Добавляет в конец файла строку с количеством записей
 * @param {string} filePath - путь к файлу
 */
async function appendRecordsCount(filePath) {
    try {
        // Проверяем существование файла перед чтением
        await checkFileExists(filePath);
        
        // Получаем размер файла для определения необходимости использования потоков
        const stats = await fs.stat(filePath);
        
        let lineCount;
        
        // Если файл больше 1 МБ — используем поток для подсчета строк
        if (stats.size > 1024 * 1024) {
            console.log('Файл больше 1 МБ — используем поток для чтения');
            lineCount = await countLinesWithStream(filePath);
        } else {
            // Для небольших файлов читаем целиком
            lineCount = await countLines(filePath);
        }
        
        // Формируем строку для добавления
        const appendContent = `\nКоличество записей: ${lineCount}\n`;
        
        // Добавляем строку в конец файла (флаг 'a' — append)
        await fs.appendFile(filePath, appendContent, 'utf8');
        console.log(`✓ Добавлена строка "Количество записей: ${lineCount}"\n`);
        
    } catch (error) {
        throw new Error(`Ошибка при добавлении количества записей: ${error.message}`);
    }
}

/**
 * Подсчитывает количество строк в файле через полное чтение
 * @param {string} filePath - путь к файлу
 * @returns {Promise<number>} количество строк
 */
async function countLines(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        // Разбиваем по переносам строк и считаем непустые строки
        return data.split(/\r?\n/).filter(line => line.trim().length > 0).length;
    } catch (error) {
        throw new Error(`Ошибка при подсчете строк: ${error.message}`);
    }
}

/**
 * Подсчитывает количество строк в файле через поток (для больших файлов)
 * @param {string} filePath - путь к файлу
 * @returns {Promise<number>} количество строк
 */
function countLinesWithStream(filePath) {
    return new Promise((resolve, reject) => {
        let lineCount = 0;
        let lastChar = '';
        
        // Создаем поток чтения файла
        const stream = fsSync.createReadStream(filePath, { encoding: 'utf8' });
        
        // Обрабатываем данные по мере поступления
        stream.on('data', (chunk) => {
            for (let i = 0; i < chunk.length; i++) {
                // Считаем строки по символу \n (учитывая \r\n)
                if (chunk[i] === '\n' && lastChar !== '\r') {
                    lineCount++;
                } else if (chunk[i] === '\n' && lastChar === '\r') {
                    lineCount++;
                }
                lastChar = chunk[i];
            }
        });
        
        // Завершение потока
        stream.on('end', () => {
            // Если файл не заканчивается переносом строки, добавляем последнюю строку
            if (lastChar !== '\n' && lastChar !== '') {
                lineCount++;
            }
            resolve(lineCount);
        });
        
        // Обработка ошибок потока
        stream.on('error', (error) => {
            reject(new Error(`Ошибка потока чтения: ${error.message}`));
        });
    });
}

/**
 * Читает файл и выводит содержимое в консоль в отформатированном виде
 * @param {string} filePath - путь к файлу
 */
async function readAndDisplayFile(filePath) {
    try {
        // Проверяем существование файла
        await checkFileExists(filePath);
        
        // Получаем размер файла
        const stats = await fs.stat(filePath);
        
        let content;
        
        // Для файлов > 1 МБ используем поток
        if (stats.size > 1024 * 1024) {
            console.log('Файл больше 1 МБ — читаем через поток\n');
            content = await readFileWithStream(filePath);
        } else {
            content = await fs.readFile(filePath, 'utf8');
        }
        
        // Выводим отформатированное содержимое
        console.log('╔════════════════════════════════════════╗');
        console.log('║        СОДЕРЖИМОЕ ФАЙЛА               ║');
        console.log('╚════════════════════════════════════════╝');
        console.log(content);
        console.log('╔════════════════════════════════════════╗');
        console.log('║        КОНЕЦ ФАЙЛА                    ║');
        console.log('╚════════════════════════════════════════╝');
        
    } catch (error) {
        throw new Error(`Ошибка при чтении и выводе файла: ${error.message}`);
    }
}

/**
 * Читает файл через поток (для больших файлов)
 * @param {string} filePath - путь к файлу
 * @returns {Promise<string>} содержимое файла
 */
function readFileWithStream(filePath) {
    return new Promise((resolve, reject) => {
        let content = '';
        
        const stream = fsSync.createReadStream(filePath, { encoding: 'utf8' });
        
        stream.on('data', (chunk) => {
            content += chunk;
        });
        
        stream.on('end', () => {
            resolve(content);
        });
        
        stream.on('error', (error) => {
            reject(new Error(`Ошибка при чтении потока: ${error.message}`));
        });
    });
}

/**
 * Проверяет существование файла и доступ к нему
 * @param {string} filePath - путь к файлу
 */
async function checkFileExists(filePath) {
    try {
        await fs.access(filePath, fsSync.constants.F_OK | fsSync.constants.R_OK);
    } catch (error) {
        throw new Error(`Файл "${filePath}" не существует или недоступен для чтения`);
    }
}

// Запускаем программу
main();