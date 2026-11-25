// index.js — логика команд

const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const LAB = '№17';
const UNIVERSITY = 'БТК';

function help() {
    console.log('Использование: my-cli <команда> [аргументы]');
    console.log('');
    console.log('Доступные команды:');
    console.log('  greet <имя>  - поприветствовать пользователя');
    console.log('  info         - вывести информацию о группе');
    console.log('');
    console.log('Флаги:');
    console.log('  --help, -h   - показать эту справку');
}

function greet(name) {
    console.log(`Привет, ${name}! Добро пожаловать в CLI-приложение группы ${GROUP}.`);
}

function info() {
    console.log(`Группа: ${GROUP}`);
    console.log(`Студент: ${STUDENT}`);
    console.log(`Университет: ${UNIVERSITY}`);
    console.log(`Лабораторная работа: ${LAB}`);
    console.log(`Дата: ${new Date().toISOString().slice(0, 10)}`);
}

module.exports = { help, greet, info };