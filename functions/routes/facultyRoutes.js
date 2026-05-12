const express = require("express");
const router = express.Router();
const { admin, db, FieldValue } = require("../db");

// Get all faculties
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("faculties").get();
    const faculties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ Success: true, Data: faculties });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Faculty Dashboard Data (Today's Schedule)
router.get("/dashboard/:faculty_id", async (req, res) => {
  const { faculty_id } = req.params;
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const snapshot = await db.collection("timetable")
      .where("faculty_id", "==", faculty_id)
      .where("day", "==", today)
      .get();

    const schedule = snapshot.docs.map(doc => {
      const data = doc.data();
      // Parse group_id (Format: DEPT-PROG-SEM-SEC)
      const parts = (data.group_id || "").split("-");
      return { 
        id: doc.id, 
        ...data,
        dept: parts[0] || "DEPT",
        program: parts[1] || "PROG",
        semester: parts[2]?.replace("SEM", "") || "?",
        section: parts[3] || "SEC"
      };
    }).sort((a, b) => a.period - b.period);

    res.status(200).json({ Success: true, Data: { schedule } });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Full Weekly Timetable for Faculty
router.get("/full-timetable/:faculty_id", async (req, res) => {
  const { faculty_id } = req.params;
  try {
    const snapshot = await db.collection("timetable")
      .where("faculty_id", "==", faculty_id)
      .get();

    const timetable = snapshot.docs.map(doc => {
      const data = doc.data();
      const parts = (data.group_id || "").split("-");
      return { 
        id: doc.id, 
        ...data,
        dept: parts[0] || "DEPT",
        program: parts[1] || "PROG",
        semester: parts[2]?.replace("SEM", "") || "?",
        section: parts[3] || "SEC"
      };
    });
    res.status(200).json({ Success: true, Data: timetable });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Manual Log Activation
router.post("/manual-log", async (req, res) => {
  const logData = req.body;
  try {
    await db.collection("activity").add({
      ...logData,
      type: "session_activation",
      timestamp: FieldValue.serverTimestamp()
    });
    res.status(200).json({ Success: true, Message: "Session activated successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Add/Upsert Faculty
router.post("/", async (req, res) => {
  const facultyData = req.body;
  try {
    if (!facultyData.email || !facultyData.name || !facultyData.emp_id) {
      return res.status(400).json({ Success: false, Message: "Email, Name, and Employee ID are required." });
    }

    const empCheck = await db.collection("faculties").where("emp_id", "==", facultyData.emp_id).get();
    if (!empCheck.empty) {
      const existingFaculty = empCheck.docs[0].data();
      if (existingFaculty.email !== facultyData.email) {
        return res.status(400).json({ Success: false, Message: `Employee ID ${facultyData.emp_id} is already assigned to another faculty (${existingFaculty.name}).` });
      }
    }

    let userRecord;
    try {
      let password = facultyData.password ? facultyData.password.toString() : "123456";
      if (password.length < 6) password = password.padEnd(6, '0');

      userRecord = await admin.auth().createUser({
        email: facultyData.email,
        password: password,
        displayName: facultyData.name,
      });
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        userRecord = await admin.auth().getUserByEmail(facultyData.email);
      } else {
        console.error("Auth Creation Error:", authError);
        throw authError;
      }
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: "faculty" });

    await db.collection("faculties").doc(userRecord.uid).set({
      ...facultyData,
      uid: userRecord.uid,
      role: "faculty",
      status: facultyData.status || "Active",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(201).json({ Success: true, Message: "Faculty record synchronized successfully" });
  } catch (error) {
    console.error("Faculty Sync POST Error:", error);
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Update Faculty
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  try {
    if (updateData.emp_id) {
      const empCheck = await db.collection("faculties").where("emp_id", "==", updateData.emp_id).get();
      if (!empCheck.empty && empCheck.docs[0].id !== id) {
        return res.status(400).json({ Success: false, Message: "Employee ID already in use by another record." });
      }
    }

    await db.collection("faculties").doc(id).update({
      ...updateData,
      updatedAt: FieldValue.serverTimestamp()
    });
    res.status(200).json({ Success: true, Message: "Faculty updated successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Delete Faculty
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await db.collection("faculties").doc(id).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.uid) await admin.auth().deleteUser(data.uid);
      await db.collection("faculties").doc(id).delete();
    }
    res.status(200).json({ Success: true, Message: "Faculty removed successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

module.exports = router;
