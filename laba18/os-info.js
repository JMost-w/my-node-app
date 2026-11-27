// os-info.js — базовая информация о системе (модуль os)
const os = require('os');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';

// Форматирование uptime в «3 ч 25 мин 12 сек»
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h} ч ${m} мин ${s} сек`;
}

const platform = os.platform();
const type = os.type();
const arch = os.arch();
const release = os.release();
const hostname = os.hostname();
const uptime = os.uptime();

console.log(`=== Информация о системе (группа ${GROUP}) ===`);
console.log(`Студент: ${STUDENT}`);
console.log(`Платформа: ${platform}`);
console.log(`Тип ОС: ${type}`);
console.log(`Архитектура: ${arch}`);
console.log(`Версия ОС: ${release}`);
console.log(`Имя хоста: ${hostname}`);
console.log(`Время работы: ${formatUptime(uptime)}`);

// Условный вывод по платформе
switch (platform) {
    case 'win32':
        console.log('Вы работаете в Windows');
        break;
    case 'linux':
        console.log('Вы работаете в Linux');
        break;
    case 'darwin':
        console.log('Вы работаете в macOS');
        break;
    default:
        console.log('Неизвестная платформа');
}