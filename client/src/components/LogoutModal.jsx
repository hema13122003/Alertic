import React from 'react';
import { FaSignOutAlt } from 'react-icons/fa';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Soft Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      ></div>

      {/* Modal Container */}
      <div className="bg-white w-full max-w-[400px] rounded-[2rem] shadow-2xl relative z-10 overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
        <div className="p-10 text-center">
          {/* Subtle Icon Area */}
          <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-8">
             <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-200">
                <FaSignOutAlt size={20} />
             </div>
          </div>

          <h3 className="text-2xl font-bold text-[#1E293B] mb-3 tracking-tight">Confirm Sign Out</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">
            You are about to end your current session. Make sure all your changes have been saved.
          </p>
        </div>

        {/* Action Grid */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 px-6 rounded-2xl bg-white border border-slate-200 text-[#475569] font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all duration-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 px-6 rounded-2xl bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-200 hover:bg-rose-600 hover:scale-[1.02] active:scale-95 transition-all duration-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
