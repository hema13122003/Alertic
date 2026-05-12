import { db } from '../firebase';
import {
  doc, getDoc, setDoc, collection, query, where, getDocs, arrayUnion
} from 'firebase/firestore';
import { showNotification } from './pushService';

const PERIOD_TIMES = {
  1: { start: '09:00', end: '09:50' },
  2: { start: '09:50', end: '10:40' },
  3: { start: '10:55', end: '11:45' },
  4: { start: '11:45', end: '12:35' },
  5: { start: '13:15', end: '14:05' },
  6: { start: '14:05', end: '14:55' },
  7: { start: '15:10', end: '16:00' },
  8: { start: '16:00', end: '16:50' },
};

const BOT_TOKEN = '8679506521:AAF1OeZDhggD6tcYHEA3l-FY-2AM1r2Uyf0';
const toMins    = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// ── Send Telegram (browser — no restrictions) ──────────────────────────────────
async function sendTelegram(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (e) { console.error('Telegram error:', e.message); }
}

// ── Send Email via EmailJS (browser) ──────────────────────────────────────────
async function sendEmail(toEmail, userName, subjectName, roomNumber, alertTime, role) {
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service_npxig3j', template_id: 'template_3760ula',
        user_id: 'Yb3Z9vDtJ9YgtQuRW',
        template_params: {
          to_email: toEmail, user_name: userName, subject_name: subjectName,
          room_number: roomNumber, alert_time: alertTime,
          status: role === 'student' ? 'CLASS REMINDER' : 'CLASS ALERT',
        },
      }),
    });
  } catch (e) { console.error('Email error:', e.message); }
}

// ── Browser fallback scheduler ─────────────────────────────────────────────────
// Runs every minute while faculty dashboard is open.
// The Render notifier handles this when browser is closed.
// Both use the same Firestore dedup key so no double-sends occur.
export async function runAlertCheck(facultyId, weeklySchedule) {
  const now        = new Date();
  const days       = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const currentDay = days[now.getDay()];
  const nowMins    = now.getHours() * 60 + now.getMinutes();
  const todayStr   = now.toISOString().split('T')[0];

  const fSnap = await getDoc(doc(db, 'faculties', facultyId));
  const fData = fSnap.exists() ? fSnap.data() : {};

  if (fData.globalAlertEnabled !== true) return;

  const fTgReady    = fData.telegramEnabled === true && fData.telegramId;
  const fEmailReady = fData.emailEnabled    === true && fData.contactEmail;
  if (!fTgReady && !fEmailReady) return;

  const alertInterval = fData.alertInterval || 5;

  for (const entry of weeklySchedule.filter(e => e.day === currentDay)) {
    const periodId        = entry.period_id || entry.period;
    const times           = PERIOD_TIMES[periodId];
    if (!times) continue;

    const periodStartMins = toMins(times.start);
    if (nowMins !== periodStartMins - alertInterval) continue;

    // Use Firestore dedup (same key as notifier) — prevents double send
    const fKey     = `${facultyId}_${todayStr}_${periodId}`;
    const fSentRef = doc(db, 'alert_sent_log', fKey);
    const fSentSnap = await getDoc(fSentRef);
    if (fSentSnap.exists()) continue;
    await setDoc(fSentRef, { sentAt: new Date().toISOString() });

    const basePayload = {
      period_id: periodId, subject_name: entry.subject_name,
      classroom: entry.classroom, group_id: entry.group_id,
      dept: entry.dept, section: entry.section,
      alert_minutes: alertInterval, period_start: times.start,
      period_end: times.end, faculty_name: fData.name || 'Professor',
    };

    // Write in-app alert
    await setDoc(doc(db, 'alerts', facultyId),
      { pending: arrayUnion(basePayload) }, { merge: true });

    // Browser notification (works when tab is minimized/background)
    showNotification(
      'Class Alert - ' + alertInterval + ' min',
      entry.subject_name + ' | Room ' + entry.classroom + ' | ' + times.start
    );

    // Send Telegram + Email (browser is open since this is the browser scheduler)
    if (fTgReady) {
      await sendTelegram(fData.telegramId, [
        '*CLASS ALERT - ' + alertInterval + ' MIN WARNING*', '',
        'Subject: ' + entry.subject_name, 'Room: ' + entry.classroom,
        'Class: ' + entry.group_id, 'Starts at: ' + times.start, '',
        '_Alertic - Be on time!_',
      ].join('\n'));
    }
    if (fEmailReady) {
      await sendEmail(fData.contactEmail, fData.name || 'Professor',
        entry.subject_name, entry.classroom, alertInterval + ' Minutes', 'faculty');
    }

    // Students
    const stuSnap = await getDocs(
      query(collection(db, 'students'), where('group_id', '==', entry.group_id))
    );

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
      if (nowMins !== periodStartMins - stuInterval) continue;

      const sKey      = `${studentId}_${todayStr}_${periodId}`;
      const sSentSnap = await getDoc(doc(db, 'alert_sent_log', sKey));
      if (sSentSnap.exists()) continue;
      await setDoc(doc(db, 'alert_sent_log', sKey), { sentAt: new Date().toISOString() });

      await setDoc(doc(db, 'alerts', studentId),
        { pending: arrayUnion({ ...basePayload, alert_minutes: stuInterval }) },
        { merge: true });

      // Browser notification for student
      showNotification(
        'Class Reminder - ' + stuInterval + ' min',
        entry.subject_name + ' | ' + (fData.name || 'Professor') + ' | Room ' + entry.classroom
      );

      if (sTgReady) {
        await sendTelegram(sData.telegramId, [
          '*CLASS REMINDER - ' + stuInterval + ' MIN WARNING*', '',
          'Subject: ' + entry.subject_name,
          'Faculty: ' + (fData.name || 'Professor'),
          'Room: ' + entry.classroom, 'Starts at: ' + times.start, '',
          "_Alertic - Don't be late!_",
        ].join('\n'));
      }
      if (sEmailReady) {
        await sendEmail(sData.contactEmail, sData.name || 'Student',
          entry.subject_name, entry.classroom, stuInterval + ' Minutes', 'student');
      }
    }
  }
}
