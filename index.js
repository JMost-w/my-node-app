const http = require('http');
const fullName = 'Мазан Максим Борисович';
const group = '401';

function calculatePiMonteCarlo(points = 1000000) {
    let inside = 0;
    
    for (let i = 0; i < points; i++) {
        const x = Math.random();
        const y = Math.random();
        
        if (x * x + y * y <= 1) {
            inside++;
        }
    }
    
    return (inside / points) * 4;
}

const pi = calculatePiMonteCarlo();

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    
    res.end(`
        <h1>${fullName}</h1>
        <h2>Группа: ${group}</h2>
        <h3>Число Пи (метод Монте-Карло): ${pi}</h3>
        <p>Номер в журнале: 11</p>
    `);
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log(`Число Пи (Монте-Карло): ${pi}`);
}); 