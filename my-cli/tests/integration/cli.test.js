const { execSync } = require('child_process');

function run(args) {
    try {
        return { stdout: execSync(`node bin/cli.js ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }), code: 0 };
    } catch (e) {
        return { stdout: e.stdout || '', stderr: e.stderr || '', code: e.status };
    }
}

describe('CLI integration', () => {
    test('--help выводит справку', () => {
        const r = run('--help');
        expect(r.code).toBe(0);
        expect(r.stdout).toMatch(/Usage: my-cli/);
    });

    test('--version выводит версию', () => {
        const r = run('--version');
        expect(r.code).toBe(0);
        expect(r.stdout.trim()).toBe('1.0.0');
    });

    test('неизвестная команда → код 1', () => {
        const r = run('unknown');
        expect(r.code).toBe(1);
    });
});