'use strict';

const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');

const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const { generateStudents } = require('./data/generator');

const app = new Koa();
const router = new Router();

const PORT = 3000;
const GROUP = '401';           // твоя группа студента

// ============================================================
//  ХРАНИЛИЩЕ С АВТОГЕНЕРАЦИЕЙ 50 СТУДЕНТОВ
// ============================================================
let students = generateStudents(50, 'ББМО-01-23');
let nextId = students.length + 1;

console.log(`📊 Сгенерировано ${students.length} студентов`);
console.log(`   Группы: ${[...new Set(students.map((s) => s.group))].join(', ')}`);

// ============================================================
//  MIDDLEWARE
// ============================================================
app.use(errorHandler);
app.use(logger);
app.use(bodyParser());

// ============================================================
//  ВАЛИДАЦИЯ
// ============================================================

function parseGroup(str) {
  if (typeof str !== 'string') return null;
  const m = str.match(/^([А-ЯA-Z]+)-(\d+)-(\d{2})$/i);
  if (!m) return null;
  return {
    prefix: m[1],
    num: parseInt(m[2], 10),
    year: parseInt(m[3], 10),
    fullYear: 2000 + parseInt(m[3], 10),
  };
}

function validateCreate(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Тело запроса должно быть JSON-объектом'];

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Поле "name" обязательно и должно быть непустой строкой');
  }
  if (!body.group || typeof body.group !== 'string' || !body.group.trim()) {
    errors.push('Поле "group" обязательно и должно быть непустой строкой');
  } else if (!parseGroup(body.group)) {
    errors.push('Поле "group" должно соответствовать формату "ПРЕФИКС-NN-YY", например "ББМО-01-23"');
  }
  if (body.course === undefined || body.course === null) {
    errors.push('Поле "course" обязательно');
  } else if (!Number.isInteger(body.course) || body.course < 1 || body.course > 4) {
    errors.push('Поле "course" должно быть целым числом от 1 до 4');
  }
  return errors;
}

function validateUpdate(body) {
  const errors = [];
  const updates = {};

  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return { errors: ['Тело запроса должно содержать хотя бы одно поле'], updates };
  }
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) errors.push('Поле "name" должно быть непустой строкой');
    else updates.name = body.name.trim();
  }
  if (body.group !== undefined) {
    if (typeof body.group !== 'string' || !parseGroup(body.group)) errors.push('Поле "group" имеет неверный формат');
    else updates.group = body.group.trim();
  }
  if (body.course !== undefined) {
    if (!Number.isInteger(body.course) || body.course < 1 || body.course > 4) errors.push('Поле "course" должно быть целым числом 1..4');
    else updates.course = body.course;
  }
  return { errors, updates };
}

// ============================================================
//  ПАРСИНГ ПАГИНАЦИИ И СОРТИРОВКИ
// ============================================================

const ALLOWED_SORT_FIELDS = ['id', 'name', 'group', 'course'];

function parsePagination(query) {
  const limitRaw = query.limit !== undefined ? Number(query.limit) : 10;
  const offsetRaw = query.offset !== undefined ? Number(query.offset) : 0;

  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 10;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  return { limit, offset };
}

function applySort(arr, sortParam) {
  if (!sortParam) return arr;

  const desc = sortParam.startsWith('-');
  const field = desc ? sortParam.slice(1) : sortParam;

  if (!ALLOWED_SORT_FIELDS.includes(field)) {
    const err = new Error(`Недопустимое поле сортировки: "${field}". Разрешены: ${ALLOWED_SORT_FIELDS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const sorted = [...arr].sort((a, b) => {
    const va = a[field];
    const vb = b[field];
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va).localeCompare(String(vb), 'ru');
  });

  return desc ? sorted.reverse() : sorted;
}

// ============================================================
//  КОРНЕВОЙ МАРШРУТ
// ============================================================
router.get('/', async (ctx) => {
  ctx.type = 'text/html; charset=utf-8';
  ctx.body = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Лабораторная работа №15 — Задание 5</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg,#667eea,#764ba2);
           min-height:100vh; margin:0; display:flex; align-items:center; justify-content:center; }
    .card { background:#fff; border-radius:16px; padding:40px 60px; box-shadow:0 20px 50px rgba(0,0,0,.25); max-width:760px; }
    h1 { color:#4a3f9f; text-align:center; }
    .info-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee; }
    .endpoint { background:#f0f4ff; padding:8px 12px; border-radius:6px; margin:6px 0; font-family:monospace; font-size:13px; }
    .method { display:inline-block; min-width:70px; font-weight:bold; color:#4a3f9f; }
    .q { color:#e83e8c; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Лабораторная работа №15 — Задание 5</h1>
    <div class="info-row"><span>Группа студента:</span><b>${GROUP}</b></div>
    <div class="info-row"><span>Всего студентов:</span><b>${students.length}</b></div>
    <div class="info-row"><span>Дата:</span><b>${new Date().toLocaleDateString('ru-RU')}</b></div>

    <h3>Возможности API:</h3>
    <div class="endpoint"><span class="method">GET</span>/students</div>
    <div class="endpoint"><span class="method">GET</span>/students?limit=5&offset=10</div>
    <div class="endpoint"><span class="method">GET</span>/students?sort=name</div>
    <div class="endpoint"><span class="method">GET</span>/students?sort=-course</div>
    <div class="endpoint"><span class="method">GET</span>/students?search=Алек</div>
    <div class="endpoint"><span class="method">GET</span>/students?group=ББМО-01-23&course=2</div>
    <div class="endpoint"><span class="method">GET</span>/students/1</div>
    <div class="endpoint"><span class="method">POST</span>/students</div>
    <div class="endpoint"><span class="method">PUT</span>/students/1</div>
    <div class="endpoint"><span class="method">DELETE</span>/students/1</div>

    <p style="text-align:center;margin-top:20px;">
      <a href="/students?limit=5">Попробовать →</a>
    </p>
  </div>
</body>
</html>`;
});

// ============================================================
//  GET /students — список с пагинацией, сортировкой, поиском
// ============================================================
router.get('/students', async (ctx) => {
  const { limit, offset } = parsePagination(ctx.query);
  const { sort, search, group, course } = ctx.query;

  // 1. Фильтрация
  let filtered = [...students];

  if (group) {
    filtered = filtered.filter((s) => s.group === group);
  }

  if (course !== undefined) {
    const c = Number(course);
    if (!Number.isInteger(c) || c < 1 || c > 4) {
      ctx.throw(400, 'Query-параметр "course" должен быть целым числом от 1 до 4');
    }
    filtered = filtered.filter((s) => s.course === c);
  }

  if (search) {
    const needle = String(search).toLowerCase().trim();
    if (needle) {
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(needle));
    }
  }

  const total = filtered.length;

  // 2. Сортировка
  let sorted = applySort(filtered, sort);

  // 3. Пагинация
  const page = sorted.slice(offset, offset + limit);

  // 4. Формируем ответ с метаданными
  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  ctx.body = {
    meta: {
      total,
      limit,
      offset,
      page: currentPage,
      totalPages,
      hasNext: offset + limit < total,
      hasPrev: offset > 0,
    },
    filters: {
      group: group || null,
      course: course !== undefined ? Number(course) : null,
      search: search || null,
      sort: sort || null,
    },
    data: page,
  };
});

// ============================================================
//  GET /students/:id — один студент
// ============================================================
router.get('/students/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) ctx.throw(400, 'ID должен быть положительным целым числом');

  const student = students.find((s) => s.id === id);
  if (!student) ctx.throw(404, `Студент с id=${id} не найден`);

  ctx.body = student;
});

// ============================================================
//  POST /students — создание
// ============================================================
router.post('/students', async (ctx) => {
  const errors = validateCreate(ctx.request.body);
  if (errors.length) ctx.throw(400, errors.join('; '));

  const { name, group, course } = ctx.request.body;
  const parsed = parseGroup(group);

  const newStudent = {
    id: nextId++,
    name: name.trim(),
    group: group.trim(),
    course,
    gender: 'unknown',
    enrollmentYear: parsed.fullYear,
    graduateYear: parsed.fullYear + 4,
  };

  students.push(newStudent);
  ctx.status = 201;
  ctx.body = newStudent;
});

// ============================================================
//  PUT /students/:id — обновление
// ============================================================
router.put('/students/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) ctx.throw(400, 'ID должен быть положительным целым числом');

  const student = students.find((s) => s.id === id);
  if (!student) ctx.throw(404, `Студент с id=${id} не найден`);

  const { errors, updates } = validateUpdate(ctx.request.body);
  if (errors.length) ctx.throw(400, errors.join('; '));

  Object.assign(student, updates);

  if (updates.group) {
    const parsed = parseGroup(student.group);
    if (parsed) {
      student.enrollmentYear = parsed.fullYear;
      student.graduateYear = parsed.fullYear + 4;
    }
  }

  ctx.body = student;
});

// ============================================================
//  DELETE /students/:id — удаление
// ============================================================
router.delete('/students/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) ctx.throw(400, 'ID должен быть положительным целым числом');

  const index = students.findIndex((s) => s.id === id);
  if (index === -1) ctx.throw(404, `Студент с id=${id} не найден`);

  const [deleted] = students.splice(index, 1);
  ctx.body = { message: `Студент с id=${id} успешно удалён`, student: deleted };
});

// ============================================================
//  ПОДКЛЮЧЕНИЕ И ЗАПУСК
// ============================================================
app.use(router.routes());
app.use(router.allowedMethods());

app.on('error', (err) => {
  if (err.status >= 500 || !err.status) console.error('🔥', err.message);
});

app.listen(PORT, () => {
  console.log('=============================================');
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
  console.log(`📚 Лабораторная работа №15 — Задание 5`);
  console.log(`👥 Группа студента: ${GROUP}`);
  console.log(`📊 Студентов в базе: ${students.length}`);
  console.log('=============================================');
  console.log('Примеры запросов:');
  console.log('  GET /students?limit=5&offset=10');
  console.log('  GET /students?sort=name');
  console.log('  GET /students?sort=-course');
  console.log('  GET /students?search=Алек');
  console.log('  GET /students?group=ББМО-01-23&course=2');
  console.log('=============================================');
});