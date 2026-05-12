const express = require("express");
const router = express.Router();
const { admin, db, FieldValue } = require("../db");

// Get Timetable by Group ID
router.get("/", async (req, res) => {
  const { group_id } = req.query;
  try {
    if (!group_id) {
      return res.status(200).json({ Success: true, Data: [], Message: "No group_id provided" });
    }
    const snapshot = await db.collection("timetable")
      .where("group_id", "==", group_id)
      .get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ Success: true, Data: data });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// List all unique timetables
router.get("/list", async (req, res) => {
  try {
    const snapshot = await db.collection("timetable").get();
    const allData = snapshot.docs.map(doc => doc.data());
    
    const unique = [];
    const seen = new Set();
    for (const item of allData) {
      if (item.group_id && !seen.has(item.group_id)) {
        seen.add(item.group_id);
        unique.push(item);
      }
    }
    
    res.status(200).json({ Success: true, Data: unique });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Get ALL assignments for conflict checking
router.get("/all-assignments", async (req, res) => {
  try {
    const snapshot = await db.collection("timetable").get();
    const data = snapshot.docs.map(doc => doc.data());
    res.status(200).json({ Success: true, Data: data });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Check for faculty conflicts
router.post("/check-conflict", async (req, res) => {
    const { faculty_id, day, period, academic_year, group_id } = req.body;
    try {
        const snapshot = await db.collection("timetable")
            .where("faculty_id", "==", faculty_id)
            .where("day", "==", day)
            .where("period", "==", period)
            .where("academic_year", "==", academic_year)
            .get();
        
        let hasConflict = false;
        let conflictData = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.group_id !== group_id) {
                hasConflict = true;
                conflictData = data;
            }
        });

        if (hasConflict) {
            return res.status(200).json({
                Success: true,
                Data: {
                    hasConflict: true,
                    message: `Faculty is already assigned to ${conflictData.program} (Section ${conflictData.section}) during this period.`
                }
            });
        }

        res.status(200).json({ Success: true, Data: { hasConflict: false } });
    } catch (error) {
        res.status(500).json({ Success: false, Message: error.message });
    }
});

// Batch Save Timetable
router.post("/batch", async (req, res) => {
  const { entries } = req.body;
  try {
    if (!entries || entries.length === 0) {
        return res.status(400).json({ Success: false, Message: "No entries provided" });
    }
    const group_id = entries[0].group_id;
    const batch = db.batch();
    
    const existing = await db.collection("timetable").where("group_id", "==", group_id).get();
    existing.forEach(doc => batch.delete(doc.ref));

    entries.forEach(entry => {
      const docRef = db.collection("timetable").doc();
      batch.set(docRef, { 
        ...entry, 
        updatedAt: FieldValue.serverTimestamp() 
      });
    });
    
    await batch.commit();
    res.status(200).json({ Success: true, Message: "Timetable updated successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Bulk Delete Timetable
router.delete("/bulk/delete", async (req, res) => {
    const { group_id } = req.query;
    try {
        const snapshot = await db.collection("timetable").where("group_id", "==", group_id).get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        res.status(200).json({ Success: true, Message: "Timetable deleted successfully" });
    } catch (error) {
        res.status(500).json({ Success: false, Message: error.message });
    }
});

// Delete individual slot
router.delete("/:id", async (req, res) => {
  try {
    await db.collection("timetable").doc(req.params.id).delete();
    res.status(200).json({ Success: true, Message: "Slot cleared" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// --- TIMETABLE STRUCTURE ---
// Get all structures (for admin list)
router.get("/structure/all", async (req, res) => {
  try {
    const snapshot = await db.collection("timetable_structures").get();
    const list = [];
    snapshot.forEach(doc => {
      list.push(doc.data());
    });
    res.status(200).json({ Success: true, Data: list });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Get structure for a group
router.get("/structure/:group_id", async (req, res) => {
  const { group_id } = req.params;
  try {
    const doc = await db.collection("timetable_structures").doc(group_id).get();
    if (doc.exists) {
      res.status(200).json({ Success: true, Data: doc.data().structure });
    } else {
      res.status(200).json({ Success: true, Data: null }); // Default will be used by frontend
    }
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Delete structure for a group
router.delete("/structure/:group_id", async (req, res) => {
  const { group_id } = req.params;
  try {
    await db.collection("timetable_structures").doc(group_id).delete();
    res.status(200).json({ Success: true, Message: "Structure deleted successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Save structure for a group
router.post("/structure", async (req, res) => {
  const { group_id, structure } = req.body;
  try {
    await db.collection("timetable_structures").doc(group_id).set({
      group_id,
      structure,
      updatedAt: FieldValue.serverTimestamp()
    });
    res.status(200).json({ Success: true, Message: "Structure saved successfully" });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Check Faculty Conflict
router.get("/check-conflict", async (req, res) => {
  const { faculty_id, day, period_id, current_group_id } = req.query;
  try {
    // Query timetable for this faculty at this time in OTHER groups
    const snapshot = await db.collection("timetable")
      .where("faculty_id", "==", faculty_id)
      .where("day", "==", day)
      .where("period_id", "==", period_id)
      .get();

    let conflict = null;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.group_id !== current_group_id) {
        conflict = { id: doc.id, ...data };
      }
    });

    res.status(200).json({ Success: true, Conflict: conflict });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

// Atomic Override Faculty
router.post("/override-faculty", async (req, res) => {
  const { faculty_id, day, period_id, new_group_id, conflict_doc_id } = req.body;
  try {
    const batch = db.batch();
    
    // 1. Remove from old assignment
    if (conflict_doc_id) {
      batch.delete(db.collection("timetable").doc(conflict_doc_id));
    }

    // 2. The actual save for the new one will happen during the main Save call, 
    // but we can clear the old one now for immediate consistency.
    
    await batch.commit();
    res.status(200).json({ Success: true, Message: "Conflict resolved: Faculty reassigned." });
  } catch (error) {
    res.status(500).json({ Success: false, Message: error.message });
  }
});

module.exports = router;
