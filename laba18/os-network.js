// os-network.js — сетевые интерфейсы + информация о пользователе
const os = require('os');

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';

// ---------- Маскирование MAC ----------
function maskMAC(mac) {
    if (!mac || mac === '00:00:00:00:00:00') return '—';
    const parts = mac.split(':');
    // первые 3 октета оставляем, последние 3 маскируем
    return [...parts.slice(0, 3), '**', '**', '**'].join(':').toUpperCase();
}

// ---------- Признак «внутреннего» интерфейса ----------
function isInternal(iface) {
    const name = iface.name.toLowerCase();
    if (iface.internal) return true;
    return name === 'lo' || name === 'lo0' || name.startsWith('loopback');
}

// ---------- Сбор интерфейсов ----------
function collectInterfaces() {
    const nets = os.networkInterfaces();
    const result = [];

    for (const [name, addrs] of Object.entries(nets)) {
        if (!addrs) continue;
        for (const addr of addrs) {
            result.push({
                name,
                family: addr.family === 'IPv4' || addr.family === 4 ? 'IPv4' : 'IPv6',
                address: addr.address,
                mac: addr.mac,
                internal: addr.internal
            });
        }
    }
    return result;
}

// ---------- Вывод ----------
console.log('=== Сетевые интерфейсы ===');
const interfaces = collectInterfaces();

interfaces.forEach((i, idx) => {
    console.log(`\nИнтерфейс: ${i.name} (${i.family})`);
    console.log(`  Адрес: ${i.address}`);
    if (i.family === 'IPv4') {
        console.log(`  MAC: ${maskMAC(i.mac)}`);
    }
    console.log(`  Внутренний: ${i.internal ? 'да' : 'нет'}`);
});

console.log(`\nВсего интерфейсов: ${new Set(interfaces.map(i => i.name)).size}`);

// ---------- Основной интерфейс ----------
// Первый внешний IPv4
const main = interfaces.find(i =>
    i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254')
);

console.log(`Основной интерфейс: ${main ? `${main.name} (${main.address})` : 'не найден'}`);

// ---------- Пользователь ----------
console.log('\n=== Информация о пользователе ===');

const userInfo = os.userInfo();
console.log(`Имя пользователя: ${userInfo.username}`);
console.log(`UID: ${userInfo.uid}`);
console.log(`GID: ${userInfo.gid}`);
console.log(`Домашняя директория: ${userInfo.homedir}`);
console.log(`Оболочка: ${userInfo.shell || 'не определена (Windows)'}`);
console.log(`Группа: ${GROUP}`);
console.log(`Студент: ${STUDENT}`);

// ---------- Проверка root ----------
const isRoot = typeof userInfo.uid === 'number' && userInfo.uid === 0;
console.log(`Проверка root: ${isRoot ? 'ДА — вы root!' : 'нет'}`);


if (isRoot) {
    console.log('⚠ ВНИМАНИЕ: не рекомендуется запускать скрипты от root');
}
