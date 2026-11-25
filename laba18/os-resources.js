// os-resources.js — информация о CPU, памяти и средней загрузке
const os = require('os');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';

// ---------- Вспомогательные ----------
function toGB(bytes) {
    return (bytes / 1024 ** 3).toFixed(2);
}

// ---------- CPU ----------
console.log('=== Информация о процессоре ===');
const cpus = os.cpus();
console.log(`Количество логических ядер: ${cpus.length}`);
console.log(`Модель процессора: ${cpus[0].model.trim()}`);

// Частоты каждого ядра
cpus.forEach((cpu, i) => {
    console.log(`  Ядро ${i + 1}: ${cpu.speed} МГц`);
});

// Средняя частота
const avgSpeed = cpus.reduce((sum, c) => sum + c.speed, 0) / cpus.length;
console.log(`Средняя частота: ${avgSpeed.toFixed(0)} МГц`);

// ---------- Память ----------
console.log('\n=== Информация о памяти ===');
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedMem = totalMem - freeMem;
const usedPercent = (usedMem / totalMem) * 100;
const freePercent = (freeMem / totalMem) * 100;

console.log(`Общий объём: ${toGB(totalMem)} ГБ`);
console.log(`Свободно: ${toGB(freeMem)} ГБ`);
console.log(`Использовано: ${toGB(usedMem)} ГБ (${usedPercent.toFixed(1)}%)`);
console.log(`Группа: ${GROUP}`);
console.log(`Студент: ${STUDENT}`);

// Адаптивный вывод: если свободно < 20% — предупреждение
if (freePercent < 20) {
    console.log(`⚠ ВНИМАНИЕ: свободной памяти меньше 20% (${freePercent.toFixed(1)}%)`);
    console.log('⚠ Рекомендуется закрыть неиспользуемые приложения');
} else {
    console.log(`✔ Память в норме (свободно ${freePercent.toFixed(1)}%)`);
}

// ---------- Средняя загрузка ----------
console.log('\n=== Средняя загрузка системы ===');
const loadavg = os.loadavg();
console.log(`За 1 минуту:  ${loadavg[0].toFixed(2)}`);
console.log(`За 5 минут:   ${loadavg[1].toFixed(2)}`);
console.log(`За 15 минут:  ${loadavg[2].toFixed(2)}`);

if (os.platform() === 'win32') {
    console.log('ℹ На Windows значения loadavg всегда равны [0, 0, 0] (не поддерживается)');
}