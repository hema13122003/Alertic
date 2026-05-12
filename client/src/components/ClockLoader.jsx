import React from 'react';

const ClockLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12 animate-fade-in">
      <div className="relative w-20 h-20 border-[3px] border-luxury-blue-100 rounded-full shadow-xl shadow-luxury-blue-900/5 bg-white flex items-center justify-center">
        {/* Hour Hand */}
        <div className="absolute top-1/2 left-1/2 w-1 h-5 bg-luxury-blue-900 rounded-full origin-bottom -translate-x-1/2 -translate-y-full animate-[spin_3s_linear_infinite]"></div>
        {/* Minute Hand */}
        <div className="absolute top-1/2 left-1/2 w-0.5 h-7 bg-alertic-yellow rounded-full origin-bottom -translate-x-1/2 -translate-y-full animate-[spin_12s_linear_infinite]"></div>
        {/* Center Dot */}
        <div className="w-2.5 h-2.5 bg-luxury-blue-950 rounded-full z-10 border-2 border-white"></div>
        
        {/* Outer Glow */}
        <div className="absolute inset-0 rounded-full border border-alertic-yellow/20 animate-pulse"></div>
      </div>
      <p className="mt-6 text-sm font-bold text-luxury-blue-900 tracking-widest uppercase opacity-40 animate-pulse">Synchronizing</p>
    </div>
  );
};

export default ClockLoader;
