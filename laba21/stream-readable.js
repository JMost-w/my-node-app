// stream-readable.js — Readable-поток, генерирующий данные по частям
const { Readable } = require('stream');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

// ---------- Чанки с информацией ----------
const CHUNKS = [
    `Группа: ${GROUP}`,
    `Студент: ${STUDENT}`,
    `Лабораторная работа: №21`,
    `Тема: Потоки в Node.js`
];

// ---------- Создание Readable-потока ----------
let chunkIndex = 0;

const readable = new Readable({
    // _read вызывается, когда потребитель готов принять новые данные
    read(size) {
        if (chunkIndex >= CHUNKS.length) {
            // null — сигнал конца потока
            this.push(null);
            return;
        }
        const chunk = CHUNKS[chunkIndex];
        chunkIndex++;
        // push добавляет чанк в буфер; encode в Buffer для точного подсчёта байт
        this.push(Buffer.from(chunk, 'utf8'));
    },
    // encoding: 'utf8' // можно указать, тогда push принимает строки
});

// ---------- Статистика ----------
let chunkCount = 0;
let totalBytes = 0;

console.log('=== Демонстрация Readable-потока ===');

// ---------- Подписка на события ----------
readable.on('data', (chunk) => {
    chunkCount++;
    totalBytes += chunk.length;
    const ts = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[CHUNK ${chunkCount}] [${ts}] ${chunk.toString('utf8')}`);
});

readable.on('end', () => {
    console.log('[END] Поток завершён');
    console.log(`Всего получено чанков: ${chunkCount}`);
    console.log(`Общий размер данных: ${totalBytes} байт`);
});

readable.on('error', (err) => {
    console.error('[ERROR]', err.message);
});

// Readable автоматически переходит в flowing-режим при подписке на 'data'