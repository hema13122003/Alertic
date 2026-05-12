const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkIndexes() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'alertic_db'
    });
    
    try {
        const [indexes] = await connection.execute('SHOW INDEX FROM timetable');
        console.log(JSON.stringify(indexes, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkIndexes();
