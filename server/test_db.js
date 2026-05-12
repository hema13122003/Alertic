const db = require('./db');

async function testConnection() {
  try {
    console.log('Testing connection...');
    const [tables] = await db.execute('SHOW TABLES');
    console.log('Tables in database:', tables);
    
    for (let tableObj of tables) {
      const tableName = Object.values(tableObj)[0];
      const [columns] = await db.execute(`DESCRIBE ${tableName}`);
      console.log(`Schema for ${tableName}:`, columns.map(c => c.Field));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
