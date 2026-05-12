import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FaTimes, FaUser, FaIdCard, FaBuilding, FaLayerGroup, FaEnvelope, FaLock, FaCheckCircle, FaCalendarAlt } from 'react-icons/fa';
import { Card, CardContent } from '@mui/material';
import { studentService } from '../services/firebaseService';

const DEPT_MAP = {
  'Master of Computer Applications': { code: 'MCA' },
};

const PROGRAM_MAP = {
  'Master of Computer Applications': ['MCA'],
};

const SECTIONS  = ['A', 'B', 'C', 'D'];
const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const AY_OPTIONS = ['2023-2025', '2024-2026', '2025-2027', '2026-2028'];

const AddStudentModal = ({ isOpen, onClose, onConfirm, initialData }) => {
  const [formData, setFormData] = useState({
    name: '', enroll_no: '', reg_no: '',
    email: '', dept: '', section: '',
    program: '', semester: '', academic_year: '2024-2026',
    password: '12345678', status: 'Active'
  });

  const [errors, setErrors] = useState({});
  const [isEmailManuallyEdited, setIsEmailManuallyEdited] = useState(false);
  const [programDurations, setProgramDurations] = useState({});

  useEffect(() => {
    const fetchConfigs = async () => {
      const durations = await studentService.getProgramDurations();
      setProgramDurations(durations);
    };
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...initialData, password: '' });
        setIsEmailManuallyEdited(true); // Don't auto-update existing emails
      } else {
        setFormData({
            name: '', enroll_no: '', reg_no: '',
            email: '', dept: '', section: '',
            program: '', semester: '', academic_year: '2024-2026',
            password: '12345678', status: 'Active'
        });
        setIsEmailManuallyEdited(false);
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  // Derived state
  const programs = PROGRAM_MAP[formData.dept] || [];
  const requiredDuration = (formData.program && programDurations[formData.program]) ? programDurations[formData.program] : 4;

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full Name is required';
    if (!formData.enroll_no.trim()) newErrors.enroll_no = 'Enrollment No is required';
    if (!formData.reg_no.trim()) newErrors.reg_no = 'Registration No is required';
    if (!formData.dept) newErrors.dept = 'Department is required';
    if (!formData.program) newErrors.program = 'Program is required';
    if (!formData.semester) newErrors.semester = 'Semester is required';
    if (!formData.section) newErrors.section = 'Section is required';
    
    if (!formData.academic_year) {
      newErrors.academic_year = 'Academic Year is required';
    } else {
      const ayRegex = /^20\d{2}-(20\d{2}|\d{2})$/;
      if (!ayRegex.test(formData.academic_year.trim())) {
        newErrors.academic_year = 'Format must be YYYY-YY or YYYY-YYYY';
      } else if (formData.program && programDurations[formData.program]) {
        const parts = formData.academic_year.trim().split('-');
        const start = Number(parts[0]);
        const end = parts[1].length === 2 ? 2000 + Number(parts[1]) : Number(parts[1]);
        if (end - start !== requiredDuration) {
          newErrors.academic_year = `Academic year must be ${requiredDuration} years`;
        }
      }
    }

    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateEmail = (name) => {
    if (!name) return '';
    // convert to lowercase, handle extra spaces, replace with dot
    const cleanName = name.toLowerCase().trim().replace(/\s+/g, '.');
    return `${cleanName}@college.edu`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let updates = { [name]: value };

    // Auto-generate email if name changes and email hasn't been manually edited
    if (name === 'name') {
      const trimmedValue = value.replace(/\s{2,}/g, ' '); // prevent duplicate spaces
      updates.name = trimmedValue;
      if (!isEmailManuallyEdited) {
        updates.email = generateEmail(trimmedValue);
      }
    }

    // Reset program if dept changes
    if (name === 'dept') {
      updates.program = '';
    }

    // Track explicit email edits
    if (name === 'email') {
      setIsEmailManuallyEdited(true);
    }

    setFormData(prev => ({ ...prev, ...updates }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const deptCode = formData.dept === 'Master of Computer Applications' ? 'MCA' : (formData.dept?.substring(0,3).toUpperCase() || 'MCA');
      const computedGroupId = `${deptCode}-${formData.program}-SEM${formData.semester}-${formData.section}`;
      onConfirm({ 
         ...formData, 
         group_id: computedGroupId,
         name: formData.name.trim(), 
         email: formData.email.trim(), 
         enroll_no: formData.enroll_no.trim(), 
         reg_no: formData.reg_no.trim() 
      });
    }
  };

  if (!isOpen) return null;

  /* Reusable Input Styling */
  const inputStyle = "w-full h-[44px] bg-slate-50 border border-slate-200 rounded-[8px] pl-10 pr-4 text-[14px] text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all";
  const selectStyle = `${inputStyle} appearance-none`;
  const labelStyle = "text-[12px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider";
  const iconBase = "absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-3.5";
  const dropIcon = "pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[9px]";

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <Card sx={{ width: '100%', maxWidth: '60rem', borderRadius: '16px', position: 'relative', zIndex: 10, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, animation: 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        
        {/* Left Side (30%) */}
        <div className="hidden md:flex w-[30%] bg-[#0F172A] p-8 flex-col justify-between text-white relative overflow-hidden">
           <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-500/20 blur-3xl rounded-full pointer-events-none"></div>
           <div className="relative z-10">
              <div className="w-8 h-1 bg-blue-500 mb-5 rounded-full"></div>
              <h3 className="text-xl font-black leading-tight tracking-tight">{initialData ? 'Modify Student Parameters.' : 'Intelligence Roster Onboarding.'}</h3>
              <p className="text-slate-400 mt-3 text-[12px] leading-relaxed">Systematic registration of academic assets and synchronization with timetable domains.</p>
           </div>
           <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-8 relative z-10">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Secure Data Mesh</span>
              <FaCheckCircle className="text-blue-500 size-3.5" />
           </div>
        </div>

        {/* Right Side Form (70%) */}
        <div className="w-full md:w-[70%] bg-white flex flex-col max-h-[90vh]">
           <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 flex-shrink-0">
              <h2 className="text-[18px] font-black text-slate-950 tracking-tight">{initialData ? 'Update Student Record' : 'Add New Student'}</h2>
              <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><FaTimes size={14}/></button>
           </div>

           <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <form id="add-student-form" onSubmit={handleSubmit} className="space-y-5">
                
                {/* 2-Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                   
                   {/* Name */}
                   <div className="flex flex-col">
                      <label className={labelStyle}>Full Legal Name *</label>
                      <div className="relative">
                         <FaUser className={iconBase} />
                         <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputStyle} />
                      </div>
                      {errors.name && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.name}</p>}
                   </div>

                   {/* Email */}
                   <div className="flex flex-col">
                      <label className={labelStyle}>Email Access Point *</label>
                      <div className="relative">
                         <FaEnvelope className={iconBase} />
                         <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputStyle} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">Auto-generated based on name (editable)</p>
                      {errors.email && <p className="text-[10px] text-red-500 font-bold mt-0.5">{errors.email}</p>}
                   </div>

                   {/* Enrollment No */}
                   <div className="flex flex-col">
                      <label className={labelStyle}>Enrollment No *</label>
                      <div className="relative">
                         <FaIdCard className={iconBase} />
                         <input type="text" name="enroll_no" value={formData.enroll_no} onChange={handleChange} className={inputStyle} />
                      </div>
                      {errors.enroll_no && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.enroll_no}</p>}
                   </div>

                   {/* Registration No */}
                   <div className="flex flex-col">
                      <label className={labelStyle}>Registration No *</label>
                      <div className="relative">
                         <FaIdCard className={iconBase} />
                         <input type="text" name="reg_no" value={formData.reg_no} onChange={handleChange} className={inputStyle} />
                      </div>
                      {errors.reg_no && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.reg_no}</p>}
                   </div>

                   {/* Department */}
                   <div className="flex flex-col mt-2">
                      <label className={labelStyle}>Department *</label>
                      <div className="relative">
                         <FaBuilding className={iconBase} />
                         <select name="dept" value={formData.dept} onChange={handleChange} className={selectStyle}>
                           <option value="">Select Dept</option>
                           {Object.keys(DEPT_MAP).map(d => <option key={d} value={d}>{d}</option>)}
                         </select>
                         <div className={dropIcon}>▼</div>
                      </div>
                      {errors.dept && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.dept}</p>}
                   </div>

                   {/* Program */}
                   <div className="flex flex-col mt-2">
                      <label className={labelStyle}>Program *</label>
                      <div className="relative">
                         <FaBuilding className={iconBase} />
                         <select 
                           name="program" value={formData.program} onChange={handleChange} 
                           disabled={!formData.dept}
                           className={formData.dept ? selectStyle : `${selectStyle} opacity-60 cursor-not-allowed`}
                         >
                           <option value="">{formData.dept ? 'Select Program' : 'Select Dept First'}</option>
                           {programs.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                         <div className={dropIcon}>▼</div>
                      </div>
                      {errors.program && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.program}</p>}
                   </div>

                   {/* Semester */}
                   <div className="flex flex-col">
                      <label className={labelStyle}>Semester *</label>
                      <div className="relative">
                         <FaLayerGroup className={iconBase} />
                         <select name="semester" value={formData.semester} onChange={handleChange} className={selectStyle}>
                            <option value="">Select Sem</option>
                            {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                         </select>
                         <div className={dropIcon}>▼</div>
                      </div>
                      {errors.semester && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.semester}</p>}
                   </div>

                   {/* Section */}
                   <div className="flex flex-col">
                      <label className={labelStyle}>Section *</label>
                      <div className="relative">
                         <FaLayerGroup className={iconBase} />
                         <select name="section" value={formData.section} onChange={handleChange} className={selectStyle}>
                            <option value="">Select Section</option>
                            {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                         </select>
                         <div className={dropIcon}>▼</div>
                      </div>
                      {errors.section && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.section}</p>}
                   </div>

                   {/* Academic Year */}
                   <div className="flex flex-col">
                      <label className={labelStyle}>Academic Year *</label>
                      <div className="relative">
                         <FaCalendarAlt className={iconBase} />
                         <input 
                           type="text" 
                           name="academic_year" 
                           value={formData.academic_year} 
                           onChange={handleChange} 
                           placeholder="e.g., 2024-26 or 2024-2026"
                           className={inputStyle} 
                         />
                      </div>
                      {errors.academic_year && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.academic_year}</p>}
                   </div>

                   {/* Password */}
                   {!initialData && (
                      <div className="flex flex-col">
                         <label className={labelStyle}>Security Key</label>
                         <div className="relative">
                            <FaLock className={iconBase} />
                            <input type="text" name="password" value={formData.password} onChange={handleChange} className={inputStyle} />
                         </div>
                         <p className="text-[10px] text-slate-400 font-medium mt-1">Default assignment: 12345678</p>
                      </div>
                   )}
                </div>
              </form>
           </div>
           
           {/* Actions */}
           <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
               <button 
                 type="button" 
                 onClick={onClose} 
                 className="px-6 h-[48px] text-slate-500 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 hover:text-slate-700 transition-all text-[12px] uppercase tracking-wider"
               >
                 Discard Entry
               </button>
               <button 
                 type="submit" 
                 form="add-student-form"
                 className="px-8 h-[48px] bg-slate-900 text-white font-black rounded-xl hover:bg-black hover:shadow-lg active:scale-95 transition-all text-[12px] uppercase tracking-wider flex items-center gap-2"
               >
                 {initialData ? 'Update Protocol' : 'Finalize Registration'} <FaCheckCircle size={14}/>
               </button>
           </div>
           
        </div>
      </Card>
    </div>,
    document.body
  );
};

export default AddStudentModal;
