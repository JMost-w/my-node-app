const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Данные студента
const GROUP = '401';
const STUDENT = 'Максим Мазан Борисович';
const UNIVERSITY = 'БТК';

// Раздача статики (CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Вспомогательная функция для получения текущей даты и времени
function getCurrentDateTime() {
    const now = new Date();
    return now.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

// Общая обёртка HTML-страницы
function htmlTemplate(title, content) {
    return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link rel="stylesheet" href="/style.css">
    </head>
    <body>
        <div class="container">
            ${content}
            <footer>
                <a href="/">Главная</a> |
                <a href="/about">О разработчике</a> |
                <a href="/contacts">Контакты</a>
            </footer>
        </div>
    </body>
    </html>`;
}

// ---------- Маршрут: Главная ----------
app.get('/', (req, res) => {
    const content = `
        <h1>Лабораторная работа №16</h1>
        <h2>Группа: ${GROUP}</h2>
        <p><strong>Студент:</strong> ${STUDENT}</p>
        <p><strong>Текущая дата и время:</strong> ${getCurrentDateTime()}</p>
        <p class="greeting">Добро пожаловать на мой веб-сервер! 👋</p>
        
        <h3>Доступные маршруты:</h3>
        <ul>
            <li><a href="/">/</a> — Главная страница</li>
            <li><a href="/about">/about</a> — Информация о разработчике</li>
            <li><a href="/contacts">/contacts</a> — Контактная информация</li>
        </ul>
    `;
    res.send(htmlTemplate('Главная — Лабораторная работа №16', content));
});

// ---------- Маршрут: О разработчике ----------
app.get('/about', (req, res) => {
    const content = `
        <h1>О разработчике</h1>
        <p><strong>Студент:</strong> ${STUDENT}</p>
        <p><strong>Группа:</strong> ${GROUP}</p>
        <p><strong>ВУЗ:</strong> ${UNIVERSITY}</p>
        <p><strong>Специальность:</strong> Безопасность информационных систем</p>
        <p>Данный сервер разработан в рамках выполнения лабораторной работы №16.</p>
    `;
    res.send(htmlTemplate('О разработчике', content));
});

// ---------- Маршрут: Контакты ----------
app.get('/contacts', (req, res) => {
    const content = `
        <h1>Контактная информация</h1>
        <ul>
            <li><strong>Студент:</strong> ${STUDENT}</li>
            <li><strong>Группа:</strong> ${GROUP}</li>
            <li><strong>Email:</strong> mazan@example.com</li>
            <li><strong>Телефон:</strong> +7 (999) 123-45-67</li>
            <li><strong>Telegram:</strong> @mazan</li>
        </ul>
    `;
    res.send(htmlTemplate('Контакты', content));
});

// ---------- 404 ----------
app.use((req, res) => {
    res.status(404).send(htmlTemplate('404 — Страница не найдена',
        '<h1>404</h1><p>Запрашиваемая страница не найдена.</p>'));
});

// ---------- Запуск ----------
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
    console.log(`   Студент: ${STUDENT}, группа ${GROUP}, ${UNIVERSITY}`);
    console.log(`   Маршруты: /  /about  /contacts`);
});