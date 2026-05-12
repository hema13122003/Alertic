const db = require('./db');
const fs = require('fs');

async function testConnection() {
  let output = '';
  try {
    output += 'Testing connection...\n';
    const [tables] = await db.execute('SHOW TABLES');
    output += `Tables in database: ${JSON.stringify(tables)}\n`;
    
    for (let tableObj of tables) {
      const tableName = Object.values(tableObj)[0];
      const [columns] = await db.execute(`DESCRIBE ${tableName}`);
      output += `Schema for ${tableName}: ${columns.map(c => c.Field).join(', ')}\n`;
    }
    
    fs.writeFileSync('db_schema_check.txt', output);
    process.exit(0);
  } catch (error) {
    fs.writeFileSync('db_schema_check.txt', output + '\nERROR: ' + error.message);
    process.exit(1);
  }
}

testConnection();
