const functions = require("firebase-functions");
const express   = require("express");
const cors      = require("cors");
const { admin, db } = require("./db");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/faculties",  require("./routes/facultyRoutes"));
app.use("/students",   require("./routes/studentRoutes"));
app.use("/timetable",  require("./routes/timetableRoutes"));
app.use("/auth",       require("./routes/authRoutes"));
app.use("/activity",   require("./routes/activityRoutes"));
app.use("/dashboard",  require("./routes/dashboardRoutes"));
app.use("/subjects",   require("./routes/subjectRoutes"));

app.get("/health", (req, res) => {
  res.status(200).send({ Success: true, Message: "Alertic is running!" });
});

// ── Period times ───────────────────────────────────────────────────────────────
const PERIOD_TIMES = {
  1: { start: "09:00", end: "09:50" },
  2: { start: "09:50", end: "10:40" },
  3: { start: "10:55", end: "11:45" },
  4: { start: "11:45", end: "12:35" },
  5: { start: "13:15", end: "14:05" },
  6: { start: "14:05", end: "14:55" },
  7: { start: "15:10", end: "16:00" },
  8: { start: "16:00", end: "16:50" },
};
const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const toMins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

// ── /triggerAlerts — called by cron-job.org every minute (FREE, Spark safe) ───
// This endpoint ONLY writes to Firestore (Google service = allowed on Spark).
// Telegram/Email are sent from the browser via onSnapshot — no outbound calls here.
app.post("/triggerAlerts", async (req, res) => {
  // Optional secret to prevent abuse
  const secret = req.headers["x-cron-secret"] || req.body.secret;
  const expectedSecret = process.env.CRON_SECRET || "alertic_cron_2024";
  if (secret !== expectedSecret) {
    return res.status(401).json({ Success: false, Message: "Unauthorized" });
  }

  const now        = new Date();
  const currentDay = DAYS[now.getDay()];
  const nowMins    = now.getHours() * 60 + now.getMinutes();
  const todayStr   = now.toISOString().split("T")[0];

  try {
    const structSnap = await db.collection("timetable_structures").get();
    let dispatched   = 0;

    for (const structDoc of structSnap.docs) {
      const data         = structDoc.data();
      const entries      = data.entries || [];
      const todayEntries = entries.filter(e => e.day === currentDay && e.faculty_id);

      for (const entry of todayEntries) {
        const periodId        = entry.period_id || entry.period;
        const times           = PERIOD_TIMES[periodId];
        if (!times) continue;

        const periodStartMins = toMins(times.start);
        const facultyId       = entry.faculty_id;

        // Load faculty settings
        const fSnap = await db.collection("faculties").doc(facultyId).get();
        const fData = fSnap.exists ? fSnap.data() : {};

        if (fData.globalAlertEnabled !== true) continue;

        const fTgReady    = fData.telegramEnabled === true && fData.telegramId;
        const fEmailReady = fData.emailEnabled    === true && fData.contactEmail;
        if (!fTgReady && !fEmailReady) continue;

        const alertInterval = fData.alertInterval || 5;
        const triggerMins   = periodStartMins - alertInterval;
        if (nowMins !== triggerMins) continue;

        // Deduplicate
        const fKey     = `${facultyId}_${todayStr}_${periodId}`;
        const fSentRef = db.collection("alert_sent_log").doc(fKey);
        if ((await fSentRef.get()).exists) continue;
        await fSentRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp() });

        const basePayload = {
          period_id:     periodId,
          subject_name:  entry.subject_name,
          classroom:     entry.classroom,
          group_id:      data.group_id,
          dept:          entry.dept  || data.dept,
          section:       entry.section || data.section,
          alert_minutes: alertInterval,
          period_start:  times.start,
          period_end:    times.end,
          // Channel info so browser knows what to send
          faculty_telegram_id:    fTgReady    ? fData.telegramId    : null,
          faculty_email:          fEmailReady ? fData.contactEmail  : null,
          faculty_name:           fData.name  || "Professor",
          triggeredAt:   admin.firestore.FieldValue.serverTimestamp(),
        };

        // Write to faculty alerts doc — browser onSnapshot picks this up
        // and sends Telegram/Email from the browser
        await db.collection("alerts").doc(facultyId).set(
          { pending: admin.firestore.FieldValue.arrayUnion(basePayload) },
          { merge: true }
        );
        dispatched++;

        // Students in the same group
        const stuSnap = await db.collection("students")
          .where("group_id", "==", data.group_id).get();

        for (const stuDoc of stuSnap.docs) {
          const studentId = stuDoc.id;
          const sData     = stuDoc.data();

          if (sData.globalAlertEnabled !== true) continue;

          const sTgReady    = sData.telegramEnabled === true && sData.telegramId;
          const sEmailReady = sData.emailEnabled    === true && sData.contactEmail;
          if (!sTgReady && !sEmailReady) continue;

          const alertPrefs = sData.alert_prefs || {};
          if (alertPrefs[facultyId] === false) continue;

          const stuInterval    = sData.alertInterval || alertInterval;
          const stuTriggerMins = periodStartMins - stuInterval;
          if (nowMins !== stuTriggerMins) continue;

          const sKey     = `${studentId}_${todayStr}_${periodId}`;
          const sSentRef = db.collection("alert_sent_log").doc(sKey);
          if ((await sSentRef.get()).exists) continue;
          await sSentRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp() });

          const studentPayload = {
            ...basePayload,
            alert_minutes:       stuInterval,
            student_telegram_id: sTgReady    ? sData.telegramId   : null,
            student_email:       sEmailReady ? sData.contactEmail : null,
            student_name:        sData.name  || "Student",
          };

          await db.collection("alerts").doc(studentId).set(
            { pending: admin.firestore.FieldValue.arrayUnion(studentPayload) },
            { merge: true }
          );
          dispatched++;
        }
      }
    }

    res.status(200).json({ Success: true, dispatched, time: now.toISOString() });
  } catch (err) {
    console.error("triggerAlerts error:", err);
    res.status(500).json({ Success: false, Message: err.message });
  }
});

exports.api = functions.https.onRequest(app);
