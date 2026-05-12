const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
  });

  try {
    console.log('Fixing schema constraints...');
    
    // Modify staff table to allow NULL for unique fields
    await connection.query('ALTER TABLE staff MODIFY emp_id VARCHAR(50) NULL');
    await connection.query('ALTER TABLE staff MODIFY email VARCHAR(255) NULL');
    await connection.query('ALTER TABLE staff MODIFY phone VARCHAR(20) NULL');
    
    // Modify users table to allow NULL for unique fields (email is often mandatory but let's make it consistent for the fix)
    await connection.query('ALTER TABLE users MODIFY email VARCHAR(255) NULL');
    await connection.query('ALTER TABLE users MODIFY phone VARCHAR(20) NULL');
    await connection.query('ALTER TABLE users MODIFY emp_id VARCHAR(50) NULL');
    
    console.log('Schema fixed successfully.');
  } catch (error) {
    console.error('Schema fix failed:', error);
  } finally {
    await connection.end();
  }
}

fixSchema();
