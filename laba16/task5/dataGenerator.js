// dataGenerator.js — генерация 100 книг
const AUTHORS = ['Толстой','Достоевский','Булгаков','Тургенев','Гоголь',
    'Лермонтов','Пушкин','Шолохов','Чехов','Гончаров',
    'Куприн','Бунин','Горький','Маяковский','Есенин',
    'Ахматова','Цветаева','Пастернак','Солженицын','Набоков'];
const TITLES = ['Война и мир','Преступление и наказание','Мастер и Маргарита',
    'Анна Каренина','Идиот','Отцы и дети','Мёртвые души','Ревизор',
    'Герой нашего времени','Евгений Онегин','Тихий Дон','Собачье сердце',
    'Вишнёвый сад','Обломов','Гранатовый браслет','Тёмные аллеи',
    'Старуха Изергиль','Облако в штанах','Письмо матери','Реквием',
    'Доктор Живаго','Архипелаг ГУЛАГ','Лолита','Двенадцать стульев',
    'Золотой телёнок','Пётр Первый','Хождение по мукам','Белая гвардия'];
const GENRES = ['роман','повесть','рассказ','поэма','комедия','драма','эпопея'];

function generateISBN() {
    const prefix = '978';
    let body = '';
    for (let i = 0; i < 9; i++) body += Math.floor(Math.random() * 10);
    const digits = prefix + body;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    return `${prefix}-${body.slice(0,1)}-${body.slice(1,5)}-${body.slice(5,9)}-${check}`;
}

function generateBooks(count = 100, seed = 401) {
    const books = [];
    let rng = seed;
    const random = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
    for (let i = 1; i <= count; i++) {
        const author = AUTHORS[Math.floor(random() * AUTHORS.length)];
        const title = TITLES[Math.floor(random() * TITLES.length)];
        const genre = GENRES[Math.floor(random() * GENRES.length)];
        const year = 1800 + Math.floor(random() * 225);
        const totalCopies = 1 + Math.floor(random() * 5);
        const availableCopies = Math.floor(random() * (totalCopies + 1));
        books.push({
            id: i,
            title: `${title} (изд. ${year})`,
            author, year, genre,
            isbn: generateISBN(),
            totalCopies, availableCopies,
            reviews: []
        });
    }
    return books;
}

module.exports = { generateBooks };