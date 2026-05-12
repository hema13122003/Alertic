const mysql = require('mysql2/promise');
require('dotenv').config();

const fixDatabase = async () => {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT)
        });

        console.log('Changing semester to varchar...');
        try {
            await db.execute('ALTER TABLE timetable MODIFY COLUMN semester VARCHAR(50)');
        } catch (e) {
            console.log('Failed to modify semester:', e.message);
        }

        console.log('Dropping old unique key...');
        try {
            await db.execute('ALTER TABLE timetable DROP INDEX unique_slot');
        } catch (e) {
            console.log('unique_slot does not exist or already dropped');
        }

        console.log('Adding new unique key including program...');
        await db.execute('ALTER TABLE timetable ADD UNIQUE KEY unique_slot (dept, section, program, semester, day, period)');

        console.log('Updating existing null values to empty strings...');
        await db.execute("UPDATE timetable SET program = '' WHERE program IS NULL");
        await db.execute("UPDATE timetable SET semester = '' WHERE semester IS NULL");

        await db.end();
        console.log('Database fixed successfully');
    } catch (error) {
        console.error('Fix failed:', error);
    }
};

fixDatabase();
