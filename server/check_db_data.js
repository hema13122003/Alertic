const db = require('./db');
const fs = require('fs');

async function checkData() {
  let output = '';
  try {
    output += 'Checking database content...\n\n';
    
    // Check staff
    const [staff] = await db.execute('SELECT * FROM staff');
    output += `Staff Count: ${staff.length}\n`;
    output += `Staff Records: ${JSON.stringify(staff, null, 2)}\n\n`;
    
    // Check students
    const [students] = await db.execute('SELECT * FROM students');
    output += `Student Count: ${students.length}\n`;
    output += `Student Records: ${JSON.stringify(students, null, 2)}\n\n`;
    
    // Check users
    const [users] = await db.execute('SELECT * FROM users');
    output += `User Count: ${users.length}\n`;
    output += `User Records: ${JSON.stringify(users.map(u => ({...u, password: '***'}), null, 2))}\n\n`;
    
    fs.writeFileSync('db_data_dump.txt', output);
    console.log('Data dump complete. Check db_data_dump.txt');
    process.exit(0);
  } catch (error) {
    console.error('Data check failed:', error);
    process.exit(1);
  }
}

checkData();
