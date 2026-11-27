// utils/output.js — данные → stdout, логи → stderr
const chalk = require('chalk');

const out = {
    data: (t) => process.stdout.write(t + '\n'),
    success: (t) => process.stderr.write(chalk.green('✔ ' + t) + '\n'),
    warn: (t) => process.stderr.write(chalk.yellow('⚠ ' + t) + '\n'),
    error: (t) => process.stderr.write(chalk.red('✖ ' + t) + '\n'),
    info: (t) => process.stderr.write(chalk.blue('ℹ ' + t) + '\n')
};

module.exports = out;