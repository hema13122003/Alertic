import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeContextProvider = ({ children }) => {
  // Retrieve initial theme from localStorage, default to 'dark-ai'
  const [theme, setThemeState] = useState(() => {
    const savedTheme = localStorage.getItem('alertic-theme');
    return savedTheme || 'dark-ai';
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  // Sync theme changes with localStorage and DOM data attribute
  useEffect(() => {
    localStorage.setItem('alertic-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Available themes metadata for UI switcher options
  const themes = [
    {
      id: 'dark-ai',
      name: 'Dark AI Theme',
      desc: 'Deep tech carbon space',
      colors: ['#060913', '#0a0f1d', '#3b82f6', '#ffffff'] // [bg, card, accent, text]
    },
    {
      id: 'light',
      name: 'Light Theme',
      desc: 'Clean ultra-crisp slate',
      colors: ['#f8fafc', '#ffffff', '#2563eb', '#0f172a']
    },
    {
      id: 'green-agri',
      name: 'Green Agri Theme',
      desc: 'Eco-friendly natural vibe',
      colors: ['#f0fdf4', '#ffffff', '#10b981', '#166534']
    },
    {
      id: 'cyber-neon',
      name: 'Cyber Neon Theme',
      desc: 'Vibrant futuristic cyber space',
      colors: ['#030008', '#100522', '#ff007f', '#00f5ff']
    }
  ];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeContextProvider');
  }
  return context;
};
