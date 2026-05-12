const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

// Get all subjects
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("subjects").get();
    const subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ Success: true, Data: subjects });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Add a subject
router.post("/", async (req, res) => {
  const subjectData = req.body;
  try {
    const docRef = await db.collection("subjects").add({
      ...subjectData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(201).json({ Success: true, id: docRef.id, Message: "Subject added successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Delete a subject
router.delete("/:id", async (req, res) => {
  try {
    await db.collection("subjects").doc(req.params.id).delete();
    res.status(200).json({ Success: true, Message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

module.exports = router;
