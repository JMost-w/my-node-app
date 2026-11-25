const { Command } = require('commander');
const testService = require('../services/testService');
const { withErrorHandling } = require('../utils/errors');

module.exports = new Command('test')
    .description('запустить тесты')
    .action(withErrorHandling(async () => {
        await testService.run();
    }));