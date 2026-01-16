import React, { createContext, useState, useEffect } from 'react';

export const DarkModeContext = createContext({ darkMode: false, setDarkMode: () => {} });

export const DarkModeContextProvider = ({ children }) => {
  const readInitial = () => {
    try {
      // 1) per-user persisted theme key (userTheme_<id>) if present
      try {
        const currentUserJson = localStorage.getItem('currentUser') || localStorage.getItem('adminUser');
        if (currentUserJson) {
          const user = JSON.parse(currentUserJson);
          const uid = user._id || user.id || user.idStr || user.username || null;
          if (uid) {
            const per = localStorage.getItem(`userTheme_${uid}`);
            if (per === 'dark') return true;
            if (per === 'light') return false;
          }
        }
      } catch (e) { /* ignore parse errors */ }

      // 2) canonical 'theme' key written by settings
      const canonical = localStorage.getItem('theme');
      if (canonical === 'dark') return true;
      if (canonical === 'light') return false;
      if (canonical === 'system') return null; // signal to use system preference

      // 3) legacy user.customization stored in currentUser/adminUser
      const currentUserJson = localStorage.getItem('currentUser') || localStorage.getItem('adminUser');
      if (currentUserJson) {
        try {
          const user = JSON.parse(currentUserJson);
          const theme = user?.customization?.theme || user?.theme;
          if (theme === 'dark') return true;
          if (theme === 'light') return false;
          if (theme === 'system') return null;
        } catch (e) { /* ignore */ }
      }

      // 4) old boolean fallback
      const stored = localStorage.getItem('darkMode');
      if (stored === 'true') return true;
      if (stored === 'false') return false;

      // 5) system preference - but only as last resort
      // Most reliable way: light is default, only go dark if explicitly set or system says so
      return false; // Default to light mode instead of detecting system preference immediately
    } catch (e) {
      return false;
    }
  };

  const [darkMode, setDarkModeState] = useState(readInitial);

  const applyClass = (isDark) => {
    try {
      document.documentElement.classList.remove(isDark ? 'theme-light' : 'theme-dark');
      document.documentElement.classList.add(isDark ? 'theme-dark' : 'theme-light');
    } catch (e) {}
  };

  const setDarkMode = (value) => {
    const v = !!value;
    setDarkModeState(v);
    try {
      applyClass(v);
      localStorage.setItem('darkMode', v ? 'true' : 'false');
      localStorage.setItem('theme', v ? 'dark' : 'light');
    } catch (e) {}
  };

  useEffect(() => {
    applyClass(darkMode);
    
    // On mount, check if we should use system preference (only if nothing is explicitly set)
    if (!localStorage.getItem('theme') && !localStorage.getItem('darkMode')) {
      try {
        const currentUserJson = localStorage.getItem('currentUser') || localStorage.getItem('adminUser');
        let hasExplicitTheme = false;
        
        if (currentUserJson) {
          const user = JSON.parse(currentUserJson);
          const uid = user._id || user.id || user.idStr || user.username || null;
          if (uid && localStorage.getItem(`userTheme_${uid}`)) {
            hasExplicitTheme = true;
          }
          if (user?.customization?.theme || user?.theme) {
            hasExplicitTheme = true;
          }
        }
        
        // Only check system preference if no explicit theme is set
        if (!hasExplicitTheme && window.matchMedia) {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark && !darkMode) {
            setDarkModeState(true);
          }
        }
      } catch (e) { /* ignore */ }
    }
  }, [darkMode]);

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};
