import React, { useState, useEffect } from 'react';
import { 
  timetableService, 
  facultyService,
  studentService
} from '../services/firebaseService';
import { toast } from 'react-toastify';
import ClockLoader from '../components/ClockLoader';
import { 
  Card, 
  Dialog, 
  DialogContent, 
  Tooltip, 
  IconButton, 
  Menu, 
  MenuItem,
  TextField
} from '@mui/material';
import { 
  FaSave, 
  FaTrash, 
  FaThLarge, 
  FaList, 
  FaFileExcel, 
  FaFileImport, 
  FaDownload, 
  FaPlus,
  FaClock,
  FaCoffee,
  FaUtensils,
  FaArrowLeft,
  FaCog,
  FaGripLines,
  FaPlusCircle,
  FaTimes
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_STRUCTURE = [
  { id: 'P1', type: 'class', label: 'P1', time: '09:00 – 09:50' },
  { id: 'P2', type: 'class', label: 'P2', time: '09:50 – 10:40' },
  { id: 'B1', type: 'break', label: 'BREAK', time: '10:40 – 10:55' },
  { id: 'P3', type: 'class', label: 'P3', time: '10:55 – 11:45' },
  { id: 'P4', type: 'class', label: 'P4', time: '11:45 – 12:35' },
  { id: 'L', type: 'lunch', label: 'LUNCH', time: '12:35 – 01:15' },
  { id: 'P5', type: 'class', label: 'P5', time: '01:15 – 02:05' },
  { id: 'P6', type: 'class', label: 'P6', time: '02:05 – 02:55' },
  { id: 'B2', type: 'break', label: 'BREAK', time: '02:55 – 03:10' },
  { id: 'P7', type: 'class', label: 'P7', time: '03:10 – 04:00' },
  { id: 'P8', type: 'class', label: 'P8', time: '04:00 – 04:50' },
];

const DEPT_MAP = {
  'Master of Computer Applications': { code: 'MCA', programs: ['MCA'] },
};

const TableCreation = () => {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list');
  const [selection, setSelection] = useState({ 
    dept: '', 
    section: '', 
    academic_year: '2024-25', 
    program: '', 
    semester: '', 
    group_id: '',
    default_room: '',
    advisor: '' 
  });
  
  const [gridConfig, setGridConfig] = useState(DEFAULT_STRUCTURE);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [conflictData, setConflictData] = useState(null); // For conflict warning modal
  const [isStructurePanelOpen, setIsStructurePanelOpen] = useState(false);
  const [timetable, setTimetable] = useState({});
  
  const [facultyList, setFacultyList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [existingTimetables, setExistingTimetables] = useState([]);

  const [conflict, setConflict] = useState(null);
  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false);
  const [originalGroupId, setOriginalGroupId] = useState(null);

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    try {
      setLoading(true);
      const [facs, structs] = await Promise.all([
        facultyService.getAll(),
        timetableService.getAllStructures()
      ]);
      setFacultyList(facs);
      setExistingTimetables(structs);
      setSubjectList([
        { id: 1, name: 'Data Structures', code: 'CS101' },
        { id: 2, name: 'Algorithm Analysis', code: 'CS102' }
      ]);
    } catch (error) {
      toast.error("Registry Sync Failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleFacultyChange = async (cellKey, day, period_id, faculty_id) => {
    if (!faculty_id) {
       setTimetable({ ...timetable, [cellKey]: { ...timetable[cellKey], faculty_id: '', faculty_name: '' }});
       return;
    }
    const faculty = facultyList.find(f => f.id === faculty_id);
    setLoading(true);
    try {
      const conflictData = await timetableService.checkConflict(faculty_id, day, period_id, selection.group_id);
      if (conflictData) {
        setConflict({ 
           ...conflictData, 
           cellKey, 
           faculty_name: faculty.name,
           new_faculty_id: faculty_id
        });
        setIsConflictOpen(true);
      } else {
        setTimetable({ 
           ...timetable, 
           [cellKey]: { ...timetable[cellKey], faculty_id, faculty_name: faculty.name }
        });
      }
    } catch (error) {
      toast.error("Conflict Processor Error.");
    } finally {
      setLoading(false);
    }
  };

  const handleSlotConfirm = async () => {
    // CHECK FOR EXTERNAL CONFLICTS
    const gid = selection.group_id || `${selection.dept}-${selection.program}-SEM${selection.semester}-${selection.section}`;
    const conflict = await timetableService.checkFacultyConflict(
      currentSlot.faculty_id, 
      currentSlot.day, 
      currentSlot.period_id,
      gid
    );

    if (conflict) {
       // If user hasn't already confirmed this specific conflict
       if (!window.confirm(`CONFLICT DETECTED!\n\nFaculty "${currentSlot.faculty_name}" is already assigned to ${conflict.program} (Sec ${conflict.section}) during ${currentSlot.day} ${currentSlot.period_id}.\n\nDo you want to override and assign anyway?`)) {
          return;
       }
    }

    const entry = {
      subject_id: currentSlot.subject_id,
      subject_name: currentSlot.subject_name,
      faculty_id: currentSlot.faculty_id,
      faculty_name: currentSlot.faculty_name,
      classroom: currentSlot.classroom || selection.default_room,
      color: currentSlot.color || '#3b82f6'
    };

    setTimetable(prev => ({
      ...prev,
      [`${currentSlot.day}-${currentSlot.period_id}`]: entry
    }));
    setIsSlotModalOpen(false);
  };

  const resolveConflict = async (override) => {
    if (override) {
        setTimetable({ 
           ...timetable, 
           [conflict.cellKey]: { ...timetable[conflict.cellKey], faculty_id: conflict.new_faculty_id, faculty_name: conflict.faculty_name }
        });
        toast.success("Conflict Resolved: Faculty Overridden.");
    }
    setIsConflictOpen(false);
    setConflict(null);
  };

  const loadTimetable = async (target) => {
    // Intelligent Fallback: If metadata is missing (for old entries), parse from Group ID
    let finalSelection = { ...target };
    if (!target.dept && target.group_id) {
       const parts = target.group_id.split('-');
       // Reverse mapping or partial filling
       finalSelection = {
          ...target,
          dept: target.dept || parts[0], // Simplified fallback
          program: target.program || parts[1],
          semester: target.semester || parts[2]?.replace('SEM', ''),
          section: target.section || parts[3],
          academic_year: target.academic_year || '2024-25'
       };
    }
    
    setSelection(finalSelection); 
    const gid = target.group_id;
    setOriginalGroupId(gid);
    setLoading(true);
    try {
      const structure = await timetableService.getStructure(gid);
      if (structure) {
        setGridConfig(structure);
        const data = await timetableService.getByGroupId(gid);
        const mapped = {};
        data.forEach(item => {
          mapped[`${item.day}-${item.period_id}`] = item;
        });
        setTimetable(mapped);
        setView('grid');
      }
    } catch (error) {
      toast.error("Failed to load schema.");
    } finally {
      setLoading(false);
    }
  };

  const saveTimetable = async () => {
    setLoading(true);
    try {
      const deptCode = DEPT_MAP[selection.dept]?.code || (selection.dept === 'Master of Computer Applications' ? 'MCA' : 'MCA');
      const gid = selection.group_id || `${deptCode}-${selection.program}-SEM${selection.semester}-${selection.section}`;
      const entries = Object.keys(timetable).map(key => {
        const [day, period_id] = key.split('-');
        return {
          ...timetable[key],
          day,
          period_id,
          // Enrich with class metadata for faculty view
          dept: selection.dept,
          program: selection.program,
          semester: selection.semester,
          section: selection.section,
          academic_year: selection.academic_year
        };
      });

      await timetableService.saveTimetable(gid, entries, gridConfig, selection);
      setOriginalGroupId(gid);
      toast.success("Timetable Synchronized Successfully.");
      setView('list');
      fetchSystemData();
    } catch (error) {
      toast.error("Batch Synchronization Failed.");
    } finally {
      setLoading(false);
    }
  };

  const deleteTimetable = async () => {
    setIsPurgeDialogOpen(false);
    setLoading(true);
    try {
      await timetableService.deleteTimetable(selection.group_id);
      toast.success("Structure Purged.");
      setView('list');
      fetchSystemData();
    } catch (error) {
      toast.error("Purge Protocol Failed.");
    } finally {
      setLoading(false);
    }
  };

  const addPeriod = () => {
    const lastP = [...gridConfig].reverse().find(i => i.type === 'class');
    const nextNum = lastP ? parseInt(lastP.id.replace('P', '')) + 1 : 1;
    setGridConfig([...gridConfig, { id: `P${nextNum}`, type: 'class', label: `P${nextNum}`, time: '00:00 – 00:00' }]);
  };

  const addBreak = (type = 'break') => {
    const label = type === 'lunch' ? 'LUNCH' : 'BREAK';
    const id = `B${Date.now()}`;
    setGridConfig([...gridConfig, { id, type, label, time: '00:00 – 00:00' }]);
  };

  const removeSlot = (id) => {
    setGridConfig(gridConfig.filter(i => i.id !== id));
  };

  const updateSlot = (id, field, value) => {
    setGridConfig(gridConfig.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full bg-[#F8FAFC] flex flex-col overflow-hidden animate-fade-in font-sans">
      
      {/* 1. LIST VIEW */}
      {view === 'list' && (
        <div className="flex-1 p-4 lg:p-8 space-y-6 lg:space-y-8 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter uppercase">Protocol <span className="text-blue-600">Architect</span></h1>
              <p className="text-[9px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] lg:tracking-[0.3em]">Institutional Schedule Management</p>
            </div>
            <button 
              onClick={() => {
                setSelection({ 
                  dept: '', section: '', academic_year: '2024-2026', 
                  program: '', semester: '', group_id: '', 
                  default_room: '', advisor: '' 
                });
                setGridConfig(DEFAULT_STRUCTURE);
                setTimetable({});
                setOriginalGroupId(null);
                setIsConfigOpen(true);
              }}
              className="w-full md:w-auto px-6 lg:px-8 py-3.5 lg:py-4 bg-[#0f172a] text-white rounded-xl lg:rounded-2xl font-bold text-[10px] lg:text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
            >
              <FaPlus /> Initialize New Protocol
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {existingTimetables.map((item, idx) => {
                const parts = item.group_id?.split('-') || [];
                const parsedSem = parts.find(p => p.startsWith('SEM'))?.replace('SEM','') || '?';
                const parsedSec = parts[parts.length - 1] || '?';

                return (
                <Card 
                  key={idx}
                  onClick={() => loadTimetable(item)}
                  className="group p-6 bg-white border border-slate-200 rounded-2xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
                  
                  {/* Card Header: Dept & Program */}
                  <div className="flex items-center gap-4 mb-6">
                     <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <FaThLarge size={20} />
                     </div>
                     <div className="overflow-hidden flex-1">
                        <h4 className="text-[13px] font-black text-slate-900 leading-none mb-1 uppercase tracking-tight truncate">
                           {item.program || parts[1] || 'GENERAL'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                           {item.dept || parts[0] || 'DEPARTMENT'}
                        </p>
                     </div>
                  </div>

                  <div className="space-y-4">
                    {/* Advisor & Room Stats */}
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Advisor</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate w-full">{item.advisor || 'TBD'}</p>
                       </div>
                       <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Room</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate w-full">{item.default_room || 'TBD'}</p>
                       </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50/30 rounded-xl border border-blue-50">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-blue-700">SEM {item.semester || parsedSem} / SEC {item.section || parsedSec}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.academic_year || '2024-25'}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all">
                         <span className="text-[9px] font-black uppercase tracking-widest">Edit</span>
                         <FaArrowLeft className="rotate-180" size={10} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. GRID VIEW (THE REDESIGNED EDITOR) */}
      {view === 'grid' && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Editor Header */}
          <header className="min-h-20 bg-white border-b border-slate-200/60 px-4 lg:px-8 py-4 lg:py-0 flex flex-col lg:flex-row items-center justify-between shadow-sm relative z-50 gap-4">
            <div className="flex items-center justify-between w-full lg:w-auto lg:gap-8">
               <button onClick={() => setView('list')} className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-900 transition-all border border-slate-100 flex items-center justify-center shrink-0">
                  <FaArrowLeft size={14} />
               </button>
               <div className="text-center lg:text-left px-4 flex-1">
                  <h3 className="text-sm lg:text-lg font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">
                     {selection.group_id ? 'Editing Protocol' : 'Build Protocol'}
                  </h3>
                  <p className="text-[8px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none truncate max-w-[200px] lg:max-w-none">
                     {selection.program} / SEM {selection.semester} / SEC {selection.section}
                  </p>
               </div>
               {/* Mobile Action Hub Trigger (Optional icon instead of full buttons) */}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-4 w-full lg:w-auto">
               <button 
                 onClick={() => setIsConfigOpen(true)}
                 className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 lg:px-5 py-2 lg:py-2.5 bg-blue-50 text-blue-600 rounded-lg font-bold text-[9px] lg:text-[11px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap"
               >
                 <FaCog size={12} /> Mapping
               </button>
               {selection.group_id && (
                 <button 
                   onClick={() => setIsPurgeDialogOpen(true)}
                   className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 lg:px-5 py-2 lg:py-2.5 bg-red-50 text-red-500 rounded-lg font-bold text-[9px] lg:text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all whitespace-nowrap"
                 >
                   <FaTrash size={12} /> Purge
                 </button>
               )}
               <button 
                 onClick={() => setIsStructurePanelOpen(!isStructurePanelOpen)}
                 className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 lg:px-5 py-2 lg:py-2.5 rounded-lg font-bold text-[9px] lg:text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${isStructurePanelOpen ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
               >
                 <FaCog size={12} className={isStructurePanelOpen ? 'animate-spin-slow' : ''} /> <span className="hidden sm:inline">Configure Grid</span><span className="sm:hidden">Grid</span>
               </button>
               <button 
                 onClick={saveTimetable}
                 className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 lg:px-8 py-2.5 lg:py-3 bg-blue-600 text-white rounded-lg font-bold text-[9px] lg:text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
               >
                 <FaSave size={12} /> Commit Protocol
               </button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden relative">
            {/* Left Structure Panel (Responsive Drawer) */}
            <div className={`fixed lg:relative top-0 left-0 lg:top-auto lg:left-auto h-full lg:h-auto z-[100] lg:z-auto transition-all duration-500 bg-white border-r border-slate-200 overflow-hidden flex flex-col shadow-2xl lg:shadow-none ${isStructurePanelOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0'}`}>
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between lg:block">
                 <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <FaCog className="text-blue-600" /> Structure Manager
                 </h4>
                 <button onClick={() => setIsStructurePanelOpen(false)} className="lg:hidden text-slate-400"><FaTimes /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                 {gridConfig.map((slot, idx) => (
                    <div key={slot.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group relative">
                       <div className="flex items-center justify-between mb-3">
                          <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase ${slot.type === 'class' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                             {slot.type === 'class' ? `Period ${slot.label}` : slot.label}
                          </span>
                          <button onClick={() => removeSlot(slot.id)} className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                             <FaTrash size={12} />
                          </button>
                       </div>
                       <div className="space-y-2">
                          <input 
                            type="text" 
                            value={slot.time}
                            onChange={(e) => updateSlot(slot.id, 'time', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 focus:border-blue-500 outline-none shadow-sm"
                            placeholder="09:00 – 10:00"
                          />
                          {slot.type !== 'class' && (
                             <select 
                               value={slot.type}
                               onChange={(e) => updateSlot(slot.id, 'type', e.target.value)}
                               className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-500 focus:border-blue-500 outline-none shadow-sm"
                             >
                                <option value="break">Short Break</option>
                                <option value="lunch">Lunch Break</option>
                                <option value="custom">Custom Slot</option>
                             </select>
                          )}
                       </div>
                    </div>
                 ))}
                 <div className="pt-4 grid grid-cols-2 gap-3">
                    <button onClick={addPeriod} className="flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-[10px] font-bold uppercase hover:bg-blue-600 hover:text-white transition-all">
                       <FaPlusCircle /> Add Period
                    </button>
                    <button onClick={() => addBreak()} className="flex items-center justify-center gap-2 p-3 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-[10px] font-bold uppercase hover:bg-amber-600 hover:text-white transition-all">
                       <FaCoffee /> Add Break
                    </button>
                 </div>
              </div>
            </div>

            {/* Main Timetable Grid */}
            <div className="flex-1 bg-slate-50 overflow-auto p-4 custom-scrollbar">
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-x-auto min-w-0">
                 <div id="timetable-grid-capture" className="min-w-max">
                  <table className="w-full border-collapse">
                    <thead>
                       <tr className="bg-slate-50/80 border-b border-slate-100">
                          <th className="p-6 text-left w-24 bg-white border-r border-slate-100">
                             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Protocol</span>
                          </th>
                          {gridConfig.map((col) => (
                             <th key={col.id} className={`p-6 text-center border-r border-slate-100 transition-all ${col.type !== 'class' ? 'bg-slate-50/50 w-20' : 'min-w-[180px]'}`}>
                                <div className="space-y-1">
                                   <p className={`text-[11px] font-black uppercase tracking-widest ${col.type === 'class' ? 'text-slate-900' : 'text-slate-400'}`}>
                                      {col.label}
                                   </p>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap">{col.time}</p>
                                </div>
                             </th>
                          ))}
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {DAYS.map((day) => (
                          <tr key={day} className="group">
                             <td className="p-6 bg-white border-r border-slate-100 font-black text-slate-900 text-[12px] uppercase tracking-tighter">
                                {day.substring(0, 3)}
                             </td>
                             {gridConfig.map((col) => {
                                const cellKey = `${day}-${col.id}`;
                                const cell = timetable[cellKey] || {};
                                
                                if (col.type !== 'class') {
                                   return (
                                      <td key={col.id} className="bg-slate-50/30 border-r border-slate-100 relative group/break">
                                         <div className="flex flex-col items-center justify-center gap-1.5 opacity-20 group-hover/break:opacity-100 transition-all duration-500">
                                            {col.type === 'lunch' ? <FaUtensils size={14} /> : <FaCoffee size={14} />}
                                            <span className="text-[8px] font-black uppercase tracking-widest rotate-180" style={{ writingMode: 'vertical-rl' }}>{col.label}</span>
                                         </div>
                                      </td>
                                   );
                                }

                                return (
                                   <td key={col.id} className="p-3 border-r border-slate-100 relative bg-white hover:bg-blue-50/30 transition-all">
                                      <div className="space-y-2">
                                         {/* Subject Field */}
                                         <div className="relative">
                                            <input 
                                              list="subjects-list"
                                              value={cell.subject_name || ''}
                                              onChange={(e) => setTimetable({ ...timetable, [cellKey]: { ...cell, subject_name: e.target.value }})}
                                              placeholder="SUBJECT"
                                              className="w-full bg-slate-50 border-none rounded-lg px-3 py-2.5 text-[11px] font-black text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase tracking-tight"
                                            />
                                         </div>
                                         
                                         {/* Faculty Dropdown */}
                                         <div className="relative">
                                            <select 
                                              value={cell.faculty_id || ''}
                                              onChange={(e) => handleFacultyChange(cellKey, day, col.id, e.target.value)}
                                              className="w-full bg-white border border-slate-100 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-500 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                            >
                                               <option value="">FACULTY</option>
                                               {facultyList.map(f => (
                                                  <option key={f.id} value={f.id}>{f.name}</option>
                                               ))}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                               <FaList size={8} />
                                            </div>
                                         </div>

                                         {/* Room / Meta */}
                                         <div className="flex items-center gap-2">
                                            <input 
                                              type="text"
                                              value={cell.classroom || ''}
                                              onChange={(e) => setTimetable({ ...timetable, [cellKey]: { ...cell, classroom: e.target.value }})}
                                              placeholder="ROOM"
                                              className="flex-1 bg-slate-50/50 border border-transparent rounded-lg px-3 py-1.5 text-[9px] font-black text-slate-400 placeholder:text-slate-300 focus:border-blue-100 outline-none transition-all"
                                            />
                                            <button 
                                              onClick={() => {
                                                const newT = {...timetable};
                                                delete newT[cellKey];
                                                setTimetable(newT);
                                              }}
                                              className="text-slate-200 hover:text-rose-500 transition-colors"
                                            >
                                               <FaTrash size={10} />
                                            </button>
                                         </div>
                                      </div>
                                   </td>
                                );
                             })}
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Modal and Lists Section */}
      <>
        {/* Initialize Modal */}
        <Dialog open={isConfigOpen} onClose={() => setIsConfigOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '2rem', overflow: 'hidden' } }}>
           <div className="p-8">
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-2">Configure Protocol</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-8">SMVEC Institutional Mapping</p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                 {/* Department Dropdown */}
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                    <select 
                      value={selection.dept} 
                      onChange={(e) => setSelection({...selection, dept: e.target.value, program: ''})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    >
                       <option value="">Select Dept</option>
                       {Object.keys(DEPT_MAP).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                 </div>
  
                 {/* Course/Program Dropdown */}
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Course / Program</label>
                    <select 
                      value={selection.program}
                      onChange={(e) => setSelection({...selection, program: e.target.value})}
                      disabled={!selection.dept}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer disabled:opacity-50"
                    >
                       <option value="">Select Program</option>
                       {(DEPT_MAP[selection.dept]?.programs || []).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                 </div>
  
                 {/* Academic Year Dropdown + Custom Year Logic */}
                 <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Year</label>
                    <div className="flex gap-2">
                      <select 
                        value={(selection.academic_year && selection.academic_year.includes('-')) ? selection.academic_year : 'custom'}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setSelection({...selection, academic_year: ''});
                          } else {
                            setSelection({...selection, academic_year: e.target.value});
                          }
                        }}
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                      >
                         <option value="2024-2026">2024-2026</option>
                         <option value="2025-2027">2025-2027</option>
                         <option value="2026-2028">2026-2028</option>
                         <option value="custom">Add Custom Year</option>
                      </select>
                      {(!['2024-2026', '2025-2027', '2026-2028'].includes(selection.academic_year) || !selection.academic_year) && (
                        <input 
                          type="text"
                          placeholder="YYYY-YYYY"
                          value={selection.academic_year}
                          onChange={(e) => setSelection({...selection, academic_year: e.target.value})}
                          className="w-1/3 bg-white border border-blue-200 rounded-xl px-4 py-3 text-sm font-bold text-blue-600 outline-none"
                        />
                      )}
                    </div>
                 </div>
  
                 {/* Semester Dropdown */}
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
                    <select 
                      value={selection.semester}
                      onChange={(e) => setSelection({...selection, semester: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    >
                       <option value="">Select Sem</option>
                       {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                 </div>
  
                 {/* Section Dropdown (A-G) */}
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Section</label>
                    <select 
                      value={selection.section}
                      onChange={(e) => setSelection({...selection, section: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    >
                       <option value="">Select Sec</option>
                       {['A','B','C','D','E','F','G'].map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                 </div>
  
                 {/* Default Room Number */}
                 <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Room Number</label>
                    <input 
                      type="text"
                      placeholder="e.g. 401, 302, LAB-1"
                      value={selection.default_room || ''}
                      onChange={(e) => setSelection({...selection, default_room: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                    />
                 </div>
  
                 {/* Class Advisor (Faculty Dropdown) */}
                 <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Class Advisor</label>
                    <select 
                      value={selection.advisor || ''}
                      onChange={(e) => setSelection({...selection, advisor: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    >
                       <option value="">Select Class Advisor</option>
                       {facultyList.map(f => (
                          <option key={f.id} value={f.name}>{f.name} ({f.dept})</option>
                       ))}
                    </select>
                 </div>
              </div>
  
              <button 
                onClick={async () => {
                  if(!selection.dept || !selection.program || !selection.semester || !selection.section || !selection.academic_year) {
                    return toast.warn("Protocol Error: All parameters are mandatory.");
                  }

                  // Strict database validation for Academic Year Duration
                  try {
                     const durations = await studentService.getProgramDurations();
                     const requiredDuration = durations[selection.program] || 2;
                     const parts = selection.academic_year.trim().split('-');
                     if (parts.length !== 2) {
                        return toast.error("Format must be YYYY-YYYY (e.g. 2024-2026).");
                     }
                     const start = Number(parts[0]);
                     const end = parts[1].length === 2 ? 2000 + Number(parts[1]) : Number(parts[1]);
                     if (end - start !== requiredDuration) {
                        return toast.error(`Database Validation Failed: Academic year for ${selection.program} must be exactly ${requiredDuration} years.`);
                     }
                  } catch (err) {
                     console.error("Config check failed", err);
                  }
  
                  // Check for Advisor Conflict
                  if (selection.advisor) {
                     const gid = selection.group_id || `${DEPT_MAP[selection.dept]?.code || 'DEPT'}-${selection.program}-SEM${selection.semester}-${selection.section}`;
                     const existingClass = await timetableService.checkAdvisorConflict(selection.advisor, gid);
                     if (existingClass) {
                        toast.error(`Advisor Conflict: "${selection.advisor}" is already the Class Advisor for "${existingClass}".`);
                        return;
                     }
                  }
  
                   const deptCode = DEPT_MAP[selection.dept]?.code || 'DEPT';
                   const gid = `${deptCode}-${selection.program}-SEM${selection.semester}-${selection.section}`;
                   
                   if (view === 'grid') {
                      setSelection({...selection, group_id: gid});
                      setIsConfigOpen(false);
                      return toast.success("Mapping Updated.");
                   }
  
                   setSelection({...selection, group_id: gid});
                   
                   const initialTable = {};
                   if (selection.default_room) {
                      DAYS.forEach(day => {
                         gridConfig.forEach(col => {
                            if (col.type === 'class') {
                               initialTable[`${day}-${col.id}`] = { classroom: selection.default_room };
                            }
                         });
                      });
                   }
                   setTimetable(initialTable);
                   setView('grid');
                   setIsConfigOpen(false);
                }}
                className="w-full py-4 bg-blue-600 text-white rounded-lg font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                 {view === 'grid' ? 'Update Institutional Mapping' : 'Build SMVEC Protocol'}
              </button>
           </div>
        </Dialog>
  
        <datalist id="subjects-list">
           {subjectList.map(s => <option key={s.id} value={s.name} />)}
        </datalist>
      </>

      {/* Conflict Dialog */}
      <Dialog 
        open={isConflictOpen} 
        onClose={() => resolveConflict(false)}
        PaperProps={{ sx: { borderRadius: '1.5rem', maxWidth: '400px' } }}
      >
         <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-6">
               <FaClock size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Faculty Conflict</h3>
            <p className="text-sm text-slate-500 font-bold leading-relaxed mb-8">
               <span className="text-blue-600">{conflict?.faculty_name}</span> is already assigned to <span className="text-slate-900">{conflict?.group_id}</span> on {conflict?.day} during {conflict?.period_id}.
            </p>
            
            <div className="flex flex-col gap-3">
               <button 
                 onClick={() => resolveConflict(true)}
                 className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
               >
                  Override & Reassign
               </button>
               <button 
                 onClick={() => resolveConflict(false)}
                 className="w-full py-4 bg-slate-100 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
               >
                  Keep Original
               </button>
            </div>
         </div>
      </Dialog>
      {/* Purge Confirmation Dialog */}
      <Dialog 
        open={isPurgeDialogOpen} 
        onClose={() => setIsPurgeDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '1.5rem', maxWidth: '400px', border: '1px solid #fee2e2' } }}
      >
         <div className="p-10 text-center">
            <div className="w-20 h-20 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-8 animate-pulse shadow-inner">
               <FaTrash size={36} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Purge Protocol?</h3>
            <p className="text-[13px] text-slate-500 font-bold leading-relaxed mb-10 uppercase tracking-wide">
               This action is <span className="text-red-600 font-black">irreversible</span>. All spatial assignments and structural mapping for this group will be permanently purged.
            </p>
            
            <div className="flex flex-col gap-4">
               <button 
                 onClick={deleteTimetable}
                 className="w-full py-5 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-500/30 hover:scale-[1.02] active:scale-95 transition-all"
               >
                  Execute Purge
               </button>
               <button 
                 onClick={() => setIsPurgeDialogOpen(false)}
                 className="w-full py-5 bg-slate-100 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
               >
                  Abort Protocol
               </button>
            </div>
         </div>
      </Dialog>

    </div>
  );
};

export default TableCreation;
