const { Command } = require('commander');
const buildService = require('../services/buildService');
const { withErrorHandling } = require('../utils/errors');

module.exports = new Command('build')
    .description('собрать проект')
    .option('--dry-run', 'показать что будет сделано без выполнения')
    .option('-c, --config <path>', 'путь к конфигу', 'config.json')
    .action(withErrorHandling(async (options) => {
        await buildService.build(options);
    }));