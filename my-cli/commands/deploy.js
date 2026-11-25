const { Command } = require('commander');
const deployService = require('../services/deployService');
const { withErrorHandling } = require('../utils/errors');

module.exports = new Command('deploy')
    .description('развернуть проект')
    .option('-e, --env <env>', 'окружение (development|production)', 'development')
    .option('-f, --force', 'подтвердить без вопроса')
    .action(withErrorHandling(async (options) => {
        await deployService.deploy(options);
    }));