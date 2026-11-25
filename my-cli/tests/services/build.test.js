const fs = require('fs');
const path = require('path');
const buildService = require('../../services/buildService');

describe('buildService', () => {
    test('выбрасывает ошибку, если config не найден', async () => {
        await expect(buildService.build({ config: 'nonexistent.json' }))
            .rejects.toThrow(/не найден/);
    });

    test('dry-run не создаёт dist', async () => {
        const configPath = path.resolve('test-config.json');
        fs.writeFileSync(configPath, '{}');
        try {
            await buildService.build({ config: 'test-config.json', dryRun: true });
            expect(fs.existsSync(path.resolve('dist', 'my-app.js'))).toBe(false);
        } finally {
            if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
        }
    });
});