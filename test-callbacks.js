const FileManager = require('./fileOperations');

const fileManager = new FileManager('./test-data');

console.log('=== ТЕСТИРОВАНИЕ КОЛБЭКОВ ===\n');

console.log('1. Создание файла...');
fileManager.createFile('test1.txt', 'Привет, мир!', (err, filePath) => {
    if (err) {
        console.error(' ❌ Ошибка создания:', err.message);
        return;
    }
    console.log(` ✅ Файл создан: ${filePath}`);

    console.log('\n2. Чтение файла...');
    fileManager.readFile('test1.txt', (err, content) => {
        if (err) {
            console.error(' ❌ Ошибка чтения:', err.message);
            return;
        }
        console.log(` ✅ Содержимое: "${content}"`);

        console.log('\n3. Получение статистики...');
        fileManager.getFileStats('test1.txt', (err, stats) => {
            if (err) {
                console.error(' ❌ Ошибка статистики:', err.message);
                return;
            }
            console.log(` ✅ Статистика:`);
            console.log(`    Размер: ${stats.size} байт`);
            console.log(`    Создан: ${stats.created}`);
            console.log(`    Изменён: ${stats.modified}`);

            console.log('\n4. Создание второго файла...');
            fileManager.createFile(
                'test2.txt',
                'Второй файл для демонстрации',
                (err, filePath2) => {
                    if (err) {
                        console.error(' ❌ Ошибка создания второго файла:', err.message);
                        return;
                    }
                    console.log(` ✅ Второй файл создан: ${filePath2}`);

                    console.log('\n5. Список файлов...');
                    fileManager.listFiles((err, files) => {
                        if (err) {
                            console.error(' ❌ Ошибка получения списка:', err.message);
                            return;
                        }
                        console.log(` ✅ Файлы в директории:`);
                        files.forEach((file) => console.log(`    - ${file}`));

                        console.log('\n6. Очистка...');
                        fileManager.deleteFile('test1.txt', (err) => {
                            if (err) {
                                console.error(' ❌ Ошибка удаления test1.txt:', err.message);
                                return;
                            }
                            console.log(' ✅ test1.txt удалён');

                            fileManager.deleteFile('test2.txt', (err) => {
                                if (err) {
                                    console.error(' ❌ Ошибка удаления test2.txt:', err.message);
                                    return;
                                }
                                console.log(' ✅ test2.txt удалён');
                                console.log('\n✅ Все операции завершены!');
                                console.log('⚠️ Обратите внимание на глубину вложенности колбэков!');
                            });
                        });
                    });
                }
            );
        });
    });
});