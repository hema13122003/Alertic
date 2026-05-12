import React, { useState, useEffect, useRef } from 'react';
import { timetableService } from '../services/firebaseService';
import { toast } from 'react-toastify';
import { FaMapMarkerAlt, FaUserGraduate, FaClock, FaCoffee, FaUtensils } from 'react-icons/fa';
import ClockLoader from '../components/ClockLoader';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const GRID = [
  { id: 'P1', type: 'class', label: 'P1',    time: '09:00 – 09:50' },
  { id: 'P2', type: 'class', label: 'P2',    time: '09:50 – 10:40' },
  { id: 'B1', type: 'break', label: 'Break', time: '10:40 – 10:55' },
  { id: 'P3', type: 'class', label: 'P3',    time: '10:55 – 11:45' },
  { id: 'P4', type: 'class', label: 'P4',    time: '11:45 – 12:35' },
  { id: 'L',  type: 'lunch', label: 'Lunch', time: '12:35 – 13:15' },
  { id: 'P5', type: 'class', label: 'P5',    time: '13:15 – 14:05' },
  { id: 'P6', type: 'class', label: 'P6',    time: '14:05 – 14:55' },
  { id: 'B2', type: 'break', label: 'Break', time: '14:55 – 15:10' },
  { id: 'P7', type: 'class', label: 'P7',    time: '15:10 – 16:00' },
  { id: 'P8', type: 'class', label: 'P8',    time: '16:00 – 16:50' },
];

// ── Popover ────────────────────────────────────────────────────────────────────
const Popover = ({ slot, col, day, anchorRef }) => {
  const popRef = useRef(null);

  useEffect(() => {
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
    <div
      ref={popRef}
      className="fixed z-50 w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden pointer-events-none"
      style={{ top: 0, left: 0 }}
    >
      <div className="bg-[#0f172a] px-5 py-4">
        <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.25em] mb-1">
          {col.label} · {day}
        </p>
        <h3 className="text-[15px] font-black text-white uppercase tracking-tight leading-tight line-clamp-2">
          {slot.subject_name}
        </h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        <Row icon={<FaUserGraduate size={11} className="text-blue-600" />} bg="bg-blue-50" label="Class" value={`${slot.dept || ''} · ${slot.program || ''} · Sec ${slot.section || ''}`} />
        <Row icon={<FaMapMarkerAlt size={11} className="text-emerald-600" />} bg="bg-emerald-50" label="Room" value={slot.classroom || 'TBA'} />
        <Row icon={<FaClock size={11} className="text-amber-600" />} bg="bg-amber-50" label="Time" value={col.time} />
      </div>
    </div>
  );
};

const Row = ({ icon, bg, label, value }) => (
  <div className="flex items-center gap-3">
    <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
    <div>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{label}</p>
      <p className="text-[12px] font-bold text-slate-800 leading-none truncate max-w-[180px]">{value}</p>
    </div>
  </div>
);

// ── Cell ───────────────────────────────────────────────────────────────────────
const Cell = ({ slot, col, day, isToday, nowStr }) => {
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);

  const [start, end] = col.time.split(' – ');
  const isLive      = isToday && nowStr >= start && nowStr < end;
  const isCompleted = isToday && nowStr >= end;

  return (
    <td
      ref={ref}
      className={`p-1.5 border-r border-slate-100 last:border-r-0 transition-all
        ${isLive ? 'bg-emerald-50/60' : isCompleted ? 'bg-slate-50/30' : 'bg-white hover:bg-blue-50/20'}`}
      style={{ height: 88 }}
      onMouseEnter={() => slot && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {slot ? (
        <div className={`h-full flex flex-col px-2.5 py-2 rounded-xl border transition-all overflow-hidden
          border-l-[3px]
          ${isLive
            ? 'bg-white border-emerald-300 border-l-emerald-500 shadow-md shadow-emerald-100'
            : isCompleted
            ? 'bg-slate-50 border-slate-100 border-l-slate-300 opacity-50'
            : 'bg-white border-slate-100 border-l-blue-500 shadow-sm hover:shadow-md hover:border-blue-200'
          }`}
        >
          {isLive && (
            <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live
            </span>
          )}
          <p className="text-[10px] font-black text-slate-900 leading-tight line-clamp-2 uppercase tracking-tight">
            {slot.subject_name}
          </p>
          <p className="text-[8px] font-bold text-slate-500 truncate mt-1 uppercase">
            {slot.program || slot.dept} · Sec {slot.section}
          </p>
          <span className="text-[7px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mt-1 self-start uppercase leading-none">
            RM {slot.classroom || 'TBA'}
          </span>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center opacity-5">
          <span className="text-[10px] font-black">—</span>
        </div>
      )}

      {hovered && slot && <Popover slot={slot} col={col} day={day} anchorRef={ref} />}
    </td>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const MyTimetable = () => {
  const [timetable, setTimetable]     = useState({});
  const [loading, setLoading]         = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const nowStr   = currentTime.toTimeString().substring(0, 5);
  const todayDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][currentTime.getDay()];

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user      = JSON.parse(localStorage.getItem('user') || '{}');
        const facultyId = localStorage.getItem('faculty_id') || user.id;
        if (!facultyId) { setLoading(false); return; }

        const data = await timetableService.getFacultyWeekly(facultyId);

        const mapped = {};
        data.forEach(item => {
          const pId = item.period_id ?? item.period;
          mapped[`${item.day}-${pId}`] = item;
        });
        setTimetable(mapped);
      } catch {
        toast.error('Failed to load weekly schedule.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full flex flex-col bg-[#f8fafc] overflow-hidden">

      {/* Top bar */}
      <div className="shrink-0 px-4 lg:px-8 pt-5 pb-4 flex items-center justify-between gap-4 border-b border-slate-100 bg-white">
        <div>
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight leading-none">
            My Timetable
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Weekly class assignment schedule
          </p>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-4">
          {[
            { color: 'bg-emerald-500', label: 'Live' },
            { color: 'bg-blue-500',    label: 'Upcoming' },
            { color: 'bg-slate-200',   label: 'Done' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <span className={`w-2 h-2 rounded-full ${l.color}`} />{l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4 lg:p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-[820px]">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="w-16 lg:w-20 bg-slate-50 sticky top-0 z-30 border-r border-slate-100" />
                {GRID.map(col => (
                  <th
                    key={col.id}
                    className={`sticky top-0 z-20 border-r border-slate-100 last:border-r-0 px-1 py-3 text-center
                      ${col.type !== 'class' ? 'bg-slate-50/60 w-14' : 'bg-slate-50'}`}
                  >
                    <p className={`text-[9px] font-black uppercase tracking-widest leading-none
                      ${col.type !== 'class' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {col.label}
                    </p>
                    <p className="text-[7px] font-bold text-slate-300 mt-0.5 whitespace-nowrap">{col.time}</p>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {DAYS.map(day => {
                const isToday = day === todayDay;
                return (
                  <tr key={day} className={isToday ? 'bg-blue-50/20' : ''}>
                    {/* Day label */}
                    <td className={`border-r border-slate-100 text-center sticky left-0 z-10
                      ${isToday ? 'bg-blue-50' : 'bg-slate-50/60'}`}>
                      <div className="flex flex-col items-center justify-center py-2 px-1">
                        <span className={`text-[10px] font-black uppercase tracking-tighter leading-none
                          ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                          {day.substring(0, 3)}
                        </span>
                        {isToday && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                      </div>
                    </td>

                    {GRID.map(col => {
                      if (col.type !== 'class') {
                        return (
                          <td key={col.id} className="border-r border-slate-100 bg-slate-50/30 w-14">
                            <div className="flex flex-col items-center justify-center gap-1 py-2 opacity-30">
                              {col.type === 'lunch'
                                ? <FaUtensils size={9} className="text-orange-400" />
                                : <FaCoffee size={9} className="text-amber-400" />}
                            </div>
                          </td>
                        );
                      }

                      const slot = timetable[`${day}-${col.id}`];
                      return (
                        <Cell
                          key={col.id}
                          slot={slot}
                          col={col}
                          day={day}
                          isToday={isToday}
                          nowStr={nowStr}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyTimetable;
