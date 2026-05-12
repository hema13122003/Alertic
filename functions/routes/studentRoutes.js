const express = require("express");
const router = express.Router();
const { admin, db, FieldValue } = require("../db");

const DEPT_MAP = {
  "Computer Science and Engineering": { code: "CSE" },
  "Information Technology": { code: "IT" },
  "Electronics and Communication Engineering": { code: "ECE" },
  "Electrical and Electronics Engineering": { code: "EEE" },
  "Mechanical Engineering": { code: "MECH" },
  "Civil Engineering": { code: "CIVIL" },
  "Artificial Intelligence and Data Science": { code: "AIDS" },
  "Artificial Intelligence and Machine Learning": { code: "AIML" },
  "Computer Science and Business Systems": { code: "CSBS" },
  "Master of Computer Applications": { code: "MCA" },
  "Master of Business Administration": { code: "MBA" }
};

// Get all students
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("students").get();
    const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ Success: true, Data: students });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Student Dashboard Data
router.get("/dashboard/:enroll_no", async (req, res) => {
  const { enroll_no } = req.params;
  try {
    // 1. Get Student Info
    const studentSnapshot = await db.collection("students").where("enroll_no", "==", enroll_no).get();
    if (studentSnapshot.empty) {
      return res.status(404).json({ Success: false, Message: "Student not found" });
    }
    const studentData = studentSnapshot.docs[0].data();
    
    // 2. Get Today's Schedule
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    
    const deptCode = DEPT_MAP[studentData.dept]?.code || studentData.dept?.substring(0,3).toUpperCase();
    const group_id = studentData.group_id || `${deptCode}-${studentData.program}-SEM${studentData.semester}-${studentData.section}`;
    
    const timetableSnapshot = await db.collection("timetable")
      .where("group_id", "==", group_id)
      .where("day", "==", today)
      .get();
    
    let schedule = timetableSnapshot.docs.map(doc => doc.data());
    
    // 3. Enrich schedule with Faculty names
    const facultySnapshot = await db.collection("faculties").get();
    const facultyMap = {};
    facultySnapshot.forEach(doc => {
      facultyMap[doc.id] = doc.data().name;
    });

    schedule = schedule.map(item => ({
      ...item,
      faculty_name: facultyMap[item.faculty_id] || "TBA"
    })).sort((a, b) => a.period - b.period);

    res.status(200).json({
      Success: true,
      Data: {
        student: studentData,
        schedule: schedule
      }
    });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Add/Upsert Student
router.post("/", async (req, res) => {
  const studentData = req.body;
  try {
    if (!studentData.email || !studentData.name || !studentData.enroll_no) {
      return res.status(400).json({ Success: false, Message: "Email, Name, and Enrollment No are required." });
    }

    const enrollCheck = await db.collection("students").where("enroll_no", "==", studentData.enroll_no).get();
    if (!enrollCheck.empty) {
      const existing = enrollCheck.docs[0].data();
      if (existing.email !== studentData.email) {
        return res.status(400).json({ Success: false, Message: `Enrollment No ${studentData.enroll_no} is already assigned to ${existing.name}.` });
      }
    }

    let userRecord;
    try {
      let password = studentData.password ? studentData.password.toString() : "12345678";
      if (password.length < 6) password = password.padEnd(6, '0');

      userRecord = await admin.auth().createUser({
        email: studentData.email,
        password: password,
        displayName: studentData.name,
      });
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        userRecord = await admin.auth().getUserByEmail(studentData.email);
      } else {
        throw authError;
      }
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: "student" });

    await db.collection("students").doc(userRecord.uid).set({
      ...studentData,
      uid: userRecord.uid,
      role: "student",
      status: studentData.status || "Active",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(201).json({ Success: true, Message: "Student record synchronized successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Update Student
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  try {
    if (updateData.enroll_no) {
      const enrollCheck = await db.collection("students").where("enroll_no", "==", updateData.enroll_no).get();
      if (!enrollCheck.empty && enrollCheck.docs[0].id !== id) {
        return res.status(400).json({ Success: false, Message: "Enrollment No already in use by another student." });
      }
    }

    await db.collection("students").doc(id).update({
      ...updateData,
      updatedAt: FieldValue.serverTimestamp()
    });
    res.status(200).json({ Success: true, Message: "Student updated successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Delete Student
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await db.collection("students").doc(id).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.uid) await admin.auth().deleteUser(data.uid);
      await db.collection("students").doc(id).delete();
    }
    res.status(200).json({ Success: true, Message: "Student removed successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

module.exports = router;
