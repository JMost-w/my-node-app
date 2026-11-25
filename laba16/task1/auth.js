// auth.js — регистрация, логин, middleware проверки JWT
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lab16-secret-key-change-me';
const JWT_EXPIRES = '24h';

const users = [
    // предсозданный администратор (пароль: admin123)
    {
        id: 1,
        email: 'admin@lib.com',
        name: 'Администратор',
        role: 'admin',
        passwordHash: bcrypt.hashSync('admin123', 10)
    }
];

let nextUserId = 2;

function register({ email, password, name }) {
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        const err = new Error('Пользователь с таким email уже существует');
        err.status = 409;
        throw err;
    }

    const user = {
        id: nextUserId++,
        email: email.toLowerCase(),
        name,
        role: 'user',
        passwordHash: bcrypt.hashSync(password, 10)
    };
    users.push(user);

    return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function login({ email, password }) {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        const err = new Error('Неверный email или пароль');
        err.status = 401;
        throw err;
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );

    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Требуется JWT токен', status: 401 });
    }

    const token = header.slice(7);
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Невалидный или истёкший токен', status: 401 });
    }
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администраторов', status: 403 });
    }
    next();
}

module.exports = { register, login, authenticate, requireAdmin, users };