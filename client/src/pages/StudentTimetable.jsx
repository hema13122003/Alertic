import React, { useState, useEffect, useRef, useMemo } from 'react';
import { timetableService, facultyService } from '../services/firebaseService';
import { FaLayerGroup, FaSearch, FaChevronRight, FaCoffee, FaUtensils, FaArrowLeft, FaMapMarkerAlt, FaUserTie, FaClock } from 'react-icons/fa';
import ClockLoader from '../components/ClockLoader';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_STRUCTURE = [
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

// ── Popover ────────────────────────────────────────────────────────────────────
const Popover = ({ cell, col, day, anchorRef, onClose }) => {
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
    if (top + 220 > vh - 12)   top  = rect.top - 228;

    pop.style.top  = `${top}px`;
    pop.style.left = `${left}px`;
  }, [anchorRef]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={popRef}
        className="fixed z-50 w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in"
        style={{ top: 0, left: 0 }}
      >
        {/* Header */}
        <div className="bg-[#0f172a] px-5 py-4">
          <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.25em] mb-1">{col.label} · {day}</p>
          <h3 className="text-[15px] font-black text-white uppercase tracking-tight leading-tight line-clamp-2">
            {cell.subject_name}
          </h3>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <FaUserTie size={11} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Faculty</p>
              <p className="text-[12px] font-bold text-slate-800 leading-none">{cell.faculty_name || 'TBA'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <FaMapMarkerAlt size={11} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Room</p>
              <p className="text-[12px] font-bold text-slate-800 leading-none">{cell.classroom || 'TBA'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <FaClock size={11} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Time</p>
              <p className="text-[12px] font-bold text-slate-800 leading-none">{col.time}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Cell ───────────────────────────────────────────────────────────────────────
const ClassCell = ({ cell, col, day, isToday, nowStr }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const [start, end] = col.time.split(' – ');
  const isLive      = isToday && nowStr >= start && nowStr < end;
  const isCompleted = isToday && nowStr >= end;

  return (
    <td
      ref={ref}
      className={`p-1.5 border-r border-slate-100 transition-all cursor-default
        ${isLive ? 'bg-emerald-50/60' : isCompleted ? 'bg-slate-50/40' : 'bg-white hover:bg-blue-50/20'}`}
      style={{ height: 88 }}
      onMouseEnter={() => cell && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {cell ? (
        <div className={`h-full flex flex-col px-2.5 py-2 rounded-xl border transition-all overflow-hidden
          ${isLive
            ? 'bg-white border-emerald-400 shadow-md shadow-emerald-100'
            : isCompleted
            ? 'bg-slate-50 border-slate-100 opacity-50'
            : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-blue-300'
          } border-l-[3px] ${isLive ? 'border-l-emerald-500' : 'border-l-blue-500'}`}
        >
          {isLive && (
            <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live
            </span>
          )}
          <p className="text-[10px] font-black text-slate-900 leading-tight line-clamp-2 uppercase tracking-tight">
            {cell.subject_name}
          </p>
          <p className="text-[8px] font-bold text-slate-400 truncate mt-auto pt-1 uppercase">
            {cell.faculty_name}
          </p>
          <span className="text-[7px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 self-start uppercase leading-none">
            RM {cell.classroom || 'TBA'}
          </span>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center opacity-5">
          <span className="text-[10px] font-black">—</span>
        </div>
      )}

      {open && cell && (
        <Popover cell={cell} col={col} day={day} anchorRef={ref} onClose={() => setOpen(false)} />
      )}
    </td>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const StudentTimetable = () => {
  const [view, setView]               = useState('list');
  const [timetable, setTimetable]     = useState({});
  const [gridConfig, setGridConfig]   = useState(DEFAULT_STRUCTURE);
  const [loading, setLoading]         = useState(false);
  const [existingLists, setExistingLists] = useState([]);
  const [selection, setSelection]     = useState(null);
  const [searchTerm, setSearchTerm]   = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const userRole = useMemo(() => localStorage.getItem('userRole') || 'admin', []);
  const nowStr   = currentTime.toTimeString().substring(0, 5);
  const todayDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][currentTime.getDay()];

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchTimetableDetails = async (item) => {
    setSelection(item);
    setLoading(true);
    try {
      const deptCode = item.dept === 'Master of Computer Applications'
        ? 'MCA'
        : (item.dept?.substring(0, 3).toUpperCase() || 'MCA');
      const gid = item.group_id || `${deptCode}-${item.program}-SEM${item.semester}-${item.section}`;

      const structure = await timetableService.getStructure(gid);
      setGridConfig(structure || DEFAULT_STRUCTURE);

      const [entries, faculties] = await Promise.all([
        timetableService.getByGroupId(gid),
        facultyService.getAll(),
      ]);

      const facultyMap = {};
      faculties.forEach(f => { facultyMap[f.id] = f.name; });

      const mapped = {};
      entries.forEach(entry => {
        mapped[`${entry.day}-${entry.period_id}`] = {
          ...entry,
          faculty_name: facultyMap[entry.faculty_id] || 'N/A',
        };
      });

      setTimetable(mapped);
      setView('detail');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (userRole === 'student' && user) {
      fetchTimetableDetails(user);
    } else if (userRole !== 'student') {
      setLoading(true);
      timetableService.getAllStructures()
        .then(setExistingLists)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [userRole]);

  const filtered = existingLists.filter(l =>
    `${l.program} ${l.dept} ${l.semester} ${l.section}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const classCols  = gridConfig.filter(c => c.type === 'class');
  const breakCols  = gridConfig.filter(c => c.type !== 'class');

  if (loading) return <ClockLoader />;

  // ── List view (admin / faculty) ──────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="w-full h-full bg-[#f8fafc] p-4 lg:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Student Timetable</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Select a class to view schedule</p>
            </div>
            <div className="relative w-full sm:w-64">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-[12px] text-slate-800 outline-none focus:border-blue-400 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length > 0 ? filtered.map((item, i) => (
              <button
                key={i}
                onClick={() => fetchTimetableDetails(item)}
                className="group text-left bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-xl hover:border-blue-300 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 blur-2xl rounded-full" />
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <FaLayerGroup size={15} />
                  </div>
                  <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 uppercase tracking-widest">
                    SEC {item.section}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate mb-0.5">{item.program}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{item.dept} · SEM {item.semester}</p>
                <div className="mt-5 flex items-center gap-1 text-[9px] font-black text-slate-300 group-hover:text-blue-500 uppercase tracking-widest transition-all">
                  View Schedule <FaChevronRight size={7} />
                </div>
              </button>
            )) : (
              <div className="col-span-full py-20 flex flex-col items-center text-slate-300">
                <FaLayerGroup size={40} className="opacity-10 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-30">No results found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Detail / timetable grid view ─────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-[#f8fafc] flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="shrink-0 px-4 lg:px-8 pt-5 pb-4 flex items-center justify-between gap-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          {userRole !== 'student' && (
            <button
              onClick={() => setView('list')}
              className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
            >
              <FaArrowLeft size={12} />
            </button>
          )}
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight leading-none">
              {selection?.program}
              <span className="text-blue-600 ml-2">· Sem {selection?.semester}</span>
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {selection?.dept} · Section {selection?.section}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Live
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Upcoming
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-slate-200" /> Done
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4 lg:p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-[820px]">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="border-b border-slate-100">
                {/* Day column header */}
                <th className="w-16 lg:w-20 bg-slate-50 sticky top-0 z-30 border-r border-slate-100" />

                {gridConfig.map(col => (
                  <th
                    key={col.id}
                    className={`sticky top-0 z-20 border-r border-slate-100 last:border-r-0 px-1 py-3
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
                        {isToday && (
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        )}
                      </div>
                    </td>

                    {gridConfig.map(col => {
                      // Break / lunch columns
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

                      const cell = timetable[`${day}-${col.id}`];
                      return (
                        <ClassCell
                          key={col.id}
                          cell={cell}
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

export default StudentTimetable;
