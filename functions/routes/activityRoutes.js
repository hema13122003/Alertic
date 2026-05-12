const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

// Get recent activity logs
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("activity_logs")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
      
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ Success: true, Data: logs });
  } catch (error) {
    console.error("Activity logs fetch error:", error);
    res.status(500).json({ Success: false, Message: error.message });
  }
});

module.exports = router;
