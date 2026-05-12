import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaUsers, FaUserGraduate, FaTable, FaSignOutAlt, FaUserPlus, FaMoneyBillWave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LogoutModal from './LogoutModal';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  
  const userRole = localStorage.getItem('userRole') || 'admin';
  const userEmail = localStorage.getItem('userEmail') || 'admin@alertic.com';
  
  const getDashboardPath = () => {
    if (userRole === 'faculty') return '/faculty-dashboard';
    if (userRole === 'student') return '/student-dashboard';
    return '/dashboard';
  };

  const allMenuItems = [
    { name: 'Dashboard', icon: <FaTable />, path: getDashboardPath(), roles: ['admin', 'student', 'faculty'] },
    { name: 'My Timetable', icon: <FaTable />, path: '/my-timetable', roles: ['faculty'] },
    { name: 'Timetable', icon: <FaTable />, path: '/student-timetable', roles: ['faculty', 'student'] },
    { name: 'Add Student', icon: <FaUserPlus />, path: '/faculty-students', roles: ['faculty'] },
    { name: 'Fee Manager', icon: <FaMoneyBillWave />, path: '/fee-manager', roles: ['faculty'] },
    { name: 'Alert Settings', icon: <FaUsers />, path: '/alert-settings', roles: ['admin', 'faculty', 'student'] },
    { name: 'Staff Users', icon: <FaUsers />, path: '/staff', roles: ['admin'] },
    { name: 'Student Users', icon: <FaUserGraduate />, path: '/students', roles: ['admin'] },
    { name: 'Table Creation', icon: <FaTable />, path: '/table-creation', roles: ['admin'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    toast.info("Logged out successfully.");
    navigate('/login');
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  return (
    <>
      <div className={`fixed lg:relative top-0 left-0 w-72 h-full bg-white text-slate-900 flex flex-col z-[100] border-r border-slate-200 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-8 lg:p-10 mb-2">
          <div className="text-xl lg:text-2xl font-black tracking-tight text-[#1E293B] flex items-center gap-2">
             ALERTIC <span className="text-[#2563EB] font-light">CLOUD</span>
          </div>
          <p className="text-slate-400 text-[9px] lg:text-[10px] mt-1 font-bold uppercase tracking-widest opacity-80">Management Interface</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center px-5 py-3.5 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? 'bg-[#EEF2FF] text-[#2563EB] font-bold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-lg mr-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-[#2563EB]' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  <span className="text-[13px] tracking-tight">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-50 space-y-4 bg-slate-50/50">
          <button 
            onClick={() => setIsLogoutOpen(true)}
            className="w-full flex items-center px-5 py-3 rounded-xl text-slate-400 hover:bg-white hover:text-rose-500 hover:shadow-sm transition-all duration-300 group font-bold text-[12px] uppercase tracking-wider"
          >
            <span className="text-lg mr-4"><FaSignOutAlt /></span>
            <span>Sign Out</span>
          </button>

          <div className="bg-white rounded-2xl p-4 flex items-center gap-3 border border-slate-100 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-[#F1F5F9] border border-slate-200 flex items-center justify-center text-slate-600 font-bold uppercase overflow-hidden">
               {userEmail.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-[12px] font-bold truncate text-slate-900">{userEmail.split('@')[0]}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{userRole}</p>
            </div>
          </div>
        </div>
      </div>

      <LogoutModal 
        isOpen={isLogoutOpen} 
        onClose={() => setIsLogoutOpen(false)} 
        onConfirm={handleLogout} 
      />
    </>
  );
};

export default Sidebar;
