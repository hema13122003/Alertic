import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { studentService } from '../services/firebaseService';
import { db, auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import ClockLoader from '../components/ClockLoader';
import { toast } from 'react-toastify';
import { 
  Card, TextField, Select, MenuItem, FormControl, InputLabel, 
  Button, Dialog, DialogTitle, DialogContent, DialogActions 
} from '@mui/material';
import { 
  FaUserPlus, FaTrash, FaSearch, 
  FaCheckCircle, FaUsers, FaArrowLeft, FaCalendarAlt, FaIdBadge, FaTimes,
  FaDownload, FaFileImport, FaSpinner
} from 'react-icons/fa';

const DEPT_MAP = {
  'Master of Computer Applications': { code: 'MCA', programs: ['MCA'] },
};

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const FacultyAddStudent = () => {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'add'
  const [importing, setImporting] = useState(false);
  const importRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '', enroll_no: '', email: '', dept: '', program: '',
    semester: '', section: '', academic_year: '2024-2026', phone: ''
  });
  const [programDurations, setProgramDurations] = useState({});

  useEffect(() => {
    fetchStudents();
    const fetchConfigs = async () => {
      const durations = await studentService.getProgramDurations();
      setProgramDurations(durations);
    };
    fetchConfigs();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await studentService.getAll();
      setStudents(data);
    } catch (error) {
      toast.error("Registry Sync Failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'dept') {
      setFormData({ ...formData, [name]: value, program: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [['name','enroll_no','reg_no','email','password','dept','program','semester','section','academic_year']];
    const example = [['Arun Kumar','21MCA001','RA2021','arun@college.edu','12345678','Master of Computer Applications','MCA','1','A','2024-2026']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    ws['!cols'] = headers[0].map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'alertic_students_template.xlsx');
    toast.success('Template downloaded!');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!importRef.current) return;
    importRef.current.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      if (rows.length === 0) return toast.warn('Excel file is empty.');

      let success = 0, failed = 0;
      for (const row of rows) {
        try {
          const deptCode = DEPT_MAP[row.dept]?.code || 'MCA';
          const group_id = `${deptCode}-${row.program}-SEM${row.semester}-${row.section}`;
          const password = String(row.password || '12345678');
          const cred = await createUserWithEmailAndPassword(auth, row.email, password);
          await setDoc(doc(db, 'students', cred.user.uid), {
            name: row.name, enroll_no: String(row.enroll_no), reg_no: String(row.reg_no || ''),
            email: row.email, dept: row.dept, program: row.program,
            semester: String(row.semester), section: row.section,
            academic_year: String(row.academic_year), group_id,
            uid: cred.user.uid, role: 'student', status: 'Active',
            globalAlertEnabled: false, createdAt: serverTimestamp()
          });
          success++;
        } catch {
          failed++;
        }
      }
      toast.success(`Imported: ${success} students${failed ? `, ${failed} failed` : ''}`);
      fetchStudents();
    } catch {
      toast.error('Failed to read Excel file.');
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const requiredDuration = (formData.program && programDurations[formData.program]) ? programDurations[formData.program] : 4;

    // Academic Year Validation
    const ayRegex = /^20\d{2}-(20\d{2}|\d{2})$/;
    if (!ayRegex.test(formData.academic_year.trim())) {
      return toast.warn('Format must be YYYY-YY or YYYY-YYYY');
    }
    if (formData.program && programDurations[formData.program]) {
      const parts = formData.academic_year.trim().split('-');
      const start = Number(parts[0]);
      const end = parts[1].length === 2 ? 2000 + Number(parts[1]) : Number(parts[1]);
      if (end - start !== requiredDuration) {
        return toast.error(`Academic year must be ${requiredDuration} years`);
      }
    }

    setLoading(true);
    try {
      const deptCode = DEPT_MAP[formData.dept]?.code || 'DEPT';
      const group_id = `${deptCode}-${formData.program}-SEM${formData.semester}-${formData.section}`;
      const password = formData.password || '12345678';
      const cred = await createUserWithEmailAndPassword(auth, formData.email, password);
      const uid = cred.user.uid;
      await setDoc(doc(db, 'students', uid), {
        ...formData,
        group_id,
        uid,
        role: 'student',
        status: 'Active',
        globalAlertEnabled: false,
        createdAt: serverTimestamp()
      });
      toast.success(`Personnel Logged: ${formData.name}`);
      setFormData({ name: '', enroll_no: '', email: '', dept: '', program: '', semester: '', section: '', academic_year: '2024-2026', phone: '' });
      setView('list');
      fetchStudents();
    } catch (error) {
      toast.error(error.code === 'auth/email-already-in-use' ? 'Email already registered.' : (error.message || 'Registry Update Failed.'));
    } finally {
      setLoading(false);
    }
  };

  const requiredDuration = (formData.program && programDurations[formData.program]) ? programDurations[formData.program] : 4;

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.enroll_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.dept?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full bg-[#F8FAFC] flex flex-col overflow-hidden animate-fade-in font-sans">
      
      {/* Header */}
      <header className="min-h-20 bg-white border-b border-slate-200/60 px-4 lg:px-8 py-4 lg:py-0 flex flex-col lg:flex-row items-center justify-between shadow-sm relative z-50 gap-4">
        <div className="flex items-center gap-4 lg:gap-6 w-full lg:w-auto">
           <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shrink-0">
              <FaUsers size={20} />
           </div>
           <div>
              <h3 className="text-lg lg:text-xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">Student Registry</h3>
              <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Institutional Management</p>
           </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-4 w-full lg:w-auto">
           {view === 'list' ? (
             <>
               <div className="relative w-full sm:w-64 lg:w-72">
                  <input 
                    type="text"
                    placeholder="Search personnel..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-10 py-2.5 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-all shadow-inner"
                  />
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
               </div>
               <button onClick={handleDownloadTemplate} className="w-full sm:w-auto px-4 py-3 lg:py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-[10px] lg:text-[11px] uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2">
                  <FaDownload size={11} /> Template
               </button>
               <label className={`w-full sm:w-auto px-4 py-3 lg:py-2.5 rounded-xl font-bold text-[10px] lg:text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${
                 importing ? 'bg-slate-100 text-slate-400 pointer-events-none' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
               }`}>
                  {importing ? <FaSpinner className="animate-spin" size={11} /> : <FaFileImport size={11} />}
                  {importing ? 'Importing...' : 'Import Excel'}
                  <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
               </label>
               <button onClick={() => setView('add')} className="w-full sm:w-auto px-6 py-3 lg:py-2.5 bg-blue-600 text-white rounded-xl font-bold text-[10px] lg:text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                  <FaUserPlus /> Enroll Personnel
               </button>
             </>
           ) : (
             <button onClick={() => setView('list')} className="w-full sm:w-auto px-6 py-3 lg:py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px] lg:text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                <FaArrowLeft /> View Registry
             </button>
           )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar pb-12">
        {view === 'list' ? (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
               {filteredStudents.length > 0 ? filteredStudents.map((s, idx) => (
                 <Card key={idx} className="p-5 lg:p-6 rounded-2xl border border-slate-200/60 bg-white hover:shadow-xl transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full -mr-12 -mt-12"></div>
                    <div className="flex items-start gap-4 lg:gap-5 relative z-10">
                       <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                          <FaIdBadge size={20} className="lg:hidden" />
                          <FaIdBadge size={24} className="hidden lg:block" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <h4 className="text-sm lg:text-lg font-black text-slate-900 leading-none mb-1 uppercase truncate">{s.name}</h4>
                          <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{s.enroll_no}</p>
                          <div className="flex flex-wrap gap-2">
                             <span className="text-[8px] lg:text-[9px] font-black bg-blue-50 text-blue-600 px-2 lg:px-2.5 py-0.5 lg:py-1 rounded-md lg:rounded-lg border border-blue-100 uppercase tracking-wider">{s.dept}</span>
                             <span className="text-[8px] lg:text-[9px] font-black bg-slate-50 text-slate-500 px-2 lg:px-2.5 py-0.5 lg:py-1 rounded-md lg:rounded-lg border border-slate-100 uppercase tracking-wider">Sec {s.section}</span>
                          </div>
                       </div>
                    </div>
                 </Card>
               )) : (
                 <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300">
                    <FaUsers size={48} className="opacity-10 mb-4" />
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-30">Registry Empty</p>
                 </div>
               )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <Card className="p-6 lg:p-10 rounded-[2rem] border border-slate-200 bg-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full"></div>
               
               <form onSubmit={handleSubmit} className="relative z-10 space-y-6 lg:space-y-8">
                  <div className="space-y-1 text-center lg:text-left">
                    <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter uppercase">Registry Entry</h2>
                    <p className="text-[9px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-[0.25em]">Individual Enrollment Protocol</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                     <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Personnel Name</label>
                        <input name="name" required value={formData.name} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner" placeholder="E.G. ARUN KUMAR" />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enrollment ID</label>
                        <input name="enroll_no" required value={formData.enroll_no} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner" placeholder="E.G. 21TD0401" />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Email</label>
                        <input name="email" type="email" required value={formData.email} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner" placeholder="ARUN@SMVEC.AC.IN" />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                        <select name="dept" required value={formData.dept} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer">
                           <option value="">Select Dept</option>
                           {Object.keys(DEPT_MAP).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Course / Program</label>
                        <select name="program" required value={formData.program} onChange={handleInputChange} disabled={!formData.dept} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer disabled:opacity-50">
                           <option value="">Select Program</option>
                           {(DEPT_MAP[formData.dept]?.programs || []).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
                        <select name="semester" required value={formData.semester} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer">
                           <option value="">Select Sem</option>
                           {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Section</label>
                        <select name="section" required value={formData.section} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer">
                           <option value="">Select Sec</option>
                           {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Cycle</label>
                        <input name="academic_year" required value={formData.academic_year} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner" placeholder="E.G. 2024-26 OR 2024-2026" />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Node</label>
                        <input name="phone" value={formData.phone} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner" placeholder="+91 XXXXX XXXXX" />
                     </div>
                  </div>

                  <div className="pt-4">
                     <button type="submit" className="w-full py-4 lg:py-5 bg-blue-600 text-white rounded-xl lg:rounded-[1.5rem] font-black text-[10px] lg:text-xs uppercase tracking-[0.2em] lg:tracking-[0.3em] shadow-2xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all">Commit Entry</button>
                  </div>
               </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyAddStudent;
