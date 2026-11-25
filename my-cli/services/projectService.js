// services/projectService.js — бизнес-логика init
const fs = require('fs');
const path = require('path');
const out = require('../utils/output');

async function init(name, type) {
    const dir = path.resolve(name);

    if (fs.existsSync(dir)) {
        throw new Error(`Директория "${name}" уже существует`);
    }

    fs.mkdirSync(dir, { recursive: true });

    // package.json проекта
    const pkg = {
        name,
        version: '1.0.0',
        type: type === 'cli' ? 'commonjs' : 'module',
        scripts: { start: 'node index.js' }
    };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));

    // точка входа
    fs.writeFileSync(path.join(dir, 'index.js'), `console.log('Hello from ${name}!');\n`);

    // .gitignore
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n');

    out.success(`Проект "${name}" создан`);
    out.success('Установлены зависимости (эмуляция)');
    out.success('Инициализирован Git-репозиторий (эмуляция)');
    out.info('Проект готов к работе!');
}

module.exports = { init };