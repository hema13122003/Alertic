import React, { useState } from 'react';
import { Menu, MenuItem, Box, Typography, Divider, Badge, IconButton } from '@mui/material';
import { FaBell, FaInfoCircle, FaCalendarCheck, FaBars, FaTimes } from 'react-icons/fa';
import Sidebar from './Sidebar';
import AlertBroadcast from './AlertBroadcast';
import ThemeSwitcher from './ThemeSwitcher';

const DashboardLayout = ({ children }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const open = Boolean(anchorEl);
  const userRole = localStorage.getItem('userRole') || 'admin';
  const userEmail = localStorage.getItem('userEmail') || 'Admin';
  const userName = userEmail.split('@')[0];

  const handleBellClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div className="flex w-full h-full overflow-hidden bg-[#F8FAFC] font-sans relative">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 relative z-10">
          <div className="flex items-center gap-3 lg:gap-10">
            {/* Mobile Toggle Button */}
            <IconButton 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden text-slate-600"
              size="small"
            >
              {isMobileMenuOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
            </IconButton>

            <div className="hidden sm:block">
              <h1 className="text-[11px] lg:text-sm font-black text-[#1E293B] uppercase tracking-wider leading-none mb-1">
                {userRole === 'faculty' ? 'Faculty Command' : userRole === 'student' ? 'Student Terminal' : 'Administration Center'}
              </h1>
              <p className="text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-80 leading-none">Session Active: {userName}</p>
            </div>
            
            <AlertBroadcast />
          </div>

          <div className="flex items-center gap-6">
             <div className="text-right flex-col items-end hidden sm:flex">
                <p className="text-[11px] font-bold text-[#1E293B]">
                   {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">System Online</p>
                </div>
             </div>
             
             <ThemeSwitcher />
             
             <button 
               onClick={handleBellClick}
               className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                 open ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-[#2563EB] hover:border-[#2563EB]/20 shadow-sm'
               }`}
             >
                <FaBell size={14} />
             </button>

             <Menu
               anchorEl={anchorEl}
               open={open}
               onClose={handleClose}
               transformOrigin={{ horizontal: 'right', vertical: 'top' }}
               anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
               PaperProps={{
                 sx: {
                   width: 300,
                   mt: 1.5,
                   borderRadius: '1.25rem',
                   boxShadow: '0 20px 50px -12px rgba(15,23,42,0.15)',
                   border: '1px solid #f1f5f9',
                   p: 0,
                   overflow: 'hidden'
                 }
               }}
             >
               <Box className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                 <Typography className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none">Terminal Logs</Typography>
                 <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase leading-none">v1.0</span>
               </Box>
               
               <Box className="p-4 bg-white text-center">
                 <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-3 border border-slate-100/50">
                   <FaInfoCircle size={20} />
                 </div>
                 <Typography className="text-[13px] font-bold text-slate-900 mb-1 leading-none">No Active Logs</Typography>
                 <Typography className="text-[11px] text-slate-400 font-medium leading-tight">Tactical alerts and system updates will be logged here.</Typography>
               </Box>

               <Divider />

               <Box className="p-2">
                 <MenuItem onClick={handleClose} className="rounded-xl flex items-center gap-3 py-2.5">
                   <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                     <FaCalendarCheck size={12} />
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-800 leading-none mb-1 uppercase tracking-tight">Cloud Sync</span>
                     <span className="text-[9px] text-slate-400 font-medium leading-none">Protocols operational.</span>
                   </div>
                 </MenuItem>
               </Box>
             </Menu>
          </div>
        </header>

        <main className="flex-1 p-2 sm:p-4 lg:p-8 overflow-hidden flex flex-col min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
