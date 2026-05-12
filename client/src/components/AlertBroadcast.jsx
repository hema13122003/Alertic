import React, { useState, useEffect, useMemo } from 'react';
import emailjs from '@emailjs/browser';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { timetableService } from '../services/firebaseService';
import { FaClock, FaBolt, FaExclamationTriangle } from 'react-icons/fa';

const PERIOD_TIMES = {
    1: { start: '09:00', end: '09:50' },
    2: { start: '09:50', end: '10:40' },
    3: { start: '10:55', end: '11:45' },
    4: { start: '11:45', end: '12:35' },
    5: { start: '13:15', end: '14:05' },
    6: { start: '14:05', end: '14:55' },
    7: { start: '15:10', end: '16:00' },
    8: { start: '16:00', end: '16:50' }
};

const AlertBroadcast = () => {
    const [alert, setAlert] = useState(null);
    const [settings, setSettings] = useState({ enabled: true, interval: 5 });
    const [schedule, setSchedule] = useState([]);
    
    const facultyId = localStorage.getItem('faculty_id');
    const userRole = localStorage.getItem('userRole');

    // 1. Fetch Faculty Settings & Schedule
    useEffect(() => {
        if (userRole !== 'faculty' || !facultyId) return;

        const fetchData = async () => {
            try {
                const userId = userRole === 'student' ? JSON.parse(localStorage.getItem('student') || '{}').id : localStorage.getItem('faculty_id');
                const collectionName = userRole === 'student' ? "students" : "faculties";
                
                if (!userId) return;
                const docRef = doc(db, collectionName, userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSettings({
                        enabled: data.globalAlertEnabled !== false,
                        interval: data.alertInterval || 5,
                        telegramEnabled: data.telegramEnabled || false,
                        telegramId: data.telegramId || '',
                        emailEnabled: data.emailEnabled || false,
                        contactEmail: data.contactEmail || ''
                    });
                }

                const weekly = await timetableService.getFacultyWeekly(facultyId);
                const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                setSchedule(weekly.filter(item => item.day === today));
            } catch (err) {
                console.error("Alert Sync Error:", err);
            }
        };

        fetchData();
    }, [facultyId, userRole]);

    // 2. Background Poller
    useEffect(() => {
        if (!settings.enabled || schedule.length === 0) {
            setAlert(null);
            return;
        }

        const checkSchedule = () => {
            const now = new Date();
            const nowStr = now.toTimeString().substring(0, 5);
            
            let currentAlert = null;

            schedule.forEach(item => {
                const times = PERIOD_TIMES[item.period_id || item.period];
                if (!times) return;

                // Calculate difference in minutes
                const [h, m] = times.start.split(':').map(Number);
                const start = new Date();
                start.setHours(h, m, 0, 0);
                
                const diffMs = start - now;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins >= 0 && diffMins <= settings.interval) {
                    currentAlert = {
                        status: 'upcoming',
                        subject: item.subject_name,
                        group: `${item.program} ${item.section}`,
                        timeLeft: `${diffMins}m`,
                        room: item.classroom
                    };
                } else if (nowStr >= times.start && nowStr < times.end) {
                    currentAlert = {
                        status: 'live',
                        subject: item.subject_name,
                        group: `${item.program} ${item.section}`,
                        timeLeft: 'ACTIVE',
                        room: item.classroom
                    };
                }
            });

            setAlert(currentAlert);

            // Audio & Telegram Alert Trigger (only once when alert starts)
            if (currentAlert && currentAlert.status === 'upcoming' && diffMins === settings.interval) {
                // 1. Audio Alert
                const sound = localStorage.getItem('alert_sound') || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
                const volume = parseFloat(localStorage.getItem('alert_volume') || '0.5');
                const audio = new Audio(sound);
                audio.volume = volume;
                audio.play().catch(() => {});

                // 2. Telegram Alert
                if (settings.telegramEnabled && settings.telegramId) {
                    const botToken = "8679506521:AAF1OeZDhggD6tcYHEA3l-FY-2AM1r2Uyf0";
                    const roleLabel = userRole === 'student' ? '🎓 STUDENT' : '🚀 FACULTY';
                    const msg = `🚨 *${roleLabel} ALERT*\n\n` +
                                `📖 *Class:* ${currentAlert.subject}\n` +
                                `📍 *Location:* RM ${currentAlert.room}\n` +
                                `⏳ *Starts In:* ${currentAlert.timeLeft}\n\n` +
                                `_System: Alertic Cloud v4.2.1_`;

                    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: settings.telegramId,
                            text: msg,
                            parse_mode: 'Markdown'
                        })
                    }).catch(err => console.error("TG Dispatch Error:", err));
                }

                // 3. Email Alert
                if (settings.emailEnabled && settings.contactEmail) {
                    emailjs.init("Yb3Z9vDtJ9YgtQuRW");
                    const emailParams = {
                        to_email: settings.contactEmail,
                        user_name: userRole === 'student' ? 'Student' : 'Professor',
                        subject_name: currentAlert.subject,
                        room_number: currentAlert.room,
                        alert_time: currentAlert.timeLeft,
                        status: 'UPCOMING'
                    };

                    fetch('https://api.emailjs.com/api/v1.0/email/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            service_id: 'service_npxig3j',
                            template_id: 'template_3760ula',
                            user_id: 'Yb3Z9vDtJ9YgtQuRW',
                            template_params: emailParams
                        })
                    }).catch(err => console.error("Email Dispatch Error:", err));
                }
            }
        };

        const timer = setInterval(checkSchedule, 30000); // Check every 30s
        checkSchedule(); // Initial check

        return () => clearInterval(timer);
    }, [settings, schedule]);

    if (!alert) return null;

    const isLive = alert.status === 'live';

    return (
        <div className={`flex items-center gap-4 px-5 py-2.5 rounded-2xl border transition-all duration-500 animate-pulse-subtle ${
            isLive 
            ? 'bg-red-500/10 border-red-500/20 text-red-600 shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]' 
            : 'bg-blue-500/10 border-blue-500/20 text-blue-600 shadow-[0_0_20px_-5px_rgba(37,99,235,0.3)]'
        }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                isLive ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            }`}>
               {isLive ? <FaBolt /> : <FaClock />}
            </div>

            <div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Alert Protocol</span>
                    <span className="w-1 h-1 rounded-full bg-current opacity-40"></span>
                    <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${isLive ? 'animate-pulse' : ''}`}>
                        {isLive ? '🔴 Session Active' : '⏳ Deployment Warning'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <h4 className="text-xs font-black tracking-tight text-slate-900 uppercase">
                        {alert.subject} <span className="text-slate-400 font-medium lowercase mx-1">/</span> {alert.group}
                    </h4>
                    <div className="h-3 w-[1px] bg-slate-200"></div>
                    <p className="text-[10px] font-bold opacity-80 uppercase">
                        RM {alert.room} • {isLive ? alert.timeLeft : `In ${alert.timeLeft}`}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AlertBroadcast;
