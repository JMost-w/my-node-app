// services/deployService.js
const readline = require('readline');
const ora = require('ora');
const out = require('../utils/output');

async function deploy(options) {
    const env = options.env;

    if (env === 'production' && !options.force) {
        out.warn('Вы собираетесь развернуть проект в production!');
        const answer = await ask('Продолжить? (y/N) ');
        if (answer.toLowerCase() !== 'y') {
            out.info('Развёртывание отменено');
            return;
        }
    }

    const spinner = ora('Развёртывание...').start();
    await new Promise(r => setTimeout(r, 700));
    spinner.succeed('Развёрнуто успешно');
    out.info(`URL: https://my-app.example.com (${env})`);
}

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    return new Promise(resolve => {
        rl.question(question, ans => { rl.close(); resolve(ans); });
    });
}

module.exports = { deploy };