const express  = require("express");
const fetch    = require("node-fetch");
const admin    = require("firebase-admin");

// ── Firebase init using env var (set on Render dashboard) ─────────────────────
// On Render: set FIREBASE_SERVICE_ACCOUNT env var to the full JSON string
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceAccountKey.json"); // local fallback

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-cron-secret");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

// ── Config ─────────────────────────────────────────────────────────────────────
const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || "8679506521:AAF1OeZDhggD6tcYHEA3l-FY-2AM1r2Uyf0";
const CRON_SECRET = process.env.CRON_SECRET        || "alertic_cron_2024";
const PORT        = process.env.PORT               || 3000;

const PERIOD_TIMES = {
  'P1': { start: "09:00", end: "09:50" },
  'P2': { start: "09:50", end: "10:40" },
  'P3': { start: "10:55", end: "11:45" },
  'P4': { start: "11:45", end: "12:35" },
  'P5': { start: "13:15", end: "14:05" },
  'P6': { start: "14:05", end: "14:55" },
  'P7': { start: "15:10", end: "16:00" },
  'P8': { start: "16:00", end: "16:50" },
};
const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const toMins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

// ── Telegram ───────────────────────────────────────────────────────────────────
async function sendTelegram(chatId, text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    const j = await r.json();
    if (!j.ok) console.error("Telegram error:", j.description);
  } catch (e) {
    console.error("Telegram fetch error:", e.message);
  }
}

// ── Email via EmailJS ──────────────────────────────────────────────────────────
async function sendEmail(toEmail, userName, subjectName, roomNumber, alertTime, role) {
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id:  "service_npxig3j",
        template_id: "template_3760ula",
        user_id:     "Yb3Z9vDtJ9YgtQuRW",
        template_params: {
          to_email:     toEmail,
          user_name:    userName,
          subject_name: subjectName,
          room_number:  roomNumber,
          alert_time:   alertTime,
          status: role === "student" ? "CLASS REMINDER" : "CLASS ALERT",
        },
      }),
    });
  } catch (e) {
    console.error("Email fetch error:", e.message);
  }
}

// ── Health check (keeps Render free instance alive via UptimeRobot) ────────────
app.get("/", (req, res) => res.send("Alertic Notifier OK"));

// ── Main trigger endpoint — called by cron-job.org every minute ────────────────
app.post("/trigger", async (req, res) => {
  const secret = req.headers["x-cron-secret"] || req.body?.secret;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now        = new Date();
  const currentDay = DAYS[now.getDay()];
  const nowMins    = now.getHours() * 60 + now.getMinutes();
  const todayStr   = now.toISOString().split("T")[0];

  let dispatched = 0;

  try {
    const structSnap = await db.collection("timetable_structures").get();

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

        // ── Faculty settings ──────────────────────────────────────────────────
        const fSnap = await db.collection("faculties").doc(facultyId).get();
        const fData = fSnap.exists ? fSnap.data() : {};

        if (fData.globalAlertEnabled !== true) continue;

        const fTgReady    = fData.telegramEnabled === true && fData.telegramId;
        const fEmailReady = fData.emailEnabled    === true && fData.contactEmail;
        if (!fTgReady && !fEmailReady) continue;

        const alertInterval = fData.alertInterval || 5;
        const triggerMins   = periodStartMins - alertInterval;
        if (nowMins !== triggerMins) continue;

        // ── Deduplicate ───────────────────────────────────────────────────────
        const fKey     = `${facultyId}_${todayStr}_${periodId}`;
        const fSentRef = db.collection("alert_sent_log").doc(fKey);
        if ((await fSentRef.get()).exists) continue;
        await fSentRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp() });

        const basePayload = {
          period_id:    periodId,
          subject_name: entry.subject_name,
          classroom:    entry.classroom,
          group_id:     data.group_id,
          dept:         entry.dept    || data.dept,
          section:      entry.section || data.section,
          alert_minutes: alertInterval,
          period_start:  times.start,
          period_end:    times.end,
          faculty_name:  fData.name || "Professor",
          triggeredAt:   admin.firestore.FieldValue.serverTimestamp(),
        };

        // ── Write in-app alert for faculty (browser modal) ────────────────────
        await db.collection("alerts").doc(facultyId).set(
          { pending: admin.firestore.FieldValue.arrayUnion(basePayload) },
          { merge: true }
        );

        // ── Send Telegram to faculty ──────────────────────────────────────────
        if (fTgReady) {
          await sendTelegram(fData.telegramId, [
            "🔔 *CLASS ALERT — " + alertInterval + " MIN WARNING*",
            "",
            "📚 *Subject:* " + entry.subject_name,
            "🏫 *Room:* "    + entry.classroom,
            "👥 *Class:* "   + data.group_id,
            "⏰ *Starts at:* " + times.start,
            "🕐 *Ends at:* "   + times.end,
            "",
            "_Alertic — Be on time!_",
          ].join("\n"));
        }

        // ── Send Email to faculty ─────────────────────────────────────────────
        if (fEmailReady) {
          await sendEmail(
            fData.contactEmail, fData.name || "Professor",
            entry.subject_name, entry.classroom,
            alertInterval + " Minutes", "faculty"
          );
        }

        dispatched++;

        // ── Students in the same group ────────────────────────────────────────
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

          // Write in-app alert for student
          await db.collection("alerts").doc(studentId).set(
            { pending: admin.firestore.FieldValue.arrayUnion({
              ...basePayload,
              alert_minutes: stuInterval,
            })},
            { merge: true }
          );

          // Send Telegram to student
          if (sTgReady) {
            await sendTelegram(sData.telegramId, [
              "🎓 *CLASS REMINDER — " + stuInterval + " MIN WARNING*",
              "",
              "📚 *Subject:* " + entry.subject_name,
              "👨‍🏫 *Faculty:* " + (fData.name || "Professor"),
              "🏫 *Room:* "    + entry.classroom,
              "⏰ *Starts at:* " + times.start,
              "🕐 *Ends at:* "   + times.end,
              "",
              "_Alertic — Don't be late!_",
            ].join("\n"));
          }

          // Send Email to student
          if (sEmailReady) {
            await sendEmail(
              sData.contactEmail, sData.name || "Student",
              entry.subject_name, entry.classroom,
              stuInterval + " Minutes", "student"
            );
          }

          dispatched++;
        }
      }
    }

    console.log(`[${now.toISOString()}] Dispatched: ${dispatched}`);
    res.json({ success: true, dispatched, time: now.toISOString() });
  } catch (err) {
    console.error("Trigger error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Fee Reminder endpoint ────────────────────────────────────────────────────
app.post("/fee-reminder", async (req, res) => {
  const secret = req.headers["x-cron-secret"] || req.body?.secret;
  if (secret !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    const snap = await db.collection("fee_records").get();
    let sent = 0;

    for (const docSnap of snap.docs) {
      const f = docSnap.data();
      const hasYear1Pending = f.year1_status === "Partial" || f.year1_status === "Pending";
      const hasYear2Pending = f.year2_status === "Partial" || f.year2_status === "Pending";
      if (!hasYear1Pending && !hasYear2Pending) continue;

      // Build message
      const lines = [
        `💸 *FEE REMINDER — ${f.name}*`,
        `🎓 Enroll: ${f.enroll_no} | ${f.category}`,
        "",
      ];
      if (hasYear1Pending) {
        lines.push(`📅 *Year 1 Fee*`);
        lines.push(`Paid: ₹${f.year1_paid?.toLocaleString()} | Remaining: ₹${f.year1_remaining?.toLocaleString()}`);
        lines.push(`Status: ${f.year1_status}`);
      }
      if (hasYear2Pending) {
        lines.push(`📅 *Year 2 Fee*`);
        lines.push(`Paid: ₹${f.year2_paid?.toLocaleString()} | Remaining: ₹${f.year2_remaining?.toLocaleString()}`);
        lines.push(`Status: ${f.year2_status}`);
      }
      lines.push("");
      lines.push("_Please clear your pending fees at the earliest._");
      lines.push("_Alertic — Fee Management System_");

      const message = lines.join("\n");

      if (f.telegram_id) await sendTelegram(f.telegram_id, message);
      if (f.contact_email) await sendEmail(f.contact_email, f.name, "Fee Reminder", "", "Pending", "student");
      sent++;
    }

    res.json({ success: true, sent });
  } catch (err) {
    console.error("Fee reminder error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log("Alertic Notifier running on port " + PORT));
