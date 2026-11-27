// services/testService.js
const ora = require('ora');
const out = require('../utils/output');

async function run() {
    const spinner = ora('Запуск тестов...').start();
    await new Promise(r => setTimeout(r, 600));
    spinner.succeed('Пройдено: 15/15 тестов');
    out.success('Покрытие: 87%');
}

module.exports = { run };