const express = require("express");
const router = express.Router();
const { admin, db } = require("../db");

// Login API
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;
  try {
    // 1. Get User by Email from Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(identifier).catch(() => null);
    
    if (!userRecord) {
      return res.status(401).json({ Success: false, Message: "Access Denied: Identifier not found in system." });
    }

    // 2. Check Faculties Collection first
    let userDoc = await db.collection("faculties").doc(userRecord.uid).get();
    let userData = null;
    let role = null;

    if (userDoc.exists) {
      userData = userDoc.data();
      role = 'faculty';
    } else {
      // 3. Check Students Collection
      userDoc = await db.collection("students").doc(userRecord.uid).get();
      if (userDoc.exists) {
        userData = userDoc.data();
        role = 'student';
      }
    }

    // Special case for Admin (if needed, or check custom claims)
    if (!role && identifier.includes('admin')) {
      role = 'admin';
    }

    res.status(200).json({
      Success: true,
      Message: "Login Successful! Welcome to Alertic.",
      Data: {
        id: userRecord.uid,
        email: userRecord.email,
        role: role || userData?.role || 'student',
        ...userData
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ Success: false, Message: "Internal Server Error" });
  }
});

module.exports = router;
