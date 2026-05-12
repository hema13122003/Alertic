
const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
  });

  try {
    console.log('Opening connection to database...');
    
    // Disable foreign key checks to allow truncating
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    console.log('Clearing staff table...');
    await connection.query('TRUNCATE TABLE staff');
    
    console.log('Clearing students table...');
    await connection.query('TRUNCATE TABLE students');

    console.log('Clearing users table (preserving admin)...');
    await connection.query("DELETE FROM users WHERE role != 'admin'");
    
    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('Successfully cleared all data from staff, students, and non-admin users.');
  } catch (error) {
    console.error('Error clearing data:', error);
  } finally {
    await connection.end();
  }
}

clearData();
