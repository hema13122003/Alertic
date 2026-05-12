const mysql = require('mysql2/promise');
require('dotenv').config();

const inspect = async () => {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT)
        });

        const [create] = await db.execute('SHOW CREATE TABLE timetable');
        console.log('--- CREATE TABLE ---');
        console.log(create[0]['Create Table']);

        const [rows] = await db.execute('SELECT * FROM timetable LIMIT 5');
        console.log('--- DATA SAMPLE ---');
        console.log(JSON.stringify(rows, null, 2));

        await db.end();
    } catch (e) {
        console.error(e);
    }
};

inspect();
