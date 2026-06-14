import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FaSun, FaMoon, FaLeaf, FaBolt, FaPalette, FaCheck } from 'react-icons/fa';

// Map theme IDs to representative icons
const getThemeIcon = (id, size = 14) => {
  switch (id) {
    case 'dark-ai':
      return <FaMoon size={size} className="text-[#3b82f6]" />;
    case 'light':
      return <FaSun size={size} className="text-[#eab308]" />;
    case 'green-agri':
      return <FaLeaf size={size} className="text-[#10b981]" />;
    case 'cyber-neon':
      return <FaBolt size={size} className="text-[#ff007f] animate-pulse" />;
    default:
      return <FaPalette size={size} />;
  }
};

const ThemeSwitcher = () => {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeThemeObj = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switcher Main Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-lg border flex items-center justify-center transition-all bg-slate-50 border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-600/20 shadow-sm relative overflow-hidden group cursor-pointer"
        title="Change UI Theme"
      >
        <span className="group-hover:rotate-12 transition-transform duration-300 relative z-10">
          {getThemeIcon(theme, 15)}
        </span>
        
        {/* Glow accent matching the current theme on hover */}
        <span 
          className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" 
          style={{ backgroundColor: activeThemeObj.colors[2] }} 
        />
      </button>

      {/* Premium Dropdown Selector */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-76 rounded-2xl border border-slate-100 bg-white p-3 shadow-2xl z-50 animate-fade-in origin-top-right">
          
          {/* Header Title */}
          <div className="px-3 py-2 bg-slate-50 rounded-xl border-b border-slate-100 flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none flex items-center gap-1.5">
              <FaPalette className="text-blue-600 animate-pulse" size={11} /> 
              Interface Theme
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">SYSTEM CONTROL</span>
          </div>

          {/* Theme Options */}
          <div className="space-y-1">
            {themes.map((themeOption) => {
              const isSelected = themeOption.id === theme;
              return (
                <button
                  key={themeOption.id}
                  onClick={() => {
                    setTheme(themeOption.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start justify-between transition-all duration-300 hover:bg-slate-50 cursor-pointer ${
                    isSelected ? 'bg-slate-50/80 border border-slate-200/50' : 'border border-transparent'
                  }`}
                >
                  <div className="flex gap-2.5 min-w-0 flex-1">
                    {/* Circle Icon Badge */}
                    <div 
                      className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 shadow-sm border transition-colors ${
                        isSelected 
                          ? 'bg-white border-slate-200' 
                          : 'bg-slate-50 border-slate-100 group-hover:bg-white'
                      }`}
                    >
                      {getThemeIcon(themeOption.id, 14)}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-black text-slate-900 leading-none mb-0.5 uppercase tracking-tight">
                        {themeOption.name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold leading-none mb-2 tracking-wide uppercase opacity-80 truncate">
                        {themeOption.desc}
                      </span>

                      {/* Mini Color Palette Selector / Dots */}
                      <div className="flex gap-1.5 items-center">
                        {themeOption.colors.map((color, colorIdx) => (
                          <span 
                            key={colorIdx}
                            className="w-2.5 h-2.5 rounded-full border border-slate-200/20 shadow-sm transition-transform duration-300 hover:scale-125" 
                            style={{ backgroundColor: color }}
                            title={
                              colorIdx === 0 ? 'Background' :
                              colorIdx === 1 ? 'Surface Card' :
                              colorIdx === 2 ? 'Accent Color' : 'Text Primary'
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active Indicator Checkmark */}
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                      <FaCheck size={7} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
