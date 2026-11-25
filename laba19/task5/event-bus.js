// event-bus.js — EventBus с приоритетами, wildcard, once-кэшем и метриками
const EventEmitter = require('events');

const GROUP = '401';

class EventBus extends EventEmitter {
    constructor() {
        super();
        // карта: событие → массив { listener, priority, once, id }
        this._listeners = new Map();
        // wildcard-слушатели
        this._anyListeners = [];
        // метрики: событие → { count, errors, lastCall }
        this._metrics = new Map();
        // счётчик id для стабильной сортировки при равном приоритете
        this._nextId = 1;
    }

    // ---------- Подписка ----------
    on(event, listener, priority = 0) {
        if (typeof listener !== 'function') {
            throw new TypeError('listener должен быть функцией');
        }
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push({
            listener,
            priority,
            once: false,
            id: this._nextId++
        });
        // сортировка: по убыванию приоритета, при равенстве — по id (порядок добавления)
        this._listeners.get(event).sort((a, b) =>
            b.priority - a.priority || a.id - b.id
        );
        return this;
    }

    once(event, listener, priority = 0) {
        if (typeof listener !== 'function') {
            throw new TypeError('listener должен быть функцией');
        }
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push({
            listener,
            priority,
            once: true,
            id: this._nextId++
        });
        this._listeners.get(event).sort((a, b) =>
            b.priority - a.priority || a.id - b.id
        );
        return this;
    }

    // ---------- Wildcard ----------
    onAny(listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('listener должен быть функцией');
        }
        this._anyListeners.push(listener);
        return this;
    }

    // ---------- Отписка ----------
    off(event, listener) {
        const list = this._listeners.get(event);
        if (!list) return this;
        const idx = list.findIndex(e => e.listener === listener);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) this._listeners.delete(event);
        return this;
    }

    // ---------- Вызов ----------
    emit(event, ...args) {
        // 1. Метрики
        this._incMetric(event, 'count');
        const metric = this._metrics.get(event);
        metric.lastCall = new Date().toISOString();

        // 2. Wildcard-слушатели
        for (const fn of this._anyListeners) {
            try {
                fn(event, args);
            } catch (err) {
                this._handleError(event, fn, err);
            }
        }

        // 3. Обычные слушатели (уже отсортированы)
        const list = this._listeners.get(event);
        if (!list || list.length === 0) {
            // событие error без слушателя — бросаем
            if (event === 'error') {
                throw args[0] instanceof Error
                    ? args[0]
                    : new Error(String(args[0]));
            }
            return false;
        }

        // Копируем, чтобы once-слушатели не сломали итерацию при удалении
        const snapshot = [...list];
        for (const entry of snapshot) {
            // once — удаляем ДО вызова, чтобы избежать рекурсии
            if (entry.once) {
                this.off(event, entry.listener);
            }
            try {
                entry.listener(...args);
            } catch (err) {
                this._handleError(event, entry.listener, err);
            }
        }
        return true;
    }

    // ---------- Метрики ----------
    _incMetric(event, field) {
        if (!this._metrics.has(event)) {
            this._metrics.set(event, { count: 0, errors: 0, lastCall: null });
        }
        this._metrics.get(event)[field]++;
    }

    _handleError(event, listener, err) {
        this._incMetric(event, 'errors');
        console.error(`[ERROR] [${GROUP}] Ошибка в слушателе "${event}": ${err.message}`);
        // Эмитим специальное событие для сбора ошибок (если есть слушатель)
        if (event !== 'error' && this._listeners.has('error')) {
            // не рекурсия: error-слушатель вызываем напрямую
            const errorList = this._listeners.get('error');
            for (const entry of errorList) {
                try {
                    entry.listener(err, event);
                } catch (e) {
                    console.error(`[ERROR] [${GROUP}] Ошибка в error-слушателе: ${e.message}`);
                }
            }
        }
    }

    getMetrics() {
        const events = {};
        let total = 0;
        for (const [event, m] of this._metrics) {
            events[event] = m.count;
            total += m.count;
        }

        const listeners = {};
        for (const [event, list] of this._listeners) {
            listeners[event] = list.length;
        }

        return {
            group: GROUP,
            events,
            total,
            listeners,
            errors: this._getErrors(),
            lastCalls: this._getLastCalls()
        };
    }

    _getErrors() {
        const result = {};
        for (const [event, m] of this._metrics) {
            if (m.errors > 0) result[event] = m.errors;
        }
        return result;
    }

    _getLastCalls() {
        const result = {};
        for (const [event, m] of this._metrics) {
            if (m.lastCall) result[event] = m.lastCall;
        }
        return result;
    }

    // Для отладки
    listenerCount(event) {
        const list = this._listeners.get(event);
        return list ? list.length : 0;
    }
}

module.exports = { EventBus, GROUP };