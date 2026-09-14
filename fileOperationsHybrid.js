const fs = require('fs');
const path = require('path');
const util = require('util');

// Промисифицированные версии fs
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const unlinkAsync = util.promisify(fs.unlink);
const readdirAsync = util.promisify(fs.readdir);
const statAsync = util.promisify(fs.stat);
const mkdirAsync = util.promisify(fs.mkdir);

/**
 * Гибридный менеджер файлов.
 * Поддерживает и колбэки, и промисы.
 */
class FileManagerHybrid {
    constructor(baseDir = './data-hybrid') {
        this.baseDir = baseDir;
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
            console.log(`Создана директория: ${baseDir}`);
        }
    }

    /**
     * Универсальный обработчик результата.
     * Если передан callback — вызывает его.
     * Если нет — возвращает промис.
     */
    _handle(promise, callback) {
        if (typeof callback === 'function') {
            promise
                .then((result) => callback(null, result))
                .catch((err) => callback(err, null));
        } else {
            return promise;
        }
    }

    /**
     * Валидация имени файла (защита от path traversal).
     */
    _validateFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            throw new Error('Имя файла должно быть непустой строкой');
        }
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            throw new Error(`Недопустимое имя файла: ${filename}`);
        }
        return filename;
    }

    /**
     * Создание файла.
     * Поддерживает: createFile(name, content, callback) и createFile(name, content)
     */
    createFile(filename, content, callback) {
        let promise;
        try {
            this._validateFilename(filename);
            const filePath = path.join(this.baseDir, filename);
            promise = writeFileAsync(filePath, content, 'utf8').then(() => filePath);
        } catch (err) {
            promise = Promise.reject(err);
        }
        return this._handle(promise, callback);
    }

    /**
     * Чтение файла.
     * Поддерживает: readFile(name, callback) и readFile(name)
     */
    readFile(filename, callback) {
        let promise;
        try {
            this._validateFilename(filename);
            const filePath = path.join(this.baseDir, filename);
            promise = readFileAsync(filePath, 'utf8');
        } catch (err) {
            promise = Promise.reject(err);
        }
        return this._handle(promise, callback);
    }

    /**
     * Получение статистики файла.
     */
    getFileStats(filename, callback) {
        let promise;
        try {
            this._validateFilename(filename);
            const filePath = path.join(this.baseDir, filename);
            promise = statAsync(filePath).then((stats) => ({
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isFile: stats.isFile(),
            }));
        } catch (err) {
            promise = Promise.reject(err);
        }
        return this._handle(promise, callback);
    }

    /**
     * Удаление файла.
     */
    deleteFile(filename, callback) {
        let promise;
        try {
            this._validateFilename(filename);
            const filePath = path.join(this.baseDir, filename);
            promise = unlinkAsync(filePath);
        } catch (err) {
            promise = Promise.reject(err);
        }
        return this._handle(promise, callback);
    }

    /**
     * Список файлов в директории (без вложенных папок).
     */
    listFiles(callback) {
        const promise = readdirAsync(this.baseDir)
            .then((files) =>
                Promise.all(
                    files.map((file) =>
                        statAsync(path.join(this.baseDir, file)).then((stats) => ({
                            name: file,
                            isFile: stats.isFile(),
                        }))
                    )
                )
            )
            .then((results) =>
                results.filter((r) => r.isFile).map((r) => r.name)
            );

        return this._handle(promise, callback);
    }

    /**
     * Создание нескольких файлов параллельно.
     */
    createMultipleFiles(files, callback) {
        const promise = Promise.all(
            files.map(({ filename, content }) =>
                this.createFile(filename, content)
            )
        );
        return this._handle(promise, callback);
    }

    /**
     * Чтение нескольких файлов параллельно.
     * Возвращает объект { filename: content }.
     */
    readMultipleFiles(filenames, callback) {
        const promise = Promise.all(
            filenames.map((filename) =>
                this.readFile(filename).then((content) => ({
                    [filename]: content,
                }))
            )
        ).then((results) => Object.assign({}, ...results));

        return this._handle(promise, callback);
    }
}

module.exports = FileManagerHybrid;