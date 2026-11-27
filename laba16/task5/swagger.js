// swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Library API — Лабораторная работа №16',
            version: '1.0.0',
            description: 'REST API библиотеки с JWT, отзывами, экспортом и рекомендациями'
        },
        servers: [{ url: 'http://localhost:3000' }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
            }
        }
    },
    apis: ['./server.js']
};

module.exports = swaggerJsdoc(options);