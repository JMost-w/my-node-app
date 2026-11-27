// services/buildService.js
const fs = require('fs');
const path = require('path');
const ora = require('ora');
const out = require('../utils/output');

async function build(options) {
    const configPath = path.resolve(options.config);

    // Демонстрация ошибки: файл конфигурации не найден
    if (!fs.existsSync(configPath)) {
        const err = new Error(`файл ${options.config} не найден`);
        err.code = 'ENOENT';
        throw err;
    }

    if (options.dryRun) {
        out.warn('DRY-RUN: сборка не выполнена');
        out.info(`Будет использован конфиг: ${options.config}`);
        return;
    }

    const spinner = ora('Сборка проекта...').start();
    const start = Date.now();

    await sleep(800);

    const distDir = path.resolve('dist');
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'my-app.js'), '// bundled\n');

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    spinner.succeed(`Сборка завершена за ${elapsed}s`);
    out.success('Результат: dist/my-app.js');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { build };