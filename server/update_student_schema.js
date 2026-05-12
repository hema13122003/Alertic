const db = require('./db');

async function updateStudentSchema() {
  try {
    console.log("Updating students table schema...");
    
    // Check if columns exist before adding them
    const [cols] = await db.execute("SHOW COLUMNS FROM students");
    const colNames = cols.map(c => c.Field);
    
    const requiredCols = [
        { name: 'dept', type: 'VARCHAR(100)' },
        { name: 'section', type: 'VARCHAR(50)' },
        { name: 'program', type: 'VARCHAR(100)' },
        { name: 'semester', type: 'VARCHAR(50)' },
        { name: 'academic_year', type: 'VARCHAR(50)' }
    ];

    for (const col of requiredCols) {
        if (!colNames.includes(col.name)) {
            await db.execute(`ALTER TABLE students ADD COLUMN ${col.name} ${col.type}`);
            console.log(`Added column: ${col.name}`);
        }
    }

    console.log("Schema update complete.");
    process.exit(0);
  } catch (err) {
    console.error("Schema update failed:", err);
    process.exit(1);
  }
}

updateStudentSchema();
