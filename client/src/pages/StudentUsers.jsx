import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { studentService } from '../services/firebaseService';
import { db, auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, updateDoc, deleteDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { 
  FaPlus, 
  FaEllipsisV, 
  FaEdit, 
  FaTrash, 
  FaFilter,
  FaChevronDown,
  FaSearch,
  FaArrowLeft,
  FaChevronRight,
  FaTimes
} from 'react-icons/fa';
import AddStudentModal from '../components/AddStudentModal';
import ClockLoader from '../components/ClockLoader';
import AlertModal from '../components/AlertModal';
import { Card, Menu, MenuItem, IconButton, Dialog } from '@mui/material';

const StudentUsers = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, studentId: null, studentName: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editModal, setEditModal] = useState({ isOpen: false, student: null });
  const [errors, setErrors] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const data = await studentService.getAll();
      setStudents(data);
    } catch (error) {
      toast.error("Registry Sync Failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleMenuClick = (event, s) => {
    setAnchorEl(event.currentTarget);
    setSelectedStudent(s);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedStudent(null);
  };

  const handleEdit = (student) => {
    setEditModal({ isOpen: true, student: { ...student } });
    handleMenuClose();
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    const s = editModal.student;
    try {
      setLoading(true);
      const docRef = doc(db, "students", s.id);
      await updateDoc(docRef, { ...s, updatedAt: serverTimestamp() });
      toast.success("Personnel Updated.");
      fetchStudents();
      setEditModal({ isOpen: false, student: null });
    } catch (error) {
      toast.error("Cloud Sync Failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrigger = (s) => {
    setDeleteModal({ isOpen: true, studentId: s.id, studentName: s.name });
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    const id = deleteModal.studentId;
    try {
      await deleteDoc(doc(db, "students", id));
      toast.success("Personnel Purged.");
      setStudents(students.filter(s => s.id !== id));
    } catch (error) {
      toast.error("Sync Failed.");
    } finally {
      setDeleteModal({ isOpen: false, studentId: null, studentName: '' });
    }
  };

  const handleAddStudentConfirm = async (formData) => {
    try {
      setLoading(true);
      const password = formData.password || '12345678';
      const cred = await createUserWithEmailAndPassword(auth, formData.email, password);
      const uid = cred.user.uid;
      await setDoc(doc(db, 'students', uid), {
        ...formData,
        uid,
        role: 'student',
        status: 'Active',
        globalAlertEnabled: false,
        createdAt: serverTimestamp()
      });
      toast.success('Personnel Commissioned.');
      setIsAddModalOpen(false);
      fetchStudents();
    } catch (error) {
      toast.error(error.code === 'auth/email-already-in-use' ? 'Email already registered.' : (error.message || 'Commission Failed.'));
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.enroll_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full p-4 lg:p-6 bg-[#f8fafc] flex flex-col overflow-hidden animate-slide-up">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-[22px] font-black text-slate-900 tracking-tight uppercase">Student Registry</h2>
          <p className="text-[10px] lg:text-[13px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Academic Personnel Node</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Search ID or Name..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[12px] lg:text-[13px] font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
            />
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] lg:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <FaPlus size={10} /> Add Personnel
          </button>
        </div>
      </div>

      <Card className="flex-1 rounded-[2rem] border-none shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col bg-white p-4 lg:p-6">
        {/* Desktop Table */}
        <div className="hidden sm:flex flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-2xl flex-col">
          <table className="w-full text-left border-collapse min-w-[1000px] table-fixed">
             <thead className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md">
               <tr>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-20">Cycle</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Personnel</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-40">Enrollment ID</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-40">Program</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-40">Semester</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-32">Status</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-20 text-center">Protocol</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
              {currentItems.map((s, index) => (
                <tr key={s.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-[13px] font-black text-slate-300">
                    {(indexOfFirstItem + index + 1).toString().padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col min-w-0">
                      <span className="font-black text-slate-900 text-[14px] uppercase tracking-tight truncate">{s.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-1">{s.email || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 uppercase tracking-tighter">
                       {s.enroll_no || 'TBD'}
                     </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] font-bold text-slate-500 uppercase tracking-tight truncate block">{s.program || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] font-bold text-slate-500 uppercase tracking-tight">{s.semester ? `Sem ${s.semester}` : 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${s.status === 'Inactive' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${s.status === 'Inactive' ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                      <span className="text-[10px] font-black tracking-widest uppercase">{s.status || 'Active'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <IconButton onClick={(e) => handleMenuClick(e, s)} size="small" className="hover:bg-slate-100">
                      <FaEllipsisV size={12} className="text-slate-400" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="sm:hidden flex-1 overflow-auto custom-scrollbar space-y-3">
          {currentItems.map((s, index) => (
            <div key={s.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-[13px] uppercase tracking-tight truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-0.5">{s.email || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${s.status === 'Inactive' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${s.status === 'Inactive' ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{s.status || 'Active'}</span>
                  </div>
                  <IconButton onClick={(e) => handleMenuClick(e, s)} size="small">
                    <FaEllipsisV size={12} className="text-slate-400" />
                  </IconButton>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 uppercase">{s.enroll_no || 'TBD'}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{s.program || 'N/A'}</span>
                {s.semester && <span className="text-[10px] font-bold text-slate-400 uppercase">Sem {s.semester}</span>}
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Registry Node <span className="text-slate-900">{indexOfFirstItem + 1}</span> - <span className="text-slate-900">{Math.min(indexOfLastItem, filteredStudents.length)}</span> of <span className="text-slate-900">{filteredStudents.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl border border-slate-100 bg-white text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
            >
              <FaArrowLeft size={10} />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => paginate(i + 1)}
                className={`w-10 h-10 rounded-xl text-[12px] font-black uppercase transition-all shadow-sm ${currentPage === i + 1 ? 'bg-slate-900 text-white' : 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-50'}`}
              >
                {i + 1}
              </button>
            ))}
            <button 
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2.5 rounded-xl border border-slate-100 bg-white text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
            >
              <FaChevronRight size={10} />
            </button>
          </div>
        </div>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: '1.5rem',
            boxShadow: '0 10px 40px -10px rgba(15,23,42,0.2)',
            border: '1px solid #f1f5f9',
            minWidth: '180px',
            mt: 1
          }
        }}
      >
        <MenuItem onClick={() => handleEdit(selectedStudent)} sx={{ gap: 2, py: 1.5, fontSize: '0.7rem', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <FaEdit className="text-blue-600" /> Edit Record
        </MenuItem>
        <MenuItem onClick={() => handleDeleteTrigger(selectedStudent)} sx={{ gap: 2, py: 1.5, fontSize: '0.7rem', fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', borderTop: '1px solid #f1f5f9' }}>
          <FaTrash /> Decommission
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog 
        open={editModal.isOpen} 
        onClose={() => setEditModal({ isOpen: false, student: null })} 
        PaperProps={{ 
          sx: { 
            borderRadius: '2.5rem', 
            width: '90%', 
            maxWidth: '600px', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
          } 
        }}
      >
        <div className="p-6 lg:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
               <FaEdit size={18} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Sync Personnel</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry Record Update</p>
            </div>
          </div>

          <form onSubmit={handleUpdateStudent} className="space-y-4 lg:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  type="text" value={editModal.student?.name || ''}
                  onChange={(e) => setEditModal({ ...editModal, student: { ...editModal.student, name: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Protocol</label>
                <select 
                  value={editModal.student?.status || 'Active'}
                  onChange={(e) => setEditModal({ ...editModal, student: { ...editModal.student, status: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500 appearance-none cursor-pointer shadow-inner"
                >
                  <option value="Active">Operational</option>
                  <option value="Inactive">Deactivated</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Digital Node (Email)</label>
              <input 
                type="email" value={editModal.student?.email || ''}
                onChange={(e) => setEditModal({ ...editModal, student: { ...editModal.student, email: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Program</label>
                <input 
                  type="text" value={editModal.student?.program || ''}
                  onChange={(e) => setEditModal({ ...editModal, student: { ...editModal.student, program: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
                <input 
                  type="text" value={editModal.student?.semester || ''}
                  onChange={(e) => setEditModal({ ...editModal, student: { ...editModal.student, semester: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner"
                />
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button 
                type="button" onClick={() => setEditModal({ isOpen: false, student: null })}
                className="flex-1 py-4 rounded-2xl bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Abort Sync
              </button>
              <button 
                type="submit"
                className="flex-[2] py-4 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all"
              >
                Commit Record Update
              </button>
            </div>
          </form>
        </div>
      </Dialog>

      <AlertModal 
        isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, studentId: null, studentName: '' })} onConfirm={handleConfirmDelete}
        title="Protocol Termination" message={`Warning: Permanently purging ${deleteModal.studentName} from the database. This action constitutes a terminal record deletion. Proceed?`}
        type="danger" confirmText="Purge" cancelText="Abort"
      />

      <AddStudentModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onConfirm={handleAddStudentConfirm} />
    </div>
  );
};

export default StudentUsers;
