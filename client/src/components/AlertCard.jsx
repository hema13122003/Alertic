import React from 'react';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

const AlertCard = ({ title, message, type = 'info', onClose }) => {
  const themes = {
    success: {
      border: 'border-emerald-100',
      bg: 'bg-emerald-50/30',
      iconBg: 'bg-emerald-50',
      icon: <FaCheckCircle className="text-emerald-500" />,
      title: 'text-emerald-600',
      glow: 'shadow-emerald-200/50'
    },
    warning: {
      border: 'border-yellow-100',
      bg: 'bg-yellow-50/30',
      iconBg: 'bg-yellow-50',
      icon: <FaExclamationTriangle className="text-alertic-yellow" />,
      title: 'text-yellow-700',
      glow: 'shadow-yellow-200/50'
    },
    error: {
      border: 'border-red-100',
      bg: 'bg-red-50/30',
      iconBg: 'bg-red-50',
      icon: <FaExclamationTriangle className="text-red-500" />,
      title: 'text-red-600',
      glow: 'shadow-red-200/50'
    },
    info: {
      border: 'border-blue-100',
      bg: 'bg-blue-50/30',
      iconBg: 'bg-blue-50',
      icon: <FaInfoCircle className="text-blue-500" />,
      title: 'text-blue-600',
      glow: 'shadow-blue-200/50'
    }
  };

  const theme = themes[type] || themes.info;

  return (
    <div className={`w-full p-5 rounded-2xl border ${theme.border} ${theme.bg} backdrop-blur-sm relative overflow-hidden group animate-fade-in shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className="flex gap-4 relative z-10 items-start">
        <div className={`w-10 h-10 rounded-xl ${theme.iconBg} flex items-center justify-center text-lg shadow-inner border border-white ${theme.glow}`}>
          {theme.icon}
        </div>
        
        <div className="flex-1">
          <h3 className={`font-black text-[10px] uppercase tracking-[0.2em] mb-1 ${theme.title}`}>{title}</h3>
          <p className="text-slate-600 text-[11px] font-bold leading-tight">
            {message}
          </p>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-300 hover:text-slate-900 transition-all active:scale-90"
          >
            <FaTimes size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertCard;
