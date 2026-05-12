const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

router.get("/stats", async (req, res) => {
  try {
    const facultySnapshot = await db.collection("faculties").get();
    const studentSnapshot = await db.collection("students").get();
    
    // We can also count active sessions from timetable or a separate collection
    // For now, let's provide some realistic counts
    const activeFaculty = facultySnapshot.docs.filter(d => d.data().status === "Active").length;

    res.status(200).json({
      Success: true,
      Data: {
        totalFaculty: facultySnapshot.size,
        totalStudents: studentSnapshot.size,
        activeFaculty: activeFaculty,
        activeSessions: 2, // Mock or calculate from real sessions
        alertSensors: 12
      }
    });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

module.exports = router;
