import React from 'react';
import ReactDOM from 'react-dom';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTrash, FaQuestionCircle } from 'react-icons/fa';

const AlertModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning', // 'danger', 'warning', 'success', 'info'
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) => {
  // Handle body scroll locking and global blur
  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  if (!isOpen) return null;

  const config = {
    danger: {
      icon: <FaTrash />,
      color: 'text-red-500',
      bg: 'bg-red-50',
      ring: 'ring-red-100',
      btn: 'bg-red-500 text-white shadow-red-200',
      accent: 'bg-red-500'
    },
    warning: {
      icon: <FaExclamationTriangle />,
      color: 'text-alertic-yellow',
      bg: 'bg-yellow-50',
      ring: 'ring-yellow-100',
      btn: 'bg-[oklch(62.3% 0.214 259.815)] text-slate-900 shadow-yellow-200',
      accent: 'bg-[oklch(62.3% 0.214 259.815)]'
    },
    success: {
      icon: <FaCheckCircle />,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-100',
      btn: 'bg-emerald-500 text-white shadow-emerald-200',
      accent: 'bg-emerald-500'
    },
    info: {
      icon: <FaInfoCircle />,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      ring: 'ring-blue-100',
      btn: 'bg-blue-600 text-white shadow-blue-200',
      accent: 'bg-blue-600'
    }
  };

  const theme = config[type] || config.warning;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop with high-end blur */}
      <div
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      ></div>

      {/* Modal Content - Premium Light Card */}
      <div className="w-full max-w-sm bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.15)] relative z-10 animate-slide-up overflow-hidden">
        {/* Decorative background light */}
        <div className={`absolute -top-12 -right-12 w-32 h-32 ${theme.bg} rounded-full blur-[50px] opacity-70`}></div>

        <div className="flex flex-col items-center text-center relative z-10">
          <div className={`w-20 h-20 ${theme.bg} rounded-[2rem] flex items-center justify-center ${theme.color} text-3xl mb-6 shadow-inner border border-white`}>
            {theme.icon}
          </div>

          <h2 className="text-xl font-black text-slate-900 mb-2 tracking-tight uppercase tracking-[0.1em]">{title}</h2>
          <p className="text-slate-500 text-xs mb-8 leading-relaxed font-bold px-4">
            {message}
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={onConfirm}
              className={`w-full px-6 py-4 rounded-2xl ${theme.btn} font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-[10px] uppercase tracking-[0.2em]`}
            >
              {confirmText}
            </button>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 rounded-2xl bg-slate-50 text-slate-400 font-black hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95 text-[10px] uppercase tracking-[0.2em]"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AlertModal;
