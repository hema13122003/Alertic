import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { facultyService } from '../services/firebaseService';
import { db, auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, deleteDoc, updateDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { 
  FaPlus, 
  FaEllipsisV, 
  FaSearch, 
  FaUserEdit, 
  FaTrashAlt, 
  FaLock, 
  FaUserGraduate,
  FaEdit,
  FaTrash,
  FaFilter,
  FaTimes,
  FaArrowLeft,
  FaChevronRight
} from 'react-icons/fa';
import ClockLoader from '../components/ClockLoader';
import AlertModal from '../components/AlertModal';
import AddFacultyModal from '../components/AddFacultyModal';
import { Card, Menu, MenuItem, IconButton } from '@mui/material';

const FacultyUsers = () => {
  const [loading, setLoading] = useState(true);
  const [faculty, setFaculty] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, facultyId: null, facultyName: '' });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editFaculty, setEditFaculty] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedFaculty, setSelectedFaculty] = useState(null);

  const handleMenuClick = (event, f) => {
    setAnchorEl(event.currentTarget);
    setSelectedFaculty(f);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedFaculty(null);
  };

  const fetchFaculty = async () => {
    try {
      setLoading(true);
      const data = await facultyService.getAll();
      setFaculty(data);
    } catch (error) {
      toast.error("Registry Sync Failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const filteredFaculty = faculty.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.emp_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredFaculty.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredFaculty.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleEdit = (facultyMember) => {
    setEditFaculty(facultyMember);
    setIsAddModalOpen(true);
  };

  const handleDeleteTrigger = (f) => {
    setDeleteModal({ isOpen: true, facultyId: f.id, facultyName: f.name });
  };

  const handleConfirmDelete = async () => {
    const id = deleteModal.facultyId;
    try {
      await deleteDoc(doc(db, "faculties", id));
      toast.success("Personnel Decommissioned.");
      setFaculty(faculty.filter(f => f.id !== id));
    } catch (error) {
      toast.error("Sync Failed.");
    } finally {
      setDeleteModal({ isOpen: false, facultyId: null, facultyName: '' });
    }
  };

  const handleAddOrUpdateFaculty = async (formData) => {
    try {
      setLoading(true);
      if (editFaculty) {
        await updateDoc(doc(db, 'faculties', editFaculty.id), { ...formData, updatedAt: serverTimestamp() });
        toast.success('Personnel Updated.');
      } else {
        // Create Firebase Auth account directly (Spark compatible)
        const password = formData.password || '12345678';
        const cred = await createUserWithEmailAndPassword(auth, formData.email, password);
        const uid = cred.user.uid;
        // Save to Firestore using Auth UID as doc ID
        await setDoc(doc(db, 'faculties', uid), {
          ...formData,
          uid,
          role: 'faculty',
          status: formData.status || 'Active',
          globalAlertEnabled: false,
          createdAt: serverTimestamp()
        });
        toast.success('Personnel Commissioned.');
      }
      setIsAddModalOpen(false);
      setEditFaculty(null);
      fetchFaculty();
    } catch (error) {
      toast.error(error.code === 'auth/email-already-in-use' ? 'Email already registered.' : (error.message || 'Registry Update Failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full p-4 lg:p-6 bg-[#f8fafc] flex flex-col overflow-hidden animate-slide-up">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-[22px] font-black text-slate-900 tracking-tight uppercase">Faculty Registry</h2>
          <p className="text-[10px] lg:text-[13px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Personnel Management Node</p>
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
          <table className="w-full text-left border-collapse min-w-[800px] table-fixed">
             <thead className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md">
               <tr>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-20">Cycle</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Personnel</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-40">Employee ID</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-40">Department</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-32">Status</th>
                 <th className="px-6 py-4 text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-20 text-center">Protocol</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
              {currentItems.map((f, index) => (
                <tr key={f.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-[13px] font-black text-slate-300">
                    {(indexOfFirstItem + index + 1).toString().padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col min-w-0">
                      <span className="font-black text-slate-900 text-[14px] uppercase tracking-tight truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-1">{f.email || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 uppercase tracking-tighter">
                       {f.emp_id || 'TBD'}
                     </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] font-bold text-slate-500 uppercase tracking-tight">{f.dept || 'General'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${f.status === 'Inactive' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${f.status === 'Inactive' ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                      <span className="text-[10px] font-black tracking-widest uppercase">{f.status || 'Active'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <IconButton onClick={(e) => handleMenuClick(e, f)} size="small" className="hover:bg-slate-100">
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
          {currentItems.map((f, index) => (
            <div key={f.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-[13px] uppercase tracking-tight truncate">{f.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-0.5">{f.email || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${f.status === 'Inactive' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${f.status === 'Inactive' ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{f.status || 'Active'}</span>
                  </div>
                  <IconButton onClick={(e) => handleMenuClick(e, f)} size="small">
                    <FaEllipsisV size={12} className="text-slate-400" />
                  </IconButton>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 uppercase">{f.emp_id || 'TBD'}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{f.dept || 'General'}</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Registry Node <span className="text-slate-900">{indexOfFirstItem + 1}</span> - <span className="text-slate-900">{Math.min(indexOfLastItem, filteredFaculty.length)}</span> of <span className="text-slate-900">{filteredFaculty.length}</span>
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
        <MenuItem onClick={() => { handleEdit(selectedFaculty); handleMenuClose(); }} sx={{ gap: 2, py: 1.5, fontSize: '0.7rem', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <FaEdit className="text-blue-600" /> Edit Record
        </MenuItem>
        <MenuItem onClick={() => { handleDeleteTrigger(selectedFaculty); handleMenuClose(); }} sx={{ gap: 2, py: 1.5, fontSize: '0.7rem', fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', borderTop: '1px solid #f1f5f9' }}>
          <FaTrash /> Decommission
        </MenuItem>
      </Menu>

      <AlertModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, facultyId: null, facultyName: '' })}
        onConfirm={handleConfirmDelete}
        title="Protocol Termination"
        message={`Warning: Permanently removing ${deleteModal.facultyName} from the institutional registry. Proceed with deactivation?`}
        type="danger"
        confirmText="Confirm"
        cancelText="Abort"
      />
      <AddFacultyModal 
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditFaculty(null); }}
        onConfirm={handleAddOrUpdateFaculty}
        initialData={editFaculty}
      />
    </div>
  );
};

export default FacultyUsers;
