const mysql = require('mysql2/promise');
require('dotenv').config();

const updateSchema = async () => {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT)
        });

        console.log('Updating timetable table...');
        try {
            await db.execute('ALTER TABLE timetable ADD COLUMN subject_name VARCHAR(255)');
            console.log('Added subject_name column');
        } catch (e) {
            console.log('subject_name column might already exist:', e.message);
        }

        try {
            await db.execute('ALTER TABLE timetable MODIFY COLUMN subject_id INT NULL');
            console.log('Modified subject_id to be nullable');
        } catch (e) {
            console.log('Error modifying subject_id:', e.message);
        }

        await db.end();
        console.log('Database updated successfully');
        process.exit(0);
    } catch (error) {
        console.error('Update failed:', error);
        process.exit(1);
    }
};

updateSchema();
