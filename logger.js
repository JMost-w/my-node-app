function setupLogger(app) {
    app.on('server:started', (port) => {
        console.log(`[LOG]  Сервер запущен на порту ${port}`);
    });

    app.on('request:received', ({ method, url }) => {
        console.log(`[LOG]  ${method} ${url}`);
    });

    app.on('server:stopped', () => {
        console.log(`[LOG]  Сервер остановлен`);
    });
}

module.exports = { setupLogger };