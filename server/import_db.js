const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importDb() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        multipleStatements: true
    };

    let connection;
    try {
        console.log('Connecting to MySQL...');
        connection = await mysql.createConnection(config);
        console.log('Connected.');

        const sqlPath = path.join(__dirname, 'init_db.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL script...');
        // We can run the whole file at once because multipleStatements is true
        await connection.query(sql);
        console.log('Database and tables created successfully.');

    } catch (error) {
        console.error('Error importing database:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

importDb();
