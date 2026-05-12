import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { FaTimes, FaUser, FaIdCard, FaBuilding, FaBriefcase, FaLock, FaEnvelope, FaPhone, FaCheckCircle, FaChevronDown } from 'react-icons/fa';
import { Card, CardContent, FormControl, Select, MenuItem, IconButton } from '@mui/material';

const AddFacultyModal = ({ isOpen, onClose, onConfirm, initialData }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    emp_id: initialData?.emp_id || '',
    dept: initialData?.dept || '',
    role: initialData?.role || '',
    password: initialData ? '' : '12345678',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    status: initialData?.status || 'Active'
  });

  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialData?.name || '',
        emp_id: initialData?.emp_id || '',
        dept: initialData?.dept || '',
        role: initialData?.role || '',
        password: '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        status: initialData?.status || 'Active'
      });
      setErrors({});
    }
  }, [isOpen, initialData]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full Name is required';
    if (!formData.emp_id.trim()) newErrors.emp_id = 'Employee ID is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    const phoneRegex = /^[6789]\d{9}$/;
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number';
    }
    if (!initialData) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Min 8 characters';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: null });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) onConfirm(formData);
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      
      <Card
        sx={{
          width: '100%',
          maxWidth: '54rem',
          borderRadius: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
          position: 'relative',
          zIndex: 10,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          animation: 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          border: 'none'
        }}
      >
        {/* Left Aspect: Branding */}
        <div className="hidden md:flex w-[32%] bg-[#1E293B] relative overflow-hidden flex-col justify-between p-10 text-white">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 blur-3xl rounded-full" />
          <div className="relative z-10">
            <div className="w-10 h-1 bg-blue-500 mb-8 rounded-full" />
            <h3 className="text-2xl font-bold leading-tight tracking-tight">
               {initialData ? 'Update Profile Parameters.' : 'Staff Ecosystem Registration.'}
            </h3>
            <p className="text-slate-400 mt-4 text-[12px] font-medium leading-relaxed opacity-80">
               {initialData ? 'Secure modification of existing faculty data within the academic grid.' : 'Initial synchronization of faculty assets into the central management environment.'}
            </p>
          </div>
          
          <div className="relative z-10 flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400">
                <FaCheckCircle size={14} />
             </div>
             <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Identity Verified</span>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 opacity-60">System Security: 10.4.0</p>
             </div>
          </div>
        </div>

        <div className="flex-1 bg-white flex flex-col">
          <div className="p-8 pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-[20px] font-bold text-[#1E293B] tracking-tight">{initialData ? 'Edit Faculty Member' : 'Initiate Staff Onboarding'}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1 opacity-70">Administrative Control Node</p>
            </div>
            <IconButton onClick={onClose} size="small" sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}>
               <FaTimes size={14} />
            </IconButton>
          </div>

          <CardContent sx={{ p: 4 }}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 ml-1">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                    <FaIdCard size={12} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Professional Identity</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative group">
                    <FaUser size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors z-10" />
                    <input
                      name="name" value={formData.name} onChange={handleChange} placeholder="Full Legal Name"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 py-3 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                    {errors.name && <p className="text-[9px] text-red-500 font-bold mt-1 ml-4 uppercase">{errors.name}</p>}
                  </div>

                  <div className="relative group">
                    <FaIdCard size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors z-10" />
                    <input
                      name="emp_id" value={formData.emp_id} onChange={handleChange} placeholder="Employee ID"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 py-3 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                    {errors.emp_id && <p className="text-[9px] text-red-500 font-bold mt-1 ml-4 uppercase">{errors.emp_id}</p>}
                  </div>

                  <div className="relative group">
                    <FaBuilding size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors z-10" />
                    <input
                      name="dept" value={formData.dept} onChange={handleChange} placeholder="Department"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 py-3 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                  </div>

                  <div className="relative group">
                    <FaBriefcase size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors z-10" />
                    <input
                      name="role" value={formData.role} onChange={handleChange} placeholder="Designation"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 py-3 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3 ml-1">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                    <FaLock size={12} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Access & Communication</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative group">
                    <FaEnvelope size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors z-10" />
                    <input
                      name="email" value={formData.email} onChange={handleChange} placeholder="Corporate Email"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 py-3 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                    {errors.email && <p className="text-[9px] text-red-500 font-bold mt-1 ml-4 uppercase">{errors.email}</p>}
                  </div>

                  <div className="relative group">
                    <FaPhone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors z-10" />
                    <input
                      name="phone" value={formData.phone} onChange={handleChange} placeholder="Mobile Access"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 py-3 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                    {errors.phone && <p className="text-[9px] text-red-500 font-bold mt-1 ml-4 uppercase">{errors.phone}</p>}
                  </div>

                  {!initialData && (
                    <div className="relative group">
                      <FaLock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors z-10" />
                      <input
                        type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Access Password"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-11 pr-4 py-3 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-blue-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  )}

                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 z-10 pointer-events-none">
                      <FaCheckCircle size={14} />
                    </div>
                    <FormControl fullWidth>
                      <Select
                        name="status" value={formData.status} onChange={handleChange}
                        displayEmpty
                        IconComponent={() => <FaChevronDown size={8} className="absolute right-4 text-slate-300" />}
                        sx={{
                          borderRadius: '12px',
                          backgroundColor: '#f8fafc',
                          paddingLeft: '2.5rem',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: '#334155',
                          border: '2px solid #f1f5f9',
                          height: '48px',
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                          '&:hover': { backgroundColor: 'white', borderColor: '#3b82f6' },
                          '&.Mui-focused': { borderColor: '#3b82f6', backgroundColor: 'white' }
                        }}
                      >
                        <MenuItem value="Active" sx={{ fontWeight: 'bold', fontSize: '12px' }}>Operational Status</MenuItem>
                        <MenuItem value="Inactive" sx={{ fontWeight: 'bold', fontSize: '12px' }}>Deactivated Mode</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button" onClick={onClose}
                  className="flex-1 py-3 text-slate-400 font-bold hover:text-red-500 transition-all text-[11px] uppercase tracking-widest"
                >
                  Discard Profile
                </button>
                <button
                  type="submit"
                  className="flex-[1.5] py-4 bg-[#2563EB] text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-[#1D4ED8] hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-2"
                >
                  {initialData ? 'Update Faculty Node' : 'Initialize Record'} <FaCheckCircle size={12} />
                </button>
              </div>
            </form>
          </CardContent>
        </div>
      </Card>
    </div>,
    document.body
  );
};

export default AddFacultyModal;

