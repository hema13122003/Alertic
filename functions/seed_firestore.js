const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const seedDatabase = async () => {
  try {
    console.log("Starting Firestore Seeding...");

    // 1. Create Default Admin in Auth & Firestore (if not exists)
    const adminEmail = "admin@alertic.com";
    let adminUser;
    try {
      adminUser = await admin.auth().getUserByEmail(adminEmail);
    } catch (e) {
      adminUser = await admin.auth().createUser({
        email: adminEmail,
        password: "admin123",
        displayName: "System Admin"
      });
      await admin.auth().setCustomUserClaims(adminUser.uid, { role: "admin" });
    }

    await db.collection("users").doc(adminUser.uid).set({
      email: adminEmail,
      role: "admin",
      name: "System Admin",
      status: "Active"
    }, { merge: true });

    // 2. Initialize Collections with a placeholder (Firestore creates collections automatically on first write)
    // We can just log the structure we are following
    const collections = [
      "faculties",
      "students",
      "subjects",
      "timetable",
      "acknowledgments",
      "alert_settings",
      "notification_triggers",
      "activity_logs"
    ];

    for (const col of collections) {
      // Just adding a metadata doc to ensure collection exists
      await db.collection("_metadata").doc(col).set({
        initialized: true,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`- Collection structure for '${col}' is ready.`);
    }

    // 3. Add some sample activity logs
    console.log("Adding sample activity logs...");
    const sampleLogs = [
      { name: 'Admin System', action: 'Firebase Migration Success', color: 'bg-emerald-600', code: 'SYS_READY', timestamp: admin.firestore.FieldValue.serverTimestamp() },
      { name: 'Alert Engine', action: 'Node-Cron Monitoring Active', color: 'bg-blue-600', code: 'CRON_LIVE', timestamp: admin.firestore.FieldValue.serverTimestamp() },
      { name: 'Firestore', action: 'Database Schema Localized', color: 'bg-orange-500', code: 'DB_SYNC', timestamp: admin.firestore.FieldValue.serverTimestamp() }
    ];

    for (const log of sampleLogs) {
      await db.collection("activity_logs").add(log);
    }

    console.log("Firestore Seeding Completed Successfully! 🎉");
    process.exit(0);
  } catch (error) {
    console.error("Seeding Error:", error);
    process.exit(1);
  }
};

seedDatabase();
