const db = require('./db');

async function checkData() {
  try {
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    console.log('Today is:', day);
    const [rows] = await db.execute('SELECT * FROM timetable WHERE day = ?', [day]);
    console.log('Number of entries for today:', rows.length);
    if (rows.length > 0) {
      console.log('Faculties with classes today:', [...new Set(rows.map(r => r.faculty_id))]);
    } else {
        const [all] = await db.execute('SELECT DISTINCT day FROM timetable');
        console.log('Days with data in database:', all.map(a => a.day));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
