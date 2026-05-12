const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTable() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'alertic_db'
    });
    
    try {
        const [columns] = await connection.execute('DESCRIBE timetable');
        console.log(JSON.stringify(columns, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkTable();
