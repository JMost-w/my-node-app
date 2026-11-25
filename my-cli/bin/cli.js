#!/usr/bin/env node
// bin/cli.js — только маппинг команд, никакой бизнес-логики
const { Command } = require('commander');
const { handleFatal } = require('../utils/errors');

// Глобальные обработчики — ДО любых действий
process.on('uncaughtException', handleFatal);
process.on('unhandledRejection', handleFatal);

const program = new Command();

program
    .name('my-cli')
    .description('CLI-приложение для лабораторной работы №17 (группа 401, БТК)')
    .version('1.0.0', '-V, --version', 'output the version number');

// Подключаем команды
program.addCommand(require('../commands/init'));
program.addCommand(require('../commands/build'));
program.addCommand(require('../commands/test'));
program.addCommand(require('../commands/deploy'));

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    program.help();
}