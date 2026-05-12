const admin = require("firebase-admin");
const mysql = require("mysql2/promise");
require("dotenv").config();

// Neenga unga serviceAccountKey.json file-ah intha folder-la veikanum
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log("Connected to MySQL. Starting migration...");

  // 1. Migrate Faculties
  console.log("Migrating Faculties...");
  const [faculties] = await connection.execute("SELECT * FROM faculties");
  for (const faculty of faculties) {
    await db.collection("faculties").add({
      ...faculty,
      source: "mysql_migration",
      migratedAt: new Date()
    });
  }

  // 2. Migrate Students
  console.log("Migrating Students...");
  const [students] = await connection.execute("SELECT * FROM students");
  for (const student of students) {
    await db.collection("students").add({
      ...student,
      source: "mysql_migration",
      migratedAt: new Date()
    });
  }

  // 3. Migrate Timetable
  console.log("Migrating Timetable...");
  const [timetable] = await connection.execute("SELECT * FROM timetable");
  for (const slot of timetable) {
    await db.collection("timetable").add({
      ...slot,
      source: "mysql_migration",
      migratedAt: new Date()
    });
  }

  console.log("Migration completed successfully! 🎉");
  process.exit();
}

migrate().catch(console.error);
