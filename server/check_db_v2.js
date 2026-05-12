const db = require('./db');

async function checkAllWednesday() {
  try {
    const [rows] = await db.execute('SELECT * FROM timetable WHERE day = "Wednesday"');
    console.log('Wednesday Data:', JSON.stringify(rows, null, 2));
    
    const [faculties] = await db.execute('SELECT id, name, emp_id FROM faculties');
    console.log('All Faculties:', JSON.stringify(faculties, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAllWednesday();
