import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase";

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

export const timetableService = {
  // 1. Get Timetable Structure
  getStructure: async (groupId) => {
    if (!groupId) return null;
    let docRef = doc(db, "timetable_structures", groupId);
    let docSnap = await getDoc(docRef);
    if (!docSnap.exists() && groupId.startsWith("MCA-")) {
       const legacyId = groupId.replace("MCA-", "Master of Computer Applications-");
       docRef = doc(db, "timetable_structures", legacyId);
       docSnap = await getDoc(docRef);
    }
    if (!docSnap.exists()) {
       const parts = groupId.split('-');
       if (parts.length >= 4) {
          const prog = parts[1];
          const sem = parts[2].replace("SEM", "");
          const sec = parts[3];
          const qSnap = await getDocs(collection(db, "timetable_structures"));
          const matchingDoc = qSnap.docs.find(d => {
             const data = d.data();
             return data.program === prog && String(data.semester) === String(sem) && data.section === sec;
          });
          if (matchingDoc) {
             return matchingDoc.data().structure || null;
          }
       }
    }
    return docSnap.exists() ? docSnap.data().structure : null;
  },

  getAllStructures: async () => {
    const snap = await getDocs(collection(db, "timetable_structures"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  getAllTimetables: async () => {
    const snap = await getDocs(collection(db, "timetable"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  getByGroupId: async (groupId) => {
    if (!groupId) return [];
    let docRef = doc(db, "timetable_structures", groupId);
    let snap = await getDoc(docRef);
    if (!snap.exists() && groupId.startsWith("MCA-")) {
       const legacyId = groupId.replace("MCA-", "Master of Computer Applications-");
       docRef = doc(db, "timetable_structures", legacyId);
       snap = await getDoc(docRef);
    }
    if (!snap.exists()) {
       const parts = groupId.split('-');
       if (parts.length >= 4) {
          const prog = parts[1];
          const sem = parts[2].replace("SEM", "");
          const sec = parts[3];
          const qSnap = await getDocs(collection(db, "timetable_structures"));
          const matchingDoc = qSnap.docs.find(d => {
             const data = d.data();
             return data.program === prog && String(data.semester) === String(sem) && data.section === sec;
          });
          if (matchingDoc) {
             return matchingDoc.data().entries || [];
          }
       }
    }
    if (snap.exists()) {
      return snap.data().entries || [];
    }
    return [];
  },

  deleteTimetable: async (groupId) => {
    await deleteDoc(doc(db, "timetable_structures", groupId));
  },

  // 2. Save Timetable (Optimized for Spark Plan)
  saveTimetable: async (groupId, entries, structure, metadata) => {
    const batch = writeBatch(db);

    // Extract all faculty IDs involved for indexing
    const facultyIds = [...new Set(entries.map(e => e.faculty_id).filter(id => id))];

    // Save everything in ONE document
    const structRef = doc(db, "timetable_structures", groupId);
    batch.set(structRef, {
      ...metadata,
      group_id: groupId,
      structure: structure,
      entries: entries, // Storing all period data here
      faculty_ids: facultyIds, // Index for searching
      updatedAt: serverTimestamp()
    }, { merge: true });

    await batch.commit();
  },

  // 3. Check Faculty Conflict — queries timetable_structures entries
  checkConflict: async (facultyId, day, periodId, currentGroupId) => {
    try {
      const snap = await getDocs(
        query(collection(db, "timetable_structures"), where("faculty_ids", "array-contains", facultyId))
      );
      let conflict = null;
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.group_id === currentGroupId) return;
        const entry = (data.entries || []).find(
          e => e.faculty_id === facultyId && e.day === day && e.period_id === periodId
        );
        if (entry) {
          conflict = {
            group_id: data.group_id,
            program:  data.program,
            section:  data.section,
            semester: data.semester,
            dept:     data.dept,
          };
        }
      });
      return conflict;
    } catch (error) {
      console.error("Conflict check error:", error);
      return null;
    }
  },

  // 4. Get Student Dashboard Data
  getStudentDashboard: async (enrollNo) => {
    const q = query(collection(db, "students"), where("enroll_no", "==", enrollNo));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Student not found");
    
    const studentData = snap.docs[0].data();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    
    const deptCode = DEPT_MAP[studentData.dept]?.code || studentData.dept?.substring(0,3).toUpperCase();
    const groupId = studentData.group_id || `${deptCode}-${studentData.program}-SEM${studentData.semester}-${studentData.section}`;

    // Fetch unified structure entries via resilient getter
    const allEntries = await timetableService.getByGroupId(groupId);

    // Filter for today
    const todayEntries = allEntries.filter(e => e.day === today);

    // Fetch faculty list to map faculty names dynamically
    const fSnap = await getDocs(collection(db, "faculties"));
    const facultyMap = {};
    fSnap.forEach(fDoc => {
       facultyMap[fDoc.id] = fDoc.data().name;
    });

    const schedule = todayEntries.map(e => ({
       ...e,
       faculty_name: facultyMap[e.faculty_id] || e.faculty_name || 'Prof. TBA'
    })).sort((a, b) => (a.period_id || 0) - (b.period_id || 0));

    return { student: studentData, schedule };
  },

  // 5. Get Faculty Dashboard Data
  getFacultyDashboard: async (facultyId) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const q = query(
      collection(db, "timetable_structures"), 
      where("faculty_ids", "array-contains", facultyId)
    );
    const snap = await getDocs(q);
    
    let todayEntries = [];
    snap.forEach(docSnap => {
       const data = docSnap.data();
       const relevant = (data.entries || []).filter(e => e.faculty_id === facultyId && e.day === today);
       // Ensure enriched fields are preserved
       const enriched = relevant.map(e => ({
          ...e,
          group_id: data.group_id,
          dept: e.dept || data.dept || "MCA",
          program: e.program || data.program || "MCA",
          semester: e.semester || data.semester || "?",
          section: e.section || data.section || "A"
       }));
       todayEntries = [...todayEntries, ...enriched];
    });

    return todayEntries.sort((a, b) => (a.period_id || 0) - (b.period_id || 0));
  },

  // 6. Get Full Weekly Timetable for Faculty
  getFacultyWeekly: async (facultyId) => {
    try {
      const q = query(
        collection(db, "timetable_structures"), 
        where("faculty_ids", "array-contains", facultyId)
      );
      const snap = await getDocs(q);
      
      let allEntries = [];
      snap.forEach(docSnap => {
         const data = docSnap.data();
         const relevant = (data.entries || []).filter(e => e.faculty_id === facultyId);
         const enriched = relevant.map(e => ({
            ...e,
            group_id: data.group_id,
            dept: e.dept || data.dept || "MCA",
            program: e.program || data.program || "MCA",
            semester: e.semester || data.semester || "?",
            section: e.section || data.section || "A"
         }));
         allEntries = [...allEntries, ...enriched];
      });
      
      return allEntries;
    } catch (error) {
      console.error("Faculty query error:", error);
      return [];
    }
  },

  // Check if a faculty is already busy at a specific time
  checkFacultyConflict: async (facultyId, day, periodId, currentGroupId) => {
    try {
      const q = query(
        collection(db, "timetable_structures"), 
        where("faculty_ids", "array-contains", facultyId)
      );
      const snap = await getDocs(q);
      
      let conflict = null;
      snap.forEach(docSnap => {
         const data = docSnap.data();
         // Skip the current class we are editing
         if (data.group_id === currentGroupId) return;

         const entry = (data.entries || []).find(e => e.day === day && e.period_id === periodId);
         if (entry && entry.faculty_id === facultyId) {
            conflict = {
               class_name: data.group_id,
               dept: data.dept,
               program: data.program,
               section: data.section
            };
         }
      });
      
      return conflict;
    } catch (error) {
      console.error("Conflict check error:", error);
      return null;
    }
  },

  // Check if a faculty is already a Class Advisor elsewhere
  checkAdvisorConflict: async (advisorName, currentGroupId) => {
    try {
      const q = query(
        collection(db, "timetable_structures"), 
        where("advisor", "==", advisorName)
      );
      const snap = await getDocs(q);
      
      let conflict = null;
      snap.forEach(docSnap => {
         const data = docSnap.data();
         if (data.group_id !== currentGroupId) {
            conflict = data.group_id;
         }
      });
      return conflict;
    } catch (error) {
      console.error("Advisor check error:", error);
      return null;
    }
  },
};

export const activityService = {
  getAll: async () => {
    const q = query(collection(db, "activity"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  add: async (log) => {
    await addDoc(collection(db, "activity"), {
      ...log,
      timestamp: serverTimestamp()
    });
  }
};

export const facultyService = {
  getAll: async () => {
    const snap = await getDocs(collection(db, "faculties"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

export const studentService = {
  getAll: async () => {
    const snap = await getDocs(collection(db, "students"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  updatePrefs: async (uid, prefs) => {
    const docRef = doc(db, "students", uid);
    await updateDoc(docRef, { alert_prefs: prefs });
  },
  getProgramDurations: async () => {
    try {
      const docRef = doc(db, "system_configs", "program_durations");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      } else {
        // Seed defaults if missing
        const defaults = {
          "B.Tech": 4, "M.Tech": 2, "MCA": 2, "BCA": 3, 
          "MBA": 2, "BBA": 3, "BSc": 3, "MSc": 2, 
          "BA": 3, "MA": 2, "BCom": 3, "MCom": 2, 
          "Diploma": 3
        };
        await setDoc(docRef, defaults);
        return defaults;
      }
    } catch (error) {
      console.error("Error fetching program durations:", error);
      // Fallback
      return { "B.Tech": 4, "M.Tech": 2, "MCA": 2, "BCA": 3, "MBA": 2, "BSc": 3, "BA": 3, "Diploma": 3 };
    }
  }
};
