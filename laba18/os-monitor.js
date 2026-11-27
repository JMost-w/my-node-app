// os-monitor.js — мониторинг CPU/RAM в реальном времени
const os = require('os');
const fs = require('fs');
const path = require('path');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const LOG_FILE = path.join(__dirname, 'monitor.log');
const INTERVAL_MS = 2000;

// ---------- Утилиты ----------
function toGB(bytes) { return (bytes / 1024 ** 3).toFixed(2); }

function timestamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function logAnomaly(message) {
    const line = `[${timestamp()}] [${GROUP}] Предупреждение: ${message}\n`;
    fs.appendFileSync(LOG_FILE, line);
}

// ---------- Замер CPU ----------
function cpuSnapshot() {
    return os.cpus().map(c => ({ ...c.times }));
}

function calcCpuLoad(prev, curr) {
    let idleDiff = 0, totalDiff = 0;
    for (let i = 0; i < curr.length; i++) {
        const p = prev[i], c = curr[i];
        const idle = c.idle - p.idle;
        const total =
            (c.user - p.user) + (c.nice - p.nice) + (c.sys - p.sys) +
            (c.idle - p.idle) + (c.irq - p.irq);
        idleDiff += idle;
        totalDiff += total;
    }
    if (totalDiff === 0) return 0;
    return ((totalDiff - idleDiff) / totalDiff) * 100;
}

// ---------- Первичный сбор (слепок системы) ----------
console.log(`Мониторинг (группа ${GROUP}). Ctrl+C для выхода.`);
console.log(`Студент: ${STUDENT}`);
console.log(`Платформа: ${os.platform()} / ${os.arch()}`);
console.log('');

const snapshot = {
    timestamp: new Date().toISOString(),
    group: GROUP,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0].model.trim(),
    totalMemGB: Number(toGB(os.totalmem())),
    freeMemGB: Number(toGB(os.freemem()))
};
console.log('[SNOPSHOT]', JSON.stringify(snapshot, null, 2));
console.log('');

// ---------- Мониторинг ----------
let prev = cpuSnapshot();
let warnings = 0;
let timer = null;
let stopping = false;

function render() {
    const curr = cpuSnapshot();
    const cpu = calcCpuLoad(prev, curr);
    prev = curr;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedPercent = ((totalMem - freeMem) / totalMem) * 100;
    const freePercent = (freeMem / totalMem) * 100;

    // Адаптивный вывод
    let status = '';
    if (cpu > 80) {
        status = ' ⚠⚠ КРИТИЧНО (CPU)';
        warnings++;
        logAnomaly(`CPU ${cpu.toFixed(1)}% > 80% (критично)`);
    } else if (cpu > 50) {
        status = ' ⚠ (CPU)';
        warnings++;
        logAnomaly(`CPU ${cpu.toFixed(1)}% > 50% (предупреждение)`);
    }

    if (freePercent < 10) {
        status += ' ⚠ МАЛО RAM';
        warnings++;
        logAnomaly(`RAM свободно ${freePercent.toFixed(1)}% < 10%`);
    }

    // Перерисовка через \r
    process.stdout.write(
        `\rCPU: ${cpu.toFixed(1).padStart(5)}% | ` +
        `RAM: ${usedPercent.toFixed(1).padStart(4)}% ` +
        `(${toGB(freeMem)} ГБ свободно)` +
        `${status}    `
    );
}

function start() {
    timer = setInterval(render, INTERVAL_MS);
    // Первый рендер сразу, чтобы не ждать 2 сек
    render();
}

// ---------- Корректное завершение ----------
function shutdown() {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    process.stdout.write('\n\n');
    console.log(`Мониторинг остановлен. Предупреждений: ${warnings}`);
    console.log(`Лог: ${LOG_FILE}`);
    process.exit(0);
}

process.on('SIGINT', shutdown);   // Ctrl+C
process.on('SIGTERM', shutdown);  // kill

// ---------- Запуск ----------
start();