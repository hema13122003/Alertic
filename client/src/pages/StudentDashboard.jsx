import React, { useState, useEffect } from 'react';
import { Card, Dialog, DialogContent } from '@mui/material';
import { timetableService, studentService, feeService } from '../services/firebaseService';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import { FaExclamationTriangle } from 'react-icons/fa';
import { 
  FaClock, 
  FaMapMarkerAlt, 
  FaUserTie, 
  FaChevronRight,
  FaBell,
  FaUserGraduate,
  FaCheckCircle,
  FaTable,
  FaShieldAlt,
  FaBroadcastTower,
  FaCoffee,
  FaUtensils,
  FaTimes
} from 'react-icons/fa';
import ClockLoader from '../components/ClockLoader';

const DEFAULT_GRID = [
  { id: 'P1', type: 'class', label: 'P1', time: '09:00 – 09:50' },
  { id: 'P2', type: 'class', label: 'P2', time: '09:50 – 10:40' },
  { id: 'B1', type: 'break', label: 'Break', time: '10:40 – 10:55' },
  { id: 'P3', type: 'class', label: 'P3', time: '10:55 – 11:45' },
  { id: 'P4', type: 'class', label: 'P4', time: '11:45 – 12:35' },
  { id: 'L',  type: 'lunch', label: 'Lunch', time: '12:35 – 13:15' },
  { id: 'P5', type: 'class', label: 'P5', time: '13:15 – 14:05' },
  { id: 'P6', type: 'class', label: 'P6', time: '14:05 – 14:55' },
  { id: 'B2', type: 'break', label: 'Break', time: '14:55 – 15:10' },
  { id: 'P7', type: 'class', label: 'P7', time: '15:10 – 16:00' },
  { id: 'P8', type: 'class', label: 'P8', time: '16:00 – 16:50' },
];

const StudentDashboard = () => {
  const [schedule, setSchedule] = useState([]);
  const [gridConfig, setGridConfig] = useState(DEFAULT_GRID);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [student, setStudent] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [currentClass, setCurrentClass] = useState(null);
  const [nextClass, setNextClass] = useState(null);
  const [countdown, setCountdown] = useState('00:00');

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [alertPrefs, setAlertPrefs] = useState({});
  const [feeWarning, setFeeWarning] = useState(null);

  const fetchData = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (!storedUser.enroll_no) return;
      
      const data = await timetableService.getStudentDashboard(storedUser.enroll_no);
      const sData = data.student;
      const deptCode = sData.dept === 'Master of Computer Applications' ? 'MCA' : (sData.dept?.substring(0,3).toUpperCase() || 'MCA');
      const fallbackGid = sData.group_id || `${deptCode}-${sData.program}-SEM${sData.semester}-${sData.section}`;
      const structure = await timetableService.getStructure(fallbackGid);
      
      setSchedule(data.schedule);
      setStudent(data.student);
      setAlertPrefs(data.student.alert_prefs || {});
      if (structure && Array.isArray(structure)) setGridConfig(structure);
      else setGridConfig(DEFAULT_GRID);

      // Check fee status
      const fees = await feeService.getAll();
      const myFee = fees.find(f => f.student_id === sData.id || f.enroll_no === storedUser.enroll_no);
      if (myFee) {
        const y1Pending = myFee.year1_status === 'Pending' || myFee.year1_status === 'Partial';
        const y2Pending = myFee.year2_status === 'Pending' || myFee.year2_status === 'Partial';
        if (y1Pending || y2Pending) {
          const totalDue = (y1Pending ? (myFee.year1_remaining || 0) : 0) +
                           (y2Pending ? (myFee.year2_remaining || 0) : 0);
          setFeeWarning({ totalDue, year1: y1Pending ? myFee.year1_status : null, year2: y2Pending ? myFee.year2_status : null });
        }
      }
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Listen for incoming alerts from the scheduler
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const studentId = storedUser.uid || storedUser.id;
    let unsubscribe = () => {};
    if (studentId) {
      const alertRef = doc(db, 'alerts', studentId);
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
        updateDoc(alertRef, { pending: arrayRemove(alert) }).catch(() => {});
      });
    }

    return () => { clearInterval(timer); unsubscribe(); };
  }, []);

  useEffect(() => {
    if (schedule.length > 0 && gridConfig.length > 0) {
      const nowStr = currentTime.toTimeString().substring(0, 5);
      const configMap = {};
      gridConfig.forEach(c => configMap[c.id] = c);

      const current = schedule.find(item => {
        const conf = configMap[item.period_id || item.period];
        if (!conf) return false;
        const [start, end] = conf.time.split(' – ');
        return nowStr >= start && nowStr < end;
      });
      setCurrentClass(current || null);

      const upcoming = schedule.filter(item => {
        const conf = configMap[item.period_id || item.period];
        if (!conf) return false;
        const [start] = conf.time.split(' – ');
        return start > nowStr;
      }).sort((a, b) => {
        const startA = configMap[a.period_id || a.period]?.time.split(' – ')[0];
        const startB = configMap[b.period_id || b.period]?.time.split(' – ')[0];
        return startA.localeCompare(startB);
      })[0];
      
      setNextClass(upcoming || null);

      if (upcoming) {
        const startTime = configMap[upcoming.period_id || upcoming.period]?.time.split(' – ')[0];
        if (startTime) {
          const [h, m] = startTime.split(':').map(Number);
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
        }
      }
    }
  }, [schedule, gridConfig, currentTime]);

  const toggleAlert = async (facultyId) => {
    const newPrefs = { ...alertPrefs, [facultyId]: !alertPrefs[facultyId] };
    setAlertPrefs(newPrefs);
    try {
      await studentService.updatePrefs(student.uid || student.id, newPrefs);
    } catch (error) {
      console.error("Failed to save alert preferences");
    }
  };

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full bg-[#f8fafc] p-4 lg:p-10 overflow-y-auto custom-scrollbar font-sans">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-10 animate-fade-in pb-16">
        
        {/* Header: Personnel Status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 lg:gap-6">
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl lg:rounded-[2rem] bg-[#0f172a] flex items-center justify-center text-white shadow-2xl border border-slate-800 shrink-0">
               <FaUserGraduate size={28} className="lg:hidden" />
               <FaUserGraduate size={36} className="hidden lg:block" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-xl lg:text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2 uppercase truncate">
                {student.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 lg:gap-4">
                <span className="text-[9px] lg:text-[11px] font-black bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-100 uppercase tracking-widest">{student.enroll_no}</span>
                <span className="text-[10px] lg:text-[12px] font-bold text-slate-400 uppercase tracking-widest truncate">{student.dept} • SEC {student.section}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 lg:gap-8 bg-white p-3 lg:p-4 rounded-2xl lg:rounded-[2rem] border border-slate-200/60 shadow-sm sm:pr-10">
             <div className="flex items-center gap-4 pl-2 w-full sm:w-auto">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <div>
                   <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] leading-none mb-1.5 text-left">Network Status</p>
                   <p className="text-[12px] lg:text-[14px] font-black text-slate-800 leading-none uppercase tracking-tight text-left">Active Node Live</p>
                </div>
             </div>
             <div className="hidden sm:block h-10 w-px bg-slate-100"></div>
             <div className="flex justify-between items-center w-full sm:w-auto sm:text-right gap-8">
                <div>
                   <p className="text-[14px] lg:text-[18px] font-black text-slate-900 leading-none mb-1 tracking-tighter font-mono">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                   <p className="text-[8px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentTime.toLocaleDateString('en-US', { weekday: 'long' })}</p>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100"
                >
                   <FaBell size={18} />
                </button>
             </div>
          </div>
        </div>

        {/* Fee Warning Banner */}
        {feeWarning && (
          <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <FaExclamationTriangle className="text-amber-600" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-amber-800 uppercase tracking-tight">
                Fee Payment Pending
              </p>
              <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                Outstanding: Rs.{feeWarning.totalDue.toLocaleString()}
                {feeWarning.year1 && ` · Year 1: ${feeWarning.year1}`}
                {feeWarning.year2 && ` · Year 2: ${feeWarning.year2}`}
              </p>
            </div>
            <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg uppercase tracking-widest whitespace-nowrap">
              Pay Now
            </span>
          </div>
        )}

        {/* Tactical Mission Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Active Sector Deployment */}
          <div className="lg:col-span-8">
            {currentClass ? (
              <div className="relative overflow-hidden rounded-3xl bg-[#0f172a] text-white p-6 lg:p-14 shadow-2xl border border-slate-800 h-full flex flex-col justify-between group">
                <div className="absolute top-0 right-0 w-64 lg:w-[500px] h-64 lg:h-[500px] bg-blue-600/10 blur-[80px] lg:blur-[120px] rounded-full -mr-16 lg:-mr-32 -mt-16 lg:-mt-32"></div>
                
                <div className="relative">
                  <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20 mb-8 lg:mb-10">
                    <div className="w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                    <span className="text-emerald-400 font-black uppercase tracking-[0.2em] text-[9px] lg:text-[11px]">Objective Active</span>
                  </div>
                  
                  <h2 className="text-3xl lg:text-6xl font-black tracking-tighter mb-6 leading-tight uppercase max-w-2xl">
                    {currentClass.subject_name}
                  </h2>
                  
                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-6 lg:gap-12 mt-8 lg:mt-12">
                    <div className="flex items-center gap-4 lg:gap-5">
                      <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 border border-white/10">
                        <FaUserTie size={18} className="lg:hidden" />
                        <FaUserTie size={24} className="hidden lg:block" />
                      </div>
                      <div>
                        <p className="text-[9px] lg:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Command</p>
                        <p className="text-sm lg:text-[18px] font-bold text-white tracking-tight">{currentClass.faculty_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 lg:gap-5">
                      <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 border border-white/10">
                        <FaMapMarkerAlt size={18} className="lg:hidden" />
                        <FaMapMarkerAlt size={24} className="hidden lg:block" />
                      </div>
                      <div>
                        <p className="text-[9px] lg:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Sector</p>
                        <p className="text-sm lg:text-[18px] font-bold text-white tracking-tight">Room {currentClass.classroom}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative mt-12 lg:mt-16 pt-8 lg:pt-10 border-t border-white/5 flex items-end justify-between">
                   <div>
                      <p className="text-[9px] lg:text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 lg:mb-3">Temporal Slot</p>
                      <p className="text-xl lg:text-3xl font-black text-white/90 font-mono tracking-tighter">
                         {gridConfig.find(c => c.id === (currentClass.period_id || currentClass.period))?.time}
                      </p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] lg:text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 lg:mb-3">Protocol</p>
                      <p className="text-3xl lg:text-5xl font-black text-blue-500 italic leading-none">{currentClass.period_id || currentClass.period}</p>
                   </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-white border border-slate-200/60 p-10 lg:p-16 flex flex-col items-center justify-center text-center shadow-sm h-full group">
                <div className="w-20 h-20 lg:w-32 lg:h-32 rounded-2xl lg:rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-200 mb-8 border border-slate-100 transition-all shadow-inner">
                  <FaBroadcastTower size={40} className="lg:hidden" />
                  <FaBroadcastTower size={60} className="hidden lg:block" />
                </div>
                <h3 className="text-xl lg:text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4">Sector Standby</h3>
                <p className="text-slate-400 font-bold text-xs lg:text-[15px] max-w-sm leading-relaxed uppercase tracking-wider opacity-60">Scanning for active protocols...</p>
              </div>
            )}
          </div>

          {/* Incoming Mission Strategy */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:gap-8">
            <Card className="rounded-3xl p-8 lg:p-10 bg-white border border-slate-200/60 shadow-sm flex-1 flex flex-col justify-between hover:shadow-xl transition-all relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full"></div>
               <div>
                  <div className="flex items-center justify-between mb-8 lg:mb-10">
                     <span className="text-[9px] lg:text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 uppercase tracking-widest">Incoming</span>
                     <FaClock size={16} className="text-slate-300" />
                  </div>
                  
                  {nextClass ? (
                    <div className="space-y-6 lg:space-y-8">
                       <div>
                          <h4 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter leading-tight uppercase truncate">{nextClass.subject_name}</h4>
                          <p className="text-slate-400 font-bold text-xs lg:text-[15px] mt-2 flex items-center gap-2 italic">
                             <FaUserTie size={12} className="text-slate-300" /> {nextClass.faculty_name}
                          </p>
                       </div>
                       
                       <div className="p-6 rounded-2xl lg:rounded-[2rem] bg-slate-900 text-white border border-slate-800 shadow-xl">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Commencing In</p>
                          <p className="text-4xl lg:text-5xl font-black text-white font-mono tracking-tighter leading-none">{countdown}</p>
                       </div>
                    </div>
                  ) : (
                    <div className="py-10 flex flex-col items-center justify-center text-center">
                       <p className="text-slate-300 font-black text-xs uppercase tracking-[0.2em]">Ops Terminated</p>
                    </div>
                  )}
               </div>
               
               {nextClass && (
                 <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                       <FaMapMarkerAlt className="text-blue-500" size={14} />
                       <span className="text-sm lg:text-[16px] font-black text-slate-900 uppercase tracking-tight truncate max-w-[100px]">RM {nextClass.classroom}</span>
                    </div>
                    <span className="text-[11px] lg:text-[13px] font-bold text-slate-400 font-mono">{gridConfig.find(c => c.id === (nextClass.period_id || nextClass.period))?.time.split(' – ')[0]}</span>
                 </div>
               )}
            </Card>

            {/* Tactical Load Metrics */}
            <div className="grid grid-cols-2 gap-4 lg:gap-6">
               <div className="bg-[#0f172a] text-white p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden group">
                  <p className="text-[9px] lg:text-[11px] font-black text-slate-500 uppercase tracking-widest relative z-10">Daily nodes</p>
                  <div className="flex items-end gap-2 mt-4 relative z-10">
                     <span className="text-3xl lg:text-4xl font-black leading-none">{schedule.length.toString().padStart(2, '0')}</span>
                  </div>
               </div>
               <div className="bg-white border border-slate-200/60 p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] shadow-sm hover:shadow-md transition-all">
                  <p className="text-[9px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest">Finished</p>
                  <div className="flex items-end gap-2 mt-4">
                     <span className="text-3xl lg:text-4xl font-black text-slate-900 leading-none">
                        {schedule.filter(s => {
                           const end = gridConfig.find(c => c.id === (s.period_id || s.period))?.time.split(' – ')[1];
                           return end && currentTime.toTimeString().substring(0, 5) >= end;
                        }).length.toString().padStart(2, '0')}
                     </span>
                     <FaCheckCircle className="text-emerald-500 mb-1" size={14} />
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Full Strategic Mission Chronology */}
        <div className="bg-white rounded-[2rem] lg:rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 lg:px-12 py-6 lg:py-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50">
             <div>
                <h3 className="text-lg lg:text-xl font-black text-slate-900 uppercase tracking-tighter">Full Chronology</h3>
                <p className="text-[9px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Deployment Logs</p>
             </div>
             <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Next</span></div>
             </div>
          </div>
          
          <div className="divide-y divide-slate-50">
            {schedule.length > 0 ? (
              gridConfig.map((col, i) => {
                const item = schedule.find(s => (s.period_id || s.period) === col.id);
                if (col.type !== 'class') {
                    return (
                        <div key={col.id} className="flex items-center py-4 lg:h-20 px-6 lg:px-12 bg-slate-50/30 opacity-40 grayscale transition-all">
                             <div className="w-12 lg:w-20 shrink-0 text-center">
                                <span className="text-[10px] lg:text-xs font-black text-slate-300 tracking-widest uppercase">{col.label}</span>
                             </div>
                             <div className="flex-1 px-4 lg:px-12 flex items-center gap-3">
                                {col.type === 'lunch' ? <FaUtensils size={12} /> : <FaCoffee size={12} />}
                                <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">{col.label} WINDOW</span>
                             </div>
                             <div className="text-right font-mono text-[11px] lg:text-[13px] font-black text-slate-300 shrink-0">{col.time}</div>
                        </div>
                    );
                }

                const isCurrent = currentClass?.period_id === col.id || currentClass?.period === col.id;
                const isNext = nextClass?.period_id === col.id || nextClass?.period === col.id;
                const [start, end] = col.time.split(' – ');
                const isCompleted = end && currentTime.toTimeString().substring(0, 5) >= end;

                return (
                  <div key={col.id} className={`flex flex-col sm:flex-row sm:items-center py-5 lg:py-0 lg:h-28 px-6 lg:px-12 transition-all gap-4 sm:gap-0 ${
                    isCurrent ? 'bg-emerald-50/30' : 
                    isNext ? 'bg-blue-50/30' : 
                    isCompleted ? 'opacity-30 grayscale-[0.5]' : 'bg-white hover:bg-slate-50/50'
                  }`}>
                    
                    <div className="w-full sm:w-20 flex justify-between sm:flex-col sm:items-center items-center">
                       <span className={`text-base lg:text-[18px] font-black ${isCurrent ? 'text-emerald-600' : isNext ? 'text-blue-600' : 'text-slate-300'}`}>{col.label}</span>
                       <span className="sm:hidden text-[10px] font-black text-slate-400 font-mono">{col.time}</span>
                    </div>

                    <div className="flex-1 sm:px-12">
                       {item ? (
                         <>
                           <h5 className="text-sm lg:text-[18px] font-black text-slate-900 uppercase tracking-tight truncate mb-1">{item.subject_name}</h5>
                           <span className="text-[10px] lg:text-[12px] font-bold text-slate-400 flex items-center gap-2">
                              <FaUserTie size={10} className="text-slate-300" /> {item.faculty_name}
                           </span>
                         </>
                       ) : (
                         <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest italic">Standby</span>
                       )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end sm:w-auto gap-8">
                       <div className="hidden sm:flex flex-col items-end pr-8">
                          <span className="text-sm lg:text-[15px] font-black text-slate-800 tracking-tighter font-mono">{col.time}</span>
                       </div>
                       
                       {item && (
                         <div className="flex flex-col sm:items-end">
                            <span className="text-sm lg:text-[16px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                               <FaMapMarkerAlt size={12} className="text-blue-500/30" /> RM {item.classroom}
                            </span>
                         </div>
                       )}

                       <div className="w-10 sm:w-32 flex justify-end">
                          {isCurrent ? (
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center animate-pulse shadow-lg shadow-emerald-500/30">
                               <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                            </div>
                          ) : isCompleted ? (
                             <FaCheckCircle className="text-emerald-500/40" size={18} />
                          ) : (
                             <FaChevronRight size={14} className="text-slate-100" />
                          )}
                       </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                 <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-30">No Missions Logged</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Incoming Alert Modal */}
      <Dialog open={isAlertOpen} fullScreen>
        <DialogContent className="flex flex-col items-center justify-center p-8 text-center h-full bg-[#F8FAFC]">
          <div className="max-w-2xl w-full">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-8 mx-auto animate-bounce border border-blue-100">
              <FaBell size={32} />
            </div>
            <h1 className="text-slate-900 font-black tracking-tighter mb-4 text-5xl lg:text-7xl uppercase leading-none">
              {incomingAlert?.alert_minutes}m Warning
            </h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-8">Your next class is starting soon</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 text-left shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject</p>
                <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">{incomingAlert?.subject_name}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 text-left shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Room</p>
                <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">{incomingAlert?.classroom}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 text-left shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Faculty</p>
                <h3 className="text-xl font-black text-slate-900 uppercase leading-tight">{incomingAlert?.faculty_name}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 text-left shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Starts At</p>
                <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">{incomingAlert?.period_start}</h3>
              </div>
            </div>
            <button
              onClick={() => setIsAlertOpen(false)}
              className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-lg uppercase tracking-widest shadow-2xl hover:bg-black transition-all"
            >
              Got It
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog 
        open={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        PaperProps={{ sx: { borderRadius: '2rem', maxWidth: '400px', width: '90%' } }}
      >
         <div className="p-8">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-6">Alert Logic</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
               {Array.from(new Set(schedule.map(s => s.faculty_id))).map(fId => {
                  const facultyName = schedule.find(s => s.faculty_id === fId)?.faculty_name || "Faculty";
                  const isActive = alertPrefs[fId] !== false;
                  return (
                     <div key={fId} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{facultyName}</span>
                        <button 
                           onClick={() => toggleAlert(fId)}
                           className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                              isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'
                           }`}
                        >
                           {isActive ? 'Active' : 'Muted'}
                        </button>
                     </div>
                  );
               })}
            </div>
            <button 
               onClick={() => setIsSettingsOpen(false)}
               className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
            >
               Confirm Sync
            </button>
         </div>
      </Dialog>
    </div>
  );
};

export default StudentDashboard;
