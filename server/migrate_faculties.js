const db = require('./db');

const migrateFaculties = async () => {
  try {
    // Check if staff table exists
    const [tables] = await db.execute("SHOW TABLES LIKE 'staff'");
    if (tables.length === 0) {
      console.log("Creating faculties table...");
      await db.execute(`
        CREATE TABLE IF NOT EXISTS faculties (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          emp_id VARCHAR(50) UNIQUE NOT NULL,
          dept VARCHAR(100),
          email VARCHAR(255) UNIQUE,
          phone VARCHAR(20) UNIQUE,
          role VARCHAR(50) DEFAULT 'faculty',
          status VARCHAR(20) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      console.log("Renaming staff to faculties...");
      await db.execute("RENAME TABLE staff TO faculties");
    }
    console.log("Faculties table synchronized.");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
};

migrateFaculties();
