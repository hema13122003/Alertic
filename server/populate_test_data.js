const db = require('./db');

async function populateToday() {
  try {
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    if (day === 'Sunday') {
        console.log('Today is Sunday, skipping automatic population.');
        process.exit(0);
    }
    
    console.log(`Setting up experimental classes for ${day}...`);
    
    // Add classes for each the four main faculties recorded
    const testData = [
      { f_id: 1, p: 1, s_name: 'Advanced Algorithms', rm: 'Lab A' },
      { f_id: 1, p: 2, s_name: 'System Design', rm: 'Room 101' },
      { f_id: 2, p: 2, s_name: 'Web Tech Lab', rm: 'Lab B' },
      { f_id: 4, p: 1, s_name: 'Software Testing', rm: 'Room 205' },
      { f_id: 5, p: 1, s_name: 'Project Management', rm: 'Seminar Hall' }
    ];

    for (const data of testData) {
      await db.execute(`
        INSERT INTO timetable (dept, section, faculty_id, subject_name, day, period, classroom, academic_year, program, semester)
        VALUES ('CA', 'B', ?, ?, ?, ?, ?, '2023-24', 'MCA', '3')
        ON DUPLICATE KEY UPDATE subject_name = VALUES(subject_name)
      `, [data.f_id, data.s_name, day, data.p, data.rm]);
    }
    
    console.log(`Successfully populated ${testData.length} records for ${day}.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

populateToday();
