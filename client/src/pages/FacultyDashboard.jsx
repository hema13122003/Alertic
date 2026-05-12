import React, { useState, useEffect } from 'react';
import { Card, IconButton, Tooltip, Dialog, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import {
  FaClock,
  FaCalendarCheck,
  FaMapMarkerAlt,
  FaChalkboardTeacher,
  FaChevronRight,
  FaBell,
  FaUserCircle,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTable,
  FaTimes,
  FaCoffee,
  FaUtensils,
  FaUserGraduate
} from 'react-icons/fa';
import {
  timetableService,
  activityService
} from '../services/firebaseService';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import { runAlertCheck } from '../services/alertEngine';
import { toast } from 'react-toastify';

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const GRID = [
  { id: 1,    type: 'class', label: 'P1',    time: '09:00 – 09:50' },
  { id: 2,    type: 'class', label: 'P2',    time: '09:50 – 10:40' },
  { id: 'B1', type: 'break', label: 'Break', time: '10:40 – 10:55' },
  { id: 3,    type: 'class', label: 'P3',    time: '10:55 – 11:45' },
  { id: 4,    type: 'class', label: 'P4',    time: '11:45 – 12:35' },
  { id: 'L',  type: 'lunch', label: 'Lunch', time: '12:35 – 13:15' },
  { id: 5,    type: 'class', label: 'P5',    time: '13:15 – 14:05' },
  { id: 6,    type: 'class', label: 'P6',    time: '14:05 – 14:55' },
  { id: 'B2', type: 'break', label: 'Break', time: '14:55 – 15:10' },
  { id: 7,    type: 'class', label: 'P7',    time: '15:10 – 16:00' },
  { id: 8,    type: 'class', label: 'P8',    time: '16:00 – 16:50' },
];

// ── Timetable Popover ──────────────────────────────────────────────────────────
const TimetablePopover = ({ slot, col, day, anchorRef }) => {
  const popRef = React.useRef(null);
  React.useEffect(() => {
    if (!anchorRef?.current || !popRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const pop  = popRef.current;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    let top  = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - 140;
    if (left + 280 > vw - 12) left = vw - 292;
    if (left < 12)             left = 12;
    if (top + 240 > vh - 12)   top  = rect.top - 248;
    pop.style.top  = `${top}px`;
    pop.style.left = `${left}px`;
  }, [anchorRef]);
  return (
    <div ref={popRef} className="fixed z-50 w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden pointer-events-none" style={{ top: 0, left: 0 }}>
      <div className="bg-[#0f172a] px-5 py-4">
        <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.25em] mb-1">{col.label} · {day}</p>
        <h3 className="text-[15px] font-black text-white uppercase tracking-tight leading-tight line-clamp-2">{slot.subject_name}</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><FaUserGraduate size={11} className="text-blue-600" /></div>
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Class</p>
            <p className="text-[12px] font-bold text-slate-800 leading-none truncate max-w-[180px]">{slot.dept} · {slot.program} · Sec {slot.section}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><FaMapMarkerAlt size={11} className="text-emerald-600" /></div>
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Room</p>
            <p className="text-[12px] font-bold text-slate-800 leading-none">{slot.classroom || 'TBA'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><FaClock size={11} className="text-amber-600" /></div>
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Time</p>
            <p className="text-[12px] font-bold text-slate-800 leading-none">{col.time}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Timetable Cell ─────────────────────────────────────────────────────────────
const TimetableCell = ({ slot, col, day, isToday, nowStr }) => {
  const [hovered, setHovered] = React.useState(false);
  const ref = React.useRef(null);
  const [start, end] = col.time.split(' – ');
  const isLive      = isToday && nowStr >= start && nowStr < end;
  const isCompleted = isToday && nowStr >= end;
  return (
    <td
      ref={ref}
      className={`p-1.5 border-r border-slate-100 last:border-r-0 transition-all
        ${isLive ? 'bg-emerald-50/60' : isCompleted ? 'bg-slate-50/30' : 'bg-white hover:bg-blue-50/20'}`}
      style={{ height: 80 }}
      onMouseEnter={() => slot && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {slot ? (
        <div className={`h-full flex flex-col px-2 py-1.5 rounded-xl border transition-all overflow-hidden border-l-[3px]
          ${isLive ? 'bg-white border-emerald-300 border-l-emerald-500 shadow-md shadow-emerald-100'
            : isCompleted ? 'bg-slate-50 border-slate-100 border-l-slate-300 opacity-50'
            : 'bg-white border-slate-100 border-l-blue-500 shadow-sm hover:shadow-md hover:border-blue-200'}`}
        >
          {isLive && (
            <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mb-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />Live
            </span>
          )}
          <p className="text-[9px] font-black text-slate-900 leading-tight line-clamp-2 uppercase tracking-tight">{slot.subject_name}</p>
          <p className="text-[7px] font-bold text-slate-400 truncate mt-auto pt-1 uppercase">{slot.dept} · Sec {slot.section}</p>
          <span className="text-[7px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5 self-start uppercase leading-none">RM {slot.classroom || 'TBA'}</span>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center opacity-5"><span className="text-[10px] font-black">—</span></div>
      )}
      {hovered && slot && <TimetablePopover slot={slot} col={col} day={day} anchorRef={ref} />}
    </td>
  );
};

const FacultyDashboard = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [currentClass, setCurrentClass] = useState(null);
  const [nextClass, setNextClass] = useState(null);
  const [countdown, setCountdown] = useState('00:00');
  const [stats, setStats] = useState({ total: 0, completed: 0, remaining: 0, free: 0 });

  const [audioRef, setAudioRef] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [alertSettings, setAlertSettings] = useState({ globalEnabled: true, mutedSessions: [] });

  const fetchData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const facultyId = localStorage.getItem('faculty_id') || user.id;
      
      // Load full weekly timetable for the grid
      const scheduleData = await timetableService.getFacultyWeekly(facultyId);
      setSchedule(scheduleData);
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const facultyId = localStorage.getItem('faculty_id') || JSON.parse(localStorage.getItem('user') || '{}').id;

    // In-app alert listener (Firestore onSnapshot — Spark compatible, no Functions needed)
    let unsubscribe = () => {};
    if (facultyId) {
      const alertRef = doc(db, 'alerts', facultyId);
      unsubscribe = onSnapshot(alertRef, (snap) => {
        if (!snap.exists()) return;
        const pending = snap.data().pending || [];
        if (pending.length === 0) return;
        const alert = pending[0];
        setIncomingAlert(alert);
        setIsAlertOpen(true);
        const soundUrl = localStorage.getItem('alert_sound') || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
        const volume = parseFloat(localStorage.getItem('alert_volume') || '0.5');
        const audio = new Audio(soundUrl);
        audio.volume = volume;
        audio.play().catch(() => {});
        setAudioRef(audio);
        updateDoc(alertRef, { pending: arrayRemove(alert) }).catch(() => {});
      });
    }

    // Browser-based alert scheduler — runs every minute, no Cloud Functions needed
    let alertInterval;
    if (facultyId) {
      alertInterval = setInterval(async () => {
        const currentSchedule = schedule;
        if (currentSchedule.length > 0) {
          await runAlertCheck(facultyId, currentSchedule);
        }
      }, 60000);
      // Also run immediately on mount in case we're right at a trigger minute
      setTimeout(async () => {
        const s = await timetableService.getFacultyWeekly(facultyId);
        if (s.length > 0) await runAlertCheck(facultyId, s);
      }, 2000);
    }

    return () => {
      clearInterval(timer);
      clearInterval(alertInterval);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (schedule.length >= 0) {
      const nowStr   = currentTime.toTimeString().substring(0, 5);
      const todayDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][currentTime.getDay()];
      const todaySchedule = schedule.filter(item => item.day === todayDay);

      const current = todaySchedule.find(item => {
        const pId = item.period_id || item.period;
        const times = PERIOD_TIMES[pId];
        return times && nowStr >= times.start && nowStr < times.end;
      });
      setCurrentClass(current || null);

      const upcoming = todaySchedule.filter(item => {
        const pId = item.period_id || item.period;
        const times = PERIOD_TIMES[pId];
        return times && times.start > nowStr;
      }).sort((a, b) => (a.period_id || a.period) - (b.period_id || b.period))[0];
      setNextClass(upcoming || null);

      if (upcoming) {
        const pId = upcoming.period_id || upcoming.period;
        const times = PERIOD_TIMES[pId];
        const [h, m] = times.start.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);
        const diff = target - currentTime;
        if (diff > 0) {
          const mins = Math.floor(diff / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
        } else {
          setCountdown('00:00');
        }
      } else {
        setCountdown('00:00');
      }

      const completed = todaySchedule.filter(item => {
        const pId = item.period_id || item.period;
        const times = PERIOD_TIMES[pId];
        return times && nowStr >= times.end;
      }).length;

      setStats({
        total: todaySchedule.length,
        completed,
        remaining: todaySchedule.length - completed - (current ? 1 : 0),
        free: 8 - todaySchedule.length
      });
    }
  }, [schedule, currentTime]);

  const handleAcknowledge = async () => {
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }
    setIsAlertOpen(false);
    toast.success("Protocol Acknowledged.");
  };

  return (
    <div className="w-full h-full bg-[#f8fafc] p-4 lg:p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-4 lg:space-y-6 animate-slide-up pb-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-xl lg:text-[22px] font-black text-slate-900 tracking-tight uppercase">Faculty Command</h1>
            <p className="text-slate-500 text-[10px] lg:text-[13px] font-bold uppercase tracking-widest opacity-70">Welcome back, {user.name || 'Professor'}</p>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-3">
            <div className="text-right mr-2 hidden sm:block">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">{currentTime.toLocaleDateString('en-US', { weekday: 'long' })}</p>
              <p className="text-[14px] font-black text-slate-800 leading-tight uppercase tracking-tighter">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <IconButton 
              onClick={() => setIsSettingsOpen(true)}
              size="small" 
              className="bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
            >
               <FaBell size={14} className={alertSettings.globalEnabled ? "text-blue-600" : "text-slate-400"} />
            </IconButton>
          </div>
        </div>

        {/* 1. HERO SECTION: Upcoming / Current Class */}
        {(currentClass || nextClass) ? (
          <div className="relative overflow-hidden rounded-2xl bg-[#0f172a] text-white p-6 lg:h-[140px] flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl shadow-blue-900/20 group">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:bg-blue-500/20 transition-all duration-700"></div>

            <div className="relative flex flex-col lg:flex-row items-center gap-4 lg:gap-6 text-center lg:text-left">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${currentClass ? 'bg-emerald-500 text-white border border-emerald-400/20' : 'bg-blue-600 text-white border border-blue-400/20'}`}>
                {currentClass ? <FaChalkboardTeacher size={28} /> : <FaClock size={28} />}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] lg:text-[12px] font-black text-blue-400 uppercase tracking-[0.2em] leading-none mb-2">
                  {currentClass ? 'Active Mission' : 'Upcoming Tactical'}
                </span>
                <h2 className="text-[18px] lg:text-[24px] font-black tracking-tighter leading-tight uppercase max-w-[300px] lg:max-w-[450px]">
                  {(currentClass || nextClass).subject_name}
                </h2>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-3 text-[11px] lg:text-[13px] text-slate-400 font-bold uppercase tracking-tight">
                  <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5"><FaMapMarkerAlt size={12} className="text-blue-400" /> RM {(currentClass || nextClass).classroom}</span>
                  <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5"><FaClock size={12} className="text-blue-400" /> {PERIOD_TIMES[(currentClass || nextClass).period_id || (currentClass || nextClass).period]?.start}</span>
                </div>
              </div>
            </div>

            <div className="relative text-center lg:text-right flex flex-col lg:items-end w-full lg:w-auto border-t lg:border-none border-white/5 pt-6 lg:pt-0">
              <span className="text-[9px] lg:text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                {currentClass ? 'Protocol Terminating In' : 'Mission Starts In'}
              </span>
              <div className="text-[42px] lg:text-[56px] font-black tracking-tighter leading-none font-mono text-white drop-shadow-lg">
                {countdown}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-10 flex flex-col items-center justify-center text-center">
             <FaTable size={40} className="text-slate-200 mb-4" />
            <p className="text-slate-400 text-[12px] font-black uppercase tracking-[0.3em] opacity-40">Zero active protocols scheduled for this cycle</p>
          </div>
        )}

        {/* 2. STATS CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[
            { label: 'Total Tasks', val: stats.total, color: 'text-slate-900', bg: 'bg-white' },
            { label: 'Completed', val: stats.completed, color: 'text-emerald-500', bg: 'bg-white' },
            { label: 'Remaining', val: stats.remaining, color: 'text-blue-600', bg: 'bg-white' },
            { label: 'Free Units', val: stats.free, color: 'text-slate-300', bg: 'bg-white' },
          ].map((stat, i) => (
            <Card key={i} elevation={0} className={`border border-slate-200/60 p-4 lg:p-6 rounded-2xl ${stat.bg} hover:border-blue-200 transition-all hover:shadow-lg`}>
              <span className="text-[9px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{stat.label}</span>
              <h4 className={`text-2xl lg:text-3xl font-black tracking-tighter ${stat.color}`}>{stat.val.toString().padStart(2, '0')}</h4>
            </Card>
          ))}
        </div>

        {/* 3. WEEKLY TIMETABLE GRID */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-tighter">Weekly Schedule</h3>
            <div className="hidden sm:flex items-center gap-4">
              {[{c:'bg-emerald-500',l:'Live'},{c:'bg-blue-500',l:'Upcoming'},{c:'bg-slate-200',l:'Done'}].map(x => (
                <span key={x.l} className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <span className={`w-2 h-2 rounded-full ${x.c}`} />{x.l}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-auto custom-scrollbar">
            <table className="w-full border-collapse table-fixed min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-16 bg-slate-50 sticky top-0 z-30 border-r border-slate-100" />
                  {GRID.map(col => (
                    <th key={col.id} className={`sticky top-0 z-20 border-r border-slate-100 last:border-r-0 px-1 py-3 text-center
                      ${col.type !== 'class' ? 'bg-slate-50/60 w-14' : 'bg-slate-50'}`}>
                      <p className={`text-[9px] font-black uppercase tracking-widest leading-none
                        ${col.type !== 'class' ? 'text-slate-300' : 'text-slate-700'}`}>{col.label}</p>
                      <p className="text-[7px] font-bold text-slate-300 mt-0.5 whitespace-nowrap">{col.time}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DAYS.map(day => {
                  const isToday = day === ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][currentTime.getDay()];
                  const nowStr  = currentTime.toTimeString().substring(0, 5);
                  return (
                    <tr key={day} className={isToday ? 'bg-blue-50/20' : ''}>
                      <td className={`border-r border-slate-100 text-center sticky left-0 z-10 ${isToday ? 'bg-blue-50' : 'bg-slate-50/60'}`}>
                        <div className="flex flex-col items-center justify-center py-2 px-1">
                          <span className={`text-[10px] font-black uppercase tracking-tighter leading-none ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                            {day.substring(0, 3)}
                          </span>
                          {isToday && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                        </div>
                      </td>
                      {GRID.map(col => {
                        if (col.type !== 'class') {
                          return (
                            <td key={col.id} className="border-r border-slate-100 bg-slate-50/30 w-14">
                              <div className="flex items-center justify-center py-2 opacity-30">
                                {col.type === 'lunch' ? <FaUtensils size={9} className="text-orange-400" /> : <FaCoffee size={9} className="text-amber-400" />}
                              </div>
                            </td>
                          );
                        }
                        const slot = (() => {
                          const direct = schedule.find(s => s.day === day && (s.period_id === col.id || s.period === col.id));
                          return direct || null;
                        })();
                        return <TimetableCell key={col.id} slot={slot} col={col} day={day} isToday={isToday} nowStr={nowStr} />;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ALERT DIALOG */}
      <Dialog open={isAlertOpen} fullScreen>
        <DialogContent className="flex flex-col items-center justify-center p-8 text-center h-full bg-[#F8FAFC]">
          <div className="max-w-4xl w-full">
            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-600 mb-8 mx-auto animate-bounce border border-amber-100">
              <FaExclamationTriangle size={32} />
            </div>
            <h1 className="text-slate-900 font-black tracking-tighter mb-8 text-5xl lg:text-7xl uppercase leading-none">
              {incomingAlert?.alert_minutes}m Warning
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 text-left shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Session Subject</p>
                <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">{incomingAlert?.subject_name}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 text-left shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deployment Room</p>
                <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">Sector {incomingAlert?.classroom}</h3>
              </div>
            </div>
            <button
              onClick={handleAcknowledge}
              className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-lg uppercase tracking-widest shadow-2xl hover:bg-black transition-all"
            >
              Acknowledge Protocol
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onClose={() => setIsDetailOpen(false)} PaperProps={{ sx: { borderRadius: '2.5rem', maxWidth: '450px', width: '90%' } }}>
        <div className="p-10 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 mx-auto border border-blue-100 shadow-sm relative">
             <FaChalkboardTeacher size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Session Intelligence</p>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-6">{selectedSession?.subject_name}</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Sector</span>
                <span className="text-sm font-black text-slate-900">Room {selectedSession?.classroom}</span>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Period</span>
                <span className="text-sm font-black text-slate-900">P{selectedSession?.period}</span>
             </div>
          </div>

          <button
            onClick={async () => {
              try {
                await activityService.add({
                  faculty_id: localStorage.getItem('faculty_id'),
                  subject_name: selectedSession.subject_name,
                  room_number: selectedSession.classroom,
                  group_id: selectedSession.group_id,
                  period_id: selectedSession.period_id || selectedSession.period,
                  name: JSON.parse(localStorage.getItem('user') || '{}').name,
                  action: "Activated Session"
                });
                setIsDetailOpen(false);
                toast.success("Mission Protocol Activated.");
              } catch (err) { toast.error("Sync Failed."); }
            }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all mb-4"
          >
            Confirm Deployment
          </button>
          <button onClick={() => setIsDetailOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all">Cancel Request</button>
        </div>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} PaperProps={{ sx: { borderRadius: '2.5rem', maxWidth: '400px', width: '90%' } }}>
         <div className="p-10">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Control Hub</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Broadcast Preferences</p>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between mb-8">
               <div>
                  <p className="text-sm font-black text-slate-900">Global Alerts</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Master Switch</p>
               </div>
               <button 
                  onClick={() => setAlertSettings({ ...alertSettings, globalEnabled: !alertSettings.globalEnabled })}
                  className={`w-14 h-8 rounded-full relative transition-all ${alertSettings.globalEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
               >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${alertSettings.globalEnabled ? 'left-7' : 'left-1'}`}></div>
               </button>
            </div>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Commit Sync</button>
         </div>
      </Dialog>
    </div>
  );
};

export default FacultyDashboard;
