const { Command } = require('commander');
const projectService = require('../services/projectService');
const { withErrorHandling } = require('../utils/errors');

module.exports = new Command('init')
    .description('инициализировать проект')
    .option('-n, --name <name>', 'название проекта', 'my-app')
    .option('-t, --type <type>', 'тип проекта (cli|web|lib)', 'cli')
    .action(withErrorHandling(async (options) => {
        await projectService.init(options.name, options.type);
    }));