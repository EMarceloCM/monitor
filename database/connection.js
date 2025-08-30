const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: 'localhost',
        user: 'root',
        password: 'abc123',
        database: 'monitorDB'
    }
});

module.exports = knex;