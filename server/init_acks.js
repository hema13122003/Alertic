const db = require('./db');

const initAcks = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS acknowledgments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        faculty_id INT,
        subject_name VARCHAR(255),
        room_number VARCHAR(100),
        ack_time DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Acknowledgments table ready.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating acknowledgments table:", err);
    process.exit(1);
  }
};

initAcks();
