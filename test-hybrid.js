const FileManagerHybrid = require('./fileOperationsHybrid');

const fm = new FileManagerHybrid('./test-data-hybrid');

// ============================================================
// ТЕСТ 1: Стиль колбэков
// ============================================================
function testCallbacksStyle() {
    console.log('\n=== СТИЛЬ КОЛБЭКОВ ===\n');

    fm.createFile('callback1.txt', 'Привет из колбэка!', (err, filePath) => {
        if (err) {
            console.error('❌ Ошибка создания:', err.message);
            return;
        }
        console.log(`✅ Файл создан: ${filePath}`);

        fm.readFile('callback1.txt', (err, content) => {
            if (err) {
                console.error('❌ Ошибка чтения:', err.message);
                return;
            }
            console.log(`✅ Содержимое: "${content}"`);

            fm.getFileStats('callback1.txt', (err, stats) => {
                if (err) {
                    console.error('❌ Ошибка статистики:', err.message);
                    return;
                }
                console.log(`✅ Размер: ${stats.size} байт`);

                fm.listFiles((err, files) => {
                    if (err) {
                        console.error('❌ Ошибка списка:', err.message);
                        return;
                    }
                    console.log(`✅ Файлы: ${files.join(', ')}`);
                    console.log('✅ Стиль колбэков работает!');
                });
            });
        });
    });
}

// ============================================================
// ТЕСТ 2: Стиль промисов
// ============================================================
async function testPromisesStyle() {
    console.log('\n=== СТИЛЬ ПРОМИСОВ ===\n');

    try {
        const filePath = await fm.createFile('promise1.txt', 'Привет из промиса!');
        console.log(`✅ Файл создан: ${filePath}`);

        const content = await fm.readFile('promise1.txt');
        console.log(`✅ Содержимое: "${content}"`);

        const stats = await fm.getFileStats('promise1.txt');
        console.log(`✅ Размер: ${stats.size} байт`);

        // Параллельное создание
        const paths = await fm.createMultipleFiles([
            { filename: 'parallel1.txt', content: 'Файл 1' },
            { filename: 'parallel2.txt', content: 'Файл 2' },
            { filename: 'parallel3.txt', content: 'Файл 3' },
        ]);
        console.log(`✅ Создано параллельно: ${paths.length} файлов`);

        // Параллельное чтение
        const contents = await fm.readMultipleFiles([
            'parallel1.txt',
            'parallel2.txt',
            'parallel3.txt',
        ]);
        console.log('✅ Содержимое параллельных файлов:');
        Object.entries(contents).forEach(([name, text]) => {
            console.log(`   - ${name}: "${text}"`);
        });

        console.log('✅ Стиль промисов работает!');
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    }
}

// ============================================================
// ТЕСТ 3: Обработка ошибок (невалидное имя файла)
// ============================================================
async function testErrorHandling() {
    console.log('\n=== ОБРАБОТКА ОШИБОК ===\n');

    // Через промис
    try {
        await fm.createFile('../hack.txt', 'Плохой файл');
    } catch (err) {
        console.log(`✅ Промис поймал ошибку: ${err.message}`);
    }

    // Через колбэк
    fm.readFile('bad/name.txt', (err, content) => {
        if (err) {
            console.log(`✅ Колбэк поймал ошибку: ${err.message}`);
        }
    });
}

// ============================================================
// ЗАПУСК
// ============================================================
testCallbacksStyle();

setTimeout(() => {
    testPromisesStyle().then(() => {
        testErrorHandling();
    });
}, 500);